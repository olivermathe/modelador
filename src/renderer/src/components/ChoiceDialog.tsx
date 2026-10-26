import { useEffect } from 'react'
import { useModel } from '@/model/store'

/**
 * Pergunta do tipo "já existe: usar o existente ou criar novo, mantendo os dois?".
 * Usada para ligações repetidas e endpoints com a mesma rota.
 */
export function ChoiceDialog(): JSX.Element | null {
  const choice = useModel((s) => s.choice)
  const closeChoice = useModel((s) => s.closeChoice)

  const cancel = (): void => {
    choice?.onCancel?.()
    closeChoice()
  }

  useEffect(() => {
    if (!choice) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') cancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!choice) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onMouseDown={cancel}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={choice.title}
        className="w-full max-w-md rounded-xl bg-white shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="space-y-2 p-5">
          <h2 className="text-base font-semibold text-slate-900">{choice.title}</h2>
          <p className="text-sm text-slate-600">{choice.message}</p>
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 px-5 py-3">
          <button onClick={cancel} className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">
            Cancelar
          </button>
          {choice.options.map((o) => (
            <button
              key={o.label}
              autoFocus={o.primary || o.danger}
              onClick={() => {
                closeChoice()
                o.run()
              }}
              className={
                o.danger
                  ? 'rounded-md bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-700'
                  : o.primary
                    ? 'rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700'
                    : 'rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50'
              }
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
