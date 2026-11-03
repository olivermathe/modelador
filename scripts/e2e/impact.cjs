/**
 * Impacto é do desenho (feature): o mesmo recurso/ligação pode ter impacto num desenho e não ter em outro.
 * Também a migração do formato antigo (impacto no arquivo do recurso/relação).
 * Rode com `npm run build && electron scripts/e2e/impact.cjs`.
 */
const { readFileSync, writeFileSync } = require('fs')
const path = require('path')
const { run, REPO } = require('./harness.cjs')

const API = '3f1c2a10-0000-4000-8000-000000000002'
const BASE = '3f1c2a10-0000-4000-8000-000000000003'
const PEDIDO_CRIADO = '3f1c2a10-0000-4000-8000-000000000004'
const API_PEDIDO_CRIADO = '9c3d0000-0000-4000-8000-000000000003'

run(async (t) => {
  await t.js(`
    window.$border = (id) => document.querySelector('.react-flow__node[data-id="' + id + '"] .border-2')?.className ?? '';
    window.$stroke = (id) => document.querySelector('.react-flow__edge[data-id="' + id + '"] path.react-flow__edge-path')?.style.stroke ?? '';
    0`)

  t.step('Visão geral: pedido-criado e a seta API → pedido-criado são Novos (verde)')
  await t.openDiagram('Visão geral')
  t.assert((await t.js(`$border('${PEDIDO_CRIADO}')`)).includes('border-emerald-500'), 'borda verde')
  const stroke = await t.js(`$stroke('${API_PEDIDO_CRIADO}')`)
  t.assert(/16, 185, 129|#10b981/.test(stroke), `seta verde (${stroke})`)

  t.step('levar pedido-criado para Persistência: entra sem impacto (cinza)')
  await t.openDiagram('Persistência')
  await t.js(`{
    const pane = document.querySelector('.react-flow'), r = pane.getBoundingClientRect(), dt = new DataTransfer();
    dt.setData('application/x-modelador', JSON.stringify({ kind: 'resource', id: '${PEDIDO_CRIADO}' }));
    pane.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt, clientX: r.x + 500, clientY: r.y + 200 }));
  }`)
  await t.until(`document.querySelector('.react-flow__edge[data-id="${API_PEDIDO_CRIADO}"]')`)
  await t.js(`document.querySelector('.react-flow__pane').click()`)
  await t.wait(200)
  const border = await t.js(`$border('${PEDIDO_CRIADO}')`)
  t.assert(border.includes('border-slate-300') && !border.includes('emerald'), `borda cinza (${border.match(/border-\w+-\d+/g)})`)
  const gray = await t.js(`$stroke('${API_PEDIDO_CRIADO}')`)
  t.assert(/148, 163, 184|#94a3b8/.test(gray), `seta cinza (${gray})`)

  t.step('marcar API de Pedidos como Alterado só em Persistência')
  await t.js(`document.querySelector('.react-flow__node[data-id="${API}"]').click()`)
  await t.until(`[...document.querySelectorAll('aside button')].some((b) => b.textContent === 'Alterado')`)
  const hint = await t.js(`[...document.querySelectorAll('aside')].at(-1).innerText.includes('Vale só neste desenho')`)
  t.assert(hint, 'painel avisa que vale só neste desenho')
  await t.js(`[...document.querySelectorAll('aside button')].find((b) => b.textContent === 'Alterado').click()`)
  await t.wait(200)
  t.assert((await t.js(`$border('${API}')`)).includes('border-amber-500'), 'API laranja em Persistência')
  await t.openDiagram('Visão geral')
  t.assert(!(await t.js(`$border('${API}')`)).includes('amber'), 'API continua sem impacto em Visão geral')

  t.step('recurso fora do desenho aberto: painel explica onde marcar')
  await t.openDiagram('Persistência')
  await t.js(`$row('portal-do-cliente').click()`)
  await t.until(`[...document.querySelectorAll('aside')].at(-1).innerText.includes('O impacto é de cada desenho')`, 2000)
  t.assert(await t.js(`[...document.querySelectorAll('aside')].at(-1).innerText.includes('O impacto é de cada desenho')`), 'aviso no painel')

  t.step('salvar: impacto vai no desenho, não no recurso')
  await t.js(`$save()`)
  await t.wait(800)
  const persistencia = JSON.parse(t.read('projetos/pedidos/Persistência.json'))
  t.assert(persistencia.nodes.find((n) => n.resourceId === API)?.impact === 'changed', 'Persistência: nó da API com impact "changed"')
  t.assert(!persistencia.nodes.find((n) => n.resourceId === PEDIDO_CRIADO)?.impact, 'Persistência: pedido-criado sem impacto')
  t.assert(!('impact' in JSON.parse(t.read('aplicações/api-de-pedidos.json'))), 'arquivo do recurso sem impact')
  const visao = JSON.parse(t.read('projetos/pedidos/Visão geral.json'))
  t.assert(visao.edgeImpacts?.[API_PEDIDO_CRIADO] === 'new', 'Visão geral mantém o impacto da seta em edgeImpacts')

  t.step('formato antigo: impacto no arquivo do recurso vai para os desenhos onde ele aparece')
  const baseFile = path.join(REPO, 'aplicações/base-de-pedidos.json')
  writeFileSync(baseFile, JSON.stringify({ ...JSON.parse(readFileSync(baseFile, 'utf-8')), impact: 'removed' }, null, 2) + '\n')
  t.menu('reload')
  await t.wait(800)
  await t.openDiagram('Visão geral')
  t.assert((await t.js(`$border('${BASE}')`)).includes('border-rose-500'), 'Visão geral: Base de Pedidos vermelha')
  await t.openDiagram('Persistência')
  t.assert((await t.js(`$border('${BASE}')`)).includes('border-rose-500'), 'Persistência: Base de Pedidos vermelha')
  await t.js(`$save()`)
  await t.wait(800)
  t.assert(!('impact' in JSON.parse(readFileSync(baseFile, 'utf-8'))), 'Salvar tira impact do recurso')
  const after = JSON.parse(t.read('projetos/pedidos/Persistência.json'))
  t.assert(after.nodes.find((n) => n.resourceId === BASE)?.impact === 'removed', 'e grava no nó do desenho')
})
