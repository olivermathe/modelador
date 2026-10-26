# Decisões de arquitetura — Pedidos

## ADR-001: publicar `pedido-criado` no Kafka

**Status:** aceito

A **API de Pedidos** publica um evento a cada pedido criado, para que outros domínios
reajam sem acoplamento direto.

| Opção | Prós | Contras |
|---|---|---|
| Kafka | Reprocessamento, alto volume | Operação mais complexa |
| Chamada HTTP | Simples | Acoplamento temporal |

- [x] Definir esquema do evento
- [ ] Documentar consumidores
