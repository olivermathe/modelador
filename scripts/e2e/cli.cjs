/**
 * CLI bin/modelador (para agentes): cria, liga, renomeia, remove e coloca no desenho pela linha de comando;
 * o app abre o resultado e o Salvar não regrava nem renomeia nada. Também confere o bloqueio do meta modelo.
 * Rode com `npm run build && electron scripts/e2e/cli.cjs`.
 */
const { execFileSync } = require('child_process')
const path = require('path')
const { run, REPO } = require('./harness.cjs')

const CLI = path.join(__dirname, '../../bin/modelador.mjs')

/** Roda a CLI com --json; devolve { code, data } (data = saída em JSON). */
const cli = (...args) => {
  try {
    const out = execFileSync('node', [CLI, ...args, '--repo', REPO, '--json'], { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] })
    return { code: 0, data: JSON.parse(out) }
  } catch (e) {
    return { code: e.status, data: JSON.parse(String(e.stdout || '{}')) }
  }
}

run(async (t) => {
  t.step('criar serviço, endpoint, tecnologia e ligações pela CLI')
  const servico = cli('criar', 'recurso', '--tipo', 'servico', '--nome', 'Notificações', '--responsavel', 'Time Pedidos')
  t.assert(servico.code === 0 && t.exists('aplicações/notificacoes.json'), 'aplicações/notificacoes.json')
  t.assert(cli('criar', 'recurso', '--tipo', 'service', '--nome', 'notificacoes').code === 1, 'nome repetido é recusado')
  const endpoint = cli('criar', 'endpoint', '--dono', 'Notificações', '--metodo', 'post', '--caminho', '/notificacoes')
  t.assert(endpoint.code === 0 && t.exists('relações/notificacoes--post-notificacoes.json'), 'endpoint com Composição do dono')
  const tech = cli('criar', 'tecnologia', '--nome', 'RabbitMQ', '--categoria', 'Mensageria')
  t.assert(tech.code === 0 && t.exists('tecnologias/rabbitmq.json'), 'tecnologia criada')
  t.assert(cli('usar', 'Notificações', 'RabbitMQ').code === 0, 'Notificações usa RabbitMQ')
  const evento = cli('ligar', 'pedido-criado', 'Notificações', '--tipo', 'fluxo', '--rotulo', 'Consome', '--protocolo', 'Kafka')
  t.assert(evento.code === 0 && evento.data.relType === 'flow', 'pedido-criado → Notificações (Fluxo)')
  t.assert(cli('ligar', 'Notificações', 'pedido-criado').code === 1, 'ligação repetida é recusada')
  const proibida = cli('ligar', 'Portal do Cliente', 'Base de Pedidos', '--tipo', 'serve')
  t.assert(proibida.code === 1 && /meta modelo não permite Serve/.test(proibida.data.error), `meta modelo: ${proibida.data.error}`)

  t.step('renomear leva junto os arquivos das ligações e do endpoint')
  t.assert(cli('editar', 'Notificações', '--nome', 'Central de Notificações').code === 0, 'renomeado')
  for (const f of ['aplicações/central-de-notificacoes.json', 'aplicações/central-de-notificacoes--post-notificacoes.json',
    'relações/central-de-notificacoes--post-notificacoes.json', 'relações/pedido-criado--central-de-notificacoes.json',
    'relações/central-de-notificacoes--usa--rabbitmq.json']) {
    t.assert(t.exists(f), f)
  }
  t.assert(!t.exists('aplicações/notificacoes.json'), 'nome antigo saiu')

  t.step('colocar no desenho com impacto e remover um recurso')
  t.assert(cli('desenho', 'colocar', 'Visão geral', 'Central de Notificações', 'POST /notificacoes', '--impacto', 'novo').code === 0, 'colocado')
  t.assert(cli('desenho', 'impacto', 'Visão geral', evento.data.id, 'novo').code === 0, 'impacto da seta')
  const visao = JSON.parse(t.read('projetos/pedidos/Visão geral.json'))
  t.assert(visao.nodes.filter((n) => n.impact === 'new').length >= 2 && visao.edges.includes(evento.data.id), 'nós e seta no desenho')
  t.assert(visao.edgeImpacts[evento.data.id] === 'new', 'edgeImpacts da seta')
  t.assert(cli('remover', 'RabbitMQ').code === 0 && !t.exists('tecnologias/rabbitmq.json'), 'tecnologia removida')
  t.assert(!t.exists('relações/central-de-notificacoes--usa--rabbitmq.json'), 'ligação "usa" removida junto')

  t.step('validador: sem erros nem avisos')
  const v = execFileSync('node', [CLI, 'validar', '--repo', REPO], { encoding: 'utf-8' })
  t.assert(/ 0 erro\(s\), 0 aviso\(s\)/.test(v), v.trim().split('\n').pop())

  t.step('o app lê o resultado')
  t.menu('reload')
  await t.wait(800)
  await t.openDiagram('Visão geral')
  const node = await t.js(`!![...document.querySelectorAll('.react-flow__node-element')].find((n) => n.textContent.includes('Central de Notificações'))`)
  t.assert(node, 'Central de Notificações no desenho')
  const edge = await t.js(`!!document.querySelector('.react-flow__edge[data-id="${evento.data.id}"]')`)
  t.assert(edge, 'seta pedido-criado → Central de Notificações')

  t.step('salvar não regrava nem renomeia nada')
  t.markAllOld()
  const before = t.files().join('\n')
  await t.js(`$save()`)
  await t.wait(800)
  t.assert(t.changedFiles().length === 0, `nenhum arquivo regravado (${t.changedFiles().join(', ')})`)
  t.assert(t.files().join('\n') === before, 'nenhum arquivo renomeado')
})
