import { Check } from 'lucide-react'
import { ARCHIMATE_ORDER, ARCHIMATE_TYPES } from '@/model/archimate'
import type { ArchimateRelType } from '@/model/types'
import { NotationPreview } from './ArchimateMarkers'
import { Tooltip } from './Tooltip'

const GENERIC_NOTATION = { end: 'arrow-filled' as const }

/** Lista dos tipos ArchiMate agrupados, com a miniatura da notação. */
export function RelTypeList({
  value,
  onPick
}: {
  value: ArchimateRelType | undefined
  onPick: (value: ArchimateRelType | undefined) => void
}): JSX.Element {
  const groups = [...new Set(ARCHIMATE_ORDER.map((t) => ARCHIMATE_TYPES[t].group))]
  const row = (key: string, active: boolean, label: string, notation: Parameters<typeof NotationPreview>[0], title?: string, onClick?: () => void): JSX.Element => (
    <button
      key={key}
      onClick={onClick}
      title={title}
      className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm ${active ? 'bg-sky-50 text-sky-900' : 'text-slate-700 hover:bg-slate-50'}`}
    >
      <NotationPreview {...notation} />
      <span className="flex-1">{label}</span>
      {active && <Check className="h-3.5 w-3.5 text-sky-600" />}
    </button>
  )
  return (
    <div className="py-1">
      {row('generic', !value, 'Genérica', GENERIC_NOTATION, 'Seta simples, sem semântica ArchiMate', () => onPick(undefined))}
      {groups.map((group) => (
        <div key={group}>
          <div className="px-2 pb-0.5 pt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{group}</div>
          {ARCHIMATE_ORDER.filter((t) => ARCHIMATE_TYPES[t].group === group).map((t) =>
            row(t, value === t, ARCHIMATE_TYPES[t].label, ARCHIMATE_TYPES[t], ARCHIMATE_TYPES[t].description, () => onPick(t))
          )}
        </div>
      ))}
    </div>
  )
}

/** Grade só com as miniaturas dos tipos; o nome aparece na dica ao passar o mouse. */
export function RelTypeGrid({
  value,
  onPick
}: {
  value: ArchimateRelType | undefined
  onPick: (value: ArchimateRelType | undefined) => void
}): JSX.Element {
  const options: { key: string; value: ArchimateRelType | undefined; label: string; detail: string; notation: Parameters<typeof NotationPreview>[0] }[] = [
    { key: 'generic', value: undefined, label: 'Genérica', detail: 'Seta simples, sem semântica ArchiMate.', notation: GENERIC_NOTATION },
    ...ARCHIMATE_ORDER.map((t) => ({
      key: t,
      value: t,
      label: ARCHIMATE_TYPES[t].label,
      detail: `${ARCHIMATE_TYPES[t].group} · ${ARCHIMATE_TYPES[t].description}`,
      notation: ARCHIMATE_TYPES[t]
    }))
  ]
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {options.map((o) => {
        const active = o.value === value
        return (
          <Tooltip key={o.key} label={o.label} detail={o.detail}>
            <button
              onClick={() => onPick(o.value)}
              aria-pressed={active}
              className={`flex h-10 items-center justify-center rounded-md border ${
                active ? 'border-sky-400 bg-sky-50 ring-1 ring-sky-400' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
              }`}
            >
              <NotationPreview {...o.notation} />
            </button>
          </Tooltip>
        )
      })}
    </div>
  )
}
