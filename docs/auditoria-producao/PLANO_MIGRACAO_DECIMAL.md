# Plano de Migracao Monetaria - Float para Decimal

Data: 2026-06-27

## Objetivo

Eliminar risco de diferenca de centavos causado por campos monetarios em `Float`, sem quebrar o PDV, financeiro, caixa, Pix, cartao, DRE e relatorios.

Este documento conclui a etapa de planejamento da Fase 1. A migracao real deve ser feita em janela propria, com backup e testes automatizados dos fluxos criticos.

## Decisao tecnica

- Valores monetarios principais devem virar `Decimal(14,2)`.
- Percentuais e taxas devem virar `Decimal(7,4)` ou permanecer numericos se forem apenas configuracao operacional, mas nunca devem ser misturados com dinheiro.
- Quantidade de estoque nao entra nesta migracao; `Movimentacao.qty` continua sendo quantidade, nao moeda.
- O backend deve centralizar parsing/arredondamento antes de criar ou atualizar registros.
- O frontend continua enviando `number` por JSON, mas o backend deve normalizar antes de persistir.

## Campos monetarios a migrar

### `ContaBancaria`

- `saldoInicial`: `Float` -> `Decimal(14,2)`

### `Produto`

- `preco`: `Float` -> `Decimal(14,2)`
- `custo`: `Float` -> `Decimal(14,2)`
- `precoMin`: `Float?` -> `Decimal(14,2)?`

Observacao: `descMax` parece percentual/desconto maximo. Manter fora da migracao monetaria ate confirmar regra. Se for percentual, usar `Decimal(7,4)`.

### `Cliente` / `Fornecedor`

- `limite`: `Float` -> `Decimal(14,2)`

### `Pedido`

- `subtotal`: `Float` -> `Decimal(14,2)`
- `desconto`: `Float` -> `Decimal(14,2)`
- `total`: `Float` -> `Decimal(14,2)`

### `Venda`

- `subtotal`: `Float` -> `Decimal(14,2)`
- `desconto`: `Float` -> `Decimal(14,2)`
- `total`: `Float` -> `Decimal(14,2)`

### `Lancamento`

- `valor`: `Float` -> `Decimal(14,2)`
- `valorBruto`: `Float?` -> `Decimal(14,2)?`
- `valorTaxa`: `Float?` -> `Decimal(14,2)?`
- `valorLiquidoPrevisto`: `Float?` -> `Decimal(14,2)?`

Observacao: `taxaPercentual` nao e valor monetario. Usar `Decimal(7,4)?` se a regra pedir precisao formal.

### `Caixa`

- `fundo`: `Float` -> `Decimal(14,2)`
- `totalVendas`: `Float` -> `Decimal(14,2)`

Observacao: movimentos dentro de `sangrias` ficam em JSON. A aplicacao deve normalizar `mov.valor` ao gravar.

### `Custo`

- `valor`: `Float` -> `Decimal(14,2)`

### `HistoricoRelatorio`

- `total`: `Float` -> `Decimal(14,2)`

### `PixCobranca`

- `valor`: `Float` -> `Decimal(14,2)`

## Campos que nao devem entrar como dinheiro

- `Movimentacao.qty`: quantidade.
- `ConfiguracaoPDV.taxaJurosMensal`: percentual/fator.
- `Lancamento.taxaPercentual`: percentual.
- Campos JSON (`itens`, `pagamentos`, `parcelas`, `sangrias`) exigem normalizacao no backend, mas nao sao migrados por Prisma como colunas.

## Estrategia recomendada

1. Criar helper backend de dinheiro:
   - `toMoney(value): Prisma.Decimal`
   - `moneyToNumber(value): number`
   - `roundMoney(value): number`
   - `sumMoney(values): Prisma.Decimal`

2. Ajustar schemas Zod:
   - continuar aceitando `number` vindo do frontend;
   - converter antes de persistir;
   - rejeitar `NaN`, infinito e valores com escala invalida quando aplicavel.

3. Ajustar rotas criticas:
   - `produtos`
   - `clientes`
   - `pedidos`
   - `vendas`
   - `financeiro`
   - `caixas`
   - `custos`
   - `pix`
   - `webhooks`

4. Criar migration Prisma:
   - alterar colunas para `Decimal(14,2)`;
   - alterar percentuais escolhidos para `Decimal(7,4)`;
   - nao alterar `qty`.

5. Regenerar Prisma Client:
   - `npx.cmd prisma generate`

6. Revisar respostas JSON:
   - Prisma pode retornar `Decimal` como objeto/string dependendo do uso;
   - padronizar serializacao para o frontend receber numero ou string de forma previsivel.

7. Rodar testes automatizados:
   - venda dinheiro;
   - venda Pix;
   - venda cartao com taxa;
   - venda fiado com limite;
   - estorno;
   - fechamento de caixa;
   - DRE/resumo financeiro.

8. Fazer backup antes da migracao em producao.

9. Aplicar em ambiente de teste primeiro:
   - `npx.cmd prisma migrate deploy`
   - conferir dados antigos e novos.

## Riscos

- Quebra de serializacao JSON se `Decimal` chegar cru ao frontend.
- Diferenca em somas agregadas se algum trecho continuar usando `Number` sem arredondamento.
- Campos em JSON continuam sujeitos a valores imprecisos se nao forem normalizados na entrada.
- Relatorios e exports podem receber string em vez de number se a serializacao nao for padronizada.

## Criterio de pronto para executar a migracao

- Backup/restore testado.
- Testes automatizados minimos de PDV, caixa, financeiro e estorno criados.
  - Concluido em 2026-06-28 para a cobertura critica da Fase 1: venda dinheiro, caixa, estoque insuficiente, estorno, fiado/recebimento, Pix, cartao/conciliacao, resumo financeiro, pedido, permissoes e webhook.
- Helper monetario backend implementado.
- Rotas criticas convertendo entrada/saida de forma padronizada.
- Plano de rollback documentado.

## Status

Planejamento concluido. Migracao real ainda pendente.
