import { LayoutGrid, SlidersHorizontal, type LucideIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useModel } from '@/model/store'
import { Palette } from './Palette'
import { PropertiesContent } from './PropertiesPanel'

type Tab = 'palette' | 'properties'

const TABS: { value: Tab; label: string; icon: LucideIcon }[] = [
  { value: 'palette', label: 'Paleta', icon: LayoutGrid },
  { value: 'properties', label: 'Propriedades', icon: SlidersHorizontal }
]

/** Painel da direita: paleta para montar o desenho e propriedades do item selecionado. */
export function SidePanel(): JSX.Element {
  const selection = useModel((s) => s.selection)
  const [tab, setTab] = useState<Tab>('palette')

  // Selecionar algo abre as propriedades; limpar a seleção volta para a paleta
  const multiCount = useModel((s) => s.selectedItems.length + s.selectedEdges.length)
  const selectionKey = selection ? `${selection.kind}:${selection.id}` : multiCount > 1 ? `multi:${multiCount}` : ''
  useEffect(() => setTab(selectionKey ? 'properties' : 'palette'), [selectionKey])

  return (
    <div className="flex h-full flex-col">
      {/* pl-9: espaço para o botão de recolher do painel */}
      <nav className="flex shrink-0 border-b border-slate-200 pl-9 pr-2">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`-mb-px flex flex-1 items-center justify-center gap-1.5 border-b-2 px-3 py-2.5 text-sm ${
              tab === t.value
                ? 'border-sky-500 font-medium text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </nav>
      <div className="min-h-0 flex-1 overflow-y-auto">{tab === 'palette' ? <Palette /> : <PropertiesContent />}</div>
    </div>
  )
}
