/**
 * Seleção por retângulo, Shift+clique, mover em grupo e travar objetos.
 * Rode com `npm run build && electron scripts/e2e/select.cjs`.
 */
const { run } = require('./harness.cjs')

run(async (t) => {
  await t.js(`$row('Visão geral').click()`)
  await t.wait(800)
  await t.js(`
    window.$node = (text) => [...document.querySelectorAll('.react-flow__node-element')].find((n) => n.textContent.includes(text));
    window.$box = () => document.querySelector('.react-flow__node-shape');
    window.$selected = () => [...document.querySelectorAll('.react-flow__node.selected')].map((n) => n.textContent.trim().slice(0, 20));
    window.$center = (el) => { const r = el.getBoundingClientRect(); return [Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2)] };
    // Arrasto com eventos de ponteiro e de mouse (o React Flow usa os dois)
    window.$drag = (target, x1, y1, x2, y2) => {
      const opts = (x, y, buttons) => ({ bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, buttons, pointerId: 1, isPrimary: true, view: window });
      target.dispatchEvent(new PointerEvent('pointerdown', opts(x1, y1, 1)));
      target.dispatchEvent(new MouseEvent('mousedown', opts(x1, y1, 1)));
      for (let i = 1; i <= 10; i++) {
        const x = x1 + (x2 - x1) * i / 10, y = y1 + (y2 - y1) * i / 10;
        target.dispatchEvent(new PointerEvent('pointermove', opts(x, y, 1)));
        document.dispatchEvent(new MouseEvent('mousemove', opts(x, y, 1)));
      }
      target.dispatchEvent(new PointerEvent('pointerup', opts(x2, y2, 0)));
      document.dispatchEvent(new MouseEvent('mouseup', opts(x2, y2, 0)));
    };
    0`)

  t.step('travar o contêiner pelo botão direito')
  await t.js(`{ const r = $box().getBoundingClientRect(); $box().dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.x + 30, clientY: r.y + 60 })) }`)
  await t.wait(200)
  await t.js(`[...document.querySelectorAll('.fixed.z-50 button')].find((b) => b.textContent.startsWith('Travar')).click()`)
  await t.wait(300)
  t.assert((await t.js(`getComputedStyle($box()).pointerEvents`)) === 'none', 'travado: o mouse atravessa')
  t.assert(!!(await t.js(`!!$box().querySelector('[aria-label="Destravar"]')`)), 'cadeado aparece')

  t.step('retângulo de seleção (por cima do contêiner travado)')
  await t.js(`{
    const a = $node('Base de Pedidos').getBoundingClientRect(), b = $node('pedido-criado').getBoundingClientRect();
    $drag(document.querySelector('.react-flow__pane'), a.x - 15, Math.min(a.y, b.y) - 15, b.right + 15, Math.max(a.bottom, b.bottom) + 15);
  }`)
  await t.wait(400)
  const sel = await t.js(`$selected()`)
  t.assert(sel.length === 2, `2 recursos selecionados (${sel})`)
  t.assert(
    await t.js(`[...document.querySelectorAll('aside h2')].some((h) => h.textContent.includes('2 itens selecionados'))`),
    'painel de vários itens (sem as ligações que só encostam num dos dois)'
  )

  t.step('Shift+clique soma à seleção')
  // O React Flow sabe do Shift pelo teclado: segura, clica, solta
  await t.js(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift', code: 'ShiftLeft', shiftKey: true, bubbles: true }))`)
  await t.js(`$node('Portal do Cliente').dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }))`)
  await t.js(`document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Shift', code: 'ShiftLeft', bubbles: true }))`)
  await t.wait(300)
  t.assert((await t.js(`$selected().length`)) === 3, 'agora 3 selecionados')

  t.step('arrastar um move o grupo')
  const before = await t.js(`[$center($node('Base de Pedidos')), $center($node('Portal do Cliente'))]`)
  await t.js(`{ const [x, y] = $center($node('Base de Pedidos')); $drag($node('Base de Pedidos'), x, y, x + 80, y + 40) }`)
  await t.wait(400)
  const after = await t.js(`[$center($node('Base de Pedidos')), $center($node('Portal do Cliente'))]`)
  const dBase = [after[0][0] - before[0][0], after[0][1] - before[0][1]]
  const dPortal = [after[1][0] - before[1][0], after[1][1] - before[1][1]]
  t.assert(dBase[0] > 20 && JSON.stringify(dBase) === JSON.stringify(dPortal), `os dois andaram igual (${dBase} / ${dPortal})`)

  t.step('item travado não move nem seleciona')
  const boxBefore = await t.js(`$center($box())`)
  await t.js(`document.querySelector('.react-flow__pane').dispatchEvent(new MouseEvent('click', { bubbles: true }))`)
  await t.wait(200)
  await t.js(`{ const [x, y] = $center($box()); $drag($box(), x, y, x + 100, y + 100) }`)
  await t.wait(300)
  t.assert(JSON.stringify(await t.js(`$center($box())`)) === JSON.stringify(boxBefore), 'contêiner não saiu do lugar')
  t.assert(!(await t.js(`$box().classList.contains('selected')`)), 'nem foi selecionado')

  t.step('trava é gravada no desenho')
  await t.js(`$save()`)
  await t.wait(800)
  const diagram = JSON.parse(t.read('projetos/pedidos/Visão geral.json'))
  t.assert(diagram.shapes.some((s) => s.locked === true), 'shapes[].locked = true')

  t.step('botão direito no item travado mostra "Destravar"')
  await t.js(`{
    const r = $box().getBoundingClientRect(), x = r.x + 40, y = r.bottom - 30;
    // O item travado deixa o mouse passar: o evento chega ao fundo do desenho, como no app
    document.querySelector('.react-flow__pane').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: x, clientY: y }));
  }`)
  await t.wait(200)
  const lockedMenu = await t.js(`[...document.querySelectorAll('.fixed.z-50 button')].map((b) => b.querySelector('span')?.textContent).filter(Boolean)`)
  t.assert(lockedMenu.includes('Destravar'), `menu do travado: ${lockedMenu}`)
  await t.js(`[...document.querySelectorAll('.fixed.z-50 button')].find((b) => b.textContent.includes('Destravar')).click()`)
  await t.wait(300)
  t.assert((await t.js(`getComputedStyle($box()).pointerEvents`)) !== 'none', 'destravado pelo menu')
  await t.js(`{ const r = $box().getBoundingClientRect(); $box().dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.x + 40, clientY: r.bottom - 30 })) }`)
  await t.wait(200)
  await t.js(`[...document.querySelectorAll('.fixed.z-50 button')].find((b) => b.textContent.startsWith('Travar')).click()`)
  await t.wait(300)

  t.step('clicar no cadeado destrava')
  await t.js(`$box().querySelector('[aria-label="Destravar"]').click()`)
  await t.wait(300)
  t.assert((await t.js(`getComputedStyle($box()).pointerEvents`)) !== 'none', 'destravado')

  const dialogs = await t.js(`JSON.stringify(window.__dialogs)`)
  t.assert(dialogs === '[]', `nenhum alerta inesperado (${dialogs})`)
})
