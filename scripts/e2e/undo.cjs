/**
 * Desfazer/refazer (Ctrl+Z / ⌘Z). Rode com `npm run build && electron scripts/e2e/undo.cjs`.
 */
const { run } = require('./harness.cjs')

run(async (t) => {
  await t.js(`$row('Visão geral').click()`)
  await t.wait(800)
  await t.js(`
    window.$node = (text) => [...document.querySelectorAll('.react-flow__node-element')].find((n) => n.textContent.includes(text));
    window.$pos = (text) => { const r = $node(text).getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y)] };
    window.$drag = (text, dx, dy) => {
      const el = $node(text), r = el.getBoundingClientRect(), x = r.x + 20, y = r.y + 20;
      const ev = (type, cx, cy, target) => target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: cx, clientY: cy, button: 0, buttons: 1, view: window }));
      ev('mousedown', x, y, el);
      for (let i = 1; i <= 10; i++) ev('mousemove', x + dx * i / 10, y + dy * i / 10, document);
      ev('mouseup', x + dx, y + dy, document);
    };
    window.$nameInput = () => [...document.querySelectorAll('label')].find((l) => l.textContent.startsWith('Nome'))?.querySelector('input');
    window.$canUndo = () => !document.querySelector('[aria-label^="Desfazer"]').disabled;
    0`)

  t.step('atalhos registrados')
  const accels = t.editAccelerators()
  t.assert(accels.includes('CmdOrCtrl+Z'), `⌘Z / Ctrl+Z (${accels})`)
  if (process.platform === 'darwin') t.assert(accels.includes('Ctrl+Z'), 'Ctrl+Z também no Mac')
  t.assert(!(await t.js(`$canUndo()`)), 'nada para desfazer ao abrir')

  t.step('mover e desfazer')
  const start = await t.js(`$pos('pedido-criado')`)
  await t.js(`$drag('pedido-criado', 160, 60)`)
  await t.wait(800)
  const moved = await t.js(`$pos('pedido-criado')`)
  t.assert(moved[0] !== start[0], 'recurso saiu do lugar')
  t.menu('undo')
  await t.wait(300)
  t.assert(JSON.stringify(await t.js(`$pos('pedido-criado')`)) === JSON.stringify(start), 'um desfazer devolve o arrasto inteiro')
  t.menu('redo')
  await t.wait(300)
  t.assert(JSON.stringify(await t.js(`$pos('pedido-criado')`)) === JSON.stringify(moved), 'refazer move de novo')
  t.menu('undo')
  await t.wait(800)

  t.step('digitação seguida vira um passo só')
  await t.js(`$row('portal-do-cliente').click()`)
  await t.wait(300)
  for (const name of ['P', 'Po', 'Portal', 'Portal Web']) {
    await t.js(`$type($nameInput(), ${JSON.stringify(name)})`)
    await t.wait(60)
  }
  await t.js(`document.activeElement.blur(); document.querySelector('.react-flow__pane').dispatchEvent(new MouseEvent('click', { bubbles: true })); 0`)
  await t.wait(800)
  t.assert(!!(await t.js(`!!$node('Portal Web')`)), 'renomeado')
  t.menu('undo')
  await t.wait(300)
  t.assert(!!(await t.js(`!!$node('Portal do Cliente')`)), 'um desfazer volta ao nome original')

  t.step('campo de texto com foco: Ctrl+Z não desfaz o desenho')
  await t.js(`$row('portal-do-cliente').click()`)
  await t.wait(300)
  await t.js(`$nameInput().focus(); 0`)
  t.menu('undo')
  await t.wait(300)
  t.assert(!!(await t.js(`!!$node('Portal do Cliente')`)), 'o modelo não mudou')
  await t.js(`document.activeElement.blur(); 0`)

  t.step('excluir recurso e desfazer traz de volta com as ligações')
  const edgesBefore = await t.js(`document.querySelectorAll('.react-flow__edge').length`)
  await t.js(`$row('base-de-pedidos').click()`)
  await t.wait(300)
  await t.js(`[...document.querySelectorAll('aside button')].find((b) => b.textContent.includes('Excluir permanentemente')).click()`)
  await t.wait(200)
  await t.js(`[...document.querySelectorAll('[role="dialog"] button')].find((b) => b.textContent === 'Excluir permanentemente').click()`)
  await t.wait(800)
  t.assert(!(await t.js(`!!$node('Base de Pedidos')`)), 'recurso excluído')
  t.menu('undo')
  await t.wait(300)
  t.assert(!!(await t.js(`!!$node('Base de Pedidos')`)), 'recurso de volta')
  t.assert((await t.js(`document.querySelectorAll('.react-flow__edge').length`)) === edgesBefore, 'ligações de volta')

  t.step('desfazer depois de salvar')
  const original = t.read('aplicações/pedido-criado.json')
  await t.js(`$row('pedido-criado').click()`)
  await t.wait(300)
  await t.js(`$type($nameInput(), 'evento-pedido')`)
  await t.wait(800)
  await t.js(`$save()`)
  await t.wait(800)
  t.assert(t.exists('aplicações/evento-pedido.json'), 'renomeado em disco')
  t.menu('undo')
  await t.wait(300)
  const dirty = await t.js(`document.querySelector('header').innerText.includes('não salvo')`)
  t.assert(dirty, 'volta a ter alterações não salvas')
  await t.js(`$save()`)
  await t.wait(800)
  t.assert(t.exists('aplicações/pedido-criado.json') && !t.exists('aplicações/evento-pedido.json'), 'salvar grava o nome antigo de novo')
  t.assert(t.read('aplicações/pedido-criado.json') === original, 'arquivo idêntico ao original')

  const dialogs = await t.js(`JSON.stringify(window.__dialogs)`)
  t.assert(dialogs === '[]', `nenhum alerta inesperado (${dialogs})`)
})
