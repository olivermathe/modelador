import { ARCHIMATE_ORDER, ARCHIMATE_TYPES } from './archimate'
import { ELEMENT_TYPES } from './elementTypes'
import type { ArchimateRelType, ElementType, Relation, Resource } from './types'

/**
 * Meta modelo: que tipos de ligação (ArchiMate) podem ir de cada tipo de recurso para cada outro.
 * Fica em `metamodelo.json`, na raiz do repositório. Sem o arquivo, qualquer ligação é aceita.
 */
export interface Metamodel {
  /** Tipo de origem → tipo de destino → tipos de ligação aceitos. Par ausente = nenhuma ligação. */
  relations: Partial<Record<ElementType, Partial<Record<ElementType, ArchimateRelType[]>>>>
}

export const METAMODEL_FILE = 'metamodelo.json'

/** Linhas e colunas da tabela do meta modelo. */
export const METAMODEL_TYPES: ElementType[] = ['system', 'service', 'database', 'queue', 'schema', 'endpoint']

/** Composição dono → endpoint é a ligação que diz de quem é o endpoint: sempre aceita. */
export const isFixedRule = (source: ElementType, target: ElementType, relType: ArchimateRelType): boolean =>
  relType === 'composition' && target === 'endpoint' && ELEMENT_TYPES[source].hasEndpoints

/** Tipos aceitos de `source` para `target`, na ordem da paleta. */
export function allowedTypes(mm: Metamodel, source: ElementType, target: ElementType): ArchimateRelType[] {
  const listed = new Set(mm.relations[source]?.[target] ?? [])
  return ARCHIMATE_ORDER.filter((t) => listed.has(t) || isFixedRule(source, target, t))
}

/**
 * A ligação respeita o meta modelo? A genérica (tipo ainda não escolhido) vale quando o par aceita
 * algum tipo. Sem meta modelo, ligações com tecnologia ou com ponta removida: sempre vale.
 */
export function relationAllowed(
  mm: Metamodel | null,
  resources: Record<string, Resource>,
  rel: Pick<Relation, 'kind' | 'sourceId' | 'targetId' | 'relType'>
): boolean {
  const source = resources[rel.sourceId]
  const target = resources[rel.targetId]
  if (!mm || rel.kind !== 'flow' || !source || !target) return true
  const allowed = allowedTypes(mm, source.type, target.type)
  return rel.relType ? allowed.includes(rel.relType) : allowed.length > 0
}

/** Ligações que o meta modelo não aceita (ex.: tipo de recurso mudou, arquivo editado à mão). */
export function violations(mm: Metamodel | null, resources: Record<string, Resource>, relations: Record<string, Relation>): Relation[] {
  if (!mm) return []
  return Object.values(relations).filter((r) => !relationAllowed(mm, resources, r))
}

/** Por que a ligação não é aceita, para avisos ("Serviço / API → Schema não aceita Serve."). */
export function ruleMessage(mm: Metamodel, source: ElementType, target: ElementType, relType: ArchimateRelType | undefined): string {
  const pair = `${ELEMENT_TYPES[source].label} → ${ELEMENT_TYPES[target].label}`
  const allowed = allowedTypes(mm, source, target)
  if (!allowed.length) return `O meta modelo não permite ligações ${pair}.`
  const list = allowed.map((t) => ARCHIMATE_TYPES[t].label).join(', ')
  return `O meta modelo não permite ${relType ? ARCHIMATE_TYPES[relType].label : 'essa ligação'} em ${pair}. Aceitos: ${list}.`
}

export function setRule(mm: Metamodel, source: ElementType, target: ElementType, types: ArchimateRelType[]): Metamodel {
  return { ...mm, relations: { ...mm.relations, [source]: { ...mm.relations[source], [target]: types } } }
}

/** Lê o arquivo, descartando tipos desconhecidos (o resto do arquivo é regravado como o app entende). */
export function parseMetamodel(data: unknown): Metamodel {
  const relations: Metamodel['relations'] = {}
  const raw = typeof data === 'object' && data !== null ? (data as Record<string, unknown>).relations : undefined
  if (typeof raw !== 'object' || raw === null) return { relations }
  for (const [source, targets] of Object.entries(raw)) {
    if (!METAMODEL_TYPES.includes(source as ElementType) || typeof targets !== 'object' || targets === null) continue
    for (const [target, types] of Object.entries(targets)) {
      if (!METAMODEL_TYPES.includes(target as ElementType) || !Array.isArray(types)) continue
      const valid = ARCHIMATE_ORDER.filter((t) => types.includes(t))
      relations[source as ElementType] = { ...relations[source as ElementType], [target]: valid }
    }
  }
  return { relations }
}

/** Formato gravado: só pares com algum tipo, na ordem da tabela (Salvar não regrava à toa). */
export function metamodelToSave(mm: Metamodel): Metamodel {
  const relations: Metamodel['relations'] = {}
  for (const source of METAMODEL_TYPES) {
    for (const target of METAMODEL_TYPES) {
      const types = ARCHIMATE_ORDER.filter((t) => mm.relations[source]?.[target]?.includes(t))
      if (types.length) relations[source] = { ...relations[source], [target]: types }
    }
  }
  return { relations }
}

/**
 * Ponto de partida inspirado na tabela de relações do ArchiMate 3, com Sistema e Serviço como
 * componentes de aplicação, Endpoint como interface e Banco, Fila e Schema como dados.
 */
export function suggestedMetamodel(): Metamodel {
  const app: ElementType[] = ['system', 'service']
  const active: ElementType[] = [...app, 'endpoint']
  const stores: ElementType[] = ['database', 'queue']
  const data: ElementType[] = [...stores, 'schema']
  const rules: [ElementType[], ElementType[], ArchimateRelType[]][] = [
    [app, [...app, 'endpoint'], ['composition', 'aggregation', 'realization', 'serving', 'flow', 'triggering', 'association']],
    [['endpoint'], active, ['serving', 'flow', 'triggering', 'association']],
    [active, data, ['access', 'association']],
    [app, stores, ['composition', 'aggregation', 'flow', 'triggering']],
    [['endpoint'], ['queue'], ['flow', 'triggering']],
    [stores, active, ['serving', 'flow', 'triggering', 'association']],
    [stores, stores, ['aggregation', 'flow', 'association']],
    [data, data, ['composition', 'aggregation', 'association']],
    [['schema'], active, ['association']]
  ]
  let mm: Metamodel = { relations: {} }
  const add = (s: ElementType, t: ElementType, types: ArchimateRelType[]): void => {
    mm = setRule(mm, s, t, [...new Set([...(mm.relations[s]?.[t] ?? []), ...types])])
  }
  for (const [sources, targets, types] of rules) for (const s of sources) for (const t of targets) add(s, t, types)
  // Especialização só entre recursos do mesmo tipo
  for (const t of METAMODEL_TYPES) add(t, t, ['specialization'])
  return metamodelToSave(mm)
}
