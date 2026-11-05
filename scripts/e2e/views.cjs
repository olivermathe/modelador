/**
 * Visões do desenho (abas no canto): Impacto (cor = impacto) e Conformidade (verde = segue o meta modelo,
 * vermelho = não segue). A legenda acompanha a visão.
 * Rode com `npm run build && electron scripts/e2e/views.cjs`.
 */
const { run } = require('./harness.cjs')

const API = '3f1c2a10-0000-4000-8000-000000000002'
const BASE = '3f1c2a10-0000-4000-8000-000000000003'
const PORTAL = '3f1c2a10-0000-4000-8000-000000000001'
const GET = '5e9d0000-0000-4000-8000-000000000002'
const GREEN = 'rgb(16, 185, 129)'
const RED = 'rgb(244, 63, 94)'

run(async (t) => {
  const apiBase = JSON.parse(t.read('relações/api-de-pedidos--base-de-pedidos.json')).id
  await t.openDiagram('Visão geral')
  await t.js(`
    window.$tab = (label) => [...document.querySelectorAll('[role="tablist"][aria-label="Visão"] [role="tab"]')].find((b) => b.textContent.includes(label));
    window.$border = (id) => (document.querySelector('.react-flow__node[data-id="' + id + '"] .border-2').className.match(/border-(slate|emerald|amber|rose)-\\d+/) ?? [''])[0];
    window.$stroke = (id) => getComputedStyle(document.querySelector('.react-flow__edge[data-id="' + id + '"] path.react-flow__edge-path')).stroke;
    window.$legend = () => [...document.querySelectorAll('.react-flow__node-shape [data-impact], .react-flow__node-shape [data-conformance]')].map((e) => e.textContent.trim()).join(',');
    0`)

  t.step('abas no canto do desenho, Impacto selecionada')
  t.assert(await t.js(`$tab('Impacto')?.getAttribute('aria-selected') === 'true'`), 'Impacto selecionada')
  t.assert(await t.js(`!!$tab('Conformidade')`), 'aba Conformidade')
  const getImpact = await t.js(`$border('${GET}')`)
  t.assert(getImpact === 'border-amber-500', `GET com a cor de Alterado (${getImpact})`)

  t.step('legenda no desenho mostra os impactos')
  await t.js(`{
    const pane = document.querySelector('.react-flow'), r = pane.getBoundingClientRect(), dt = new DataTransfer();
    dt.setData('application/x-modelador', JSON.stringify({ kind: 'shape', shape: 'legend' }));
    pane.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt, clientX: r.x + 150, clientY: r.y + 650 }));
  }`)
  await t.until(`$legend()`)
  t.assert((await t.js(`$legend()`)) === 'Sem alteração,Novo,Alterado,Excluído', `legenda: ${await t.js(`$legend()`)}`)

  t.step('tirar Acesso de Serviço → Banco no meta modelo (API → Base fica fora)')
  await t.js(`[...document.querySelectorAll('header button')].find((b) => b.textContent.includes('Meta modelo')).click()`)
  await t.until(`document.querySelector('[aria-label="Meta modelo"] [data-cell="service>database"]')`)
  await t.js(`document.querySelector('[aria-label="Meta modelo"] [data-cell="service>database"]').click()`)
  await t.wait(150)
  await t.js(`document.querySelector('[data-cell-editor] input[data-type="access"]').click()`)
  await t.wait(150)
  await t.js(`[...document.querySelectorAll('[aria-label="Meta modelo"] button')].find((b) => b.textContent.includes('Fechar')).click()`)
  await t.wait(200)
  t.assert((await t.js(`$stroke('${apiBase}')`)) !== RED, 'na visão de impacto nada fica vermelho por conformidade')

  t.step('visão de conformidade: verde conforme, vermelho não conforme')
  await t.js(`$tab('Conformidade').click()`)
  await t.wait(300)
  t.assert(await t.js(`$tab('Conformidade').getAttribute('aria-selected') === 'true'`), 'Conformidade selecionada')
  t.assert((await t.js(`document.querySelector('[data-outside-diagram]')?.textContent`)) === '1', 'aba mostra 1 ligação fora')
  t.assert((await t.js(`$stroke('${apiBase}')`)) === RED, `API → Base vermelha (${await t.js(`$stroke('${apiBase}')`)})`)
  const others = await t.js(`[...document.querySelectorAll('.react-flow__edge')].filter((e) => !e.dataset.id.includes('${apiBase}') && !e.classList.contains('selected')).map((e) => getComputedStyle(e.querySelector('path.react-flow__edge-path')).stroke)`)
  t.assert(others.length > 0 && others.every((c) => c === GREEN), `demais ligações verdes (${[...new Set(others)].join(', ')})`)
  t.assert((await t.js(`$border('${BASE}')`)) === 'border-rose-500', 'Base de Pedidos vermelha')
  t.assert((await t.js(`$border('${API}')`)) === 'border-rose-500', 'API de Pedidos vermelha')
  t.assert((await t.js(`$border('${PORTAL}')`)) === 'border-emerald-500', 'Portal verde')
  t.assert((await t.js(`$border('${GET}')`)) === 'border-emerald-500', 'GET verde (o impacto Alterado não aparece)')
  t.assert((await t.js(`$legend()`)) === 'Conforme,Não conforme', `legenda: ${await t.js(`$legend()`)}`)
  t.assert(await t.js(`!!document.querySelector('.react-flow__node-shape [data-conformance="false"] .border-rose-500')`), 'legenda: Não conforme em vermelho')
  await t.shot('visao-conformidade.png')

  t.step('voltar para Impacto')
  await t.js(`$tab('Impacto').click()`)
  await t.wait(300)
  t.assert((await t.js(`$border('${GET}')`)) === 'border-amber-500', 'GET volta à cor de Alterado')
  t.assert((await t.js(`$legend()`)) === 'Sem alteração,Novo,Alterado,Excluído', 'legenda volta aos impactos')

  t.step('a visão não vai para os arquivos')
  await t.js(`$tab('Conformidade').click()`)
  await t.js(`$save()`)
  await t.wait(800)
  const visao = t.read('projetos/pedidos/Visão geral.json')
  t.assert(!/conform|view/i.test(visao), 'desenho sem campo de visão')
})
