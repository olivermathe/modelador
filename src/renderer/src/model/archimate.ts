import type { AccessMode, ArchimateRelType, Relation } from './types'

/** Pontas de linha usadas pela notação ArchiMate. */
export type MarkerKind =
  | 'arrow-filled'
  | 'arrow-open'
  | 'arrow-small'
  | 'triangle-open'
  | 'diamond-filled'
  | 'diamond-open'
  | 'dot'
  | 'half-arrow'

export interface ArchimateTypeInfo {
  label: string
  /** Categoria da especificação ArchiMate 3. */
  group: 'Estrutural' | 'Dependência' | 'Dinâmica' | 'Outra'
  description: string
  dash?: string
  start?: MarkerKind
  end?: MarkerKind
}

export const ARCHIMATE_TYPES: Record<ArchimateRelType, ArchimateTypeInfo> = {
  composition: {
    label: 'Composição',
    group: 'Estrutural',
    description: 'O elemento é composto pelo outro (a parte não existe sem o todo).',
    start: 'diamond-filled'
  },
  aggregation: {
    label: 'Agregação',
    group: 'Estrutural',
    description: 'O elemento agrupa o outro (a parte pode existir sozinha).',
    start: 'diamond-open'
  },
  assignment: {
    label: 'Atribuição',
    group: 'Estrutural',
    description: 'Quem executa ou é responsável pelo comportamento.',
    start: 'dot',
    end: 'arrow-filled'
  },
  realization: {
    label: 'Realização',
    group: 'Estrutural',
    description: 'O elemento concretiza o outro, mais abstrato.',
    dash: '5 4',
    end: 'triangle-open'
  },
  serving: {
    label: 'Serve',
    group: 'Dependência',
    description: 'Fornece funcionalidade para o outro (o servidor aponta para quem usa).',
    end: 'arrow-open'
  },
  access: {
    label: 'Acesso',
    group: 'Dependência',
    description: 'Comportamento lê ou grava um objeto de dados.',
    dash: '1.5 3',
    end: 'arrow-small'
  },
  influence: {
    label: 'Influência',
    group: 'Dependência',
    description: 'Afeta a motivação ou a implementação do outro (+/−).',
    dash: '7 4',
    end: 'arrow-open'
  },
  triggering: {
    label: 'Disparo',
    group: 'Dinâmica',
    description: 'Um comportamento dispara o outro (relação temporal ou causal).',
    end: 'arrow-filled'
  },
  flow: {
    label: 'Fluxo',
    group: 'Dinâmica',
    description: 'Transferência de dados, valor ou informação para o outro.',
    dash: '7 4',
    end: 'arrow-filled'
  },
  specialization: {
    label: 'Especialização',
    group: 'Outra',
    description: 'O elemento é um tipo particular do outro.',
    end: 'triangle-open'
  },
  association: {
    label: 'Associação',
    group: 'Outra',
    description: 'Relação genérica, sem semântica específica.'
  }
}

export const ARCHIMATE_ORDER: ArchimateRelType[] = [
  'composition',
  'aggregation',
  'assignment',
  'realization',
  'serving',
  'access',
  'influence',
  'triggering',
  'flow',
  'specialization',
  'association'
]

export const ACCESS_MODES: { value: AccessMode; label: string }[] = [
  { value: 'write', label: 'Grava' },
  { value: 'read', label: 'Lê' },
  { value: 'readwrite', label: 'Lê e grava' },
  { value: 'access', label: 'Sem direção' }
]

/** Ligação genérica (antes do tipo ArchiMate ser escolhido): seta cheia simples. */
const GENERIC: Pick<ArchimateTypeInfo, 'dash' | 'start' | 'end'> = { end: 'arrow-filled' }

/** Traço e pontas que a relação deve ter no desenho. */
export function relationNotation(rel: Relation): { dash?: string; start?: MarkerKind; end?: MarkerKind } {
  if (!rel.relType) return GENERIC
  const info = ARCHIMATE_TYPES[rel.relType]
  if (rel.relType === 'access') {
    const mode = rel.accessMode ?? 'write'
    return {
      dash: info.dash,
      start: mode === 'read' || mode === 'readwrite' ? 'arrow-small' : undefined,
      end: mode === 'write' || mode === 'readwrite' ? 'arrow-small' : undefined
    }
  }
  if (rel.relType === 'association') return { end: rel.directed ? 'half-arrow' : undefined }
  return info
}

export function relationTypeLabel(rel: Relation): string {
  return rel.relType ? ARCHIMATE_TYPES[rel.relType].label : 'Genérica'
}
