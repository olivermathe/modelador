/**
 * Endpoints repetidos, ferramenta Ligar com pontos de conexão e "Nova feature".
 * Rode com `npm run build && electron scripts/e2e/features.cjs`.
 */
const { run } = require('./harness.cjs')

run(async (t) => {
  await t.js(`$row('Visão geral').click()`)
  await t.wait(800)
  await t.js(`window.$node = (text) => [...document.querySelectorAll('.react-flow__node-element')].find((n) => n.textContent.includes(text)); 0`)

  await t.js(`window.$choice = () => document.querySelector('[role="dialog"]'); window.$pick = (label) => [...$choice().querySelectorAll('button')].find((b) => b.textContent.trim() === label).click(); 0`)

  t.step('endpoint repetido (pelas ligações do recurso): pergunta')
  await t.js(`$row('api-de-pedidos').click()`)
  await t.wait(300)
  await t.js(`[...document.querySelectorAll('aside button')].find((b) => b.textContent.trim() === 'Adicionar').click()`)
  await t.wait(200)
  // Mesmo método e caminho de GET /pedidos/{id}, com outro nome de parâmetro e barra final
  await t.js(`$type(document.querySelector('input[placeholder="/caminho/{id}"]'), '/Pedidos/{pedidoId}/')`)
  await t.js(`document.querySelector('[title="Criar endpoint (Enter)"]').click()`)
  await t.wait(200)
  const question = await t.js(`[...document.querySelectorAll('aside p')].some((p) => p.textContent.includes('Este recurso já está ligado a'))`)
  const options = await t.js(`[...document.querySelectorAll('aside button')].map((b) => b.textContent.trim()).filter((t) => t.startsWith('Usar o existente') || t.startsWith('Criar novo')).join(' | ')`)
  t.assert(question && options === 'Usar o existente | Criar novo, manter os dois', `pergunta usar o existente ou criar novo (${options})`)

  t.step('endpoint novo é criado como recurso próprio no desenho')
  const nodesBefore = await t.js(`document.querySelectorAll('.react-flow__node-element').length`)
  await t.js(`$type(document.querySelector('input[placeholder="/caminho/{id}"]'), '/pedidos/{id}/itens')`)
  await t.js(`document.querySelector('[title="Criar endpoint (Enter)"]').click()`)
  await t.wait(300)
  const nodesAfter = await t.js(`document.querySelectorAll('.react-flow__node-element').length`)
  t.assert(nodesAfter === nodesBefore + 1, `endpoint entrou no desenho como nó (${nodesBefore} → ${nodesAfter})`)
  t.assert(!!(await t.js(`!!$node('/pedidos/{id}/itens')`)), 'nó do endpoint mostra o caminho')
  t.assert((await t.js(`$node('API de Pedidos').querySelectorAll('li').length`)) === 0, 'o serviço não lista endpoints dentro dele')

  t.step('renomear para rota que o recurso já tem: pergunta; cancelar volta ao valor anterior')
  await t.js(`$row('api-de-pedidos').click()`)
  await t.wait(300)
  await t.js(`{
    const i = [...document.querySelectorAll('aside input')].find((x) => x.value === '/pedidos/{id}/itens');
    $type(i, '/pedidos/{x}'); i.dispatchEvent(new FocusEvent('blur')); i.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
  }`)
  await t.wait(300)
  t.assert((await t.js(`$choice()?.getAttribute('aria-label')`)) === 'Esse endpoint já existe', 'pergunta usar o existente ou manter os dois')
  await t.js(`$pick('Cancelar')`)
  await t.wait(300)
  const reverted = await t.js(`[...document.querySelectorAll('aside input')].some((x) => x.value === '/pedidos/{id}/itens')`)
  t.assert(reverted, 'cancelar volta ao caminho anterior')

  t.step('pontos de conexão só com a ferramenta Ligar')
  const handles = await t.js(`$node('Portal do Cliente').querySelectorAll('.anchor-point').length`)
  t.assert(handles === 16, `16 pontos de conexão por recurso (${handles})`)
  const hidden = await t.js(`getComputedStyle($node('Portal do Cliente').querySelector('.anchor-point')).opacity`)
  t.assert(hidden === '0', `escondidos na ferramenta Selecionar (opacidade ${hidden})`)
  await t.js(`document.querySelector('.react-flow__pane').dispatchEvent(new MouseEvent('click', { bubbles: true })); 0`)
  await t.js(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'l' }))`)
  await t.wait(200)
  const shown = await t.js(`getComputedStyle($node('Portal do Cliente').querySelector('.anchor-point')).opacity`)
  t.assert(shown === '1', `visíveis com Ligar (opacidade ${shown})`)

  t.step('ligar por pontos específicos guarda os pontos no desenho')
  const edgesBefore = await t.js(`document.querySelectorAll('.react-flow__edge').length`)
  await t.js(`{
    const from = $node('Portal do Cliente').querySelector('[data-handleid="right-1"]');
    const to = $node('pedido-criado').querySelector('[data-handleid="top-5"]');
    const a = from.getBoundingClientRect(), b = to.getBoundingClientRect();
    const ax = a.x + a.width / 2, ay = a.y + a.height / 2, bx = b.x + b.width / 2, by = b.y + b.height / 2;
    const ev = (type, x, y, el) => el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, buttons: 1, view: window }));
    ev('mousedown', ax, ay, from);
    for (let i = 1; i <= 8; i++) ev('mousemove', ax + (bx - ax) * i / 8, ay + (by - ay) * i / 8, document);
    ev('mouseup', bx, by, document);
  }`)
  await t.wait(400)
  const edgesAfter = await t.js(`document.querySelectorAll('.react-flow__edge').length`)
  t.assert(edgesAfter === edgesBefore + 1, `nova ligação no desenho (${edgesBefore} → ${edgesAfter})`)

  t.step('ligação já existente: pergunta usar a existente ou criar nova')
  await t.js(`[...document.querySelectorAll('aside nav button')].find((b) => b.textContent.includes('Paleta')).click()`)
  await t.wait(200)
  await t.js(`document.querySelector('aside [aria-label="Disparo"]').click()`)
  await t.wait(200)
  const before2 = await t.js(`document.querySelectorAll('.react-flow__edge').length`)
  // Portal → POST /pedidos (Disparo) já existe no exemplo
  await t.js(`{
    const from = $node('Portal do Cliente').querySelector('[data-handleid="left-2"]');
    const to = $node('POST').querySelector('[data-handleid="top-3"]');
    const a = from.getBoundingClientRect(), b = to.getBoundingClientRect();
    const ax = a.x + a.width / 2, ay = a.y + a.height / 2, bx = b.x + b.width / 2, by = b.y + b.height / 2;
    const ev = (type, x, y, el) => el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, buttons: 1, view: window }));
    ev('mousedown', ax, ay, from);
    for (let i = 1; i <= 8; i++) ev('mousemove', ax + (bx - ax) * i / 8, ay + (by - ay) * i / 8, document);
    ev('mouseup', bx, by, document);
  }`)
  await t.wait(400)
  t.assert((await t.js(`$choice()?.getAttribute('aria-label')`)) === 'Já existe uma ligação entre esses recursos', 'pergunta aberta')
  await t.js(`$pick('Usar a existente')`)
  await t.wait(300)
  const after2 = await t.js(`document.querySelectorAll('.react-flow__edge').length`)
  t.assert(after2 === before2, `usar a existente não cria seta (${before2} → ${after2})`)
  await t.js(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`)

  t.step('incluir recurso existente traz as ligações dele')
  await t.js(`$node('Base de Pedidos').click()`)
  await t.wait(200)
  await t.js(`[...document.querySelectorAll('aside button')].find((b) => b.textContent.trim() === 'Remover deste desenho').click()`)
  await t.wait(300)
  const withoutBase = await t.js(`document.querySelectorAll('.react-flow__edge').length`)
  await t.js(`{
    const dt = new DataTransfer();
    $row('base-de-pedidos').dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
    const pane = document.querySelector('.react-flow__pane').getBoundingClientRect();
    const opts = { bubbles: true, cancelable: true, dataTransfer: dt, clientX: pane.x + 200, clientY: pane.y + pane.height - 120 };
    document.querySelector('.react-flow__pane').dispatchEvent(new DragEvent('dragover', opts));
    document.querySelector('.react-flow__pane').dispatchEvent(new DragEvent('drop', opts));
  }`)
  await t.wait(400)
  const withBase = await t.js(`document.querySelectorAll('.react-flow__edge').length`)
  t.assert(withBase === withoutBase + 1, `ligação API → Base voltou sozinha (${withoutBase} → ${withBase})`)

  t.step('Nova feature')
  t.markAllOld()
  await t.js(`[...document.querySelectorAll('header button')].find((b) => b.textContent.includes('Nova feature')).click()`)
  await t.wait(300)
  await t.js(`{
    const dialog = document.querySelector('[aria-label="Nova feature"]');
    const inputs = dialog.querySelectorAll('input');
    $type(inputs[0], 'Checkout rápido');
    $type(inputs[1], '48213');
    const sel = dialog.querySelector('select');
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(sel, 'projetos/pedidos');
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    $type(inputs[2], '2026');
    [...dialog.querySelectorAll('button')].find((b) => b.textContent === 'Q2').click();
  }`)
  await t.wait(200)
  await t.shot('feature-modal.png')
  await t.js(`[...document.querySelectorAll('[aria-label="Nova feature"] button')].find((b) => b.textContent === 'Criar feature').click()`)
  await t.wait(400)
  const folder = 'projetos/pedidos/2026-Q2-48213-Checkout rápido'
  t.assert(!t.exists(folder), 'nada em disco antes do Salvar')
  const tab = await t.js(`[...document.querySelectorAll('nav span')].some((s) => s.textContent === 'diagrama')`)
  t.assert(tab, 'diagrama.json aberto em aba')

  t.step('salvar grava tudo')
  await t.js(`$save()`)
  await t.wait(800)
  for (const f of ['diagrama.json', 'processo.json', 'doc.md']) t.assert(t.exists(`${folder}/${f}`), `${folder}/${f}`)
  t.assert(t.read(`${folder}/doc.md`).includes('48213 (Azure DevOps)'), 'doc.md com o número da feature')
  const visao = JSON.parse(t.read('projetos/pedidos/Visão geral.json'))
  const anchors = Object.values(visao.anchors ?? {})
  t.assert(
    anchors.some((a) => a.source === 'right-1' && a.target === 'top-5'),
    `pontos escolhidos gravados no desenho (${JSON.stringify(visao.anchors)})`
  )
  const endpoints = t.files().filter((f) => f.startsWith('aplicações/api-de-pedidos--'))
  t.assert(endpoints.length === 3, `3 arquivos de endpoint (${endpoints})`)
  const visaoNodes = visao.nodes.length
  t.assert(visaoNodes === 7, `desenho salvo com 7 recursos, incluindo o endpoint novo (${visaoNodes})`)

  const dialogs = await t.js(`JSON.stringify(window.__dialogs)`)
  t.assert(dialogs === '[]', `nenhum alerta inesperado (${dialogs})`)
})
