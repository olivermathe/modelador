import { ARCHIMATE_TYPES } from './archimate'
import {
  REPO_FOLDERS,
  type AccessMode,
  type ArchimateRelType,
  type Diagram,
  type HttpMethod,
  type Impact,
  type Relation,
  type RepoChanges,
  type RepoScan,
  type Resource,
  type Shape,
  type Technology
} from './types'

/** Conteúdo do repositório em memória. */
export interface RepoContent {
  resources: Record<string, Resource>
  technologies: Record<string, Technology>
  relations: Record<string, Relation>
  /** Chave = caminho relativo (ex.: projetos/pagamentos/visao-geral.json). */
  diagrams: Record<string, Diagram>
  /** Documentos Markdown: caminho → texto. */
  docs: Record<string, string>
  /** Caminho em disco de cada recurso/tecnologia/relação já salvo. */
  paths: Record<string, string>
  /** Arquivos que não são entidades reconhecidas: aparecem na árvore, só são movidos/apagados com a pasta. */
  otherFiles: string[]
  /**
   * Arquivos copiados (ex.: de uma pasta modelo) ainda não gravados: caminho → conteúdo em base64.
   * Aparecem como `otherFiles` e são gravados como estão no próximo Salvar.
   */
  pendingFiles: Record<string, string>
  /** Pastas como devem ficar em disco depois de salvar. */
  dirs: string[]
}

/** Estado do disco na última leitura/gravação, para calcular o que salvar. */
export interface DiskSnapshot {
  files: Record<string, string>
  dirs: string[]
  /** Arquivos não reconhecidos que precisam ser movidos (pasta renomeada). */
  moves: { from: string; to: string }[]
}

export function slugify(text: string): string {
  return (
    text
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'sem-nome'
  )
}

export function fileStem(path: string): string {
  return (path.split('/').pop() ?? path).replace(/\.(json|md)$/i, '')
}

export const isDoc = (path: string): boolean => /\.md$/i.test(path)

/** Extensão do arquivo, com o ponto (".json", ".md"); vazia para pastas. */
export function fileExt(path: string): string {
  return /\.(json|md)$/i.exec(path)?.[0] ?? ''
}

export function parentDir(path: string): string {
  return path.split('/').slice(0, -1).join('/')
}

/** `path` está dentro de `dir` (ou é o próprio)? */
export function isInside(path: string, dir: string): boolean {
  return path === dir || path.startsWith(dir + '/')
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null

const IMPACTS: Impact[] = ['new', 'changed', 'removed']
const parseImpact = (v: unknown): Impact | undefined => (IMPACTS.includes(v as Impact) ? (v as Impact) : undefined)

const METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
const parseMethod = (v: unknown): HttpMethod => (METHODS.includes(v as HttpMethod) ? (v as HttpMethod) : 'GET')

export function endpointName(method: string | undefined, path: string | undefined): string {
  return `${method ?? 'GET'} ${path ?? '/'}`
}

function parseShape(s: Record<string, unknown>): Shape {
  return {
    id: String(s.id ?? crypto.randomUUID()),
    kind: (['rectangle', 'rounded', 'ellipse', 'text'] as const).find((k) => k === s.kind) ?? 'rectangle',
    x: Number(s.x) || 0,
    y: Number(s.y) || 0,
    width: Number(s.width) || 160,
    height: Number(s.height) || 80,
    text: String(s.text ?? ''),
    fill: String(s.fill ?? '#ffffff'),
    stroke: String(s.stroke ?? '#334155'),
    strokeStyle: s.strokeStyle === 'dashed' || s.strokeStyle === 'none' ? s.strokeStyle : 'solid',
    textColor: String(s.textColor ?? '#0f172a'),
    fontSize: Number(s.fontSize) || 14,
    ...(typeof s.z === 'number' ? { z: s.z } : {}),
    ...(s.locked === true ? { locked: true } : {})
  }
}

/** Converte a leitura da pasta no conteúdo em memória + snapshot do que está em disco. */
export function parseScan(scan: RepoScan): { content: RepoContent; snapshot: DiskSnapshot } {
  const content: RepoContent = {
    resources: {},
    technologies: {},
    relations: {},
    diagrams: {},
    docs: {},
    paths: {},
    otherFiles: [],
    pendingFiles: {},
    dirs: scan.dirs
  }
  const files: Record<string, string> = {}
  /** Formato antigo: dono do endpoint num campo (`parentId`); vira ligação de Composição. */
  const legacyOwners: { endpointId: string; ownerId: string }[] = []

  for (const file of scan.files) {
    let data: unknown
    try {
      data = file.path.endsWith('.json') ? JSON.parse(file.content) : undefined
    } catch {
      data = undefined
    }
    const folder = file.path.split('/')[0]
    let recognized = true

    if (isDoc(file.path)) {
      content.docs[file.path] = file.content
    } else if (folder === REPO_FOLDERS.resources && isObject(data) && typeof data.id === 'string') {
      const resource: Resource = {
        id: data.id,
        type: (data.type as Resource['type']) ?? 'system',
        name: String(data.name ?? fileStem(file.path)),
        description: String(data.description ?? ''),
        owner: String(data.owner ?? '')
      }
      const impact = parseImpact(data.impact)
      if (impact) resource.impact = impact
      if (resource.type === 'endpoint') {
        if (typeof data.parentId === 'string' && data.parentId) legacyOwners.push({ endpointId: resource.id, ownerId: data.parentId })
        resource.method = parseMethod(data.method)
        resource.path = String(data.path ?? '/')
        resource.name = endpointName(resource.method, resource.path)
      }
      content.resources[resource.id] = resource
      content.paths[resource.id] = file.path

      // Formato antigo: endpoints dentro do serviço viram recursos próprios
      if (Array.isArray(data.endpoints)) {
        for (const ep of data.endpoints.filter(isObject)) {
          const id = crypto.randomUUID()
          const method = parseMethod(ep.method)
          const path = String(ep.path ?? '/')
          content.resources[id] = {
            id,
            type: 'endpoint',
            name: endpointName(method, path),
            description: String(ep.description ?? ''),
            owner: resource.owner,
            method,
            path
          }
          legacyOwners.push({ endpointId: id, ownerId: resource.id })
        }
      }
    } else if (folder === REPO_FOLDERS.technologies && isObject(data) && typeof data.id === 'string') {
      content.technologies[data.id] = {
        id: data.id,
        name: String(data.name ?? fileStem(file.path)),
        category: String(data.category ?? ''),
        description: String(data.description ?? '')
      }
      content.paths[data.id] = file.path
    } else if (
      folder === REPO_FOLDERS.relations &&
      isObject(data) &&
      typeof data.id === 'string' &&
      typeof data.sourceId === 'string' &&
      typeof data.targetId === 'string'
    ) {
      const relation: Relation = {
        id: data.id,
        kind: data.kind === 'uses' ? 'uses' : 'flow',
        sourceId: data.sourceId,
        targetId: data.targetId,
        label: String(data.label ?? ''),
        protocol: String(data.protocol ?? '')
      }
      const impact = parseImpact(data.impact)
      if (impact) relation.impact = impact
      if (typeof data.relType === 'string' && data.relType in ARCHIMATE_TYPES) {
        relation.relType = data.relType as ArchimateRelType
      }
      if (['write', 'read', 'readwrite', 'access'].includes(data.accessMode as string)) {
        relation.accessMode = data.accessMode as AccessMode
      }
      if (typeof data.strength === 'string' && data.strength) relation.strength = data.strength
      if (data.directed === true) relation.directed = true
      content.relations[relation.id] = relation
      content.paths[relation.id] = file.path
    } else if (folder === REPO_FOLDERS.projects && isObject(data) && Array.isArray(data.nodes)) {
      content.diagrams[file.path] = {
        nodes: (data.nodes as unknown[]).filter(isObject).map((n) => ({
          resourceId: String(n.resourceId),
          x: Number(n.x) || 0,
          y: Number(n.y) || 0,
          ...(typeof n.z === 'number' ? { z: n.z } : {}),
          ...(typeof n.width === 'number' && typeof n.height === 'number' ? { width: n.width, height: n.height } : {}),
          ...(n.locked === true ? { locked: true } : {})
        })),
        edges: Array.isArray(data.edges) ? data.edges.map(String) : [],
        shapes: Array.isArray(data.shapes) ? data.shapes.filter(isObject).map(parseShape) : [],
        ...(isObject(data.anchors) && Object.keys(data.anchors).length
          ? { anchors: data.anchors as Diagram['anchors'] }
          : {})
      }
    } else {
      recognized = false
      content.otherFiles.push(file.path)
    }

    if (recognized) files[file.path] = file.content
  }

  // Dono antigo vira ligação de Composição dono → endpoint (gravada no próximo Salvar)
  for (const { endpointId, ownerId } of legacyOwners) {
    if (!content.resources[ownerId]) continue
    const linked = Object.values(content.relations).some(
      (r) => r.kind === 'flow' && r.sourceId === ownerId && r.targetId === endpointId && r.relType === 'composition'
    )
    if (linked) continue
    const id = crypto.randomUUID()
    content.relations[id] = { id, kind: 'flow', relType: 'composition', sourceId: ownerId, targetId: endpointId, label: '', protocol: '' }
  }

  return { content, snapshot: { files, dirs: scan.dirs, moves: [] } }
}

/**
 * Decide o caminho de cada entidade a partir do nome. Mantém o caminho atual
 * enquanto o nome não muda, e renomeia o arquivo quando muda.
 */
function assignPaths<T extends { id: string }>(
  entities: T[],
  folder: string,
  slugOf: (e: T) => string,
  prevPaths: Record<string, string>,
  taken: Set<string>,
  out: Record<string, string>
): void {
  const pending: T[] = []
  for (const e of entities) {
    const prev = prevPaths[e.id]
    const base = slugOf(e)
    if (prev && new RegExp(`^${base}(-\\d+)?$`).test(fileStem(prev)) && !taken.has(prev)) {
      out[e.id] = prev
      taken.add(prev)
    } else {
      pending.push(e)
    }
  }
  for (const e of pending) {
    const base = slugOf(e)
    // Novos arquivos ficam na mesma subpasta do antigo, se houver
    const dir = prevPaths[e.id] ? parentDir(prevPaths[e.id]) : folder
    let path = `${dir}/${base}.json`
    for (let i = 2; taken.has(path); i++) path = `${dir}/${base}-${i}.json`
    out[e.id] = path
    taken.add(path)
  }
}

const toJson = (data: unknown): string => JSON.stringify(data, null, 2) + '\n'

/** Caminho em disco que cada recurso/tecnologia/relação terá ao salvar. */
export function computePaths(c: RepoContent): Record<string, string> {
  const taken = new Set([...c.otherFiles, ...Object.keys(c.diagrams), ...Object.keys(c.docs)])
  const paths: Record<string, string> = {}
  const nameOf = (id: string): string => c.resources[id]?.name ?? c.technologies[id]?.name ?? 'removido'
  // Endpoint: prefixo do dono (ligação de Composição), para o arquivo ficar perto do serviço na pasta
  const ownerOf = (endpointId: string): string | undefined =>
    Object.values(c.relations)
      .filter((r) => r.kind === 'flow' && r.targetId === endpointId && r.relType === 'composition' && c.resources[r.sourceId])
      .map((r) => c.resources[r.sourceId].name)
      .sort((a, b) => a.localeCompare(b, 'pt-BR'))[0]
  const resourceSlug = (r: Resource): string => {
    const owner = r.type === 'endpoint' ? ownerOf(r.id) : undefined
    return owner ? `${slugify(owner)}--${slugify(r.name)}` : slugify(r.name)
  }

  const sortById = <T extends { id: string }>(r: Record<string, T>): T[] =>
    Object.values(r).sort((a, b) => a.id.localeCompare(b.id))

  assignPaths(sortById(c.resources), REPO_FOLDERS.resources, resourceSlug, c.paths, taken, paths)
  assignPaths(sortById(c.technologies), REPO_FOLDERS.technologies, (t) => slugify(t.name), c.paths, taken, paths)
  assignPaths(
    sortById(c.relations),
    REPO_FOLDERS.relations,
    (r) => `${slugify(nameOf(r.sourceId))}--${r.kind === 'uses' ? 'usa--' : ''}${slugify(nameOf(r.targetId))}`,
    c.paths,
    taken,
    paths
  )
  return paths
}

function anchorsToSave(d: Diagram): Diagram['anchors'] {
  const kept = Object.entries(d.anchors ?? {}).filter(([id, a]) => d.edges.includes(id) && (a.source || a.target))
  return kept.length ? Object.fromEntries(kept) : undefined
}

/** Gera o conteúdo de todos os arquivos que o estado atual representa. */
export function computeFiles(c: RepoContent): { files: Record<string, string>; paths: Record<string, string> } {
  const paths = computePaths(c)
  const files: Record<string, string> = {}
  for (const r of Object.values(c.resources)) files[paths[r.id]] = toJson(r)
  for (const t of Object.values(c.technologies)) files[paths[t.id]] = toJson(t)
  for (const r of Object.values(c.relations)) files[paths[r.id]] = toJson(r)
  for (const [path, d] of Object.entries(c.diagrams)) {
    files[path] = toJson({
      nodes: d.nodes.map((n) => ({
        resourceId: n.resourceId,
        x: Math.round(n.x),
        y: Math.round(n.y),
        z: n.z,
        width: n.width && Math.round(n.width),
        height: n.height && Math.round(n.height),
        locked: n.locked || undefined
      })),
      edges: d.edges,
      // Só grava formas quando há alguma, para não mexer em desenhos antigos
      shapes: d.shapes.length
        ? d.shapes.map((s) => ({ ...s, x: Math.round(s.x), y: Math.round(s.y), width: Math.round(s.width), height: Math.round(s.height) }))
        : undefined,
      // Só pontos de conexão escolhidos manualmente, e só de setas que estão no desenho
      anchors: anchorsToSave(d)
    })
  }
  for (const [path, text] of Object.entries(c.docs)) files[path] = text
  return { files, paths }
}

/** JSON com o mesmo conteúdo, ignorando ordem das chaves e formatação? */
export function sameJson(a: string | undefined, b: string): boolean {
  if (a === undefined) return false
  if (a === b) return true
  const canonical = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(canonical)
      : isObject(v)
        ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canonical(v[k])]))
        : v
  try {
    return JSON.stringify(canonical(JSON.parse(a))) === JSON.stringify(canonical(JSON.parse(b)))
  } catch {
    return false
  }
}

/** O que precisa mudar em disco para refletir o estado em memória. */
export function diffRepo(snapshot: DiskSnapshot, files: Record<string, string>, dirs: string[]): RepoChanges {
  const want = new Set(dirs)
  const had = new Set(snapshot.dirs)
  return {
    mkdirs: dirs.filter((d) => !had.has(d)),
    moves: snapshot.moves,
    // Arquivos editados à mão (outra ordem de chaves, outra indentação) não são regravados à toa
    writes: Object.entries(files)
      .filter(([path, content]) => !sameJson(snapshot.files[path], content))
      .map(([path, content]) => ({ path, content })),
    deletes: Object.keys(snapshot.files).filter((path) => !(path in files)),
    rmdirs: snapshot.dirs.filter((d) => !want.has(d))
  }
}
