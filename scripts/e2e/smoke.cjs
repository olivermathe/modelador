/**
 * Teste de fumaça das regras centrais do app. Rode com `npm run test:e2e`.
 * Ao adicionar uma funcionalidade, inclua aqui (ou num arquivo novo ao lado)
 * um passo que a exercite e confira o resultado em disco.
 */
const { run } = require('./harness.cjs')

run(async (t) => {
  t.step('abre o exemplo')
  const roots = await t.js(`[...document.querySelectorAll('aside span.font-medium')].map((s) => s.textContent).join()`)
  t.assert(roots === 'projetos,aplicações,tecnologias,relações', `pastas raiz na árvore: ${roots}`)
  await t.js(`$row('Visão geral').click()`)
  await t.wait(800)
  const nodes = await t.js(`document.querySelectorAll('.react-flow__node-element').length`)
  const shapes = await t.js(`document.querySelectorAll('.react-flow__node-shape').length`)
  const edges = await t.js(`document.querySelectorAll('.react-flow__edge').length`)
  t.assert(nodes === 6 && shapes === 2 && edges === 5, `desenho com 6 recursos, 2 formas, 5 ligações (${nodes}/${shapes}/${edges})`)

  t.step('impacto só na cor da borda, sem rótulo')
  const impact = JSON.parse(await t.js(`{
    const node = [...document.querySelectorAll('.react-flow__node-element')].find((n) => n.textContent.includes('pedido-criado'));
    JSON.stringify({ text: node.textContent, border: node.querySelector('.border-2').className.includes('border-emerald-500') })
  }`))
  t.assert(impact.border && !/novo/i.test(impact.text.replace('pedido-criado', '')), `borda verde, sem "NOVO" (${impact.text})`)

  t.step('salvar sem alterações não regrava nada')
  t.markAllOld()
  await t.js(`$save()`)
  await t.wait(600)
  t.assert(t.changedFiles().length === 0, `nenhum arquivo regravado (${t.changedFiles()})`)

  t.step('editar não toca o disco antes do Salvar')
  await t.js(`$row('portal-do-cliente').click()`)
  await t.wait(300)
  await t.js(`$type([...document.querySelectorAll('input')].find((i) => i.value === 'Portal do Cliente'), 'Portal Web')`)
  // Ações da pasta ficam no menu ⋯
  await t.js(`document.querySelector('[aria-label="Ações da pasta projetos"]').click()`)
  await t.wait(200)
  await t.js(`[...document.querySelectorAll('[role="menuitem"]')].find((b) => b.textContent === 'Nova pasta').click()`)
  await t.wait(200)
  await t.js(`{ const i = document.querySelector('input[placeholder="Nome da pasta"]'); $type(i, 'rascunhos'); $blur(i) }`)
  await t.wait(200)
  const before = t.files()
  t.assert(t.changedFiles().length === 0, 'disco intacto com alterações pendentes')
  const dirty = await t.js(`document.querySelector('header').innerText.includes('não salvo')`)
  t.assert(dirty, 'barra mostra "não salvo"')

  t.step('salvar aplica tudo')
  await t.js(`$save()`)
  await t.wait(800)
  const after = t.files()
  t.assert(after.includes('aplicações/portal-web.json'), 'recurso renomeado vira aplicações/portal-web.json')
  t.assert(!after.includes('aplicações/portal-do-cliente.json'), 'arquivo antigo do recurso foi apagado')
  t.assert(
    after.some((f) => f.startsWith('relações/portal-web--')),
    'relações do recurso renomeadas junto'
  )
  t.assert(t.exists('projetos/rascunhos'), 'pasta nova criada em projetos/rascunhos')
  t.assert(before.length === after.length, `mesma quantidade de arquivos (${before.length} → ${after.length})`)

  t.step('redimensionar recurso respeita o conteúdo')
  await t.js(`window.$api = () => [...document.querySelectorAll('.react-flow__node-element')].find((n) => n.textContent.includes('API de Pedidos')); 0`)
  await t.js(`$api().click()`)
  await t.wait(300)
  // Arrasta a alça do canto inferior direito bem além do mínimo
  await t.js(`{
    const h = $api().querySelector('.react-flow__resize-control.handle.bottom.right');
    const r = h.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2;
    const ev = (type, cx, cy, el) => el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: cx, clientY: cy, button: 0, buttons: 1, view: window }));
    ev('mousedown', x, y, h);
    for (let i = 1; i <= 10; i++) ev('mousemove', x - 60 * i, y - 60 * i, window);
    ev('mouseup', x - 600, y - 600, window);
  }`)
  await t.wait(500)
  const size = JSON.parse(await t.js(`{
    // offsetWidth/Height: tamanho no desenho, sem o zoom da tela
    const node = $api(), box = node.querySelector('.border-2');
    JSON.stringify({ w: node.offsetWidth, h: node.offsetHeight, boxH: box.offsetHeight })
  }`))
  t.assert(size.w === 160, `largura parou no mínimo (${size.w}px)`)
  t.assert(size.h === size.boxH, `moldura acompanha o conteúdo (${size.h}px / ${size.boxH}px)`)

  t.step('exportar JPEG')
  await t.js(`$row('Visão geral').click()`)
  await t.wait(500)
  await t.js(`document.querySelector('[title^="Exportar o desenho"]').click()`)
  await t.wait(2500)
  t.assert(require('fs').existsSync(require('path').join(t.shots, 'export.jpg')), 'imagem exportada')

  const dialogs = await t.js(`JSON.stringify(window.__dialogs)`)
  t.assert(dialogs === '[]', `nenhum alerta inesperado (${dialogs})`)
})
