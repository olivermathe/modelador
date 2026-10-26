import { Cable, MousePointer2, type LucideIcon } from 'lucide-react'
import { ARCHIMATE_TYPES } from '@/model/archimate'
import { useModel, type CanvasTool } from '@/model/store'

const TOOLS: { value: CanvasTool; label: string; shortcut: string; icon: LucideIcon }[] = [
  { value: 'select', label: 'Selecionar', shortcut: 'V', icon: MousePointer2 },
  { value: 'connect', label: 'Ligar', shortcut: 'L', icon: Cable }
]

/** Seletor de ferramenta no canto do desenho. Com "Ligar", os pontos de conexão aparecem. */
export function ToolSwitch(): JSX.Element {
  const tool = useModel((s) => s.tool)
  const setTool = useModel((s) => s.setTool)
  const relType = useModel((s) => s.newRelType)

  return (
    <div className="flex items-center gap-2">
      <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm">
        {TOOLS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTool(t.value)}
            title={`${t.label} (${t.shortcut})`}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs ${
              tool === t.value ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
      </div>
      {tool === 'connect' && (
        <span className="rounded-md bg-white/90 px-2 py-1 text-[11px] text-slate-500 shadow-sm">
          Arraste de um ponto até outro recurso · tipo:{' '}
          <span className="font-medium text-slate-700">{relType ? ARCHIMATE_TYPES[relType].label : 'Genérica'}</span> ·
          Esc para sair
        </span>
      )}
    </div>
  )
}
