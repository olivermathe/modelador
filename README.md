# Modelador

Ferramenta desktop de modelagem de arquitetura (Electron + React + React Flow) que trabalha sobre uma
pasta de repositório — ideal para versionar com Git e compartilhar com o time.

## Rodar

```bash
npm install
npm run dev      # app em modo desenvolvimento
npm run build    # typecheck + build em out/
```

Para experimentar, abra a pasta `exemplo-repositorio/` pelo botão **Abrir pasta**.

## Estrutura do repositório

```
aplicações/   um arquivo .json por recurso (a biblioteca)
               endpoints também são recursos: <servico>--<metodo>-<caminho>.json (ou só <metodo>-<caminho>.json sem dono)
tecnologias/   um arquivo .json por tecnologia
relações/     um arquivo .json por relação
               - flow: recurso → recurso ou recurso → endpoint (seta nos desenhos)
               - uses: recurso → tecnologia (etiqueta no recurso)
projetos/      desenhos (.json) e documentos Markdown (.md), em qualquer estrutura de subpastas
```

Recursos, tecnologias e relações existem **uma vez**. Os desenhos em `projetos/` guardam só os ids e as
posições, então editar um recurso atualiza todos os desenhos que o usam.

Os nomes dos arquivos seguem o nome da entidade (`API de Pedidos` → `aplicações/api-de-pedidos.json`). Se
você renomear um recurso, o arquivo e as relações dele são renomeados ao salvar. Os desenhos não mudam,
porque referenciam ids. Arquivos que o app não reconhece aparecem em cinza na árvore e nunca são alterados.

**Nada é gravado antes do Salvar (⌘S)**: criar, renomear e excluir pastas, desenhos, recursos e relações
fica em memória até lá. Arquivos editados à mão com outra ordem de chaves não são regravados à toa.
As pastas podem ter nomes em português ou inglês (`aplicações`/`applications`, `tecnologias`/`technologies`,
`relações`/`relacionamentos`/`relationships`, `projetos`/`projects`); o app usa os nomes como estão, sem
renomear. Repositórios no formato antigo são migrados ao salvar (ex.: endpoints dentro do serviço viram
arquivos próprios).

## Como usar

- **Painéis laterais**: arraste a borda para mudar a largura (duplo clique volta ao padrão) e use o botão no
  topo para recolher/expandir. O app lembra o tamanho.
- **Árvore à esquerda**: mostra a pasta aberta. Passe o mouse numa linha e clique no **⋯** para ver as ações:
  - `projetos/` e subpastas: novo desenho, novo documento, nova feature, nova pasta, renomear, excluir;
  - desenhos e documentos: renomear, excluir;
  - `tecnologias/`: novas tecnologias.
- **Painel da direita** tem duas abas: **Paleta** (ícones de Novo recurso, Formas e o tipo da Nova ligação; passe o
  mouse para ver o nome) e
  **Propriedades** (abre sozinha ao selecionar um item; volta para a Paleta ao clicar no fundo do desenho).
- **Novo recurso**: arraste um tipo da Paleta (Sistema, Serviço/API, Banco, Fila, Schema, Endpoint) para o desenho aberto.
- **Nome repetido**: ao terminar de digitar o nome de um recurso (novo ou renomeado), o app procura outro com o
  mesmo nome (sem diferenciar maiúsculas, acentos e pontuação). Se achar, pergunta: **Usar este** troca o recurso
  pelo existente em tudo (desenhos, ligações, tecnologias e endpoints) e apaga o duplicado ao salvar; **Criar novo
  mesmo** / **Manter os dois** mantém os dois; **Voltar ao nome anterior** (ou Esc) desfaz o nome.
- **Recurso existente**: arraste o arquivo de `aplicações/` para o desenho. As setas que ele já tem com
  recursos do desenho aparecem sozinhas.
- **Tecnologia**: arraste o arquivo de `tecnologias/` sobre um recurso no desenho, ou ligue pelo painel de
  propriedades.
- **Relação**: arraste de um conector (bolinha) de um recurso para outro. A direção é a do arrasto: comece em quem
  serve, chama ou compõe (ex.: Serve do endpoint para quem o usa). Para trocar depois: "Inverter direção" no
  painel da relação ou no botão direito da ligação.
- **Excluir**: **Delete/Backspace** tira o item só do desenho (ele continua existindo). **Shift+Delete** exclui
  permanentemente (de todos os desenhos e o arquivo, no Salvar), sempre perguntando antes. O botão direito
  num recurso ou numa ligação mostra as duas opções.
- **Endpoints**: são recursos com nó próprio no desenho. Crie pelo painel do serviço/sistema ("Adicionar",
  método + caminho; se o serviço estiver no desenho, o endpoint entra logo abaixo dele) ou arrastando
  "Endpoint" da Paleta. O dono do endpoint é a ligação de Composição do serviço para ele. Se um recurso já
  estiver ligado a um endpoint com a mesma rota (`GET /pedidos/{id}` e `GET /pedidos/{pedidoId}/` contam como
  a mesma), o app pergunta: usar o existente ou criar novo, mantendo os dois. Ligue um recurso ao endpoint para
  dizer "recurso X chama endpoint Y".
- **Selecionar vários**: segure o botão do mouse no fundo do desenho e arraste um retângulo (entra o que ficar
  inteiro dentro), ou use Shift+clique. Arraste um dos selecionados para mover todos; Delete, Shift+Delete, o
  botão direito e o painel valem para o grupo. Para mover o desenho: botão do meio ou direito, Espaço +
  arrastar, ou dois dedos no trackpad. Zoom: pinça ou ⌘ + roda do mouse.
- **Travar**: botão direito → "Travar" (ou o botão no painel) num recurso ou forma. Travado, ele não se move nem
  é selecionado, e dá para selecionar por cima dele (útil para contêineres). Para destravar: botão direito em
  cima dele → "Destravar", ou clique no cadeado.
- **Renomear no desenho**: dois cliques no nome do recurso (ou no caminho do endpoint); Enter confirma, Esc
  cancela. Se o nome já existir, aparece o mesmo aviso de recurso repetido do painel.
- **Recurso dentro de outro**: arraste um recurso para cima ou para dentro de outro e as ligações entre os dois
  deixam de ser desenhadas (continuam existindo; o painel da relação avisa). Afaste-os e as setas voltam.
- **Ligações automáticas e repetidas**: ao incluir um recurso existente no desenho, as ligações dele com os
  recursos que já estão lá aparecem sozinhas. Ligar dois recursos que já têm uma ligação entre si abre a
  pergunta: usar a existente ou criar uma nova, mantendo as duas.
- **Impacto**: recursos, endpoints e relações têm Sem alteração / Novo / Alterado / Excluído. É a única cor do
  desenho: sem impacto, tudo fica em cinza neutro; Novo é verde, Alterado laranja e Excluído vermelho tracejado.
- **Tecnologias**: no painel do recurso, "+ Tecnologias" abre uma lista com busca para marcar várias; digite
  nomes separados por vírgula para criar e ligar de uma vez.
- **Formas**: arraste Retângulo, Quadrado, Elipse ou Texto. Dois cliques editam o texto; com a forma selecionada,
  arraste os cantos para redimensionar e use o painel para cores, borda e tamanho do texto.
- **Tamanho dos recursos**: selecione o recurso e arraste as alças dos cantos/bordas. O tamanho vale só para
  aquele desenho. O mínimo acompanha o conteúdo: ao estreitar, o texto quebra linha e a altura cresce, para nada
  ficar escondido. "Voltar ao tamanho automático" no painel desfaz.
- **Ligar recursos**: ative a ferramenta **Ligar** (botão no canto do desenho, tecla L, ou escolhendo um tipo
  em "Nova ligação" na Paleta). Os pontos de conexão aparecem só com ela ativa: arraste de um ponto até outro
  recurso. O ponto escolhido fica guardado; arrastar a ponta de uma seta troca o ponto. Esc ou V volta a
  Selecionar.
- **Nova feature**: botão na barra superior (ou o ícone ao passar o mouse numa pasta de `projetos/`). Pede
  nome, número no Azure DevOps, pasta, ano e trimestre, e cria `<ano>-<trimestre>-<número>-<nome>/` com
  `diagrama.json`, `processo.json` e `doc.md`, ou, em "Copiar de uma pasta modelo", com uma cópia exata da pasta
  escolhida (o app lembra a pasta modelo de cada repositório). Como tudo, vai para o disco no Salvar.
- **Ordem**: botão direito no item, painel de propriedades ou ⌘] / ⌘[ (avançar/recuar) e ⇧⌘] / ⇧⌘[ (frente/trás).
- **Pastas e desenhos de projetos/**: passe o mouse para renomear (✎) ou excluir (🗑), ou dê dois cliques no nome.
- **Tipos de ligação ArchiMate**: Composição, Agregação, Atribuição, Realização, Serve, Acesso (lê/grava),
  Influência (+/−), Disparo, Fluxo, Especialização e Associação, cada um com a notação oficial. Escolha o tipo
  das próximas ligações em "Nova ligação", na Paleta, ou mude na aba Propriedades da relação.
- **Guias de alinhamento**: ao arrastar, linhas magenta aparecem quando bordas ou centros se alinham com outro
  item, e o item encaixa na posição.
- **Markdown**: passe o mouse numa pasta de `projetos/` e clique em "Novo documento". O editor tem os modos
  Editar, Dividido e Visualizar.
- **Exportar JPEG** (⌘E): gera uma imagem do desenho inteiro em alta resolução, no local que você escolher.
- **Desfazer/refazer**: Ctrl+Z ou ⌘Z desfaz; ⇧⌘Z, Ctrl+Shift+Z ou Ctrl+Y refaz (também nos botões da barra). Um
  arrasto ou uma digitação seguida é um passo só. Num campo de texto, desfaz a digitação. Funciona depois de
  salvar, até a última mudança de pastas já gravada.
- **⌘S** grava na pasta apenas os arquivos que mudaram. **Recarregar** relê a pasta do disco (por
  exemplo, depois de um `git pull`).
- O app reabre automaticamente o último repositório usado.

## Código

Documentação de manutenção (arquitetura, formato dos arquivos, regras que não podem quebrar, testes) em
[docs/](docs/README.md). Agentes de IA começam por [AGENTS.md](AGENTS.md).

```
src/main/        processo principal: abrir pasta, ler/gravar arquivos (restrito às 4 pastas)
src/preload/     ponte segura (window.api)
src/renderer/src/
  model/types.ts   formato dos arquivos
  model/repo.ts    pasta ⇄ memória: leitura, nomes de arquivo, diff do que salvar
  model/store.ts   estado (Zustand) e operações
  model/tree.ts    árvore de pastas exibida no painel
  components/      Canvas, RepoPanel, PropertiesPanel, Toolbar
```
