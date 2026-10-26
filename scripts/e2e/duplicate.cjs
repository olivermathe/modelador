/**
 * Aviso de recurso existente ao criar/renomear com um nome já usado.
 * Rode com `npm run test:e2e` (ou `electron scripts/e2e/duplicate.cjs` depois do build).
 */
const { run } = require('./harness.cjs')

run(async (t) => {
  await t.js(`
    window.$button = (text) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === text);
    window.$dialog = () => document.querySelector('[role="dialog"]');
    window.$nodes = () => document.querySelectorAll('.react-flow__node-element').length;
    // Simula arrastar um tipo da Paleta para o meio do desenho
    window.$dropNew = (type) => {
      const pane = document.querySelector('.react-flow');
      const r = pane.getBoundingClientRect();
      const dataTransfer = new DataTransfer();
      dataTransfer.setData('application/x-modelador', JSON.stringify({ kind: 'new', type }));
      pane.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer, clientX: r.x + r.width - 120, clientY: r.y + 80 }));
    };
    // Campo "Nome" do painel de propriedades
    window.$nameInput = () => [...document.querySelectorAll('label')].find((l) => l.textContent.startsWith('Nome'))?.querySelector('input');
    window.$rename = (value) => { const i = $nameInput(); i.focus(); $type(i, value); $blur(i) };
    0`)
  await t.js(`$row('Visão geral').click()`)
  await t.wait(800)
  t.markAllOld()

  t.step('novo recurso com nome existente: usar o existente')
  await t.js(`$dropNew('database')`)
  await t.wait(300)
  t.assert((await t.js(`$nodes()`)) === 7, 'recurso novo no desenho')
  await t.js(`$rename('base de pedidos')`)
  await t.wait(300)
  const text = await t.js(`$dialog()?.innerText ?? ''`)
  t.assert(text.includes('Já existe um recurso') && text.includes('Base de Pedidos'), 'aviso mostra o recurso existente')
  t.assert(text.includes('Criar novo mesmo'), 'recurso não salvo oferece "Criar novo mesmo"')
  await t.shot('aviso-recurso-existente.png')
  await t.js(`$button('Usar este').click()`)
  await t.wait(300)
  t.assert(!(await t.js(`!!$dialog()`)), 'aviso fecha')
  t.assert((await t.js(`$nodes()`)) === 6, 'o existente já estava no desenho: o novo some')
  t.assert((await t.js(`$nameInput()?.value`)) === 'Base de Pedidos', 'painel mostra o recurso existente')
  t.assert(t.changedFiles().length === 0, 'disco intacto antes do Salvar')
  await t.js(`$save()`)
  await t.wait(800)
  t.assert(t.changedFiles().length === 0, `nada gravado: o recurso novo foi descartado (${t.changedFiles()})`)

  t.step('renomear recurso salvo para nome existente: voltar ao nome anterior')
  await t.js(`[...document.querySelectorAll('.react-flow__node-element')].find((n) => n.textContent.includes('pedido-criado')).click()`)
  await t.wait(300)
  await t.js(`$rename('Base de Pedidos')`)
  await t.wait(300)
  t.assert(await t.js(`$dialog()?.innerText.includes('Manter os dois') ?? false`), 'recurso salvo oferece "Manter os dois"')
  await t.js(`$button('Voltar ao nome anterior').click()`)
  await t.wait(300)
  t.assert((await t.js(`$nameInput()?.value`)) === 'pedido-criado', 'nome anterior restaurado')

  t.step('renomear recurso salvo para nome existente: usar o existente')
  await t.js(`$rename('BASE DE PEDIDOS')`)
  await t.wait(300)
  await t.js(`$button('Usar este').click()`)
  await t.wait(300)
  t.assert((await t.js(`$nodes()`)) === 5, 'o recurso duplicado sai do desenho')
  await t.js(`$save()`)
  await t.wait(800)
  t.assert(!t.exists('aplicações/pedido-criado.json'), 'arquivo do recurso duplicado apagado')
  t.assert(t.exists('relações/base-de-pedidos--usa--kafka.json'), 'tecnologia passa para o existente')
  t.assert(!t.files().some((f) => f.includes('pedido-criado')), 'nenhuma relação aponta para o recurso apagado')
  const ids = new Set(t.files().filter((f) => f.startsWith('aplicações/') || f.startsWith('tecnologias/')).map((f) => JSON.parse(t.read(f)).id))
  const dangling = t.files().filter((f) => f.startsWith('relações/')).filter((f) => {
    const r = JSON.parse(t.read(f))
    return !ids.has(r.sourceId) || !ids.has(r.targetId)
  })
  t.assert(dangling.length === 0, `relações com pontas válidas (${dangling})`)

  t.step('novo recurso com nome existente: criar novo mesmo')
  await t.js(`$dropNew('database')`)
  await t.wait(300)
  await t.js(`$rename('Base de Pedidos')`)
  await t.wait(300)
  await t.js(`$button('Criar novo mesmo').click()`)
  await t.wait(300)
  t.assert((await t.js(`$nodes()`)) === 6, 'os dois ficam no desenho')
  await t.js(`$save()`)
  await t.wait(800)
  t.assert(t.exists('aplicações/base-de-pedidos-2.json'), 'novo recurso gravado como base-de-pedidos-2.json')

  t.step('nome sem duplicado não abre aviso')
  await t.js(`$rename('Base de Clientes')`)
  await t.wait(300)
  t.assert(!(await t.js(`!!$dialog()`)), 'sem aviso')

  const dialogs = await t.js(`JSON.stringify(window.__dialogs)`)
  t.assert(dialogs === '[]', `nenhum alerta inesperado (${dialogs})`)
})
