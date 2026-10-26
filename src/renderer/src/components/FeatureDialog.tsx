import { FolderPlus } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { displayPath, useModel } from '@/model/store'
import { REPO_FOLDERS } from '@/model/types'

const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'] as const

/** Conteúdo lido da pasta modelo (caminhos relativos a ela). */
type Template = { files: { path: string; base64: string }[]; dirs: string[] }

const inputClass =
  'w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400'

/** Nome digitado → nome de pasta seguro (sem / \ : * ? " < > |). */
const sanitize = (name: string): string => name.trim().replace(/[\\/:*?"<>|]+/g, '-')

/** `<ano>-<trimestre>-<número>-<nome da feature>` */
export function featureFolderName(year: string, quarter: string, number: string, name: string): string {
  return `${year}-${quarter}-${number}-${sanitize(name)}`
}

function featureDoc(name: string, number: string, year: string, quarter: string): string {
  return `# ${name.trim()}

- **Feature:** ${number} (Azure DevOps)
- **Período:** ${year} ${quarter}

## Contexto

## Solução proposta

## Impactos

## Decisões
`
}

function Field({ label, error, children }: { label: string; error?: string | null; children: ReactNode }): JSX.Element {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      {children}
      {error && <span className="mt-1 block text-[11px] text-rose-600">{error}</span>}
    </label>
  )
}

/**
 * Modal "Nova feature": cria em memória a pasta `<ano>-<trimestre>-<número>-<nome>`
 * com diagrama.json, processo.json e doc.md. Vai para o disco no Salvar.
 */
export function FeatureDialog(): JSX.Element | null {
  const dialog = useModel((s) => s.featureDialog)
  if (!dialog) return null
  // Remonta a cada abertura, começando com os campos limpos
  return <FeatureForm key={dialog.dir} initialDir={dialog.dir} />
}

function FeatureForm({ initialDir }: { initialDir: string }): JSX.Element {
  const dirs = useModel((s) => s.dirs)
  const diagrams = useModel((s) => s.diagrams)
  const docs = useModel((s) => s.docs)
  const otherFiles = useModel((s) => s.otherFiles)
  const root = useModel((s) => s.root)
  const folderNames = useModel((s) => s.folderNames)
  const { createFeature, createFeatureFromTemplate, closeFeatureDialog } = useModel.getState()

  const now = new Date()
  const [name, setName] = useState('')
  const [number, setNumber] = useState('')
  const [dir, setDir] = useState(initialDir)
  const [year, setYear] = useState(String(now.getFullYear()))
  const [quarter, setQuarter] = useState<string>(QUARTERS[Math.floor(now.getMonth() / 3)])
  const [touched, setTouched] = useState(false)

  // Pasta modelo: lembrada por repositório (preferência deste computador)
  const templateKey = `modelo-feature:${root}`
  const [templatePath, setTemplatePath] = useState<string | null>(() => {
    try {
      return localStorage.getItem(templateKey)
    } catch {
      return null
    }
  })
  const [useTemplate, setUseTemplate] = useState(!!templatePath)
  const [template, setTemplate] = useState<Template | null>(null)
  const [templateError, setTemplateError] = useState<string | null>(null)

  // Lê a pasta modelo para mostrar o que será copiado
  useEffect(() => {
    setTemplate(null)
    setTemplateError(null)
    if (!useTemplate || !templatePath) return
    let alive = true
    window.api
      .readTemplate(templatePath)
      .then((t) => alive && setTemplate(t))
      .catch((e: Error) => alive && setTemplateError(e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')))
    return () => {
      alive = false
    }
  }, [useTemplate, templatePath])

  const pickTemplate = async (): Promise<void> => {
    const picked = await window.api.pickTemplate()
    if (!picked) return
    setTemplatePath(picked)
    setUseTemplate(true)
    try {
      localStorage.setItem(templateKey, picked)
    } catch {
      // sem armazenamento: só não lembra na próxima vez
    }
  }

  // Pastas de projetos/ (inclusive as que só existem em memória)
  const folders = useMemo(() => {
    const all = new Set([
      REPO_FOLDERS.projects as string,
      ...dirs.filter((d) => d.startsWith(`${REPO_FOLDERS.projects}/`))
    ])
    for (const p of [...Object.keys(diagrams), ...Object.keys(docs)]) all.add(p.split('/').slice(0, -1).join('/'))
    return [...all].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [dirs, diagrams, docs])

  const folderName = featureFolderName(year, quarter, number.trim(), name)
  const target = `${dir}/${folderName}`
  const taken =
    dirs.includes(target) ||
    [...Object.keys(diagrams), ...Object.keys(docs), ...otherFiles].some(
      (p) => p === target || p.startsWith(`${target}/`)
    )

  const errors = {
    name: !name.trim() ? 'Informe o nome da feature.' : null,
    number: !/^\d+$/.test(number.trim()) ? 'Use só números (id do work item no Azure DevOps).' : null,
    year: !/^\d{4}$/.test(year) ? 'Ano com 4 dígitos.' : null,
    target: taken ? 'Já existe uma pasta com esse nome nesse lugar.' : null,
    template: useTemplate && !template ? (templateError ?? 'Escolha a pasta modelo.') : null
  }
  const valid = !Object.values(errors).some(Boolean)

  const submit = (): void => {
    setTouched(true)
    if (!valid) return
    if (useTemplate && template) createFeatureFromTemplate(target, template)
    else createFeature(target, featureDoc(name, number.trim(), year, quarter))
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') closeFeatureDialog()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [closeFeatureDialog])

  const show = (error: string | null): string | null => (touched ? error : null)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onMouseDown={closeFeatureDialog}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-label="Nova feature"
        className="w-full max-w-md rounded-xl bg-white shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <div className="space-y-1 p-5 pb-3">
          <h2 className="text-base font-semibold text-slate-900">Nova feature</h2>
          <p className="text-sm text-slate-500">
            Cria uma pasta com diagrama.json, processo.json e doc.md, ou com uma cópia exata de uma pasta modelo.
          </p>
        </div>

        <div className="space-y-3 px-5">
          <Field label="Nome da feature" error={show(errors.name)}>
            <input
              autoFocus
              className={inputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex.: Checkout em uma etapa"
            />
          </Field>
          <Field label="Número (id da feature no Azure DevOps)" error={show(errors.number)}>
            <input
              className={`${inputClass} font-mono`}
              inputMode="numeric"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              placeholder="ex.: 48213"
            />
          </Field>
          <Field label="Pasta onde criar">
            <select className={inputClass} value={dir} onChange={(e) => setDir(e.target.value)}>
              {folders.map((f) => (
                <option key={f} value={f}>
                  {displayPath(f, folderNames)}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Ano" error={show(errors.year)}>
              <input
                className={inputClass}
                inputMode="numeric"
                value={year}
                onChange={(e) => setYear(e.target.value)}
              />
            </Field>
            <Field label="Trimestre">
              <div className="grid grid-cols-4 gap-1">
                {QUARTERS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setQuarter(q)}
                    className={`rounded-md border py-1.5 text-sm ${
                      quarter === q
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </Field>
          </div>

          <div>
            <span className="mb-1 block text-xs font-medium text-slate-600">Conteúdo da pasta</span>
            <div className="grid grid-cols-2 gap-1">
              {[
                { value: false, label: 'Padrão' },
                { value: true, label: 'Copiar de uma pasta modelo' }
              ].map((o) => (
                <button
                  key={o.label}
                  type="button"
                  onClick={() => (o.value && !templatePath ? pickTemplate() : setUseTemplate(o.value))}
                  className={`rounded-md border py-1.5 text-sm ${
                    useTemplate === o.value
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
            {useTemplate && (
              <div className="mt-1.5 flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-slate-500" title={templatePath ?? ''}>
                  {templatePath ?? 'nenhuma pasta escolhida'}
                </span>
                <button
                  type="button"
                  onClick={pickTemplate}
                  className="shrink-0 rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                >
                  Escolher…
                </button>
              </div>
            )}
            {show(errors.template) && <p className="mt-1 text-[11px] text-rose-600">{errors.template}</p>}
          </div>

          <div className="rounded-lg bg-slate-50 p-3">
            <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-500">
              <FolderPlus className="h-3.5 w-3.5" /> Será criado (ao salvar)
            </p>
            <p className="break-all font-mono text-xs text-slate-800">{displayPath(target, folderNames)}/</p>
            <p className="mt-0.5 pl-3 font-mono text-[11px] text-slate-500">
              {!useTemplate
                ? 'diagrama.json · processo.json · doc.md'
                : template
                  ? template.files.length === 0 && template.dirs.length === 0
                    ? '(pasta modelo vazia)'
                    : [...template.dirs.map((d) => `${d}/`), ...template.files.map((f) => f.path)].slice(0, 8).join(' · ') +
                      (template.files.length + template.dirs.length > 8
                        ? ` · +${template.files.length + template.dirs.length - 8}`
                        : '')
                  : templateError
                    ? '—'
                    : 'lendo a pasta modelo…'}
            </p>
            {show(errors.target) && <p className="mt-1 text-[11px] text-rose-600">{errors.target}</p>}
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
          <button
            type="button"
            onClick={closeFeatureDialog}
            className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
          >
            Criar feature
          </button>
        </div>
      </form>
    </div>
  )
}
