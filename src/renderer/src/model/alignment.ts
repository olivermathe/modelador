/** Retângulo de um item do desenho, em coordenadas do desenho. */
export interface Rect {
  id: string
  x: number
  y: number
  w: number
  h: number
}

export interface Guides {
  /** Linhas verticais: x fixo, de y1 a y2. */
  v: { x: number; y1: number; y2: number }[]
  /** Linhas horizontais: y fixo, de x1 a x2. */
  h: { y: number; x1: number; x2: number }[]
}

export const NO_GUIDES: Guides = { v: [], h: [] }

/** Bordas e centro de um retângulo num eixo: início, meio, fim. */
const xs = (r: Rect): number[] => [r.x, r.x + r.w / 2, r.x + r.w]
const ys = (r: Rect): number[] => [r.y, r.y + r.h / 2, r.y + r.h]

/** Menor ajuste que encaixa alguma linha de `mine` numa linha de `theirs`. */
function bestOffset(mine: number[], others: number[][], threshold: number): number {
  let best = 0
  let bestDist = threshold
  for (const theirs of others) {
    for (const a of mine) {
      for (const b of theirs) {
        const d = Math.abs(b - a)
        if (d < bestDist) {
          bestDist = d
          best = b - a
        }
      }
    }
  }
  return best
}

/**
 * Encaixa `moving` nas bordas/centros dos outros itens quando estão a menos de
 * `threshold` e devolve a posição ajustada + as linhas-guia a desenhar.
 */
export function snapToGuides(moving: Rect, others: Rect[], threshold: number): { x: number; y: number; guides: Guides } {
  const x = moving.x + bestOffset(xs(moving), others.map(xs), threshold)
  const y = moving.y + bestOffset(ys(moving), others.map(ys), threshold)
  const snapped = { ...moving, x, y }

  const v = new Map<number, { y1: number; y2: number }>()
  const h = new Map<number, { x1: number; x2: number }>()
  const extend = <T extends Record<string, number>>(map: Map<number, T>, key: number, span: T, lo: keyof T, hi: keyof T): void => {
    const cur = map.get(key)
    if (!cur) return void map.set(key, span)
    cur[lo] = Math.min(cur[lo], span[lo]) as T[keyof T]
    cur[hi] = Math.max(cur[hi], span[hi]) as T[keyof T]
  }

  for (const other of others) {
    for (const a of xs(snapped)) {
      if (xs(other).some((b) => Math.abs(a - b) < 0.5)) {
        const key = Math.round(a * 2) / 2
        extend(v, key, { y1: Math.min(snapped.y, other.y), y2: Math.max(snapped.y + snapped.h, other.y + other.h) }, 'y1', 'y2')
      }
    }
    for (const a of ys(snapped)) {
      if (ys(other).some((b) => Math.abs(a - b) < 0.5)) {
        const key = Math.round(a * 2) / 2
        extend(h, key, { x1: Math.min(snapped.x, other.x), x2: Math.max(snapped.x + snapped.w, other.x + other.w) }, 'x1', 'x2')
      }
    }
  }

  return {
    x,
    y,
    guides: {
      v: [...v].map(([gx, span]) => ({ x: gx, ...span })),
      h: [...h].map(([gy, span]) => ({ y: gy, ...span }))
    }
  }
}
