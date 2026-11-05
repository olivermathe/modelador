import { ArrowRight, Grid3x3, Lock } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { ARCHIMATE_ORDER, ARCHIMATE_TYPES } from '@/model/archimate'
import { ELEMENT_TYPES } from '@/model/elementTypes'
import {
  allowedTypes,
  isFixedRule,
  METAMODEL_FILE,
  METAMODEL_TYPES,
  setRule,
  suggestedMetamodel,
  violations
} from '@/model/metamodel'
import { useModel } from '@/model/store'
import type { ArchimateRelType, ElementType } from '@/model/types'
import { NotationPreview } from './ArchimateMarkers'

/**
 * Meta modelo: tabela tipo de origem (linha) × tipo de destino (coluna) com os tipos de ligação
 * aceitos. Tudo em memória; vai para `metamodelo.json` no Salvar.
 */
export function MetamodelDialog(): JSX.Element | null {
  const open = useModel((s) => s.metamodelOpen)
  const metamodel = useModel((s) => s.metamodel)
  const resources = useModel((s) => s.resources)
  const relations = useModel((s) => s.relations)
  const { setMetamodel, setMetamodelOpen, select } = useModel.getState()
  const [cell, setCell] = useState<{ source: ElementType; target: ElementType } | null>(null)

  const outside = useMemo(() => violations(metamodel, resources, relations), [metamodel, resources, relations])
  // Ligações existentes por par e tipo, para mostrar o que cada regra afeta
  const usage = useMemo(() => {
    const count: Record<string, number> = {}
    for (const r of Object.values(relations)) {
      const s = resources[r.sourceId]
      const t = resources[r.targetId]
      if (r.kind !== 'flow' || !s || !t || !r.relType) continue
      const key = `${s.type}>${t.type}>${r.relType}`
      count[key] = (count[key] ?? 0) + 1
    }
    return count
  }, [resources, relations])

  const close = (): void => setMetamodelOpen(false)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!open) return null

  const toggle = (source: ElementType, target: ElementType, relType: ArchimateRelType): void => {
    if (!metamodel) return
    const current = metamodel.relations[source]?.[target] ?? []
    const next = current.includes(relType) ? current.filter((t) => t !== relType) : [...current, relType]
    setMetamodel(setRule(metamodel, source, target, next))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onMouseDown={close}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Meta modelo"
        className="flex max-h-full w-full max-w-4xl flex-col rounded-xl bg-white shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="space-y-1 border-b border-slate-100 p-5">
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
            <Grid3x3 className="h-4 w-4 text-slate-500" /> Meta modelo: relações permitidas
          </h2>
          <p className="text-sm text-slate-600">
            Que tipo de ligação pode sair de cada tipo de recurso (linha) para cada outro (coluna). Ligações fora da
            regra não são criadas. Fica em <code>{METAMODEL_FILE}</code>, gravado no Salvar.
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {!metamodel ? (
            <div className="space-y-3 text-sm text-slate-600">
              <p>Este repositório não tem meta modelo: qualquer ligação é aceita.</p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setMetamodel(suggestedMetamodel())}
                  className="rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700"
                >
                  Começar com a sugestão (ArchiMate)
                </button>
                <button
                  onClick={() => setMetamodel({ relations: {} })}
                  className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                >
                  Começar vazio
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <table className="w-full table-fixed border-collapse text-xs" data-metamodel-table>
                <thead>
                  <tr>
                    <th className="w-36 p-1 text-left font-normal text-slate-400">
                      origem <ArrowRight className="inline h-3 w-3" /> destino
                    </th>
                    {METAMODEL_TYPES.map((t) => {
                      const Icon = ELEMENT_TYPES[t].icon
                      return (
                        <th key={t} className="p-1 font-medium text-slate-600">
                          <Icon className="mx-auto mb-0.5 h-4 w-4 text-slate-400" />
                          {ELEMENT_TYPES[t].label}
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {METAMODEL_TYPES.map((source) => {
                    const Icon = ELEMENT_TYPES[source].icon
                    return (
                      <tr key={source}>
                        <th className="p-1 text-left font-medium text-slate-600">
                          <span className="flex items-center gap-1.5">
                            <Icon className="h-4 w-4 shrink-0 text-slate-400" /> {ELEMENT_TYPES[source].label}
                          </span>
                        </th>
                        {METAMODEL_TYPES.map((target) => {
                          const types = allowedTypes(metamodel, source, target)
                          const active = cell?.source === source && cell.target === target
                          return (
                            <td key={target} className="p-0.5">
                              <button
                                data-cell={`${source}>${target}`}
                                onClick={() => setCell(active ? null : { source, target })}
                                title={types.map((t) => ARCHIMATE_TYPES[t].label).join(', ') || 'Nenhuma ligação'}
                                className={`flex h-10 w-full items-center justify-center gap-1 rounded-md border px-1 ${
                                  active
                                    ? 'border-sky-400 bg-sky-50 ring-1 ring-sky-400'
                                    : types.length
                                      ? 'border-slate-200 hover:bg-slate-50'
                                      : 'border-dashed border-slate-200 text-slate-300 hover:bg-slate-50'
                                }`}
                              >
                                {/* Um tipo: o nome; vários: a quantidade (a lista fica na dica e no editor) */}
                                {types.length === 1 ? (
                                  <span className="truncate text-slate-700">{ARCHIMATE_TYPES[types[0]].label}</span>
                                ) : types.length ? (
                                  <span className="text-slate-700">{types.length} tipos</span>
                                ) : (
                                  '—'
                                )}
                              </button>
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {cell ? (
                <div className="rounded-lg border border-slate-200 p-3" data-cell-editor>
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-800">
                    {ELEMENT_TYPES[cell.source].label} <ArrowRight className="h-3.5 w-3.5 text-slate-400" />{' '}
                    {ELEMENT_TYPES[cell.target].label}
                    <span className="ml-auto flex gap-1 text-xs font-normal">
                      <button
                        className="rounded px-2 py-0.5 text-slate-600 hover:bg-slate-100"
                        onClick={() => setMetamodel(setRule(metamodel, cell.source, cell.target, [...ARCHIMATE_ORDER]))}
                      >
                        Todos
                      </button>
                      <button
                        className="rounded px-2 py-0.5 text-slate-600 hover:bg-slate-100"
                        onClick={() => setMetamodel(setRule(metamodel, cell.source, cell.target, []))}
                      >
                        Nenhum
                      </button>
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 sm:grid-cols-3">
                    {ARCHIMATE_ORDER.map((t) => {
                      const fixed = isFixedRule(cell.source, cell.target, t)
                      const checked = allowedTypes(metamodel, cell.source, cell.target).includes(t)
                      const used = usage[`${cell.source}>${cell.target}>${t}`]
                      return (
                        <label
                          key={t}
                          title={fixed ? 'Sempre aceita: é a ligação que diz de quem é o endpoint.' : ARCHIMATE_TYPES[t].description}
                          className={`flex items-center gap-2 rounded px-1.5 py-1 text-sm ${fixed ? 'text-slate-400' : 'cursor-pointer text-slate-700 hover:bg-slate-50'}`}
                        >
                          <input
                            type="checkbox"
                            data-type={t}
                            checked={checked}
                            disabled={fixed}
                            onChange={() => toggle(cell.source, cell.target, t)}
                          />
                          <NotationPreview {...ARCHIMATE_TYPES[t]} />
                          <span className="flex-1">{ARCHIMATE_TYPES[t].label}</span>
                          {fixed && <Lock className="h-3 w-3" />}
                          {!!used && (
                            <span className="text-[10px] text-slate-400" title={`${used} ligação(ões) do repositório usam esse tipo`}>
                              {used} em uso
                            </span>
                          )}
                        </label>
                      )
                    })}
                  </div>
                  <p className="mt-2 text-[11px] text-slate-400">
                    A ligação Genérica (tipo ainda não escolhido) vale quando o par aceita algum tipo. Se aceita só um, a
                    ligação já nasce com ele.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-slate-400">Clique numa célula para escolher os tipos aceitos.</p>
              )}

              <div data-outside>
                <h3 className="mb-1 text-sm font-medium text-slate-800">
                  Ligações fora da regra <span className="text-slate-400">({outside.length})</span>
                </h3>
                {outside.length ? (
                  <ul className="max-h-40 divide-y divide-slate-100 overflow-y-auto rounded-md border border-slate-200 text-sm">
                    {outside.map((r) => (
                      <li key={r.id} className="flex items-center gap-2 px-2 py-1">
                        <span className="min-w-0 flex-1 truncate text-slate-700">
                          {resources[r.sourceId].name} <ArrowRight className="inline h-3 w-3 text-slate-400" />{' '}
                          {resources[r.targetId].name}
                          <span className="text-slate-400"> · {r.relType ? ARCHIMATE_TYPES[r.relType].label : 'Genérica'}</span>
                        </span>
                        <button
                          className="shrink-0 rounded px-2 py-0.5 text-xs text-sky-700 hover:bg-sky-50"
                          onClick={() => {
                            select({ kind: 'relation', id: r.id })
                            close()
                          }}
                        >
                          Mostrar
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-400">Todas as ligações do repositório seguem o meta modelo.</p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-slate-100 px-5 py-3">
          {metamodel && (
            <button
              onClick={() => setMetamodel(null)}
              title={`Qualquer ligação volta a ser aceita; ${METAMODEL_FILE} é apagado no Salvar`}
              className="rounded-md px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100"
            >
              Remover meta modelo
            </button>
          )}
          <button
            onClick={close}
            autoFocus
            className="ml-auto rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
