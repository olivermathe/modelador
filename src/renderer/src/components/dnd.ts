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
export const centerAnchor = (side: 'top' | 'right' | 'bottom' | 'left'): string =>
  side === 'top' || side === 'bottom' ? `${side}-3` : `${side}-2`

export const isAnchorId = (id: string | null | undefined): id is string =>
  !!id && ANCHOR_POINTS.some((a) => a.id === id)
