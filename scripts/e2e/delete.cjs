/**
 * Dois tipos de exclusão (Delete = só do desenho; Shift+Delete = permanente, com pergunta),
 * menu de contexto, endpoint repetido verificado pelas ligações e o tipo Schema.
 * Rode com `npm run build && electron scripts/e2e/delete.cjs`.
 */
const { run } = require('./harness.cjs')

run(async (t) => {
  await t.js(`$row('Visão geral').click()`)
  await t.wait(800)
  await t.js(`
    window.$node = (text) => [...document.querySelectorAll('.react-flow__node-element')].find((n) => n.textContent.includes(text));
    window.$nodes = () => document.querySelectorAll('.react-flow__node-element').length;
    window.$edges = () => document.querySelectorAll('.react-flow__edge').length;
    window.$key = (key, shiftKey = false) => document.body.dispatchEvent(new KeyboardEvent('keydown', { key, code: key, shiftKey, bubbles: true, cancelable: true }));
    window.$choice = () => document.querySelector('[role="dialog"]');
    window.$pick = (label) => [...$choice().querySelectorAll('button')].find((b) => b.textContent.trim() === label).click();
    window.$menuItems = () => [...document.querySelectorAll('.fixed.z-50 button')].map((b) => b.querySelector('span')?.textContent).filter(Boolean);
    window.$menuClick = (label) => [...document.querySelectorAll('.fixed.z-50 button')].find((b) => b.textContent.includes(label)).click();
    window.$context = (el) => { const r = el.getBoundingClientRect(); el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.x + 10, clientY: r.y + 10 })) };
    window.$dropNew = (type) => {
      const pane = document.querySelector('.react-flow'), r = pane.getBoundingClientRect(), dt = new DataTransfer();
      dt.setData('application/x-modelador', JSON.stringify({ kind: 'new', type }));
      pane.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt, clientX: r.x + r.width - 160, clientY: r.y + 120 }));
    };
    0`)

  t.step('Delete tira só do desenho')
  const nodes0 = await t.js(`$nodes()`)
  await t.js(`$node('pedido-criado').click()`)
  await t.wait(200)
  await t.js(`$key('Delete')`)
  await t.wait(300)
  t.assert((await t.js(`$nodes()`)) === nodes0 - 1, 'saiu do desenho')
  t.assert(!(await t.js(`!!$choice()`)), 'sem pergunta')
  t.assert(!!(await t.js(`!!$row('pedido-criado')`)), 'continua na biblioteca (árvore)')
  t.menu('undo')
  await t.wait(300)

  t.step('Shift+Delete pergunta e exclui de vez')
  await t.js(`$node('pedido-criado').click()`)
  await t.wait(200)
  await t.js(`$key('Delete', true)`)
  await t.wait(300)
  t.assert((await t.js(`$choice()?.getAttribute('aria-label') ?? ''`)).includes('permanentemente'), 'pergunta de exclusão permanente')
  t.assert((await t.js(`$nodes()`)) === nodes0, 'nada sai antes de confirmar')
  await t.js(`$pick('Excluir permanentemente')`)
  await t.wait(300)
  t.assert((await t.js(`$nodes()`)) === nodes0 - 1, 'saiu do desenho')
  t.assert(!(await t.js(`!!$row('pedido-criado')`)), 'saiu da biblioteca')

  t.step('botão direito num recurso mostra os dois')
  await t.js(`$context($node('Base de Pedidos'))`)
  await t.wait(200)
  const nodeMenu = await t.js(`$menuItems()`)
  t.assert(nodeMenu.includes('Remover do desenho') && nodeMenu.includes('Excluir permanentemente…'), `itens: ${nodeMenu}`)
  await t.js(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`)
  await t.wait(200)

  t.step('botão direito numa ligação: remover do desenho')
  const edges0 = await t.js(`$edges()`)
  await t.js(`$context(document.querySelector('.react-flow__edge-interaction') ?? document.querySelector('.react-flow__edge path'))`)
  await t.wait(200)
  const edgeMenu = await t.js(`$menuItems()`)
  t.assert(edgeMenu.includes('Remover do desenho') && edgeMenu.includes('Excluir permanentemente…'), `itens: ${edgeMenu}`)
  await t.js(`$menuClick('Remover do desenho')`)
  await t.wait(300)
  t.assert((await t.js(`$edges()`)) === edges0 - 1, 'seta saiu do desenho')

  t.step('endpoint repetido verificado pelas ligações')
  await t.js(`$dropNew('endpoint')`)
  await t.wait(300)
  await t.js(`{
    const span = [...$node('/novo').querySelectorAll('span')].find((s) => s.textContent === '/novo');
    span.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
  }`)
  await t.wait(200)
  // GET /pedidos/{id} já é da API de Pedidos (Composição); este endpoint ainda não está ligado a ninguém
  await t.js(`{ const i = document.querySelector('.react-flow__node-element input'); $type(i, '/pedidos/{codigo}'); $blur(i) }`)
  await t.wait(300)
  t.assert(!(await t.js(`!!$choice()`)), 'sem ligação, sem conflito')
  const before = await t.js(`$nodes()`)
  await t.js(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'l' }))`)
  await t.wait(200)
  await t.js(`{
    const from = $node('API de Pedidos').querySelector('[data-handleid="right-2"]');
    const to = $node('/pedidos/{codigo}').querySelector('[data-handleid="left-2"]');
    const a = from.getBoundingClientRect(), b = to.getBoundingClientRect();
    const ax = a.x + a.width / 2, ay = a.y + a.height / 2, bx = b.x + b.width / 2, by = b.y + b.height / 2;
    const ev = (type, x, y, el) => el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, buttons: 1, view: window }));
    ev('mousedown', ax, ay, from);
    for (let i = 1; i <= 8; i++) ev('mousemove', ax + (bx - ax) * i / 8, ay + (by - ay) * i / 8, document);
    ev('mouseup', bx, by, document);
  }`)
  await t.wait(400)
  t.assert((await t.js(`$choice()?.getAttribute('aria-label')`)) === 'Esse endpoint já existe', 'ligar à API pergunta: a API já tem GET /pedidos/{id}')
  await t.js(`$pick('Usar o existente')`)
  await t.wait(400)
  t.assert((await t.js(`$nodes()`)) === before - 1, 'o novo deu lugar ao existente')
  t.assert(!(await t.js(`!!$node('/pedidos/{codigo}')`)), 'endpoint novo descartado')
  await t.js(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`)

  t.step('tipo Schema')
  await t.js(`[...document.querySelectorAll('aside nav button')].find((b) => b.textContent.includes('Paleta')).click()`)
  await t.wait(200)
  t.assert(!!(await t.js(`!!document.querySelector('aside [aria-label="Schema"]')`)), 'Schema na Paleta')
  await t.js(`$dropNew('schema')`)
  await t.wait(300)
  t.assert(!!(await t.js(`!!$node('Novo schema')`)), 'recurso Schema no desenho')

  t.step('salvar')
  await t.js(`$save()`)
  await t.wait(800)
  t.assert(!t.exists('aplicações/pedido-criado.json'), 'excluído de vez: arquivo apagado')
  t.assert(t.exists('aplicações/novo-schema.json') && JSON.parse(t.read('aplicações/novo-schema.json')).type === 'schema', 'schema gravado')
  t.assert(t.files().filter((f) => f.startsWith('relações/')).length >= 7, 'ligação removida só do desenho continua em relações/')

  const dialogs = await t.js(`JSON.stringify(window.__dialogs)`)
  t.assert(dialogs === '[]', `nenhum alerta inesperado (${dialogs})`)
})
