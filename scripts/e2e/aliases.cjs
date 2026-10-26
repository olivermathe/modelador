/**
 * Pastas em inglês (ou português): o app lê e grava nelas sem renomear.
 * Rode com `npm run build && electron scripts/e2e/aliases.cjs`.
 */
const fs = require('fs')
const path = require('path')
const { run, REPO } = require('./harness.cjs')

// Antes do app abrir: mistura de inglês e português (com maiúscula numa delas); "tecnologias" fica como está
const RENAMES = { aplicações: 'Applications', relações: 'relacionamentos', projetos: 'projects' }
for (const [from, to] of Object.entries(RENAMES)) fs.renameSync(path.join(REPO, from), path.join(REPO, to))
const listRoot = () => fs.readdirSync(REPO).sort().join(',')

run(async (t) => {
  t.step('abre com as pastas em inglês e português misturadas')
  const roots = await t.js(`[...document.querySelectorAll('aside span.font-medium')].map((s) => s.textContent).join()`)
  t.assert(roots === 'projects,Applications,tecnologias,relacionamentos', `árvore mostra os nomes reais: ${roots}`)
  t.assert(!(await t.js(`document.querySelector('header').innerText.includes('não salvo')`)), 'nada pendente ao abrir (sem renomear)')
  await t.js(`$row('Visão geral').click()`)
  await t.wait(800)
  const nodes = await t.js(`document.querySelectorAll('.react-flow__node-element').length`)
  const edges = await t.js(`document.querySelectorAll('.react-flow__edge').length`)
  t.assert(nodes === 6 && edges === 5, `desenho completo (${nodes} recursos, ${edges} ligações)`)

  t.step('salvar sem alterações não mexe em nada')
  const before = listRoot()
  t.markAllOld()
  await t.js(`$save()`)
  await t.wait(600)
  t.assert(t.changedFiles().length === 0 && listRoot() === before, `pastas e arquivos intactos (${listRoot()})`)

  t.step('editar grava nas pastas como elas estão')
  await t.js(`$row('portal-do-cliente').click()`)
  await t.wait(300)
  await t.js(`$type([...document.querySelectorAll('input')].find((i) => i.value === 'Portal do Cliente'), 'Portal Web')`)
  await t.wait(300)
  t.assert(
    (await t.js(`[...document.querySelectorAll('aside p')].some((p) => p.textContent.startsWith('Applications/'))`)),
    'painel mostra o caminho com o nome real da pasta'
  )
  await t.js(`$save()`)
  await t.wait(800)
  t.assert(t.exists('Applications/portal-web.json') && !t.exists('Applications/portal-do-cliente.json'), 'Applications/portal-web.json')
  t.assert(t.files().some((f) => f.startsWith('relacionamentos/portal-web--')), 'relações renomeadas em relacionamentos/')
  t.assert(listRoot() === before, `nenhuma pasta em português criada (${listRoot()})`)

  const dialogs = await t.js(`JSON.stringify(window.__dialogs)`)
  t.assert(dialogs === '[]', `nenhum alerta inesperado (${dialogs})`)
})
