import DOMPurify from 'dompurify'
import { Columns2, Eye, Pencil, type LucideIcon } from 'lucide-react'
import { marked } from 'marked'
import { useMemo, useState } from 'react'
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

export function MarkdownEditor({ path }: { path: string }): JSX.Element {
  const text = useModel((s) => s.docs[path] ?? '')
  const updateDoc = useModel((s) => s.updateDoc)
  const folderNames = useModel((s) => s.folderNames)
  const [mode, setMode] = useState<Mode>('split')
  const html = useMemo(() => (mode === 'edit' ? '' : renderMarkdown(text)), [text, mode])

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
