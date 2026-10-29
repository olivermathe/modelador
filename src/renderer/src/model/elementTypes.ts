import { Boxes, Braces, Circle, Database, ListChecks, RectangleHorizontal, Server, Square, Type, Waypoints, Webhook, type LucideIcon } from 'lucide-react'
import type { ElementType, Impact, ShapeKind } from './types'

export interface ElementTypeInfo {
  label: string
  icon: LucideIcon
  hasEndpoints: boolean
}

export const ELEMENT_TYPES: Record<ElementType, ElementTypeInfo> = {
  system: {
    label: 'Sistema',
    icon: Boxes,
    hasEndpoints: true
  },
  service: {
    label: 'Serviço / API',
    icon: Server,
    hasEndpoints: true
  },
  database: {
    label: 'Banco de dados',
    icon: Database,
    hasEndpoints: false
  },
  queue: {
    label: 'Fila / Tópico',
    icon: Waypoints,
    hasEndpoints: false
  },
  schema: {
    // Contrato de dados: payload de API, evento, tabela…
    label: 'Schema',
    icon: Braces,
    hasEndpoints: false
  },
  endpoint: {
    label: 'Endpoint',
    icon: Webhook,
    hasEndpoints: false
  }
}

/** Tipos criados pela paleta (endpoints nascem dentro de um serviço). */
export const ELEMENT_TYPE_ORDER: ElementType[] = ['system', 'service', 'database', 'queue', 'schema']

export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const

/**
 * A única cor dos recursos e ligações no desenho vem do impacto; sem impacto,
 * tudo fica em cinza neutro (o tipo não tem cor, para não confundir).
 */
export const IMPACTS: { value: Impact | undefined; label: string; badge: string; border: string; stroke: string }[] = [
  { value: undefined, label: 'Sem alteração', badge: 'bg-slate-100 text-slate-600', border: 'border-slate-300', stroke: '#94a3b8' },
  { value: 'new', label: 'Novo', badge: 'bg-emerald-500 text-white', border: 'border-emerald-500', stroke: '#10b981' },
  { value: 'changed', label: 'Alterado', badge: 'bg-amber-500 text-white', border: 'border-amber-500', stroke: '#f59e0b' },
  { value: 'removed', label: 'Excluído', badge: 'bg-rose-500 text-white', border: 'border-rose-500', stroke: '#f43f5e' }
]

export const impactInfo = (impact: Impact | undefined): (typeof IMPACTS)[number] =>
  IMPACTS.find((i) => i.value === impact) ?? IMPACTS[0]

export interface ShapeKindInfo {
  label: string
  icon: LucideIcon
  width: number
  height: number
}

export const SHAPE_KINDS: Record<ShapeKind, ShapeKindInfo> = {
  rectangle: { label: 'Retângulo', icon: RectangleHorizontal, width: 200, height: 110 },
  rounded: { label: 'Quadrado', icon: Square, width: 140, height: 140 },
  ellipse: { label: 'Elipse', icon: Circle, width: 160, height: 100 },
  text: { label: 'Texto', icon: Type, width: 180, height: 40 },
  legend: { label: 'Legenda de impacto', icon: ListChecks, width: 190, height: 130 }
}

export const SHAPE_KIND_ORDER: ShapeKind[] = ['rectangle', 'rounded', 'ellipse', 'text', 'legend']

/** Paleta de cores para formas (parecida com a do draw.io). */
export const SHAPE_COLORS = [
  '#ffffff',
  '#f1f5f9',
  '#dae8fc',
  '#d5e8d4',
  '#fff2cc',
  '#f8cecc',
  '#e1d5e7',
  '#ffe6cc',
  '#6c8ebf',
  '#82b366',
  '#d6b656',
  '#b85450',
  '#9673a6',
  '#334155',
  '#000000',
  'transparent'
]
