# Formato do repositório

Tudo que o app lê e grava. Tipos TypeScript em `src/renderer/src/model/types.ts`; leitura em
`parseScan()` e escrita em `computeFiles()` (`model/repo.ts`). Exemplo completo em
`exemplo-repositorio/`.

```
<repositório>/
├─ aplicações/    recursos (a biblioteca), inclusive endpoints
├─ tecnologias/   tecnologias
├─ relações/      relações (recurso→recurso, recurso→endpoint, recurso→tecnologia)
└─ projetos/      desenhos (.json) e documentos (.md), em subpastas livres
```

Regras gerais:

- JSON com 2 espaços de indentação e quebra de linha no final.
- **Campos opcionais só existem quando têm valor** (ver regras.md §2).
- Ids são UUIDs gerados com `crypto.randomUUID()`.
- Nome de arquivo = `slugify(nome)` (minúsculas, sem acentos, `-` como separador, até 60 caracteres).
  Em caso de colisão: `nome-2.json`, `nome-3.json`… Desenhos e documentos usam o nome digitado pelo
  usuário (acentos e espaços permitidos).
- Qualquer outro arquivo dentro das pastas é preservado e listado em cinza.

## aplicações/ — recursos

`aplicações/<slug-do-nome>.json`

```json
{
  "id": "3f1c2a10-0000-4000-8000-000000000002",
  "type": "service",
  "name": "API de Pedidos",
  "description": "Cria e consulta pedidos.",
  "owner": "Time Pedidos",
  "impact": "changed"
}
```

| Campo | Tipo | Obrigatório | Observação |
|---|---|---|---|
| `id` | string | sim | |
| `type` | `system` \| `service` \| `database` \| `queue` \| `schema` \| `endpoint` | sim | |
| `name` | string | sim | Para endpoints é sempre `"<MÉTODO> <caminho>"`, recalculado. |
| `description`, `owner` | string | sim | Podem ser `""`. |
| `impact` | `new` \| `changed` \| `removed` | não | Ausente = sem alteração. |
| `method` | `GET` \| `POST` \| `PUT` \| `PATCH` \| `DELETE` | só endpoint | |
| `path` | string | só endpoint | Ex.: `/pedidos/{id}`. |

**Endpoints** são recursos com `type: "endpoint"` e nó próprio nos desenhos. **O dono não é um campo: é a
ligação de Composição** dono → endpoint em `relações/` (criada por "Adicionar" no painel do serviço). Com
dono, o arquivo é `<slug-do-dono>--<slug-do-nome>.json` (ex.: `api-de-pedidos--get-pedidos-id.json`); sem
dono, só `<slug-do-nome>.json`. Excluir o dono não exclui os endpoints (só as ligações).

Endpoint repetido é verificado **pelas ligações**: ao ligar um recurso a um endpoint (ou mudar a rota de um
endpoint ligado), se o recurso já estiver ligado a outro endpoint com a mesma rota (método igual e caminho
igual ignorando maiúsculas, barra final e nome de parâmetro), o app pergunta: usar o existente (o novo dá
lugar a ele) ou manter os dois.

*Formato antigo:* `"parentId": "<id do dono>"` no endpoint. Vira uma ligação de Composição ao abrir e o
campo sai do arquivo no próximo Salvar.

*Formato antigo:* `"endpoints": [{ "method", "path", "description" }]` dentro do recurso. É convertido
para arquivos próprios ao abrir; a gravação acontece no próximo Salvar.

## tecnologias/

`tecnologias/<slug-do-nome>.json`

```json
{ "id": "7a2b0000-…", "name": "PostgreSQL", "category": "Banco de dados", "description": "" }
```

Ligar uma tecnologia a um recurso **não** altera nenhum dos dois: cria uma relação `uses` (abaixo).

## relações/

`relações/<slug-origem>--<slug-destino>.json`, ou `<slug-origem>--usa--<slug-tecnologia>.json` para
`uses`. Os slugs vêm dos **nomes atuais** das pontas, então renomear um recurso renomeia as relações dele.

```json
{
  "id": "9c3d0000-…",
  "kind": "flow",
  "sourceId": "<id do recurso>",
  "targetId": "<id do recurso ou endpoint>",
  "label": "Lê e grava",
  "protocol": "SQL",
  "relType": "access",
  "accessMode": "readwrite"
}
```

| Campo | Tipo | Observação |
|---|---|---|
| `kind` | `flow` \| `uses` | `flow`: seta nos desenhos. `uses`: recurso → tecnologia (etiqueta no nó). |
| `sourceId`, `targetId` | string | `flow` aceita endpoint como destino ("recurso chama endpoint"). |
| `label`, `protocol` | string | Rótulo da seta: `label [protocol]`. |
| `impact` | `new` \| `changed` \| `removed` | Opcional. |
| `relType` | tipo ArchiMate (abaixo) | Opcional; ausente = "Genérica" (seta cheia simples). |
| `accessMode` | `write` \| `read` \| `readwrite` \| `access` | Só `access`; ausente = `write`. |
| `strength` | string | Só `influence` (`+`, `++`, `-`, `--`…). |
| `directed` | `true` | Só `association`. |

Tipos ArchiMate (`model/archimate.ts`): `composition`, `aggregation`, `assignment`, `realization`,
`serving`, `access`, `influence`, `triggering`, `flow`, `specialization`, `association`.

## projetos/ — desenhos

`projetos/**/<nome>.json`. A **chave** do desenho no app é o caminho do arquivo; não há id.

```json
{
  "nodes": [
    { "resourceId": "<id>", "x": 0, "y": 220, "z": 4, "width": 300, "height": 180 }
  ],
  "edges": ["<id de relação flow>"],
  "shapes": [
    {
      "id": "<uuid>", "kind": "rounded", "x": -230, "y": 170, "width": 700, "height": 470,
      "text": "", "fill": "#dae8fc", "stroke": "#6c8ebf", "strokeStyle": "dashed",
      "textColor": "#0f172a", "fontSize": 14, "z": 1
    }
  ]
}
```

| Campo | Observação |
|---|---|
| `nodes[].resourceId` | Recurso (inclusive endpoint) no desenho. No máximo um nó por recurso. |
| `nodes[].x`, `y` | Arredondados para inteiro ao gravar. |
| `nodes[].z` | Ordem de empilhamento compartilhada com as formas. Opcional (= 0). |
| `nodes[].width`, `height` | Tamanho escolhido pelo usuário **neste desenho**. Opcional (= automático). |
| `connectors` | Ligações **só visuais** entre formas (ou forma e recurso): `{ id, source, target, sourceHandle?, targetHandle?, label?, arrow?: "end"\|"both"\|"none", dashed?, color? }`. Não são relações: nada vai para a pasta de relações. Omitido quando vazio; ligações com ponta que saiu do desenho não são gravadas. |
| `nodes[].locked`, `shapes[].locked` | `true` = travado neste desenho (não move nem é selecionado). Omitido quando destravado. |
| `edges` | Relações `flow` exibidas; só aparecem se as duas pontas têm nó no desenho. |
| `shapes` | Formas livres (`rectangle`, `rounded`, `ellipse`, `text`, `legend`). `legend` é o quadrinho de legenda das cores de impacto: `text` é o título; as cores não são gravadas (vêm do app). Omitido quando vazio. |
| `anchors` | `{ "<id da relação>": { "source": "right-1", "target": "top-5" } }`: ponto de conexão escolhido em cada ponta. Ids: `top-1`…`top-5`, `bottom-1`…`bottom-5`, `left-1`…`left-3`, `right-1`…`right-3`, ou um ponto livre da borda `<lado>@<porcentagem>` (ex.: `top@70`, a 70% da largura no lado de cima; `left@25`, a 25% da altura no lado esquerdo). Vale também para `sourceHandle`/`targetHandle` dos `connectors`. Ponta sem ponto = automático. Só setas presentes em `edges` são gravadas; omitido quando vazio. |

Um arquivo em `projetos/` só é desenho se tiver `nodes` como array; senão é "outro arquivo".

## projetos/ — pasta de feature

Criada pelo botão "Nova feature": `projetos/**/<ano>-<trimestre>-<número>-<nome>/` com `diagrama.json` e
`processo.json` (desenhos vazios) e `doc.md` (modelo com número da feature, período e seções), ou com uma
cópia exata (byte a byte, inclusive subpastas vazias e binários) de uma pasta modelo escolhida no modal. Não há
nada especial no formato: depois de criada, é uma pasta comum de `projetos/`.

## projetos/ — documentos

`projetos/**/<nome>.md` — Markdown puro, gravado exatamente como digitado.

## Nomes das pastas: português ou inglês

Cada pasta raiz aceita nomes em português ou inglês, sem diferença de maiúsculas, acentos ou forma Unicode
(`FOLDER_ALIASES` em `src/main/index.ts`). **A pasta fica com o nome que tem; o app não renomeia.**

| Pasta (nome canônico, usado no código) | Nomes aceitos em disco |
|---|---|
| `aplicações` | `aplicações`, `aplicacoes`, `applications`, `application` |
| `tecnologias` | `tecnologias`, `technologies`, `technology`, `tecnologies` |
| `relações` | `relações`, `relacoes`, `relacionamentos`, `relationships`, `relations` |
| `projetos` | `projetos`, `projects` |

Internamente (store, `paths`, desenhos em memória) o app usa sempre o nome canônico; o processo principal
traduz para o nome real ao ler e gravar, e a interface mostra o nome real (`folderNames`, `displayPath`).
Se existirem dois nomes para a mesma pasta, vale o primeiro da lista. Repositório novo é criado em português.
