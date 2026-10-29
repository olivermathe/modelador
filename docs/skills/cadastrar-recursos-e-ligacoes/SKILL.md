---
name: cadastrar-recursos-e-ligacoes
description: Cadastra recursos (sistemas, serviços, bancos, filas, schemas, endpoints), tecnologias e ligações (relações ArchiMate) num repositório do Modelador, escrevendo os arquivos JSON direto nas pastas. Use quando pedirem para cadastrar, criar, registrar ou documentar componentes de arquitetura, endpoints, integrações ou dependências num repositório do Modelador, ou para colocá-los num desenho.
---

# Cadastrar recursos e ligações no Modelador

O Modelador guarda a arquitetura numa pasta versionada com Git: **um arquivo JSON por recurso, por
tecnologia e por ligação**. Esta skill ensina a criar esses arquivos à mão, de um jeito que o app abre sem
erro e **não regrava nem renomeia nada** no próximo Salvar.

**Trabalhe só com arquivos.** Não abra, não clique e não automatize a interface do Modelador: crie e edite
os JSON direto nas pastas do repositório. O app só lê esses arquivos quando o usuário abrir ou recarregar
o repositório.

Funciona com qualquer agente que consiga ler e escrever arquivos. Se o agente puder rodar Node.js, use o
validador `validar.mjs` (ao lado deste arquivo) no fim. Ele também só lê arquivos.

## 1. Antes de escrever: reconheça o repositório

1. **Ache as 4 pastas raiz.** Os nomes podem estar em português ou inglês. Use o nome **que já existe**;
   nunca renomeie nem crie a versão no outro idioma.

   | Papel | Nomes aceitos |
   |---|---|
   | recursos | `aplicações`, `aplicacoes`, `applications`, `application` |
   | tecnologias | `tecnologias`, `technologies`, `technology`, `tecnologies` |
   | ligações | `relações`, `relacoes`, `relacionamentos`, `relationships`, `relations` |
   | desenhos e docs | `projetos`, `projects` |

   Se faltar alguma, crie com o nome em português.
2. **Leia todos os JSON de recursos, tecnologias e ligações.** Você vai precisar dos `id` para ligar, e
   para não duplicar (passo 2).
3. **Abra 1 ou 2 arquivos de exemplo** de cada pasta e copie o estilo (ordem das chaves, campos usados).

## 2. Regras que não podem quebrar

- **Não duplique.** Antes de criar um recurso, procure um com o mesmo nome, comparando sem maiúsculas,
  acentos e pontuação (`API de Pedidos` = `api de pedidos` = `API-de-Pedidos`). Se existir, **use o
  existente** (o `id` dele). Só crie outro se o usuário pedir explicitamente.
- **Não duplique ligações.** Antes de ligar A e B, veja se já há ligação `flow` entre os dois, em
  qualquer direção e de qualquer tipo. Se houver, pergunte ao usuário se usa a existente ou cria uma nova
  (sem apagar a outra). Na dúvida, não crie.
- **Endpoint repetido:** antes de ligar um recurso a um endpoint, veja se o recurso já está ligado a outro
  endpoint com a **mesma rota** (mesmo método, caminho igual ignorando maiúsculas, barra final e nome dos
  parâmetros: `/pedidos/{id}` = `/Pedidos/{pedidoId}/`). Se estiver, use o existente.
- **Ids** são UUID v4 novos (`crypto.randomUUID()`, `uuidgen | tr A-Z a-z`, ou equivalente). Nunca reuse
  nem invente ids "bonitos".
- **Nunca altere** arquivos que você não precisa mudar, nem a formatação deles.
- **Campos opcionais só existem quando têm valor.** Não escreva `"impact": null`, `"relType": ""` etc.
  Campos obrigatórios de texto podem ser `""`.
- **Cor é impacto.** Não há campo de cor em recursos ou ligações; quem dá cor é `impact`.
- **JSON** com 2 espaços de indentação, UTF-8 e **quebra de linha no fim do arquivo**.

## 3. Nome do arquivo (slug)

O nome do arquivo é calculado pelo app a partir do nome. Se você usar outro, o app **renomeia o arquivo
no próximo Salvar**. Calcule assim:

```js
const slugify = (text) =>
  text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'sem-nome'
```

Exemplos: `API de Pedidos` → `api-de-pedidos`; `GET /pedidos/{id}` → `get-pedidos-id`;
`Ação & Reação` → `acao-reacao`.

Se o caminho já existir (outro item com o mesmo slug), acrescente `-2`, `-3`… (`api-de-pedidos-2.json`).

## 4. Recurso

`<recursos>/<slug-do-nome>.json`

```json
{
  "id": "1b6f5c2e-8f0a-4d3e-9a51-0c7d2b4e6f10",
  "type": "service",
  "name": "API de Pedidos",
  "description": "Cria e consulta pedidos.",
  "owner": "Time Pedidos",
  "impact": "new"
}
```

| Campo | Valores | Obrigatório |
|---|---|---|
| `id` | UUID | sim |
| `type` | `system` (Sistema), `service` (Serviço/API), `database` (Banco), `queue` (Fila/Tópico), `schema` (contrato de dados: payload, evento, tabela), `endpoint` | sim |
| `name` | texto | sim |
| `description`, `owner` | texto (pode ser `""`) | sim |
| `impact` | `new` (Novo), `changed` (Alterado), `removed` (Excluído) | não; ausente = sem alteração |

Use `impact` quando o pedido for de uma mudança (feature, projeto): o que a feature cria é `new`, o que
ela muda é `changed`, o que ela desliga é `removed`. Para documentar o que já existe, omita.

## 5. Endpoint

Endpoint é um recurso com `type: "endpoint"`, `method` e `path`. O `name` é **sempre**
`"<MÉTODO> <caminho>"`.

```json
{
  "id": "c0a1e7d4-2b3c-4f5a-8e9d-1a2b3c4d5e6f",
  "type": "endpoint",
  "name": "GET /pedidos/{id}",
  "description": "Consulta um pedido",
  "owner": "Time Pedidos",
  "method": "GET",
  "path": "/pedidos/{id}"
}
```

- `method`: `GET`, `POST`, `PUT`, `PATCH` ou `DELETE`. `path` começa com `/`.
- **O dono do endpoint não é um campo**: é uma **ligação de Composição** do serviço para o endpoint
  (seção 7). Não use `parentId` (formato antigo).
- **Nome do arquivo:** com dono, `<slug-do-dono>--<slug-do-nome>.json`
  (ex.: `api-de-pedidos--get-pedidos-id.json`); sem dono, só `<slug-do-nome>.json`.
- Quem **chama** o endpoint: uma ligação entre o chamador e o endpoint. Com `serving`, a origem é o
  endpoint (quem serve) e o destino é quem chama (`GET /pedidos/{id}` → `Portal do Cliente`); com
  `triggering` ou `flow`, a origem é quem chama (seção 7).

## 6. Tecnologia

`<tecnologias>/<slug-do-nome>.json`

```json
{
  "id": "5d2e8a10-6b7c-4d8e-9f01-23456789abcd",
  "name": "PostgreSQL",
  "category": "Banco de dados",
  "description": ""
}
```

Os três campos de texto são obrigatórios (podem ser `""`). Reaproveite a tecnologia se já existir (mesma
comparação de nome do recurso). **Ligar** uma tecnologia a um recurso não muda nenhum dos dois: cria uma
ligação `uses` (abaixo).

## 7. Ligação

### Recurso usa tecnologia (`uses`)

`<ligações>/<slug-do-recurso>--usa--<slug-da-tecnologia>.json`

```json
{
  "id": "e1f2a3b4-c5d6-4e7f-8a9b-0c1d2e3f4a5b",
  "kind": "uses",
  "sourceId": "<id do recurso>",
  "targetId": "<id da tecnologia>",
  "label": "",
  "protocol": ""
}
```

### Recurso → recurso ou endpoint (`flow`)

`<ligações>/<slug-da-origem>--<slug-do-destino>.json` (os slugs vêm do **nome** das pontas; para um
endpoint, o slug do nome dele, ex.: `get-pedidos-id`, sem o prefixo do dono).

```json
{
  "id": "a9b8c7d6-e5f4-4a3b-8c2d-1e0f9a8b7c6d",
  "kind": "flow",
  "sourceId": "<id da origem>",
  "targetId": "<id do destino>",
  "label": "Lê e grava",
  "protocol": "SQL",
  "relType": "access",
  "accessMode": "readwrite"
}
```

| Campo | Observação |
|---|---|
| `kind` | `flow` (seta nos desenhos) ou `uses` (recurso → tecnologia). |
| `sourceId`, `targetId` | Ids existentes. A **direção importa** (tabela abaixo). |
| `label`, `protocol` | Obrigatórios (podem ser `""`). Rótulo da seta: `label [protocol]`. |
| `relType` | Opcional; ausente = "Genérica" (seta simples). |
| `accessMode` | Só com `access`: `write` (padrão, pode omitir), `read`, `readwrite`, `access`. |
| `strength` | Só com `influence`: `+`, `++`, `-`, `--`… |
| `directed` | Só com `association`: `true` para ter seta. |
| `impact` | `new`, `changed`, `removed`; opcional. |

**Tipos ArchiMate (`relType`) e direção** (origem → destino):

| `relType` | Use quando | Origem → destino |
|---|---|---|
| `composition` | A parte não existe sem o todo. **Dono de endpoint.** | todo → parte (serviço → endpoint) |
| `aggregation` | Agrupa; a parte existe sozinha | todo → parte |
| `assignment` | Quem executa/é responsável | responsável → comportamento |
| `realization` | Concretiza algo mais abstrato | concreto → abstrato |
| `serving` | Fornece funcionalidade | **quem serve → quem usa** (API → front) |
| `access` | Lê/grava dados | comportamento → dado (serviço → banco) |
| `influence` | Afeta motivação/implementação | quem influencia → influenciado |
| `triggering` | Um dispara o outro | quem dispara → disparado |
| `flow` | Transfere dados/eventos | quem envia → quem recebe (produtor → fila → consumidor) |
| `specialization` | É um tipo particular de | específico → genérico |
| `association` | Genérica, sem semântica | qualquer |

Se o usuário não disser o tipo, prefira: chamada síncrona de API → `serving` (do chamado para quem
chama) ou `triggering`; mensagem/evento → `flow`; banco → `access` com `accessMode`; dono de
endpoint → `composition`.

## 8. (Opcional) Colocar no desenho

Desenhos são `<projetos>/**/<nome>.json` com `nodes` (sempre array). Para mostrar recursos e setas num
desenho existente:

- adicione em `nodes` um item por recurso: `{ "resourceId": "<id>", "x": 0, "y": 0 }` (inteiros; no máximo
  um nó por recurso; recursos têm ~240 × 70 px, então espace ~300 px na horizontal e ~150 na vertical);
- adicione em `edges` o `id` de cada ligação **`flow`** a mostrar (só aparece se as duas pontas estiverem
  em `nodes`). Ligações `uses` não entram: a tecnologia aparece como etiqueta no recurso.

Mantenha os campos que o desenho já tem (`shapes`, `anchors`, `connectors`, `z`…). Não crie desenho novo
se não pedirem.

## 9. Conferir

1. Cada arquivo novo é JSON válido, com quebra de linha no fim.
2. Todo `sourceId`/`targetId`/`resourceId` aponta para um id que existe.
3. Nomes de arquivo seguem a seção 3 (inclusive o `--usa--` e o prefixo do dono do endpoint).
4. Sem campos opcionais vazios.
5. Rode o validador (Node.js 18+), apontando para a raiz do repositório:

   ```bash
   node docs/skills/cadastrar-recursos-e-ligacoes/validar.mjs <pasta-do-repositorio>
   ```

   Ele lista erros (id repetido, referência quebrada, JSON inválido) e avisos (nome de arquivo que o app
   renomearia, recurso ou ligação repetidos, campo opcional vazio). Corrija tudo antes de terminar.
6. Diga ao usuário o que criou (caminhos) e o que reaproveitou. Ele abre no Modelador (ou Recarregar) para
   ver, e versiona com Git.

## Exemplo completo

Pedido: *"Cadastre o serviço Notificações (Node.js), que expõe POST /notificacoes e consome o tópico
pedido-criado. É novo na feature."* Supondo `pedido-criado` já cadastrado (id `…0005`) e a tecnologia
`Node.js` também (id `7a2b…0003`):

| Arquivo | Conteúdo-chave |
|---|---|
| `aplicações/notificacoes.json` | `type: service`, `name: "Notificações"`, `impact: "new"` |
| `aplicações/notificacoes--post-notificacoes.json` | `type: endpoint`, `name: "POST /notificacoes"`, `method: "POST"`, `path: "/notificacoes"`, `impact: "new"` |
| `relações/notificacoes--post-notificacoes.json` | `flow`, `relType: "composition"`, Notificações → endpoint |
| `relações/pedido-criado--notificacoes.json` | `flow`, `relType: "flow"`, pedido-criado → Notificações, `protocol: "Kafka"`, `impact: "new"` |
| `relações/notificacoes--usa--node-js.json` | `uses`, Notificações → Node.js |

(Com pastas em inglês, os mesmos arquivos ficam em `applications/` e `relations/`.)
