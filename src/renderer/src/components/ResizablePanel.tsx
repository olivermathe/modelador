import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from 'lucide-react'
import { useCallback, useEffect, useState, type ReactNode } from 'react'

interface PanelPrefs {
  width: number
  collapsed: boolean
}

/** Preferência de tela (não é dado do repositório): fica só neste computador. */
function loadPrefs(key: string, fallback: PanelPrefs): PanelPrefs {
  try {
    const saved = JSON.parse(localStorage.getItem(key) ?? 'null') as Partial<PanelPrefs> | null
    return { ...fallback, ...saved }
  } catch {
    return fallback
  }
}

function savePrefs(key: string, prefs: PanelPrefs): void {
  try {
    localStorage.setItem(key, JSON.stringify(prefs))
  } catch {
    // Sem armazenamento: o painel só não lembra o tamanho
  }
}

/**
 * Painel lateral com largura ajustável (arrastando a borda interna) e botão
 * para recolher/expandir. Duplo clique na borda volta à largura padrão.
 */
export function ResizablePanel({
  side,
  title,
  storageKey,
  defaultWidth,
  minWidth = 200,
  maxWidth = 560,
  children
}: {
  side: 'left' | 'right'
  title: string
  storageKey: string
  defaultWidth: number
  minWidth?: number
  maxWidth?: number
  children: ReactNode
}): JSX.Element {
  const [prefs, setPrefs] = useState(() => loadPrefs(storageKey, { width: defaultWidth, collapsed: false }))
  const [dragging, setDragging] = useState(false)

  useEffect(() => savePrefs(storageKey, prefs), [storageKey, prefs])

  const clamp = useCallback((w: number) => Math.min(maxWidth, Math.max(minWidth, w)), [minWidth, maxWidth])

  const startDrag = (e: React.MouseEvent): void => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = prefs.width
    setDragging(true)
    const onMove = (ev: MouseEvent): void => {
      const delta = side === 'left' ? ev.clientX - startX : startX - ev.clientX
      setPrefs((p) => ({ ...p, width: clamp(startWidth + delta) }))
    }
    const onUp = (): void => {
      setDragging(false)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const toggle = (): void => setPrefs((p) => ({ ...p, collapsed: !p.collapsed }))
  const border = side === 'left' ? 'border-r' : 'border-l'

  if (prefs.collapsed) {
    const Open = side === 'left' ? PanelLeftOpen : PanelRightOpen
    return (
      <aside className={`flex w-9 shrink-0 flex-col items-center ${border} border-slate-200 bg-white py-2`}>
        <button
          onClick={toggle}
          title={`Expandir ${title}`}
          aria-label={`Expandir ${title}`}
          className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
        >
          <Open className="h-4 w-4" />
        </button>
        <span className="mt-3 text-xs text-slate-400 [writing-mode:vertical-rl]">{title}</span>
      </aside>
    )
  }

  const Close = side === 'left' ? PanelLeftClose : PanelRightClose
  return (
    <aside
      className={`relative flex shrink-0 flex-col ${border} border-slate-200 bg-white`}
      style={{ width: prefs.width }}
      data-panel={side}
    >
      <button
        onClick={toggle}
        title={`Recolher ${title}`}
        aria-label={`Recolher ${title}`}
        className={`absolute top-2 z-10 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 ${
          side === 'left' ? 'right-1.5' : 'left-1.5'
        }`}
      >
        <Close className="h-4 w-4" />
      </button>
      <div className="min-h-0 flex-1">{children}</div>
      {/* Borda arrastável */}
      <div
        onMouseDown={startDrag}
        onDoubleClick={() => setPrefs((p) => ({ ...p, width: defaultWidth }))}
        title="Arraste para redimensionar · duplo clique volta ao tamanho padrão"
        className={`absolute inset-y-0 z-20 w-1.5 cursor-col-resize hover:bg-sky-400/50 ${
          dragging ? 'bg-sky-400/60' : ''
        } ${side === 'left' ? '-right-1' : '-left-1'}`}
      />
      {/* Durante o arrasto, evita que o canvas/inputs capturem o mouse */}
      {dragging && <div className="fixed inset-0 z-50 cursor-col-resize" />}
    </aside>
  )
}
