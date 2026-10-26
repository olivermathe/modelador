import { NodeResizer, type Node, type NodeProps } from '@xyflow/react'
import { memo, useState } from 'react'
import { useModel } from '@/model/store'
import { LockBadge } from './LockBadge'
import type { Shape } from '@/model/types'

export type ShapeNodeData = { shape: Shape }
export type ShapeFlowNode = Node<ShapeNodeData, 'shape'>

const RADIUS: Record<Shape['kind'], string> = {
  rectangle: '0',
  rounded: '12px',
  ellipse: '50%',
  text: '0'
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
        {editing ? (
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
