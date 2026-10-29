# Como fazer

## Verificar uma mudança

1. `npm run typecheck`: precisa sair limpo (`noUnusedLocals` está ligado no renderer).
2. `npm run test:e2e`: faz o build e roda `scripts/e2e/smoke.cjs` no **app real**, sem janela, sobre
   uma cópia temporária de `exemplo-repositorio/`. Confere: abrir, salvar sem regravar, editar sem tocar
   o disco, salvar renomeando arquivos, criar pasta, redimensionar recurso e exportar JPEG. Depois roda
   `scripts/e2e/duplicate.cjs` (aviso de recurso com nome existente) e `scripts/e2e/features.cjs`
   (endpoints repetidos, ferramenta Ligar com pontos de conexão, Nova feature) e `scripts/e2e/nesting.cjs`
   (recurso dentro de outro esconde as ligações), `scripts/e2e/rename.cjs` (renomear com dois cliques) e
   `scripts/e2e/undo.cjs` (desfazer/refazer) e `scripts/e2e/delete.cjs` (exclusão do desenho × permanente,
   endpoint repetido pelas ligações, Schema) e `scripts/e2e/select.cjs` (seleção por retângulo, Shift+clique,
   mover em grupo, travar), `scripts/e2e/direction.cjs` (direção das ligações) e `scripts/e2e/template.cjs`
   (feature a partir de pasta modelo), `scripts/e2e/aliases.cjs` (pastas em português/inglês) e
   `scripts/e2e/connectors.cjs` (ligações visuais entre formas) e `scripts/e2e/border.cjs` (ligar em qualquer
   ponto da borda) e `scripts/e2e/legend.cjs` (legenda de impacto) e
   `scripts/e2e/markdown-images.cjs` (imagens no preview do Markdown) e `scripts/e2e/skill.cjs` (arquivos
   escritos seguindo a skill de cadastro abrem e não são regravados). Cada um termina com `Tudo certo` (código 0)
   ou lista as falhas (código 1). O caminho temporário impresso no fim tem o repositório resultante e as
   capturas de tela.
3. Para mudanças visuais, tire uma captura no teste (`await t.shot('nome.png')`) e confira a imagem.

### Escrever um teste novo

Copie `scripts/e2e/smoke.cjs` para um arquivo novo ao lado e rode com `electron scripts/e2e/<arquivo>.cjs`
(depois de `npm run build`). O objeto `t` oferece:

| Helper | Uso |
|---|---|
| `t.js(código)` | Executa JS na página e devolve o resultado (precisa ser serializável; termine com `0` se o último valor for uma função ou elemento). Cada chamada roda no mesmo escopo global: use `{ const x = … }` para não redeclarar. |
| `t.step`, `t.assert(ok, msg)` | Log e verificação. |
| `t.markAllOld()`, `t.changedFiles()` | Detectar quais arquivos o app regravou. |
| `t.files()`, `t.read(rel)`, `t.exists(rel)` | Inspecionar o repositório em disco. |
| `t.shot(nome)` | Captura de tela em `t.shots`. |
| `t.menu(ação)`, `t.editAccelerators()` | Disparar um item do menu nativo (`save`, `undo`…); atalhos do menu Editar. |

Na página já existem: `$row(texto)` (item da árvore), `$type(input, valor)` (digitar em input
controlado do React), `$blur(el)` (confirmar input inline; `el.blur()` não funciona com a janela oculta),
`$save()`. `alert`/`confirm` são substituídos (confirm responde "sim") e registrados em
`window.__dialogs`. Para arrastar alças, dispare `mousedown` no elemento e `mousemove`/`mouseup` em
`window` (exemplo no passo "redimensionar recurso" de `smoke.cjs`).

### Teclas no teste

- O React Flow guarda "tecla pressionada" até o `keyup`: para apertar Delete duas vezes, envie `keydown`,
  espere ~100 ms e envie `keyup` (veja `$pressDelete` em `connectors.cjs`). `keydown` e `keyup` no mesmo
  instante não são percebidos.
- Shift+clique: o React Flow lê o Shift pelo teclado; envie `keydown` de Shift antes do clique (veja
  `select.cjs`).

## Adicionar um campo a recursos, tecnologias ou relações

1. `model/types.ts`: adicione o campo como **opcional**.
2. `model/repo.ts` `parseScan`: leia e valide; só atribua se tiver valor.
3. Gravação: `computeFiles` serializa o objeto inteiro, então campos `undefined` já são omitidos. Se o
   valor "vazio" não for `undefined` (ex.: `''`, `false`), apague a chave na ação do store (veja o laço
   `for (const key of [...])` em `updateRelation`).
4. Interface: `components/PropertiesPanel.tsx`.
5. Confirme que abrir e salvar o `exemplo-repositorio/` não regrava nada (`npm run test:e2e`).

## Adicionar um tipo de recurso

`model/types.ts` (`ElementType`) + `model/elementTypes.ts` (`ELEMENT_TYPES`, `ELEMENT_TYPE_ORDER` se deve
aparecer na Paleta). Ícone do `lucide-react`; **sem cor própria** (regras.md §7).

## Adicionar um tipo de ligação

`model/types.ts` (`ArchimateRelType`) + `model/archimate.ts` (`ARCHIMATE_TYPES` com `dash`, `start`,
`end`, e `ARCHIMATE_ORDER`). Se precisar de uma ponta nova, adicione em `MarkerKind` e em
`ArchimateMarkers.tsx` (`MarkerShape` e `KINDS`). A ponta precisa ter a ponta em x=18, y=10, porque o
mesmo marker serve no início com `auto-start-reverse`.

## Adicionar um tipo de forma

`model/types.ts` (`ShapeKind`), `model/elementTypes.ts` (`SHAPE_KINDS`, `SHAPE_KIND_ORDER`),
`components/ShapeNode.tsx` (`RADIUS` ou o desenho), e a lista de tipos aceitos em `parseShape`
(`model/repo.ts`).

## Adicionar um novo tipo de arquivo no repositório

1. `model/repo.ts`: reconhecer em `parseScan` (e incluir em `files` do snapshot), gerar em `computeFiles`,
   reservar caminhos em `computePaths` (`taken`).
2. `model/store.ts`: estado + ações; incluir em `renamePath`/`deletePath` se viver em `projetos/`.
3. `model/tree.ts`: `FileRef` + `buildTree`; `RepoPanel.tsx`: ícone, clique, ações.
4. Main: `scanRepo` só lê conteúdo de `.json` e `.md`; amplie se a extensão for outra.

## Adicionar uma operação de disco

Não adicione. Toda gravação no repositório deve passar por `computeFiles` → `diffRepo` → `repo:write`
(regras.md §1). Se a operação não se expressa como "arquivos que devem existir", adicione um campo
novo em `RepoChanges` (como `moves`), aplique-o no main dentro do `repo:write` e passe por `safePath`.

## Armadilhas conhecidas

- **Nós controlados do React Flow:** mudanças que você não repassar ao store em `onNodesChange` são
  perdidas no próximo render. Tamanhos medidos ficam em `measured` (estado local do `Canvas`, não vão
  para o arquivo).
- **`zIndex`:** use a pilha `z` do desenho; `elevateNodesOnSelect` está desligado de propósito.
- **Markers SVG por cor:** uma cor nova de seta exige a variante correspondente em `ArchimateMarkers`.
- **Exportação:** `html-to-image` só copia o que está dentro de `.react-flow__viewport`; elementos fora
  dele (como `<defs>`) não aparecem na imagem.
- **Unicode:** nomes com acento vindos do disco podem estar em NFD; compare com `normalize('NFC')`.
- **`electron-vite` interrompido** deixa `electron.vite.config.<n>.mjs` na raiz (ignorado no Git; pode
  apagar).
