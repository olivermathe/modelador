import { Handle, NodeResizer, Position, type Node, type NodeProps } from '@xyflow/react'
import { memo, useLayoutEffect, useRef, useState } from 'react'
import { ELEMENT_TYPES, impactInfo } from '@/model/elementTypes'
import { useModel } from '@/model/store'
import { commitEndpointRoute } from './EndpointRouteEditor'
import type { Resource } from '@/model/types'
import { ANCHOR_POINTS } from './dnd'
import { LockBadge } from './LockBadge'

export type ElementNodeData = {
  resource: Resource
  technologies: string[]
  /** Somente endpoints: nomes dos donos (ligados por Composição). */
  parentName?: string
  /** O usuário definiu o tamanho neste desenho (senão, largura padrão e altura do conteúdo). */
  sized: boolean
  /** Travado neste desenho. */
  locked: boolean
}
export type ElementFlowNode = Node<ElementNodeData, 'element'>

const SIDES = { top: Position.Top, right: Position.Right, bottom: Position.Bottom, left: Position.Left }

/** Largura mínima ao redimensionar; abaixo disso o texto quebraria letra a letra. */
const MIN_WIDTH = 160
/** Borda de 2px em cima e embaixo. */
const BORDER = 4

function ImpactBadge({ resource }: { resource: Resource }): JSX.Element | null {
  if (!resource.impact) return null
  const info = impactInfo(resource.impact)
  return (
    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${info.badge}`}>
      {info.label}
    </span>
  )
}

/** Campo de texto no próprio nó: Enter ou clicar fora confirma, Esc cancela. */
function InlineEdit({
  value,
  mono,
  onDone
}: {
  value: string
  mono?: boolean
  onDone: (value: string | null) => void
}): JSX.Element {
  const cancelled = useRef(false)
  return (
    <input
      autoFocus
      defaultValue={value}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={(e) => onDone(cancelled.current ? null : e.currentTarget.value)}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') {
          cancelled.current = true
          e.currentTarget.blur()
        }
      }}
      onDoubleClick={(e) => e.stopPropagation()}
      // nodrag/nopan: selecionar texto não arrasta o nó nem o desenho
      className={`nodrag nopan w-full min-w-0 rounded border border-sky-400 bg-white px-1 text-sm text-slate-900 outline-none ${
        mono ? 'font-mono' : 'font-semibold'
      }`}
    />
  )
}

function ElementNodeComponent({ id, data, selected }: NodeProps<ElementFlowNode>): JSX.Element {
  const { resource, technologies, parentName, sized, locked } = data
  const info = ELEMENT_TYPES[resource.type]
  const Icon = info.icon
  const resizeNode = useModel((s) => s.resizeNode)

  // Altura do conteúdo na largura atual: é o mínimo ao redimensionar, para nada ficar escondido
  const contentRef = useRef<HTMLDivElement>(null)
  const [minHeight, setMinHeight] = useState(60)
  useLayoutEffect(() => {
    const el = contentRef.current
    if (!el) return
    const observer = new ResizeObserver(() => setMinHeight(el.offsetHeight + BORDER))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Ao estreitar, o texto quebra linha e o conteúdo cresce: a altura acompanha para nada ficar de fora
  const fitHeightAfterResize = (width: number, height: number): void => {
    requestAnimationFrame(() => {
      const content = (contentRef.current?.offsetHeight ?? 0) + BORDER
      if (content > height) resizeNode(id, { width, height: content })
    })
  }

  // Renomear no próprio desenho (dois cliques no nome); mesmas verificações do painel
  const [editing, setEditing] = useState(false)
  const startEditing = (e: React.MouseEvent): void => {
    e.stopPropagation()
    if (!locked) setEditing(true)
  }
  const commitName = (value: string | null): void => {
    setEditing(false)
    const name = value?.trim()
    if (!name || name === resource.name) return
    const { updateResource, checkDuplicateName } = useModel.getState()
    const previous = resource.name
    updateResource(id, { name })
    checkDuplicateName(id, previous)
  }
  const commitPath = (value: string | null): void => {
    setEditing(false)
    if (value?.trim()) commitEndpointRoute(resource, resource.method ?? 'GET', value)
  }


  const removed = resource.impact === 'removed'

  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={MIN_WIDTH}
        minHeight={minHeight}
        onResizeEnd={(_, p) => fitHeightAfterResize(p.width, p.height)}
        color="#0ea5e9"
        handleStyle={{ width: 8, height: 8, borderRadius: 2 }}
      />
      <div
        className={`relative rounded-lg border-2 bg-white shadow-sm transition-shadow ${
          sized ? 'min-h-full w-full' : 'w-60'
        } ${impactInfo(resource.impact).border} ${removed ? 'border-dashed opacity-70' : ''} ${
          selected ? 'shadow-lg ring-2 ring-sky-400 ring-offset-2' : ''
        }`}
      >
        {locked && <LockBadge id={id} />}
        {/* Pontos de conexão: só aparecem com a ferramenta Ligar (CSS em index.css) */}
        {ANCHOR_POINTS.map((a) => (
          <Handle
            key={a.id}
            id={a.id}
            type="source"
            position={SIDES[a.side]}
            className="anchor-point"
            style={a.side === 'top' || a.side === 'bottom' ? { left: `${a.offset}%` } : { top: `${a.offset}%` }}
          />
        ))}
        <div ref={contentRef} className="flex items-start gap-2 px-3 py-2.5">
          {/* Só o ícone identifica o tipo; o nome do tipo aparece ao passar o mouse */}
          <span title={info.label} className="mt-0.5 shrink-0">
            <Icon className="h-4 w-4 text-slate-500" aria-label={info.label} />
          </span>
          <div className="min-w-0 flex-1">
            {resource.type === 'endpoint' ? (
              <>
                <div className={`break-all font-mono text-sm ${removed ? 'line-through' : ''}`}>
                  <span className="font-bold text-slate-600">{resource.method}</span>{' '}
                  {editing ? (
                    <InlineEdit value={resource.path ?? '/'} mono onDone={commitPath} />
                  ) : (
                    <span className="text-slate-900" onDoubleClick={startEditing} title="Dois cliques para editar o caminho">
                      {resource.path}
                    </span>
                  )}
                </div>
                {parentName && <div className="break-words text-xs text-slate-500">de {parentName}</div>}
              </>
            ) : editing ? (
              <InlineEdit value={resource.name} onDone={commitName} />
            ) : (
              <div
                onDoubleClick={startEditing}
                title="Dois cliques para renomear"
                className={`break-words text-sm font-semibold text-slate-900 ${removed ? 'line-through' : ''}`}
              >
                {resource.name || 'Sem nome'}
              </div>
            )}
            {technologies.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {technologies.map((name) => (
                  <span key={name} className="rounded bg-violet-50 px-1.5 py-0.5 text-[10px] text-violet-700">
                    {name}
                  </span>
                ))}
              </div>
            )}
          </div>
          <ImpactBadge resource={resource} />
        </div>
      </div>
    </>
  )
}

export const ElementNode = memo(ElementNodeComponent)
