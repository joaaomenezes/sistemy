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
- [x] Implementar confirmacao de email ou, no minimo, bloquear uso oficial sem verificacao.
  - Concluido em: 2026-06-26
  - Arquivos alterados:
    - `prisma/schema.prisma`
    - `prisma/migrations/20260626153000_add_email_verification_to_users/migration.sql`
    - `src/services/emailVerification.js`
    - `src/routes/auth.js`
    - `.env.example`
    - `README.md`
    - `auth.js`
    - `cadastro.html`
    - `login.html`
    - `confirmar-email.html`
  - Observacao: cadastro gera token de verificacao, login bloqueia conta nao confirmada quando `EMAIL_VERIFICATION_REQUIRED=true`, e o frontend possui tela de confirmacao.
- [x] Padronizar status financeiro: `pendente`, `avencer`, `vencida`, `pago`, `recebido`, `conciliado`, `cancelado`, `estornado`.
  - Concluido em: 2026-06-27
  - Arquivos alterados:
    - `src/utils/financeiroStatus.js`
    - `src/routes/financeiro.js`
    - `src/routes/caixas.js`
    - `src/routes/clientes.js`
    - `src/routes/vendas.js`
    - `src/routes/pedidos.js`
    - `utils.js`
    - `dashboard.html`
    - `financeiro.html`
    - `clientes.html`
    - `relatorios.html`
  - Observacao: criados helper/constantes compartilhados para status de `Lancamento`; sem migration, sem enum Prisma e sem renomear status existentes.
- [x] Corrigir dashboard para considerar `recebido` e `conciliado`.
  - Concluido em: 2026-06-26
  - Arquivos alterados:
    - `dashboard.html`
  - Observacao: dashboard agora trata `pago`, `recebido` e `conciliado` como status realizados; `cancelado` e `estornado` nao entram em aberto/recebido; contas a receber/pagar e alertas usam status aberto.
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
- [x] Planejar migracao de valores monetarios de `Float` para `Decimal` antes de dados reais.
  - Concluido em: 2026-06-27
  - Arquivos alterados:
    - `docs/auditoria-producao/PLANO_MIGRACAO_DECIMAL.md`
    - `docs/auditoria-producao/ROADMAP_CORRECOES.md`
    - `docs/auditoria-producao/CHECKLIST_PRODUCAO.md`
    - `docs/auditoria-producao/RELATORIO_AUDITORIA_PRODUCAO.md`
  - Observacao: plano definiu campos, precisao, riscos, ordem e criterios antes de alterar o schema. A migracao real foi aplicada depois de backup/restore validado.
- [x] Implementar e aplicar migracao monetaria de `Float` para `Decimal`.
  - Concluido em: 2026-06-28
  - Arquivos alterados:
    - `prisma/schema.prisma`
    - `prisma/migrations/20260628170000_migrate_money_float_to_decimal/migration.sql`
    - `src/app.js`
    - `test/api/credit-limit.test.js`
    - `test/api/pdv-critical-flows.test.js`
  - Observacao: campos monetarios foram migrados para `Decimal(14,2)` e `Lancamento.taxaPercentual` para `Decimal(7,4)`; API serializa `Prisma.Decimal` como numero no JSON para manter compatibilidade com o frontend. Validado em `nexoerp-test` e aplicado no banco principal apos backup/restore validado.
- [x] Validar limite de credito no backend para venda fiado.
  - Concluido em: 2026-06-27
  - Arquivos alterados:
    - `prisma/schema.prisma`
    - `prisma/migrations/20260627100000_add_supervisor_pin_to_pdv_config/migration.sql`
    - `src/routes/configuracoes-pdv.js`
    - `src/routes/vendas.js`
    - `src/middleware/errorHandler.js`
    - `configuracoes.html`
    - `pdv/pdv.js`
    - `pdv/pdv-cart.js`
  - Observacao: venda fiado agora valida `totalEmAberto + novaVendaFiado > limite` no backend; se exceder, exige liberacao com PIN de supervisor salvo como hash na configuracao do PDV.
- [x] Validar assinatura/origem de webhooks Mercado Pago.
  - Concluido em: 2026-06-28
  - Arquivos alterados:
    - `src/routes/webhooks.js`
    - `docs/auditoria-producao/ROADMAP_CORRECOES.md`
    - `docs/auditoria-producao/CHECKLIST_PRODUCAO.md`
    - `docs/auditoria-producao/PENDENCIAS_MODULOS.md`
    - `docs/auditoria-producao/RELATORIO_AUDITORIA_PRODUCAO.md`
  - Observacao: webhook agora exige `webhookSecret`, `x-signature`, `x-request-id`, valida assinatura oficial, consulta o Mercado Pago antes de alterar cobranca e evita regressao de status por evento atrasado.
- [x] Criar testes automatizados dos fluxos criticos: venda, caixa, estoque, fiado, Pix, cartao, estorno e dashboard financeiro.
  - Concluido em: 2026-06-28
  - Arquivos alterados:
    - `scripts/run-with-test-env.js`
    - `test/api/credit-limit.test.js`
    - `test/api/pdv-critical-flows.test.js`
    - `package.json`
    - `.gitignore`
  - Observacao: criado runner seguro com `.env.test`, banco Neon separado `nexoerp-test` e cobertura automatizada para venda dinheiro, caixa, estoque insuficiente, estorno, fiado/limite/PIN/recebimento, Pix pago/pendente/expirado, cartao/conciliacao, resumo financeiro, pedido faturado/cancelado, permissoes e webhook Mercado Pago sem assinatura/evento atrasado.
- [x] Documentar e testar backup/restore antes de producao.
  - Concluido em: 2026-06-28
  - Arquivos alterados:
    - `scripts/db-env.js`
    - `scripts/db-backup.js`
    - `scripts/db-restore.js`
    - `scripts/db-validate.js`
    - `package.json`
    - `.gitignore`
    - `.env.example`
    - `docs/auditoria-producao/BACKUP_RESTORE.md`
  - Observacao: rotina documentada e scripts seguros criados. Backup real gerado em `backups/nexoerp-2026-06-28T20-50-14-344Z.dump`; restore validado em branch separado via `.env.restore` com tabelas essenciais presentes.
- [ ] Configurar monitoramento minimo de producao: healthcheck, uptime, erros e logs sem dados sensiveis.

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

- [x] Aplicar migracao monetaria com `Decimal` em producao apos backup/restore validado.
- [ ] Criar indices de banco para relatorios, financeiro, caixa e estoque.
- [ ] Criar DRE oficial no backend.
- [ ] Criar relatorios server-side exportaveis.
- [x] Criar rotina de backup/restore e documentar.
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
