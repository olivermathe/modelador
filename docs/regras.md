# Regras que não podem quebrar

Estas regras vieram de pedidos explícitos do usuário ou protegem os dados dele. Toda mudança deve
preservá-las. O teste `npm run test:e2e` cobre as principais; se mudar algo perto delas, rode-o.

## 1. Só o Salvar grava em disco

> Pedido do usuário: "os recursos só devem ser persistidos quando eu clicar em salvar".

- Criar, editar, renomear, mover e excluir **qualquer coisa** (recursos, tecnologias, relações,
  desenhos, documentos, pastas) altera **apenas o estado em memória** (`src/renderer/src/model/store.ts`)
  e marca `dirty: true`.
- O único caminho que escreve no repositório é `saveRepo()` (`model/fileActions.ts`) → IPC
  `repo:write` (`src/main/index.ts`).
- Exceções permitidas, por serem ações explícitas com diálogo próprio:
  - criar as 4 pastas ao abrir uma pasta **vazia**, depois de o usuário confirmar no diálogo;
  - **Exportar JPEG**, que grava onde o usuário escolher no diálogo de salvar;
  - `settings.json` do app (último repositório aberto), fora do repositório.
- Nunca adicione `fs` no renderer nem um IPC que grave fora do `repo:write`.

## 2. Salvar não regrava arquivos à toa

O repositório costuma estar no Git; regravar arquivos sem mudança polui o histórico.

- `diffRepo()` (`model/repo.ts`) compara o JSON **por conteúdo** (`sameJson`, ignora ordem de chaves e
  indentação) com o que foi lido. Arquivos editados à mão não são reformatados.
- **Campos opcionais ausentes não são gravados.** `impact`, `relType`, `accessMode`, `strength`,
  `directed`, `z`, `width`/`height`, `shapes` (vazio) e similares só aparecem no arquivo quando têm valor.
  Ao limpar um desses campos, apague a chave (veja `updateRelation`/`updateResource` no store).
  Assim, abrir e salvar um repositório antigo não muda nada.
- Ao adicionar um campo novo: torne-o opcional e omita quando vazio/padrão.

## 3. Arquivos não reconhecidos são intocáveis

- Qualquer arquivo dentro das 4 pastas que o app não entende (`otherFiles`) aparece em cinza na árvore e
  **nunca** é lido como entidade, regravado ou apagado. A única exceção é quando o usuário exclui ou
  renomeia a pasta que o contém (aí ele vai junto, e o diálogo de exclusão avisa).
- Arquivos ocultos (`.gitkeep` etc.) nem são listados. Por isso renomear pasta usa `fs.rename` da pasta
  inteira (move), e não copiar/apagar arquivo por arquivo.

## 4. Gravação restrita às 4 pastas

- `safePath()` no processo principal recusa qualquer caminho fora das 4 pastas e traduz a pasta raiz
  canônica para o nome real em disco.
- **Nomes das pastas em português ou inglês** (`FOLDER_ALIASES`), sem diferença de maiúsculas, acentos ou
  forma Unicode (NFC/NFD, comum no macOS e no Git). `locateFolders()` acha a pasta real. **Nunca renomeie a
  pasta do usuário** e não troque por `existsSync(join(root, 'aplicações'))`.

## 5. Identidade por id, nome só no arquivo

- Recursos, tecnologias e relações são referenciados **sempre por `id`** (UUID). Desenhos e relações
  nunca guardam nomes.
- O **nome do arquivo** deriva do nome da entidade (`slugify`). Renomear a entidade renomeia o arquivo
  (e os das relações dela) no próximo Salvar. Nunca use o nome do arquivo como identidade.

## 6. Biblioteca única, desenho só referencia

- Um recurso existe **uma vez** em `aplicações/`; editar nele reflete em todos os desenhos.
- O que é **aparência** fica no desenho, não no recurso: posição, ordem (`z`), tamanho
  (`width`/`height`) e as formas livres.
- Um recurso aparece **no máximo uma vez** por desenho; o id do nó no React Flow é o id do recurso.
- **Dois tipos de exclusão.** Delete/Backspace (e "Remover do desenho") tira só do desenho aberto; o recurso
  ou a ligação continua existindo. Shift+Delete, "Excluir permanentemente…" (botão direito) e o botão do
  painel apagam de todos os desenhos e o arquivo no Salvar, **sempre depois de perguntar**
  (`components/deleteActions.ts`). Não troque um pelo outro.

## 6b. "Já existe": perguntar, nunca decidir sozinho

> Pedido do usuário: "Já existe um relacionamento entre estes dois recursos? Se sim, questionar se usa o
> existente ou cria um novo sem remover o outro." Mesma regra para recurso com o mesmo nome.

- Ligação entre dois recursos que já têm uma ligação (qualquer tipo, qualquer direção), recurso com nome
  que já existe e endpoint com rota repetida entre as ligações de um recurso: o app **pergunta** (usar o
  existente / criar novo mantendo os dois). Criar novo nunca remove o outro.

## 7. Cor significa impacto, e só impacto

> Pedido do usuário: remover as cores por tipo de recurso, porque confundiam com o impacto.

- Recursos, endpoints e ligações ficam em **cinza neutro**. Verde/laranja/vermelho são exclusivos de
  impacto Novo/Alterado/Excluído (`IMPACTS` em `model/elementTypes.ts`).
- Não reintroduza cor por tipo, por método HTTP ou nos conectores. O tipo se distingue pelo ícone e pelo
  rótulo. (As etiquetas de tecnologia em roxo são a única exceção hoje.)
- Seleção usa azul (`sky`), que não é cor de impacto.

## 8. Recurso redimensionado não esconde texto

- O tamanho mínimo de um recurso acompanha o conteúdo: o texto quebra linha (não é cortado com "…") e a
  altura mínima cresce. Ao soltar a alça, se o conteúdo ficou maior, a altura é ajustada
  (`fitHeightAfterResize` em `ElementNode.tsx`).

## 9. Compatibilidade com repositórios antigos

Repositórios criados por versões anteriores precisam continuar abrindo; a conversão acontece **em
memória** e só vai para o disco no Salvar (regra 1):

- endpoints dentro do arquivo do serviço (`"endpoints": [...]`) → viram arquivos próprios em `aplicações/`.

Ao mudar o formato de novo, siga o mesmo padrão: ler o antigo, converter em memória, marcar `dirty`.

## 10. Idioma

- Todo texto visível na interface, mensagens de erro, nomes de pastas do repositório e comentários do
  código estão em **português do Brasil**. Identificadores de código (variáveis, funções, tipos) estão em
  inglês.
