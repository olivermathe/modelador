/**
 * Aba Relacionamentos: com um recurso selecionado, lista os recursos ligados a ele; arrastar um item da
 * lista para o desenho o inclui (com a seta) e mantém a seleção.
 * Rode com `npm run build && electron scripts/e2e/relations-tab.cjs`.
 */
const { run } = require('./harness.cjs')

const API = '3f1c2a10-0000-4000-8000-000000000002'
const PEDIDO_CRIADO = '3f1c2a10-0000-4000-8000-000000000004'

run(async (t) => {
  await t.openDiagram('Persistência')
  await t.js(`
    window.$tabs = () => [...document.querySelectorAll('aside nav button')].map((b) => b.textContent.trim());
    window.$tab = (label) => [...document.querySelectorAll('aside nav button')].find((b) => b.textContent.includes(label));
    window.$items = () => [...document.querySelectorAll('[data-related]')];
    0`)

  t.step('sem recurso selecionado, não há a aba')
  t.assert(!(await t.js(`$tabs().some((x) => x.startsWith('Relacionamentos'))`)), `abas: ${await t.js(`$tabs().join(' | ')`)}`)

  t.step('selecionar API de Pedidos: aba com a contagem')
  await t.js(`document.querySelector('.react-flow__node[data-id="${API}"]').click()`)
  await t.wait(300)
  const label = await t.js(`$tab('Relacionamentos')?.textContent.trim()`)
  t.assert(label === 'Relacionamentos4', `aba "${label}"`)

  t.step('lista os recursos ligados, marcando os que já estão no desenho')
  await t.js(`$tab('Relacionamentos').click()`)
  await t.wait(200)
  const items = await t.js(`$items().map((li) => li.textContent + (li.querySelector('[aria-label="No desenho"]') ? ' ✓' : ''))`)
  t.assert(items.length === 4, `4 itens: ${items.join(' / ')}`)
  t.assert(items.some((x) => x.startsWith('Base de Pedidos') && x.endsWith('✓')), 'Base de Pedidos marcada como no desenho')
  t.assert(items.some((x) => x.startsWith('pedido-criado') && x.includes('Fluxo') && !x.endsWith('✓')), 'pedido-criado (Fluxo), fora do desenho')
  await t.shot('aba-relacionamentos.png')

  t.step('arrastar pedido-criado da lista para o desenho')
  const edgesBefore = await t.js(`document.querySelectorAll('.react-flow__edge').length`)
  await t.js(`{
    const li = document.querySelector('[data-related="${PEDIDO_CRIADO}"]');
    const dt = new DataTransfer();
    li.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }));
    const pane = document.querySelector('.react-flow'), r = pane.getBoundingClientRect();
    pane.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt, clientX: r.x + 500, clientY: r.y + 200 }));
    pane.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt, clientX: r.x + 500, clientY: r.y + 200 }));
  }`)
  await t.wait(400)
  t.assert(await t.js(`!!document.querySelector('.react-flow__node[data-id="${PEDIDO_CRIADO}"]')`), 'pedido-criado no desenho')
  const edgesAfter = await t.js(`document.querySelectorAll('.react-flow__edge').length`)
  t.assert(edgesAfter === edgesBefore + 1, `seta com a API apareceu sozinha (${edgesBefore} → ${edgesAfter})`)
  t.assert(await t.js(`$tab('Relacionamentos')?.className.includes('border-sky-500')`), 'continua na aba Relacionamentos')
  t.assert(
    await t.js(`!!document.querySelector('[data-related="${PEDIDO_CRIADO}"] [aria-label="No desenho"]')`),
    'pedido-criado agora marcado como no desenho (a seleção continua na API)'
  )

  t.step('filtro por texto: sem acento, por nome ou tipo da ligação')
  const shown = () => t.js(`$items().map((li) => li.querySelector('.text-sm').textContent)`)
  const count = () => t.js(`document.querySelector('[data-count]').textContent`)
  await t.js(`$type(document.querySelector('[aria-label="Filtrar relacionamentos"]'), 'composicao')`)
  await t.wait(200)
  t.assert((await shown()).join() === 'GET /pedidos/{id},POST /pedidos', `"composicao": ${(await shown()).join(', ')}`)
  t.assert((await count()) === '2 de 4', `contagem: ${await count()}`)
  await t.js(`$type(document.querySelector('[aria-label="Filtrar relacionamentos"]'), 'POST pedidos')`)
  await t.wait(200)
  t.assert((await shown()).join() === 'POST /pedidos', `"POST pedidos": ${(await shown()).join(', ')}`)
  await t.js(`$type(document.querySelector('[aria-label="Filtrar relacionamentos"]'), 'kafka nada')`)
  await t.wait(200)
  t.assert((await shown()).length === 0 && (await t.js(`document.body.innerText.includes('Nenhum recurso com esse filtro')`)), 'sem resultado: aviso')
  await t.js(`document.querySelector('[aria-label="Limpar filtro"]').click()`)
  await t.wait(200)
  t.assert((await shown()).length === 4, 'limpar volta os 4')

  t.step('filtro "só os que não estão no desenho"')
  await t.js(`[...document.querySelectorAll('aside label')].find((l) => l.textContent.includes('Só os que não estão')).querySelector('input').click()`)
  await t.wait(200)
  const missing = await shown()
  t.assert(missing.join() === 'GET /pedidos/{id},POST /pedidos', `faltam no desenho: ${missing.join(', ')}`)
  await t.shot('aba-relacionamentos-filtro.png')

  t.step('salvar grava o nó no desenho')
  await t.js(`$save()`)
  await t.wait(800)
  const persistencia = JSON.parse(t.read('projetos/pedidos/Persistência.json'))
  t.assert(persistencia.nodes.some((n) => n.resourceId === PEDIDO_CRIADO), 'nó gravado')
})
