# Roadmap de Correcoes - NexoERP

## Fase 1 - Urgente antes de qualquer cliente real

- [x] Fechar CORS por ambiente.
  - Concluido em: 2026-06-26
  - Arquivos alterados:
    - `src/app.js`
    - `.env.example`
    - `README.md`
  - Observacao: API agora usa allowlist via `CORS_ORIGIN`, com fallback local apenas fora de producao.
- [x] Adicionar rate limit backend em `/auth/login` e `/auth/register`.
  - Concluido em: 2026-06-26
  - Arquivos alterados:
    - `src/middleware/rateLimit.js`
    - `src/routes/auth.js`
    - `src/app.js`
    - `.env.example`
    - `README.md`
  - Observacao: login agora tem limite por IP e por IP+identificador; cadastro tem limite por IP. Limites podem ser ajustados por variaveis de ambiente.
- [ ] Implementar confirmacao de email ou, no minimo, bloquear uso oficial sem verificacao.
- [ ] Padronizar status financeiro: `pago`, `recebido`, `conciliado`, `avencer`, `cancelado`, `estornado`.
- [ ] Corrigir dashboard para considerar `recebido` e `conciliado`.
- [x] Adicionar `caixaId` no model `Venda`.
  - Concluido em: 2026-06-26
  - Arquivos alterados:
    - `prisma/schema.prisma`
    - `prisma/migrations/20260626140000_add_caixa_id_to_vendas/migration.sql`
    - `src/routes/vendas.js`
  - Observacao: venda agora persiste `caixaId` e possui relacao opcional com `Caixa`; migration aplicada com `prisma migrate deploy`.
- [x] Validar caixa aberto no backend antes de aceitar venda PDV.
  - Concluido em: 2026-06-26
  - Arquivos alterados:
    - `src/routes/vendas.js`
  - Observacao: venda PDV agora exige `caixaId` no payload e caixa aberto do operador autenticado. Pedido continua sem depender de caixa.
- [x] Criar endpoint oficial de resumo de caixa por `caixaId`.
  - Concluido em: 2026-06-26
  - Arquivos alterados:
    - `src/routes/caixas.js`
  - Observacao: `GET /api/caixas/:id/resumo` calcula vendas, formas de pagamento, sangrias, suprimentos e dinheiro esperado. Fechamento passa a gravar `totalVendas` calculado pelo backend.
- [x] Integrar frontend do PDV ao resumo oficial de caixa.
  - Concluido em: 2026-06-26
  - Arquivos alterados:
    - `pdv/pdv-cash-register.js`
  - Observacao: modal e fechamento do caixa usam `GET /api/caixas/:id/resumo`, com fallback local se a API falhar.
- [ ] Migrar valores monetarios de `Float` para `Decimal` ou planejar essa migracao antes de dados reais.
- [ ] Validar limite de credito no backend para venda fiado.
- [ ] Validar assinatura/origem de webhooks Mercado Pago.
- [ ] Criar bateria minima de testes manuais documentados para venda, estoque, fiado, Pix, cartao e estorno.

## Fase 2 - Beta controlado

- [ ] Quebrar `financeiro.html` em `financeiro.css`, `financeiro.js` e arquivos por submodulo.
- [ ] Reduzir `pdv.css` em arquivos: layout, pagamento, caixa, config, modais.
- [ ] Criar endpoints-resumo para dashboard.
- [ ] Criar relatorio de caixa por turno.
- [ ] Criar tela de historico financeiro do cliente.
- [ ] Fortalecer recebimentos: origem, venda, cliente, usuario que baixou e data/hora.
- [ ] Transformar categorias financeiras locais em backend.
- [ ] Melhorar conciliacao de cartao com filtros por conta, adquirente, vencimento e status.
- [ ] Corrigir relatorios para buscar dados por filtros no backend.
- [ ] Criar auditoria/log de eventos criticos: venda, estorno, baixa, conciliacao, alteracao de config.

## Fase 3 - Producao real

- [ ] Concluir migracao monetaria com `Decimal`.
- [ ] Criar indices de banco para relatorios, financeiro, caixa e estoque.
- [ ] Criar DRE oficial no backend.
- [ ] Criar relatorios server-side exportaveis.
- [ ] Criar rotina de backup/restore e documentar.
- [ ] Adicionar monitoramento de erro e uptime.
- [ ] Implementar recuperacao de senha.
- [ ] Criar politica de permissoes mais granular por acao.
- [ ] Criar importacao de extrato para conciliacao bancaria.
- [ ] Validar uso multioperador simultaneo em PDV.

## Fase 4 - Futuro

- [ ] Multiempresa avancado com planos, assinatura e billing.
- [ ] Tutoriais por pagina e onboarding persistido no backend.
- [ ] IA no PDV para busca, sugestoes e atalhos.
- [ ] Entrada por XML.
- [ ] Relatorios avancados.
- [ ] Conciliacao bancaria automatica por provedor.
- [ ] Blog/site institucional.
- [ ] Melhorias visuais premium.
- [ ] Personalizacao de dashboard.
- [ ] Automacao financeira.
- [ ] Integracoes fiscais NF-e/NFC-e/NFS-e.
- [ ] Controle real de estoque por deposito/lote/validade.

## Ordem recomendada

1. Seguranca basica de producao.
2. Caixa/turno oficial no backend.
3. Dashboard/financeiro sem erro conceitual.
4. Dinheiro com Decimal.
5. Performance das paginas pesadas.
6. Relatorios server-side.
7. Automacoes e integracoes avancadas.
