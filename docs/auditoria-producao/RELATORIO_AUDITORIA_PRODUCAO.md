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
2. Venda nao possui `caixaId` no model `Venda`; o vinculo do turno fica principalmente nos lancamentos financeiros.
3. Caixa atual usa `todayStats` calculado no frontend e historico por operador/data, com risco de confusao entre turno atual e vendas antigas.
4. CORS permite qualquer origem em producao.
5. Login nao tinha rate limit no backend. **Corrigido em 2026-06-26.**
6. Dashboard considera apenas status `pago` em muitos pontos e ignora `recebido`/`conciliado`.
7. Relatorios carregam listas grandes e filtram no frontend.
8. Financeiro e PDV ainda concentram muita responsabilidade em arquivos grandes.
9. Status/metodos financeiros sao strings soltas, sem enums fortes.
10. Rotas de webhook nao usam assinatura/secret de forma completa para validar origem.

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
Criar migracao planejada de `Float` para `Decimal(12,2)` ou `Decimal(14,4)` conforme campo. Ajustar parsers no backend e frontend.

**Status recomendado:** Corrigir antes de producao real.

---

## Problema: Venda nao tem relacao forte com caixa/turno

**Prioridade:** Critico

**Modulo:** PDV / Caixa / Vendas

**Arquivos envolvidos:**
- `C:\Users\Joao Pedro\Desktop\nexoerp-api\prisma\schema.prisma`
- `C:\Users\Joao Pedro\Desktop\nexoerp-api\src\routes\vendas.js`
- `C:\Users\Joao Pedro\Desktop\sistemy\pdv\pdv.js`
- `C:\Users\Joao Pedro\Desktop\sistemy\pdv\pdv-cash-register.js`

**O que foi encontrado:**
O schema `Venda` nao possui `caixaId`. O frontend envia `caixaId` no payload, mas a rota remove esse campo antes de criar a venda. O `caixaId` fica nos lancamentos financeiros criados pela venda.

**Impacto:**
Relatorios e fechamento de caixa ficam dependentes de lancamentos e do estado do frontend. Isso dificulta responder com seguranca: "quais vendas pertencem a este turno?".

**Como deveria funcionar:**
Cada venda de PDV deve ter `caixaId` obrigatorio quando a regra exige caixa aberto. Os lancamentos financeiros tambem devem apontar para o mesmo `caixaId`.

**Como corrigir:**
Adicionar `caixaId` no model `Venda`, validar caixa aberto no backend antes de aceitar venda PDV e calcular fechamento por `caixaId`, nao por data nem memoria local.

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

**Impacto:**
Se a tela travar, recarregar, abrir em outro navegador ou houver venda antiga no cache, o fechamento pode exibir valor incorreto.

**Como deveria funcionar:**
O backend deve expor resumo oficial do caixa: dinheiro, Pix, debito, credito, fiado, voucher, sangrias, suprimentos, total vendido, dinheiro esperado.

**Como corrigir:**
Criar `GET /api/caixas/:id/resumo` calculando por `caixaId`. O frontend apenas renderiza esse resumo.

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
Varios calculos usam `status === 'pago'` e ignoram `recebido` e `conciliado`. Isso aparece em receitas, despesas, saldo, graficos e alertas.

**Impacto:**
Recebimentos baixados como `recebido` ou `conciliado` podem ficar fora do dashboard, distorcendo receita, lucro, saldo e comparativos.

**Como deveria funcionar:**
Centralizar `isStatusRecebido(status)` = `pago`, `recebido`, `conciliado`; separar faturamento bruto de receita recebida.

**Como corrigir:**
Refatorar dashboard para consumir endpoints-resumo do backend ou helper global de status financeiro.

**Status recomendado:** Corrigir antes de producao real.

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
Permitir somente origens configuradas por ambiente, como dominio Netlify e dominio proprio.

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
Cadastro aceita senha com 6 caracteres. Alteracao de senha aceita 4 caracteres. Nao ha confirmacao de email implementada no backend.

**Impacto:**
Conta vulneravel e cadastro com emails invalidos/terceiros.

**Como deveria funcionar:**
Senha minima 8-10 caracteres, politica basica, email verificado para ativar conta.

**Como corrigir:**
Adicionar `emailVerified`, tokens de verificacao, envio de email e bloquear login/recursos enquanto nao confirmar.

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

**Status recomendado:** Corrigir antes de producao real com Pix automatico.

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
- Venda nao tem `caixaId` no model `Venda`.
- Caixa nao tem resumo oficial por endpoint.
- Voucher/vale ainda nao possuem regra especifica de operadora/recebivel.
- Split funciona melhor que antes, mas precisa teste completo com Pix + cartao + dinheiro.
- Suspensao de carrinho e estado pendente de Pix usam localStorage.

**Risco principal:** caixa e turno precisam ser fechados pelo backend com `caixaId`.

### Fiado / Contas a receber

**Funcionando:**
- Fiado gera lancamento `receita/avencer`.
- Cliente e vencimento sao obrigatorios para fiado no backend.
- Existe consulta de credito do cliente.
- Contas a receber tem filtro por cliente e receber tudo.

**Parcial/incompleto:**
- Limite de credito e controle de bloqueio dependem mais do frontend.
- Historico completo de pagamentos por cliente ainda nao e uma tela dedicada forte.
- `Cliente.compras` e `Cliente.pedidos` sao contadores gravados, sujeitos a divergencia.

**Risco principal:** limite de credito deveria ser validado no backend na venda fiado.

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
- Status e metodos sao strings livres.
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
- Mistura receita recebida com status `pago` apenas.
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
- Confirmacao de email nao existe.

## Analise de seguranca

**Critico antes de producao:**
- CORS fechado por dominio.
- Rate limit backend no login/cadastro. **Corrigido em 2026-06-26.**
- Confirmacao de email.
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
- Status/metodos como String.
- Falta indice em `Lancamento(empresaId,status,vencimento)`, `Lancamento(empresaId,vendaId)`, `Venda(empresaId,caixaId)` quando existir, `Venda(empresaId,dataISO)`, `Movimentacao(empresaId,prodId,dataISO)`.
- Cliente nao tem unique por documento dentro da empresa.

## Checklist final para producao

- [ ] Migrar dinheiro de `Float` para `Decimal`.
- [ ] Adicionar `caixaId` em `Venda`.
- [ ] Fechamento de caixa calculado no backend.
- [ ] Dashboard corrigido para `pago/recebido/conciliado`.
- [x] CORS por allowlist.
- [x] Rate limit backend.
- [ ] Confirmacao de email.
- [ ] Validacao de webhook.
- [ ] Relatorios server-side para dados grandes.
- [ ] Testes automatizados nos fluxos criticos.
- [ ] Backup e rotina de restore testada.
- [ ] Monitoramento/logs de producao.

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
Reduz o risco de a API ser consumida por frontends nao autorizados em producao. Tambem deixa claro como configurar Netlify, dominio proprio e ambiente local.

**Validacao realizada:**
- `node --check src/app.js`
- `node -e "require('./src/app'); console.log('app-load-ok')"`
- Teste HTTP local com origem permitida retornando `Access-Control-Allow-Origin`.
- Teste HTTP local com origem desconhecida bloqueada pelo CORS.

**Pendencias restantes:**
- Configurar `CORS_ORIGIN` no Railway com `https://nexoerp.netlify.app` e o dominio proprio quando existir.
- Implementar confirmacao de email.

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
- Implementar confirmacao de email.
- Melhorar politica minima de senha.

## Recomendacao final

**Nao pode lancar para clientes oficiais ainda.** Pode lancar como **beta interno/controlado**, com usuarios de confianca, desde que os riscos sejam comunicados e os fluxos financeiros sejam conferidos manualmente.
