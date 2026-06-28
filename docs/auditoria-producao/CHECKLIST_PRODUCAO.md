# Checklist de Producao - NexoERP

## Backend

- [x] API REST Express estruturada.
- [x] Rotas principais protegidas por JWT.
- [x] Filtro por `empresaId` nas rotas principais.
- [x] Validacao com Zod em varios endpoints.
- [x] Rate limit backend em login/cadastro.
- [x] CORS restrito por ambiente.
- [x] Venda PDV exige caixa aberto no backend.
- [x] Logs de producao sem dados sensiveis.
- [x] Testes automatizados para vendas, caixa, estoque e financeiro.
  - Cobertura inicial concluida em `test/api`: venda dinheiro, caixa, estoque insuficiente, estorno, fiado/recebimento, Pix, cartao/conciliacao, pedido, permissoes, resumo financeiro e webhook.
- [x] Endpoint de resumo oficial para caixa.
- [ ] Endpoints de resumo oficial para dashboard.
- [x] Webhooks com validacao de assinatura.
- [x] Healthcheck/monitoramento de API em producao.

## Frontend

- [x] Telas principais existem.
- [x] Migracao principal de localStorage para API foi avancada.
- [x] PDV foi parcialmente extraido para arquivos.
- [ ] Separar `financeiro.html` em CSS/JS por feature.
- [ ] Reduzir `pdv.css` e `pdv.js`.
- [x] Criar helpers globais para status financeiro.
- [ ] Debounce padronizado em buscas.
- [ ] Tratamento de erro padronizado.
- [ ] Remover/ocultar telas visuais sem backend real.

## Banco

- [x] PostgreSQL com Prisma.
- [x] Multiempresa por `empresaId`.
- [x] Migrations existem.
- [x] `Venda.caixaId` criado e persistido para venda PDV.
- [x] Planejar troca de `Float` por `Decimal` para dinheiro.
- [x] Executar troca de `Float` por `Decimal` para dinheiro em banco de teste.
- [x] Aplicar troca de `Float` por `Decimal` no banco principal apos backup/restore.
- [ ] Criar relacoes fortes entre venda, lancamento, cliente, caixa e operador.
- [ ] Criar enums ou tabelas de status/metodos.
- [ ] Adicionar indices financeiros e de relatorio.
- [ ] Criar unique de documento de cliente por empresa, se regra exigir.

## Seguranca

- [x] Senhas com bcrypt.
- [x] JWT com expiracao.
- [x] Permissoes por modulo.
- [x] Confirmacao de email.
- [ ] Recuperacao de senha segura.
- [ ] Politica minima de senha.
- [x] Rate limit no backend.
- [x] CORS fechado.
- [ ] Auditoria de dependencias.
- [x] Backup/restore documentado.
- [x] Restore testado em ambiente separado.

## Financeiro

- [x] Contas a pagar/receber.
- [x] Recebimentos com data/hora.
- [x] Contas bancarias.
- [x] Cartao vira contas a receber.
- [x] Conciliacao manual de cartao inicial.
- [ ] Extrato bancario real.
- [ ] Conciliação bancaria por extrato.
- [ ] Historico de pagamentos por cliente dedicado.
- [x] Dashboard financeiro corrigido para status `recebido/conciliado`.
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
- [x] Validacao backend de limite de credito.
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
- [x] Limite de credito validado no backend.
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
- [ ] Variaveis de producao revisadas nos paineis Railway/Netlify/Neon/Resend.
  - Auditoria final criada em `docs/auditoria-producao/AUDITORIA_FINAL_FASE1.md`.
  - Pendencia operacional: rotacionar `RESEND_API_KEY` se a chave antiga do `.env.example` for real.
- [x] `prisma migrate deploy` no fluxo de deploy.
- [x] Healthcheck monitorado.
  - Monitor inicial criado via GitHub Actions a cada 5 minutos.
  - Monitor externo criado no UptimeRobot com alerta em `alertas@azzys.com.br`.
- [x] Backup Neon configurado e testado.
  - Backup real gerado e restore validado em branch separado.

## Performance

- [ ] Quebrar arquivos grandes.
- [ ] Paginar relatorios e dashboard.
- [ ] Evitar carregar `/produtos` inteiro no PDV.
- [ ] Criar endpoint de busca rapida de produtos para PDV.
- [ ] Debounce nas buscas.
- [ ] Reduzir renderizacao de DOM em tabelas/grids.
- [ ] Criar indices no banco.

## Testes

- [x] Teste venda dinheiro.
- [x] Teste venda Pix confirmado.
- [x] Teste venda Pix pendente/expirada.
- [x] Teste debito/credito e conciliacao.
- [x] Teste credito parcelado com taxa e liquido previsto.
- [x] Teste fiado e recebimento.
- [x] Teste fiado com limite de credito e PIN supervisor.
- [x] Teste estorno.
- [x] Teste abertura/fechamento de caixa.
- [x] Teste bloqueio de venda PDV sem caixa aberto do operador.
- [x] Teste webhook Mercado Pago sem assinatura.
- [x] Teste webhook Mercado Pago evento repetido/atrasado.
- [x] Teste pedido faturado/concluido/cancelado.
- [x] Teste estoque insuficiente.
- [x] Teste permissoes por usuario.
- [x] Teste resumo financeiro/dashboard.
