# NexoERP — Auditoria: Jornada do Usuário (Simulação de Código)

**Data da Auditoria:** 04/06/2026
**Auditor:** Análise estática de código (leitura, sem execução)
**Metodologia:** Rastreamento de fluxo de dados através dos módulos frontend-only (localStorage como banco de dados)
**Arquivos analisados:** `auth.js`, `utils.js`, `cadastro.html`, `produtos.html`, `clientes.html`, `pdv.html`, `financeiro.html`, `estoque.html`

---

## Resumo Executivo

A jornada completa do usuário — do cadastro até a verificação pós-venda — contém **14 bugs confirmados por código**, sendo 3 críticos. O sistema tem uma base funcional sólida, mas apresenta falhas que vão desde dados permanentemente corrompidos (limite de crédito de clientes salvo com magnitude errada) até KPIs financeiros que nunca refletem dados reais (hardcoded com demo data). A separação arquitetural entre PDV e Pedidos de Vendas é intencional, mas cria lacunas de UX não sinalizadas ao usuário.

| Severidade | Quantidade |
|------------|------------|
| CRÍTICO    | 3          |
| ALTO       | 4          |
| MÉDIO      | 5          |
| BAIXO      | 2          |
| **Total**  | **14**     |

---

## Etapa 1 — Criação de Conta (`cadastro.html` + `auth.js`)

### ✅ Funciona

- Wizard de 4 passos renderiza corretamente (tipos: Pessoa Física, MEI, Empresa).
- Validação de e-mail, senha (mínimo 6 caracteres) e confirmação de senha funcionam.
- Hash SHA-256 via `crypto.subtle.digest` é aplicado à senha antes de qualquer persistência.
- `NexoAuth.registerUser()` limpa corretamente os dados do usuário anterior via `DATA_KEYS` — `nexoerp.pdv.vendas` está na lista (linha 101 de `auth.js`), sem contaminação entre contas.
- Sessão criada com TTL de 8h (ou 30d com "Lembrar-me").
- Redirecionamento para `dashboard.html` após cadastro bem-sucedido.

### 🐛 Bugs encontrados

**[MÉDIO] — Botão "Finalizar" não tem `id`, estado nunca atualizado**
- **Arquivo:** `cadastro.html`, função `finalizar()`, linha ~1186
- **Problema:** O código executa `const btn = document.getElementById('btnFinalizar')`. O botão de finalização no HTML não possui o atributo `id="btnFinalizar"`, portanto `btn` é sempre `null`. Os guards `if (btn)` evitam crash, mas o botão nunca entra em estado de loading nem é re-habilitado após erro — o usuário pode clicar múltiplas vezes disparando múltiplos cadastros.
- **Esperado:** `btn.disabled = true` durante o processamento assíncrono; `btn.disabled = false` no `finally`.
- **Observado:** Nenhuma mutação de estado no botão ocorre.

**[MÉDIO] — Plan name concatenado com texto do badge**
- **Arquivo:** `cadastro.html`, função `finalizar()`, linha ~1198
- **Problema:** `document.querySelector('.plan-option.selected strong')?.textContent.trim()` captura o texto de todo o `<strong>`, incluindo o `<span>` do badge "Popular" que está aninhado dentro. O plano padrão selecionado retorna `"Padrão Popular"` em vez de `"Padrão"`.
- **Esperado:** `plan: "Padrão"` salvo em `nexoerp.users`.
- **Observado:** `plan: "Padrão Popular"` salvo — dado corrompido.

**[ALTO] — Campos do wizard perdidos após registro**
- **Arquivo:** `cadastro.html` (coleta), `auth.js` `registerUser()` (não persiste)
- **Problema:** O wizard coleta `telefone` (passo 2), `cargo` (passo 2), `cidade` (passo 1) e `funcionarios` (passo 1). Nenhum desses campos é passado ao `registerUser()` nem salvo no objeto do usuário em `nexoerp.users`. O objeto persistido contém apenas: `id, name, username, email, passwordHash, isDono, permissions, company, segment, plan, createdAt`.
- **Esperado:** Todos os campos coletados devem ser persistidos no perfil do usuário.
- **Observado:** Campos silenciosamente descartados após submissão — sem aviso ao usuário.

---

## Etapa 2 — Cadastro de Produto (`produtos.html`)

### ✅ Funciona

- CRUD completo com validação de campos obrigatórios (nome, preço).
- `saveProduct()` persiste objeto rico: `id, nome, sku, codigo, categoria, preço, custo, estoque, estoqueMin, unidade, deposito, fornecedor, descricao, imagem, color, status, exibirPdv, vendaSemEstoque, createdAt, updatedAt`.
- `openEdit()` restaura todos os campos corretamente, incluindo toggles (`exibirPdv`, `vendaSemEstoque`).
- Select de depósito lê `nexoerp.depositos` e faz fallback correto para "Depósito Principal" em contas novas.
- Categorias carregadas de `nexoerp.categorias`; persistidas em `nexoerp.categorias` ao criar novas.
- Filtros de tabela (busca, categoria, status) funcionam sobre array em memória.

### 🐛 Bugs encontrados

**[MÉDIO] — Cor padrão `#1e2a3a` não existe nas swatches**
- **Arquivo:** `produtos.html`, lógica de reset de formulário e array `SWATCHES`
- **Problema:** O valor padrão de `selectedColor` é `'#1e2a3a'` (azul-escuro do tema). O array `SWATCHES` contém: `['#00c896', '#0077ff', '#ff6b35', '#ff4757', '#a855f7', '#ec4899', '#f59e0b', '#14b8a6', '#6b7f96', '#e8edf5']`. Ao abrir `openEdit()` de um produto salvo com a cor padrão, nenhuma swatch é marcada como selecionada visualmente.
- **Esperado:** A swatch correspondente à cor atual deve ser destacada.
- **Observado:** Nenhuma swatch selecionada — UX ambígua.

**[BAIXO] — Contador `vendas` do produto não é re-persistido**
- **Arquivo:** `pdv.html`, função `_saveProdutos()`, linha ~5806
- **Problema:** `_saveProdutos()` atualiza apenas o campo `estoque` de cada produto em `nexoerp.produtos`. O campo `vendas` (se existir no produto) nunca é incrementado nem persistido por nenhum módulo.
- **Esperado:** Cada venda finalizada no PDV deveria incrementar `p.vendas++` antes de salvar.
- **Observado:** `p.vendas` permanece `0` ou `undefined` para sempre.

---

## Etapa 3 — Cadastro de Cliente (`clientes.html`)

### ✅ Funciona

- Wizard de 4 passos com seleção de tipo: PF, PJ, MEI.
- Validação de CPF via `validarCPF()` de `utils.js` e CNPJ via `validarCNPJ()` funcionam.
- Máscara de documento aplicada corretamente: CPF para PF, CNPJ para PJ e MEI.
- Select de vendedor lê `nexoerp.users` — corretamente populado com usuários reais do sistema.
- `saveEntity()` persiste cliente com `compras: 0` e `pedidos: 0` como valores iniciais.

### 🐛 Bugs encontrados

**[CRÍTICO] — Campo `limite` salvo com magnitude errada (×100)**
- **Arquivo:** `clientes.html`, função `saveEntity()`, linha ~1251
- **Problema:** O campo de limite de crédito usa máscara monetária. Ao salvar: `limite: document.getElementById('f-limite').value.replace(/\D/g,'') || '0'`. Isso remove todos os não-dígitos incluindo vírgula/ponto — um valor digitado como `R$ 1.000,00` resulta em `"100000"` (string). Ao exibir: `'R$ ' + fmt(parseFloat(c.limite) || 0)` — `parseFloat("100000")` = 100000, formatado como `R$ 100.000,00`. O valor exibido é **100× maior** que o digitado.
- **Esperado:** R$ 1.000,00 digitado → salvo como `1000.00` (float, centavos divididos) → exibido como R$ 1.000,00.
- **Observado:** R$ 1.000,00 digitado → salvo como `"100000"` → exibido como R$ 100.000,00.
- **Impacto:** Corrupção permanente de dados para todos os clientes com limite de crédito.

**[MÉDIO] — Label do documento MEI mostra "CPF *" incorretamente**
- **Arquivo:** `clientes.html`, função `selectTipo()` e label do campo de documento
- **Problema:** A função `selectTipo` define `isPJ = tipo === 'pj'`. Para MEI, `isPJ` é `false`, então o label do campo exibe "CPF *". No entanto, a máscara aplicada é CNPJ e a validação chama `validarCNPJ` para MEI — comportamento correto para o tipo MEI. Apenas o label está errado.
- **Esperado:** Label deve mostrar "CNPJ *" quando `tipoSel === 'mei'`.
- **Observado:** Label exibe "CPF *" mas campo aceita/valida CNPJ.

**[BAIXO] — Contadores `compras` e `pedidos` nunca incrementados**
- **Arquivo:** `clientes.html` (salva), `pdv.html` (não linka cliente), `pedidos.html` (não auditado nesta sessão)
- **Problema:** `saveEntity()` salva `compras: existing?.compras || 0` e `pedidos: existing?.pedidos || 0`. O PDV não possui vínculo com clientes (por design declarado) — portanto `compras` nunca é incrementado por vendas PDV. Se `pedidos.html` também não incrementa `clientes.pedidos` após finalizar um pedido, esses campos serão sempre zero.
- **Esperado:** Campos de histórico devem refletir atividade real do cliente.
- **Observado:** Campos permanecem em 0 indefinidamente.

---

## Etapa 4 — Venda no PDV (`pdv.html`)

### ✅ Funciona

- Carregamento de produtos filtra corretamente por `status !== 'inativo' && exibirPdv !== false`.
- Cálculo de desconto, cupom e juros de parcelamento funcionam.
- `finalizarVenda()` executa na ordem correta: constrói venda → registra → decrementa estoque → salva → grava movimentação → cria lançamento financeiro → limpa carrinho.
- `_criarLancamentoFinanceiro()` grava em `nexoerp.financeiro` com campos: `{id, tipo:'receita', categoria:'Vendas', descricao, valor, vencimento, pago_em, status:'pago', forma_pgto, data, venda_id, origem:'pdv'}`.
- `_addMovimentacoes()` grava em `nexoerp.movimentacoes` para cada item vendido.
- `estornarVenda()` retorna estoque, marca lançamento como 'estornado' e atualiza `nexoerp.pdv.vendas` corretamente.
- ID de venda: `#V${4900 + salesHistory.length + 1}` — sequencial por sessão.

### 🐛 Bugs encontrados

**[CRÍTICO] — Flag `vendaSemEstoque` ignorada ao adicionar ao carrinho**
- **Arquivo:** `pdv.html`, função `addToCart()`, linha ~6432
- **Problema:** `if (!p || p.estoque === 0) return;` — bloqueia incondicionalmente produtos com estoque zero, mesmo que o produto tenha `vendaSemEstoque: true` configurado em `produtos.html`. A flag que deveria permitir venda sem estoque nunca é verificada neste guard.
- **Esperado:** `if (!p || (p.estoque === 0 && !p.vendaSemEstoque)) return;`
- **Observado:** Qualquer produto com `estoque === 0` é bloqueado, tornando a flag `vendaSemEstoque` completamente não-funcional.

**[ALTO] — Caixa obrigatório — novo usuário bloqueado sem aviso claro**
- **Arquivo:** `pdv.html`, fluxo de `addToCart()` e guarda de caixa fechado
- **Problema:** Se o usuário ainda não abriu o caixa, qualquer tentativa de adicionar produto ao carrinho exibe alerta de "caixa fechado" e retorna. Para novos usuários (conta recém-criada), não há caixa aberto — o fluxo de onboarding não orienta o usuário a abrir o caixa antes de usar o PDV.
- **Esperado:** Interface deve guiar o novo usuário a abrir o caixa antes de tentar realizar vendas.
- **Observado:** Usuário novo clica em produto e recebe alerta genérico sem instrução de próximos passos.

**[ALTO] — Vendas suspensas em `sessionStorage` — perdidas ao fechar aba**
- **Arquivo:** `pdv.html`, linha ~5983: `const _SUSP_KEY = 'pdv.suspendedCarts'`
- **Problema:** Vendas suspensas são gravadas em `sessionStorage`, que é destruído quando a aba do navegador é fechada. Em uma situação real (interrupção de atendimento, queda de energia, fechamento acidental da aba), todos os carrinhos suspensos são perdidos sem aviso.
- **Esperado:** Vendas suspensas deveriam ser persistidas em `localStorage` com a chave `nexoerp.pdv.suspendedCarts`.
- **Observado:** `sessionStorage` usado — dados efêmeros por design não intencional.

**[MÉDIO] — ID de movimentação não-único após deleções**
- **Arquivo:** `pdv.html`, função `_addMovimentacoes()`, linha ~5822
- **Problema:** `id: movs.length + 1` — o ID é calculado como tamanho atual do array + 1. Se entradas de movimentações forem deletadas em `estoque.html` (ou por qualquer outro módulo), o próximo ID gerado pode colidir com um ID já existente.
- **Esperado:** `id: Date.now()` ou UUID para garantir unicidade.
- **Observado:** ID sequencial baseado em tamanho — colisão possível após deleções.

---

## Etapa 5 — Verificação Financeira (`financeiro.html`)

### ✅ Funciona

- Tabela de lançamentos (`tblMovim`) lê corretamente `nexoerp.financeiro` e renderiza entradas do PDV.
- Lançamentos PDV aparecem com todos os campos preenchidos na listagem.
- Lançamentos com `status: 'pago'` (gerados pelo PDV) aparecem corretamente em "Contas a Receber — Detalhe" (filtro `status !== 'cancelado' && status !== 'estornado'`).
- Lançamentos PDV NÃO aparecem em "Contas a Receber — Pendentes" (filtro `status !== 'pago'`) — comportamento correto.
- Lançamentos estornados ficam marcados como `'estornado'` e são excluídos dos totalizadores pendentes.

### 🐛 Bugs encontrados

**[CRÍTICO] — KPIs e gráficos financeiros são dados hardcoded (demo)**
- **Arquivo:** `financeiro.html`, função `renderKPIs()`, linha ~2224 e objeto `KPI_DATA`
- **Problema:** `renderKPIs()` usa o objeto estático `KPI_DATA` com valores fixos. Os KPI cards (Receitas, Despesas, Resultado, Saldo Atual, Fluxo de Caixa) exibem sempre os mesmos números demo, independentemente do conteúdo real de `nexoerp.financeiro`. Da mesma forma, `CHART_DATA` e `DONUT_DATA` são objetos estáticos — o gráfico de linha e o gráfico donut nunca refletem dados reais.
- **Esperado:** `renderKPIs()` deve calcular receitas/despesas/resultado a partir de `lancamentos` filtrados por período; gráficos devem ser construídos a partir dos mesmos dados.
- **Observado:** Um usuário com R$ 50.000 em vendas vê os mesmos KPIs demo que um usuário sem nenhuma venda. O módulo financeiro é decorativo no estado atual.

**[ALTO] — Inconsistência de schema entre lançamentos manuais e PDV**
- **Arquivo:** `financeiro.html` (lê), `pdv.html` (grava)
- **Problema:** Lançamentos criados manualmente via `salvarLancamento()` em `financeiro.html` usam os campos `desc`, `venc`, `categ`. Lançamentos criados pelo PDV via `_criarLancamentoFinanceiro()` usam `descricao`, `vencimento`, `categoria`. A tabela contorna isso com `l.descricao || l.desc`, `l.vencimento || l.venc || l.data`, `l.categoria || l.categ`. Os filtros e buscas textuais podem não cobrir ambos os campos em todos os pontos do código.
- **Esperado:** Schema único para lançamentos financeiros; normalização ao salvar ou ao carregar.
- **Observado:** Dois schemas paralelos convivendo — risco de bugs latentes em qualquer funcionalidade nova que acesse esses campos.

---

## Etapa 6 — Verificação de Estoque (`estoque.html`)

### ✅ Funciona

- Lê diretamente de `nexoerp.produtos` (mesmo key que `pdv.html` e `produtos.html`) — estoque sempre atualizado após vendas.
- KPIs calculados a partir de dados reais: total de SKUs, valor total em estoque, itens abaixo do mínimo.
- Movimentações do PDV aparecem no histórico — ambos usam `nexoerp.movimentacoes`.
- Filtro de data do dia: `m.data.startsWith(hojeStr)` com `hojeStr` em formato `pt-BR` — compatível com o formato `"04/06/2026 14:30"` gerado pelo PDV.
- Ajuste manual de estoque registra nova movimentação em `nexoerp.movimentacoes`.

### 🐛 Bugs encontrados

**[ALTO] — Campo `ultimaEntrada` exibido mas nunca gravado**
- **Arquivo:** `estoque.html`, função `renderTable()`, linha ~1246 / `produtos.html`, função `saveProduct()`
- **Problema:** A tabela de estoque renderiza `p.ultimaEntrada` na coluna "Última Entrada". O schema de produto em `produtos.html` (função `saveProduct()`) nunca define nem atualiza o campo `ultimaEntrada` no objeto produto. Nenhum módulo (PDV, ajuste manual em estoque.html) atualiza esse campo ao movimentar estoque.
- **Esperado:** `_saveProdutos()` no PDV e `saveProducts()` no `estoque.html` deveriam atualizar `p.ultimaEntrada = new Date().toLocaleDateString('pt-BR')` em entradas positivas.
- **Observado:** Coluna "Última Entrada" exibe `undefined` para todos os produtos.

---

## Lista Consolidada de Bugs por Prioridade

### CRÍTICO — Corrigir antes de qualquer uso em produção

| # | Módulo | Função | Linha aprox. | Descrição |
|---|--------|--------|-------------|-----------|
| C1 | `financeiro.html` | `renderKPIs()` | ~2224 | KPIs e gráficos hardcoded com demo data — nunca leem `nexoerp.financeiro` |
| C2 | `pdv.html` | `addToCart()` | ~6432 | Flag `vendaSemEstoque` ignorada — produtos com estoque zero sempre bloqueados |
| C3 | `clientes.html` | `saveEntity()` | ~1251 | Campo `limite` salvo como string de dígitos brutos — magnitude 100× errada na exibição |

### ALTO — Corrigir na próxima sprint

| # | Módulo | Função | Linha aprox. | Descrição |
|---|--------|--------|-------------|-----------|
| A1 | `estoque.html` | `renderTable()` | ~1246 | Campo `ultimaEntrada` exibido mas nunca gravado por nenhum módulo |
| A2 | `cadastro.html` + `auth.js` | `finalizar()` / `registerUser()` | ~1186 / ~200 | Campos `telefone`, `cargo`, `cidade`, `funcionarios` coletados e descartados |
| A3 | `financeiro.html` + `pdv.html` | `salvarLancamento()` / `_criarLancamentoFinanceiro()` | — | Dois schemas de campos para lançamentos financeiros — inconsistência estrutural |
| A4 | `pdv.html` | `_SUSP_KEY` | ~5983 | Vendas suspensas em `sessionStorage` — perdidas ao fechar a aba |

### MÉDIO — Planejado para próxima versão

| # | Módulo | Função | Linha aprox. | Descrição |
|---|--------|--------|-------------|-----------|
| M1 | `pdv.html` | `_addMovimentacoes()` | ~5822 | ID de movimentação por `movs.length + 1` — colisão após deleções |
| M2 | `produtos.html` | reset de formulário | — | Cor padrão `#1e2a3a` não está nas swatches — nenhuma swatch selecionada ao editar |
| M3 | `cadastro.html` | `finalizar()` | ~1198 | Nome do plano captura texto do badge span — salvo como "Padrão Popular" |
| M4 | `clientes.html` | `selectTipo()` | — | Label do campo de documento exibe "CPF *" para MEI (máscara/validação corretas para CNPJ) |
| M5 | `pdv.html` | fluxo de onboarding | — | Caixa obrigatório sem guia de onboarding — novo usuário bloqueado sem instrução clara |

### BAIXO — Débito técnico

| # | Módulo | Função | Linha aprox. | Descrição |
|---|--------|--------|-------------|-----------|
| B1 | `clientes.html` | `saveEntity()` | ~1251 | Contadores `compras` e `pedidos` inicializados mas nunca incrementados |
| B2 | `pdv.html` | `_saveProdutos()` | ~5806 | Campo `vendas` do produto nunca incrementado nem persistido |

---

## Notas Arquiteturais

1. **Separação PDV / Pedidos é intencional** — confirmada pelo código. O PDV não linka clientes por ID; o campo `client` na venda armazena CPF para impressão de cupom, não uma referência ao cadastro de clientes. Isso é uma decisão de design, não um bug.

2. **`Date.now()` como ID de entidade** — usado em `produtos.html` e `clientes.html`. Colisão improvável em uso normal (requer dois saves no mesmo milissegundo), mas não seguro para ambientes multi-tab simultâneos.

3. **`nexoerp.pdv.vendas` presente em `DATA_KEYS`** — confirmado na linha 101 de `auth.js`. Não há vazamento de histórico de vendas entre contas.

4. **Estoque e PDV integrados corretamente** — ambos usam `nexoerp.produtos`. O decremento de estoque no PDV reflete imediatamente no módulo de Estoque.

5. **`localStorage` como banco de dados** — sem controle de concorrência. Múltiplas abas do mesmo usuário podem causar race conditions ao gravar simultaneamente em qualquer chave.
