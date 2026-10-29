import type { ElementType, ShapeKind } from '@/model/types'

/** Conteúdo arrastado da barra lateral para o canvas. */
export type DragPayload =
  | { kind: 'new'; type: ElementType }
  | { kind: 'shape'; shape: ShapeKind }
  | { kind: 'resource'; id: string }
  | { kind: 'technology'; id: string }

export const DND_MIME = 'application/x-modelador'

export function setDragPayload(event: React.DragEvent, payload: DragPayload): void {
  event.dataTransfer.setData(DND_MIME, JSON.stringify(payload))
  event.dataTransfer.effectAllowed = 'copy'
}

export function getDragPayload(event: React.DragEvent): DragPayload | null {
  const raw = event.dataTransfer.getData(DND_MIME)
  if (!raw) return null
  try {
    return JSON.parse(raw) as DragPayload
  } catch {
    return null
  }
}

/** Pontos de conexão de um recurso: 5 em cima e embaixo, 3 nas laterais. */
export const ANCHOR_POINTS: { id: string; side: 'top' | 'right' | 'bottom' | 'left'; offset: number }[] = [
  ...[1, 2, 3, 4, 5].flatMap((i) => [
    { id: `top-${i}`, side: 'top' as const, offset: (i * 100) / 6 },
    { id: `bottom-${i}`, side: 'bottom' as const, offset: (i * 100) / 6 }
  ]),
  ...[1, 2, 3].flatMap((i) => [
    { id: `left-${i}`, side: 'left' as const, offset: i * 25 },
    { id: `right-${i}`, side: 'right' as const, offset: i * 25 }
  ])
]

/** Ponto central de um lado, usado quando o usuário não escolheu um ponto. */
export const centerAnchor = (side: Side): string =>
  side === 'top' || side === 'bottom' ? `${side}-3` : `${side}-2`

export type Side = 'top' | 'right' | 'bottom' | 'left'

/** Ponto livre na borda: `<lado>@<porcentagem>` (ex.: `top@37`, a 37% da largura, no lado de cima). */
const FREE_ANCHOR = /^(top|right|bottom|left)@(\d{1,3})$/

export const freeAnchorId = (side: Side, offset: number): string =>
  `${side}@${Math.min(100, Math.max(0, Math.round(offset)))}`

/** Lado e posição (0–100%) de um ponto fixo ou livre. */
export function parseAnchor(id: string | null | undefined): { side: Side; offset: number } | undefined {
  if (!id) return undefined
  const fixed = ANCHOR_POINTS.find((a) => a.id === id)
  if (fixed) return { side: fixed.side, offset: fixed.offset }
  const m = FREE_ANCHOR.exec(id)
  return m && Number(m[2]) <= 100 ? { side: m[1] as Side, offset: Number(m[2]) } : undefined
}

export const isAnchorId = (id: string | null | undefined): id is string => !!parseAnchor(id)

export const isFreeAnchor = (id: string | null | undefined): id is string => !!id && FREE_ANCHOR.test(id)

/** Faixas invisíveis ao longo das bordas: começar uma ligação em qualquer ponto da borda. */
export const BORDER_HANDLES: { id: string; side: Side }[] = (['top', 'right', 'bottom', 'left'] as const).map(
  (side) => ({ id: `border-${side}`, side })
)

export const isBorderHandle = (id: string | null | undefined): boolean => !!id?.startsWith('border-')

/**
 * Ponto da borda mais perto de (x, y), em coordenadas de tela, dentro do retângulo `r`.
 * Perto de um ponto fixo (até 3%), usa o fixo.
 */
export function anchorAt(r: DOMRect, x: number, y: number): string {
  const dist: Record<Side, number> = {
    top: Math.abs(y - r.top),
    bottom: Math.abs(r.bottom - y),
    left: Math.abs(x - r.left),
    right: Math.abs(r.right - x)
  }
  const side = (Object.keys(dist) as Side[]).reduce((a, b) => (dist[b] < dist[a] ? b : a))
  const offset =
    side === 'top' || side === 'bottom' ? ((x - r.left) / r.width) * 100 : ((y - r.top) / r.height) * 100
  const id = freeAnchorId(side, offset)
  const near = ANCHOR_POINTS.find((a) => a.side === side && Math.abs(a.offset - parseAnchor(id)!.offset) <= 3)
  return near ? near.id : id
}
