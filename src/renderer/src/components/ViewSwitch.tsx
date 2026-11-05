import { Layers, ShieldCheck, type LucideIcon } from 'lucide-react'
import { relationAllowed } from '@/model/metamodel'
import { useModel, type DiagramView } from '@/model/store'

const VIEWS: { value: DiagramView; label: string; detail: string; icon: LucideIcon }[] = [
  { value: 'impact', label: 'Impacto', detail: 'Cores: impacto da feature (novo, alterado, excluído)', icon: Layers },
  { value: 'conformance', label: 'Conformidade', detail: 'Cores: segue ou não o meta modelo', icon: ShieldCheck }
]

/** Abas de visão no canto do desenho: muda o que a cor significa (e o que o Exportar mostra). */
export function ViewSwitch(): JSX.Element {
  const view = useModel((s) => s.view)
  const setView = useModel((s) => s.setView)
  const hasMetamodel = useModel((s) => !!s.metamodel)
  // Ligações deste desenho fora do meta modelo
  const outside = useModel((s) => {
    const d = s.activeDiagram ? s.diagrams[s.activeDiagram] : undefined
    if (!d || !s.metamodel) return 0
    return d.edges.filter((id) => s.relations[id] && !relationAllowed(s.metamodel, s.resources, s.relations[id])).length
  })

  return (
    <div className="flex items-center gap-2">
      <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm" role="tablist" aria-label="Visão">
        {VIEWS.map((v) => (
          <button
            key={v.value}
            role="tab"
            aria-selected={view === v.value}
            onClick={() => setView(v.value)}
            title={v.detail}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs ${
              view === v.value ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <v.icon className="h-3.5 w-3.5" />
            {v.label}
            {v.value === 'conformance' && outside > 0 && (
              <span
                data-outside-diagram
                title="Ligações deste desenho fora do meta modelo"
                className={`rounded-full px-1.5 text-[10px] font-medium ${view === v.value ? 'bg-white/20' : 'bg-slate-200 text-slate-700'}`}
              >
                {outside}
              </span>
            )}
          </button>
        ))}
      </div>
      {view === 'conformance' && !hasMetamodel && (
        <button
          onClick={() => useModel.getState().setMetamodelOpen(true)}
          className="rounded-md bg-white/90 px-2 py-1 text-[11px] text-slate-500 shadow-sm hover:text-slate-800"
        >
          Sem meta modelo: tudo é conforme. Criar…
        </button>
      )}
    </div>
  )
}
