/**
 * Meta modelo (metamodelo.json): tabela de relações permitidas, bloqueio ao ligar e ao inverter, tipo único
 * já escolhido, tipos desabilitados no painel, ligações fora da regra, Salvar e remover.
 * Rode com `npm run build && electron scripts/e2e/metamodel.cjs`.
 */
const { run } = require('./harness.cjs')

const PORTAL = '3f1c2a10-0000-4000-8000-000000000001'
const PEDIDO_CRIADO = '3f1c2a10-0000-4000-8000-000000000004'

run(async (t) => {
  t.step('abrir e salvar sem mudar nada não regrava metamodelo.json')
  t.markAllOld()
  await t.openDiagram('Visão geral')
  await t.js(`$save()`)
  await t.wait(800)
  t.assert(t.changedFiles().length === 0, `nada regravado (${t.changedFiles().join(', ')})`)

  await t.js(`
    window.$node = (text) => [...document.querySelectorAll('.react-flow__node-element')].find((n) => n.textContent.includes(text));
    window.$header = () => [...[...document.querySelectorAll('aside')].at(-1).querySelectorAll('header button')].map((b) => b.textContent.trim());
    window.$button = (root, text) => [...root.querySelectorAll('button')].find((b) => b.textContent.includes(text));
    window.$dialog = () => document.querySelector('[role="dialog"][aria-label="Meta modelo"]');
    window.$openMeta = () => $button(document.querySelector('header'), 'Meta modelo').click();
    window.$cell = (pair) => { $dialog().querySelector('[data-cell="' + pair + '"]').click() };
    window.$check = (type) => $dialog().querySelector('[data-cell-editor] input[data-type="' + type + '"]').click();
    window.$closeMeta = () => $button($dialog(), 'Fechar').click();
    window.$edges = () => document.querySelectorAll('.react-flow__edge').length;
    window.$drag = (fromText, toText) => {
      const from = $node(fromText).querySelector('[data-handleid="right-2"]');
      const to = $node(toText).querySelector('[data-handleid="left-2"]');
      const a = from.getBoundingClientRect(), b = to.getBoundingClientRect();
      const ax = a.x + a.width / 2, ay = a.y + a.height / 2, bx = b.x + b.width / 2, by = b.y + b.height / 2;
      const ev = (type, x, y, el) => el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, buttons: 1, view: window }));
      ev('mousedown', ax, ay, from);
      for (let i = 1; i <= 8; i++) ev('mousemove', ax + (bx - ax) * i / 8, ay + (by - ay) * i / 8, document);
      ev('mouseup', bx, by, document);
    };
    0`)

  t.step('tabela do meta modelo (sugestão do exemplo)')
  await t.js(`$openMeta()`)
  await t.until(`$dialog()`)
  t.assert(await t.js(`$dialog().querySelectorAll('[data-cell]').length === 36`), '6 × 6 células')
  t.assert(await t.js(`$dialog().querySelector('[data-cell="service>database"]').title.includes('Acesso')`), 'Serviço → Banco aceita Acesso')
  t.assert(await t.js(`$dialog().textContent.includes('Ligações fora da regra (0)')`), 'nenhuma ligação fora da regra')

  t.step('Fila → Sistema só com Fluxo; Sistema → Fila sem nada')
  await t.js(`$cell('queue>system')`)
  await t.wait(150)
  await t.js(`$button($dialog().querySelector('[data-cell-editor]'), 'Nenhum').click()`)
  await t.wait(100)
  await t.js(`$check('flow')`)
  await t.wait(100)
  await t.js(`$cell('system>queue')`)
  await t.wait(150)
  await t.js(`$button($dialog().querySelector('[data-cell-editor]'), 'Nenhum').click()`)
  await t.wait(100)
  t.assert(await t.js(`$dialog().querySelector('[data-cell="queue>system"]').title === 'Fluxo'`), 'Fila → Sistema: Fluxo')
  t.assert(await t.js(`$dialog().querySelector('[data-cell="system>queue"]').textContent === '—'`), 'Sistema → Fila: nenhuma')
  t.step('composição dono → endpoint é fixa')
  await t.js(`$cell('service>endpoint')`)
  await t.wait(150)
  t.assert(await t.js(`$dialog().querySelector('[data-cell-editor] input[data-type="composition"]').disabled`), 'Composição travada')
  await t.shot('meta-modelo.png')
  await t.js(`$closeMeta()`)
  await t.wait(200)

  t.step('ligar Portal → pedido-criado (Sistema → Fila): bloqueado com aviso')
  await t.js(`document.querySelector('aside [aria-label="Genérica"]').click()`)
  await t.wait(200)
  const before = await t.js(`$edges()`)
  await t.js(`$drag('Portal do Cliente', 'pedido-criado')`)
  await t.wait(400)
  t.assert((await t.js(`$edges()`)) === before, 'nenhuma seta nova')
  const notice = await t.js(`document.querySelector('[role="status"]')?.textContent ?? ''`)
  t.assert(notice.includes('não permite ligações Sistema → Fila / Tópico'), `aviso: "${notice}"`)

  t.step('ligar pedido-criado → Portal (genérica): nasce como Fluxo, o único aceito')
  await t.js(`$drag('pedido-criado', 'Portal do Cliente')`)
  await t.wait(400)
  t.assert((await t.js(`$edges()`)) === before + 1, 'seta criada')
  const header = await t.js(`$header()`)
  t.assert(header[0] === 'pedido-criado' && header[1] === 'Portal do Cliente', `origem → destino: ${header.slice(0, 2).join(' → ')}`)
  const typeLabel = await t.js(`[...document.querySelectorAll('aside span')].find((s) => s.textContent === 'Tipo (ArchiMate)').nextElementSibling.textContent`)
  t.assert(typeLabel.includes('Fluxo'), `tipo: ${typeLabel}`)

  t.step('painel: tipos não aceitos desabilitados')
  await t.js(`[...document.querySelectorAll('aside span')].find((s) => s.textContent === 'Tipo (ArchiMate)').nextElementSibling.click()`)
  await t.wait(200)
  t.assert(await t.js(`document.querySelector('aside [data-reltype="serving"]').disabled`), 'Serve desabilitado')
  t.assert(await t.js(`!document.querySelector('aside [data-reltype="flow"]').disabled`), 'Fluxo habilitado')
  t.assert(await t.js(`!document.querySelector('aside [data-reltype="generic"]').disabled`), 'Genérica habilitada (o par aceita algum tipo)')

  t.step('inverter direção sairia da regra: bloqueado')
  await t.js(`$button([...document.querySelectorAll('aside')].at(-1), 'Inverter direção').click()`)
  await t.wait(300)
  t.assert((await t.js(`$header()`))[0] === 'pedido-criado', 'direção mantida')

  t.step('tirar Acesso de Serviço → Banco: a ligação existente fica fora da regra, sem mudar')
  await t.js(`$openMeta()`)
  await t.until(`$dialog()`)
  await t.js(`$cell('service>database')`)
  await t.wait(150)
  t.assert(await t.js(`$dialog().querySelector('[data-cell-editor]').textContent.includes('1 em uso')`), 'Acesso "1 em uso"')
  await t.js(`$check('access')`)
  await t.wait(200)
  t.assert(await t.js(`$dialog().textContent.includes('Ligações fora da regra (1)')`), 'lista com 1 ligação')
  t.assert((await t.js(`document.querySelector('[data-outside-count]')?.textContent`)) === '1', 'contagem no botão da barra')
  await t.js(`$button($dialog().querySelector('[data-outside]'), 'Mostrar').click()`)
  await t.wait(300)
  t.assert(!(await t.js(`!!$dialog()`)), 'tela fechada')
  t.assert(await t.js(`!!document.querySelector('[data-outside-metamodel]')`), 'aviso no painel da relação')
  t.assert((await t.js(`$header()`)).slice(0, 2).join(' → ') === 'API de Pedidos → Base de Pedidos', 'relação mostrada')

  t.step('salvar grava o meta modelo e a ligação com o tipo')
  await t.js(`$save()`)
  await t.wait(800)
  const meta = JSON.parse(t.read('metamodelo.json'))
  t.assert(JSON.stringify(meta.relations.queue.system) === '["flow"]', `queue → system: ${JSON.stringify(meta.relations.queue.system)}`)
  t.assert(!meta.relations.system.queue, 'system → queue omitido (vazio)')
  t.assert(!meta.relations.service.database.includes('access'), 'service → database sem access')
  const relFile = t.files().find((f) => f.startsWith('relações/') && JSON.parse(t.read(f)).sourceId === PEDIDO_CRIADO && JSON.parse(t.read(f)).targetId === PORTAL)
  t.assert(relFile && JSON.parse(t.read(relFile)).relType === 'flow', `ligação gravada com Fluxo (${relFile})`)
  t.assert(t.read('relações/api-de-pedidos--base-de-pedidos.json').includes('"access"'), 'ligação fora da regra continua igual')

  t.step('remover o meta modelo: arquivo apagado no Salvar e tudo volta a valer')
  await t.js(`$openMeta()`)
  await t.until(`$dialog()`)
  await t.js(`$button($dialog(), 'Remover meta modelo').click()`)
  await t.wait(200)
  t.assert(await t.js(`$dialog().textContent.includes('não tem meta modelo')`), 'tela sem meta modelo')
  await t.js(`$closeMeta()`)
  await t.wait(200)
  t.assert(!(await t.js(`!!document.querySelector('[data-outside-count]')`)), 'sem contagem na barra')
  await t.js(`$save()`)
  await t.wait(800)
  t.assert(!t.exists('metamodelo.json'), 'metamodelo.json apagado')

  t.step('desfazer traz o meta modelo de volta')
  await t.js(`document.activeElement?.blur()`)
  t.menu('undo')
  await t.wait(300)
  await t.js(`$openMeta()`)
  await t.until(`$dialog()`)
  t.assert(await t.js(`!!$dialog().querySelector('[data-metamodel-table]')`), 'tabela de volta')
  await t.js(`$closeMeta()`)
})
