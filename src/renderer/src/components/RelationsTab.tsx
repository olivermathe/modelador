import { ArrowLeft, ArrowRight, Check, Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ARCHIMATE_TYPES } from '@/model/archimate'
import { ELEMENT_TYPES, impactInfo } from '@/model/elementTypes'
import { impactIn, presentIds, useModel } from '@/model/store'
import { slugify } from '@/model/repo'
import type { Relation, Resource } from '@/model/types'
import { setDragPayload } from './dnd'

interface Linked {
  relation: Relation
  other: Resource
  /** O recurso selecionado é a origem da ligação. */
  outgoing: boolean
}

/** Ligações (flow) do recurso com outros recursos, em qualquer direção. */
export function linkedResources(id: string, relations: Record<string, Relation>, resources: Record<string, Resource>): Linked[] {
  return Object.values(relations)
    .filter((r) => r.kind === 'flow' && (r.sourceId === id || r.targetId === id))
    .flatMap((relation) => {
      const outgoing = relation.sourceId === id
      const other = resources[outgoing ? relation.targetId : relation.sourceId]
      return other && other.id !== id ? [{ relation, other, outgoing }] : []
    })
    .sort((a, b) => a.other.name.localeCompare(b.other.name, 'pt-BR'))
}

/**
 * Aba "Relacionamentos" do recurso selecionado: todos os recursos ligados a ele (em qualquer desenho).
 * Arrastar um item para o desenho o inclui (as setas com quem já está lá aparecem sozinhas).
 */
export function RelationsTab({ resourceId }: { resourceId: string }): JSX.Element {
  const resources = useModel((s) => s.resources)
  const relations = useModel((s) => s.relations)
  const diagram = useModel((s) => (s.activeDiagram ? s.diagrams[s.activeDiagram] : undefined))
  const resource = resources[resourceId]
  const linked = useMemo(() => linkedResources(resourceId, relations, resources), [resourceId, relations, resources])
  const inDiagram = useMemo(() => (diagram ? presentIds(diagram) : new Set<string>()), [diagram])
  // Filtro: texto (nome, tipo do recurso, tipo/rótulo da ligação) e "só o que falta no desenho".
  // Fica ao trocar de recurso, para filtrar vários em sequência
  const [query, setQuery] = useState('')
  const [onlyMissing, setOnlyMissing] = useState(false)
  const visible = useMemo(() => {
    // Sem acento e sem maiúsculas; cada palavra digitada precisa aparecer
    // (slugify devolve "sem-nome" para texto vazio: por isso o teste antes)
    const words = query.trim() ? slugify(query).split('-').filter(Boolean) : []
    return linked.filter(({ relation, other }) => {
      if (onlyMissing && inDiagram.has(other.id)) return false
      if (!words.length) return true
      const text = slugify(
        [
          other.name,
          ELEMENT_TYPES[other.type].label,
          relation.relType ? ARCHIMATE_TYPES[relation.relType].label : 'Genérica',
          relation.label,
          relation.protocol
        ].join(' ')
      )
      return words.every((w) => text.includes(w))
    })
  }, [linked, query, onlyMissing, inDiagram])

  if (!resource) return <div />
  return (
    <div className="p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Relacionamentos</h2>
      <p className="mb-3 mt-0.5 text-[11px] text-slate-400">
        Recursos ligados a <span className="font-medium text-slate-600">{resource.name}</span>. Arraste para o
        desenho para incluir.
      </p>
      {linked.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-200 p-3 text-center text-xs text-slate-400">
          Nenhuma ligação com outros recursos.
        </p>
      ) : (
        <>
          <div className="mb-2 space-y-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Escape' && setQuery('')}
                placeholder="Filtrar por nome, tipo ou ligação…"
                aria-label="Filtrar relacionamentos"
                className="w-full rounded-md border border-slate-200 py-1.5 pl-7 pr-7 text-sm outline-none focus:border-sky-400"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  aria-label="Limpar filtro"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:bg-slate-100"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="flex items-center justify-between gap-2">
              <label className="flex items-center gap-1.5 text-xs text-slate-600">
                <input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} />
                Só os que não estão no desenho
              </label>
              <span className="shrink-0 text-[11px] text-slate-400" data-count>
                {visible.length} de {linked.length}
              </span>
            </div>
          </div>
          {visible.length === 0 && (
            <p className="rounded-md border border-dashed border-slate-200 p-3 text-center text-xs text-slate-400">
              Nenhum recurso com esse filtro.
            </p>
          )}
          <ul className="space-y-1.5">
            {visible.map(({ relation, other, outgoing }) => {
              const info = ELEMENT_TYPES[other.type]
              const placed = inDiagram.has(other.id)
              const relType = relation.relType ? ARCHIMATE_TYPES[relation.relType].label : 'Genérica'
              const Direction = outgoing ? ArrowRight : ArrowLeft
              return (
                <li
                  key={relation.id}
                  data-related={other.id}
                  draggable={!!diagram}
                  onDragStart={(e) => setDragPayload(e, { kind: 'resource', id: other.id, keepSelection: true })}
                  title={placed ? 'Já está no desenho' : 'Arraste para o desenho'}
                  className={`flex cursor-grab items-start gap-2 rounded-md border-2 bg-white px-2.5 py-2 hover:bg-slate-50 active:cursor-grabbing ${
                    impactInfo(impactIn(diagram, 'resource', other.id)).border
                  } ${placed ? 'opacity-60' : ''}`}
                >
                  <info.icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-label={info.label} />
                  <div className="min-w-0 flex-1">
                    <div className={`break-words text-sm text-slate-900 ${other.type === 'endpoint' ? 'font-mono' : ''}`}>
                      {other.name}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500">
                      <Direction className="h-3 w-3 shrink-0" aria-label={outgoing ? 'Sai deste recurso' : 'Chega neste recurso'} />
                      {relType}
                      {relation.label && <span className="truncate text-slate-400">· {relation.label}</span>}
                    </div>
                  </div>
                  {placed && <Check className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-label="No desenho" />}
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}
