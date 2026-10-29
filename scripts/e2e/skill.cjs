/**
 * Skill docs/skills/cadastrar-recursos-e-ligacoes: arquivos escritos à mão, seguindo a skill, abrem no app
 * e não são regravados nem renomeados no Salvar. Também roda o validador da skill.
 * Rode com `npm run build && electron scripts/e2e/skill.cjs`.
 */
const { execFileSync } = require('child_process')
const { readFileSync, writeFileSync } = require('fs')
const path = require('path')
const { run, REPO } = require('./harness.cjs')

const VALIDAR = path.join(__dirname, '../../docs/skills/cadastrar-recursos-e-ligacoes/validar.mjs')
const PEDIDO_CRIADO = '3f1c2a10-0000-4000-8000-000000000004'
const NODE_JS = '7a2b0000-0000-4000-8000-000000000002'
const ID = {
  servico: 'b1c2d3e4-0000-4000-8000-00000000a001',
  endpoint: 'b1c2d3e4-0000-4000-8000-00000000a002',
  dono: 'b1c2d3e4-0000-4000-8000-00000000a003',
  evento: 'b1c2d3e4-0000-4000-8000-00000000a004',
  usa: 'b1c2d3e4-0000-4000-8000-00000000a005'
}

const write = (rel, data) => writeFileSync(path.join(REPO, rel), JSON.stringify(data, null, 2) + '\n')
const validar = () => {
  try {
    return { code: 0, out: execFileSync('node', [VALIDAR, REPO], { encoding: 'utf-8' }) }
  } catch (e) {
    return { code: e.status, out: String(e.stdout) }
  }
}

run(async (t) => {
  t.step('escreve o exemplo da skill direto nos arquivos (sem a interface)')
  write('aplicações/notificacoes.json', {
    id: ID.servico, type: 'service', name: 'Notificações', description: 'Envia notificações.', owner: 'Time Pedidos', impact: 'new'
  })
  write('aplicações/notificacoes--post-notificacoes.json', {
    id: ID.endpoint, type: 'endpoint', name: 'POST /notificacoes', description: '', owner: 'Time Pedidos', impact: 'new',
    method: 'POST', path: '/notificacoes'
  })
  write('relações/notificacoes--post-notificacoes.json', {
    id: ID.dono, kind: 'flow', sourceId: ID.servico, targetId: ID.endpoint, label: '', protocol: '', relType: 'composition'
  })
  write('relações/pedido-criado--notificacoes.json', {
    id: ID.evento, kind: 'flow', sourceId: PEDIDO_CRIADO, targetId: ID.servico, label: 'Consome', protocol: 'Kafka',
    relType: 'flow', impact: 'new'
  })
  write('relações/notificacoes--usa--node-js.json', {
    id: ID.usa, kind: 'uses', sourceId: ID.servico, targetId: NODE_JS, label: '', protocol: ''
  })
  // Seção 8: colocar no desenho
  const visaoPath = 'projetos/pedidos/Visão geral.json'
  const visao = JSON.parse(readFileSync(path.join(REPO, visaoPath), 'utf-8'))
  visao.nodes.push({ resourceId: ID.servico, x: 900, y: 600 }, { resourceId: ID.endpoint, x: 900, y: 750 })
  visao.edges.push(ID.dono, ID.evento)
  write(visaoPath, visao)

  t.step('validador da skill: sem erros nem avisos')
  const v = validar()
  t.assert(v.code === 0 && / 0 erro\(s\), 0 aviso\(s\)/.test(v.out), `validar.mjs: ${v.out.trim().split('\n').pop()}`)

  t.step('o app lê os arquivos')
  t.menu('reload')
  await t.wait(800)
  await t.js(`$row('Visão geral').click()`)
  await t.wait(800)
  const node = await t.js(`!![...document.querySelectorAll('.react-flow__node-element')].find((n) => n.textContent.includes('Notificações') && n.textContent.includes('Node.js'))`)
  t.assert(node, 'Notificações no desenho, com a etiqueta Node.js')
  const endpoint = await t.js(`!![...document.querySelectorAll('.react-flow__node-element')].find((n) => n.textContent.includes('/notificacoes') && n.textContent.includes('de Notificações'))`)
  t.assert(endpoint, 'endpoint com o dono pela Composição')
  const edges = await t.js(`[...document.querySelectorAll('.react-flow__edge')].filter((e) => ['${ID.dono}', '${ID.evento}'].includes(e.dataset.id)).length`)
  t.assert(edges === 2, `as 2 setas no desenho (${edges})`)

  t.step('salvar não regrava nem renomeia nada')
  t.markAllOld()
  const before = t.files().join('\n')
  await t.js(`$save()`)
  await t.wait(800)
  t.assert(t.changedFiles().length === 0, `nenhum arquivo regravado (${t.changedFiles().join(', ')})`)
  t.assert(t.files().join('\n') === before, 'nenhum arquivo renomeado')

  t.step('validador acusa erros e avisos')
  write('relações/quebrada.json', { id: 'b1c2d3e4-0000-4000-8000-00000000a099', kind: 'flow', sourceId: ID.servico, targetId: 'nao-existe', label: '', protocol: '', impact: null })
  const bad = validar()
  t.assert(bad.code === 1 && /targetId nao-existe não é um recurso/.test(bad.out), 'referência quebrada é erro')
  t.assert(/impact" vazio/.test(bad.out) && /o app renomearia/.test(bad.out), 'campo vazio e nome de arquivo são avisos')
})
