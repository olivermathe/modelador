# Instruções para agentes

Modelador: ferramenta desktop (Electron + React + TypeScript + React Flow + Zustand) para modelar
arquitetura sobre uma pasta-repositório versionada com Git. Interface e comentários em português do Brasil.

## Antes de mudar qualquer coisa

1. Leia [docs/regras.md](docs/regras.md). São invariantes pedidas pelo usuário. As mais importantes:
   - **nada é gravado em disco antes do Salvar** (inclusive pastas);
   - **Salvar não regrava arquivos sem mudança** (campos opcionais vazios são omitidos);
   - **cor no desenho significa impacto**, nunca tipo de recurso.
2. Use [docs/funcionalidades.md](docs/funcionalidades.md) para achar o código de cada funcionalidade e
   [docs/arquitetura.md](docs/arquitetura.md) para o fluxo de dados.
3. Mudou formato de arquivo? Atualize [docs/formato-do-repositorio.md](docs/formato-do-repositorio.md)
   e mantenha a leitura do formato antigo (migração em memória, gravada só no Salvar). Atualize também a
   skill [docs/skills/cadastrar-recursos-e-ligacoes/](docs/skills/cadastrar-recursos-e-ligacoes/SKILL.md)
   (texto e `validar.mjs`), que repete essas regras para agentes externos.

## Comandos

```bash
npm run typecheck   # obrigatório limpo
npm run test:e2e    # build + teste no app real sobre cópia de exemplo-repositorio/
npm run dev         # app em desenvolvimento
```

Ao terminar uma mudança: rode `npm run test:e2e`; se a mudança for visível, acrescente um passo ou
captura em `scripts/e2e/` (ver [docs/como-fazer.md](docs/como-fazer.md)).

## Ao concluir

- Atualize o [README.md](README.md) (uso) e, se for o caso, `docs/` (funcionalidades, formato, decisões).
- Registre pedidos novos do usuário e a decisão tomada em [docs/decisoes.md](docs/decisoes.md).
- Se mudar o formato, atualize também o `exemplo-repositorio/`.
