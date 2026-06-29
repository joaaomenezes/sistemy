# Relatorio de Auditoria de Producao - NexoERP

Data da auditoria: 2026-06-26

## Resumo executivo

**Recomendacao final:** lancar apenas como **beta interno/controlado**. O sistema ja tem uma base real de API, banco, autenticacao, multiempresa por `empresaId`, PDV, Pix Mercado Pago, estoque, financeiro, pedidos e relatorios. Porem ainda nao esta pronto para clientes oficiais porque existem riscos financeiros, contabeis, de seguranca operacional e de performance.

O ponto mais importante: varias telas ja funcionam com backend real, mas o sistema ainda mistura conceitos de **faturamento**, **receita recebida**, **caixa**, **contas a receber**, **cartao a receber** e **DRE** em alguns dashboards e relatorios. Isso pode gerar decisao errada para o usuario.

## Status geral de prontidao

- Backend REST: parcial para producao.
- Frontend: funcional, mas pesado e com arquivos grandes.
- Banco/Prisma: funcional, mas usa `Float` para dinheiro e poucos relacionamentos fortes.
- PDV: avancado, mas ainda precisa fortalecer caixa/turno e meios de pagamento.
- Financeiro: funcional, mas precisa consolidar regras contabeis e historico.
- Pix automatico: funcional para Mercado Pago, mas precisa endurecer ciclo de vida e webhooks.
- Cartao: preparado como contas a receber, mas conciliacao ainda e manual.
- Relatorios/DRE/Dashboard: existem, mas precisam revisar conceitos e performance.
- Seguranca: aceitavel para dev/beta, insuficiente para producao aberta.

## Principais riscos

1. Dinheiro em `Float` no Prisma pode causar diferencas de centavos em vendas, taxas, caixa e DRE.
2. Venda agora possui `caixaId` no model `Venda`.
3. Backend calcula resumo oficial do caixa por `caixaId` e o frontend do PDV ja renderiza o fechamento usando esse endpoint.
4. CORS permite qualquer origem em producao.
5. Login nao tinha rate limit no backend. **Corrigido em 2026-06-26.**
6. Dashboard ja foi corrigido no frontend para considerar `pago`, `recebido` e `conciliado`; status financeiros de `Lancamento` tambem foram padronizados em helper/constantes compartilhados.
7. Relatorios carregam listas grandes e filtram no frontend.
8. Financeiro e PDV ainda concentram muita responsabilidade em arquivos grandes.
9. Metodos financeiros ainda sao strings soltas; status financeiros ja possuem helper/constantes compartilhados, mas ainda nao viraram enum forte no banco.
10. Webhook Mercado Pago agora exige assinatura/secret e consulta o provedor antes de alterar cobranca; ainda falta teste automatizado especifico.
11. Testes automatizados foram criados em banco Neon separado (`nexoerp-test`) para os fluxos criticos da Fase 1: venda, caixa, estoque, fiado, Pix, cartao, estorno, dashboard/resumo financeiro, pedido, permissoes e webhook.

---

## Problema: Valores financeiros usam Float

**Prioridade:** Critico

**Modulo:** Banco / Financeiro / PDV / Estoque / DRE

**Arquivos envolvidos:**
- `C:\Users\Joao Pedro\Desktop\nexoerp-api\prisma\schema.prisma`

**O que foi encontrado:**
Campos monetarios usam `Float`, incluindo `Produto.preco`, `Produto.custo`, `Venda.total`, `Lancamento.valor`, `valorBruto`, `valorTaxa`, `valorLiquidoPrevisto`, `Caixa.fundo`, `Caixa.totalVendas`, `Custo.valor` e `PixCobranca.valor`.

**Impacto:**
Pode gerar diferenca de centavos em caixa, cartão, Pix, DRE, relatorios e conciliacao. Em ERP real, isso vira problema operacional e contabil.

**Como deveria funcionar:**
Usar `Decimal` no Prisma/PostgreSQL para valores monetarios, com padrao de arredondamento centralizado.

**Como corrigir:**
Criar migracao planejada de `Float` para `Decimal(14,2)` para campos monetarios e `Decimal(7,4)` para percentuais que exigirem precisao formal. Ajustar parsers no backend e frontend.

**Status recomendado:** Plano concluido em 2026-06-27 no arquivo `docs/auditoria-producao/PLANO_MIGRACAO_DECIMAL.md`. Implementacao testada em `nexoerp-test` em 2026-06-28 com campos monetarios em `Decimal(14,2)`, `Lancamento.taxaPercentual` em `Decimal(7,4)` e serializacao JSON de `Prisma.Decimal` como numero. Aplicado no banco principal em 2026-06-28 apos backup/restore validado.

---

## Problema: Venda nao tem relacao forte com caixa/turno

**Prioridade:** Critico

**Modulo:** PDV / Caixa / Vendas

**Arquivos envolvidos:**
- `C:\Users\Joao Pedro\Desktop\nexoerp-api\prisma\schema.prisma`
- `C:\Users\Joao Pedro\Desktop\nexoerp-api\src\routes\vendas.js`
- `C:\Users\Joao Pedro\Desktop\sistemy\pdv\pdv.js`
- `C:\Users\Joao Pedro\Desktop\sistemy\pdv\pdv-cash-register.js`

**O que foi encontrado originalmente:**
O schema `Venda` nao possuia `caixaId`. O frontend enviava `caixaId` no payload, mas a rota removia esse campo antes de criar a venda. O `caixaId` ficava apenas nos lancamentos financeiros criados pela venda.

**Status atual apos correcoes:**
A rota de vendas agora valida que venda PDV tenha `caixaId` no payload, confirma que esse caixa esteja aberto para o operador autenticado e persiste `caixaId` no model `Venda`.

**Impacto:**
O risco principal foi reduzido, porque agora a venda tambem aponta para o caixa, o backend possui resumo oficial por `caixaId` e o frontend do PDV renderiza o fechamento usando esse endpoint.

**Como deveria funcionar:**
Cada venda de PDV deve ter `caixaId` obrigatorio quando a regra exige caixa aberto. Os lancamentos financeiros tambem devem apontar para o mesmo `caixaId`.

**Como corrigir:**
A validacao de caixa aberto, a persistencia de `caixaId` no model `Venda`, o endpoint de resumo oficial e a integracao do frontend do PDV ja foram aplicados em 2026-06-26.

**Status recomendado:** Corrigir antes de producao real.

---

## Problema: Fechamento de caixa depende de estado do frontend

**Prioridade:** Alto

**Modulo:** PDV / Caixa

**Arquivos envolvidos:**
- `C:\Users\Joao Pedro\Desktop\sistemy\pdv\pdv-cash-register.js`
- `C:\Users\Joao Pedro\Desktop\sistemy\pdv\pdv.js`
- `C:\Users\Joao Pedro\Desktop\nexoerp-api\src\routes\caixas.js`

**O que foi encontrado:**
O fechamento usa `todayStats` e `salesHistory` do frontend para mostrar resumo e enviar `totalVendas`. O backend de caixas nao calcula o total oficial a partir das vendas/lancamentos do turno.

**Status atual apos correcoes:**
O backend agora expoe `GET /api/caixas/:id/resumo`, ao fechar caixa recalcula `totalVendas` no backend, e o frontend do PDV renderiza o modal/fechamento usando esse resumo oficial em vez de depender apenas de `todayStats`.

**Impacto:**
Se a tela travar, recarregar, abrir em outro navegador ou houver venda antiga no cache, o fechamento pode exibir valor incorreto.

**Como deveria funcionar:**
O backend deve expor resumo oficial do caixa: dinheiro, Pix, debito, credito, fiado, voucher, sangrias, suprimentos, total vendido, dinheiro esperado.

**Como corrigir:**
Concluido em 2026-06-26: frontend integrado ao `GET /api/caixas/:id/resumo`, mantendo fallback local apenas em caso de falha da API.

**Status recomendado:** Corrigir antes de cliente real.

---

## Problema: Cartao esta correto como a receber, mas conciliacao ainda e manual

**Prioridade:** Alto

**Modulo:** PDV / Financeiro / Conciliacao

**Arquivos envolvidos:**
- `C:\Users\Joao Pedro\Desktop\nexoerp-api\src\routes\vendas.js`
- `C:\Users\Joao Pedro\Desktop\sistemy\financeiro.html`
- `C:\Users\Joao Pedro\Desktop\sistemy\pdv\pdv.js`

**O que foi encontrado:**
Vendas em debito/credito geram lancamentos `avencer`, com taxa, liquido previsto e vencimento. A tela de conciliacao permite receber/conciliar manualmente.

**Impacto:**
Para beta e comercio pequeno e aceitavel. Para producao real, o usuario tera retrabalho e risco de marcar recebimento errado.

**Como deveria funcionar:**
Importacao de extrato ou webhook/API do adquirente deve confirmar valores recebidos, taxas e datas.

**Como corrigir:**
Criar modulo de conciliacao com importacao CSV/OFX e depois integracoes por provedor.

**Status recomendado:** Pode ficar para beta controlado; automatizar antes de escala maior.

---

## Problema: Dashboard mistura status financeiro

**Prioridade:** Alto

**Modulo:** Dashboard / Financeiro

**Arquivos envolvidos:**
- `C:\Users\Joao Pedro\Desktop\sistemy\dashboard.html`

**O que foi encontrado:**
Varios calculos usavam `status === 'pago'` e ignoravam `recebido` e `conciliado`. Isso aparecia em receitas, despesas, saldo, graficos e alertas.

**Impacto:**
Recebimentos baixados como `recebido` ou `conciliado` podem ficar fora do dashboard, distorcendo receita, lucro, saldo e comparativos.

**Como deveria funcionar:**
Centralizar `isStatusRecebido(status)` = `pago`, `recebido`, `conciliado`; separar faturamento bruto de receita recebida.

**Como corrigir:**
Foi aplicado helper local no dashboard para considerar `pago`, `recebido` e `conciliado` como realizados, e para ignorar `cancelado`/`estornado` em contas abertas. A evolucao recomendada ainda e consumir endpoints-resumo do backend ou helper global de status financeiro.

**Status recomendado:** Corrigido no frontend em 2026-06-26 e padronizado globalmente em helper/constantes em 2026-06-27. Enum forte no banco pode ficar para uma etapa posterior, depois de mapear dados legados.

---

## Problema: CORS aberto para qualquer origem

**Prioridade:** Critico

**Modulo:** Backend / Seguranca / Deploy

**Arquivos envolvidos:**
- `C:\Users\Joao Pedro\Desktop\nexoerp-api\src\app.js`

**O que foi encontrado:**
`cors` aceita qualquer origem: `origin: (origin, cb) => cb(null, true)`.

**Impacto:**
Qualquer site pode tentar consumir a API usando tokens capturados do navegador. Nao e aceitavel para producao aberta.

**Como deveria funcionar:**
Permitir somente origens configuradas por ambiente, como dominio Vercel e dominio proprio.

**Como corrigir:**
Usar `CORS_ORIGIN` com allowlist e negar origens desconhecidas.

**Status recomendado:** Corrigir antes de producao.

**Status atual apos correcoes:** Corrigido em 2026-06-26 com middleware de rate limit aplicado em `/api/auth/login` e `/api/auth/register`.

---

## Problema: Login sem rate limit backend

**Prioridade:** Critico

**Modulo:** Auth / Seguranca

**Arquivos envolvidos:**
- `C:\Users\Joao Pedro\Desktop\nexoerp-api\src\routes\auth.js`
- `C:\Users\Joao Pedro\Desktop\sistemy\auth.js`

**O que foi encontrado:**
Existe rate limit/bloqueio no frontend, mas a rota `/api/auth/login` nao tem limitador no backend.

**Impacto:**
Ataques de forca bruta podem chamar a API diretamente, ignorando o bloqueio visual do navegador.

**Como deveria funcionar:**
Rate limit por IP e por identificador, logs de tentativa e bloqueio progressivo.

**Como corrigir:**
Adicionar `express-rate-limit` ou middleware proprio para `/auth/login` e `/auth/register`.

**Status recomendado:** Corrigir antes de producao.

---

## Problema: Senha minima fraca e sem confirmacao de email

**Prioridade:** Alto

**Modulo:** Auth / Usuarios

**Arquivos envolvidos:**
- `C:\Users\Joao Pedro\Desktop\nexoerp-api\src\routes\auth.js`

**O que foi encontrado:**
Cadastro aceita senha com 6 caracteres. Alteracao de senha aceita 4 caracteres. Originalmente nao havia confirmacao de email implementada no backend.

**Status atual apos correcoes:**
Confirmacao de email foi implementada em 2026-06-26 com token, tela frontend e bloqueio de login quando `EMAIL_VERIFICATION_REQUIRED=true`. Ainda falta revisar a politica minima de senha.

**Impacto:**
Conta vulneravel e cadastro com emails invalidos/terceiros.

**Como deveria funcionar:**
Senha minima 8-10 caracteres, politica basica, email verificado para ativar conta.

**Como corrigir:**
Confirmacao de email ja foi adicionada. Ainda falta endurecer a politica minima de senha.

**Status recomendado:** Corrigir antes de clientes oficiais.

---

## Problema: Webhook Mercado Pago precisa validacao mais forte

**Prioridade:** Alto

**Modulo:** Pix / Integracoes / Segurança

**Arquivos envolvidos:**
- `C:\Users\Joao Pedro\Desktop\nexoerp-api\src\routes\webhooks.js`
- `C:\Users\Joao Pedro\Desktop\nexoerp-api\src\routes\integracoes-pix.js`

**O que foi encontrado:**
Existe rota de webhook por integrationId, mas a auditoria nao encontrou uma garantia forte de validacao de assinatura/origem antes de processar evento.

**Impacto:**
Um terceiro poderia tentar forjar notificacoes se descobrir o endpoint.

**Como deveria funcionar:**
Validar assinatura do provedor, idempotencia, status no provedor antes de atualizar cobranca e logs de auditoria.

**Como corrigir:**
Implementar validacao oficial do Mercado Pago para webhook, secret por empresa e idempotency key.

**Status recomendado:** Corrigido em 2026-06-28; criar teste automatizado de assinatura invalida, evento repetido e evento atrasado.

---

## Problema: Relatorios carregam dados amplos e filtram no frontend

**Prioridade:** Alto

**Modulo:** Relatorios / Performance

**Arquivos envolvidos:**
- `C:\Users\Joao Pedro\Desktop\sistemy\relatorios.html`

**O que foi encontrado:**
`loadAllData()` busca listas de clientes, vendas, produtos e financeiro, depois gera relatorios filtrando no navegador.

**Impacto:**
Com dados reais, a pagina pode ficar lenta, travar e gerar relatorios incompletos por limite/paginacao.

**Como deveria funcionar:**
Relatorios criticos devem ser calculados no backend com filtros, paginacao e exportacao server-side.

**Como corrigir:**
Criar endpoints especificos: vendas por periodo, inadimplencia, estoque, DRE, financeiro, caixa.

**Status recomendado:** Corrigir antes de producao real.

---

## Problema: Frontend ainda tem arquivos grandes e muita responsabilidade

**Prioridade:** Alto

**Modulo:** Frontend / Performance / Manutencao

**Arquivos envolvidos:**
- `C:\Users\Joao Pedro\Desktop\sistemy\financeiro.html`
- `C:\Users\Joao Pedro\Desktop\sistemy\pdv\pdv.js`
- `C:\Users\Joao Pedro\Desktop\sistemy\pdv\pdv.css`
- `C:\Users\Joao Pedro\Desktop\sistemy\dashboard.html`

**O que foi encontrado:**
Arquivos grandes: `financeiro.html` com quase 5 mil linhas, `pdv.css` com mais de 6 mil linhas, `pdv.js` com mais de 3 mil linhas e `dashboard.html` com mais de 2,6 mil linhas.

**Impacto:**
Mais risco de regressao, dificil manutencao, carregamento pesado e custo alto para qualquer alteracao.

**Como deveria funcionar:**
Separar CSS global, componentes, tabelas, modais, forms e JS por modulo/feature.

**Como corrigir:**
Continuar extracao gradual, com validacao por pagina e sem refatorar regra de negocio junto.

**Status recomendado:** Iniciar antes do beta e continuar por fases.

---

## Analise por modulo

### PDV

**Funcionando:**
- Busca produtos pela API.
- Venda baixa estoque no backend.
- Pix automatico Mercado Pago existe e vincula cobranca.
- Fiado exige cliente e vencimento.
- Cartao gera contas a receber.
- Estorno devolve estoque e marca lancamentos como estornados.

**Parcial/incompleto:**
- Fechamento depende de resumo do frontend.
- Venda tem `caixaId` no model `Venda`.
- Caixa tem resumo oficial por endpoint.
- Tela do caixa usa resumo oficial da API para renderizar fechamento.
- Voucher/vale ainda nao possuem regra especifica de operadora/recebivel.
- Split funciona melhor que antes, mas precisa teste completo com Pix + cartao + dinheiro.
- Suspensao de carrinho e estado pendente de Pix usam localStorage.

**Risco principal:** ainda faltam testes automatizados do fluxo completo de caixa.

### Fiado / Contas a receber

**Funcionando:**
- Fiado gera lancamento `receita/avencer`.
- Cliente e vencimento sao obrigatorios para fiado no backend.
- Existe consulta de credito do cliente.
- Contas a receber tem filtro por cliente e receber tudo.
- Venda fiado valida limite de credito no backend e permite liberacao com PIN de supervisor.

**Parcial/incompleto:**
- Historico completo de pagamentos por cliente ainda nao e uma tela dedicada forte.
- `Cliente.compras` e `Cliente.pedidos` sao contadores gravados, sujeitos a divergencia.

**Risco principal:** politica de credito ainda nao e configuravel por empresa; por enquanto o backend bloqueia acima do limite e libera com PIN de supervisor.

### Clientes

**Funcionando:**
- CRUD via API.
- Busca, filtros e resumo.
- Cadastro rapido pelo PDV usa `/clientes`.
- Credito calcula em aberto.

**Parcial/incompleto:**
- CPF/CNPJ nao tem validacao forte na rota geral de clientes.
- KPI "novos este mes" depende de string `cadastro` em formato brasileiro.
- Historico de compras/pagamentos ainda e disperso em vendas/financeiro.

### Financeiro

**Funcionando:**
- Contas a pagar/receber reais.
- Baixa de recebimentos.
- Contas bancarias.
- Conciliação manual de cartao.
- Centro de custo via `/custos`.

**Parcial/incompleto:**
- Extrato bancario ainda visual/em desenvolvimento.
- Cobrancas/regua ainda em desenvolvimento.
- Categorias financeiras de custo/despesa ficam em localStorage.
- Status financeiros usam helper/constantes compartilhados; metodos financeiros ainda sao strings livres.
- Dashboard financeiro usa varias buscas locais.

### Centro de custo

**Funcionando:**
- CRUD de custos/despesas.
- Recorrencia cria varios lancamentos.
- DRE usa custos/despesas.

**Parcial/incompleto:**
- Centro de custo nao cria contas a pagar formais no financeiro.
- Categorias ficam locais.
- Recorrencia esta no frontend; backend apenas recebe lancamentos independentes com `recorrenciaId`.

### Vendas / Pedidos

**Funcionando:**
- Pedido cria venda e lancamento ao faturar/concluir.
- Pedido baixa estoque.
- Cancelamento/estorno reverte estoque e financeiro.
- Historico basico existe.

**Parcial/incompleto:**
- NF-e e boleto sao flags/fluxos parciais, sem emissao fiscal real.
- Forma de pagamento em pedidos e mais livre que no PDV.
- Regra contabil de pedido a prazo ainda precisa detalhar parcelas/lancamentos.

### Estoque

**Funcionando:**
- Produto tem estoque, minimo, custo, venda sem estoque.
- Entrada/saida/ajuste via movimentacoes.
- Venda baixa estoque.
- Estorno devolve estoque.

**Parcial/incompleto:**
- Custo medio nao esta consolidado.
- Entrada por XML nao existe.
- Transferencia nao controla saldo por deposito real; produto tem um campo `deposito`, nao estoque por deposito.

### Dashboard

**Funcionando:**
- Consome API real.
- Traz vendas, clientes, produtos, pedidos e financeiro.

**Parcial/incompleto:**
- Status de recebido corrigido no frontend; ainda falta padronizacao global por enum/helper compartilhado.
- Nao usa endpoints-resumo especificos suficientes.
- Pode carregar dados demais.

### DRE

**Funcionando:**
- DRE visual e calculo local existem.
- Usa lancamentos, custos, produtos e movimentacoes.

**Parcial/incompleto:**
- CMV/custos dependem de dados locais e regras simplificadas.
- Nao ha DRE server-side auditavel.
- Status financeiros precisam padronizar.

### Relatorios

**Funcionando:**
- Exporta CSV/PDF/Excel.
- Historico de relatorios tem backend.

**Parcial/incompleto:**
- Muitos relatorios sao calculados no frontend.
- Inadimplencia, caixa por turno, contas recebidas detalhadas e DRE oficial precisam backend dedicado.

### Configuracoes

**Funcionando:**
- Usuarios e permissoes.
- Configuracao PDV.
- Pix Mercado Pago.
- Contas bancarias.

**Parcial/incompleto:**
- Configuracoes gerais de empresa/aparencia ainda misturam localStorage e backend.
- Fiscal ainda nao existe.
- Confirmacao de email existe.

## Analise de seguranca

**Critico antes de producao:**
- CORS fechado por dominio.
- Rate limit backend no login/cadastro. **Corrigido em 2026-06-26.**
- Confirmacao de email. **Corrigido em 2026-06-26.**
- Politica minima de senha.
- Validacao forte de webhook.
- Logs de erro sem expor stack ou dados sensiveis ao usuario.
- Rotacao e armazenamento seguro de `INTEGRATION_ENCRYPTION_KEY`.

**Pontos positivos:**
- JWT existe.
- Senhas usam bcrypt.
- Rotas principais usam `requireAuth`.
- Muitas rotas usam `requirePermission`.
- Queries principais filtram por `empresaId`.
- Credenciais de integracao sao criptografadas.

## Analise de banco de dados

**Pontos positivos:**
- Multiempresa via `empresaId`.
- Indices em algumas tabelas recentes.
- Unicos por empresa em usuario/produto/configuracoes.

**Problemas:**
- `Float` para dinheiro.
- Poucas relacoes Prisma fortes entre venda, caixa, lancamento, cliente, operador e produto.
- Status financeiros ainda sao `String` no banco, mas usam helper/constantes compartilhados na aplicacao.
- Metodos financeiros como `String`.
- Falta indice em `Lancamento(empresaId,status,vencimento)`, `Lancamento(empresaId,vendaId)`, `Venda(empresaId,caixaId)` quando existir, `Venda(empresaId,dataISO)`, `Movimentacao(empresaId,prodId,dataISO)`.
- Cliente nao tem unique por documento dentro da empresa.

## Checklist final para producao

- [x] Migrar dinheiro de `Float` para `Decimal`.
- [x] Adicionar `caixaId` em `Venda`.
- [x] Validar caixa aberto no backend antes de aceitar venda PDV.
- [x] Fechamento de caixa calculado no backend.
- [x] Frontend do PDV renderiza fechamento pelo resumo oficial da API.
- [x] Dashboard corrigido para `pago/recebido/conciliado`.
- [x] CORS por allowlist.
- [x] Rate limit backend.
- [x] Confirmacao de email.
- [x] Validacao de webhook.
- [ ] Relatorios server-side para dados grandes.
- [x] Testes automatizados nos fluxos criticos.
- [x] Backup e rotina de restore testada.
  - Rotina documentada, scripts criados, backup real gerado e restore validado em branch separado.
- [x] Monitoramento/logs de producao.

## Pendencias restantes da Fase 1

- Evoluir status financeiro para enum forte no banco, se a base real estiver limpa e a migracao for planejada.
- Manter valores monetarios em `Decimal` e executar backup/restore antes de novas migrations sensiveis.
- Evoluir politica de credito para configuracao por empresa, se necessario.
- Expandir testes automatizados do webhook Mercado Pago com casos reais de assinatura/origem e confirmacao no provedor.
- Manter e expandir testes automatizados conforme novos fluxos surgirem. A cobertura critica da Fase 1 foi criada para fiado/limite/PIN/recebimento, venda dinheiro, fechamento de caixa, estorno, estoque insuficiente, Pix confirmado/pendente/expirado, cartao/conciliacao, dashboard/resumo financeiro, pedido faturado/cancelado, permissoes e webhook sem assinatura/evento atrasado.
- Backup/restore validado em branch separado. Manter rotina antes de migrations sensiveis e antes de clientes oficiais.
- Manter monitoramento minimo de producao ativo: healthcheck, uptime, erros e logs sem dados sensiveis.
- Concluir pendencias operacionais finais: rotacionar `RESEND_API_KEY` se a chave antiga do `.env.example` for real e conferir variaveis nos paineis Railway, Vercel, Neon e Resend.

## Auditoria final da Fase 1

Executada em 2026-06-28 e documentada em `docs/auditoria-producao/AUDITORIA_FINAL_FASE1.md`.

Validado:

- API publica saudavel em `/health`.
- Banco principal sem migrations pendentes.
- GitHub Actions e UptimeRobot configurados para monitoramento.
- Backup/restore validado previamente.
- `.env.example` corrigido para remover chave com formato real do Resend.

Pendencias operacionais:

- Rotacionar a chave Resend se a chave antiga era real.
- Conferir visualmente variaveis nos paineis Railway, Vercel, Neon e Resend.

## Historico de correcoes apos auditoria

### 2026-06-26 - CORS por ambiente

**Prioridade original:** Critico  
**Modulo:** Backend / Seguranca / Deploy  
**Status:** Concluido  

**O que foi feito:**
O backend deixou de aceitar qualquer origem no CORS. A API agora monta uma allowlist a partir da variavel `CORS_ORIGIN`, aceitando multiplos dominios separados por virgula. Quando `CORS_ORIGIN` nao esta configurado e o ambiente nao e producao, a API usa fallback local para `127.0.0.1` e `localhost`.

**Arquivos alterados:**
- `src/app.js`
- `.env.example`
- `README.md`
- `docs/auditoria-producao/ROADMAP_CORRECOES.md`
- `docs/auditoria-producao/CHECKLIST_PRODUCAO.md`
- `docs/auditoria-producao/PENDENCIAS_MODULOS.md`
- `docs/auditoria-producao/RELATORIO_AUDITORIA_PRODUCAO.md`

**Impacto:**
Reduz o risco de a API ser consumida por frontends nao autorizados em producao. Tambem deixa claro como configurar Vercel, dominio proprio e ambiente local.

**Validacao realizada:**
- `node --check src/app.js`
- `node -e "require('./src/app'); console.log('app-load-ok')"`
- Teste HTTP local com origem permitida retornando `Access-Control-Allow-Origin`.
- Teste HTTP local com origem desconhecida bloqueada pelo CORS.

**Pendencias restantes:**
- Configurar `CORS_ORIGIN` no Railway com o dominio Vercel atual e o dominio proprio quando existir.
- Configurar envio real de confirmacao de email em producao com `PUBLIC_APP_URL`, `EMAIL_FROM` e `RESEND_API_KEY`.

### 2026-06-26 - Rate limit backend em login e cadastro

**Prioridade original:** Critico  
**Modulo:** Auth / Seguranca  
**Status:** Concluido  

**O que foi feito:**
Foi criado um middleware de rate limit em memoria para proteger endpoints publicos de autenticacao. O login agora possui limite geral por IP e limite especifico por IP + identificador. O cadastro possui limite por IP. Os limites possuem padroes seguros e podem ser ajustados por variaveis de ambiente.

**Arquivos alterados:**
- `src/middleware/rateLimit.js`
- `src/routes/auth.js`
- `src/app.js`
- `.env.example`
- `README.md`
- `docs/auditoria-producao/ROADMAP_CORRECOES.md`
- `docs/auditoria-producao/CHECKLIST_PRODUCAO.md`
- `docs/auditoria-producao/PENDENCIAS_MODULOS.md`
- `docs/auditoria-producao/RELATORIO_AUDITORIA_PRODUCAO.md`

**Impacto:**
Reduz risco de forca bruta diretamente contra a API, que antes podia ignorar o bloqueio visual do frontend. Tambem prepara melhor a API para uso em producao no Railway.

**Validacao realizada:**
- `node --check src/middleware/rateLimit.js`
- `node --check src/routes/auth.js`
- `node --check src/app.js`
- `node -e "require('./src/app'); console.log('app-load-ok')"`
- Teste HTTP local em `/api/auth/login` com limite reduzido por env, confirmando retorno 429 apos exceder tentativas.
- Teste HTTP local em `/api/auth/register` com limite reduzido por env, confirmando retorno 429 apos exceder tentativas.

**Pendencias restantes:**
- Em producao com multiplas instancias, trocar rate limit em memoria por Redis ou store externo.
- Melhorar politica minima de senha.

### 2026-06-26 - Validacao de caixa aberto na venda PDV

**Prioridade original:** Critico
**Modulo:** PDV / Caixa / Vendas
**Status:** Concluido

**O que foi feito:**
A rota de vendas passou a exigir `caixaId` quando a venda for do tipo PDV. Dentro da transacao, a API confirma se o caixa existe, pertence a mesma empresa, pertence ao operador autenticado e esta aberto. A venda PDV tambem passa a forcar `operadorId` a partir do usuario autenticado.

**Arquivos alterados:**
- `src/routes/vendas.js`
- `docs/auditoria-producao/ROADMAP_CORRECOES.md`
- `docs/auditoria-producao/CHECKLIST_PRODUCAO.md`
- `docs/auditoria-producao/PENDENCIAS_MODULOS.md`
- `docs/auditoria-producao/RELATORIO_AUDITORIA_PRODUCAO.md`

**Impacto:**
Reduz o risco de o PDV registrar venda sem turno aberto ou usando caixa de outro operador. Isso protege o fluxo minimo de caixa antes de avancar para fechamento oficial por `caixaId`.

**Validacao realizada:**
- `node --check src/routes/vendas.js`
- `node -e "require('./src/app'); console.log('app-load-ok')"`
- Teste HTTP local em `/api/vendas` com venda PDV sem `caixaId`, confirmando retorno 409 com mensagem para abrir o caixa antes da venda.

**Pendencias restantes:**
- Criar teste automatizado cobrindo venda PDV com caixa aberto, caixa fechado e caixa de outro operador.

### 2026-06-26 - `caixaId` persistido no model `Venda`

**Prioridade original:** Critico
**Modulo:** Banco / PDV / Caixa / Vendas
**Status:** Concluido

**O que foi feito:**
Foi criado o campo `caixaId` no model `Venda`, com relacao opcional para `Caixa` e indice por `empresaId` + `caixaId`. A rota de vendas deixou de remover `caixaId` antes de criar a venda, entao vendas PDV validadas agora ficam vinculadas diretamente ao turno/caixa.

**Arquivos alterados:**
- `prisma/schema.prisma`
- `prisma/migrations/20260626140000_add_caixa_id_to_vendas/migration.sql`
- `src/routes/vendas.js`
- `docs/auditoria-producao/ROADMAP_CORRECOES.md`
- `docs/auditoria-producao/CHECKLIST_PRODUCAO.md`
- `docs/auditoria-producao/PENDENCIAS_MODULOS.md`
- `docs/auditoria-producao/RELATORIO_AUDITORIA_PRODUCAO.md`

**Impacto:**
O sistema passa a responder com mais seguranca quais vendas pertencem a cada caixa. Isso prepara o proximo passo: fechamento oficial calculado no backend por `caixaId`.

**Validacao realizada:**
- `npx prisma generate`
- `npx prisma migrate deploy`
- `npx prisma validate`
- `node --check src/routes/vendas.js`
- `node -e "require('./src/app'); console.log('app-load-ok')"`

**Observacao de ambiente:**
A migration foi aplicada com sucesso no Neon. Uma consulta direta via Prisma Client para ler uma venda encontrou erro TLS local do Windows/Neon, o mesmo tipo de erro ja observado antes neste ambiente; por isso a validacao final ficou concentrada em schema, migration e carregamento da API.

**Pendencias restantes:**
- Criar testes automatizados para venda PDV com caixa aberto, caixa fechado e caixa de outro operador.

### 2026-06-26 - Resumo oficial de caixa por `caixaId`

**Prioridade original:** Alto
**Modulo:** PDV / Caixa / Financeiro
**Status:** Concluido

**O que foi feito:**
Foi criado o endpoint `GET /api/caixas/:id/resumo`, calculando o resumo oficial do caixa a partir de vendas e lancamentos vinculados ao `caixaId`. O resumo retorna total vendido, quantidade de vendas, ticket medio, estornos, formas de pagamento, taxas previstas de cartao, valores a receber, sangrias, suprimentos e dinheiro esperado no caixa.

Ao fechar caixa via `PUT /api/caixas/:id` com `aberto:false`, o backend passa a recalcular e gravar `totalVendas` pelo resumo oficial, sem confiar no valor enviado pelo frontend.

**Arquivos alterados:**
- `src/routes/caixas.js`
- `docs/auditoria-producao/ROADMAP_CORRECOES.md`
- `docs/auditoria-producao/CHECKLIST_PRODUCAO.md`
- `docs/auditoria-producao/PENDENCIAS_MODULOS.md`
- `docs/auditoria-producao/RELATORIO_AUDITORIA_PRODUCAO.md`

**Impacto:**
O fechamento passa a ter uma fonte oficial no backend, baseada no banco, reduzindo o risco de erro causado por cache, recarregamento da pagina, `todayStats` local ou vendas antigas em memoria.

**Validacao realizada:**
- `node --check src/routes/caixas.js`
- `node -e "require('./src/app'); console.log('app-load-ok')"`

**Pendencias restantes:**
- Criar testes automatizados para o resumo com dinheiro, Pix, cartao, fiado, sangria, suprimento e estorno.

### 2026-06-26 - Frontend do PDV integrado ao resumo oficial de caixa

**Prioridade original:** Alto
**Modulo:** PDV / Caixa
**Status:** Concluido

**O que foi feito:**
O arquivo `pdv/pdv-cash-register.js` passou a carregar `GET /api/caixas/:id/resumo` quando encontra caixa aberto e quando abre o modal do caixa. O modal de gerenciamento e a tela de fechamento agora renderizam total vendido, formas de pagamento, sangrias, suprimentos, estornos, ticket medio e dinheiro esperado a partir do resumo oficial da API.

Ao confirmar o fechamento, o frontend nao envia mais `totalVendas` calculado localmente. O backend recalcula e retorna o resumo final, usado tambem na mensagem de sucesso do fechamento.

**Arquivos alterados:**
- `pdv/pdv-cash-register.js`
- `docs/auditoria-producao/ROADMAP_CORRECOES.md`
- `docs/auditoria-producao/CHECKLIST_PRODUCAO.md`
- `docs/auditoria-producao/PENDENCIAS_MODULOS.md`
- `docs/auditoria-producao/RELATORIO_AUDITORIA_PRODUCAO.md`

**Impacto:**
Reduz o risco de fechamento errado por reload da pagina, cache local ou `todayStats` antigo. O resumo local permanece apenas como fallback se a API nao responder.

**Validacao realizada:**
- `node --check pdv/pdv-cash-register.js`

**Pendencias restantes:**
- Teste manual completo no navegador com abrir caixa, vender, registrar sangria/suprimento e fechar.
- Criar testes automatizados para o fluxo de caixa.

### 2026-06-26 - Confirmacao de email

**Prioridade original:** Alto
**Modulo:** Auth / Seguranca / Cadastro
**Status:** Concluido

**O que foi feito:**
Foi adicionada confirmacao de email com token seguro armazenado como hash no banco. O cadastro gera token de verificacao quando `EMAIL_VERIFICATION_REQUIRED=true`, o login bloqueia conta nao confirmada, existe endpoint para confirmar email e endpoint para reenviar confirmacao.

O frontend ganhou a pagina `confirmar-email.html`, suporte no cadastro para conta aguardando confirmacao e acao de reenviar confirmacao no login. O envio real foi preparado via Resend usando `RESEND_API_KEY` e `EMAIL_FROM`; em desenvolvimento, a API pode expor o link de confirmacao para teste.

**Arquivos alterados:**
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
- `docs/auditoria-producao/ROADMAP_CORRECOES.md`
- `docs/auditoria-producao/CHECKLIST_PRODUCAO.md`
- `docs/auditoria-producao/PENDENCIAS_MODULOS.md`
- `docs/auditoria-producao/RELATORIO_AUDITORIA_PRODUCAO.md`

**Impacto:**
Reduz cadastro com email invalido ou de terceiro e prepara o sistema para bloquear acesso oficial ate a conta confirmar o email.

**Validacao realizada:**
- `npx prisma generate`
- `npx prisma migrate deploy`
- `npx prisma validate`
- `node --check src/routes/auth.js`
- `node --check src/services/emailVerification.js`
- `node --check auth.js`
- `node -e "require('./src/app'); console.log('app-load-ok')"`

**Pendencias restantes:**
- Configurar no Railway: `EMAIL_VERIFICATION_REQUIRED=true`, `PUBLIC_APP_URL`, `EMAIL_FROM` e `RESEND_API_KEY`.
- Fazer teste manual real recebendo o e-mail pelo provedor configurado.

### 2026-06-26 - Dashboard financeiro com status recebidos/conciliados

**Prioridade original:** Alto
**Modulo:** Dashboard / Financeiro
**Status:** Concluido no frontend

**O que foi feito:**
O dashboard deixou de considerar apenas `status === 'pago'` nos calculos financeiros. Foram criados helpers locais para tratar `pago`, `recebido` e `conciliado` como status realizados, e para considerar como aberto apenas o que ainda nao foi realizado e nao esta `cancelado` ou `estornado`.

Os KPIs de receitas, lucro, saldo, contas a receber/pagar, atividades recentes, resultado do mes, fluxo de caixa e alertas financeiros passaram a usar essa regra unica.

**Arquivos alterados:**
- `dashboard.html`
- `docs/auditoria-producao/ROADMAP_CORRECOES.md`
- `docs/auditoria-producao/CHECKLIST_PRODUCAO.md`
- `docs/auditoria-producao/PENDENCIAS_MODULOS.md`
- `docs/auditoria-producao/RELATORIO_AUDITORIA_PRODUCAO.md`

**Impacto:**
Recebimentos baixados como `recebido` ou conciliados deixam de ficar invisiveis no dashboard. Tambem reduz distorcao em saldo, lucro, graficos e alertas quando o financeiro usa contas a receber de cartao ou baixas manuais.

**Validacao realizada:**
- Check sintatico dos scripts inline de `dashboard.html` com `vm.Script`.
- Busca por comparacoes antigas `status === 'pago'` e `status !== 'pago'` no dashboard.

**Pendencias restantes:**
- Avaliar enum forte no Prisma em etapa posterior, depois de mapear dados existentes.
- Criar endpoints-resumo no backend para reduzir carga no dashboard.

### 2026-06-27 - Status financeiro padronizado globalmente

**Prioridade original:** Alto
**Modulo:** Backend / Frontend / Financeiro
**Status:** Concluido sem migration

**O que foi feito:**
Foi criado um helper de status financeiro no backend (`src/utils/financeiroStatus.js`) e um helper equivalente no frontend (`NexoFinanceiroStatus` em `utils.js`). As rotas de financeiro, caixa, clientes, vendas e pedidos passaram a usar constantes compartilhadas para `Lancamento.status`; dashboard, financeiro, clientes e relatorios passaram a usar o helper global para status realizados, inativos, abertos e filtros `statusIn`/`excludeStatus`.

**Arquivos alterados:**
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
- `docs/auditoria-producao/ROADMAP_CORRECOES.md`
- `docs/auditoria-producao/CHECKLIST_PRODUCAO.md`
- `docs/auditoria-producao/PENDENCIAS_MODULOS.md`
- `docs/auditoria-producao/RELATORIO_AUDITORIA_PRODUCAO.md`

**Impacto:**
Reduz divergencia entre telas e backend sobre o que conta como recebido, aberto ou inativo. O fluxo continua conservador: nao houve migration, enum Prisma ou renomeacao de status existentes.

**Validacao realizada:**
- `node --check utils.js`
- `node --check src/utils/financeiroStatus.js`
- `node --check src/routes/financeiro.js`
- `node --check src/routes/caixas.js`
- `node --check src/routes/clientes.js`
- `node --check src/routes/vendas.js`
- `node --check src/routes/pedidos.js`
- `node -e "require('./src/routes/financeiro'); require('./src/routes/caixas'); require('./src/routes/clientes'); require('./src/routes/vendas'); require('./src/routes/pedidos'); console.log('routes-load-ok')"`
- Validacao via `vm.Script` dos scripts inline de `dashboard.html`, `financeiro.html`, `clientes.html` e `relatorios.html`.

**Pendencias restantes:**
- Avaliar enum forte no Prisma apenas depois de mapear dados existentes.
- Padronizar metodos financeiros em etapa separada.

### 2026-06-27 - Limite de credito no backend para venda fiado

**Prioridade original:** Alto
**Modulo:** Backend / PDV / Clientes / Financeiro
**Status:** Concluido

**O que foi feito:**
A venda fiado passou a validar o limite de credito dentro do backend antes de baixar estoque, criar venda ou lancamento. A API soma o valor em aberto do cliente com a nova parte fiada da venda; se `totalEmAberto + novaVendaFiado > limite`, a venda e bloqueada e exige liberacao com PIN de supervisor. O PIN e salvo no backend como hash na configuracao do PDV.

**Arquivos alterados:**
- `prisma/schema.prisma`
- `prisma/migrations/20260627100000_add_supervisor_pin_to_pdv_config/migration.sql`
- `src/routes/configuracoes-pdv.js`
- `src/routes/vendas.js`
- `src/middleware/errorHandler.js`
- `configuracoes.html`
- `pdv/pdv.js`
- `pdv/pdv-cart.js`
- `docs/auditoria-producao/ROADMAP_CORRECOES.md`
- `docs/auditoria-producao/CHECKLIST_PRODUCAO.md`
- `docs/auditoria-producao/PENDENCIAS_MODULOS.md`
- `docs/auditoria-producao/RELATORIO_AUDITORIA_PRODUCAO.md`

**Impacto:**
O frontend continua avisando antes da venda, mas a trava oficial passa a ser o backend. Isso protege chamadas diretas para a API e casos de tela desatualizada. Quando o limite e excedido, o PDV mostra a escolha entre cancelar ou liberar; ao liberar, solicita o PIN de supervisor e reenvia a venda para validacao no backend.

**Validacao realizada:**
- `node --check src/routes/configuracoes-pdv.js`
- `node --check src/routes/vendas.js`
- `node --check src/middleware/errorHandler.js`
- `node --check pdv/pdv.js`
- `node --check pdv/pdv-cart.js`
- Validacao via `vm.Script` do script inline de `configuracoes.html`.
- `node -e "require('./src/routes/configuracoes-pdv'); require('./src/routes/vendas'); console.log('routes-load-ok')"`
- `npx.cmd prisma validate`
- `npx.cmd prisma migrate deploy`
- `npx.cmd prisma generate`

**Pendencias restantes:**
- Criar teste automatizado para venda fiado dentro do limite, acima do limite sem PIN, acima do limite com PIN valido e acima do limite com PIN invalido.
- Decidir se a politica de credito sera sempre "bloquear ou liberar com PIN" ou configuravel por empresa.

### 2026-06-28 - Webhook Mercado Pago endurecido

**Prioridade original:** Alto
**Modulo:** Backend / Pix / Integracoes / Seguranca
**Status:** Concluido

**O que foi feito:**
A rota de webhook Mercado Pago passou a exigir `webhookSecret`, `x-signature` e `x-request-id` antes de processar qualquer evento. A assinatura oficial e validada com tolerancia de 300 segundos. Depois da assinatura valida, o backend continua consultando o Mercado Pago para confirmar o estado real da cobranca antes de alterar `PixCobranca`.

Tambem foi adicionada protecao contra regressao de status: eventos atrasados nao rebaixam uma cobranca ja consolidada como `pago`, `estornado`, `contestado` ou `divergente`.

**Arquivos alterados:**
- `src/routes/webhooks.js`
- `docs/auditoria-producao/ROADMAP_CORRECOES.md`
- `docs/auditoria-producao/CHECKLIST_PRODUCAO.md`
- `docs/auditoria-producao/PENDENCIAS_MODULOS.md`
- `docs/auditoria-producao/RELATORIO_AUDITORIA_PRODUCAO.md`

**Impacto:**
Reduz risco de notificacao forjada, evento sem assinatura ou evento atrasado alterar indevidamente uma cobranca Pix. A rota agora falha com `401` quando a assinatura e ausente ou invalida.

**Validacao realizada:**
- `node --check src/routes/webhooks.js`
- `node -e "require('./src/routes/webhooks'); console.log('webhooks-load-ok')"`

**Pendencias restantes:**
- Criar teste automatizado cobrindo assinatura ausente/invalida.
- Criar teste automatizado cobrindo evento repetido e evento atrasado.

### 2026-06-28 - Testes automatizados iniciais em banco separado

**Prioridade original:** Alto  
**Modulo:** Backend / PDV / Caixa / Fiado  
**Status:** Parcial iniciado  

**O que foi feito:**
Foi criado um arquivo `.env.test` fora do versionamento para apontar para o branch Neon `nexoerp-test`. Tambem foi adicionado um runner que carrega `.env.test`, recusa rodar se a `DATABASE_URL` for igual ao `.env` principal e executa comandos de teste/migration nesse ambiente separado.

O primeiro teste automatizado cobre o fluxo critico de fiado com limite de credito e PIN de supervisor. O teste cria empresa temporaria, configura PIN, abre caixa, cria cliente com limite e valida os cenarios principais.

**Arquivos alterados:**
- `scripts/run-with-test-env.js`
- `test/api/credit-limit.test.js`
- `test/api/pdv-critical-flows.test.js`
- `package.json`
- `.gitignore`
- `docs/auditoria-producao/ROADMAP_CORRECOES.md`
- `docs/auditoria-producao/CHECKLIST_PRODUCAO.md`
- `docs/auditoria-producao/RELATORIO_AUDITORIA_PRODUCAO.md`

**Validacao realizada:**
- `npm run test:migrate`
- `npm test`
- Resultado: 19 testes passando, 0 falhas.

**Cobertura atual:**
- Venda PDV sem caixa aberto do operador retorna 409.
- Venda fiado dentro do limite passa.
- Venda fiado acima do limite sem PIN retorna `CREDIT_LIMIT_EXCEEDED`.
- Venda fiado acima do limite com PIN invalido retorna `INVALID_SUPERVISOR_PIN`.
- Venda fiado acima do limite com PIN valido e liberada.
- Lancamentos de fiado podem ser baixados como `recebido`.
- Venda dinheiro baixa estoque, cria lancamento `pago`, compoe resumo oficial e fecha caixa com `totalVendas` calculado no backend.
- Estorno devolve estoque, cria movimentacao de entrada e marca lancamento como `estornado`.
- Venda com estoque insuficiente retorna erro e nao cria venda, lancamento ou movimentacao.
- Venda credito parcelado cria recebiveis `avencer` com valor bruto, taxa e liquido previsto.
- Recebivel de cartao pode ser marcado como `recebido` e depois `conciliado`.
- Venda Pix so passa com cobranca `pago`; cobrancas `pendente` e `expirado` bloqueiam a venda.
- Resumo financeiro considera `pago`, `recebido` e `conciliado` como realizados.
- Pedido faturado baixa estoque, cria venda/lancamento e cancelamento reverte estoque, venda e lancamento.
- Subusuario sem permissao e bloqueado em modulo negado e acessa modulo liberado.
- Webhook Mercado Pago sem assinatura retorna 401 quando a integracao ativa possui secret configurado.
- Evento webhook atrasado/repetido nao rebaixa status consolidado.

**Pendencias restantes:**
- Integrar testes adicionais conforme novos fluxos de Pix real, adquirentes, fiscal e relatorios server-side forem implementados.

## Recomendacao final

**Nao pode lancar para clientes oficiais ainda.** Pode lancar como **beta interno/controlado**, com usuarios de confianca, desde que os riscos sejam comunicados e os fluxos financeiros sejam conferidos manualmente.
