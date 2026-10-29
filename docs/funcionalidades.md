# Funcionalidades → código

Caminhos relativos a `src/renderer/src/` (exceto onde indicado).

| Funcionalidade | Onde |
|---|---|
| Desfazer/refazer | store `undo`, `redo`, `history`; histórico em `store.ts` (`stepHistory`, `rebaseHistoryAfterSave`); menu Editar em `src/main/index.ts`; `Toolbar.tsx` (`undoOrRedo`, botões) |
| Abrir pasta, reabrir a última, recarregar | `model/fileActions.ts` (`openRepo`, `openLastRepo`, `reloadRepo`); main: `repo:open`, `repo:last`, `repo:scan`, `scanRepo`, `locateFolders` |
| Salvar (diff + gravação) | `model/fileActions.ts` `saveRepo`; `model/repo.ts` `computeFiles`, `computePaths`, `diffRepo`, `sameJson`; main `repo:write`, `safePath` |
| Aviso de não salvo ao fechar / título da janela | `App.tsx` (`setWindowState`); main `window:state` e evento `close` |
| Árvore da pasta, busca | `components/RepoPanel.tsx`; `model/tree.ts` (`buildTree`, `filterTree`) |
| Menu ⋯ das linhas da árvore | `components/RowMenu.tsx`; itens em `RepoPanel.tsx` (`dirMenu`, menu de desenho/documento) |
| Painéis laterais redimensionáveis e recolhíveis | `components/ResizablePanel.tsx` (largura e estado em `localStorage`); uso em `App.tsx` |
| Criar/renomear/excluir pasta, desenho e documento em `projetos/` | `RepoPanel.tsx` (`actions`, `InlineInput`); store `createDir`, `createDiagram`, `createDoc`, `renamePath`, `deletePath` |
| Abas de desenhos/documentos | `components/Toolbar.tsx` (`DiagramTabs`); store `openDiagrams`, `activeDiagram` |
| Dica imediata ao passar o mouse | `components/Tooltip.tsx` |
| Paleta (novo recurso, formas, tipo da nova ligação), só ícones | `components/Palette.tsx`, `RelTypePicker.tsx` (`RelTypeGrid`); arrastar: `components/dnd.ts` + `Canvas.tsx` `onDrop` |
| Painel direito com abas Paleta/Propriedades | `components/SidePanel.tsx` (troca automática pela seleção) |
| Propriedades de recurso, endpoint, tecnologia, relação, forma | `components/PropertiesPanel.tsx` |
| Recursos no desenho (tipo, impacto, tecnologias; endpoints com nó próprio) | `components/ElementNode.tsx` |
| Redimensionar recurso (mínimo = conteúdo) | `ElementNode.tsx` (`NodeResizer`, `fitHeightAfterResize`); store `resizeNode`; `Canvas.tsx` `onNodesChange` |
| Formas (retângulo, quadrado, elipse, texto), cores, texto editável | `components/ShapeNode.tsx`; `PropertiesPanel.tsx` `ShapeProperties`; `model/elementTypes.ts` `SHAPE_KINDS`, `SHAPE_COLORS` |
| Legenda das cores de impacto | Forma `legend`: `ShapeNode.tsx` (`ImpactLegend`, cores de `IMPACTS`); `elementTypes.ts` `SHAPE_KINDS`; store `addShape`; `repo.ts` `parseShape` |
| Ordem de empilhamento (frente/trás) | store `reorder`; `components/ContextMenu.tsx` (`ORDER_ACTIONS`); atalhos em `Canvas.tsx` |
| Menu de contexto (botão direito) | `components/ContextMenu.tsx` |
| Guias de alinhamento e encaixe | `model/alignment.ts` `snapToGuides`; `Canvas.tsx` (`itemRects`, `AlignmentGuides`) |
| Ligações e tipos ArchiMate | `model/archimate.ts` (`ARCHIMATE_TYPES`, `relationNotation`); `components/ArchimateMarkers.tsx`; `components/RelTypePicker.tsx` (`RelTypeList`); `Canvas.tsx` `edges` |
| Ligar recurso a endpoint | Como qualquer recurso: o endpoint tem nó próprio. A direção é a do arrasto (`Canvas.tsx` `onConnect`) |
| Inverter direção de uma ligação | store `reverseRelation`; `PropertiesPanel.tsx` (cabeçalho da relação); `ContextMenu.tsx` |
| Renomear com dois cliques no nome (e caminho do endpoint) | `ElementNode.tsx` (`InlineEdit`, `commitName`, `commitPath`) |
| Recurso dentro de outro esconde as ligações entre eles | `model/nesting.ts` (`areNested`, `nestedWith`); `Canvas.tsx` (`resourceRects`, `hiddenEdgeIds`, `afterResourceDrop`); store `hiddenEdges`; aviso no painel da relação |
| Ligações carregadas ao incluir recurso no desenho | store `placeResource`/`createEndpoint` → `withImpliedEdges` |
| Seleção múltipla (retângulo, Shift+clique) | store `selectedItems`, `selectedEdges`, `setMultiSelection`, `selectedIds`; `Canvas.tsx` (`onNodesChange`/`onEdgesChange` com mudanças `select`, `selectionOnDrag`); `PropertiesPanel.tsx` `MultiProperties`; menu de contexto em grupo |
| Travar recurso/forma no desenho | store `setLocked`; `locked` em `DiagramNode`/`Shape`; `Canvas.tsx` (nó sem arrasto/seleção, `pointerEvents: none`); `components/LockBadge.tsx`; `PropertiesPanel.tsx` `LockToggle`; `ContextMenu.tsx`; botão direito em item travado: `Canvas.tsx` `lockedItemAt` |
| Ligações visuais entre formas | `Connector` em `model/types.ts`; store `addConnector`, `updateConnector`, `reverseConnector`, `removeEdgesFromDiagram`; `Canvas.tsx` (`onConnect` com forma em alguma ponta, `connectorEdges`); pontos de conexão em `ShapeNode.tsx`; `PropertiesPanel.tsx` `ConnectorProperties`; `ContextMenu.tsx` (`kind: 'connector'`) |
| Pergunta "usar o existente / criar novo" | `components/ChoiceDialog.tsx`; store `choice`, `ask` |
| Exclusão do desenho × permanente | `components/deleteActions.ts` (`askPermanentDelete`); Shift+Delete em `Canvas.tsx`; `ContextMenu.tsx`; botões em `PropertiesPanel.tsx` |
| Ligação já existente (pergunta) | store `relationBetween`, `connect` (abre `choice`), `showRelation` |
| Impacto (Novo/Alterado/Excluído) e cores | `model/elementTypes.ts` `IMPACTS`, `impactInfo`; `PropertiesPanel.tsx` `ImpactPicker` |
| Tecnologias (várias por recurso, criar pela busca) | `PropertiesPanel.tsx` `TechnologyPicker`; store `toggleTechnology`, `createTechnology`; soltar tecnologia sobre recurso em `Canvas.tsx` `onDrop` |
| Aviso de recurso com nome já existente (usar o existente / criar novo) | `components/DuplicateResourceDialog.tsx`; `PropertiesPanel.tsx` `ResourceProperties` (`commitName`); store `checkDuplicateName`, `mergeResource`, `sameNameResources` |
| Endpoints como recursos (dono = ligação de Composição) | store `createEndpoint`, `endpointsOf`, `ownersOf`; `PropertiesPanel.tsx` `EndpointList`, `EndpointProperties` |
| Endpoint repetido (pelas ligações) | store `linkedEndpointWithRoute`, `routeConflict`, `endpointRoute`; `EndpointRouteEditor.tsx` (`commitEndpointRoute`, `NewEndpointForm`); `connect` |
| Ferramenta Selecionar/Ligar e pontos de conexão | store `tool`, `setTool`, `setEdgeAnchors`; `components/ToolSwitch.tsx`; `dnd.ts` `ANCHOR_POINTS`, `centerAnchor`; `ElementNode.tsx`; `Canvas.tsx` (`onConnect`, `onReconnect`, `edges`); CSS `.anchor-point` em `index.css` |
| Ligar em qualquer ponto da borda (pontos livres) | `components/AnchorHandles.tsx` (faixas da borda, `borderStart`); `dnd.ts` (`anchorAt`, `parseAnchor`, `freeAnchorId`, `BORDER_HANDLES`); `Canvas.tsx` (`onConnectEnd`, `onReconnectEnd`, `dropTarget`, `BorderConnectionLine`, `anchors` nos dados do nó); CSS `.anchor-border` |
| Nova feature a partir de pasta modelo | `FeatureDialog.tsx` (escolha e prévia); main `template:pick`, `template:read`; store `createFeatureFromTemplate`, `pendingFiles`, `templateOriginals`; `fileActions.ts` `saveRepo` (grava base64 e originais) |
| Nova feature (pasta com diagrama, processo e documento) | `components/FeatureDialog.tsx`; store `createFeature`, `openFeatureDialog`; botões em `Toolbar.tsx` e `RepoPanel.tsx` |
| Editor Markdown com pré-visualização | `components/MarkdownEditor.tsx` (`marked` + `DOMPurify`, links abrem fora) |
| Exportar JPEG | `components/exportImage.ts`; main `export:image`; menu ⌘E |
| Pastas em português ou inglês | main `FOLDER_ALIASES`, `locateFolders`, `safePath`; scan devolve `folders`; store `folderNames`, `displayPath` |
| Migração de formatos antigos | `model/repo.ts` `parseScan` (endpoints dentro do serviço, `parentId` → Composição) |

## Atalhos

| Atalho | Ação | Onde |
|---|---|---|
| ⌘O / ⌘S / ⌘E | Abrir, Salvar, Exportar JPEG | menu em `src/main/index.ts` → `Toolbar.tsx` |
| ⌘Z / Ctrl+Z | Desfazer (num campo de texto, desfaz a digitação) | menu Editar → `Toolbar.tsx` `undoOrRedo` |
| ⇧⌘Z / Ctrl+Shift+Z / Ctrl+Y | Refazer | idem |
| ⌫ / Delete | Remove do desenho (não da biblioteca) | `Canvas.tsx` `onDelete` |
| ⇧⌫ / Shift+Delete | Exclui permanentemente (pergunta antes), também com vários selecionados | `Canvas.tsx` → `deleteActions.ts` |
| Arrastar no fundo / Shift+clique | Selecionar vários | `Canvas.tsx` |
| Botão do meio/direito, Espaço + arrastar, dois dedos | Mover o desenho | `Canvas.tsx` (`panOnDrag`, `panOnScroll`) |
| ⌘] ⌘[ ⇧⌘] ⇧⌘[ | Avançar, recuar, frente, trás | `Canvas.tsx` (efeito de teclado) |
| ⌘D | Duplicar forma | `Canvas.tsx` |
| V / L / Esc | Ferramenta Selecionar / Ligar / voltar a Selecionar | `Canvas.tsx` |
| Duplo clique | Editar texto da forma; renomear recurso (ou caminho do endpoint) no desenho; renomear item na árvore | `ShapeNode.tsx`, `RepoPanel.tsx` |
