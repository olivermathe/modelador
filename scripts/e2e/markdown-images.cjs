/**
 * Imagens no preview do Markdown: `![](./x.png)` relativo ao documento é lido do repositório.
 * Rode com `npm run build && electron scripts/e2e/markdown-images.cjs`.
 */
const { writeFileSync, mkdirSync } = require('fs')
const path = require('path')
const { run } = require('./harness.cjs')

// PNG 1×1 vermelho
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==',
  'base64'
)

run(async (t) => {
  t.step('imagens ao lado do documento e numa subpasta (nomes com acento)')
  writeFileSync(path.join(t.repo, 'projetos/pedidos/negócio.png'), PNG)
  mkdirSync(path.join(t.repo, 'projetos/imagens'))
  writeFileSync(path.join(t.repo, 'projetos/imagens/técnico.png'), PNG)
  t.menu('reload')
  await t.wait(800)

  await t.js(`$row('Decisões').click()`)
  await t.wait(500)
  await t.js(`{
    const ta = document.querySelector('textarea');
    $type(ta, ta.value + '\\n\\n| A | B |\\n|---|---|\\n| ![Negócio](./negócio.png) | ![Técnico](../imagens/t%C3%A9cnico.png) |\\n\\n![Falta](./nao-existe.png) ![Fora](../../../etc/x.png)\\n');
  }`)
  await t.wait(800)

  const imgs = await t.js(`[...document.querySelectorAll('.prose img')].map((i) => ({ alt: i.alt, src: (i.getAttribute('src') || '').slice(0, 22), ok: i.complete && i.naturalWidth > 0 }))`)
  const by = (alt) => imgs.find((i) => i.alt === alt) || {}
  t.assert(by('Negócio').src === 'data:image/png;base64,' && by('Negócio').ok, `./negócio.png aparece (${JSON.stringify(by('Negócio'))})`)
  t.assert(by('Técnico').src === 'data:image/png;base64,' && by('Técnico').ok, `../imagens/técnico.png aparece (${JSON.stringify(by('Técnico'))})`)
  t.assert(!by('Falta').src, 'imagem inexistente: só o texto alternativo')
  t.assert(!by('Fora').src, 'fora do repositório: não é lida')
  await t.shot('markdown-imagens.png')
})
