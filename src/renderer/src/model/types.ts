/**
 * Modelo de dados de um repositório.
 *
 * O usuário abre uma pasta com esta estrutura:
 *
 *   aplicações/    um arquivo por recurso (a biblioteca), inclusive endpoints
 *   tecnologias/   um arquivo por tecnologia
 *   relações/      um arquivo por relação (recurso→recurso, recurso→endpoint, recurso→tecnologia)
 *   projetos/      desenhos e documentos, em qualquer estrutura de subpastas
 *
 * Recursos, tecnologias e relações vivem UMA vez; os diagramas guardam apenas
 * referências + posições, além das formas livres (que só existem no desenho).
 */

export const REPO_FOLDERS = {
  resources: 'aplicações',
  technologies: 'tecnologias',
  relations: 'relações',
  projects: 'projetos'
} as const


export type ElementType = 'system' | 'service' | 'database' | 'queue' | 'schema' | 'endpoint'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

/** O que a mudança faz com o item. Ausente = sem alteração. */
export type Impact = 'new' | 'changed' | 'removed'

/** aplicações/<nome>.json — endpoints: aplicações/<servico>--<metodo>-<caminho>.json */
export interface Resource {
  id: string
  type: ElementType
  name: string
  description: string
  owner: string
  impact?: Impact
  /** Somente endpoints. O dono não é um campo: é a ligação de Composição dono → endpoint. */
  method?: HttpMethod
  path?: string
}

/** tecnologias/<nome>.json */
export interface Technology {
  id: string
  name: string
  category: string
  description: string
}

/**
 * relações/<origem>--<destino>.json
 * - `flow`: recurso → recurso ou recurso → endpoint (seta nos desenhos)
 * - `uses`: recurso → tecnologia (etiqueta no recurso)
 */
export type RelationKind = 'flow' | 'uses'

/** Tipos de relacionamento do ArchiMate 3. Ausente = ligação genérica (seta simples). */
export type ArchimateRelType =
  | 'composition'
  | 'aggregation'
  | 'assignment'
  | 'realization'
  | 'serving'
  | 'access'
  | 'influence'
  | 'triggering'
  | 'flow'
  | 'specialization'
  | 'association'

export type AccessMode = 'write' | 'read' | 'readwrite' | 'access'

export interface Relation {
  id: string
  kind: RelationKind
  sourceId: string
  targetId: string
  label: string
  protocol: string
  impact?: Impact
  /** Somente `kind: 'flow'`: tipo ArchiMate da ligação. */
  relType?: ArchimateRelType
  /** Somente acesso: direção do acesso aos dados. */
  accessMode?: AccessMode
  /** Somente influência: força (+, ++, -, --, ou texto livre). */
  strength?: string
  /** Somente associação: se tem direção. */
  directed?: boolean
}

export interface DiagramNode {
  resourceId: string
  x: number
  y: number
  /** Ordem de empilhamento; ausente = 0. */
  z?: number
  /** Travado neste desenho: não se move nem é selecionado. */
  locked?: boolean
  /** Tamanho escolhido pelo usuário neste desenho; ausente = automático. */
  width?: number
  height?: number
}

export type ShapeKind = 'rectangle' | 'rounded' | 'ellipse' | 'text' | 'legend'

/** Forma livre (estilo draw.io): existe só dentro do desenho. */
export interface Shape {
  id: string
  kind: ShapeKind
  x: number
  y: number
  width: number
  height: number
  text: string
  fill: string
  stroke: string
  strokeStyle: 'solid' | 'dashed' | 'none'
  textColor: string
  fontSize: number
  z?: number
  locked?: boolean
}

/** projetos/**\/<nome>.json — a chave do diagrama é o caminho do arquivo. */
export interface Diagram {
  nodes: DiagramNode[]
  /** Ids das relações `flow` exibidas neste desenho. */
  edges: string[]
  shapes: Shape[]
  /**
   * Ponto de conexão escolhido pelo usuário para cada ponta de uma seta (id do
   * conector, ex.: "top-2"). Ausente = escolhido automaticamente.
   */
  anchors?: Record<string, EdgeAnchors>
  /** Ligações só visuais (formas ↔ formas/recursos). Não são relações: não vão para `relações/`. */
  connectors?: Connector[]
}

/** Ligação visual do desenho: liga formas (ou forma e recurso) só para ilustrar. */
export interface Connector {
  id: string
  /** Ids de forma ou de recurso no desenho. */
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
  label?: string
  /** Pontas com seta; ausente = seta no fim. */
  arrow?: 'end' | 'both' | 'none'
  dashed?: boolean
  /** Cor da linha; ausente = cinza. */
  color?: string
}

export interface EdgeAnchors {
  source?: string
  target?: string
}

export type Selection =
  | { kind: 'resource'; id: string }
  | { kind: 'technology'; id: string }
  | { kind: 'relation'; id: string }
  | { kind: 'shape'; id: string }
  | { kind: 'connector'; id: string }
  | null

/** Resultado da leitura da pasta pelo processo principal. */
export interface RepoScan {
  root: string
  dirs: string[]
  files: { path: string; content: string }[]
  /** Nome canônico → nome real da pasta em disco (português ou inglês, como estiver). */
  folders?: Record<string, string>
}

/** Tudo que o Salvar aplica em disco, nesta ordem. */
export interface RepoChanges {
  mkdirs: string[]
  moves: { from: string; to: string }[]
  writes: { path: string; content: string; encoding?: 'base64' }[]
  deletes: string[]
  /** Pastas removidas/renomeadas: apagadas com o que sobrar dentro. */
  rmdirs: string[]
}
