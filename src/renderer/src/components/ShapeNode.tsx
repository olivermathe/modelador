import { NodeResizer, type Node, type NodeProps } from '@xyflow/react'
import { memo, useState } from 'react'
import { IMPACTS } from '@/model/elementTypes'
import { useModel } from '@/model/store'
import { AnchorHandles } from './AnchorHandles'
import { LockBadge } from './LockBadge'
import type { Shape } from '@/model/types'

export type ShapeNodeData = {
  shape: Shape
  /** Pontos livres da borda usados por ligações deste desenho. */
  anchors: string[]
}
export type ShapeFlowNode = Node<ShapeNodeData, 'shape'>


const RADIUS: Record<Shape['kind'], string> = {
  rectangle: '0',
  rounded: '12px',
  ellipse: '50%',
  text: '0',
  legend: '6px'
}

/** Quadrinho de legenda: o que cada cor de impacto significa (borda dos recursos e cor das setas). */
function ImpactLegend({ title, style }: { title: React.ReactNode; style: React.CSSProperties }): JSX.Element {
  return (
    <div className="flex h-full w-full flex-col items-start gap-1.5 text-left">
      <div className="font-semibold" style={style}>
        {title}
      </div>
      {IMPACTS.map((i) => (
        <div key={i.label} className="flex items-center gap-2 text-xs" style={{ color: style.color }} data-impact={i.value ?? 'none'}>
          <span className={`h-3.5 w-6 shrink-0 rounded-sm border-2 bg-white ${i.border} ${i.value === 'removed' ? 'border-dashed' : ''}`} />
          <svg width="22" height="6" className="shrink-0">
            <line x1="0" y1="3" x2="22" y2="3" stroke={i.stroke} strokeWidth="2" strokeDasharray={i.value === 'removed' ? '5 3' : undefined} />
          </svg>
          {i.label}
        </div>
      ))}
    </div>
  )
}

function ShapeNodeComponent({ id, data, selected }: NodeProps<ShapeFlowNode>): JSX.Element {
  const { shape } = data
  const updateShape = useModel((s) => s.updateShape)
  const [editing, setEditing] = useState(false)

  const textStyle: React.CSSProperties = {
    color: shape.textColor,
    fontSize: shape.fontSize,
    lineHeight: 1.3
  }

  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={24}
        minHeight={20}
        color="#0ea5e9"
        handleStyle={{ width: 8, height: 8, borderRadius: 2 }}
      />
      {shape.locked && <LockBadge id={id} />}
      {/* Pontos de conexão para ligações visuais: só aparecem com a ferramenta Ligar */}
      <AnchorHandles nodeId={id} extra={data.anchors} />
      <div
        onDoubleClick={() => !shape.locked && setEditing(true)}
        className="flex h-full w-full items-center justify-center overflow-hidden p-2 text-center"
        style={{
          background: shape.fill,
          border: shape.strokeStyle === 'none' ? 'none' : `2px ${shape.strokeStyle} ${shape.stroke}`,
          borderRadius: RADIUS[shape.kind],
          outline: selected && shape.strokeStyle === 'none' ? '1px dashed #0ea5e9' : undefined
        }}
      >
        {shape.kind === 'legend' ? (
          // Dois cliques editam só o título; as cores vêm do app
          <ImpactLegend
            style={textStyle}
            title={
              editing ? (
                <input
                  autoFocus
                  defaultValue={shape.text}
                  onFocus={(e) => e.currentTarget.select()}
                  onBlur={(e) => {
                    updateShape(shape.id, { text: e.target.value })
                    setEditing(false)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setEditing(false)
                    if (e.key === 'Enter') e.currentTarget.blur()
                  }}
                  className="nodrag w-full bg-transparent outline-none"
                />
              ) : (
                shape.text
              )
            }
          />
        ) : editing ? (
          <textarea
            autoFocus
            defaultValue={shape.text}
            onFocus={(e) => e.currentTarget.select()}
            onBlur={(e) => {
              updateShape(shape.id, { text: e.target.value })
              setEditing(false)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setEditing(false)
              // ⌘Enter confirma; Enter sozinho quebra linha
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) e.currentTarget.blur()
            }}
            className="nodrag nowheel h-full w-full resize-none bg-transparent text-center outline-none"
            style={textStyle}
          />
        ) : (
          <span className="whitespace-pre-wrap break-words" style={textStyle}>
            {shape.text}
          </span>
        )}
      </div>
    </>
  )
}

export const ShapeNode = memo(ShapeNodeComponent)
