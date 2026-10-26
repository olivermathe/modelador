/**
 * Renomear recurso (e caminho de endpoint) com dois cliques no nome, no próprio desenho.
 * Rode com `npm run build && electron scripts/e2e/rename.cjs`.
 */
const { run } = require('./harness.cjs')

run(async (t) => {
  await t.js(`$row('Visão geral').click()`)
  await t.wait(800)
  await t.js(`
    window.$node = (text) => [...document.querySelectorAll('.react-flow__node-element')].find((n) => n.textContent.includes(text));
    window.$dbl = (el) => el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
    window.$nodeInput = () => document.querySelector('.react-flow__node-element input');
    // Enter confirma; com a janela oculta o blur não dispara sozinho, então o teste dispara o focusout
    window.$confirm = (value) => { const i = $nodeInput(); $type(i, value); $blur(i) };
    0`)

  t.step('dois cliques no nome abrem a edição')
  await t.js(`$dbl([...$node('Portal do Cliente').querySelectorAll('div')].find((d) => d.textContent === 'Portal do Cliente'))`)
  await t.wait(200)
  t.assert((await t.js(`$nodeInput()?.value`)) === 'Portal do Cliente', 'campo com o nome atual')

  t.step('confirmar renomeia o recurso')
  await t.js(`$confirm('Portal Web')`)
  await t.wait(300)
  t.assert(!(await t.js(`!!$nodeInput()`)), 'campo fecha')
  t.assert(!!(await t.js(`!!$node('Portal Web')`)), 'nó mostra o nome novo')
  t.assert(!!(await t.js(`!!$row('portal-web')`)), 'árvore já mostra o arquivo com o nome novo')

  t.step('Esc cancela')
  await t.js(`$dbl([...$node('Portal Web').querySelectorAll('div')].find((d) => d.textContent === 'Portal Web'))`)
  await t.wait(200)
  await t.js(`{ const i = $nodeInput(); $type(i, 'Outro nome'); i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); $blur(i) }`)
  await t.wait(300)
  t.assert(!!(await t.js(`!!$node('Portal Web')`)), 'nome não mudou')

  t.step('nome que já existe abre o aviso de recurso repetido')
  await t.js(`$dbl([...$node('Portal Web').querySelectorAll('div')].find((d) => d.textContent === 'Portal Web'))`)
  await t.wait(200)
  await t.js(`$confirm('Base de Pedidos')`)
  await t.wait(300)
  const dialog = await t.js(`document.querySelector('[role="dialog"]')?.innerText ?? ''`)
  t.assert(dialog.includes('Já existe um recurso com esse nome'), 'aviso de nome repetido aberto')
  await t.js(`[...document.querySelectorAll('[role="dialog"] button')].find((b) => b.textContent.includes('Voltar ao nome anterior')).click()`)
  await t.wait(300)
  t.assert(!!(await t.js(`!!$node('Portal Web')`)), 'voltou ao nome anterior')

  t.step('dois cliques no caminho de um endpoint')
  await t.js(`$dbl([...$node('POST').querySelectorAll('span')].find((s) => s.textContent === '/pedidos'))`)
  await t.wait(200)
  await t.js(`$confirm('/pedidos/novos')`)
  await t.wait(300)
  t.assert(!!(await t.js(`!!$node('/pedidos/novos')`)), 'caminho do endpoint atualizado')

  t.step('salvar')
  await t.js(`$save()`)
  await t.wait(800)
  t.assert(t.exists('aplicações/portal-web.json'), 'aplicações/portal-web.json')
  t.assert(t.exists('aplicações/api-de-pedidos--post-pedidos-novos.json'), 'arquivo do endpoint renomeado')

  const dialogs = await t.js(`JSON.stringify(window.__dialogs)`)
  t.assert(dialogs === '[]', `nenhum alerta inesperado (${dialogs})`)
})
