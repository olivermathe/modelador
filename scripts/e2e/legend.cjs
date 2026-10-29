/**
 * Legenda de impacto: arrastada da Paleta (Formas) para o desenho, mostra as 4 cores e é salva no desenho.
 * Rode com `npm run build && electron scripts/e2e/legend.cjs`.
 */
const { run } = require('./harness.cjs')

run(async (t) => {
  await t.js(`$row('Visão geral').click()`)
  await t.wait(800)

  t.step('legenda aparece na Paleta, junto das formas')
  t.assert(await t.js(`!!document.querySelector('aside [aria-label="Legenda de impacto"][draggable="true"]')`), 'item na Paleta')

  t.step('soltar a legenda no desenho')
  await t.js(`{
    const pane = document.querySelector('.react-flow'), r = pane.getBoundingClientRect(), dt = new DataTransfer();
    dt.setData('application/x-modelador', JSON.stringify({ kind: 'shape', shape: 'legend' }));
    pane.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt, clientX: r.x + 150, clientY: r.y + 650 }));
  }`)
  await t.wait(400)
  const rows = await t.js(`[...document.querySelectorAll('.react-flow__node-shape [data-impact]')].map((e) => e.textContent.trim())`)
  t.assert(rows.join(',') === 'Sem alteração,Novo,Alterado,Excluído', `4 impactos: ${rows.join(', ')}`)
  const green = await t.js(`!!document.querySelector('.react-flow__node-shape [data-impact="new"] .border-emerald-500')`)
  t.assert(green, 'Novo com borda verde')
  const title = await t.js(`[...document.querySelectorAll('.react-flow__node-shape')].find((n) => n.querySelector('[data-impact]')).textContent.startsWith('Legenda')`)
  t.assert(title, 'título "Legenda"')
  await t.shot('legenda.png')

  t.step('salvar: a legenda fica no desenho')
  await t.js(`$save()`)
  await t.wait(800)
  const visao = JSON.parse(t.read('projetos/pedidos/Visão geral.json'))
  const legend = visao.shapes.find((s) => s.kind === 'legend')
  t.assert(legend && legend.text === 'Legenda', `shape kind=legend gravada (${JSON.stringify(legend)})`)
})
