import { Lock } from 'lucide-react'
import { useModel } from '@/model/store'

/**
 * Cadeado de um item travado. O item ignora o mouse (não move nem seleciona); só o
 * cadeado responde: clique destrava, botão direito abre o menu do item.
 */
export function LockBadge({ id }: { id: string }): JSX.Element {
  return (
    <button
      title="Travado: clique para destravar"
      aria-label="Destravar"
      onClick={(e) => {
        e.stopPropagation()
        useModel.getState().setLocked([id], false)
      }}
      onMouseDown={(e) => e.stopPropagation()}
      className="nodrag nopan pointer-events-auto absolute -right-2 -top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-500 shadow-sm hover:border-sky-400 hover:text-sky-600"
    >
      <Lock className="h-3 w-3" />
    </button>
  )
}
