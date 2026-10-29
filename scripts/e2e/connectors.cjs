/**
 * Ligações só visuais entre formas (e forma ↔ recurso): ficam no desenho, não viram relação.
 * Rode com `npm run build && electron scripts/e2e/connectors.cjs`.
 */
const { run } = require('./harness.cjs')

run(async (t) => {
  await t.js(`$row('Persistência').click()`)
  await t.wait(800)
  await t.js(`
    window.$shapes = () => [...document.querySelectorAll('.react-flow__node-shape')];
    window.$node = (text) => [...document.querySelectorAll('.react-flow__node-element')].find((n) => n.textContent.includes(text));
    window.$edges = () => document.querySelectorAll('.react-flow__edge').length;
    // Apertar e soltar: o React Flow só reage a um novo Delete depois do keyup
    window.$pressDelete = () =>
      new Promise((done) => {
        document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
        setTimeout(() => {
          document.body.dispatchEvent(new KeyboardEvent('keyup', { key: 'Delete', bubbles: true }));
          done(0);
        }, 100);
      });
    window.$dropShape = (dx, dy) => {
      const pane = document.querySelector('.react-flow'), r = pane.getBoundingClientRect(), dt = new DataTransfer();
      dt.setData('application/x-modelador', JSON.stringify({ kind: 'shape', shape: 'rectangle' }));
      pane.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt, clientX: r.x + dx, clientY: r.y + dy }));
    };
    window.$link = (from, fromHandle, to, toHandle) => {
      const a = from.querySelector('[data-handleid="' + fromHandle + '"]').getBoundingClientRect();
      const b = to.querySelector('[data-handleid="' + toHandle + '"]').getBoundingClientRect();
      const ax = a.x + a.width / 2, ay = a.y + a.height / 2, bx = b.x + b.width / 2, by = b.y + b.height / 2;
      const src = from.querySelector('[data-handleid="' + fromHandle + '"]');
      const ev = (type, x, y, el) => el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, buttons: 1, view: window }));
      ev('mousedown', ax, ay, src);
      for (let i = 1; i <= 8; i++) ev('mousemove', ax + (bx - ax) * i / 8, ay + (by - ay) * i / 8, document);
      ev('mouseup', bx, by, document);
    };
    0`)
  const relationFiles = () => t.files().filter((f) => f.startsWith('relações/')).length
  const relBefore = relationFiles()

  t.step('duas formas e uma ligação entre elas')
  await t.js(`$dropShape(120, 120)`)
  await t.wait(200)
  await t.js(`$dropShape(460, 120)`)
  await t.wait(300)
  t.assert((await t.js(`$shapes().length`)) === 2, 'duas formas')
  t.assert((await t.js(`$shapes()[0].querySelectorAll('.anchor-point').length`)) === 16, 'forma tem 16 pontos de conexão')
  await t.js(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'l' }))`)
  await t.wait(200)
  const edges0 = await t.js(`$edges()`)
  await t.js(`$link($shapes()[0], 'right-2', $shapes()[1], 'left-2')`)
  await t.wait(400)
  t.assert((await t.js(`$edges()`)) === edges0 + 1, 'ligação visual aparece')
  t.assert(
    await t.js(`[...document.querySelectorAll('aside h2')].some((h) => h.textContent.includes('Ligação visual'))`),
    'painel de ligação visual'
  )

  t.step('estilo da ligação')
  await t.js(`$type([...document.querySelectorAll('aside label')].find((l) => l.textContent.startsWith('Rótulo')).querySelector('input'), 'fluxo do usuário')`)
  await t.js(`[...document.querySelectorAll('aside button')].find((b) => b.textContent === 'Tracejada').click()`)
  await t.js(`[...document.querySelectorAll('aside button')].find((b) => b.textContent === 'Nos dois lados').click()`)
  await t.wait(300)
  const style = await t.js(`{ const p = document.querySelector('.react-flow__edge.selected path'); JSON.stringify({ dash: p.style.strokeDasharray, start: !!p.getAttribute('marker-start'), label: document.querySelector('.react-flow__edge.selected').textContent }) }`)
  const st = JSON.parse(style)
  t.assert(st.dash && st.start && st.label.includes('fluxo do usuário'), `tracejada, seta nos dois lados, rótulo (${style})`)

  t.step('forma → recurso também é ligação visual')
  await t.js(`$link($shapes()[1], 'bottom-3', $node('Base de Pedidos'), 'top-3')`)
  await t.wait(400)
  t.assert(!(await t.js(`!!document.querySelector('[role="dialog"]')`)), 'sem pergunta de relação')
  t.assert((await t.js(`$edges()`)) === edges0 + 2, 'segunda ligação visual')

  t.step('salvar: nada em relações/, ligações no desenho')
  await t.js(`$save()`)
  await t.wait(800)
  t.assert(relationFiles() === relBefore, `nenhum arquivo novo em relações/ (${relBefore})`)
  const d = JSON.parse(t.read('projetos/pedidos/Persistência.json'))
  t.assert((d.connectors ?? []).length === 2, `2 ligações visuais no desenho (${(d.connectors ?? []).length})`)
  t.assert(d.connectors.some((c) => c.dashed && c.arrow === 'both' && c.label === 'fluxo do usuário'), 'estilo gravado')

  t.step('excluir a forma leva a ligação junto; Delete apaga a ligação')
  await t.js(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`)
  await t.js(`$shapes()[0].click()`)
  await t.wait(200)
  await t.js(`$pressDelete()`)
  await t.wait(300)
  t.assert((await t.js(`$edges()`)) === edges0 + 1, 'ligação da forma removida saiu junto')
  // A ligação que sobrou (forma → Base de Pedidos), pelo id gravado no desenho
  const remaining = d.connectors.find((c) => !c.dashed).id
  await t.js(`document.querySelector('[data-testid="rf__edge-${remaining}"]').dispatchEvent(new MouseEvent('click', { bubbles: true }))`)
  await t.wait(200)
  await t.js(`$pressDelete()`)
  await t.wait(300)
  t.assert((await t.js(`$edges()`)) === edges0, 'Delete apaga a ligação visual')

  const dialogs = await t.js(`JSON.stringify(window.__dialogs)`)
  t.assert(dialogs === '[]', `nenhum alerta inesperado (${dialogs})`)
})
