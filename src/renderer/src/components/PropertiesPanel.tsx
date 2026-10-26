import { ArrowLeftRight, ArrowRight, Check, Lock, LockOpen, Plus, Search, Trash2, X } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  ELEMENT_TYPE_ORDER,
  ELEMENT_TYPES,
  IMPACTS,
  SHAPE_COLORS,
  SHAPE_KIND_ORDER,
  SHAPE_KINDS
} from '@/model/elementTypes'
import { displayPath, endpointsOf, ownersOf, technologiesOf, useModel } from '@/model/store'
import { REPO_FOLDERS, type Impact, type Relation, type Resource, type Shape, type Technology } from '@/model/types'
import { ACCESS_MODES, ARCHIMATE_TYPES, relationNotation } from '@/model/archimate'
import { NotationPreview } from './ArchimateMarkers'
import { ORDER_ACTIONS } from './ContextMenu'
import { askPermanentDelete } from './deleteActions'
import { EndpointRouteEditor, NewEndpointForm } from './EndpointRouteEditor'
import { RelTypeList } from './RelTypePicker'

const inputClass =
  'w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400'

const dangerButton =
  'flex w-full items-center justify-center gap-1.5 rounded-md border border-rose-200 px-3 py-1.5 text-sm text-rose-600 hover:bg-rose-50'

function Field({ label, children }: { label: string; children: ReactNode }): JSX.Element {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      {children}
    </label>
  )
}

function Header({ title, path, children }: { title: string; path?: string; children?: ReactNode }): JSX.Element {
  return (
    <header>
      <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
      {path && <p className="mt-1 truncate font-mono text-[11px] text-slate-400">{path}</p>}
      {children}
    </header>
  )
}

/** Travar/destravar no desenho aberto: travado não se move nem é selecionado (o cadeado destrava). */
function LockToggle({ ids }: { ids: string[] }): JSX.Element | null {
  const allLocked = useModel((s) => {
    const d = s.activeDiagram ? s.diagrams[s.activeDiagram] : undefined
    if (!d || !ids.length) return false
    return ids.every((id) => d.nodes.find((n) => n.resourceId === id)?.locked || d.shapes.find((sh) => sh.id === id)?.locked)
  })
  const { setLocked, setMultiSelection } = useModel.getState()
  return (
    <button
      onClick={() => {
        setLocked(ids, !allLocked)
        // Travado não fica selecionado
        if (!allLocked) setMultiSelection([], [])
      }}
      className="flex w-full items-center justify-center gap-1.5 rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
    >
      {allLocked ? <LockOpen className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
      {allLocked ? 'Destravar' : 'Travar no desenho'}
    </button>
  )
}

/** Vários itens selecionados (retângulo de seleção ou Shift+clique): ações em grupo. */
function MultiProperties(): JSX.Element {
  const items = useModel((s) => s.selectedItems)
  const edges = useModel((s) => s.selectedEdges)
  // Seleciona o array do desenho (estável) e filtra aqui: filtrar no seletor criaria um array novo a cada leitura
  const allShapes = useModel((s) => (s.activeDiagram ? s.diagrams[s.activeDiagram]?.shapes : undefined))
  const shapes = (allShapes ?? []).filter((sh) => items.includes(sh.id))
  const { removeFromDiagram, removeEdgesFromDiagram, setMultiSelection } = useModel.getState()
  const resourceIds = items.filter((id) => !shapes.some((sh) => sh.id === id))
  const parts = [
    resourceIds.length && `${resourceIds.length} recurso(s)`,
    shapes.length && `${shapes.length} forma(s)`,
    edges.length && `${edges.length} ligação(ões)`
  ].filter(Boolean)

  return (
    <div className="space-y-4 p-4">
      <Header title={`${items.length + edges.length} itens selecionados`}>
        <p className="mt-1 text-xs text-slate-500">{parts.join(' · ')}</p>
        <p className="mt-1 text-xs text-slate-400">Arraste um deles para mover todos juntos. Shift+clique soma ou tira itens.</p>
      </Header>
      {items.length > 0 && <LockToggle ids={items} />}
      <div className="space-y-2 border-t border-slate-100 pt-4">
        <button
          onClick={() => {
            if (edges.length) removeEdgesFromDiagram(edges)
            if (items.length) removeFromDiagram(items)
            setMultiSelection([], [])
          }}
          className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
        >
          Remover do desenho
        </button>
        {resourceIds.length + edges.length > 0 && (
          <button
            onClick={() =>
              askPermanentDelete([
                ...resourceIds.map((id) => ({ kind: 'resource' as const, id })),
                ...edges.map((id) => ({ kind: 'relation' as const, id }))
              ])
            }
            className={dangerButton}
          >
            <Trash2 className="h-3.5 w-3.5" /> Excluir permanentemente
          </button>
        )}
      </div>
    </div>
  )
}

export function PropertiesContent(): JSX.Element {
  const selection = useModel((s) => s.selection)
  const resource = useModel((s) => (s.selection?.kind === 'resource' ? s.resources[s.selection.id] : undefined))
  const technology = useModel((s) =>
    s.selection?.kind === 'technology' ? s.technologies[s.selection.id] : undefined
  )
  const relation = useModel((s) => (s.selection?.kind === 'relation' ? s.relations[s.selection.id] : undefined))
  const shape = useModel((s) =>
    s.selection?.kind === 'shape' && s.activeDiagram
      ? s.diagrams[s.activeDiagram]?.shapes.find((sh) => sh.id === s.selection!.id)
      : undefined
  )
  const multiCount = useModel((s) => s.selectedItems.length + s.selectedEdges.length)
  if (multiCount > 1) return <MultiProperties />

  return (
    <>
      {resource ? (
        resource.type === 'endpoint' ? (
          <EndpointProperties key={resource.id} endpoint={resource} />
        ) : (
          <ResourceProperties key={resource.id} resource={resource} />
        )
      ) : technology ? (
        <TechnologyProperties technology={technology} />
      ) : relation ? (
        <RelationProperties relation={relation} />
      ) : shape ? (
        <ShapeProperties shape={shape} />
      ) : (
        <div className="p-6 text-center text-sm text-slate-400">
          {selection ? 'Item não encontrado.' : 'Selecione um recurso, forma, tecnologia ou relação para editar.'}
        </div>
      )}
    </>
  )
}

/** Caminho que o arquivo da entidade tem em disco (se já salvo). */
function useSavedPath(id: string): string | undefined {
  // Com o nome real da pasta raiz (o repositório pode usar nomes em inglês)
  return useModel((s) => (s.paths[id] ? displayPath(s.paths[id], s.folderNames) : undefined))
}

/** "<pasta>/ (não salvo)" com o nome real da pasta raiz. */
function useUnsavedPath(folder: string): string {
  return useModel((s) => `${s.folderNames[folder] ?? folder}/ (não salvo)`)
}

function ImpactPicker({ value, onChange }: { value: Impact | undefined; onChange: (v: Impact | undefined) => void }): JSX.Element {
  return (
    <div>
      <span className="mb-1 block text-xs font-medium text-slate-500">Impacto</span>
      <div className="grid grid-cols-4 gap-1">
        {IMPACTS.map((i) => {
          const active = i.value === value
          return (
            <button
              key={i.label}
              onClick={() => onChange(i.value)}
              className={`rounded-md border px-1 py-1 text-[11px] font-medium ${
                active ? `${i.badge} border-transparent` : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {i.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function OrderButtons({ id }: { id: string }): JSX.Element | null {
  const reorder = useModel((s) => s.reorder)
  return (
    <div>
      <span className="mb-1 block text-xs font-medium text-slate-500">Ordem no desenho</span>
      <div className="grid grid-cols-4 gap-1">
        {ORDER_ACTIONS.map((a) => (
          <button
            key={a.op}
            onClick={() => reorder(id, a.op)}
            title={`${a.label} (${a.shortcut})`}
            className="flex items-center justify-center rounded-md border border-slate-200 py-1.5 text-slate-600 hover:bg-slate-50"
          >
            <a.icon className="h-4 w-4" />
          </button>
        ))}
      </div>
    </div>
  )
}

/** Desfaz o redimensionamento manual do recurso neste desenho. */
function AutoSizeButton({ resourceId }: { resourceId: string }): JSX.Element | null {
  const sized = useModel((s) => {
    const node = s.activeDiagram ? s.diagrams[s.activeDiagram]?.nodes.find((n) => n.resourceId === resourceId) : undefined
    return !!node?.width
  })
  const resizeNode = useModel((s) => s.resizeNode)
  if (!sized) return null
  return (
    <button
      onClick={() => resizeNode(resourceId, null)}
      className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
    >
      Voltar ao tamanho automático
    </button>
  )
}

function UsageList({ resourceId }: { resourceId: string }): JSX.Element {
  const diagrams = useModel((s) => s.diagrams)
  const openDiagram = useModel((s) => s.openDiagram)
  const select = useModel((s) => s.select)
  const usedIn = Object.entries(diagrams)
    .filter(([, d]) => d.nodes.some((n) => n.resourceId === resourceId))
    .map(([path]) => path)

  return (
    <div>
      <span className="mb-1 block text-xs font-medium text-slate-500">Usado nos desenhos</span>
      {usedIn.length === 0 ? (
        <p className="text-xs text-slate-400">Nenhum. Arraste o arquivo da árvore para um desenho.</p>
      ) : (
        <ul className="space-y-0.5">
          {usedIn.map((path) => (
            <li key={path}>
              <button
                onClick={() => {
                  openDiagram(path)
                  select({ kind: 'resource', id: resourceId })
                }}
                className="w-full truncate rounded px-1.5 py-0.5 text-left font-mono text-xs text-slate-600 hover:bg-slate-100"
              >
                {path.slice(REPO_FOLDERS.projects.length + 1)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Escolha de várias tecnologias de uma vez, com busca e criação. */
function TechnologyPicker({ resourceId }: { resourceId: string }): JSX.Element {
  const relations = useModel((s) => s.relations)
  const technologies = useModel((s) => s.technologies)
  const { toggleTechnology, createTechnology } = useModel.getState()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const boxRef = useRef<HTMLDivElement>(null)
  const linked = technologiesOf(resourceId, relations, technologies)
  const linkedIds = new Set(linked.map((l) => l.technology.id))

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent): void => {
      if (!boxRef.current?.contains(e.target as globalThis.Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const q = query.trim()
  const options = Object.values(technologies)
    .filter((t) => t.name.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  const exact = Object.values(technologies).some((t) => t.name.toLowerCase() === q.toLowerCase())

  const createAndLink = (): void => {
    // Aceita várias: "Java, Spring Boot"
    for (const name of q.split(',').map((n) => n.trim()).filter(Boolean)) {
      const existing = Object.values(useModel.getState().technologies).find(
        (t) => t.name.toLowerCase() === name.toLowerCase()
      )
      const id = existing?.id ?? createTechnology(name, false)
      if (!linkedIds.has(id)) toggleTechnology(resourceId, id)
    }
    setQuery('')
  }

  return (
    <div ref={boxRef} className="relative">
      <span className="mb-1 block text-xs font-medium text-slate-500">Tecnologias</span>
      <div className="flex flex-wrap gap-1">
        {linked.map(({ relationId, technology }) => (
          <span
            key={relationId}
            className="flex items-center gap-1 rounded bg-violet-50 py-0.5 pl-2 pr-1 text-xs text-violet-700"
          >
            {technology.name}
            <button
              onClick={() => toggleTechnology(resourceId, technology.id)}
              className="rounded p-0.5 hover:bg-violet-100"
              title="Desligar tecnologia"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1 rounded border border-dashed border-slate-300 px-2 py-0.5 text-xs text-slate-600 hover:border-sky-400 hover:text-sky-700"
        >
          <Plus className="h-3 w-3" /> Tecnologias
        </button>
      </div>

      {open && (
        <div className="absolute left-0 right-0 z-20 mt-1 rounded-lg border border-slate-200 bg-white shadow-lg">
          <label className="flex items-center gap-2 border-b border-slate-100 px-2 py-1.5">
            <Search className="h-3.5 w-3.5 text-slate-400" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && q) {
                  if (!exact) createAndLink()
                  else if (options[0]) toggleTechnology(resourceId, options[0].id)
                }
                if (e.key === 'Escape') setOpen(false)
              }}
              placeholder="Buscar ou criar (vírgula separa várias)"
              className="w-full text-sm outline-none placeholder:text-slate-400"
            />
          </label>
          <ul className="max-h-56 overflow-y-auto py-1">
            {options.map((t) => (
              <li key={t.id}>
                <button
                  onClick={() => toggleTechnology(resourceId, t.id)}
                  className="flex w-full items-center gap-2 px-2 py-1 text-left text-sm hover:bg-slate-50"
                >
                  <span
                    className={`flex h-4 w-4 items-center justify-center rounded border ${
                      linkedIds.has(t.id) ? 'border-violet-500 bg-violet-500 text-white' : 'border-slate-300'
                    }`}
                  >
                    {linkedIds.has(t.id) && <Check className="h-3 w-3" />}
                  </span>
                  <span className="flex-1 truncate">{t.name}</span>
                  {t.category && <span className="text-xs text-slate-400">{t.category}</span>}
                </button>
              </li>
            ))}
            {q && !exact && (
              <li>
                <button
                  onClick={createAndLink}
                  className="flex w-full items-center gap-2 px-2 py-1 text-left text-sm text-sky-700 hover:bg-sky-50"
                >
                  <Plus className="h-4 w-4" /> Criar “{q}”
                </button>
              </li>
            )}
            {!q && options.length === 0 && (
              <li className="px-2 py-2 text-xs text-slate-400">Nenhuma tecnologia ainda. Digite para criar.</li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}

function EndpointList({ resourceId }: { resourceId: string }): JSX.Element {
  const resources = useModel((s) => s.resources)
  const select = useModel((s) => s.select)
  const relations = useModel((s) => s.relations)
  const endpoints = endpointsOf(resourceId, resources, relations)
  const [adding, setAdding] = useState(false)

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500">Endpoints</span>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-sky-600 hover:bg-sky-50"
          >
            <Plus className="h-3 w-3" /> Adicionar
          </button>
        )}
      </div>
      <ul className="space-y-1.5">
        {endpoints.map((ep) => (
          <li key={ep.id} className="flex items-start gap-1">
            <EndpointRouteEditor endpoint={ep} compact />
            <button
              onClick={() => select({ kind: 'resource', id: ep.id })}
              className="mt-1 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-sky-600"
              title="Abrir endpoint (impacto, descrição, quem chama)"
            >
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
      </ul>
      {adding && (
        <div className="mt-1.5">
          <NewEndpointForm ownerId={resourceId} onDone={() => setAdding(false)} />
        </div>
      )}
      {endpoints.length > 0 && (
        <p className="mt-1.5 text-[11px] text-slate-400">
          Cada endpoint é um recurso com nó próprio no desenho. Se este recurso estiver no desenho aberto, o
          endpoint novo entra logo abaixo dele; nos outros, arraste o arquivo da árvore.
        </p>
      )}
    </div>
  )
}

function ResourceProperties({ resource }: { resource: Resource }): JSX.Element {
  const { updateResource, removeFromDiagram, checkDuplicateName } = useModel.getState()
  const inActiveDiagram = useModel(
    (s) => !!s.activeDiagram && !!s.diagrams[s.activeDiagram]?.nodes.some((n) => n.resourceId === resource.id)
  )
  const path = useSavedPath(resource.id)
  const unsaved = useUnsavedPath(REPO_FOLDERS.resources)
  const update = (patch: Partial<Resource>): void => updateResource(resource.id, patch)
  const info = ELEMENT_TYPES[resource.type]
  // Nome antes da edição atual: ao terminar de digitar, procura recurso existente com o nome novo
  const nameBefore = useRef(resource.name)
  const commitName = (): void => {
    checkDuplicateName(resource.id, nameBefore.current)
    nameBefore.current = useModel.getState().resources[resource.id]?.name ?? ''
  }

  return (
    <div className="space-y-4 p-4">
      <Header title="Recurso" path={path ?? unsaved}>
        <p className="mt-1 text-xs text-slate-400">Alterações valem para todos os desenhos que usam este recurso.</p>
      </Header>

      <Field label="Nome">
        <input
          className={inputClass}
          value={resource.name}
          onChange={(e) => update({ name: e.target.value })}
          onFocus={() => (nameBefore.current = resource.name)}
          onBlur={commitName}
          onKeyDown={(e) => e.key === 'Enter' && commitName()}
        />
      </Field>
      <Field label="Tipo">
        <select
          className={inputClass}
          value={resource.type}
          onChange={(e) => update({ type: e.target.value as Resource['type'] })}
        >
          {ELEMENT_TYPE_ORDER.map((t) => (
            <option key={t} value={t}>
              {ELEMENT_TYPES[t].label}
            </option>
          ))}
        </select>
      </Field>
      <ImpactPicker value={resource.impact} onChange={(impact) => update({ impact })} />
      <TechnologyPicker resourceId={resource.id} />
      <Field label="Responsável">
        <input
          className={inputClass}
          value={resource.owner}
          placeholder="ex.: Time Pagamentos"
          onChange={(e) => update({ owner: e.target.value })}
        />
      </Field>
      <Field label="Descrição">
        <textarea
          className={`${inputClass} min-h-20 resize-y`}
          value={resource.description}
          onChange={(e) => update({ description: e.target.value })}
        />
      </Field>

      {info.hasEndpoints && <EndpointList resourceId={resource.id} />}

      {inActiveDiagram && <OrderButtons id={resource.id} />}
      {inActiveDiagram && <LockToggle ids={[resource.id]} />}
      {inActiveDiagram && <AutoSizeButton resourceId={resource.id} />}

      <UsageList resourceId={resource.id} />

      <div className="space-y-2 border-t border-slate-100 pt-4">
        {inActiveDiagram && (
          <button
            onClick={() => removeFromDiagram([resource.id])}
            className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            Remover deste desenho
          </button>
        )}
        <button onClick={() => askPermanentDelete([{ kind: 'resource', id: resource.id }])} className={dangerButton}>
          <Trash2 className="h-3.5 w-3.5" /> Excluir permanentemente
        </button>
      </div>
    </div>
  )
}

function EndpointProperties({ endpoint }: { endpoint: Resource }): JSX.Element {
  const { updateResource, select } = useModel.getState()
  const relations = useModel((s) => s.relations)
  const resources = useModel((s) => s.resources)
  const path = useSavedPath(endpoint.id)
  const unsaved = useUnsavedPath(REPO_FOLDERS.resources)
  const update = (patch: Partial<Resource>): void => updateResource(endpoint.id, patch)
  const owners = ownersOf(endpoint.id, resources, relations)
  // Quem chama: ligações para o endpoint, menos as de dono (Composição/Agregação)
  const callers = Object.values(relations).filter(
    (r) => r.kind === 'flow' && r.targetId === endpoint.id && r.relType !== 'composition' && r.relType !== 'aggregation'
  )

  return (
    <div className="space-y-4 p-4">
      <Header title="Endpoint" path={path ?? unsaved}>
        {/* O dono vem da ligação de Composição; um endpoint pode ter mais de um, ou nenhum */}
        <p className="mt-1 text-xs text-slate-500">
          {owners.length === 0 ? (
            'Sem dono: ligue um recurso a ele com Composição.'
          ) : (
            <>
              de{' '}
              {owners.map((o, i) => (
                <span key={o.id}>
                  {i > 0 && ', '}
                  <button onClick={() => select({ kind: 'resource', id: o.id })} className="text-sky-700 hover:underline">
                    {o.name}
                  </button>
                </span>
              ))}
            </>
          )}
        </p>
      </Header>

      <div>
        <span className="mb-1 block text-xs font-medium text-slate-500">Método e caminho</span>
        <EndpointRouteEditor endpoint={endpoint} />
      </div>
      <ImpactPicker value={endpoint.impact} onChange={(impact) => update({ impact })} />
      <Field label="Descrição">
        <textarea
          className={`${inputClass} min-h-16 resize-y`}
          value={endpoint.description}
          onChange={(e) => update({ description: e.target.value })}
        />
      </Field>

      <div>
        <span className="mb-1 block text-xs font-medium text-slate-500">Chamado por</span>
        {callers.length === 0 ? (
          <p className="text-xs text-slate-400">
            Ninguém ainda. No desenho, arraste de um recurso até o conector (bolinha) deste endpoint.
          </p>
        ) : (
          <ul className="space-y-0.5">
            {callers.map((r) => (
              <li key={r.id}>
                <button
                  onClick={() => select({ kind: 'relation', id: r.id })}
                  className="flex w-full items-center gap-1.5 rounded px-1.5 py-0.5 text-left text-xs text-slate-700 hover:bg-slate-100"
                >
                  {resources[r.sourceId]?.name ?? '(removido)'}
                  {r.label && <span className="truncate text-slate-400">— {r.label}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-slate-100 pt-4">
        <button onClick={() => askPermanentDelete([{ kind: 'resource', id: endpoint.id }])} className={dangerButton}>
          <Trash2 className="h-3.5 w-3.5" /> Excluir permanentemente
        </button>
      </div>
    </div>
  )
}

function TechnologyProperties({ technology }: { technology: Technology }): JSX.Element {
  const { updateTechnology, deleteTechnology, select } = useModel.getState()
  const relations = useModel((s) => s.relations)
  const resources = useModel((s) => s.resources)
  const path = useSavedPath(technology.id)
  const unsaved = useUnsavedPath(REPO_FOLDERS.technologies)
  const update = (patch: Partial<Technology>): void => updateTechnology(technology.id, patch)
  const usedBy = Object.values(relations)
    .filter((r) => r.kind === 'uses' && r.targetId === technology.id && resources[r.sourceId])
    .map((r) => resources[r.sourceId])

  return (
    <div className="space-y-4 p-4">
      <Header title="Tecnologia" path={path ?? unsaved} />
      <Field label="Nome">
        <input className={inputClass} value={technology.name} onChange={(e) => update({ name: e.target.value })} />
      </Field>
      <Field label="Categoria">
        <input
          className={inputClass}
          value={technology.category}
          placeholder="ex.: Linguagem, Banco, Mensageria"
          onChange={(e) => update({ category: e.target.value })}
        />
      </Field>
      <Field label="Descrição">
        <textarea
          className={`${inputClass} min-h-20 resize-y`}
          value={technology.description}
          onChange={(e) => update({ description: e.target.value })}
        />
      </Field>
      <div>
        <span className="mb-1 block text-xs font-medium text-slate-500">Usada por</span>
        {usedBy.length === 0 ? (
          <p className="text-xs text-slate-400">Nenhum recurso. Arraste a tecnologia sobre um recurso no desenho.</p>
        ) : (
          <ul className="flex flex-wrap gap-1">
            {usedBy.map((r) => (
              <li key={r.id}>
                <button
                  onClick={() => select({ kind: 'resource', id: r.id })}
                  className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700 hover:bg-slate-200"
                >
                  {r.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="border-t border-slate-100 pt-4">
        <button
          onClick={() => {
            if (confirm(`Excluir a tecnologia "${technology.name}"? Ela será desligada de todos os recursos.`)) {
              deleteTechnology(technology.id)
            }
          }}
          className={dangerButton}
        >
          <Trash2 className="h-3.5 w-3.5" /> Excluir tecnologia
        </button>
      </div>
    </div>
  )
}

function RelationProperties({ relation }: { relation: Relation }): JSX.Element {
  const hidden = useModel((s) => s.hiddenEdges.includes(relation.id))
  const resources = useModel((s) => s.resources)
  const relations = useModel((s) => s.relations)
  const target = useModel((s) => s.resources[relation.targetId] ?? s.technologies[relation.targetId])
  const { updateRelation, removeEdgesFromDiagram, reverseRelation, select } = useModel.getState()
  const inActiveDiagram = useModel((s) => !!s.activeDiagram && !!s.diagrams[s.activeDiagram]?.edges.includes(relation.id))
  const path = useSavedPath(relation.id)
  const unsaved = useUnsavedPath(REPO_FOLDERS.relations)
  const update = (patch: Partial<Relation>): void => updateRelation(relation.id, patch)
  const source = resources[relation.sourceId]
  const targetResource = resources[relation.targetId]
  const targetLabel =
    targetResource?.type === 'endpoint'
      ? [ownersOf(targetResource.id, resources, relations).map((o) => o.name).join(', '), targetResource.name]
          .filter(Boolean)
          .join(' · ')
      : target?.name

  const title =
    relation.kind === 'uses' ? 'Relação: usa tecnologia' : targetResource?.type === 'endpoint' ? 'Relação: chama endpoint' : 'Relação'

  return (
    <div className="space-y-4 p-4">
      <Header title={title} path={path ?? unsaved}>
        <div className="mt-2 flex items-center gap-2 text-sm text-slate-700">
          <button
            className="truncate font-medium hover:underline"
            onClick={() => select({ kind: 'resource', id: relation.sourceId })}
          >
            {source?.name ?? '(removido)'}
          </button>
          <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" />
          <button
            className="truncate font-medium hover:underline"
            onClick={() =>
              targetResource
                ? select({ kind: 'resource', id: relation.targetId })
                : select({ kind: 'technology', id: relation.targetId })
            }
          >
            {targetLabel ?? '(removido)'}
          </button>
        </div>
        {relation.kind === 'flow' && (
          <button
            onClick={() => reverseRelation(relation.id)}
            title="Troca origem e destino (a seta passa a apontar para o outro lado)"
            className="mt-2 flex items-center gap-1.5 rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeftRight className="h-3.5 w-3.5" /> Inverter direção
          </button>
        )}
      </Header>

      {hidden && (
        <p className="rounded-md bg-slate-50 p-2 text-xs text-slate-500">
          Oculta neste desenho: um recurso está dentro do outro. Afaste-os para a seta voltar a aparecer.
        </p>
      )}

      {relation.kind === 'flow' && (
        <>
          <RelationTypeField relation={relation} />
          <Field label="Descrição">
            <input
              className={inputClass}
              value={relation.label}
              placeholder="ex.: Consulta saldo"
              onChange={(e) => update({ label: e.target.value })}
            />
          </Field>
          <Field label="Protocolo">
            <input
              className={inputClass}
              value={relation.protocol}
              placeholder="ex.: HTTPS/JSON, gRPC, Kafka"
              onChange={(e) => update({ protocol: e.target.value })}
            />
          </Field>
          <ImpactPicker value={relation.impact} onChange={(impact) => update({ impact })} />
        </>
      )}

      <div className="space-y-2 border-t border-slate-100 pt-4">
        {inActiveDiagram && (
          <button
            onClick={() => removeEdgesFromDiagram([relation.id])}
            className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            Remover deste desenho
          </button>
        )}
        <button onClick={() => askPermanentDelete([{ kind: 'relation', id: relation.id }])} className={dangerButton}>
          <Trash2 className="h-3.5 w-3.5" /> Excluir permanentemente
        </button>
      </div>
    </div>
  )
}

function RelationTypeField({ relation }: { relation: Relation }): JSX.Element {
  const updateRelation = useModel((s) => s.updateRelation)
  const [open, setOpen] = useState(false)
  const update = (patch: Partial<Relation>): void => updateRelation(relation.id, patch)
  const info = relation.relType ? ARCHIMATE_TYPES[relation.relType] : undefined

  return (
    <div className="space-y-2">
      <div>
        <span className="mb-1 block text-xs font-medium text-slate-500">Tipo (ArchiMate)</span>
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center gap-2 rounded-md border border-slate-200 px-2 py-1.5 text-left text-sm hover:bg-slate-50"
        >
          <NotationPreview {...relationNotation(relation)} />
          <span className="flex-1">{info?.label ?? 'Genérica'}</span>
        </button>
        {info && !open && <p className="mt-1 text-[11px] text-slate-400">{info.description}</p>}
        {open && (
          <div className="mt-1 max-h-80 overflow-y-auto rounded-md border border-slate-200 px-1">
            <RelTypeList
              value={relation.relType}
              onPick={(relType) => {
                setOpen(false)
                update({ relType })
              }}
            />
          </div>
        )}
      </div>

      {relation.relType === 'access' && (
        <div className="grid grid-cols-4 gap-1">
          {ACCESS_MODES.map((m) => (
            <button
              key={m.value}
              onClick={() => update({ accessMode: m.value === 'write' ? undefined : m.value })}
              className={`rounded-md border px-1 py-1 text-[11px] ${
                (relation.accessMode ?? 'write') === m.value
                  ? 'border-sky-400 bg-sky-50 text-sky-800'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      )}
      {relation.relType === 'influence' && (
        <Field label="Força">
          <input
            className={inputClass}
            value={relation.strength ?? ''}
            placeholder="ex.: +, ++, -, --"
            onChange={(e) => update({ strength: e.target.value })}
          />
        </Field>
      )}
      {relation.relType === 'association' && (
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={!!relation.directed} onChange={(e) => update({ directed: e.target.checked })} />
          Com direção
        </label>
      )}
    </div>
  )
}

function ColorPicker({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }): JSX.Element {
  return (
    <div>
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      <div className="flex flex-wrap items-center gap-1">
        {SHAPE_COLORS.map((color) => (
          <button
            key={color}
            onClick={() => onChange(color)}
            title={color === 'transparent' ? 'Sem cor' : color}
            className={`h-5 w-5 rounded border ${value === color ? 'ring-2 ring-sky-500 ring-offset-1' : 'border-slate-300'}`}
            style={{
              background:
                color === 'transparent'
                  ? 'linear-gradient(to top right, #fff 45%, #f43f5e 45%, #f43f5e 55%, #fff 55%)'
                  : color
            }}
          />
        ))}
        <input
          type="color"
          value={value.startsWith('#') ? value : '#ffffff'}
          onChange={(e) => onChange(e.target.value)}
          className="h-5 w-7 cursor-pointer rounded border border-slate-300 bg-transparent p-0"
          title="Outra cor"
        />
      </div>
    </div>
  )
}

function ShapeProperties({ shape }: { shape: Shape }): JSX.Element {
  const { updateShape, duplicateShape, removeFromDiagram } = useModel.getState()
  const update = (patch: Partial<Shape>): void => updateShape(shape.id, patch)

  return (
    <div className="space-y-4 p-4">
      <Header title="Forma">
        <p className="mt-1 text-xs text-slate-400">Existe só neste desenho. Dê dois cliques na forma para editar o texto.</p>
      </Header>

      <Field label="Tipo">
        <select className={inputClass} value={shape.kind} onChange={(e) => update({ kind: e.target.value as Shape['kind'] })}>
          {SHAPE_KIND_ORDER.map((k) => (
            <option key={k} value={k}>
              {SHAPE_KINDS[k].label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Texto">
        <textarea
          className={`${inputClass} min-h-16 resize-y`}
          value={shape.text}
          onChange={(e) => update({ text: e.target.value })}
        />
      </Field>
      <ColorPicker label="Preenchimento" value={shape.fill} onChange={(fill) => update({ fill })} />
      <ColorPicker label="Borda" value={shape.stroke} onChange={(stroke) => update({ stroke })} />
      <div className="grid grid-cols-3 gap-1">
        {(['solid', 'dashed', 'none'] as const).map((style) => (
          <button
            key={style}
            onClick={() => update({ strokeStyle: style })}
            className={`rounded-md border py-1 text-xs ${
              shape.strokeStyle === style ? 'border-sky-400 bg-sky-50 text-sky-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {style === 'solid' ? 'Contínua' : style === 'dashed' ? 'Tracejada' : 'Sem borda'}
          </button>
        ))}
      </div>
      <ColorPicker label="Cor do texto" value={shape.textColor} onChange={(textColor) => update({ textColor })} />
      <Field label={`Tamanho do texto: ${shape.fontSize}px`}>
        <input
          type="range"
          min={10}
          max={48}
          value={shape.fontSize}
          onChange={(e) => update({ fontSize: Number(e.target.value) })}
          className="w-full"
        />
      </Field>

      <OrderButtons id={shape.id} />
      <LockToggle ids={[shape.id]} />

      <div className="space-y-2 border-t border-slate-100 pt-4">
        <button
          onClick={() => duplicateShape(shape.id)}
          className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
        >
          Duplicar (⌘D)
        </button>
        <button onClick={() => removeFromDiagram([shape.id])} className={dangerButton}>
          <Trash2 className="h-3.5 w-3.5" /> Excluir forma
        </button>
      </div>
    </div>
  )
}
