---
name: usar-cli-modelador
description: Cadastra e altera recursos (sistemas, serviços, bancos, filas, schemas, endpoints), tecnologias, ligações ArchiMate e desenhos num repositório do Modelador usando o comando `modelador` no terminal. Use quando pedirem para cadastrar, ligar, renomear, remover ou colocar num desenho componentes de arquitetura, endpoints, integrações ou dependências, e o comando `modelador` estiver disponível.
---

# Usar a CLI `modelador`

O Modelador guarda a arquitetura numa pasta versionada com Git (um JSON por recurso, tecnologia e ligação).
O comando `modelador` faz as mudanças **com as mesmas regras do app**: nome de arquivo, renomear as ligações
junto, dono de endpoint, meta modelo e duplicidades. **Prefira a CLI a escrever os JSON à mão.** Só escreva à
mão se a CLI não estiver disponível (aí siga a skill `cadastrar-recursos-e-ligacoes`).

Não abra nem automatize a interface do Modelador. O usuário vê o resultado ao abrir (ou Recarregar) o
repositório no app, e versiona com Git.

## 0. Preparar

- Confira que o comando existe: `modelador ajuda`. Se não existir, use `node <modelador>/bin/modelador.mjs`.
- Diga onde está o repositório: rode **dentro da pasta dele**, ou passe `--repo <pasta>`, ou defina
  `MODELADOR_REPO`.
- Para ler a saída num programa, use `--json`. Erros saem com código 1 e, com `--json`, como `{ "error": "..." }`.
- Na dúvida sobre o efeito, rode antes com `--simular`: mostra o que seria criado, renomeado ou apagado,
  sem gravar nada.

## 1. Antes de criar: consulte

```bash
modelador listar recursos            # id, tipo, nome (e dono dos endpoints)
modelador listar recursos --tipo servico
modelador listar tecnologias
modelador listar ligacoes --de "API de Pedidos"
modelador listar desenhos
modelador mostrar "API de Pedidos"   # campos, ligações e desenhos onde aparece
modelador metamodelo                 # pares de tipos e tipos de ligação aceitos
modelador metamodelo --de service --para database
```

**Reaproveite o que existe.** A CLI recusa criar recurso ou tecnologia com nome repetido (sem diferença de
maiúsculas, acentos e pontuação), ligação repetida entre os mesmos dois recursos e endpoint com rota
repetida. Quando recusar, **use o existente** (o id está na mensagem). Só passe `--permitir-repetido` /
`--permitir-repetida` se o usuário pedir explicitamente.

## 2. Referências (`<ref>`)

Em todo comando, um recurso ou tecnologia pode ser indicado pelo **id** ou pelo **nome**
(`"API de Pedidos"`, `api-de-pedidos`). Endpoint: pelo nome (`"GET /pedidos/{id}"`) ou, se houver mais de um
com a mesma rota, `"API de Pedidos:GET /pedidos/{id}"`. Ligações são indicadas pelo **id** (de
`listar ligacoes`). Se a CLI disser que é ambíguo, use o id.

## 3. Criar

```bash
modelador criar recurso --tipo servico --nome "Notificações" --descricao "Envia notificações." --responsavel "Time Pedidos"
modelador criar endpoint --dono "Notificações" --metodo POST --caminho /notificacoes --descricao "Envia uma notificação"
modelador criar tecnologia --nome "RabbitMQ" --categoria "Mensageria"
modelador usar "Notificações" "Node.js"                 # recurso usa tecnologia
modelador ligar "pedido-criado" "Notificações" --tipo fluxo --rotulo "Consome" --protocolo Kafka
modelador ligar "Notificações" "Base de Notificações" --tipo acesso --acesso readwrite
```

Tipos de recurso (`--tipo`): `system` (sistema), `service` (servico), `database` (banco), `queue` (fila),
`schema` (contrato de dados: payload, evento, tabela). Endpoint tem comando próprio; **o dono é criado como
ligação de Composição** (`--dono`), não é um campo.

### Tipo da ligação e direção

`ligar <origem> <destino>`: a **direção importa**.

| `--tipo` | Use quando | Origem → destino |
|---|---|---|
| `composition` (composicao) | A parte não existe sem o todo | todo → parte |
| `aggregation` (agregacao) | Agrupa; a parte existe sozinha | todo → parte |
| `assignment` (atribuicao) | Quem executa/é responsável | responsável → comportamento |
| `realization` (realizacao) | Concretiza algo mais abstrato | concreto → abstrato |
| `serving` (serve) | Fornece funcionalidade | **quem serve → quem usa** (API → front) |
| `access` (acesso) | Lê/grava dados; `--acesso write\|read\|readwrite\|access` | comportamento → dado |
| `influence` (influencia) | Afeta; `--forca +\|++\|-\|--` | quem influencia → influenciado |
| `triggering` (disparo) | Um dispara o outro | quem dispara → disparado |
| `flow` (fluxo) | Transfere dados/eventos | quem envia → quem recebe |
| `specialization` (especializacao) | É um tipo particular de | específico → genérico |
| `association` (associacao) | Sem semântica; `--direcionada` para ter seta | qualquer |
| `generica` | Tipo ainda não decidido | — |

Sem o usuário dizer o tipo: chamada síncrona de API → `serving` (do chamado para quem chama) ou
`triggering`; mensagem/evento → `flow`; banco → `access` com `--acesso`.

**Meta modelo.** Se o repositório tiver `metamodelo.json`, a CLI **recusa** ligações fora dele e diz quais
tipos são aceitos. Escolha um aceito; se o par não aceita nada, não crie e avise o usuário. Sem `--tipo`, se
o par aceitar um único tipo, a ligação já nasce com ele. Não altere `metamodelo.json` sem pedido.

## 4. Alterar e remover

```bash
modelador editar "Notificações" --nome "Central de Notificações"   # renomeia os arquivos das ligações e endpoints junto
modelador editar "POST /notificacoes" --caminho /notificacoes/enviar
modelador editar "RabbitMQ" --categoria "Fila"
modelador editar-ligacao <id> --tipo serving --rotulo "Consulta" --protocolo HTTPS
modelador editar-ligacao <id> --inverter
modelador desligar "Notificações" "Node.js"                        # desfaz o usar
modelador remover <ref ou id da ligação>                           # leva junto as ligações e tira dos desenhos
```

`remover` apaga arquivos: só use quando o usuário pedir, e rode antes com `--simular` para mostrar o que vai
junto. Remover o dono de um endpoint não remove o endpoint (só a ligação).

## 5. Desenhos e impacto

Desenhos ficam na pasta de projetos. `<desenho>` é o caminho (com ou sem `projetos/` e `.json`) ou só o nome,
se for único.

```bash
modelador desenho criar pedidos/2026-T4-01-notificacoes/diagrama
modelador desenho colocar "Visão geral" "Central de Notificações" "POST /notificacoes" --impacto novo
modelador desenho impacto "Visão geral" <id da ligação> alterado
modelador desenho impacto "Visão geral" "API de Pedidos" nenhum
modelador desenho tirar "Visão geral" "Portal do Cliente"
```

- `colocar` põe os recursos numa grade abaixo dos que já estão (ou em `--x/--y`) e mostra as setas das
  ligações cujas duas pontas estão no desenho. Tecnologias aparecem sozinhas como etiqueta no recurso.
- **Impacto é do desenho**, não do recurso: `new` (novo), `changed` (alterado), `removed` (excluído) ou
  `nenhum`. Marque só no desenho da feature que está sendo documentada.
- Não crie desenho novo se não pedirem.

## 6. Terminar

1. Rode `modelador validar`. Deve terminar com `0 erro(s)`; corrija os avisos que forem seus.
2. Diga ao usuário o que criou, alterou ou reaproveitou (a CLI imprime os caminhos). Ele abre no Modelador
   (ou Recarregar) para ver, e faz o commit.

## Exemplo completo

Pedido: *"Cadastre o serviço Notificações (Node.js), que expõe POST /notificacoes e consome o tópico
pedido-criado. É novo na feature 2026-T4-01."*

```bash
modelador listar recursos                 # pedido-criado já existe? Notificações não?
modelador criar recurso --tipo servico --nome "Notificações"
modelador criar endpoint --dono "Notificações" --metodo POST --caminho /notificacoes
modelador usar "Notificações" "Node.js"   # se Node.js não existir: criar tecnologia antes
modelador ligar "pedido-criado" "Notificações" --tipo fluxo --protocolo Kafka --json   # guarde o id
modelador listar desenhos                 # o desenho da feature já existe? senão: desenho criar
modelador desenho colocar "pedidos/2026-T4-01-notificacoes/diagrama" "Notificações" "POST /notificacoes" "pedido-criado"
modelador desenho impacto "pedidos/2026-T4-01-notificacoes/diagrama" "Notificações" novo
modelador desenho impacto "pedidos/2026-T4-01-notificacoes/diagrama" "POST /notificacoes" novo
modelador desenho impacto "pedidos/2026-T4-01-notificacoes/diagrama" <id da ligação> novo
modelador validar
```
