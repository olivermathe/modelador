import { cloneElement, useState, type ReactElement } from 'react'
import { createPortal } from 'react-dom'

/**
 * Dica que aparece na hora ao passar o mouse (o `title` nativo demora ~1s).
 * Fica num portal, para não ser cortada pela rolagem do painel.
 */
export function Tooltip({
  label,
  detail,
  children
}: {
  label: string
  detail?: string
  children: ReactElement
}): JSX.Element {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)

  const show = (e: React.MouseEvent<HTMLElement>): void => {
    const r = e.currentTarget.getBoundingClientRect()
    setPos({ x: r.left + r.width / 2, y: r.top })
  }
  const hide = (): void => setPos(null)

  return (
    <>
      {cloneElement(children, {
        'aria-label': label,
        onMouseEnter: show,
        onMouseLeave: hide,
        onDragStart: (e: React.DragEvent) => {
          hide()
          children.props.onDragStart?.(e)
        },
        onMouseDown: (e: React.MouseEvent) => {
          hide()
          children.props.onMouseDown?.(e)
        }
      })}
      {pos &&
        createPortal(
          <div
            role="tooltip"
            className="pointer-events-none fixed z-50 max-w-60 -translate-x-1/2 -translate-y-full rounded-md bg-slate-900 px-2 py-1 text-xs text-white shadow-lg"
            style={{ left: Math.max(130, Math.min(pos.x, window.innerWidth - 130)), top: pos.y - 6 }}
          >
            <div className="font-medium">{label}</div>
            {detail && <div className="mt-0.5 text-[11px] text-slate-300">{detail}</div>}
          </div>,
          document.body
        )}
    </>
  )
}
