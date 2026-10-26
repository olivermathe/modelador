import { Check, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { HTTP_METHODS } from '@/model/elementTypes'
import { linkedEndpointWithRoute, routeConflict, useModel } from '@/model/store'
import type { HttpMethod, Resource } from '@/model/types'

const fieldClass =
  'rounded-md border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400'

/**
 * Muda a rota de um endpoint. Se algum recurso ligado a ele já tiver um endpoint com a
 * rota nova, pergunta: usar o existente (este dá lugar a ele) ou manter os dois.
 * `onCancel` desfaz a edição na tela quando o usuário desiste.
 */
export function commitEndpointRoute(endpoint: Resource, method: HttpMethod, path: string, onCancel?: () => void): void {
  const clean = path.trim() || '/'
  if (method === endpoint.method && clean === endpoint.path) return
  const { resources, relations, updateResource, mergeResource, ask, select } = useModel.getState()
  const apply = (): void => updateResource(endpoint.id, { method, path: clean })
  const conflict = routeConflict(resources, relations, endpoint.id, method, clean)
  if (!conflict) return apply()
  ask({
    title: 'Esse endpoint já existe',
    message: `"${conflict.resource.name}" já está ligado a ${conflict.endpoint.name}. Usar o endpoint existente (as ligações deste passam para ele) ou manter os dois?`,
    options: [
      {
        label: 'Usar o existente',
        primary: true,
        run: () => {
          mergeResource(endpoint.id, conflict.endpoint.id)
          select({ kind: 'resource', id: conflict.endpoint.id })
        }
      },
      { label: 'Manter os dois', run: apply }
    ],
    onCancel
  })
}

/** Método + caminho de um endpoint existente; o caminho é confirmado ao sair do campo (ou Enter). */
export function EndpointRouteEditor({ endpoint, compact }: { endpoint: Resource; compact?: boolean }): JSX.Element {
  const [path, setPath] = useState(endpoint.path ?? '/')

  // Mudança vinda de fora (outro painel, desfazer, recarregar): acompanha
  useEffect(() => setPath(endpoint.path ?? '/'), [endpoint.path])

  const revert = (): void => setPath(endpoint.path ?? '/')

  return (
    <div className="flex min-w-0 flex-1 gap-1">
      <select
        className={`${fieldClass} font-semibold text-slate-700 ${compact ? 'px-1 text-xs' : ''}`}
        value={endpoint.method}
        onChange={(e) => commitEndpointRoute(endpoint, e.target.value as HttpMethod, path, revert)}
      >
        {HTTP_METHODS.map((m) => (
          <option key={m}>{m}</option>
        ))}
      </select>
      <input
        className={`${fieldClass} min-w-0 flex-1 font-mono ${compact ? 'text-xs' : ''}`}
        value={path}
        onChange={(e) => setPath(e.target.value)}
        onBlur={() => commitEndpointRoute(endpoint, endpoint.method ?? 'GET', path, revert)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
          if (e.key === 'Escape') revert()
        }}
      />
    </div>
  )
}

/**
 * Linha para criar um endpoint ligado ao recurso. Se o recurso já tiver um endpoint com a
 * mesma rota, pergunta: usar o existente ou criar novo, mantendo os dois.
 */
export function NewEndpointForm({ ownerId, onDone }: { ownerId: string; onDone: () => void }): JSX.Element {
  const createEndpoint = useModel((s) => s.createEndpoint)
  const select = useModel((s) => s.select)
  const resources = useModel((s) => s.resources)
  const relations = useModel((s) => s.relations)
  const [method, setMethod] = useState<HttpMethod>('GET')
  const [path, setPath] = useState('/')
  const [asking, setAsking] = useState(false)
  const clean = path.trim() || '/'
  const existing = linkedEndpointWithRoute(resources, relations, ownerId, method, clean)

  const create = (): void => {
    createEndpoint(ownerId, method, clean)
    onDone()
  }
  const submit = (): void => (existing ? setAsking(true) : create())

  return (
    <div className="rounded-md border border-sky-200 bg-sky-50/50 p-1.5">
      <div className="flex gap-1">
        <select
          className={`${fieldClass} bg-white px-1 text-xs font-semibold text-slate-700`}
          value={method}
          onChange={(e) => {
            setMethod(e.target.value as HttpMethod)
            setAsking(false)
          }}
        >
          {HTTP_METHODS.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
        <input
          autoFocus
          className={`${fieldClass} min-w-0 flex-1 bg-white font-mono text-xs`}
          value={path}
          placeholder="/caminho/{id}"
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => {
            setPath(e.target.value)
            setAsking(false)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit()
            if (e.key === 'Escape') onDone()
          }}
        />
        <button onClick={submit} title="Criar endpoint (Enter)" className="rounded p-1 text-sky-700 hover:bg-sky-100">
          <Check className="h-4 w-4" />
        </button>
        <button onClick={onDone} title="Cancelar (Esc)" className="rounded p-1 text-slate-400 hover:bg-slate-100">
          <X className="h-4 w-4" />
        </button>
      </div>
      {asking && existing && (
        <div className="mt-1.5 space-y-1.5 rounded bg-white p-2 text-[11px] text-slate-600 ring-1 ring-slate-200">
          <p>
            Este recurso já está ligado a <span className="font-mono font-semibold">{existing.name}</span>. Usar o
            existente ou criar novo, mantendo os dois?
          </p>
          <div className="flex gap-1.5">
            <button
              onClick={() => {
                select({ kind: 'resource', id: existing.id })
                onDone()
              }}
              className="rounded bg-sky-600 px-2 py-1 font-medium text-white hover:bg-sky-700"
            >
              Usar o existente
            </button>
            <button onClick={create} className="rounded border border-slate-200 px-2 py-1 hover:bg-slate-50">
              Criar novo, manter os dois
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
