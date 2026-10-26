/**
 * "Nova feature" a partir de uma pasta modelo: a pasta criada é uma cópia exata do modelo.
 * Rode com `npm run build && electron scripts/e2e/template.cjs`.
 */
const { ipcMain } = require('electron')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { run } = require('./harness.cjs')

// Pasta modelo de teste: desenho, Markdown em subpasta, binário, texto e pasta vazia
const TEMPLATE = fs.mkdtempSync(path.join(os.tmpdir(), 'modelo-feature-'))
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
)
fs.writeFileSync(
  path.join(TEMPLATE, 'diagrama.json'),
  // Formatação diferente da que o app gravaria (4 espaços, outra ordem de chaves, sem quebra no fim)
  JSON.stringify({ edges: [], nodes: [], shapes: [{ text: 'Contexto da feature', id: 's1', kind: 'text', x: 0, y: 0, width: 200, height: 40, fill: 'transparent', stroke: '#334155', strokeStyle: 'none', textColor: '#0f172a', fontSize: 18 }] }, null, 4)
)
fs.mkdirSync(path.join(TEMPLATE, 'docs'))
fs.writeFileSync(path.join(TEMPLATE, 'docs', 'README.md'), '# Feature\n\nPreencher.\n')
fs.mkdirSync(path.join(TEMPLATE, 'assets'))
fs.writeFileSync(path.join(TEMPLATE, 'assets', 'logo.png'), PNG)
fs.writeFileSync(path.join(TEMPLATE, 'notas.txt'), 'texto puro ç ã\n')
fs.mkdirSync(path.join(TEMPLATE, 'vazia'))

run(async (t) => {
  // Sem diálogo: "Escolher…" devolve a pasta modelo de teste
  ipcMain.removeHandler('template:pick')
  ipcMain.handle('template:pick', () => TEMPLATE)

  t.step('modal com pasta modelo')
  await t.js(`[...document.querySelectorAll('header button')].find((b) => b.textContent.includes('Nova feature')).click()`)
  await t.wait(300)
  await t.js(`[...document.querySelectorAll('[aria-label="Nova feature"] button')].find((b) => b.textContent === 'Copiar de uma pasta modelo').click()`)
  await t.wait(800)
  const preview = await t.js(`[...document.querySelectorAll('[aria-label="Nova feature"] p')].map((p) => p.textContent).join(' | ')`)
  t.assert(preview.includes('assets/logo.png') && preview.includes('vazia/'), `prévia mostra o conteúdo do modelo (${preview.slice(0, 160)}…)`)
  await t.js(`{
    const inputs = document.querySelectorAll('[aria-label="Nova feature"] input');
    $type(inputs[0], 'Pagamento Pix'); $type(inputs[1], '777');
  }`)
  await t.wait(200)
  await t.js(`[...document.querySelectorAll('[aria-label="Nova feature"] button')].find((b) => b.textContent === 'Criar feature').click()`)
  await t.wait(400)

  const folders = await t.js(`[...document.querySelectorAll('[aria-label="Nova feature"]')].length`)
  t.assert(folders === 0, 'modal fecha')
  const year = new Date().getFullYear()
  const quarter = `Q${Math.floor(new Date().getMonth() / 3) + 1}`
  // O modal sugere a pasta do desenho aberto (projetos/pedidos)
  const target = `projetos/pedidos/${year}-${quarter}-777-Pagamento Pix`
  t.assert(!t.exists(target), 'nada em disco antes do Salvar')
  t.assert(!!(await t.js(`!!$row('logo.png') || !!$row('logo')`)), 'cópia aparece na árvore')
  t.assert(!!(await t.js(`[...document.querySelectorAll('nav span')].some((s) => s.textContent === 'diagrama')`)), 'desenho do modelo aberto')

  t.step('salvar grava uma cópia exata')
  await t.js(`$save()`)
  await t.wait(1000)
  for (const rel of ['diagrama.json', 'docs/README.md', 'assets/logo.png', 'notas.txt']) {
    const a = fs.readFileSync(path.join(TEMPLATE, rel))
    const b = path.join(t.repo, target, rel)
    t.assert(fs.existsSync(b) && Buffer.compare(a, fs.readFileSync(b)) === 0, `${rel} idêntico`)
  }
  t.assert(fs.statSync(path.join(t.repo, target, 'vazia')).isDirectory(), 'pasta vazia copiada')

  t.step('salvar de novo não regrava')
  t.markAllOld()
  await t.js(`$save()`)
  await t.wait(800)
  t.assert(t.changedFiles().length === 0, `nada regravado (${t.changedFiles()})`)

  const dialogs = await t.js(`JSON.stringify(window.__dialogs)`)
  t.assert(dialogs === '[]', `nenhum alerta inesperado (${dialogs})`)
})
