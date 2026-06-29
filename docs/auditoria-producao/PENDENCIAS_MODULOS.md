# Pendencias por Modulo - NexoERP

## PDV

**Completo/parcialmente completo:**
- Venda dinheiro, Pix, debito, credito, fiado, voucher e vale existem visualmente.
- Pix automatico Mercado Pago funciona.
- Cartao gera contas a receber.
- Fiado gera conta a receber.
- Estorno devolve estoque e estorna financeiro.
- Backend bloqueia venda PDV sem caixa aberto do operador autenticado.
- Venda PDV persiste `caixaId` no model `Venda`.
- Backend possui resumo oficial de caixa por `caixaId`.
- Tela do caixa usa o resumo oficial da API para renderizar fechamento.

**Parcial:**
- Split precisa bateria de testes.
- Resumo local permanece apenas como fallback se a API falhar.
- Voucher/vale sem regra de operadora.
- Suspensao/pendencia Pix usa localStorage.

**Falta backend/banco:**
- Auditoria de operador por acao.

**Testes automatizados criados em 2026-06-28:**
- Venda com cartao parcelado.
- Venda dinheiro e fechamento de caixa.
- Fiado com limite/PIN e recebimento.
- Pix confirmado, pendente e expirado.
- Estorno de venda com devolucao de estoque.

**Ainda exige teste manual/especifico:**
- Split com Pix + cartao.
- Estorno Pix automatico contra provedor real.
- Caixa aberto/fechado em dois navegadores.

## Fiado / Contas a receber

**Completo/parcialmente completo:**
- Conta a receber e baixa existem.
- Receber tudo por cliente existe.
- Credito do cliente consulta aberto.
- Venda fiado valida limite de credito no backend e permite liberacao com PIN de supervisor.

**Parcial:**
- Historico de pagamentos por cliente nao e dedicado.

**Falta banco/regra:**
- Politica configuravel: bloquear ou pedir autorizacao.

## Clientes

**Completo/parcialmente completo:**
- CRUD real.
- Cadastro rapido pelo PDV.
- Busca e resumo.

**Parcial:**
- KPI novos no mes depende de string `cadastro`.
- Total comprado/em aberto precisa ser derivado de vendas/lancamentos, nao de contadores manuais.

**Falta backend/regra:**
- Validacao CPF/CNPJ.
- Unique por documento se aplicavel.
- Historico unificado.

## Financeiro

**Completo/parcialmente completo:**
- Lancamentos, contas a pagar/receber.
- Recebimentos.
- Contas bancarias.
- Cartao a receber e conciliacao manual.
- Centro de custo.
- Status financeiro padronizado em helper/constantes compartilhados.

**Mockado/visual/parcial:**
- Extrato bancario.
- Regua de cobranca.
- Algumas categorias locais.

**Falta backend/banco:**
- Conciliação bancaria real.
- Historico formal de baixa.
- Metodos financeiros como enums.
- Status financeiro como enum forte no banco, se a migracao for planejada.
- Conta bancaria vinculada a todos os recebimentos/pagamentos.

## Centro de custo

**Completo/parcialmente completo:**
- CRUD de custos/despesas.
- Recorrencia cria varias entradas.
- DRE consome custos.

**Parcial:**
- Categorias locais.
- Recorrencia controlada pelo frontend.

**Falta regra:**
- Integracao formal com contas a pagar.
- Diferenciar custo/despesa com plano de contas.

## Vendas / Pedidos

**Completo/parcialmente completo:**
- Pedido gera venda/lancamento ao faturar/concluir.
- Cancela/estorna e devolve estoque.
- Vendas PDV e pedidos aparecem em vendas.

**Parcial:**
- NF-e/boleto sao fluxos parciais.
- Pagamento a prazo por pedido precisa parcelas/lancamentos detalhados.

**Falta regra:**
- Status contabil claro para venda sem nota.
- Integracao fiscal real.

## Estoque

**Completo/parcialmente completo:**
- Produto, entrada, saida, ajuste.
- Baixa por venda.
- Estorno devolve estoque.

**Parcial:**
- Deposito e posicao sao simples.
- Custo medio nao esta consolidado.

**Falta banco/regra:**
- Estoque por deposito.
- Entrada por XML.
- Lote/validade operacional.

## Dashboard

**Completo/parcialmente completo:**
- Tela consome API real.
- KPIs e graficos existem.
- Status financeiros realizados agora consideram `pago`, `recebido` e `conciliado`.
- Contas abertas ignoram lancamentos `cancelado` e `estornado`.

**Parcial/problematico:**
- Carrega listas completas.

**Falta backend:**
- Endpoints-resumo oficiais.

## DRE

**Completo/parcialmente completo:**
- DRE visual e calculada no frontend.
- Usa custos, lancamentos e movimentacoes.

**Parcial:**
- Nao e DRE oficial server-side.
- CMV e deducoes dependem de heuristicas.

**Falta regra:**
- Plano de contas.
- Regime caixa/competencia definido.
- Impostos/deducoes reais.

## Relatorios

**Completo/parcialmente completo:**
- Exportacao CSV/PDF/Excel.
- Historico de exportacoes.

**Parcial:**
- Relatorios calculam muito no frontend.
- Relatorio de inadimplencia e caixa por turno ainda precisam consolidar.

**Falta backend:**
- Endpoints especificos por relatorio.
- Exportacao server-side.

## Configuracoes

**Completo/parcialmente completo:**
- Usuarios/permissoes.
- Config PDV.
- Pix Mercado Pago.
- Conta bancaria.
- Confirmacao de email.

**Parcial:**
- Configuracoes de tema/aparencia locais.
- Fiscal inexistente.

**Falta seguranca/regra:**
- Recuperacao de senha.
- Permissoes por acao.

## Seguranca / Deploy

### Corrigido
- CORS agora usa allowlist por ambiente via `CORS_ORIGIN`.
- Desenvolvimento local continua suportado por fallback para `127.0.0.1` e `localhost` quando `CORS_ORIGIN` nao estiver configurado e `NODE_ENV` nao for `production`.
- Login e cadastro agora tem rate limit no backend, protegendo a API contra excesso de tentativas diretas.
- Confirmacao de email implementada com token, tela frontend e bloqueio quando `EMAIL_VERIFICATION_REQUIRED=true`.

### Ainda pendente
- Configurar `CORS_ORIGIN` no Railway com o dominio Vercel atual e futuro dominio proprio.
- Configurar `PUBLIC_APP_URL`, `EMAIL_FROM` e `RESEND_API_KEY` no Railway para envio real de confirmacao.
- Manter testes automatizados dos fluxos criticos ja criados e expandir quando surgirem novos fluxos de Pix real, adquirentes e relatorios server-side.
- Aplicar migracao monetaria `Float` -> `Decimal` no banco principal somente apos backup/restore validado; implementacao ja foi testada em `nexoerp-test`.
- Documentar e testar backup/restore antes de qualquer cliente oficial.
- Configurar monitoramento minimo de producao: healthcheck, uptime, erros e logs sem dados sensiveis.

### Status atual
Parcialmente pronto para beta controlado. A API deixou de aceitar qualquer origem, limita tentativas de login/cadastro e ja tem confirmacao de email, mas ainda precisa das demais protecoes de seguranca da Fase 1.
