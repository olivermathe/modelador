# Arquitetura

## Processos do Electron

```
┌──────────────────────────┐   IPC (contextBridge)   ┌──────────────────────────────────────┐
│ main  (Node)             │ ◀─────────────────────▶ │ renderer  (React, sem acesso a fs)   │
│ src/main/index.ts        │     window.api.*        │ src/renderer/src/                    │
│ - janela e menu nativo   │                         │ - estado (Zustand)                   │
│ - ler a pasta (scan)     │   preload               │ - editor (React Flow)                │
│ - gravar mudanças        │   src/preload/index.ts  │ - painéis, árvore, Markdown          │
│ - diálogos do sistema    │                         │                                      │
└──────────────────────────┘                         └──────────────────────────────────────┘
```

- `contextIsolation: true` e `sandbox: true`. O renderer só fala com o disco via `window.api`
  (tipado em `src/preload/index.d.ts`).
- A CSP está em `src/renderer/index.html` (scripts só locais; imagens `data:` e `https:` para o Markdown).

### Canais IPC

| Canal | Direção | O que faz |
|---|---|---|
| `repo:open` | renderer → main | Diálogo de pasta; cria a estrutura se vazia (com confirmação); devolve o scan. Salva como último repositório. |
| `repo:last` | renderer → main | Scan do último repositório usado (`userData/settings.json`), se ainda existir. |
| `repo:scan` | renderer → main | Relê uma pasta (botão Recarregar). |
| `repo:write` | renderer → main | **Única gravação no repositório.** Aplica `RepoChanges` na ordem: moves → mkdirs → writes → deletes → rmdirs. |
| `export:image` | renderer → main | Diálogo de salvar + grava o JPEG (data URL). |
| `window:state` | renderer → main | Título da janela e aviso de "não salvo" ao fechar. |
| `menu:action` | main → renderer | Itens do menu nativo: `open`, `reload`, `save`, `exportJpeg`, `undo`, `redo`. |

## Fluxo de dados

```
            abrir/recarregar                                   Salvar
disco ──scanRepo()──▶ RepoScan ──parseScan()──▶ store ──computeFiles()──▶ {caminho: conteúdo}
 ▲          (main)       (caminhos +        (repo.ts)   (Zustand)   (repo.ts)            │
 │                        conteúdo)            │                                         │
 │                                             └─ snapshot: como o disco estava          │
 │                                                                                       ▼
 └──────────── repo:write (main) ◀── RepoChanges ◀────────── diffRepo(snapshot, arquivos, pastas)
```

1. **Leitura** — `scanRepo()` (main) percorre as 4 pastas e devolve todos os caminhos e o conteúdo dos
   `.json`/`.md`. A pasta raiz sempre vem com o nome canônico (aceita português ou inglês e Unicode NFD); `folders`
   traz o nome real de cada uma, para a interface mostrar e o main gravar no lugar certo.
2. **Interpretação** — `parseScan()` (`model/repo.ts`) converte em `RepoContent` (recursos, tecnologias,
   relações, desenhos, documentos, outros arquivos, pastas) e cria o `DiskSnapshot` (conteúdo lido +
   pastas + moves pendentes). Também migra formatos antigos (ver regras.md §9).
3. **Edição** — componentes chamam ações do store (`useModel`). Cada ação é imutável e marca `dirty`.
   Nada toca o disco.
4. **Salvar** — `saveRepo()` (`model/fileActions.ts`):
   - `computeFiles()` gera o conteúdo de todos os arquivos que o estado representa, decidindo os
     caminhos com `computePaths()` (nome do arquivo = slug do nome; mantém o atual se o nome não mudou);
   - `diffRepo()` compara com o snapshot e produz `RepoChanges` (só o que mudou de verdade);
   - `repo:write` aplica; `markSaved()` atualiza o snapshot.
5. **Renomear pasta/desenho** — `renamePath()` não grava: ajusta as chaves em memória **e no snapshot**
   e registra um `move`. No Salvar o main faz `fs.rename`, e o diff já enxerga os arquivos no lugar novo
   (por isso nada é regravado).

## Estado (`model/store.ts`)

`useModel` é um único store Zustand com:

- o conteúdo do repositório (`RepoContent`): `resources`, `technologies`, `relations`, `diagrams`
  (chave = caminho), `docs` (chave = caminho), `paths` (id → caminho salvo), `otherFiles`, `dirs`;
- `root`, `snapshot`, `dirty`;
- interface: `openDiagrams` (abas abertas, desenhos **e** documentos), `activeDiagram`, `selection`,
  `newRelType` (tipo ArchiMate das próximas ligações).

Ações agrupadas por assunto: repositório (`loadRepo`, `markSaved`, `createDir`, `renamePath`,
`deletePath`), abas/desenhos/documentos, recursos e endpoints, tecnologias, relações, formas e itens do
desenho (`moveItem`, `resizeNode`, `removeFromDiagram`, `reorder`). Leia a interface `ModelState` no topo
do arquivo; ela é a lista completa.

**Desfazer/refazer**: um `subscribe` no fim de `store.ts` guarda o estado anterior das fatias de conteúdo
(`TRACKED`) a cada mudança, agrupando mudanças seguidas. Ações novas entram no histórico sozinhas; o que não
deve entrar (carregar, marcar salvo, o próprio desfazer) usa `withoutHistory()`.

Funções auxiliares exportadas: `presentIds()` (recursos no desenho), `technologiesOf()`, `endpointsOf()`,
`endpointRoute()`/`duplicateEndpoint()` (rota repetida no mesmo dono) e `duplicateRelation()` (mesma
ligação: pontas, direção e tipo).

## Interface (renderer)

```
App.tsx
├─ ArchimateMarkers      <defs> SVG das pontas de seta (também renderizado dentro do canvas)
├─ Toolbar               Abrir pasta, Salvar, Recarregar, Exportar JPEG; recebe as ações do menu nativo
├─ ResizablePanel        Painéis laterais com largura ajustável e recolhíveis (preferência em localStorage)
├─ RepoPanel (esquerda)  Árvore da pasta aberta: busca, arrastar; ações no menu ⋯ (RowMenu)
├─ main
│  ├─ DiagramTabs        Abas (desenhos e documentos)
│  └─ Canvas             React Flow  ─ ou ─  MarkdownEditor (quando a aba é .md)
└─ SidePanel (direita)   Abas "Paleta" e "Propriedades" (some quando a aba ativa é Markdown)
   ├─ Palette            Novo recurso, Formas, tipo da Nova ligação
   └─ PropertiesContent  Painel do item selecionado (recurso, endpoint, tecnologia, relação, forma)
```

### Canvas (React Flow)

- **Controlado**: `nodes`/`edges` são derivados do store a cada render (`useMemo`); as mudanças do React
  Flow voltam ao store em `onNodesChange` (posição, redimensionamento). Seleção também vem do store.
- Tipos de nó: `element` (`ElementNode.tsx`, todos os recursos, inclusive endpoints) e `shape`
  (`ShapeNode.tsx`). Endpoints têm nó próprio; o dono aparece só como texto ("de API de Pedidos").
- **Pontos de conexão**: cada nó de recurso tem 16 `Handle` (`ANCHOR_POINTS` em `dnd.ts`). Ficam
  invisíveis e sem clique, a não ser com a ferramenta **Ligar** (`tool` no store; classe `tool-connect` no
  contêiner do canvas; CSS `.anchor-point`). O ponto usado vai para `diagram.anchors`; sem ele, a seta usa
  `centerAnchor()` do lado que encara a outra ponta (`facingSides`). **Pontos livres** (`top@70`,
  `parseAnchor`/`anchorAt` em `dnd.ts`): `AnchorHandles.tsx` desenha faixas nas bordas (`BORDER_HANDLES`,
  CSS `.anchor-border`) e um `Handle` para cada ponto livre já usado no desenho (`data.anchors`, calculado em
  `Canvas.tsx`). A ligação é resolvida em `onConnectEnd`/`onReconnectEnd` pela posição do mouse (`dropTarget`),
  não em `onConnect`; o ponto de início na faixa fica em `borderStart`.
- **Pilha**: recursos e formas compartilham `z`; `zIndex` do nó = `z * 2` e as setas ficam logo abaixo
  do recurso mais ao fundo, para não sumirem atrás de um contêiner. Seta com ponta dentro de outro recurso
  fica logo acima desse recurso de fora (`zFor`), para aparecer inteira até a ponta.
- **Pontas de seta ArchiMate**: `<marker>` SVG com ids `am-<tipo>-<cor>` (`ArchimateMarkers.tsx`),
  uma variante por cor de impacto + seleção. A notação de cada tipo está em `model/archimate.ts`.
- **Guias de alinhamento**: em `onNodesChange`, durante o arrasto, `snapToGuides()`
  (`model/alignment.ts`) encaixa o item e devolve linhas desenhadas via `ViewportPortal`.
- **Exportar JPEG**: `exportImage.ts` usa `html-to-image` no `.react-flow__viewport` enquadrando todos
  os nós. Por isso as `<defs>` das setas também ficam dentro do viewport.

## Dependências principais

| Pacote | Uso |
|---|---|
| `@xyflow/react` 12 | Canvas, nós, arestas, zoom, `NodeResizer`, `ViewportPortal` |
| `zustand` 5 | Estado |
| `tailwindcss` 4 + `@tailwindcss/typography` | Estilos (`@plugin` em `index.css`) |
| `lucide-react` | Ícones |
| `marked` + `dompurify` | Markdown → HTML sanitizado |
| `html-to-image` 1.11.11 | Exportação JPEG (versão fixada: a recomendada pelo React Flow) |
