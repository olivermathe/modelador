import type { MarkerKind } from '@/model/archimate'
import { IMPACTS } from '@/model/elementTypes'

/** Cores em que as pontas existem: as de impacto + a de seleção. */
export const SELECTED_STROKE = '#0ea5e9'
const COLORS = [...new Set([...IMPACTS.map((i) => i.stroke), SELECTED_STROKE])]

export const markerId = (kind: MarkerKind, color: string): string => `am-${kind}-${color.replace('#', '')}`

/** Desenho de cada ponta, com a ponta em x=18, y=10. */
function MarkerShape({ kind, color }: { kind: MarkerKind; color: string }): JSX.Element {
  switch (kind) {
    case 'arrow-filled':
      return <path d="M3,4 L18,10 L3,16 z" fill={color} stroke={color} strokeWidth={1} />
    case 'arrow-open':
    case 'arrow-small':
      return <path d="M5,4 L18,10 L5,16" fill="none" stroke={color} strokeWidth={1.8} strokeLinejoin="miter" />
    case 'triangle-open':
      return <path d="M3,3 L18,10 L3,17 z" fill="#ffffff" stroke={color} strokeWidth={1.5} />
    case 'diamond-filled':
      return <path d="M2,10 L10,5 L18,10 L10,15 z" fill={color} stroke={color} strokeWidth={1} />
    case 'diamond-open':
      return <path d="M2,10 L10,5 L18,10 L10,15 z" fill="#ffffff" stroke={color} strokeWidth={1.5} />
    case 'dot':
      return <circle cx={13} cy={10} r={4.5} fill={color} />
    case 'half-arrow':
      return <path d="M5,4 L18,10" fill="none" stroke={color} strokeWidth={1.8} />
  }
}

const KINDS: MarkerKind[] = [
  'arrow-filled',
  'arrow-open',
  'arrow-small',
  'triangle-open',
  'diamond-filled',
  'diamond-open',
  'dot',
  'half-arrow'
]

/**
 * Definições SVG das pontas de linha do ArchiMate. Com `auto-start-reverse`
 * a mesma ponta serve no início (losango, bolinha) e no fim da linha.
 */
export function ArchimateMarkers(): JSX.Element {
  return (
    <svg style={{ position: 'absolute', width: 0, height: 0 }} aria-hidden>
      <defs>
        {COLORS.flatMap((color) =>
          KINDS.map((kind) => {
            const size = kind === 'arrow-small' ? 10 : 15
            return (
              <marker
                key={markerId(kind, color)}
                id={markerId(kind, color)}
                viewBox="0 0 20 20"
                refX={18}
                refY={10}
                markerWidth={size}
                markerHeight={size}
                markerUnits="userSpaceOnUse"
                orient="auto-start-reverse"
              >
                <MarkerShape kind={kind} color={color} />
              </marker>
            )
          })
        )}
      </defs>
    </svg>
  )
}

/** Miniatura da notação, para o seletor de tipo. */
export function NotationPreview({
  dash,
  start,
  end
}: {
  dash?: string
  start?: MarkerKind
  end?: MarkerKind
}): JSX.Element {
  const color = COLORS[0]
  return (
    <svg width={52} height={18} viewBox="0 0 52 18" className="shrink-0 overflow-visible">
      <line
        x1={4}
        y1={9}
        x2={48}
        y2={9}
        stroke={color}
        strokeWidth={1.5}
        strokeDasharray={dash}
        markerStart={start ? `url(#${markerId(start, color)})` : undefined}
        markerEnd={end ? `url(#${markerId(end, color)})` : undefined}
      />
    </svg>
  )
}
