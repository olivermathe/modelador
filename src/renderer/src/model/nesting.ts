import type { Rect } from './alignment'

/** O centro de `inner` cai dentro de `outer`? */
export function centerInside(inner: Rect, outer: Rect): boolean {
  const cx = inner.x + inner.w / 2
  const cy = inner.y + inner.h / 2
  return cx >= outer.x && cx <= outer.x + outer.w && cy >= outer.y && cy <= outer.y + outer.h
}

/**
 * Um recurso está "dentro" (ou em cima) do outro quando o centro de um cai na
 * caixa do outro. Nesse caso as ligações entre os dois não são desenhadas: o
 * aninhamento já mostra a relação, como no ArchiMate. As ligações continuam
 * existindo no repositório.
 */
export function areNested(a: Rect, b: Rect): boolean {
  return centerInside(a, b) || centerInside(b, a)
}

/** Recursos que contêm `inner` (o centro dele cai dentro e eles são maiores). */
export function containersOf(inner: Rect, rects: Rect[]): Rect[] {
  return rects.filter((r) => r.id !== inner.id && r.w * r.h > inner.w * inner.h && centerInside(inner, r))
}

/** Recursos aninhados com `id` (o maior fica por fora). */
export function nestedWith(id: string, rects: Rect[]): Rect[] {
  const me = rects.find((r) => r.id === id)
  return me ? rects.filter((r) => r.id !== id && areNested(me, r)) : []
}
