import { LayoutGrid, Network, SlidersHorizontal, type LucideIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useModel } from '@/model/store'
import { Palette } from './Palette'
import { PropertiesContent } from './PropertiesPanel'
import { linkedResources, RelationsTab } from './RelationsTab'

type Tab = 'palette' | 'properties' | 'relations'

const TABS: { value: Tab; label: string; icon: LucideIcon }[] = [
  { value: 'palette', label: 'Paleta', icon: LayoutGrid },
  { value: 'properties', label: 'Propriedades', icon: SlidersHorizontal },
  { value: 'relations', label: 'Relacionamentos', icon: Network }
]

/**
 * Painel da direita: paleta para montar o desenho, propriedades do item selecionado e, com um recurso
 * selecionado, os recursos ligados a ele.
 */
export function SidePanel(): JSX.Element {
  const selection = useModel((s) => s.selection)
  const [tab, setTab] = useState<Tab>('palette')
  const resourceId = selection?.kind === 'resource' ? selection.id : undefined
  const relatedCount = useModel((s) => (resourceId ? linkedResources(resourceId, s.relations, s.resources).length : 0))

  // Selecionar algo abre as propriedades (ou continua em Relacionamentos, se for outro recurso);
  // limpar a seleção volta para a paleta
  const multiCount = useModel((s) => s.selectedItems.length + s.selectedEdges.length)
  const selectionKey = selection ? `${selection.kind}:${selection.id}` : multiCount > 1 ? `multi:${multiCount}` : ''
  useEffect(
    () => setTab((current) => (!selectionKey ? 'palette' : current === 'relations' && resourceId ? 'relations' : 'properties')),
    [selectionKey, resourceId]
  )
  const tabs = TABS.filter((t) => t.value !== 'relations' || resourceId)

  return (
    <div className="flex h-full flex-col">
      {/* pl-9: espaço para o botão de recolher do painel */}
      <nav className="flex shrink-0 border-b border-slate-200 pl-9 pr-2">
        {tabs.map((t) => {
          // Com 3 abas não cabe tudo: só a aba ativa mostra o nome (as outras, ícone + dica)
          const compact = tabs.length > 2 && tab !== t.value
          return (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              title={t.label}
              className={`-mb-px flex min-w-0 items-center justify-center gap-1.5 border-b-2 py-2.5 text-sm ${
                compact ? 'flex-none px-3' : 'flex-1 px-2'
              } ${
                tab === t.value
                  ? 'border-sky-500 font-medium text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <t.icon className="h-4 w-4 shrink-0" />
              <span className={compact ? 'sr-only' : 'truncate'}>{t.label}</span>
              {t.value === 'relations' && (
                <span className="shrink-0 rounded-full bg-slate-100 px-1.5 text-[11px] text-slate-600">{relatedCount}</span>
              )}
            </button>
          )
        })}
      </nav>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === 'palette' ? (
          <Palette />
        ) : tab === 'relations' && resourceId ? (
          <RelationsTab resourceId={resourceId} />
        ) : (
          <PropertiesContent />
        )}
      </div>
    </div>
  )
}
