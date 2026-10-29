#!/usr/bin/env node
/**
 * Validador de um repositório do Modelador (só lê arquivos; não altera nada).
 * Uso: node validar.mjs <pasta-do-repositorio>
 *
 * Erros: o app não leria certo (JSON inválido, id repetido, referência quebrada, tipo inválido).
 * Avisos: o app leria, mas mudaria algo no Salvar (nome de arquivo) ou há duplicidade.
 * Sai com código 1 se houver erro.
 *
 * As regras espelham src/renderer/src/model/repo.ts (parseScan, computePaths) e store.ts.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = process.argv[2]
if (!ROOT) {
  console.error('Uso: node validar.mjs <pasta-do-repositorio>')
  process.exit(2)
}

const ALIASES = {
  resources: ['aplicações', 'aplicacoes', 'applications', 'application'],
  technologies: ['tecnologias', 'technologies', 'technology', 'tecnologies'],
  relations: ['relações', 'relacoes', 'relacionamentos', 'relationships', 'relations'],
  projects: ['projetos', 'projects']
}
const TYPES = ['system', 'service', 'database', 'queue', 'schema', 'endpoint']
const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
const IMPACTS = ['new', 'changed', 'removed']
const REL_TYPES = [
  'composition', 'aggregation', 'assignment', 'realization', 'serving', 'access',
  'influence', 'triggering', 'flow', 'specialization', 'association'
]
const ACCESS = ['write', 'read', 'readwrite', 'access']

const errors = []
const warnings = []
const err = (file, msg) => errors.push(`${file}: ${msg}`)
const warn = (file, msg) => warnings.push(`${file}: ${msg}`)

const key = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const slugify = (text) =>
  text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'sem-nome'
const endpointRoute = (method, path) => {
  const p = ('/' + (path ?? '').trim().replace(/^\/+/, '')).replace(/\{[^}]*\}/g, '{}').replace(/\/+$/, '').toLowerCase()
  return `${method ?? 'GET'} ${p || '/'}`
}

// Pastas raiz (português ou inglês; vale o primeiro nome da lista que existir)
const entries = readdirSync(ROOT).filter((n) => statSync(join(ROOT, n)).isDirectory())
const folders = {}
for (const [role, names] of Object.entries(ALIASES)) {
  for (const name of names) {
    const found = entries.find((e) => key(e) === key(name))
    if (found) {
      folders[role] = found
      break
    }
  }
  if (!folders[role]) warn(ROOT, `pasta de ${role} não encontrada (aceitos: ${names.join(', ')})`)
}

function jsonFiles(dir) {
  if (!dir) return []
  const out = []
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      if (name.startsWith('.')) continue
      const full = join(d, name)
      if (statSync(full).isDirectory()) walk(full)
      else if (name.endsWith('.json')) out.push(full)
    }
  }
  walk(join(ROOT, dir))
  return out
}

function load(file) {
  const rel = relative(ROOT, file)
  const text = readFileSync(file, 'utf-8')
  try {
    const data = JSON.parse(text)
    if (!text.endsWith('\n')) warn(rel, 'sem quebra de linha no fim (o app regravaria o arquivo)')
    return { rel, data }
  } catch (e) {
    err(rel, `JSON inválido (${e.message})`)
    return { rel, data: undefined }
  }
}

const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v)
const ids = new Map() // id → arquivo
const claim = (id, rel) => {
  if (ids.has(id)) err(rel, `id repetido (também em ${ids.get(id)})`)
  else ids.set(id, rel)
}
const emptyOptional = (rel, data, fields) => {
  for (const f of fields) {
    if (f in data && (data[f] === null || data[f] === '' || data[f] === false)) {
      warn(rel, `campo opcional "${f}" vazio: omita a chave`)
    }
  }
}

// Recursos
const resources = new Map()
for (const { rel, data } of jsonFiles(folders.resources).map(load)) {
  if (!isObject(data) || typeof data.id !== 'string') {
    if (data !== undefined) warn(rel, 'sem "id": o app trata como outro arquivo (fica cinza)')
    continue
  }
  claim(data.id, rel)
  if (!TYPES.includes(data.type)) err(rel, `type inválido "${data.type}" (use ${TYPES.join(', ')})`)
  for (const f of ['name', 'description', 'owner']) {
    if (typeof data[f] !== 'string') err(rel, `"${f}" precisa ser texto (pode ser "")`)
  }
  if ('impact' in data && data.impact && !IMPACTS.includes(data.impact)) err(rel, `impact inválido "${data.impact}"`)
  emptyOptional(rel, data, ['impact'])
  if (data.type === 'endpoint') {
    if (!METHODS.includes(data.method)) err(rel, `method inválido "${data.method}"`)
    if (typeof data.path !== 'string' || !data.path.startsWith('/')) err(rel, 'path precisa começar com "/"')
    else if (data.name !== `${data.method} ${data.path}`) warn(rel, `name deveria ser "${data.method} ${data.path}"`)
    if ('parentId' in data) warn(rel, 'parentId é formato antigo: use uma ligação de Composição dono → endpoint')
  } else if ('method' in data || 'path' in data) {
    warn(rel, 'method/path só valem para endpoint')
  }
  resources.set(data.id, { ...data, rel })
}

// Tecnologias
const technologies = new Map()
for (const { rel, data } of jsonFiles(folders.technologies).map(load)) {
  if (!isObject(data) || typeof data.id !== 'string') {
    if (data !== undefined) warn(rel, 'sem "id": o app trata como outro arquivo')
    continue
  }
  claim(data.id, rel)
  for (const f of ['name', 'category', 'description']) {
    if (typeof data[f] !== 'string') err(rel, `"${f}" precisa ser texto (pode ser "")`)
  }
  technologies.set(data.id, { ...data, rel })
}

// Ligações
const relations = new Map()
for (const { rel, data } of jsonFiles(folders.relations).map(load)) {
  if (!isObject(data) || typeof data.id !== 'string') {
    if (data !== undefined) warn(rel, 'sem "id": o app trata como outro arquivo')
    continue
  }
  claim(data.id, rel)
  if (data.kind !== 'flow' && data.kind !== 'uses') err(rel, `kind inválido "${data.kind}" (use flow ou uses)`)
  for (const f of ['label', 'protocol']) {
    if (typeof data[f] !== 'string') err(rel, `"${f}" precisa ser texto (pode ser "")`)
  }
  if (!resources.has(data.sourceId)) err(rel, `sourceId ${data.sourceId} não é um recurso`)
  if (data.kind === 'uses') {
    if (!technologies.has(data.targetId)) err(rel, `targetId ${data.targetId} não é uma tecnologia`)
    for (const f of ['relType', 'accessMode', 'strength', 'directed']) if (f in data) warn(rel, `"${f}" não vale para uses`)
  } else {
    if (!resources.has(data.targetId)) err(rel, `targetId ${data.targetId} não é um recurso`)
    if ('relType' in data && data.relType && !REL_TYPES.includes(data.relType)) err(rel, `relType inválido "${data.relType}"`)
    if ('accessMode' in data && data.accessMode) {
      if (!ACCESS.includes(data.accessMode)) err(rel, `accessMode inválido "${data.accessMode}"`)
      else if (data.relType !== 'access') warn(rel, 'accessMode só vale com relType "access"')
    }
    if ('strength' in data && data.strength && data.relType !== 'influence') warn(rel, 'strength só vale com relType "influence"')
    if ('directed' in data && data.directed === true && data.relType !== 'association') warn(rel, 'directed só vale com relType "association"')
  }
  if (data.sourceId === data.targetId) err(rel, 'origem e destino iguais')
  if ('impact' in data && data.impact && !IMPACTS.includes(data.impact)) err(rel, `impact inválido "${data.impact}"`)
  emptyOptional(rel, data, ['impact', 'relType', 'accessMode', 'strength', 'directed'])
  relations.set(data.id, { ...data, rel })
}

// Nomes de arquivo esperados (o app renomeia no Salvar se não baterem)
const nameOf = (id) => resources.get(id)?.name ?? technologies.get(id)?.name ?? 'removido'
const ownerOf = (endpointId) =>
  [...relations.values()]
    .filter((r) => r.kind === 'flow' && r.targetId === endpointId && r.relType === 'composition' && resources.has(r.sourceId))
    .map((r) => resources.get(r.sourceId).name)
    .sort((a, b) => a.localeCompare(b, 'pt-BR'))[0]
const checkName = (item, base) => {
  const stem = item.rel.split('/').pop().replace(/\.json$/, '')
  const escaped = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  if (!new RegExp(`^${escaped}(-\\d+)?$`).test(stem.normalize('NFC'))) {
    warn(item.rel, `o app renomearia para ${base}.json`)
  }
}
for (const r of resources.values()) {
  const owner = r.type === 'endpoint' ? ownerOf(r.id) : undefined
  checkName(r, owner ? `${slugify(owner)}--${slugify(String(r.name))}` : slugify(String(r.name)))
}
for (const t of technologies.values()) checkName(t, slugify(String(t.name)))
for (const r of relations.values()) {
  checkName(r, `${slugify(nameOf(r.sourceId))}--${r.kind === 'uses' ? 'usa--' : ''}${slugify(nameOf(r.targetId))}`)
}

// Duplicidades
const byName = new Map()
for (const r of resources.values()) {
  if (r.type === 'endpoint' || !String(r.name).trim()) continue
  const k = slugify(String(r.name))
  if (byName.has(k)) warn(r.rel, `recurso com o mesmo nome que ${byName.get(k)}`)
  else byName.set(k, r.rel)
}
const techByName = new Map()
for (const t of technologies.values()) {
  const k = slugify(String(t.name))
  if (techByName.has(k)) warn(t.rel, `tecnologia com o mesmo nome que ${techByName.get(k)}`)
  else techByName.set(k, t.rel)
}
const pairs = new Map()
for (const r of relations.values()) {
  const k = r.kind === 'uses' ? `uses|${r.sourceId}|${r.targetId}` : `flow|${[r.sourceId, r.targetId].sort().join('|')}`
  if (pairs.has(k)) warn(r.rel, `já existe ligação entre as mesmas pontas (${pairs.get(k)})`)
  else pairs.set(k, r.rel)
}
// Recurso ligado a dois endpoints com a mesma rota
const routes = new Map()
for (const r of relations.values()) {
  if (r.kind !== 'flow') continue
  for (const [me, other] of [[r.sourceId, r.targetId], [r.targetId, r.sourceId]]) {
    const ep = resources.get(other)
    if (ep?.type !== 'endpoint' || resources.get(me)?.type === 'endpoint') continue
    const k = `${me}|${endpointRoute(ep.method, ep.path)}`
    const seen = routes.get(k)
    if (seen && seen !== other) warn(r.rel, `${nameOf(me)} já está ligado a outro endpoint com a rota ${ep.method} ${ep.path} (${resources.get(seen).rel})`)
    else routes.set(k, other)
  }
}

// Desenhos
for (const { rel, data } of jsonFiles(folders.projects).map(load)) {
  if (!isObject(data) || !Array.isArray(data.nodes)) continue
  const present = new Set()
  for (const n of data.nodes) {
    if (!resources.has(n?.resourceId)) err(rel, `nó com resourceId ${n?.resourceId} que não existe`)
    if (present.has(n?.resourceId)) err(rel, `recurso ${n?.resourceId} aparece duas vezes em nodes`)
    present.add(n?.resourceId)
    if (!Number.isInteger(n?.x) || !Number.isInteger(n?.y)) warn(rel, `nó ${n?.resourceId}: x/y devem ser inteiros`)
  }
  for (const e of Array.isArray(data.edges) ? data.edges : []) {
    const r = relations.get(e)
    if (!r) err(rel, `edge ${e} não é uma ligação existente`)
    else if (r.kind !== 'flow') err(rel, `edge ${e} é uses: tecnologias não entram em edges`)
    else if (!present.has(r.sourceId) || !present.has(r.targetId)) warn(rel, `edge ${e} só aparece com as duas pontas em nodes`)
  }
}

for (const w of warnings) console.log(`aviso  ${w}`)
for (const e of errors) console.log(`ERRO   ${e}`)
console.log(
  `\n${resources.size} recursos, ${technologies.size} tecnologias, ${relations.size} ligações: ` +
    `${errors.length} erro(s), ${warnings.length} aviso(s)`
)
process.exit(errors.length ? 1 : 0)
