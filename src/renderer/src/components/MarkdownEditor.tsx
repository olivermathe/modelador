import DOMPurify from 'dompurify'
import { Columns2, Eye, Pencil, type LucideIcon } from 'lucide-react'
import { marked } from 'marked'
import { useEffect, useMemo, useState } from 'react'
import { displayPath, useModel } from '@/model/store'

type Mode = 'edit' | 'split' | 'preview'

const MODES: { value: Mode; label: string; icon: LucideIcon }[] = [
  { value: 'edit', label: 'Editar', icon: Pencil },
  { value: 'split', label: 'Dividido', icon: Columns2 },
  { value: 'preview', label: 'Visualizar', icon: Eye }
]

marked.setOptions({ gfm: true, breaks: false })

/** Markdown → HTML seguro (sem scripts nem handlers vindos do arquivo). */
function renderMarkdown(text: string): string {
  return DOMPurify.sanitize(marked.parse(text, { async: false }))
}

const IMAGE_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml'
}

/** `src` de imagem relativo ao documento (não http, data, etc.). */
const isLocalSrc = (src: string): boolean => !!src && !/^([a-z][a-z0-9+.-]*:|\/\/|#)/i.test(src)

/** Caminho no repositório de uma imagem citada pelo documento `docPath` (`./x.png`, `../img/x.png`). */
function resolveImage(docPath: string, src: string): string | undefined {
  let decoded = src.split(/[?#]/)[0]
  try {
    decoded = decodeURIComponent(decoded)
  } catch {
    // mantém como está
  }
  const parts = docPath.split('/').slice(0, -1)
  for (const part of decoded.split('/')) {
    if (part === '' || part === '.') continue
    if (part === '..') {
      if (!parts.length) return undefined
      parts.pop()
    } else parts.push(part)
  }
  return parts.join('/').normalize('NFC')
}

/** Cache das imagens já lidas do disco (caminho → data URL; `null` = não existe). */
const imageCache = new Map<string, string | null>()

/**
 * Troca o `src` das imagens locais pelo conteúdo do arquivo (o preview não lê o disco direto).
 * Imagens ainda não salvas (ex.: copiadas de uma pasta modelo) vêm da memória.
 */
function useLocalImages(html: string, docPath: string): string {
  const root = useModel((s) => s.root)
  const pendingFiles = useModel((s) => s.pendingFiles)
  const [, setLoaded] = useState(0)
  // Novo a cada render: o mesmo documento é preenchido de novo quando as imagens chegam
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const wanted = [...doc.querySelectorAll('img')]
    .map((img) => img.getAttribute('src') ?? '')
    .filter(isLocalSrc)
    .map((src) => resolveImage(docPath, src))
    .filter((p): p is string => !!p)
  const key = `${root}|${wanted.join('|')}`

  // Abrir o documento relê as imagens (podem ter sido trocadas, ex.: JPEG exportado de novo)
  useEffect(() => imageCache.clear(), [docPath])

  useEffect(() => {
    if (!root) return
    let alive = true
    const missing = wanted.filter((p) => !imageCache.has(`${root}|${p}`) && !pendingFiles[p])
    Promise.all(missing.map(async (p) => imageCache.set(`${root}|${p}`, await window.api.readImage(root, p)))).then(
      () => alive && missing.length && setLoaded((n) => n + 1)
    )
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  for (const img of doc.querySelectorAll('img')) {
    const src = img.getAttribute('src') ?? ''
    if (!isLocalSrc(src)) continue
    const p = resolveImage(docPath, src)
    const type = p && IMAGE_TYPES[p.split('.').pop()?.toLowerCase() ?? '']
    const url = p && (pendingFiles[p] && type ? `data:${type};base64,${pendingFiles[p]}` : imageCache.get(`${root}|${p}`))
    // Enquanto carrega (ou se não existir), sem src: aparece só o texto alternativo
    if (url) img.setAttribute('src', url)
    else img.removeAttribute('src')
  }
  return doc.body.innerHTML
}

export function MarkdownEditor({ path }: { path: string }): JSX.Element {
  const text = useModel((s) => s.docs[path] ?? '')
  const updateDoc = useModel((s) => s.updateDoc)
  const folderNames = useModel((s) => s.folderNames)
  const [mode, setMode] = useState<Mode>('split')
  const rendered = useMemo(() => (mode === 'edit' ? '' : renderMarkdown(text)), [text, mode])
  const html = useLocalImages(rendered, path)

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex shrink-0 items-center gap-1 border-b border-slate-200 px-3 py-1.5">
        <span className="mr-auto truncate font-mono text-xs text-slate-400">{displayPath(path, folderNames)}</span>
        {MODES.map((m) => (
          <button
            key={m.value}
            onClick={() => setMode(m.value)}
            className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs ${
              mode === m.value ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <m.icon className="h-3.5 w-3.5" /> {m.label}
          </button>
        ))}
      </div>
      <div className="flex min-h-0 flex-1">
        {mode !== 'preview' && (
          <textarea
            value={text}
            onChange={(e) => updateDoc(path, e.target.value)}
            onKeyDown={(e) => {
              // Tab insere recuo em vez de sair do campo
              if (e.key !== 'Tab') return
              e.preventDefault()
              const el = e.currentTarget
              const { selectionStart: start, selectionEnd: end } = el
              updateDoc(path, text.slice(0, start) + '  ' + text.slice(end))
              requestAnimationFrame(() => el.setSelectionRange(start + 2, start + 2))
            }}
            spellCheck={false}
            className={`min-w-0 flex-1 resize-none p-5 font-mono text-sm leading-relaxed text-slate-800 outline-none ${
              mode === 'split' ? 'border-r border-slate-200' : ''
            }`}
            placeholder="Escreva em Markdown…"
          />
        )}
        {mode !== 'edit' && (
          <div
            className="prose prose-slate min-w-0 max-w-none flex-1 overflow-y-auto p-6 prose-pre:bg-slate-900 prose-img:rounded-md prose-code:before:content-none prose-code:after:content-none prose-code:rounded prose-code:bg-slate-100 prose-code:px-1 prose-code:font-normal"
            // Links abrem no navegador, não dentro do app
            onClick={(e) => {
              const link = (e.target as HTMLElement).closest('a')
              if (!link) return
              e.preventDefault()
              if (/^https?:/.test(link.href)) window.open(link.href, '_blank')
            }}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )}
      </div>
    </div>
  )
}
