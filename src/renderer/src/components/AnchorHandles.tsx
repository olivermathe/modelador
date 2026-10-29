import { Handle, Position, useUpdateNodeInternals } from '@xyflow/react'
import { useEffect } from 'react'
import { anchorAt, ANCHOR_POINTS, BORDER_HANDLES, parseAnchor } from './dnd'

const SIDES = { top: Position.Top, right: Position.Right, bottom: Position.Bottom, left: Position.Left }

const at = (side: string, offset: number): React.CSSProperties =>
  side === 'top' || side === 'bottom' ? { left: `${offset}%` } : { top: `${offset}%` }

/**
 * Ponto da borda onde começou a última ligação puxada de uma faixa da borda. O `Canvas` lê ao
 * terminar a ligação (o React Flow só sabe que começou na faixa inteira).
 */
export const borderStart: { current?: { nodeId: string; anchor: string } } = {}

/**
 * Pontos de conexão de um recurso ou forma (só aparecem com a ferramenta Ligar; CSS em index.css):
 * - faixas invisíveis nas 4 bordas, para começar a ligação em qualquer ponto da borda;
 * - os 16 pontos fixos;
 * - os pontos livres já usados por ligações deste desenho (`extra`), para a seta saber onde encostar.
 */
export function AnchorHandles({ nodeId, extra }: { nodeId: string; extra: string[] }): JSX.Element {
  const updateNodeInternals = useUpdateNodeInternals()
  const key = extra.join(',')
  // Pontos novos precisam ser medidos pelo React Flow antes de a seta usá-los
  useEffect(() => updateNodeInternals(nodeId), [key, nodeId, updateNodeInternals])
  return (
    <>
      {BORDER_HANDLES.map((b) => (
        <Handle
          key={b.id}
          id={b.id}
          type="source"
          position={SIDES[b.side]}
          className={`anchor-border anchor-border-${b.side}`}
          onMouseDownCapture={(e) => {
            const r = e.currentTarget.parentElement!.getBoundingClientRect()
            borderStart.current = { nodeId, anchor: anchorAt(r, e.clientX, e.clientY) }
          }}
        />
      ))}
      {ANCHOR_POINTS.map((a) => (
        <Handle key={a.id} id={a.id} type="source" position={SIDES[a.side]} className="anchor-point" style={at(a.side, a.offset)} />
      ))}
      {extra.map((id) => {
        const a = parseAnchor(id)
        return (
          a && <Handle key={id} id={id} type="source" position={SIDES[a.side]} className="anchor-point" style={at(a.side, a.offset)} />
        )
      })}
    </>
  )
}
