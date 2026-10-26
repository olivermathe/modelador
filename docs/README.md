# Documentação de manutenção

Documentação para quem for dar manutenção no Modelador, pessoa ou agente de IA. O
[README da raiz](../README.md) explica o uso do app; aqui está o **como funciona por dentro** e o
**que não pode quebrar**.

| Documento | Quando ler |
|---|---|
| [regras.md](regras.md) | **Sempre, antes de mudar qualquer coisa.** Invariantes que o usuário pediu explicitamente. |
| [arquitetura.md](arquitetura.md) | Para entender processos, fluxo de dados e onde fica cada coisa. |
| [formato-do-repositorio.md](formato-do-repositorio.md) | Ao mexer em leitura/gravação, campos de entidades ou nomes de arquivos. |
| [funcionalidades.md](funcionalidades.md) | Mapa funcionalidade → arquivos. Ponto de partida para qualquer ajuste. |
| [como-fazer.md](como-fazer.md) | Receitas para mudanças comuns e como verificar o trabalho. |
| [decisoes.md](decisoes.md) | Por que as coisas são como são (histórico de pedidos e escolhas). |

## Resumo em 30 segundos

- App desktop **Electron + React + TypeScript**, editor de diagramas com **React Flow** (`@xyflow/react`),
  estado com **Zustand**, estilos com **Tailwind v4**. Build com **electron-vite**.
- O usuário abre uma **pasta-repositório** (normalmente versionada com Git) com quatro pastas fixas:
  `aplicações/`, `tecnologias/`, `relações/` e `projetos/`. Cada recurso, tecnologia e relação é **um
  arquivo JSON**. Os desenhos guardam só referências por id e posições.
- **Nada é gravado em disco antes do usuário clicar em Salvar.** Tudo fica em memória; o Salvar calcula
  a diferença com o disco e aplica.
- Interface e textos em **português do Brasil**.

## Comandos

```bash
npm install
npm run dev          # app em desenvolvimento
npm run typecheck    # tsc nos dois projetos (main/preload e renderer)
npm run build        # typecheck + build em out/
npm run test:e2e     # build + teste de ponta a ponta no app real (ver como-fazer.md)
```
