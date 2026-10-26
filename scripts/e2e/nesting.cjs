/**
 * Recurso dentro (ou em cima) de outro: as ligações entre eles somem do desenho,
 * mas continuam existindo. Rode com `npm run build && electron scripts/e2e/nesting.cjs`.
 */
const { run } = require('./harness.cjs')

const REL_API_FILA = '9c3d0000-0000-4000-8000-000000000003' // API de Pedidos → pedido-criado

run(async (t) => {
  await t.js(`$row('Visão geral').click()`)
  await t.wait(800)
  await t.js(`
    window.$node = (text) => [...document.querySelectorAll('.react-flow__node-element')].find((n) => n.textContent.includes(text));
    window.$edges = () => document.querySelectorAll('.react-flow__edge').length;
    // Arrasta o nó para que o centro dele caia no centro do outro (ou de volta, com dx/dy)
    window.$dragTo = (fromText, toX, toY) => {
      const el = $node(fromText), r = el.getBoundingClientRect();
      const x = r.x + r.width / 2, y = r.y + r.height / 2;
      const ev = (type, cx, cy, target) => target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: cx, clientY: cy, button: 0, buttons: 1, view: window }));
      ev('mousedown', x, y, el);
      for (let i = 1; i <= 10; i++) ev('mousemove', x + (toX - x) * i / 10, y + (toY - y) * i / 10, document);
      ev('mouseup', toX, toY, document);
    };
    window.$center = (text) => { const r = $node(text).getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2] };
    0`)

  const before = await t.js(`$edges()`)
  const origin = await t.js(`$center('pedido-criado')`)

  t.step('soltar pedido-criado dentro da API de Pedidos')
  await t.js(`{ const [x, y] = $center('API de Pedidos'); $dragTo('pedido-criado', x, y) }`)
  await t.wait(500)
  const inside = await t.js(`$edges()`)
  t.assert(inside === before - 1, `a seta entre os dois some (${before} → ${inside})`)
  const notice = await t.js(`document.querySelector('[role="status"]')?.textContent ?? ''`)
  t.assert(notice.includes('oculta'), `aviso: "${notice}"`)
  const zOrder = await t.js(`[getComputedStyle($node('pedido-criado')).zIndex, getComputedStyle($node('API de Pedidos')).zIndex].map(Number)`)
  t.assert(zOrder[0] > zOrder[1], `o recurso de dentro fica na frente (z ${zOrder[0]} > ${zOrder[1]})`)
  await t.shot('aninhado.png')

  t.step('a relação continua existindo')
  await t.js(`$save()`)
  await t.wait(800)
  const diagram = JSON.parse(t.read('projetos/pedidos/Visão geral.json'))
  t.assert(diagram.edges.includes(REL_API_FILA), 'continua nas ligações do desenho')
  t.assert(t.exists('relações/api-de-pedidos--pedido-criado.json'), 'arquivo da relação continua em relações/')
  await t.js(`[...document.querySelectorAll('aside span')].find((s) => s.textContent === 'relações').click()`)
  await t.wait(200)
  await t.js(`$row('api-de-pedidos--pedido-criado').click()`)
  await t.wait(300)
  const note = await t.js(`[...document.querySelectorAll('aside p')].some((p) => p.textContent.startsWith('Oculta neste desenho'))`)
  t.assert(note, 'painel da relação explica que está oculta')

  t.step('afastar faz a seta voltar')
  await t.js(`$dragTo('pedido-criado', ${origin[0]}, ${origin[1]})`)
  await t.wait(500)
  const outside = await t.js(`$edges()`)
  t.assert(outside === before, `seta de volta (${outside})`)

  t.step('endpoint dentro do serviço: as outras setas dele aparecem inteiras')
  // Aumenta a API para caber o endpoint dentro
  await t.js(`$node('API de Pedidos').click()`)
  await t.wait(200)
  await t.js(`{
    const h = $node('API de Pedidos').querySelector('.react-flow__resize-control.handle.bottom.right');
    const r = h.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2;
    const ev = (type, cx, cy, el) => el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: cx, clientY: cy, button: 0, buttons: 1, view: window }));
    ev('mousedown', x, y, h);
    for (let i = 1; i <= 10; i++) ev('mousemove', x + 12 * i, y + 14 * i, window);
    ev('mouseup', x + 120, y + 140, window);
  }`)
  await t.wait(400)
  const edgesBefore = await t.js(`$edges()`)
  await t.js(`{ const r = $node('API de Pedidos').getBoundingClientRect(); $dragTo('POST', r.x + r.width / 2, r.bottom - 30) }`)
  await t.wait(500)
  t.assert((await t.js(`$edges()`)) === edgesBefore - 1, 'só a seta API ↔ POST (sobrepostos) some')
  // A seta Portal → POST /pedidos precisa ficar acima da API, senão a API cobre o trecho até o endpoint
  const z = await t.js(`{
    const edge = document.querySelector('[data-id="9c3d0000-0000-4000-8000-000000000001"]') ?? document.querySelector('[data-testid="rf__edge-9c3d0000-0000-4000-8000-000000000001"]');
    const layer = edge.closest('svg');
    JSON.stringify({ edge: Number(getComputedStyle(layer).zIndex), api: Number(getComputedStyle($node('API de Pedidos')).zIndex) })
  }`)
  const zs = JSON.parse(z)
  t.assert(zs.edge > zs.api, `seta Portal → POST acima da API (z ${zs.edge} > ${zs.api})`)
  await t.shot('endpoint-dentro.png')

  const dialogs = await t.js(`JSON.stringify(window.__dialogs)`)
  t.assert(dialogs === '[]', `nenhum alerta inesperado (${dialogs})`)
})
