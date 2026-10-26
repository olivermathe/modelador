/**
 * Direção das ligações: segue o arrasto (sem inverter sozinha) e "Inverter direção".
 * Rode com `npm run build && electron scripts/e2e/direction.cjs`.
 */
const { run } = require('./harness.cjs')

const GET = '5e9d0000-0000-4000-8000-000000000002' // GET /pedidos/{id}
const PORTAL = '3f1c2a10-0000-4000-8000-000000000001'

run(async (t) => {
  await t.js(`$row('Visão geral').click()`)
  await t.wait(800)
  await t.js(`
    window.$node = (text) => [...document.querySelectorAll('.react-flow__node-element')].find((n) => n.textContent.includes(text));
    window.$header = () => [...[...document.querySelectorAll('aside')].at(-1).querySelectorAll('header button')].map((b) => b.textContent.trim());
    0`)

  t.step('Serve arrastado do endpoint para o Portal: o endpoint é a origem')
  await t.js(`document.querySelector('aside [aria-label="Serve"]').click()`)
  await t.wait(200)
  await t.js(`{
    const from = $node('GET').querySelector('[data-handleid="right-2"]');
    const to = $node('Portal do Cliente').querySelector('[data-handleid="left-2"]');
    const a = from.getBoundingClientRect(), b = to.getBoundingClientRect();
    const ax = a.x + a.width / 2, ay = a.y + a.height / 2, bx = b.x + b.width / 2, by = b.y + b.height / 2;
    const ev = (type, x, y, el) => el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, buttons: 1, view: window }));
    ev('mousedown', ax, ay, from);
    for (let i = 1; i <= 8; i++) ev('mousemove', ax + (bx - ax) * i / 8, ay + (by - ay) * i / 8, document);
    ev('mouseup', bx, by, document);
  }`)
  await t.wait(400)
  const header = await t.js(`$header()`)
  t.assert(header[0] === 'GET /pedidos/{id}' && header[1] === 'Portal do Cliente', `origem → destino: ${header.slice(0, 2).join(' → ')}`)

  t.step('botão direito na ligação: Inverter direção')
  await t.js(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`)
  await t.js(`{ const e = document.querySelector('.react-flow__edge.selected'); const r = e.getBoundingClientRect(); e.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 })) }`)
  await t.wait(200)
  await t.js(`[...document.querySelectorAll('.fixed.z-50 button')].find((b) => b.textContent.includes('Inverter direção')).click()`)
  await t.wait(300)
  const reversed = await t.js(`$header()`)
  t.assert(reversed[0] === 'Portal do Cliente', `invertida: ${reversed.slice(0, 2).join(' → ')}`)

  t.step('botão do painel desinverte')
  await t.js(`[...document.querySelectorAll('aside button')].find((b) => b.textContent.includes('Inverter direção')).click()`)
  await t.wait(300)
  t.assert((await t.js(`$header()`))[0] === 'GET /pedidos/{id}', 'voltou')

  t.step('salvar')
  await t.js(`$save()`)
  await t.wait(800)
  const file = t.files().find((f) => f.startsWith('relações/') && JSON.parse(t.read(f)).relType === 'serving')
  const rel = file && JSON.parse(t.read(file))
  t.assert(rel && rel.sourceId === GET && rel.targetId === PORTAL, `arquivo: ${file} (${rel && rel.sourceId === GET ? 'endpoint → portal' : 'errado'})`)
})
