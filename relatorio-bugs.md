# Relatório de Análise do Sistema
**Data:** 2026-06-05
**Ferramenta:** Claude Code — Agente de QA
**Páginas analisadas:** landing.html, login.html, cadastro.html, dashboard.html, clientes.html, produtos.html, estoque.html, financeiro.html, pedidos.html, vendas.html, relatorios.html, configuracoes.html, pdv.html, catalogo.html

---

## Resumo Executivo
- Total de problemas encontrados: **28**
- Críticos: **3** | Médios: **9** | Baixos: **10** | Sugestões: **6**

---

## Problemas por Severidade

### 🔴 CRÍTICO — Quebra funcionalidade principal

| # | Página | Arquivo | Linha | Descrição | Como reproduzir |
|---|--------|---------|-------|-----------|-----------------|
| C1 | dashboard.html | dashboard.html | 2216, 2258, 2421 | **Chave errada no localStorage para identificar o usuário logado.** O código lê `nexoerp.currentUser`, mas o sistema de autenticação salva a sessão em `nexoerp.session` (com estrutura `{ user: { id, name, ... } }`). Resultado: saudação sempre exibe "Usuário" e as config do painel nunca são salvas/carregadas corretamente por usuário. | Fazer login, ir ao dashboard → saudação mostra "Bom dia, Usuário 👋" mesmo com conta salva. |
| C2 | pdv.html | pdv.html | 5906 | **`requirePermission()` não é chamada no PDV.** Todas as outras páginas internas chamam `requirePermission()` logo após `NexoAuth.requireAuth()`. O PDV chama apenas `NexoAuth.requireAuth()`, então um sub-usuário sem permissão `pdv` pode acessar diretamente via URL sem ser redirecionado. | Criar sub-usuário sem permissão PDV → acessar `pdv.html` diretamente → página carrega normalmente. |
| C3 | relatorios.html | relatorios.html | 782 | **Conflito de função `downloadCSV`.** O arquivo `utils.js` já exporta uma função global `downloadCSV(filename, header, rows)` com assinatura de 3 parâmetros (linha 170 de utils.js). A página `relatorios.html` redefine localmente `downloadCSV(filename, rows)` com 2 parâmetros. A versão local sobrescreve a global, mas qualquer chamada interna de outros módulos que use a assinatura de utils.js pode falhar se invocar a de relatorios. | Abrir relatorios.html → verificar no console: a função global `downloadCSV` é substituída pela local com assinatura diferente. |

---

### 🟠 MÉDIO — Funcionalidade comprometida

| # | Página | Arquivo | Linha | Descrição | Como reproduzir |
|---|--------|---------|-------|-----------|-----------------|
| M1 | dashboard.html | dashboard.html | 2335 | **Referência à variável `saldo` fora do escopo.** Em `_renderAlertCard`, a condição `if (cfg.alertas.fluxoNegativo && saldo < 0)` referencia `saldo` — variável calculada em escopo de bloco IIFE acima (linha ~1689), mas não exportada para escopo global. Em "strict mode" ou contexto de IIFE, `saldo` pode ser `undefined`, fazendo o alerta nunca disparar. | Ativar alerta "Fluxo de Caixa Negativo" no painel config → lançar despesas pagas superiores às receitas → alerta nunca aparece. |
| M2 | login.html | login.html | 128–129 | **Fonte `DM Sans` declarada nos inputs mas não carregada.** Os inputs de texto usam `font-family: 'DM Sans', sans-serif` (linhas 128–129), mas o `<head>` do login.html só importa `Inter`. `DM Sans` não é carregada nessa página. O fallback para `sans-serif` funcionará, mas com aparência diferente do esperado. | Abrir `login.html` → inspecionar input → font-family "DM Sans" não está disponível, usa fallback. |
| M3 | cadastro.html | cadastro.html | 1190–1191 | **Botão `btnFinalizar` não existe no HTML.** A função `finalizar()` tenta obter `document.getElementById('btnFinalizar')` para desabilitar o botão durante o envio (linhas 1190–1191), mas o HTML não tem nenhum elemento com esse ID — o botão que aciona `finalizar()` é gerado inline sem ID. O feedback visual de loading nunca ocorre. | Ir ao passo 4 do cadastro → clicar "Criar minha conta" → botão não desabilita nem muda texto durante o processamento. |
| M4 | clientes.html | clientes.html | ~1058 | **`saveData` silencia erro de quota sem feedback adequado.** A linha de catch exibe `showToast('❌ Armazenamento local cheio.')` mas não retorna nem previne a atualização da variável em memória. O usuário pode editar/deletar clientes normalmente mas as mudanças não são persistidas, sem indicação clara de que o dado foi perdido. | Encher o localStorage (>5MB) → salvar cliente → toast aparece mas, na próxima recarga, o dado está perdido. |
| M5 | pedidos.html | pedidos.html | 1766–1767 | **`switchTab` chamado com seletor CSS impreciso.** `document.querySelector('.m-tab')` seleciona o PRIMEIRO elemento `.m-tab` do DOM indiscriminadamente. Se alguma estrutura modal for adicionada antes, o tab errado será ativado durante validação de pedido. | Criar pedido sem cliente → `switchTab(document.querySelector('.m-tab'), 't-dados')` → pode ativar aba errada. |
| M6 | estoque.html | estoque.html | 1194 | **`requirePermission()` não é chamada explicitamente.** Ao contrário das outras páginas internas, estoque.html (e também pdv.html, conforme C2) possui apenas `NexoAuth.requireAuth()`. A diferença entre estoque e pdv é que estoque.html tem `requirePermission()` na linha 1195 — verificação confirma que estoque está correto. (Falso positivo — corrigido.) Este item passa para M6: `configuracoes.html` não valida que o usuário atual tem permissão `configuracoes` antes de exibir o botão de excluir usuários, podendo expor ações destrutivas a sub-usuários com acesso apenas de leitura. | Sub-usuário com permissão `configuracoes` = true → acessa configurações → botão "Excluir" de outros usuários visível. |
| M7 | dashboard.html | dashboard.html | 2252–2265 | **Dupla saudação — `NexoAuth.renderCurrentUser()` e IIFE local conflitam.** `renderCurrentUser()` (auth.js, linha 411) atualiza `#greeting-text` se o padrão `/^Bo[ma] (dia|tarde|noite),/` for encontrado. Logo em seguida, a IIFE local (linha 2253) também reescreve `#greeting-text` usando `nexoerp.currentUser` (chave errada, ver C1). Em sessões novas, `renderCurrentUser()` corre primeiro e funciona; mas a IIFE sobrescreve com "Bom dia, Usuário 👋" logo depois. | Fazer login → dashboard → saudação personalizada é sobrescrita para "Usuário". |
| M8 | relatorios.html | relatorios.html | 714 | **Fallback `downloadCSV` chamado com assinatura errada.** A função `downloadData` (linha 711) tem a lógica: `else downloadCSV(filename, rows)`. A função local recebe `(filename, rows)` onde `rows` é array de arrays (sem header separado). A exportação fica sem cabeçalho nos relatórios quando o formato não é PDF/Excel, pois o cabeçalho deveria ser passado como primeiro argumento de `rows`. | Gerar relatório → exportar CSV → arquivo não tem linha de cabeçalho. |
| M9 | catalogo.html | catalogo.html | — | **Sem autenticação nem controle de permissão.** O catálogo é uma página pública (design intencional conforme sidebar.js `perm: null, newTab: true`), mas lê diretamente `nexoerp.produtos` sem qualquer verificação. Se alguém acessar a URL diretamente com dados de outra sessão, vê o catálogo de outro usuário. Além disso, não há `try/catch` no parse de `nexoerp.catalogo.config` (linha 1228 — apenas o `localStorage.getItem` sem try/catch externo). | Abrir `catalogo.html` diretamente em browser → dados de produtos carregam sem login. |

---

### 🟡 BAIXO — Problema visual ou minor

| # | Página | Arquivo | Linha | Descrição | Como reproduzir |
|---|--------|---------|-------|-----------|-----------------|
| B1 | login.html | login.html | 128 | Fonte `DM Sans` usada em botões (`.btn-login`) mas não carregada. Fallback `sans-serif` genérico. | Inspecionar `.btn-login` no DevTools → font-family calculada não é DM Sans. |
| B2 | dashboard.html | dashboard.html | 148, 193, 311 | **Indentação de `cursor: pointer` fora do alinhamento padrão** (sem espaço de recuo consistente). Não afeta funcionalidade, mas indica código colado de formas diferentes. | Visual apenas. |
| B3 | global.css | global.css | 1357–1372 | **Comentário menciona "DM Sans" como `--font-b`**, mas o `:root` em global.css define `--font-b: 'Inter', sans-serif`. O mapeamento está invertido no comentário (Syne = `--font-h`, Inter = `--font-b`). O comentário diz "DM Sans (--font-b)" — está errado, deveria ser "Inter". Pode causar confusão na manutenção. | Ler o comentário linha 1363 de global.css. |
| B4 | clientes.html | clientes.html | ~300 | **Classe `.mf-left` definida duas vezes** no CSS local (linhas 297 e 318). A segunda definição sobrescreve a primeira — ambas têm apenas `color` e `font-size`, mas com valores idênticos, portanto sem impacto visual. | Inspecionar CSS da página. |
| B5 | todas as páginas internas | sidebar.js | 100 | **Link "Sair" na sidebar sem `href`**. O elemento `<a class="nav-item">` para logout não possui atributo `href`, tornando-o tecnicamente inválido como elemento âncora (semântica incorreta). Funciona via `onclick="NexoAuth.confirmLogout()"`, mas acessibilidade fica comprometida. | Inspecionar o HTML da sidebar no DevTools. |
| B6 | dashboard.html | dashboard.html | 1124 | **Topbar `search-box` é apenas visual** — não tem `<input>` associado nem funcionalidade de busca implementada. O elemento exibe "Buscar clientes, pedidos, produtos…" como texto estático. | Clicar na caixa de busca do dashboard → nenhuma ação ocorre. |
| B7 | todas as páginas internas | global.css | 1542–1554 | **Media query de responsividade cobre apenas `max-width: 700px`** para sidebar e conteúdo. Em telas entre 700px e 900px (tablets landscape), o layout pode ficar com a sidebar em largura completa sobrepondo o conteúdo. | Redimensionar janela para 750px → sidebar pode sobrepor conteúdo principal. |
| B8 | login.html | login.html | 311 | **Label `class="remember"` engloba um `<input type="checkbox">`** cujo `for`/`id` são usados corretamente, mas o label externo sem `for` explícito vinculado pode causar comportamento duplo em alguns browsers (clique no label aciona o checkbox duas vezes). | Clicar no label "Lembrar de mim" em alguns browsers pode toglar duas vezes. |
| B9 | pdv.html | pdv.html | 6004, 6621, 7758 | **Leitura manual de `nexoerp.session`** via `JSON.parse(localStorage.getItem('nexoerp.session') || '{}')` em vez de usar `NexoAuth.getSession()`. Não valida expiração da sessão, podendo usar sessão expirada. | Acessar PDV com sessão expirada → dados do usuário podem ser carregados incorretamente. |
| B10 | configuracoes.html | configuracoes.html | 42, 60 | **Indentação quebrada no CSS interno** — `font-size: 13px` aparece sem recuo correto nas linhas 42 e 60 (dentro de `.btn-save-bar` e `.btn-discard`). Não afeta funcionalidade. | Inspecionar código-fonte. |

---

### 🔵 SUGESTÃO — Melhoria de UX ou código

| # | Página | Descrição | Benefício |
|---|--------|-----------|-----------|
| S1 | todas | Centralizar leitura da sessão usando sempre `NexoAuth.getSession()` em vez de acessar `localStorage` diretamente. Atualmente pdv.html tem 3 acessos diretos. | Consistência, validação de expiração automática, código menos duplicado. |
| S2 | dashboard.html | Remover a IIFE local de saudação (linhas 2252–2265) e confiar apenas em `NexoAuth.renderCurrentUser()`, que já faz a saudação personalizada. Corrigir a chave de usuário de `nexoerp.currentUser` para usar `NexoAuth.getSession().user`. | Elimina lógica duplicada e o bug de saudação (C1/M7). |
| S3 | cadastro.html | Adicionar `id="btnFinalizar"` ao botão de finalizar cadastro (linha 1021) para que o feedback de loading funcione. | Evita confusão do usuário durante o envio assíncrono. |
| S4 | global.css | Adicionar media queries para breakpoints intermediários (768px–900px) para a sidebar e o grid de KPIs. | Melhor experiência em tablets e laptops menores. |
| S5 | todas (sidebar) | Adicionar `href="javascript:void(0)"` ou trocar `<a>` por `<button>` no item "Sair" da sidebar para corrigir semântica. | Acessibilidade e semântica HTML válida. |
| S6 | relatorios.html | Renomear a função local `downloadCSV` para `_downloadCSVLocal` para evitar conflito de nome com `utils.js`. | Clareza e prevenção de bugs futuros quando utils.js for atualizada. |

---

## Análise por Página

### Login
- **Arquivo:** `login.html`
- **Funcionalidades encontradas:** 5
- **Funcionalidades OK:** 4
- **Problemas:** 2
- **Detalhes:** Login com validação, lockout após 5 tentativas, toggle de senha, recuperação de senha em 3 etapas e redirecionamento pós-login funcionam corretamente. Problemas: (1) fonte `DM Sans` usada em inputs e botão mas não carregada; (2) o label "Lembrar de mim" pode toglar o checkbox duas vezes em alguns browsers por herança implícita.

---

### Cadastro
- **Arquivo:** `cadastro.html`
- **Funcionalidades encontradas:** 6
- **Funcionalidades OK:** 5
- **Problemas:** 1
- **Detalhes:** Wizard de 4 passos com validação por etapa, barra de progresso, indicador de força de senha, seleção de plano e tela de sucesso funcionam corretamente. Problema: `btnFinalizar` não existe no HTML, então o estado de loading durante criação de conta não é exibido. Além disso, o page já verifica sessão ativa e mostra modal de aviso ao invés de redirecionar silenciosamente — boa prática implementada.

---

### Dashboard
- **Arquivo:** `dashboard.html`
- **Funcionalidades encontradas:** 12
- **Funcionalidades OK:** 8
- **Problemas:** 4
- **Detalhes:** KPIs financeiros, gráficos de fluxo de caixa, resultado do mês, contas a receber/pagar, faturamento dos últimos 6 meses, despesas por categoria, atividades recentes e ações rápidas todos renderizam corretamente a partir do localStorage. O sistema de configuração do painel (drawer) está bem implementado com drag-and-drop, persistência por usuário e preview em tempo real. Problemas: (1) saudação personalizada quebrada por uso da chave errada `nexoerp.currentUser` em vez da sessão oficial; (2) dupla lógica de saudação em conflito; (3) variável `saldo` fora de escopo no alerta de fluxo negativo; (4) `search-box` na topbar é decorativo sem funcionalidade.

---

### Clientes / Parceiros
- **Arquivo:** `clientes.html`
- **Funcionalidades encontradas:** 10
- **Funcionalidades OK:** 9
- **Problemas:** 1
- **Detalhes:** Abas Clientes/Fornecedores/Vendedores, busca com filtros, tabela paginada, ordenação, CRUD completo com wizard de 4 passos, export CSV, KPIs de contagem e painel de detalhes funcionam bem. Problema: classe `.mf-left` duplicada no CSS (menor).

---

### Produtos
- **Arquivo:** `produtos.html`
- **Funcionalidades encontradas:** 8
- **Funcionalidades OK:** 8
- **Problemas:** 0
- **Detalhes:** ✅ CRUD de produtos com abas (info, preço, estoque, fotos), visualização em tabela e grid, filtros de categoria, status e busca, export CSV e painel de detalhes lateral estão todos implementados corretamente com tratamento de erros no localStorage.

---

### Estoque
- **Arquivo:** `estoque.html`
- **Funcionalidades encontradas:** 9
- **Funcionalidades OK:** 9
- **Problemas:** 0
- **Detalhes:** ✅ KPIs de estoque, alertas de produto crítico/baixo, tabela filtrada com paginação, registro de movimentações (entrada/saída/ajuste), gestão de depósitos, gráficos de distribuição, tudo com try/catch adequado no localStorage.

---

### Financeiro
- **Arquivo:** `financeiro.html`
- **Funcionalidades encontradas:** 8
- **Funcionalidades OK:** 8
- **Problemas:** 0
- **Detalhes:** ✅ Lançamentos de receitas/despesas, KPIs financeiros, filtros por período e tipo, wizard de criação com parcelas, gráfico de fluxo, contas a receber/pagar e export CSV implementados corretamente.

---

### Pedidos de Vendas
- **Arquivo:** `pedidos.html`
- **Funcionalidades encontradas:** 9
- **Funcionalidades OK:** 8
- **Problemas:** 1
- **Detalhes:** Kanban e lista de pedidos, criação com wizard de 4 abas (dados, itens, pagamento, resumo), edição, mudança de status, cálculo de parcelas e detalhes do pedido funcionam. Problema: `switchTab` com seletor CSS impreciso que pode ativar aba errada durante validação.

---

### Vendas
- **Arquivo:** `vendas.html`
- **Funcionalidades encontradas:** 7
- **Funcionalidades OK:** 7
- **Problemas:** 0
- **Detalhes:** ✅ Histórico de vendas do PDV com filtros de período customizável (date picker), KPIs, exportação CSV, detalhes laterais e funcionalidade de estorno implementados corretamente.

---

### Relatórios
- **Arquivo:** `relatorios.html`
- **Funcionalidades encontradas:** 6
- **Funcionalidades OK:** 4
- **Problemas:** 2
- **Detalhes:** Catálogo de relatórios com filtros por categoria, modal de geração com seleção de período e formato funcionam. Problemas: (1) função `downloadCSV` local redefinida com assinatura diferente da global de utils.js; (2) exportação CSV perde o cabeçalho por chamada incorreta.

---

### Configurações
- **Arquivo:** `configuracoes.html`
- **Funcionalidades encontradas:** 8
- **Funcionalidades OK:** 7
- **Problemas:** 1
- **Detalhes:** Dados da empresa, perfil do usuário, sub-usuários (add/edit/delete com permissões granulares), personalização visual e export/import de dados funcionam. Problema: botões destrutivos de sub-usuários visíveis a qualquer usuário com acesso à página, sem verificação de nível admin.

---

### PDV
- **Arquivo:** `pdv.html`
- **Funcionalidades encontradas:** 15
- **Funcionalidades OK:** 13
- **Problemas:** 2
- **Detalhes:** PDV completo com carrinho, busca de produtos, adição por código, desconto percentual, múltiplas formas de pagamento (dinheiro com cálculo de troco, cartão, pix, crediário), abertura/fechamento de caixa, vendas suspensas, NFC-e (stub), estorno de vendas e histórico do dia funcionam. Problemas: (1) ausência de `requirePermission()` — sub-usuários sem permissão PDV podem acessar via URL direta; (2) leitura manual de `nexoerp.session` em 3 pontos sem verificação de expiração.

---

### Catálogo
- **Arquivo:** `catalogo.html`
- **Funcionalidades encontradas:** 5
- **Funcionalidades OK:** 4
- **Problemas:** 1
- **Detalhes:** Renderização de catálogo público com filtros por categoria, busca, diferentes layouts e configuração visual (cores, fontes, background) funcionam. Problema: página pública que lê dados do localStorage sem autenticação — design intencional mas sem isolamento de dados por usuário.

---

### Landing
- **Arquivo:** `landing.html`
- **Funcionalidades encontradas:** 3
- **Funcionalidades OK:** 3
- **Problemas:** 0
- **Detalhes:** ✅ Página de marketing estática com links para login e cadastro. Sem problemas identificados.

---

## Trechos de Código com Problema

### Bug C1 — Chave errada no localStorage para usuário logado (dashboard.html)

```javascript
// PROBLEMA (linhas 2216, 2258, 2421 de dashboard.html):
const u = JSON.parse(localStorage.getItem('nexoerp.currentUser') || '{}');
// 'nexoerp.currentUser' NÃO EXISTE — o sistema usa 'nexoerp.session'

// CORREÇÃO SUGERIDA:
// Usar a API oficial já disponível no projeto:
const session = NexoAuth.getSession();
const u = session ? session.user : {};
// OU, na IIFE de saudação (linha 2252-2265), remover completamente
// e deixar apenas o NexoAuth.renderCurrentUser() que já faz isso corretamente.
```

---

### Bug C2 — `requirePermission()` ausente no PDV (pdv.html)

```javascript
// PROBLEMA (linha 5906 de pdv.html):
NexoAuth.requireAuth();
// requirePermission() NÃO É CHAMADA — sub-usuários sem permissão 'pdv' acessam livremente

// CORREÇÃO SUGERIDA (adicionar linha 5907):
NexoAuth.requireAuth();
requirePermission(); // ← adicionar esta linha
```

---

### Bug C3 / M8 — Conflito de `downloadCSV` (relatorios.html vs utils.js)

```javascript
// utils.js (linha 170) — assinatura com 3 parâmetros:
function downloadCSV(filename, header, rows) { ... }

// PROBLEMA (linha 782 de relatorios.html) — redefine com 2 parâmetros:
function downloadCSV(filename, rows) { ... }
// Isso sobrescreve a função global e perde o cabeçalho na exportação.

// CORREÇÃO SUGERIDA em relatorios.html:
// Renomear para evitar conflito:
function _downloadRelCSV(filename, rows) { ... }
// E atualizar a chamada na linha 714:
else _downloadRelCSV(filename, rows);
```

---

### Bug M1 — Variável `saldo` fora de escopo em `_renderAlertCard` (dashboard.html)

```javascript
// PROBLEMA (linha 2335 de dashboard.html):
if (cfg.alertas.fluxoNegativo && saldo < 0) {
// 'saldo' foi calculado numa IIFE acima e NÃO está no escopo global

// CORREÇÃO SUGERIDA — recalcular inline:
if (cfg.alertas.fluxoNegativo) {
  const todasRecP  = financeiro.filter(l => l.tipo === 'receita' && l.status === 'pago');
  const todasDespP = financeiro.filter(l => l.tipo === 'despesa' && l.status === 'pago');
  const saldoAtual = todasRecP.reduce((s, l) => s + (l.valor || 0), 0)
                   - todasDespP.reduce((s, l) => s + (l.valor || 0), 0);
  if (saldoAtual < 0) alertList.push({ ... });
}
```

---

### Bug M3 — Botão sem ID para feedback de loading (cadastro.html)

```html
<!-- PROBLEMA (linha 1021 de cadastro.html) — botão sem ID: -->
<button class="btn-next" onclick="finalizar()">
  <i class="bi bi-rocket-takeoff"></i> Criar minha conta
</button>

<!-- CORREÇÃO SUGERIDA — adicionar id="btnFinalizar": -->
<button id="btnFinalizar" class="btn-next" onclick="finalizar()">
  <i class="bi bi-rocket-takeoff"></i> Criar minha conta
</button>
```

---

## Checklist Geral

### HTML
- [x] Tags corretamente aninhadas — ✅ Nenhuma tag mal aninhada encontrada
- [x] Links internos válidos — ✅ Todos os `href` internos apontam para arquivos existentes
- [x] IDs únicos por página — ✅ Nenhum ID duplicado encontrado nas páginas analisadas
- [x] Inputs com labels — ✅ Todos os inputs têm labels associadas
- [ ] Botões com texto/aria-label — ⚠️ Link "Sair" na sidebar sem `href` (B5)

### CSS
- [x] Variáveis CSS declaradas no :root — ✅ Todas as variáveis usadas estão declaradas
- [ ] Responsividade (media queries) — ⚠️ Cobertura insuficiente para 700px–900px (B7)
- [x] Contraste adequado — ✅ Esquema de cores dark com contraste adequado

### JavaScript
- [ ] Sem funções indefinidas chamadas — ⚠️ `requirePermission()` ausente no PDV (C2)
- [ ] Queries de DOM verificadas — ⚠️ `getElementById('btnFinalizar')` retorna null (M3); seletor impreciso em pedidos.html (M5)
- [x] localStorage com tratamento de erro — ✅ A maioria dos acessos tem try/catch; utils.js e auth.js têm tratamento robusto
- [ ] Sem variáveis desnecessárias — ⚠️ `saldo` fora de escopo em dashboard (M1); `nexoerp.currentUser` chave inexistente (C1)

### UX
- [x] Feedback visual em ações — ✅ Toasts implementados em todas as páginas, loading em forms
- [x] Mensagens de erro em português — ✅ Todas as mensagens estão em pt-BR
- [x] Cursor pointer em clicáveis — ✅ CSS define `cursor: pointer` nos elementos interativos
- [ ] Fontes com fallback — ⚠️ `DM Sans` usada em login.html sem ser carregada (M2, B1)

---

## Próximos Passos Recomendados

1. **[CRÍTICO]** Corrigir a chave `nexoerp.currentUser` para usar `NexoAuth.getSession().user` no dashboard.html (ou remover a IIFE duplicada de saudação e usar apenas `renderCurrentUser()`).
2. **[CRÍTICO]** Adicionar `requirePermission()` após `NexoAuth.requireAuth()` no pdv.html (linha 5907).
3. **[CRÍTICO]** Renomear a função local `downloadCSV` em relatorios.html para `_downloadRelCSV` e corrigir a chamada para incluir cabeçalho na exportação.
4. **[MÉDIO]** Corrigir o escopo da variável `saldo` em `_renderAlertCard` no dashboard, recalculando o valor inline.
5. **[MÉDIO]** Adicionar `id="btnFinalizar"` ao botão de criar conta em cadastro.html.
6. **[MÉDIO]** Adicionar `<link href="...DM+Sans...">` ao `<head>` de login.html e cadastro.html para carregar a fonte usada nos inputs e botões.
7. **[MÉDIO]** Substituir os acessos diretos a `nexoerp.session` em pdv.html por `NexoAuth.getSession()` para garantir validação de expiração.
8. **[BAIXO]** Adicionar `href="javascript:void(0)"` ou trocar `<a>` por `<button>` no item "Sair" da sidebar (sidebar.js).
9. **[BAIXO]** Ampliar as media queries em global.css para cobrir 700px–900px.
10. **[SUGESTÃO]** Implementar a funcionalidade de busca global na topbar do dashboard (atualmente apenas decorativa).
