import {
  ArrowDown,
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUp,
  ArrowUpToLine,
  Copy,
  EyeOff,
  Lock,
  LockOpen,
  Trash2,
  type LucideIcon
} from 'lucide-react'
import { useEffect } from 'react'
import { useModel, type ZOrderOp } from '@/model/store'
import { askPermanentDelete } from './deleteActions'

export interface ContextMenuState {
  x: number
  y: number
  /** Item clicado. */
  id: string
  kind: 'resource' | 'shape' | 'relation'
  /** Recursos/formas e ligações a que as ações se aplicam (o item clicado, ou a seleção múltipla). */
  items: string[]
  edges: string[]
}

export const ORDER_ACTIONS: { op: ZOrderOp; label: string; shortcut: string; icon: LucideIcon }[] = [
  { op: 'front', label: 'Trazer para frente', shortcut: '⇧⌘]', icon: ArrowUpToLine },
  { op: 'forward', label: 'Avançar', shortcut: '⌘]', icon: ArrowUp },
  { op: 'backward', label: 'Recuar', shortcut: '⌘[', icon: ArrowDown },
  { op: 'back', label: 'Enviar para trás', shortcut: '⇧⌘[', icon: ArrowDownToLine }
]

function Item({
  icon: Icon,
  label,
  shortcut,
  danger,
  onClick
}: {
  icon: LucideIcon
  label: string
  shortcut?: string
  danger?: boolean
  onClick: () => void
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm ${
        danger ? 'text-rose-600 hover:bg-rose-50' : 'text-slate-700 hover:bg-slate-100'
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="flex-1">{label}</span>
      {shortcut && <span className="text-xs text-slate-400">{shortcut}</span>}
    </button>
  )
}

export function ContextMenu({ menu, onClose }: { menu: ContextMenuState; onClose: () => void }): JSX.Element {
  const { reorder, duplicateShape, removeFromDiagram, removeEdgesFromDiagram, setLocked, setMultiSelection, reverseRelation } =
    useModel.getState()
  const diagram = useModel((s) => (s.activeDiagram ? s.diagrams[s.activeDiagram] : undefined))

  useEffect(() => {
    const close = (e: Event): void => {
      if (e instanceof KeyboardEvent && e.key !== 'Escape') return
      onClose()
    }
    window.addEventListener('keydown', close)
    window.addEventListener('blur', close)
    return () => {
      window.removeEventListener('keydown', close)
      window.removeEventListener('blur', close)
    }
  }, [onClose])

  const run = (fn: () => void) => () => {
    fn()
    onClose()
  }

  const isShape = (id: string): boolean => !!diagram?.shapes.some((sh) => sh.id === id)
  const isLocked = (id: string): boolean =>
    !!(diagram?.nodes.find((n) => n.resourceId === id)?.locked || diagram?.shapes.find((sh) => sh.id === id)?.locked)
  const many = menu.items.length + menu.edges.length > 1
  const single = !many && menu.kind !== 'relation'
  const lockable = menu.items
  const allLocked = lockable.length > 0 && lockable.every(isLocked)
  const resources = menu.items.filter((id) => !isShape(id))
  const permanent = [
    ...resources.map((id) => ({ kind: 'resource' as const, id })),
    ...menu.edges.map((id) => ({ kind: 'relation' as const, id }))
  ]
  const removeFromDrawing = (): void => {
    if (menu.edges.length) removeEdgesFromDiagram(menu.edges)
    if (menu.items.length) removeFromDiagram(menu.items)
    setMultiSelection([], [])
  }

  return (
    <>
      <div className="fixed inset-0 z-40" onMouseDown={onClose} onContextMenu={(e) => (e.preventDefault(), onClose())} />
      <div
        className="fixed z-50 w-64 rounded-lg border border-slate-200 bg-white p-1 shadow-xl"
        style={{ left: Math.min(menu.x, window.innerWidth - 270), top: Math.min(menu.y, window.innerHeight - 330) }}
      >
        {many && (
          <p className="px-2 pb-1 pt-1.5 text-xs text-slate-400">
            {menu.items.length + menu.edges.length} itens selecionados
          </p>
        )}
        {single && (
          <>
            {ORDER_ACTIONS.map((a) => (
              <Item key={a.op} icon={a.icon} label={a.label} shortcut={a.shortcut} onClick={run(() => reorder(menu.id, a.op))} />
            ))}
            <div className="my-1 border-t border-slate-100" />
          </>
        )}
        {lockable.length > 0 && (
          <Item
            icon={allLocked ? LockOpen : Lock}
            label={allLocked ? 'Destravar' : 'Travar (não mover nem selecionar)'}
            onClick={run(() => {
              setLocked(lockable, !allLocked)
              if (!allLocked) setMultiSelection([], [])
            })}
          />
        )}
        {single && menu.kind === 'shape' && (
          <Item icon={Copy} label="Duplicar" shortcut="⌘D" onClick={run(() => duplicateShape(menu.id))} />
        )}
        {(lockable.length > 0 || (single && menu.kind === 'shape')) && <div className="my-1 border-t border-slate-100" />}
        {!many && menu.kind === 'relation' && (
          <>
            <Item icon={ArrowLeftRight} label="Inverter direção" onClick={run(() => reverseRelation(menu.id))} />
            <div className="my-1 border-t border-slate-100" />
          </>
        )}
        {/* Dois jeitos de apagar: só deste desenho, ou de vez (todos os desenhos e o arquivo) */}
        <Item
          icon={EyeOff}
          label={!many && menu.kind === 'shape' ? 'Excluir forma' : 'Remover do desenho'}
          shortcut="⌫"
          onClick={run(removeFromDrawing)}
        />
        {permanent.length > 0 && (
          <Item
            icon={Trash2}
            label="Excluir permanentemente…"
            shortcut="⇧⌫"
            danger
            onClick={run(() => askPermanentDelete(permanent))}
          />
        )}
      </div>
    </>
  )
}
