/**
 * Leitura e escrita de um repositório do Modelador pela linha de comando (sem o app aberto).
 *
 * As regras espelham o app: nomes de arquivo como `computePaths` (src/renderer/src/model/repo.ts),
 * meta modelo como `model/metamodel.ts`, exclusões como `store.ts`. Só arquivos que o comando mudou são
 * gravados, renomeados ou apagados; o resto fica como está, byte a byte.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, posix } from 'node:path'
import { randomUUID } from 'node:crypto'

export const FOLDERS = {
  resources: ['aplicações', 'aplicacoes', 'applications', 'application'],
  technologies: ['tecnologias', 'technologies', 'technology', 'tecnologies'],
  relations: ['relações', 'relacoes', 'relacionamentos', 'relationships', 'relations'],
  projects: ['projetos', 'projects']
}
export const METAMODEL_FILE = 'metamodelo.json'

export const TYPES = ['system', 'service', 'database', 'queue', 'schema', 'endpoint']
export const TYPE_LABELS = {
  system: 'Sistema', service: 'Serviço / API', database: 'Banco de dados', queue: 'Fila / Tópico', schema: 'Schema', endpoint: 'Endpoint'
}
export const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
/** Ordem da paleta (ARCHIMATE_ORDER). */
export const REL_TYPES = [
  'composition', 'aggregation', 'assignment', 'realization', 'serving', 'access',
  'influence', 'triggering', 'flow', 'specialization', 'association'
]
export const REL_LABELS = {
  composition: 'Composição', aggregation: 'Agregação', assignment: 'Atribuição', realization: 'Realização', serving: 'Serve',
  access: 'Acesso', influence: 'Influência', triggering: 'Disparo', flow: 'Fluxo', specialization: 'Especialização', association: 'Associação'
}
export const ACCESS_MODES = ['write', 'read', 'readwrite', 'access']
export const IMPACTS = ['new', 'changed', 'removed']

export class CliError extends Error {}

export const key = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
export const slugify = (text) =>
  String(text).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'sem-nome'
export const endpointRoute = (method, path) => {
  const p = ('/' + (path ?? '').trim().replace(/^\/+/, '')).replace(/\{[^}]*\}/g, '{}').replace(/\/+$/, '').toLowerCase()
  return `${method ?? 'GET'} ${p || '/'}`
}
export const uid = () => randomUUID()
const toJson = (data) => JSON.stringify(data, null, 2) + '\n'
const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v)
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const stemOf = (path) => posix.basename(path).replace(/\.json$/, '').normalize('NFC')

// Apelidos em português (comparados por slug): "serviço" → service, "fluxo" → flow…
const TYPE_ALIASES = {
  system: ['sistema'], service: ['servico', 'servico-api', 'api'], database: ['banco', 'banco-de-dados', 'db'],
  queue: ['fila', 'topico', 'fila-topico'], schema: [], endpoint: []
}
const ACCESS_ALIASES = { write: ['grava'], read: ['le'], readwrite: ['le-e-grava'], access: ['sem-direcao'] }
const IMPACT_ALIASES = { new: ['novo'], changed: ['alterado'], removed: ['excluido', 'removido'] }
const pick = (value, values, aliases, what) => {
  const k = slugify(value)
  const found = values.find((v) => v === value || slugify(v) === k || aliases[v]?.includes(k))
  if (!found) throw new CliError(`${what} inválido "${value}". Use: ${values.join(', ')}`)
  return found
}
export const parseType = (v) => pick(v, TYPES, TYPE_ALIASES, 'tipo de recurso')
export const parseAccess = (v) => pick(v, ACCESS_MODES, ACCESS_ALIASES, 'modo de acesso')
export const parseImpact = (v) => (['nenhum', 'none', 'sem'].includes(slugify(v)) ? undefined : pick(v, IMPACTS, IMPACT_ALIASES, 'impacto'))
/** Tipo ArchiMate; "generica" = sem tipo (undefined). */
export const parseRelType = (v) => {
  if (['generica', 'generic', 'nenhum'].includes(slugify(v))) return undefined
  const aliases = Object.fromEntries(REL_TYPES.map((t) => [t, [slugify(REL_LABELS[t]), ...(t === 'serving' ? ['servir'] : [])]]))
  return pick(v, REL_TYPES, aliases, 'tipo de ligação')
}
export const parseMethod = (v) => {
  const m = String(v).toUpperCase()
  if (!METHODS.includes(m)) throw new CliError(`método inválido "${v}". Use: ${METHODS.join(', ')}`)
  return m
}

/** Lê o repositório inteiro. Nada é gravado até `commit()`. */
export function loadRepo(root) {
  if (!existsSync(root) || !statSync(root).isDirectory()) throw new CliError(`pasta não encontrada: ${root}`)
  const entries = readdirSync(root).filter((n) => statSync(join(root, n)).isDirectory())
  const folders = {}
  for (const [role, names] of Object.entries(FOLDERS)) {
    for (const name of names) {
      const found = entries.find((e) => key(e) === key(name))
      if (found) {
        folders[role] = found
        break
      }
    }
  }
  if (!Object.keys(folders).length) {
    throw new CliError(`${root} não parece um repositório do Modelador (faltam as pastas aplicações, tecnologias, relações, projetos). Use --repo <pasta>.`)
  }

  const files = new Set() // todos os arquivos das pastas (caminho relativo, com "/")
  const walk = (rel) => {
    for (const name of readdirSync(join(root, rel))) {
      if (name.startsWith('.')) continue
      const child = `${rel}/${name}`
      if (statSync(join(root, child)).isDirectory()) walk(child)
      else files.add(child)
    }
  }
  for (const f of Object.values(folders)) walk(f)

  const read = (path) => {
    try {
      return JSON.parse(readFileSync(join(root, path), 'utf-8'))
    } catch {
      return undefined
    }
  }
  const model = {
    root, folders, files,
    resources: new Map(), technologies: new Map(), relations: new Map(), diagrams: new Map(),
    metamodel: null,
    paths: new Map(), // id → caminho atual
    changed: new Set(), // ids com conteúdo novo/alterado
    deleted: new Set(), // caminhos a apagar
    changedDiagrams: new Set(),
    createdDiagrams: new Set()
  }
  const inFolder = (role, path) => folders[role] && path.startsWith(folders[role] + '/') && path.endsWith('.json')
  for (const path of [...files].sort()) {
    const role = ['resources', 'technologies', 'relations'].find((r) => inFolder(r, path))
    if (role) {
      const data = read(path)
      if (isObject(data) && typeof data.id === 'string' && !model.paths.has(data.id)) {
        model[role].set(data.id, data)
        model.paths.set(data.id, path)
      }
    } else if (inFolder('projects', path)) {
      const data = read(path)
      if (isObject(data) && Array.isArray(data.nodes)) model.diagrams.set(path, data)
    }
  }
  const meta = join(root, METAMODEL_FILE)
  if (existsSync(meta)) {
    try {
      const data = JSON.parse(readFileSync(meta, 'utf-8'))
      if (isObject(data) && isObject(data.relations)) model.metamodel = data
    } catch {
      // Arquivo inválido: tratado como sem meta modelo (o validador aponta o erro)
    }
  }
  model.baseAtLoad = new Map([...model.paths.keys()].map((id) => [id, baseOf(model, id)]))
  return model
}

// ---------- Consultas ----------

export const nameOf = (m, id) => m.resources.get(id)?.name ?? m.technologies.get(id)?.name ?? 'removido'

export function ownerOf(m, endpointId) {
  return [...m.relations.values()]
    .filter((r) => r.kind === 'flow' && r.targetId === endpointId && r.relType === 'composition' && m.resources.has(r.sourceId))
    .map((r) => m.resources.get(r.sourceId))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))[0]
}

/** Slug que o app daria ao arquivo do item (sem `-2`, `-3`…). */
function baseOf(m, id) {
  const r = m.resources.get(id)
  if (r) {
    const owner = r.type === 'endpoint' ? ownerOf(m, r.id) : undefined
    return owner ? `${slugify(owner.name)}--${slugify(r.name)}` : slugify(r.name)
  }
  const t = m.technologies.get(id)
  if (t) return slugify(t.name)
  const rel = m.relations.get(id)
  return `${slugify(nameOf(m, rel.sourceId))}--${rel.kind === 'uses' ? 'usa--' : ''}${slugify(nameOf(m, rel.targetId))}`
}

const describe = (m, id) => {
  const r = m.resources.get(id)
  if (r) return `${r.name} (${r.type}, ${id})`
  const t = m.technologies.get(id)
  if (t) return `${t.name} (tecnologia, ${id})`
  return id
}

/** Acha pelo id ou pelo nome (sem maiúsculas, acentos e pontuação). Endpoint: "Dono:GET /x" também vale. */
function find(m, ref, maps, what) {
  for (const map of maps) if (map.has(ref)) return ref
  let candidates = []
  for (const map of maps) for (const [id, item] of map) if (slugify(item.name) === slugify(ref)) candidates.push(id)
  if (!candidates.length && ref.includes(':') && maps.includes(m.resources)) {
    const [owner, name] = [ref.slice(0, ref.indexOf(':')), ref.slice(ref.indexOf(':') + 1)]
    candidates = [...m.resources.values()]
      .filter((r) => r.type === 'endpoint' && slugify(r.name) === slugify(name) && slugify(ownerOf(m, r.id)?.name ?? '') === slugify(owner))
      .map((r) => r.id)
  }
  if (!candidates.length) throw new CliError(`${what} não encontrado: "${ref}". Veja \`modelador listar\`.`)
  if (candidates.length > 1) {
    throw new CliError(`"${ref}" é ambíguo; use o id:\n${candidates.map((id) => `  ${describe(m, id)}`).join('\n')}`)
  }
  return candidates[0]
}
export const findResource = (m, ref) => find(m, ref, [m.resources], 'recurso')
export const findTechnology = (m, ref) => find(m, ref, [m.technologies], 'tecnologia')
export const findResourceOrTechnology = (m, ref) => find(m, ref, [m.resources, m.technologies], 'recurso ou tecnologia')
export function findRelation(m, ref) {
  if (m.relations.has(ref)) return ref
  throw new CliError(`ligação não encontrada: "${ref}" (use o id, de \`modelador listar ligacoes\`)`)
}

/** Recurso ou tecnologia com o mesmo nome (comparação do app: slug). */
export function sameName(m, map, name, exceptId) {
  return [...map.entries()].filter(([id, item]) => id !== exceptId && item.type !== 'endpoint' && slugify(item.name) === slugify(name)).map(([id]) => id)
}

// ---------- Meta modelo ----------

const isFixedRule = (s, t, relType) => relType === 'composition' && t === 'endpoint' && (s === 'system' || s === 'service')

export function allowedTypes(mm, s, t) {
  const listed = new Set(mm.relations?.[s]?.[t] ?? [])
  return REL_TYPES.filter((rt) => listed.has(rt) || isFixedRule(s, t, rt))
}

/** Mensagem de erro se a ligação sai do meta modelo; undefined se vale. */
export function metamodelProblem(m, rel) {
  const s = m.resources.get(rel.sourceId)
  const t = m.resources.get(rel.targetId)
  if (!m.metamodel || rel.kind !== 'flow' || !s || !t) return undefined
  const allowed = allowedTypes(m.metamodel, s.type, t.type)
  const pair = `${TYPE_LABELS[s.type]} → ${TYPE_LABELS[t.type]}`
  if (!allowed.length) return `O meta modelo não permite ligações ${pair}.`
  if (rel.relType ? allowed.includes(rel.relType) : true) return undefined
  return `O meta modelo não permite ${REL_LABELS[rel.relType]} em ${pair}. Aceitos: ${allowed.join(', ')}.`
}

// ---------- Alterações em memória ----------

export function put(m, role, item) {
  m[role].set(item.id, item)
  m.changed.add(item.id)
}

/** Tira itens e limpa as referências nos desenhos (como deleteResource/deleteRelation do app). */
export function removeItems(m, ids) {
  const gone = new Set(ids)
  // Ligações com ponta removida vão junto
  for (const r of m.relations.values()) if (gone.has(r.sourceId) || gone.has(r.targetId)) gone.add(r.id)
  for (const id of gone) {
    for (const role of ['resources', 'technologies', 'relations']) m[role].delete(id)
    if (m.paths.has(id)) m.deleted.add(m.paths.get(id))
    m.paths.delete(id)
    m.changed.delete(id)
  }
  for (const path of m.diagrams.keys()) updateDiagram(m, path, (d) => withoutIds(d, gone))
  return gone
}

function withoutIds(d, gone) {
  const out = { ...d, nodes: d.nodes.filter((n) => !gone.has(n.resourceId)) }
  if (Array.isArray(d.edges)) out.edges = d.edges.filter((e) => !gone.has(e))
  for (const field of ['edgeImpacts', 'anchors']) {
    if (!isObject(d[field])) continue
    const kept = Object.entries(d[field]).filter(([id]) => !gone.has(id) && (out.edges ?? []).includes(id))
    if (kept.length) out[field] = Object.fromEntries(kept)
    else delete out[field]
  }
  if (Array.isArray(d.connectors)) {
    const kept = d.connectors.filter((c) => !gone.has(c.source) && !gone.has(c.target))
    if (kept.length) out.connectors = kept
    else delete out.connectors
  }
  return out
}

export function updateDiagram(m, path, fn) {
  const before = m.diagrams.get(path)
  const after = fn(before)
  if (toJson(after) !== toJson(before)) {
    m.diagrams.set(path, after)
    m.changedDiagrams.add(path)
  }
}

/** Adiciona as setas das ligações cujas duas pontas estão no desenho (withImpliedEdges do app). */
export function withImpliedEdges(m, d) {
  const present = new Set(d.nodes.map((n) => n.resourceId))
  const edges = Array.isArray(d.edges) ? [...d.edges] : []
  for (const r of m.relations.values()) {
    if (r.kind === 'flow' && !edges.includes(r.id) && present.has(r.sourceId) && present.has(r.targetId)) edges.push(r.id)
  }
  return { ...d, edges }
}

/** Caminho do desenho: relativo ao repositório ou à pasta de projetos, com ou sem .json, ou só o nome. */
export function findDiagram(m, ref) {
  const projects = m.folders.projects ?? FOLDERS.projects[0]
  const clean = ref.replace(/\\/g, '/').replace(/^\.\//, '')
  const withExt = clean.endsWith('.json') ? clean : `${clean}.json`
  const nfc = (s) => s.normalize('NFC')
  for (const p of [withExt, `${projects}/${withExt}`]) {
    const hit = [...m.diagrams.keys()].find((d) => nfc(d) === nfc(p))
    if (hit) return hit
  }
  const byName = [...m.diagrams.keys()].filter((d) => key(stemOf(d)) === key(stemOf(withExt)))
  if (byName.length === 1) return byName[0]
  if (byName.length > 1) throw new CliError(`desenho "${ref}" é ambíguo:\n${byName.map((d) => `  ${d}`).join('\n')}`)
  throw new CliError(`desenho não encontrado: "${ref}". Veja \`modelador listar desenhos\`.`)
}

export function newDiagramPath(m, ref) {
  const projects = m.folders.projects ?? FOLDERS.projects[0]
  let path = ref.replace(/\\/g, '/').replace(/^\.\//, '')
  if (!path.endsWith('.json')) path += '.json'
  if (!path.startsWith(projects + '/')) path = `${projects}/${path}`
  if (path.split('/').includes('..')) throw new CliError('o caminho do desenho não pode sair da pasta de projetos')
  if (m.files.has(path) || m.diagrams.has(path)) throw new CliError(`já existe ${path}`)
  return path
}

// ---------- Gravação ----------

/**
 * Calcula os caminhos (como assignPaths do app) só para os itens afetados: novos, alterados e os que
 * mudariam de slug porque uma ponta foi renomeada. Grava, renomeia e apaga; devolve o que fez.
 */
export function commit(m, { dryRun = false } = {}) {
  const actions = []
  const affected = []
  for (const id of [...m.resources.keys(), ...m.technologies.keys(), ...m.relations.keys()]) {
    const prev = m.paths.get(id)
    const base = baseOf(m, id)
    const baseChanged = m.baseAtLoad.has(id) && m.baseAtLoad.get(id) !== base
    if (!prev || m.changed.has(id) || baseChanged) affected.push(id)
  }
  const taken = new Set([...m.files].filter((f) => !m.deleted.has(f)))
  const target = new Map()
  const pending = []
  for (const id of affected.sort()) {
    const prev = m.paths.get(id)
    if (prev && new RegExp(`^${escape(baseOf(m, id))}(-\\d+)?$`).test(stemOf(prev))) target.set(id, prev)
    else {
      if (prev) taken.delete(prev)
      pending.push(id)
    }
  }
  for (const id of pending) {
    const role = m.resources.has(id) ? 'resources' : m.technologies.has(id) ? 'technologies' : 'relations'
    const prev = m.paths.get(id)
    const dir = prev ? posix.dirname(prev) : (m.folders[role] ?? FOLDERS[role][0])
    const base = baseOf(m, id)
    let path = `${dir}/${base}.json`
    for (let i = 2; taken.has(path); i++) path = `${dir}/${base}-${i}.json`
    taken.add(path)
    target.set(id, path)
  }

  const full = (p) => join(m.root, ...p.split('/'))
  const write = (path, text) => {
    if (!dryRun) {
      mkdirSync(dirname(full(path)), { recursive: true })
      writeFileSync(full(path), text)
    }
  }
  for (const path of m.deleted) {
    actions.push({ action: 'apagado', path })
    if (!dryRun) rmSync(full(path), { force: true })
  }
  for (const id of affected) {
    const prev = m.paths.get(id)
    const path = target.get(id)
    const data = m.resources.get(id) ?? m.technologies.get(id) ?? m.relations.get(id)
    if (prev && prev !== path) {
      actions.push({ action: 'renomeado', from: prev, path, id })
      if (!dryRun) {
        mkdirSync(dirname(full(path)), { recursive: true })
        renameSync(full(prev), full(path))
      }
    }
    if (m.changed.has(id)) {
      actions.push({ action: prev ? 'alterado' : 'criado', path, id })
      write(path, toJson(data))
    }
    m.paths.set(id, path)
  }
  for (const path of m.changedDiagrams) {
    actions.push({ action: m.createdDiagrams.has(path) ? 'criado' : 'alterado', path })
    write(path, toJson(m.diagrams.get(path)))
  }
  return actions
}
