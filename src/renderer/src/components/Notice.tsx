import { Info } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useModel } from '@/model/store'

const VISIBLE_MS = 4000

/** Aviso passageiro no rodapé (ex.: "Essa ligação já existe neste desenho."). */
export function Notice(): JSX.Element | null {
  const notice = useModel((s) => s.notice)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!notice) return
    setVisible(true)
    const timer = setTimeout(() => setVisible(false), VISIBLE_MS)
    return () => clearTimeout(timer)
  }, [notice])

  if (!notice || !visible) return null
  return (
    <div
      role="status"
      className="pointer-events-none fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white shadow-xl"
    >
      <Info className="h-4 w-4 shrink-0 text-sky-300" />
      {notice.text}
    </div>
  )
}
