# Performance e Travamentos - NexoERP

## Diagnostico geral

O sistema funciona, mas algumas paginas vao sofrer com dados reais. O maior risco nao e apenas tamanho de arquivo: e carregar listas grandes, filtrar no frontend, renderizar muito DOM e recalcular graficos/tabelas localmente.

## Paginas mais pesadas

| Prioridade | Pagina/arquivo | Evidencia | Risco |
|---|---|---:|---|
| Critico | `financeiro.html` | ~4.889 linhas / ~239 KB | Muito codigo, muitas responsabilidades, DRE, contas, custos, bancos e conciliacao no mesmo arquivo |
| Alto | `pdv/pdv.css` | ~6.177 linhas / ~156 KB | CSS monolitico, dificil manutencao e alto custo visual |
| Alto | `pdv/pdv.js` | ~3.304 linhas / ~163 KB | Produto, carrinho, Pix, cartao, fiado, caixa, impressao e atalhos no mesmo arquivo |
| Alto | `dashboard.html` | ~2.648 linhas / ~132 KB | Carrega varias listas e recalcula muitos indicadores no frontend |
| Medio | `produtos.html` | ~2.557 linhas / ~100 KB | Modal grande, categorias, filtros, imagem/cache e CRUD juntos |
| Medio | `clientes.html` | ~2.017 linhas / ~86 KB | Listas, grid, filtros, historico e modal juntos |
| Medio | `estoque.html` | ~1.953 linhas / ~80 KB | Estoque, depositos, movimentacoes e cadastro rapido juntos |
| Medio | `relatorios.html` | ~1.482 linhas / ~63 KB | Carrega dados amplos e exporta no navegador |

## Problemas por prioridade

## Problema: Relatorios calculados no frontend

**Prioridade:** Critico

**Arquivo:** `C:\Users\Joao Pedro\Desktop\sistemy\relatorios.html`

**Funcao/trecho:** `loadAllData()`, exportadores e filtros locais.

**Por que causa lentidao:**
Relatorios buscam listas grandes e processam tudo no navegador. Com muitos produtos, vendas e lancamentos, isso trava a tela.

**Como corrigir:**
Criar endpoints de relatorio por tipo com filtros server-side e exportacao pelo backend.

## Problema: Dashboard carrega listas completas

**Prioridade:** Alto

**Arquivo:** `C:\Users\Joao Pedro\Desktop\sistemy\dashboard.html`

**Funcao/trecho:** `initDashboard()` chama `/vendas`, `/clientes`, `/produtos`, `/pedidos`, `/financeiro`.

**Por que causa lentidao:**
O dashboard deveria carregar resumos, nao todas as listas. Cada card faz filtros/reduces no cliente.

**Como corrigir:**
Criar `/dashboard/resumo`, `/dashboard/graficos`, `/dashboard/alertas`, com periodo e agregacoes no banco.

## Problema: PDV carrega todos os produtos

**Prioridade:** Alto

**Arquivo:** `C:\Users\Joao Pedro\Desktop\sistemy\pdv\pdv.js`

**Funcao/trecho:** `loadProducts()` busca `/produtos` e filtra/renderiza no frontend.

**Por que causa lentidao:**
Em lojas com muitos itens, o PDV demora a iniciar e renderizar grid. Busca e categorias operam sobre array local completo.

**Como corrigir:**
Criar endpoint dedicado `/produtos/pdv?q=&cat=&page=&limit=` com campos minimos, debounce e cache curto.

## Problema: Caixa calcula resumo pelo frontend

**Prioridade:** Alto

**Arquivo:** `C:\Users\Joao Pedro\Desktop\sistemy\pdv\pdv-cash-register.js`

**Funcao/trecho:** `renderCaixaAberto()` e `renderFechamentoCaixa()`.

**Por que causa lentidao/risco:**
Usa `todayStats` e `salesHistory`, recalculando e renderizando no modal. O problema principal e confiabilidade, nao so performance.

**Como corrigir:**
Endpoint backend de resumo por caixa.

## Problema: Financeiro concentra muitos submodulos

**Prioridade:** Alto

**Arquivo:** `C:\Users\Joao Pedro\Desktop\sistemy\financeiro.html`

**Funcao/trecho:** DRE, custos, contas, recebimentos, conciliacao, contas bancarias e graficos no mesmo arquivo.

**Por que causa lentidao:**
Carregamento e parse inicial grande; maior risco de listeners, funcoes e renderizacoes desnecessarias.

**Como corrigir:**
Separar em arquivos:
- `css/financeiro.css`
- `js/financeiro/core.js`
- `js/financeiro/contas.js`
- `js/financeiro/recebimentos.js`
- `js/financeiro/custos.js`
- `js/financeiro/dre.js`
- `js/financeiro/bancos.js`
- `js/financeiro/conciliacao.js`

## Problema: Falta debounce padronizado

**Prioridade:** Medio

**Arquivos:** `pdv/pdv.js`, `clientes.html`, `produtos.html`, `estoque.html`, `financeiro.html`, `relatorios.html`

**Por que causa lentidao:**
Inputs com `oninput` podem disparar renderizacao ou chamada de API a cada tecla.

**Como corrigir:**
Criar `NexoDebounce(fn, ms)` em `utils.js` e aplicar em buscas.

## Problema: Falta de indices para relatorios

**Prioridade:** Alto

**Arquivo:** `C:\Users\Joao Pedro\Desktop\nexoerp-api\prisma\schema.prisma`

**Por que causa lentidao:**
Filtros por empresa, data, status, cliente e venda ficarao pesados com muitos registros.

**Indices recomendados:**
- `Lancamento(empresaId, status, vencimento)`
- `Lancamento(empresaId, tipo, status, pagoEm)`
- `Lancamento(empresaId, vendaId)`
- `Lancamento(empresaId, clienteId, status)`
- `Venda(empresaId, dataISO)`
- `Venda(empresaId, operadorId, dataISO)`
- `Venda(empresaId, caixaId)` depois de criar o campo
- `Movimentacao(empresaId, prodId, dataISO)`
- `Pedido(empresaId, status, dataISO)`

## Chamadas duplicadas ou pesadas observadas

- Dashboard busca listas completas para montar KPIs.
- Financeiro inicial busca `/financeiro`, `/financeiro/resumo`, `/custos`, `/produtos`, `/estoque/movimentacoes`.
- Relatorios busca dados amplos e depois exporta localmente.
- PDV busca produtos completos no carregamento.

## Ordem de correcao recomendada

1. Criar endpoint de resumo oficial do caixa.
2. Criar endpoint de produtos do PDV com busca/paginacao.
3. Criar endpoints-resumo do dashboard.
4. Migrar relatorios pesados para backend.
5. Debounce nas buscas.
6. Quebrar `financeiro.html`.
7. Quebrar `pdv.css`.
8. Criar indices.

