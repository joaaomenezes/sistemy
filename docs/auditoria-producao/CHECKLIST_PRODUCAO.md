# Checklist de Producao - NexoERP

## Backend

- [x] API REST Express estruturada.
- [x] Rotas principais protegidas por JWT.
- [x] Filtro por `empresaId` nas rotas principais.
- [x] Validacao com Zod em varios endpoints.
- [x] Rate limit backend em login/cadastro.
- [x] CORS restrito por ambiente.
- [x] Venda PDV exige caixa aberto no backend.
- [ ] Logs de producao sem dados sensiveis.
- [ ] Testes automatizados para vendas, caixa, estoque e financeiro.
- [x] Endpoint de resumo oficial para caixa.
- [ ] Endpoints de resumo oficial para dashboard.
- [ ] Webhooks com validacao de assinatura.

## Frontend

- [x] Telas principais existem.
- [x] Migracao principal de localStorage para API foi avancada.
- [x] PDV foi parcialmente extraido para arquivos.
- [ ] Separar `financeiro.html` em CSS/JS por feature.
- [ ] Reduzir `pdv.css` e `pdv.js`.
- [ ] Criar helpers globais para status financeiro.
- [ ] Debounce padronizado em buscas.
- [ ] Tratamento de erro padronizado.
- [ ] Remover/ocultar telas visuais sem backend real.

## Banco

- [x] PostgreSQL com Prisma.
- [x] Multiempresa por `empresaId`.
- [x] Migrations existem.
- [x] `Venda.caixaId` criado e persistido para venda PDV.
- [ ] Trocar `Float` por `Decimal` para dinheiro.
- [ ] Criar relacoes fortes entre venda, lancamento, cliente, caixa e operador.
- [ ] Criar enums ou tabelas de status/metodos.
- [ ] Adicionar indices financeiros e de relatorio.
- [ ] Criar unique de documento de cliente por empresa, se regra exigir.

## Seguranca

- [x] Senhas com bcrypt.
- [x] JWT com expiracao.
- [x] Permissoes por modulo.
- [ ] Confirmacao de email.
- [ ] Recuperacao de senha segura.
- [ ] Politica minima de senha.
- [x] Rate limit no backend.
- [x] CORS fechado.
- [ ] Auditoria de dependencias.
- [ ] Backup/restore documentado.

## Financeiro

- [x] Contas a pagar/receber.
- [x] Recebimentos com data/hora.
- [x] Contas bancarias.
- [x] Cartao vira contas a receber.
- [x] Conciliacao manual de cartao inicial.
- [ ] Extrato bancario real.
- [ ] Conciliação bancaria por extrato.
- [ ] Historico de pagamentos por cliente dedicado.
- [ ] Dashboard financeiro corrigido para status `recebido/conciliado`.
- [ ] Centro de custo integrado formalmente a contas a pagar.

## PDV

- [x] Venda em dinheiro.
- [x] Venda Pix automatico Mercado Pago.
- [x] Venda debito/credito gera recebivel.
- [x] Venda fiado gera conta a receber.
- [x] Estorno devolve estoque e estorna lancamento.
- [x] Cadastro rapido de cliente.
- [x] API bloqueia venda PDV sem caixa aberto.
- [x] Venda com `caixaId` persistido em `Venda`.
- [x] Fechamento oficial calculado no backend.
- [x] PDV renderiza fechamento usando resumo oficial da API.
- [ ] Validacao backend de limite de credito.
- [ ] Regra especifica para voucher/vale.
- [ ] Teste automatizado de split.

## Estoque

- [x] Cadastro de produtos.
- [x] Entrada, saida e ajuste.
- [x] Baixa por venda.
- [x] Devolucao por estorno.
- [ ] Custo medio.
- [ ] Estoque por deposito real.
- [ ] Entrada por XML.
- [ ] Relatorio server-side de movimentacoes.

## Clientes

- [x] CRUD clientes.
- [x] Cliente no fiado.
- [x] Consulta de credito.
- [ ] Validacao CPF/CNPJ no backend.
- [ ] Historico unificado de compras e pagamentos.
- [ ] Limite de credito validado no backend.
- [ ] KPI novos no mes usando `criadoEm`, nao string `cadastro`.

## Relatorios

- [x] Tela de relatorios.
- [x] Historico de relatorios no backend.
- [x] Exportacao CSV/PDF/Excel no frontend.
- [ ] Relatorios pesados server-side.
- [ ] Relatorio de caixa por turno.
- [ ] Relatorio de inadimplencia.
- [ ] Relatorio DRE oficial.
- [ ] Paginacao/exportacao por streaming ou job.

## Deploy

- [x] Frontend no Netlify.
- [x] Backend no Railway.
- [x] `config.js` apontando para API Railway.
- [ ] Dominio proprio configurado.
- [ ] Variaveis de producao revisadas.
- [ ] `prisma migrate deploy` no fluxo de deploy.
- [ ] Healthcheck monitorado.
- [ ] Backup Neon configurado e testado.

## Performance

- [ ] Quebrar arquivos grandes.
- [ ] Paginar relatorios e dashboard.
- [ ] Evitar carregar `/produtos` inteiro no PDV.
- [ ] Criar endpoint de busca rapida de produtos para PDV.
- [ ] Debounce nas buscas.
- [ ] Reduzir renderizacao de DOM em tabelas/grids.
- [ ] Criar indices no banco.

## Testes

- [ ] Teste venda dinheiro.
- [ ] Teste venda Pix confirmado.
- [ ] Teste venda Pix pendente/expirada.
- [ ] Teste debito/credito e conciliacao.
- [ ] Teste fiado e recebimento.
- [ ] Teste estorno.
- [ ] Teste abertura/fechamento de caixa.
- [ ] Teste pedido faturado/concluido/cancelado.
- [ ] Teste estoque insuficiente.
- [ ] Teste permissoes por usuario.
