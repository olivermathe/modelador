import { useEffect } from 'react'
import { ELEMENT_TYPES } from '@/model/elementTypes'
import { displayPath, sameNameResources, useModel } from '@/model/store'
import { REPO_FOLDERS } from '@/model/types'

/**
 * Aviso ao criar ou renomear um recurso com o nome de outro que já existe:
 * usar o existente (o atual é trocado por ele em tudo) ou manter os dois.
 */
export function DuplicateResourceDialog(): JSX.Element | null {
  const check = useModel((s) => s.duplicateCheck)
  const resources = useModel((s) => s.resources)
  const paths = useModel((s) => s.paths)
  const folderNames = useModel((s) => s.folderNames)
  const diagrams = useModel((s) => s.diagrams)
  const { mergeResource, closeDuplicateCheck, updateResource } = useModel.getState()

  const resource = check ? resources[check.resourceId] : undefined
  const matches = resource ? sameNameResources(resource, resources) : []
  const open = !!check && matches.length > 0

  const restoreName = (): void => {
    if (check) updateResource(check.resourceId, { name: check.previousName })
    closeDuplicateCheck()
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') restoreName()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!open || !check || !resource) return null
  const saved = !!paths[resource.id]
  const usedIn = (id: string): number => Object.values(diagrams).filter((d) => d.nodes.some((n) => n.resourceId === id)).length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-xl bg-white shadow-2xl">
        <div className="space-y-2 p-5">
          <h2 className="text-base font-semibold text-slate-900">Já existe um recurso com esse nome</h2>
          <p className="text-sm text-slate-600">
            {matches.length === 1
              ? `"${resource.name}" já está na biblioteca.`
              : `Há ${matches.length} recursos chamados "${resource.name}" na biblioteca.`}{' '}
            Quer usar o que já existe ou criar outro com o mesmo nome?
          </p>
        </div>

        <ul className="max-h-72 space-y-2 overflow-y-auto px-5">
          {matches.map((r) => {
            const info = ELEMENT_TYPES[r.type]
            const count = usedIn(r.id)
            return (
              <li key={r.id} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
                <info.icon className="h-5 w-5 shrink-0 text-slate-500" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{r.name}</p>
                  <p className="text-xs text-slate-500">
                    {info.label}
                    {r.owner && ` · ${r.owner}`}
                    {` · ${count === 0 ? 'em nenhum desenho' : count === 1 ? 'em 1 desenho' : `em ${count} desenhos`}`}
                  </p>
                  <p className="truncate font-mono text-[11px] text-slate-400">
                    {paths[r.id]
                      ? displayPath(paths[r.id], folderNames)
                      : `${folderNames[REPO_FOLDERS.resources] ?? REPO_FOLDERS.resources}/ (não salvo)`}
                  </p>
                </div>
                <button
                  onClick={() => mergeResource(resource.id, r.id)}
                  className="shrink-0 rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700"
                >
                  Usar este
                </button>
              </li>
            )
          })}
        </ul>

        <p className="px-5 pt-3 text-xs text-slate-500">
          {saved
            ? `Ao usar o existente, "${check.previousName}" deixa de existir: as ligações, os endpoints e os lugares dele nos desenhos passam para o recurso escolhido, e o arquivo dele é apagado ao salvar.`
            : 'Ao usar o existente, o recurso que você acabou de criar é descartado e o existente entra no lugar dele, com as ligações que você já fez.'}
        </p>

        <div className="mt-4 flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
          <button
            onClick={restoreName}
            className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
          >
            Voltar ao nome anterior
          </button>
          <button
            onClick={closeDuplicateCheck}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            {saved ? 'Manter os dois' : 'Criar novo mesmo'}
          </button>
        </div>
      </div>
    </div>
  )
}
