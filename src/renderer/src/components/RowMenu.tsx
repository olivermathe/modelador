import { MoreHorizontal, type LucideIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export interface RowMenuItem {
  label: string
  icon: LucideIcon
  onClick: () => void
  danger?: boolean
  /** Linha separadora antes deste item. */
  separated?: boolean
}

/**
 * Botão "⋯" de uma linha da árvore. Fica por cima do fim da linha e só aparece
 * ao passar o mouse (ou com o menu aberto), para o nome ocupar a largura toda.
 */
export function RowMenu({ items, label }: { items: RowMenuItem[]; label: string }): JSX.Element | null {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!pos) return
    const close = (): void => setPos(null)
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('blur', close)
    window.addEventListener('resize', close)
    document.addEventListener('scroll', close, true)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('blur', close)
      window.removeEventListener('resize', close)
      document.removeEventListener('scroll', close, true)
    }
  }, [pos])

  if (items.length === 0) return null

  const open = (): void => {
    // Mede a linha, não o botão: o botão pode estar oculto (display: none) até o hover
    const r = (buttonRef.current!.parentElement ?? buttonRef.current!).getBoundingClientRect()
    setPos({ x: r.right, y: r.bottom + 4 })
  }

  return (
    <>
      <button
        ref={buttonRef}
        title={label}
        aria-label={label}
        onClick={(e) => {
          e.stopPropagation()
          if (pos) setPos(null)
          else open()
        }}
        onDoubleClick={(e) => e.stopPropagation()}
        className={`absolute right-1 top-1/2 -translate-y-1/2 rounded bg-white/90 p-0.5 text-slate-500 shadow-sm ring-1 ring-slate-200 hover:bg-slate-100 hover:text-slate-800 ${
          pos ? 'flex' : 'hidden group-hover:flex'
        }`}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {pos &&
        createPortal(
          // Eventos de portal sobem pela árvore do React: sem isto, o clique chegaria à linha
          // da pasta (que abre/fecha) e esconderia o campo que a ação acabou de abrir
          <div onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
            <div className="fixed inset-0 z-40" onMouseDown={() => setPos(null)} />
            <div
              role="menu"
              className="fixed z-50 w-52 rounded-lg border border-slate-200 bg-white p-1 shadow-xl"
              style={{
                left: Math.min(pos.x - 208, window.innerWidth - 216),
                top: Math.min(pos.y, window.innerHeight - items.length * 34 - 16)
              }}
            >
              {items.map((item) => (
                <div key={item.label}>
                  {item.separated && <div className="my-1 border-t border-slate-100" />}
                  <button
                    role="menuitem"
                    onClick={() => {
                      setPos(null)
                      item.onClick()
                    }}
                    className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm ${
                      item.danger ? 'text-rose-600 hover:bg-rose-50' : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <item.icon className="h-3.5 w-3.5" />
                    {item.label}
                  </button>
                </div>
              ))}
            </div>
          </div>,
          document.body
        )}
    </>
  )
}
