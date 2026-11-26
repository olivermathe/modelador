#!/usr/bin/env node
/**
 * modelador: cadastra recursos, endpoints, tecnologias, ligações e desenhos num repositório do Modelador
 * pela linha de comando, para agentes (Kiro CLI, Claude Code…) e scripts. Só Node.js 18+, sem dependências.
 * Uso: modelador ajuda
 */
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  allowedTypes, CliError, commit, endpointRoute, findDiagram, findRelation, findResource, findResourceOrTechnology,
  findTechnology, IMPACTS, loadRepo, metamodelProblem, nameOf, newDiagramPath, ownerOf, parseAccess, parseImpact,
  parseMethod, parseRelType, parseType, put, REL_TYPES, removeItems, sameName, TYPE_LABELS, TYPES, uid,
  updateDiagram, withImpliedEdges
} from './lib/repo.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const VALIDAR = join(HERE, '..', 'docs', 'skills', 'cadastrar-recursos-e-ligacoes', 'validar.mjs')

const HELP = `modelador: edita um repositório do Modelador pela linha de comando.

Uso: modelador <comando> [argumentos] [--repo <pasta>] [--json] [--simular]

  --repo <pasta>   raiz do repositório (padrão: $MODELADOR_REPO ou a pasta atual)
  --json           saída em JSON (para agentes e scripts)
  --simular        mostra o que mudaria, sem gravar nada

Consultar
  listar recursos [--tipo <tipo>]      listar tecnologias | listar ligacoes [--de <ref>] | listar desenhos
  mostrar <ref>                        recurso ou tecnologia, com ligações e desenhos onde aparece
  metamodelo [--de <tipo> --para <tipo>]   relações permitidas (todas ou de um par)
  validar                              confere o repositório inteiro (erros e avisos)

Criar
  criar recurso --tipo <tipo> --nome <nome> [--descricao <t>] [--responsavel <time>]
  criar endpoint --metodo <GET|POST|PUT|PATCH|DELETE> --caminho </rota> [--dono <ref>] [--descricao <t>] [--responsavel <time>]
  criar tecnologia --nome <nome> [--categoria <c>] [--descricao <t>]
  ligar <origem> <destino> [--tipo <tipo de ligação>] [--rotulo <t>] [--protocolo <p>]
        [--acesso write|read|readwrite|access] [--forca <+|++|-|-->] [--direcionada] [--permitir-repetida]
  usar <recurso> <tecnologia>          recurso usa tecnologia (etiqueta no nó)

Alterar
  editar <ref> [--nome] [--descricao] [--responsavel] [--tipo] [--metodo] [--caminho] [--categoria]
  editar-ligacao <id> [--tipo] [--rotulo] [--protocolo] [--acesso] [--forca] [--direcionada|--nao-direcionada] [--inverter]
  remover <ref>                        recurso, tecnologia ou ligação (id); leva junto as ligações e tira dos desenhos
  desligar <ref> <tecnologia>          desfaz o "usar"

Desenhos (pasta de projetos)
  desenho criar <caminho>              ex.: pedidos/2026-T1-01-checkout/diagrama
  desenho colocar <desenho> <ref>... [--impacto new|changed|removed] [--x <n> --y <n>]
  desenho tirar <desenho> <ref>...
  desenho impacto <desenho> <ref ou id da ligação> <new|changed|removed|nenhum>

<ref> é o id ou o nome (sem diferença de maiúsculas, acentos e pontuação). Endpoint: "GET /pedidos/{id}" ou
"API de Pedidos:GET /pedidos/{id}" se houver mais de um com a mesma rota.
Tipos de recurso: ${TYPES.join(', ')} (ou sistema, servico, banco, fila).
Tipos de ligação: ${REL_TYPES.join(', ')}, generica (ou os nomes em português: fluxo, serve, acesso…).
`

// ---------- Argumentos ----------

const BOOLEAN = new Set(['json', 'simular', 'direcionada', 'nao-direcionada', 'inverter', 'permitir-repetida', 'permitir-repetido', 'ajuda', 'help'])

function parseArgs(argv) {
  const positional = []
  const opts = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const eq = a.indexOf('=')
      const name = eq > 0 ? a.slice(2, eq) : a.slice(2)
      if (eq > 0) opts[name] = a.slice(eq + 1)
      else if (BOOLEAN.has(name)) opts[name] = true
      else {
        if (i + 1 >= argv.length) throw new CliError(`--${name} precisa de um valor`)
        opts[name] = argv[++i]
      }
    } else positional.push(a)
  }
  return { positional, opts }
}

const need = (value, what) => {
  if (value === undefined || value === true || value === '') throw new CliError(`falta ${what}. Veja \`modelador ajuda\`.`)
  return value
}
const text = (v) => (v === undefined ? undefined : String(v))

// ---------- Saída ----------

let JSON_OUT = false
const out = (human, data) => {
  if (JSON_OUT) console.log(JSON.stringify(data, null, 2))
  else console.log(human)
}

function finish(m, opts, result = {}) {
  const actions = commit(m, { dryRun: !!opts.simular })
  const verb = opts.simular ? '(simulação) ' : ''
  const lines = actions.map((a) => `${verb}${a.action.padEnd(9)} ${a.from ? `${a.from} → ` : ''}${a.path}`)
  if (!actions.length) lines.push('nada mudou')
  out([...(result.message ? [result.message] : []), ...lines].join('\n'), { ...result, simulated: !!opts.simular, actions })
}

// ---------- Descrições ----------

const resourceLine = (m, r) => {
  const owner = r.type === 'endpoint' ? ownerOf(m, r.id) : undefined
  return `${r.id}  ${r.type.padEnd(8)}  ${r.name}${owner ? `  (de ${owner.name})` : ''}`
}
const relationLine = (m, r) =>
  r.kind === 'uses'
    ? `${r.id}  usa         ${nameOf(m, r.sourceId)} → ${nameOf(m, r.targetId)}`
    : `${r.id}  ${(r.relType ?? 'generica').padEnd(10)}  ${nameOf(m, r.sourceId)} → ${nameOf(m, r.targetId)}` +
      `${r.label || r.protocol ? `  "${[r.label, r.protocol && `[${r.protocol}]`].filter(Boolean).join(' ')}"` : ''}`
const withPath = (m, item) => ({ ...item, path: m.paths.get(item.id) })

// ---------- Comandos ----------

const COMMANDS = {
  listar(m, [what = 'recursos'], opts) {
    const k = what.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    if (k.startsWith('recurso')) {
      const type = opts.tipo ? parseType(opts.tipo) : undefined
      const list = [...m.resources.values()].filter((r) => !type || r.type === type).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
      return out(list.map((r) => resourceLine(m, r)).join('\n') || '(nenhum recurso)', list.map((r) => ({ ...withPath(m, r), owner: ownerOf(m, r.id)?.id })))
    }
    if (k.startsWith('tecnologia')) {
      const list = [...m.technologies.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
      return out(list.map((t) => `${t.id}  ${t.name}${t.category ? `  (${t.category})` : ''}`).join('\n') || '(nenhuma tecnologia)', list.map((t) => withPath(m, t)))
    }
    if (k.startsWith('liga') || k.startsWith('rela')) {
      const of = opts.de ? findResourceOrTechnology(m, opts.de) : undefined
      const list = [...m.relations.values()].filter((r) => !of || r.sourceId === of || r.targetId === of)
      return out(list.map((r) => relationLine(m, r)).join('\n') || '(nenhuma ligação)', list.map((r) => withPath(m, r)))
    }
    if (k.startsWith('desenho')) {
      const list = [...m.diagrams.entries()].map(([path, d]) => ({ path, nodes: d.nodes.length, edges: (d.edges ?? []).length }))
      return out(list.map((d) => `${d.path}  (${d.nodes} recursos, ${d.edges} setas)`).join('\n') || '(nenhum desenho)', list)
    }
    throw new CliError(`listar o quê? recursos, tecnologias, ligacoes ou desenhos`)
  },

  mostrar(m, [ref]) {
    const id = findResourceOrTechnology(m, need(ref, 'o recurso ou tecnologia'))
    const item = m.resources.get(id) ?? m.technologies.get(id)
    const relations = [...m.relations.values()].filter((r) => r.sourceId === id || r.targetId === id)
    const diagrams = [...m.diagrams.entries()].filter(([, d]) => d.nodes.some((n) => n.resourceId === id))
      .map(([path, d]) => ({ path, impact: d.nodes.find((n) => n.resourceId === id).impact }))
    const owner = item.type === 'endpoint' ? ownerOf(m, id) : undefined
    const human = [
      `${item.name}  (${item.type ? TYPE_LABELS[item.type] : 'Tecnologia'})`,
      `id: ${id}`,
      `arquivo: ${m.paths.get(id)}`,
      ...Object.entries(item).filter(([k, v]) => !['id', 'name', 'type'].includes(k) && v !== '').map(([k, v]) => `${k}: ${v}`),
      ...(owner ? [`dono: ${owner.name} (${owner.id})`] : []),
      '', 'ligações:', ...(relations.length ? relations.map((r) => `  ${relationLine(m, r)}`) : ['  (nenhuma)']),
      '', 'desenhos:', ...(diagrams.length ? diagrams.map((d) => `  ${d.path}${d.impact ? `  [${d.impact}]` : ''}`) : ['  (nenhum)'])
    ]
    out(human.join('\n'), { ...withPath(m, item), owner: owner?.id, relations: relations.map((r) => withPath(m, r)), diagrams })
  },

  metamodelo(m, _, opts) {
    if (!m.metamodel) return out('Sem metamodelo.json: qualquer ligação é aceita.', { metamodel: null })
    if (opts.de || opts.para) {
      const s = parseType(need(opts.de, '--de <tipo>'))
      const t = parseType(need(opts.para, '--para <tipo>'))
      const allowed = allowedTypes(m.metamodel, s, t)
      return out(`${TYPE_LABELS[s]} → ${TYPE_LABELS[t]}: ${allowed.join(', ') || 'nenhuma ligação'}`, { source: s, target: t, allowed })
    }
    const rows = []
    for (const s of TYPES) for (const t of TYPES) {
      const allowed = allowedTypes(m.metamodel, s, t)
      if (allowed.length) rows.push({ source: s, target: t, allowed })
    }
    out(rows.map((r) => `${r.source} → ${r.target}: ${r.allowed.join(', ')}`).join('\n'), { metamodel: m.metamodel, pairs: rows })
  },

  criar(m, [what, ...rest], opts) {
    const k = String(need(what, 'o que criar (recurso, endpoint ou tecnologia)')).toLowerCase()
    if (rest.length) throw new CliError(`argumento a mais: ${rest.join(' ')} (use --nome "...")`)
    if (k === 'recurso') {
      const type = parseType(need(opts.tipo, '--tipo'))
      if (type === 'endpoint') throw new CliError('para endpoint use `modelador criar endpoint --metodo ... --caminho ...`')
      const name = need(opts.nome, '--nome')
      const same = sameName(m, m.resources, name)
      if (same.length && !opts['permitir-repetido']) {
        throw new CliError(`já existe recurso com esse nome: ${same.map((id) => resourceLine(m, m.resources.get(id))).join('; ')}. Use o existente (ou --permitir-repetido).`)
      }
      const r = { id: uid(), type, name, description: text(opts.descricao) ?? '', owner: text(opts.responsavel) ?? '' }
      put(m, 'resources', r)
      return finish(m, opts, { message: `recurso ${r.name}: ${r.id}`, id: r.id })
    }
    if (k === 'endpoint') {
      const method = parseMethod(need(opts.metodo, '--metodo'))
      let path = String(need(opts.caminho, '--caminho')).trim()
      if (!path.startsWith('/')) path = `/${path}`
      const ownerId = opts.dono ? findResource(m, opts.dono) : undefined
      const owner = ownerId && m.resources.get(ownerId)
      if (owner && !['system', 'service'].includes(owner.type)) throw new CliError(`o dono precisa ser sistema ou serviço (${owner.name} é ${owner.type})`)
      if (ownerId) {
        const route = endpointRoute(method, path)
        const existing = [...m.relations.values()].find((r) => {
          const ep = m.resources.get(r.targetId)
          return r.kind === 'flow' && r.sourceId === ownerId && ep?.type === 'endpoint' && endpointRoute(ep.method, ep.path) === route
        })
        if (existing && !opts['permitir-repetido']) {
          throw new CliError(`${owner.name} já tem ${m.resources.get(existing.targetId).name} (${existing.targetId}). Use o existente (ou --permitir-repetido).`)
        }
      }
      const ep = {
        id: uid(), type: 'endpoint', name: `${method} ${path}`, description: text(opts.descricao) ?? '',
        owner: text(opts.responsavel) ?? owner?.owner ?? '', method, path
      }
      put(m, 'resources', ep)
      let relId
      if (ownerId) {
        // O dono do endpoint é a ligação de Composição dono → endpoint
        const rel = { id: uid(), kind: 'flow', sourceId: ownerId, targetId: ep.id, label: '', protocol: '', relType: 'composition' }
        put(m, 'relations', rel)
        relId = rel.id
      }
      return finish(m, opts, { message: `endpoint ${ep.name}: ${ep.id}${owner ? ` (de ${owner.name})` : ''}`, id: ep.id, relationId: relId })
    }
    if (k === 'tecnologia') {
      const name = need(opts.nome, '--nome')
      const same = sameName(m, m.technologies, name)
      if (same.length && !opts['permitir-repetido']) throw new CliError(`já existe a tecnologia ${m.technologies.get(same[0]).name} (${same[0]}). Use a existente.`)
      const t = { id: uid(), name, category: text(opts.categoria) ?? '', description: text(opts.descricao) ?? '' }
      put(m, 'technologies', t)
      return finish(m, opts, { message: `tecnologia ${t.name}: ${t.id}`, id: t.id })
    }
    throw new CliError(`criar o quê? recurso, endpoint ou tecnologia`)
  },

  ligar(m, [from, to], opts) {
    const sourceId = findResource(m, need(from, 'a origem'))
    const targetId = findResourceOrTechnology(m, need(to, 'o destino'))
    if (m.technologies.has(targetId)) return COMMANDS.usar(m, [sourceId, targetId], opts)
    if (sourceId === targetId) throw new CliError('origem e destino são o mesmo recurso')
    const rel = { id: uid(), kind: 'flow', sourceId, targetId, label: text(opts.rotulo) ?? '', protocol: text(opts.protocolo) ?? '' }
    applyRelationOptions(m, rel, opts)

    const repeated = [...m.relations.values()].find((r) => r.kind === 'flow' &&
      ((r.sourceId === sourceId && r.targetId === targetId) || (r.sourceId === targetId && r.targetId === sourceId)))
    if (repeated && !opts['permitir-repetida']) {
      throw new CliError(`já existe ligação entre os dois: ${relationLine(m, repeated)}. Use a existente (editar-ligacao) ou --permitir-repetida.`)
    }
    // Recurso já ligado a outro endpoint com a mesma rota
    for (const [me, other] of [[sourceId, targetId], [targetId, sourceId]]) {
      const ep = m.resources.get(other)
      if (ep?.type !== 'endpoint' || m.resources.get(me).type === 'endpoint') continue
      const route = endpointRoute(ep.method, ep.path)
      const dup = [...m.relations.values()].map((r) => (r.sourceId === me ? r.targetId : r.targetId === me ? r.sourceId : undefined))
        .find((id) => id && id !== other && m.resources.get(id)?.type === 'endpoint' && endpointRoute(m.resources.get(id).method, m.resources.get(id).path) === route)
      if (dup && !opts['permitir-repetida']) {
        throw new CliError(`${m.resources.get(me).name} já está ligado a ${m.resources.get(dup).name} (${dup}), com a mesma rota. Use esse endpoint.`)
      }
    }
    put(m, 'relations', rel)
    return finish(m, opts, { message: `ligação ${relationLine(m, rel)}`, id: rel.id, relType: rel.relType ?? null })
  },

  usar(m, [res, tech], opts) {
    const sourceId = findResource(m, need(res, 'o recurso'))
    const targetId = findTechnology(m, need(tech, 'a tecnologia'))
    const existing = [...m.relations.values()].find((r) => r.kind === 'uses' && r.sourceId === sourceId && r.targetId === targetId)
    if (existing) return out(`${nameOf(m, sourceId)} já usa ${nameOf(m, targetId)} (${existing.id})`, { id: existing.id, actions: [] })
    const rel = { id: uid(), kind: 'uses', sourceId, targetId, label: '', protocol: '' }
    put(m, 'relations', rel)
    return finish(m, opts, { message: `${nameOf(m, sourceId)} usa ${nameOf(m, targetId)}: ${rel.id}`, id: rel.id })
  },

  desligar(m, [res, tech], opts) {
    const sourceId = findResource(m, need(res, 'o recurso'))
    const targetId = findTechnology(m, need(tech, 'a tecnologia'))
    const existing = [...m.relations.values()].find((r) => r.kind === 'uses' && r.sourceId === sourceId && r.targetId === targetId)
    if (!existing) throw new CliError(`${nameOf(m, sourceId)} não usa ${nameOf(m, targetId)}`)
    removeItems(m, [existing.id])
    return finish(m, opts)
  },

  editar(m, [ref], opts) {
    const id = findResourceOrTechnology(m, need(ref, 'o recurso ou tecnologia'))
    const t = m.technologies.get(id)
    if (t) {
      const next = { ...t }
      if (opts.nome !== undefined) {
        const same = sameName(m, m.technologies, opts.nome, id)
        if (same.length && !opts['permitir-repetido']) throw new CliError(`já existe a tecnologia ${opts.nome} (${same[0]})`)
        next.name = String(opts.nome)
      }
      if (opts.categoria !== undefined) next.category = String(opts.categoria)
      if (opts.descricao !== undefined) next.description = String(opts.descricao)
      put(m, 'technologies', next)
      return finish(m, opts, { id })
    }
    const r = m.resources.get(id)
    const next = { ...r }
    if (opts.tipo !== undefined) {
      const type = parseType(opts.tipo)
      if ((type === 'endpoint') !== (r.type === 'endpoint')) throw new CliError('não dá para transformar recurso em endpoint (ou o contrário): crie outro')
      next.type = type
    }
    if (r.type === 'endpoint') {
      if (opts.nome !== undefined) throw new CliError('o nome do endpoint é "<MÉTODO> <caminho>": use --metodo e --caminho')
      if (opts.metodo !== undefined) next.method = parseMethod(opts.metodo)
      if (opts.caminho !== undefined) next.path = String(opts.caminho).startsWith('/') ? String(opts.caminho) : `/${opts.caminho}`
      next.name = `${next.method} ${next.path}`
    } else if (opts.nome !== undefined) {
      const same = sameName(m, m.resources, opts.nome, id)
      if (same.length && !opts['permitir-repetido']) throw new CliError(`já existe recurso com esse nome (${same[0]}). Use --permitir-repetido para manter os dois.`)
      next.name = String(opts.nome)
    }
    if (opts.descricao !== undefined) next.description = String(opts.descricao)
    if (opts.responsavel !== undefined) next.owner = String(opts.responsavel)
    if (next.type !== r.type) {
      // Mudar o tipo pode tirar ligações do meta modelo: avisa, mas não muda as ligações (como o app)
      m.resources.set(id, next)
      const outside = [...m.relations.values()].filter((rel) => (rel.sourceId === id || rel.targetId === id) && metamodelProblem(m, rel))
      if (outside.length) console.error(`aviso: ${outside.length} ligação(ões) ficam fora do meta modelo:\n${outside.map((rel) => `  ${relationLine(m, rel)}`).join('\n')}`)
    }
    put(m, 'resources', next)
    return finish(m, opts, { id })
  },

  'editar-ligacao'(m, [ref], opts) {
    const id = findRelation(m, need(ref, 'o id da ligação'))
    const r = { ...m.relations.get(id) }
    if (r.kind === 'uses') throw new CliError('ligação "usa" não tem opções; use desligar/usar')
    if (opts.inverter) [r.sourceId, r.targetId] = [r.targetId, r.sourceId]
    if (opts.rotulo !== undefined) r.label = String(opts.rotulo)
    if (opts.protocolo !== undefined) r.protocol = String(opts.protocolo)
    applyRelationOptions(m, r, opts, true)
    put(m, 'relations', r)
    return finish(m, opts, { id, relType: r.relType ?? null })
  },

  remover(m, [ref], opts) {
    need(ref, 'o que remover')
    const id = m.relations.has(ref) ? ref : findResourceOrTechnology(m, ref)
    const label = m.relations.has(id) ? relationLine(m, m.relations.get(id)) : nameOf(m, id)
    const gone = removeItems(m, [id])
    return finish(m, opts, { message: `removido ${label}${gone.size > 1 ? ` (e ${gone.size - 1} ligação(ões))` : ''}`, removed: [...gone] })
  },

  desenho(m, [what, diagramRef, ...refs], opts) {
    const k = String(need(what, 'a ação (criar, colocar, tirar ou impacto)')).toLowerCase()
    if (k === 'criar') {
      const path = newDiagramPath(m, need(diagramRef, 'o caminho do desenho'))
      m.diagrams.set(path, { nodes: [], edges: [] })
      m.changedDiagrams.add(path)
      m.createdDiagrams.add(path)
      return finish(m, opts, { path })
    }
    const path = findDiagram(m, need(diagramRef, 'o desenho'))
    if (k === 'colocar') {
      const ids = refs.map((ref) => findResource(m, ref))
      if (!ids.length) throw new CliError('falta o recurso a colocar')
      const impact = opts.impacto !== undefined ? parseImpact(opts.impacto) : undefined
      updateDiagram(m, path, (d) => {
        const nodes = d.nodes.map((n) => (ids.includes(n.resourceId) && opts.impacto !== undefined ? setImpact(n, impact) : n))
        // Novos nós numa grade abaixo do que já existe (recurso ~240 × 70 px)
        const top = nodes.length ? Math.max(...nodes.map((n) => n.y + (n.height ?? 70))) + 120 : 0
        const left = nodes.length ? Math.min(...nodes.map((n) => n.x)) : 0
        const x0 = opts.x !== undefined ? Number(opts.x) : left
        const y0 = opts.y !== undefined ? Number(opts.y) : top
        let i = 0
        for (const id of ids) {
          if (nodes.some((n) => n.resourceId === id)) continue
          const node = { resourceId: id, x: Math.round(x0 + (i % 4) * 300), y: Math.round(y0 + Math.floor(i / 4) * 150) }
          nodes.push(impact ? { ...node, impact } : node)
          i++
        }
        return withImpliedEdges(m, { ...d, nodes })
      })
      return finish(m, opts, { path })
    }
    if (k === 'tirar') {
      const ids = new Set(refs.map((ref) => findResource(m, ref)))
      if (!ids.size) throw new CliError('falta o recurso a tirar')
      updateDiagram(m, path, (d) => {
        const edges = (d.edges ?? []).filter((e) => {
          const r = m.relations.get(e)
          return !r || (!ids.has(r.sourceId) && !ids.has(r.targetId))
        })
        const next = { ...d, nodes: d.nodes.filter((n) => !ids.has(n.resourceId)), edges }
        for (const field of ['edgeImpacts', 'anchors']) {
          if (!d[field]) continue
          const kept = Object.entries(d[field]).filter(([id]) => edges.includes(id))
          if (kept.length) next[field] = Object.fromEntries(kept)
          else delete next[field]
        }
        if (d.connectors) {
          const kept = d.connectors.filter((c) => !ids.has(c.source) && !ids.has(c.target))
          if (kept.length) next.connectors = kept
          else delete next.connectors
        }
        return next
      })
      return finish(m, opts, { path })
    }
    if (k === 'impacto') {
      const [ref, value] = refs
      const impact = parseImpact(need(value, `o impacto (${IMPACTS.join(', ')} ou nenhum)`))
      const d = m.diagrams.get(path)
      if (m.relations.has(need(ref, 'o recurso ou a ligação'))) {
        if (!(d.edges ?? []).includes(ref)) throw new CliError('essa ligação não está no desenho (coloque as duas pontas com `desenho colocar`)')
        updateDiagram(m, path, (d) => {
          const edgeImpacts = { ...d.edgeImpacts }
          if (impact) edgeImpacts[ref] = impact
          else delete edgeImpacts[ref]
          const next = { ...d, edgeImpacts }
          if (!Object.keys(edgeImpacts).length) delete next.edgeImpacts
          return next
        })
      } else {
        const id = findResource(m, ref)
        if (!d.nodes.some((n) => n.resourceId === id)) throw new CliError(`${nameOf(m, id)} não está no desenho (use \`desenho colocar\`)`)
        updateDiagram(m, path, (d) => ({ ...d, nodes: d.nodes.map((n) => (n.resourceId === id ? setImpact(n, impact) : n)) }))
      }
      return finish(m, opts, { path })
    }
    throw new CliError('desenho: use criar, colocar, tirar ou impacto')
  }
}

function setImpact(node, impact) {
  const { impact: _old, ...rest } = node
  return impact ? { ...rest, impact } : rest
}

/** --tipo, --acesso, --forca, --direcionada; respeita o meta modelo (tipo único é escolhido sozinho, como no app). */
function applyRelationOptions(m, rel, opts, editing = false) {
  if (opts.tipo !== undefined) {
    const relType = parseRelType(opts.tipo)
    if (relType) rel.relType = relType
    else delete rel.relType
  }
  if (!editing && rel.relType === undefined && m.metamodel) {
    const s = m.resources.get(rel.sourceId)
    const t = m.resources.get(rel.targetId)
    const allowed = allowedTypes(m.metamodel, s.type, t.type)
    if (allowed.length === 1) rel.relType = allowed[0]
  }
  const problem = metamodelProblem(m, rel)
  if (problem) throw new CliError(problem)

  if (opts.acesso !== undefined) {
    if (rel.relType !== 'access') throw new CliError('--acesso só vale com --tipo access')
    const mode = parseAccess(opts.acesso)
    if (mode === 'write') delete rel.accessMode
    else rel.accessMode = mode
  }
  if (opts.forca !== undefined) {
    if (rel.relType !== 'influence') throw new CliError('--forca só vale com --tipo influence')
    if (opts.forca) rel.strength = String(opts.forca)
    else delete rel.strength
  }
  if (opts.direcionada || opts['nao-direcionada']) {
    if (rel.relType !== 'association') throw new CliError('--direcionada só vale com --tipo association')
    if (opts.direcionada) rel.directed = true
    else delete rel.directed
  }
  // Campos que só valem para outro tipo saem (o arquivo não guarda campo opcional sem sentido)
  if (rel.relType !== 'access') delete rel.accessMode
  if (rel.relType !== 'influence') delete rel.strength
  if (rel.relType !== 'association') delete rel.directed
  // Ordem das chaves igual à do app
  const ordered = {}
  for (const k of ['id', 'kind', 'sourceId', 'targetId', 'label', 'protocol', 'relType', 'accessMode', 'strength', 'directed']) {
    if (rel[k] !== undefined) ordered[k] = rel[k]
  }
  for (const k of Object.keys(rel)) delete rel[k]
  Object.assign(rel, ordered)
}

// ---------- Principal ----------

function main(argv) {
  const { positional, opts } = parseArgs(argv)
  JSON_OUT = !!opts.json
  const [command, ...args] = positional
  if (!command || command === 'ajuda' || opts.ajuda || opts.help) return console.log(HELP)
  const root = resolve(String(opts.repo ?? process.env.MODELADOR_REPO ?? process.cwd()))
  if (command === 'validar') {
    const r = spawnSync(process.execPath, [VALIDAR, root], { stdio: 'inherit' })
    process.exit(r.status ?? 1)
  }
  const fn = Object.hasOwn(COMMANDS, command) ? COMMANDS[command] : undefined
  if (!fn) throw new CliError(`comando desconhecido "${command}". Veja \`modelador ajuda\`.`)
  fn(loadRepo(root), args, opts)
}

try {
  main(process.argv.slice(2))
} catch (e) {
  if (!(e instanceof CliError)) throw e
  if (JSON_OUT) console.log(JSON.stringify({ error: e.message }, null, 2))
  else console.error(`erro: ${e.message}`)
  process.exit(1)
}
