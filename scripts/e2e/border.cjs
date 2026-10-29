/**
 * Ligar em qualquer ponto da borda (sem mirar nas bolinhas): começar na borda, soltar no meio ou na
 * borda de outro recurso, e arrastar a ponta da seta para outro ponto da borda.
 * Rode com `npm run build && electron scripts/e2e/border.cjs`.
 */
const { run } = require('./harness.cjs')

run(async (t) => {
  await t.js(`$row('Visão geral').click()`)
  await t.wait(800)
  await t.js(`
    window.$node = (text) => [...document.querySelectorAll('.react-flow__node-element')].find((n) => n.textContent.includes(text));
    window.$box = (text) => $node(text).querySelector('.anchor-border').parentElement.getBoundingClientRect();
    window.$drag = (el, ax, ay, bx, by) => {
      const ev = (type, x, y, target) => target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, buttons: 1, view: window }));
      ev('mousedown', ax, ay, el);
      for (let i = 1; i <= 8; i++) ev('mousemove', ax + (bx - ax) * i / 8, ay + (by - ay) * i / 8, document);
      ev('mouseup', bx, by, document);
    };
    0`)

  t.step('faixas da borda só respondem com a ferramenta Ligar')
  const off = await t.js(`getComputedStyle($node('Portal do Cliente').querySelector('.anchor-border-top')).pointerEvents`)
  t.assert(off === 'none', `sem Ligar: ${off}`)
  await t.js(`document.querySelector('aside [aria-label="Serve"]').click()`)
  await t.wait(200)
  const on = await t.js(`getComputedStyle($node('Portal do Cliente').querySelector('.anchor-border-top')).pointerEvents`)
  t.assert(on !== 'none', `com Ligar: ${on}`)

  t.step('começar a 70% da borda de cima e soltar no meio de outro recurso')
  const before = await t.js(`document.querySelectorAll('.react-flow__edge').length`)
  await t.js(`{
    const a = $box('Portal do Cliente'), b = $box('pedido-criado');
    const strip = $node('Portal do Cliente').querySelector('.anchor-border-top');
    $drag(strip, a.left + a.width * 0.7, a.top, b.left + b.width / 2, b.top + b.height / 2 + 2);
  }`)
  await t.wait(500)
  const after = await t.js(`document.querySelectorAll('.react-flow__edge').length`)
  t.assert(after === before + 1, `nova ligação (${before} → ${after})`)
  await t.shot('borda.png')

  t.step('a seta encosta no ponto da borda onde começou')
  const gap = await t.js(`{
    const a = $box('Portal do Cliente');
    const handle = $node('Portal do Cliente').querySelector('[data-handleid="top@70"]');
    const h = handle && handle.getBoundingClientRect();
    h ? Math.abs(h.x + h.width / 2 - (a.left + a.width * 0.7)) : -1
  }`)
  t.assert(gap >= 0 && gap < 3, `ponto top@70 criado no lugar certo (distância ${gap})`)

  t.step('arrastar a ponta da seta para outro ponto da borda (lado esquerdo, 90%)')
  await t.js(`{
    // A ligação nova fica selecionada
    const sel = document.querySelector('.react-flow__edge.selected');
    const updater = sel.querySelector('.react-flow__edgeupdater-target');
    const u = updater.getBoundingClientRect(), b = $box('pedido-criado');
    $drag(updater, u.x + u.width / 2, u.y + u.height / 2, b.left + 1, b.top + b.height * 0.9);
  }`)
  await t.wait(500)

  t.step('salvar: pontos livres gravados no desenho')
  await t.js(`$save()`)
  await t.wait(800)
  const visao = JSON.parse(t.read('projetos/pedidos/Visão geral.json'))
  const anchors = Object.values(visao.anchors ?? {})
  t.assert(
    anchors.some((a) => a.source === 'top@70' && /^left@(8[89]|9[01])$/.test(a.target)),
    `top@70 → left@~90 (${JSON.stringify(visao.anchors)})`
  )
})
