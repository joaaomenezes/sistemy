# RELATÓRIO DE AUDITORIA — NexoERP (Sistemy)

**Data:** 2026-06-02  
**Auditor:** Claude Sonnet 4.6 (Engenheiro Sênior)  
**Escopo:** Auditoria completa de todos os arquivos do projeto  
**Stack:** HTML/CSS/JS puro · localStorage · Sem framework · Sem backend real

---

## 🔴 BLOCO 1 — BUGS CONFIRMADOS

---

### BUG 1 — ERRO SINTÁTICO NO SQL (`database/schema.sql` linha 55)

**Status:** CONFIRMADO ❌  
**Severidade:** Crítica — impede execução do schema inteiro

A linha `vendedor_id INTEGER REFERENCES usuarios(id)` está sem vírgula final antes de `observacoes TEXT`. Qualquer cliente SQL (PostgreSQL, DBeaver, etc.) rejeitará o arquivo inteiro.

**Código atual (linha 54–57):**
```sql
  limite_credito     DECIMAL(10,2) DEFAULT 0,
  vendedor_id INTEGER REFERENCES usuarios(id)
  observacoes        TEXT,
```

**Correção:**
```sql
  limite_credito     DECIMAL(10,2) DEFAULT 0,
  vendedor_id        INTEGER REFERENCES usuarios(id),
  observacoes        TEXT,
```

---

### BUG 2 — CHAVE localStorage ERRADA NO SIDEBAR (`sidebar.js` linha 44)

**Status:** CONFIRMADO ❌  
**Severidade:** Alta — sidebar sempre mostra "Usuário / Administrador" genérico

`sidebar.js` lê `nexoerp.user` (chave fantasma — nunca é gravada em lugar algum do projeto). `auth.js` salva a sessão em `nexoerp.session` com estrutura `{ user, createdAt, expiresAt }`.

**Código atual:**
```js
const user = JSON.parse(localStorage.getItem('nexoerp.user') || '{}');
```

**Correção:**
```js
const session = JSON.parse(localStorage.getItem('nexoerp.session') || '{}');
const user = session?.user || {};
```

A linha 47 também deve ser corrigida:
```js
// ATUAL (quebrado):
const userInitials = userName.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase();

// CORRETO (usando a função já disponível em auth.js):
const userInitials = (user.name || 'U').split(' ').filter(Boolean).map(n => n[0]).join('').substring(0,2).toUpperCase();
```

---

### BUG 3 — PREFIXO INCONSISTENTE NAS CHAVES localStorage

**Status:** CONFIRMADO ❌  
**Severidade:** Alta — dados não são encontrados entre módulos

Mapeamento completo de todas as chaves encontradas:

| Chave | Arquivo | Status |
|---|---|---|
| `nexoerp.users` | auth.js, configuracoes.html | ✅ Correto |
| `nexoerp.session` | auth.js | ✅ Correto |
| `nexoerp.demo_removed` | auth.js, configuracoes.html | ✅ Correto |
| `nexoerp.config` | configuracoes.html | ✅ Correto |
| `nexoerp.pedidos` | pedidos.html | ✅ Correto |
| `nexoerp.vendas` | pedidos.html, vendas.html | ✅ Correto |
| `nexoerp.financeiro` | financeiro.html | ✅ Correto |
| `nexoerp.pdv.config` | pdv.html | ✅ Correto |
| `nexoerp.pdv.caixa` | pdv.html | ✅ Correto |
| `nexoerp.user` | sidebar.js | ❌ Chave fantasma — nunca gravada |
| `sistemy.produtos` | produtos.html, catalogo.html | ❌ Prefixo errado |
| `catalogo-cfg` | catalogo.html | ❌ Sem prefixo algum |

**Correções necessárias:**

**`produtos.html` linha 1204:**
```js
// ATUAL:
const PRODUTOS_KEY = 'sistemy.produtos';

// CORRETO:
const PRODUTOS_KEY = 'nexoerp.produtos';
```

**`catalogo.html` linha 901:**
```js
// ATUAL:
const raw = localStorage.getItem('sistemy.produtos');

// CORRETO:
const raw = localStorage.getItem('nexoerp.produtos');
```

**`catalogo.html` linhas 1229 e 1234:**
```js
// ATUAL:
localStorage.setItem('catalogo-cfg', JSON.stringify(cfg));
const raw = localStorage.getItem('catalogo-cfg');

// CORRETO:
localStorage.setItem('nexoerp.catalogo.config', JSON.stringify(cfg));
const raw = localStorage.getItem('nexoerp.catalogo.config');
```

> **ATENÇÃO:** Após renomear `sistemy.produtos` para `nexoerp.produtos`, usuários que já têm dados salvos perderão o catálogo. Implemente uma migração one-shot no init de `produtos.html`:
> ```js
> const legado = localStorage.getItem('sistemy.produtos');
> if (legado) {
>   localStorage.setItem('nexoerp.produtos', legado);
>   localStorage.removeItem('sistemy.produtos');
> }
> ```

---

### BUG 4 — FUNÇÃO `initials()` DUPLICADA

**Status:** CONFIRMADO ❌  
**Severidade:** Média — risco de comportamento divergente + code smell

Duas implementações diferentes coexistem:

**`utils.js` linha 78 (versão insegura):**
```js
function initials(name) {
  const w = (name || '').trim().split(' ');
  return (w[0][0] + (w[1]?.[0] || '')).toUpperCase();
  // BUG: se name = '' ou '   ', w = [''], e w[0][0] = undefined → TypeError
}
```

**`auth.js` linha 33 (versão segura — MANTER ESTA):**
```js
function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'NX';
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
}
```

**Correção em `utils.js` — substituir a função existente:**
```js
function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'NX';
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
}
```

A função de `auth.js` pode permanecer encapsulada no IIFE (correto para uso interno). A versão de `utils.js` deve ser a canônica para uso nas páginas.

---

### BUG 5 — SAUDAÇÃO HARDCODED NO DASHBOARD (`dashboard.html` linha 950)

**Status:** CONFIRMADO ❌  
**Severidade:** Média — UX ruim + dados incorretos sempre visíveis

**Problema em `dashboard.html` linha 950:**
```html
<h1>Bom dia, João 👋</h1>
```

**Problema em `auth.js` linha 172–175:**
```js
// Regex só detecta "Bom dia," — não muda para "Boa tarde" ou "Boa noite"
if (greeting && /^Bom dia,/.test(greeting.textContent.trim())) {
  greeting.textContent = `Bom dia, ${user.name.split(' ')[0] || user.name}`;
}
```

**Duplo problema:**
- a) A saudação nunca muda para "Boa tarde" / "Boa noite" conforme o horário
- b) O emoji 👋 é removido pela substituição via `textContent`
- c) Se `renderCurrentUser()` rodar antes do DOM estar pronto, o `querySelector` retorna null

**Correção no HTML (`dashboard.html` linha 950):**
```html
<h1 id="greeting-text">Bom dia, Usuário 👋</h1>
```

**Correção no JS (ao final de `dashboard.html`, dentro do bloco `<script>`):**
```js
document.addEventListener('DOMContentLoaded', function() {
  NexoAuth.requireAuth();
  NexoAuth.renderCurrentUser();

  const session = NexoAuth.getSession();
  if (session) {
    const h = new Date().getHours();
    const period = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
    const firstName = session.user.name.split(' ')[0] || session.user.name;
    const el = document.getElementById('greeting-text');
    if (el) el.textContent = `${period}, ${firstName} 👋`;
  }
});
```

**Atualizar `auth.js` `renderCurrentUser()` para suportar variação por horário:**
```js
function getGreeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}

// Na função renderCurrentUser(), substituir a lógica de saudação:
const greeting = document.querySelector('.page-header h1, .header-title h1, #greeting-text');
if (greeting && /^Bo[ma]\s+(dia|tarde|noite),/.test(greeting.textContent.trim())) {
  const firstName = user.name.split(' ')[0] || user.name;
  greeting.textContent = `${getGreeting()}, ${firstName} 👋`;
}
```

---

### BUG 6 — SENHA EM TEXTO CLARO (`auth.js`)

**Status:** CONFIRMADO ❌  
**Severidade:** Alta (para produção) / Aceitável (para demo local)

**Evidências:**
- `auth.js` linha 10: `password: 'admin123'` — demo user com senha literal
- `auth.js` linha 100: `password: data.password` — senha salva sem hash

**Correção com SubtleCrypto (SHA-256):**

```js
// Adicionar função assíncrona de hash:
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Atualizar registerUser() para ser async:
async function registerUser(data) {
  // ...validações...
  const user = {
    // ...outros campos...
    password: await hashPassword(data.password),
    // ...
  };
  // ...
}

// Atualizar login() para ser async:
async function login(identifier, password, remember) {
  const hashedInput = await hashPassword(password);
  const user = getUsers().find(item =>
    normalize(item.email) === needle || normalize(item.username) === needle
  );
  if (!user || user.password !== hashedInput) {
    return { ok: false, message: 'Usuário ou senha incorretos.' };
  }
  // ...
}
```

> **NOTA:** Por ser frontend-only, SHA-256 é inseguro contra força-bruta offline (dados visíveis no localStorage). Para produção real, usar bcrypt em backend. SHA-256 é uma melhoria mínima aceitável para demonstração.

---

### BUG 7 — BADGE ESTÁTICO NO MENU (`sidebar.js` linha 6)

**Status:** CONFIRMADO ❌  
**Severidade:** Baixa — UX enganosa, dado nunca reflete a realidade

**Código atual:**
```js
{ label: 'Vendas', href: 'vendas.html', icon: 'bi-cart4', section: 'Principal', badge: '12' },
```

**Correção — remover badge hardcoded ou calcular dinamicamente:**
```js
// Opção 1: remover badge (mais simples)
{ label: 'Vendas', href: 'vendas.html', icon: 'bi-cart4', section: 'Principal' },

// Opção 2: calcular a partir do localStorage
const vendasHoje = (() => {
  try {
    const vendas = JSON.parse(localStorage.getItem('nexoerp.vendas') || '[]');
    const hoje = new Date().toDateString();
    return vendas.filter(v => new Date(v.data || v.createdAt).toDateString() === hoje).length || null;
  } catch (_) { return null; }
})();

// No array MENU:
{ label: 'Vendas', href: 'vendas.html', icon: 'bi-cart4', section: 'Principal',
  badge: vendasHoje ? String(vendasHoje) : undefined },
```

---

## 🟠 BLOCO 2 — CÓDIGO MORTO E ARQUIVOS INCOMPLETOS

---

### ITEM 8 — MÓDULOS DO SIDEBAR SEM PÁGINA REAL (`sidebar.js`)

**Status:** CONFIRMADO ⚠️  
Os seguintes 4 itens de menu apontam para `href="#"` e nunca foram implementados:

| Label | Section | href |
|---|---|---|
| Relatórios | Financeiro | `#` |
| Fiscal / NF-e | Financeiro | `#` |
| Parceiros | Sistema | `#` |
| WhatsApp | Integrações | `#` |

**Correção recomendada — marcar como "Em breve" com visual diferenciado:**

```js
// Adicionar campo `comingSoon: true` nos itens:
{ label: 'Relatórios', href: '#', icon: 'bi-graph-up-arrow', section: 'Financeiro', comingSoon: true },

// Na geração do HTML, detectar o campo:
const disabled = item.comingSoon ? 'disabled' : '';
const badge    = item.comingSoon
  ? `<span class="badge badge-soon">Em breve</span>`
  : item.badge ? `<span class="badge">${item.badge}</span>` : '';

return `
  <a href="${item.comingSoon ? '#' : item.href}"
     ${target}
     class="nav-item ${active} ${disabled}"
     ${item.comingSoon ? 'onclick="return false" title="Módulo em desenvolvimento"' : ''}>
    <i class="bi ${item.icon}"></i>
    <span class="nav-label">${item.label}</span>
    ${badge}
  </a>`;
```

**CSS adicional no `global.css`:**
```css
.nav-item.disabled { opacity: 0.45; cursor: not-allowed; pointer-events: none; }
.badge-soon { background: var(--warn); font-size: 9px; padding: 2px 6px; border-radius: 8px; }
```

---

### ITEM 9 — PDV.HTML SEM `sidebar.js`

**Status:** CONFIRMADO ⚠️  
**Impacto:** Qualquer alteração no menu deve ser feita em dois lugares (sidebar.js + pdv.html inline)

`pdv.html` tem sidebar próprio embutido com CSS e HTML duplicados (~200 linhas). Não carrega `sidebar.js` nem tem elemento `#sidebar-root`.

**Verificação:** `grep -n "sidebar-root\|sidebar\.js" pdv.html` → sem resultado.

**Solução recomendada:** Adicionar no `pdv.html` antes do `</body>`:
```html
<div id="sidebar-root"></div>
<script src="sidebar.js"></script>
```
E remover o bloco de sidebar inline. Requer ajuste de CSS para alinhar o layout do PDV com o sidebar externo.

---

### ITEM 10 — CATALOGO.HTML ISOLADO

**Status:** CONFIRMADO ⚠️  

`catalogo.html` não carrega nenhum script compartilhado:
- ❌ Sem `auth.js`
- ❌ Sem `utils.js`
- ❌ Sem `sidebar.js`
- ❌ Sem `requireAuth()` — qualquer pessoa acessa sem login

**Decisão necessária (consultar o dono do produto):**

**Opção A — Página pública (catálogo para clientes):**
```html
<!-- Adicionar comentário no topo de catalogo.html: -->
<!--
  PÁGINA PÚBLICA — acesso sem autenticação intencional.
  Exibe produtos ativos para visualização externa (clientes, vendedores externos).
  Configuração em: configuracoes.html > aba "Catálogo"
  Dados lidos de: localStorage['nexoerp.produtos'] (read-only)
-->
```

**Opção B — Página interna (requer login):**
```html
<script src="auth.js"></script>
<script>NexoAuth.requireAuth();</script>
```

Dado o contexto (possui página de configuração de tema e logo), a **Opção A parece ser a intenção correta** — mas deve ser documentada.

---

### ITEM 11 — CADASTRO.HTML SEM `sidebar.js`

**Status:** VERIFICADO ✅ (intencional)

`cadastro.html` carrega `utils.js` e `auth.js`, mas não `sidebar.js`. **Isso é correto**: é a página de onboarding/registro de novos usuários, acessada antes do login, portanto não deve ter sidebar de navegação interna.

Não requer correção.

---

### ITEM 12 — DATABASE/SCHEMA.SQL INCOMPLETO

**Status:** CONFIRMADO 🚧  

O schema define apenas 5 tabelas. As seguintes entidades existem no frontend e estão ausentes:

```sql
-- Pedidos de venda
CREATE TABLE pedidos (
  id            SERIAL PRIMARY KEY,
  empresa_id    INTEGER REFERENCES empresas(id) NOT NULL,
  cliente_id    INTEGER REFERENCES clientes(id),
  vendedor_id   INTEGER REFERENCES usuarios(id),
  status        VARCHAR(30) NOT NULL DEFAULT 'rascunho',
  condicao_pgto VARCHAR(100),
  desconto      NUMERIC(10,2) DEFAULT 0,
  total         NUMERIC(12,2) NOT NULL DEFAULT 0,
  observacoes   TEXT,
  criado_em     TIMESTAMP DEFAULT NOW(),
  atualizado_em TIMESTAMP DEFAULT NOW()
);

CREATE TABLE itens_pedido (
  id          SERIAL PRIMARY KEY,
  pedido_id   INTEGER REFERENCES pedidos(id) ON DELETE CASCADE NOT NULL,
  produto_id  INTEGER REFERENCES produtos(id),
  descricao   VARCHAR(200),
  quantidade  NUMERIC(10,3) NOT NULL,
  preco_unit  NUMERIC(10,2) NOT NULL,
  desconto    NUMERIC(5,2) DEFAULT 0,
  total       NUMERIC(12,2) NOT NULL
);

-- Vendas (PDV — fechamento de caixa)
CREATE TABLE vendas (
  id            SERIAL PRIMARY KEY,
  empresa_id    INTEGER REFERENCES empresas(id) NOT NULL,
  pedido_id     INTEGER REFERENCES pedidos(id),
  operador_id   INTEGER REFERENCES usuarios(id),
  forma_pgto    VARCHAR(50) NOT NULL,
  total         NUMERIC(12,2) NOT NULL,
  troco         NUMERIC(10,2) DEFAULT 0,
  status        VARCHAR(30) DEFAULT 'concluida',
  criado_em     TIMESTAMP DEFAULT NOW()
);

CREATE TABLE itens_venda (
  id          SERIAL PRIMARY KEY,
  venda_id    INTEGER REFERENCES vendas(id) ON DELETE CASCADE NOT NULL,
  produto_id  INTEGER REFERENCES produtos(id),
  quantidade  NUMERIC(10,3) NOT NULL,
  preco_unit  NUMERIC(10,2) NOT NULL,
  total       NUMERIC(12,2) NOT NULL
);

-- Movimentações de estoque
CREATE TABLE movimentacoes_estoque (
  id          SERIAL PRIMARY KEY,
  empresa_id  INTEGER REFERENCES empresas(id) NOT NULL,
  produto_id  INTEGER REFERENCES produtos(id) NOT NULL,
  tipo        VARCHAR(20) CHECK (tipo IN ('entrada','saida','transferencia','ajuste')) NOT NULL,
  quantidade  NUMERIC(10,3) NOT NULL,
  deposito    VARCHAR(100),
  destino     VARCHAR(100),
  motivo      TEXT,
  operador_id INTEGER REFERENCES usuarios(id),
  criado_em   TIMESTAMP DEFAULT NOW()
);

-- Lançamentos financeiros
CREATE TABLE lancamentos_financeiros (
  id           SERIAL PRIMARY KEY,
  empresa_id   INTEGER REFERENCES empresas(id) NOT NULL,
  tipo         VARCHAR(10) CHECK (tipo IN ('receita','despesa')) NOT NULL,
  categoria    VARCHAR(100),
  descricao    VARCHAR(255) NOT NULL,
  valor        NUMERIC(12,2) NOT NULL,
  vencimento   DATE,
  pago_em      DATE,
  status       VARCHAR(20) DEFAULT 'pendente',
  forma_pgto   VARCHAR(50),
  cliente_id   INTEGER REFERENCES clientes(id),
  criado_em    TIMESTAMP DEFAULT NOW()
);

-- Configurações por empresa
CREATE TABLE configuracoes (
  id           SERIAL PRIMARY KEY,
  empresa_id   INTEGER REFERENCES empresas(id) NOT NULL UNIQUE,
  chave        VARCHAR(100) NOT NULL,
  valor        TEXT,
  atualizado_em TIMESTAMP DEFAULT NOW()
);

-- Caixa PDV (abertura/fechamento)
CREATE TABLE caixas (
  id            SERIAL PRIMARY KEY,
  empresa_id    INTEGER REFERENCES empresas(id) NOT NULL,
  operador_id   INTEGER REFERENCES usuarios(id) NOT NULL,
  fundo_inicial NUMERIC(10,2) DEFAULT 0,
  total_vendas  NUMERIC(12,2) DEFAULT 0,
  aberto_em     TIMESTAMP DEFAULT NOW(),
  fechado_em    TIMESTAMP,
  status        VARCHAR(20) DEFAULT 'aberto'
);
```

---

## 🟡 BLOCO 3 — MELHORIAS DE ARQUITETURA E QUALIDADE

---

### ITEM 13 — ACOPLAMENTO ALTO: LÓGICA NOS HTMLs

| Arquivo | Linhas | Funções JS | Situação |
|---|---|---|---|
| pdv.html | 7.667 | 121 | Crítico |
| financeiro.html | 3.213 | 44 | Alto |
| configuracoes.html | 1.695 | 22 | Médio |
| estoque.html | 1.477 | 23 | Médio |

**Recomendação para pdv.html:** Extrair para `pdv.js` e `pdv.css`. O HTML deve ter apenas estrutura.

---

### ITEM 14 — AUSÊNCIA DE VALIDAÇÃO NO FRONTEND

**Estado atual por módulo:**
- `utils.js`: Tem máscaras (`maskCPF`, `maskCNPJ`, `maskPhone`, `maskCEP`) mas **nenhuma validação de dígito verificador**
- `clientes.html`: Dados são hardcoded (array em memória), sem persistência em localStorage
- `estoque.html`: Dados são hardcoded (array em memória), sem persistência em localStorage
- `produtos.html`: Tem localStorage mas não valida campos obrigatórios antes do submit

**Validador de CPF a adicionar em `utils.js`:**
```js
function validarCPF(cpf) {
  const n = cpf.replace(/\D/g, '');
  if (n.length !== 11 || /^(\d)\1{10}$/.test(n)) return false;
  let s = 0;
  for (let i = 0; i < 9; i++) s += +n[i] * (10 - i);
  let r = (s * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  if (r !== +n[9]) return false;
  s = 0;
  for (let i = 0; i < 10; i++) s += +n[i] * (11 - i);
  r = (s * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  return r === +n[10];
}

function validarCNPJ(cnpj) {
  const n = cnpj.replace(/\D/g, '');
  if (n.length !== 14 || /^(\d)\1{13}$/.test(n)) return false;
  const calc = (len) => {
    let s = 0, pos = len - 7;
    for (let i = len; i >= 1; i--) {
      s += +n[len - i] * pos--;
      if (pos < 2) pos = 9;
    }
    return s % 11 < 2 ? 0 : 11 - (s % 11);
  };
  return calc(12) === +n[12] && calc(13) === +n[13];
}
```

---

### ITEM 15 — SEM TRATAMENTO DE ERRO EM LOCALSTORAGE

**`auth.js` `writeJSON()` linha 25–27 — sem try/catch:**
```js
// ATUAL (vai silenciosamente lançar QuotaExceededError):
function writeJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

// CORRETO:
function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    if (err.name === 'QuotaExceededError') {
      console.error('[NexoERP] localStorage cheio — não foi possível salvar:', key);
      // Notificar usuário se possível
      if (typeof showToast === 'function') {
        showToast('❌ Armazenamento local cheio. Exporte seus dados.', 'error');
      }
    }
    return false;
  }
}
```

> `pedidos.html` e `vendas.html` já têm try/catch nos seus `setItem` — padrão correto, mas `auth.js` precisa ser atualizado.

---

### ITEM 16 — SEM MULTI-EMPRESA NO AUTH

O `demoUser` tem `company: 'NexoERP Demo'` hardcoded. O schema SQL tem `empresas` com multi-tenancy. O frontend não filtra dados por `empresa_id` — todas as chaves de localStorage são globais por domínio.

**Estratégia recomendada (sem backend):**
```js
// Prefixo dinâmico por empresa:
const EMPRESA_ID = getSession()?.user?.companyId || 'default';
const PRODUTOS_KEY = `nexoerp.${EMPRESA_ID}.produtos`;
```

Esta mudança é invasiva e requer refatoração em todos os módulos. Registrar como dívida técnica.

---

### ITEM 17 — AUSÊNCIA DE PAGINAÇÃO

**Estado atual:**
- `clientes.html`: ✅ Tem paginação (perPage = 6)
- `estoque.html`: ✅ Tem paginação (perPage = 8)
- `produtos.html`: ✅ Tem paginação (perPage = 8)
- `pedidos.html`: ✅ Tem paginação
- `vendas.html`: ✅ Tem paginação
- `financeiro.html`: ⚠️ Sem paginação visível nas listagens de lançamentos
- `configuracoes.html`: ⚠️ Lista todos os usuários sem limite

Paginação está bem implementada na maioria dos módulos. Pendente em financeiro e configuracoes.

---

### ITEM 18 — SAUDAÇÃO NÃO VARIA POR PERÍODO DO DIA

**`auth.js` linha 174 — sempre "Bom dia":**
```js
// ATUAL:
greeting.textContent = `Bom dia, ${user.name.split(' ')[0] || user.name}`;

// CORRETO:
function getGreeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}
greeting.textContent = `${getGreeting()}, ${user.name.split(' ')[0] || user.name} 👋`;
```

---

### ITEM 19 — FALTA DE FEEDBACK VISUAL EM OPERAÇÕES

Nenhuma página exibe spinner ou skeleton loader durante operações de parse/save. Para o volume atual de dados (localStorage) isso é aceitável, mas se o volume crescer (ex: 10k vendas no JSON) pode causar travamentos perceptíveis.

**Recomendação:** Adicionar wrapper de loading em operações críticas:
```js
function withLoading(fn) {
  document.body.style.cursor = 'wait';
  requestAnimationFrame(() => {
    try { fn(); } finally { document.body.style.cursor = ''; }
  });
}
```

---

### ITEM 20 — GLOBAL.CSS MONOLÍTICO (1.438 linhas)

O arquivo mistura tokens, reset, layout de sidebar, componentes de formulário, badges, toasts e animações em um único bloco. Para o tamanho atual do projeto é gerenciável, mas está crescendo.

**Recomendação (se projeto crescer):** Separar em:
- `tokens.css` — variáveis CSS (`:root`)
- `layout.css` — sidebar, main content, grid
- `components.css` — cards, badges, botões, toasts, modals
- `utilities.css` — helpers de espaçamento, visibilidade

---

## 🔵 BLOCO 4 — SEGURANÇA

---

### ITEM 21 — XSS: INSERÇÃO DE HTML SEM SANITIZAÇÃO

**Status:** RISCO PRESENTE ⚠️

Dados provenientes do localStorage são inseridos via `innerHTML` em vários pontos:

**Risco alto — `catalogo.html` linha 968:**
```js
// Dados de 'nexoerp.produtos' inseridos diretamente no DOM:
grid.innerHTML = filtered.map((p, i) => {
  // p.nome, p.desc, p.categoria vêm do localStorage sem sanitização
  return `<div class="product-card">
    <div class="product-name">${p.nome}</div>
    ...
  </div>`;
}).join('');
```

Se um usuário cadastrar um produto com nome `<img src=x onerror="alert(1)">`, ele será executado no catálogo.

**Risco alto — `pedidos.html` linha 1341, `financeiro.html` linha 2733, `vendas.html` linha 789:**
Mesma situação com nomes de clientes, descrições de lançamentos e itens de venda.

**Correção — adicionar função de sanitização em `utils.js`:**
```js
function escapeHTML(str) {
  const d = document.createElement('div');
  d.textContent = String(str || '');
  return d.innerHTML;
}
```

**Uso correto:**
```js
// INSEGURO:
`<div>${p.nome}</div>`

// SEGURO:
`<div>${escapeHTML(p.nome)}</div>`
```

> **Alternativa mais simples:** Usar `textContent` para campos de texto puro (nomes, descrições, valores) e reservar `innerHTML` apenas para templates com HTML controlado (ícones, badges com classes conhecidas).

---

### ITEM 22 — DADOS SENSÍVEIS NO LOCALSTORAGE

O localStorage é acessível a qualquer JavaScript na mesma origem — incluindo extensões de navegador, scripts de terceiros carregados via CDN (Bootstrap Icons, QRCode.js, Google Fonts), e ferramentas de desenvolvimento.

**Dados expostos atualmente:**
- Senhas em plaintext (`nexoerp.users`)
- CPF/CNPJ de clientes (quando persistido)
- Dados financeiros (`nexoerp.financeiro`)
- Informações de sessão (`nexoerp.session`)

**Nível de risco para o projeto atual:** Baixo-médio (uso demo/local).  
**Nível de risco para produção:** Alto.

**Recomendações:**
1. Implementar hashing de senha (veja Bug 6)
2. Documentar claramente no README que é um sistema demo
3. Para produção: migrar para backend com autenticação JWT e HTTPS

---

### ITEM 23 — SEM PROTEÇÃO CONTRA BRUTE-FORCE NO LOGIN

`auth.js` `login()` não conta tentativas falhas. Um atacante pode testar senhas ilimitadamente.

**Correção — adicionar rate limiting client-side:**
```js
const ATTEMPTS_KEY = 'nexoerp.login_attempts';
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 30 * 1000; // 30 segundos

function checkRateLimit() {
  try {
    const data = JSON.parse(localStorage.getItem(ATTEMPTS_KEY) || '{"count":0,"since":0}');
    if (Date.now() - data.since > LOCKOUT_MS) {
      localStorage.removeItem(ATTEMPTS_KEY);
      return { blocked: false };
    }
    if (data.count >= MAX_ATTEMPTS) {
      const wait = Math.ceil((LOCKOUT_MS - (Date.now() - data.since)) / 1000);
      return { blocked: true, wait };
    }
    return { blocked: false };
  } catch (_) { return { blocked: false }; }
}

function recordFailedAttempt() {
  try {
    const data = JSON.parse(localStorage.getItem(ATTEMPTS_KEY) || '{"count":0,"since":0}');
    const now = Date.now();
    localStorage.setItem(ATTEMPTS_KEY, JSON.stringify({
      count: (Date.now() - data.since > LOCKOUT_MS) ? 1 : data.count + 1,
      since: (Date.now() - data.since > LOCKOUT_MS) ? now : data.since
    }));
  } catch (_) {}
}

// Na função login():
function login(identifier, password, remember) {
  const rateCheck = checkRateLimit();
  if (rateCheck.blocked) {
    return { ok: false, message: `Muitas tentativas. Aguarde ${rateCheck.wait}s.` };
  }
  // ... lógica de login ...
  if (!user || String(user.password) !== String(password)) {
    recordFailedAttempt();
    return { ok: false, message: 'Usuário ou senha incorretos.' };
  }
  localStorage.removeItem(ATTEMPTS_KEY);
  return { ok: true, session: createSession(user, remember) };
}
```

---

## 📋 BLOCO 5 — INVENTÁRIO COMPLETO DO PROJETO

---

### `auth.js` — 188 linhas
- **Função:** Sistema de autenticação, sessão e usuários
- **Dependências:** Nenhuma (IIFE standalone)
- **localStorage:** `nexoerp.users` (R/W), `nexoerp.session` (R/W), `nexoerp.demo_removed` (R/W)
- **Expõe:** `window.NexoAuth` com 8 métodos públicos
- **Status:** ⚠️ Parcial — senhas em plaintext, sem rate limiting, `writeJSON` sem try/catch, saudação fixa

---

### `utils.js` — 81 linhas
- **Função:** Funções utilitárias compartilhadas (formatação, toast, máscaras, sidebar toggle)
- **Dependências:** Nenhuma
- **localStorage:** Não usa diretamente
- **Expõe:** Funções globais (`fmt`, `showToast`, `toggleSidebar`, `maskPhone`, `maskCEP`, `maskCNPJ`, `maskCPF`, `initials`)
- **Status:** ⚠️ Parcial — `initials()` duplicada com versão insegura, sem `escapeHTML`, sem validação de CPF/CNPJ

---

### `sidebar.js` — 76 linhas
- **Função:** Gera dinamicamente o HTML do sidebar de navegação
- **Dependências:** `utils.js` (usa `toggleSidebar`), `auth.js` (usa `NexoAuth.confirmLogout`)
- **localStorage:** `nexoerp.user` (R) ← **CHAVE FANTASMA, NUNCA GRAVADA**
- **Status:** ❌ Quebrado — lê chave errada, usuário sempre aparece como "Usuário / Administrador"

---

### `global.css` — 1.438 linhas
- **Função:** Estilos compartilhados — tokens, layout, sidebar, componentes
- **Dependências:** Google Fonts (DM Sans, Syne)
- **Status:** ✅ Completo — bem estruturado para o tamanho atual do projeto

---

### `database/schema.sql` — 107 linhas
- **Função:** Schema SQL para migração futura para banco relacional
- **Status:** ❌ Quebrado (sintaxe inválida na linha 55) + 🚧 Incompleto (7 tabelas faltando)

---

### `login.html` — 311 linhas
- **Função:** Tela de autenticação
- **Dependências:** `auth.js`
- **localStorage:** Lê e escreve via `NexoAuth.login()`
- **Status:** ✅ Completo — design OK, validação básica presente, sem sidebar (correto)

---

### `landing.html` — 1.006 linhas
- **Função:** Página de marketing/landing page pública
- **Dependências:** Nenhum script próprio
- **localStorage:** Não usa
- **Status:** ✅ Completo — página estática, sem problemas funcionais

---

### `cadastro.html` — 1.239 linhas
- **Função:** Onboarding e criação de conta (registro de usuário)
- **Dependências:** `utils.js`, `auth.js`
- **localStorage:** Escreve via `NexoAuth.registerUser()`
- **Sem sidebar:** Intencional (pré-login)
- **Status:** ⚠️ Parcial — sem validação de CPF/CNPJ real, sem feedback de força de senha

---

### `dashboard.html` — 1.354 linhas · 4 funções JS
- **Função:** Painel principal com KPIs e gráficos
- **Dependências:** `global.css`, `utils.js`, `auth.js`, `sidebar.js`
- **localStorage:** Lê via `NexoAuth.getSession()`; KPIs são todos hardcoded
- **Status:** ⚠️ Parcial — saudação hardcoded "João 👋", KPIs estáticos (não leem dados reais)

---

### `pdv.html` — 7.667 linhas · 121 funções JS
- **Função:** Ponto de Venda (PDV) completo com carrinho, pagamentos e caixa
- **Dependências:** `utils.js`, `auth.js`, `qrcode.js` (CDN); **sem sidebar.js**
- **localStorage:** `nexoerp.pdv.config` (R/W), `nexoerp.pdv.caixa` (R/W), `sistemy.produtos` (R — chave errada!)
- **Status:** ⚠️ Parcial — funcional mas sem sidebar.js, lê produtos pela chave errada

---

### `pedidos.html` — 1.654 linhas · 36 funções JS
- **Função:** Gestão de pedidos de venda (listagem, criação, detalhes)
- **Dependências:** `utils.js`, `auth.js`, `sidebar.js`
- **localStorage:** `nexoerp.pedidos` (R/W), `nexoerp.vendas` (R/W)
- **Status:** ✅ Completo — tem persistência, paginação e CRUD básico

---

### `vendas.html` — 1.156 linhas · 27 funções JS
- **Função:** Histórico de vendas com filtros e exportação CSV
- **Dependências:** `utils.js`, `auth.js`, `sidebar.js`
- **localStorage:** `nexoerp.vendas` (R/W)
- **Status:** ✅ Completo — tem persistência, paginação, exportação

---

### `clientes.html` — 1.293 linhas · 29 funções JS
- **Função:** Cadastro e gestão de clientes (CRUD)
- **Dependências:** `utils.js`, `auth.js`, `sidebar.js`
- **localStorage:** **Não usa** — dados em array hardcoded em memória
- **Status:** ⚠️ Parcial — UI completa mas sem persistência; dados são perdidos ao recarregar

---

### `produtos.html` — 1.587 linhas · 32 funções JS
- **Função:** Catálogo interno de produtos com CRUD e gestão
- **Dependências:** `utils.js`, `auth.js`, `sidebar.js`
- **localStorage:** `sistemy.produtos` (R/W) ← **PREFIXO ERRADO**
- **Status:** ⚠️ Parcial — funcional mas chave localStorage inconsistente

---

### `catalogo.html` — 1.325 linhas · 23 funções JS
- **Função:** Catálogo público de produtos para clientes
- **Dependências:** Nenhum script compartilhado
- **localStorage:** `sistemy.produtos` (R), `catalogo-cfg` (R/W) ← **AMBAS COM PREFIXO ERRADO**
- **Status:** ⚠️ Parcial — sem autenticação (pode ser intencional), XSS potencial via innerHTML

---

### `estoque.html` — 1.477 linhas · 23 funções JS
- **Função:** Gestão de estoque, movimentações e depósitos
- **Dependências:** `utils.js`, `auth.js`, `sidebar.js`
- **localStorage:** **Não usa** — dados em array hardcoded em memória
- **Status:** ⚠️ Parcial — UI completa mas sem persistência; dados são perdidos ao recarregar

---

### `financeiro.html` — 3.213 linhas · 44 funções JS
- **Função:** Controle financeiro (contas a pagar/receber, fluxo de caixa)
- **Dependências:** `utils.js`, `auth.js`, `sidebar.js`
- **localStorage:** `nexoerp.financeiro` (R/W)
- **Status:** ✅ Completo — tem persistência, funcional; arquivo muito longo

---

### `configuracoes.html` — 1.695 linhas · 22 funções JS
- **Função:** Configurações do sistema (usuários, empresa, catálogo, perfil)
- **Dependências:** `utils.js`, `auth.js`, `sidebar.js`
- **localStorage:** `nexoerp.config` (R/W), `nexoerp.users` (R/W), `nexoerp.demo_removed` (W)
- **Status:** ✅ Completo — bem estruturado, gerencia usuários corretamente

---

## 🛠️ BLOCO 6 — PLANO DE CORREÇÃO PRIORIZADO

---

### 🔴 CRÍTICO — Faça agora

| # | Problema | Arquivo(s) | Esforço | Impacto | Solução |
|---|---|---|---|---|---|
| C1 | Bug SQL: vírgula faltando linha 55 | `database/schema.sql` | Baixo | Alto | Adicionar `,` após `vendedor_id` |
| C2 | Sidebar lê chave fantasma | `sidebar.js` linha 44 | Baixo | Alto | Trocar `nexoerp.user` → ler de `nexoerp.session` |
| C3 | Prefixo errado em produtos | `produtos.html`, `catalogo.html`, `pdv.html` | Baixo | Alto | Renomear `sistemy.produtos` → `nexoerp.produtos` + migração legado |
| C4 | Clientes sem persistência | `clientes.html` | Médio | Alto | Implementar localStorage com chave `nexoerp.clientes` |
| C5 | Estoque sem persistência | `estoque.html` | Médio | Alto | Implementar localStorage com chave `nexoerp.estoque` |
| C6 | XSS via innerHTML sem sanitização | `catalogo.html`, `pedidos.html`, `financeiro.html` | Médio | Alto | Adicionar `escapeHTML()` em `utils.js` e aplicar nos templates |

---

### 🟠 IMPORTANTE — Próxima sprint

| # | Problema | Arquivo(s) | Esforço | Impacto | Solução |
|---|---|---|---|---|---|
| I1 | Badge hardcoded no menu | `sidebar.js` linha 6 | Baixo | Médio | Remover badge ou calcular de `nexoerp.vendas` |
| I2 | Saudação fixa "Bom dia, João" | `dashboard.html`, `auth.js` | Baixo | Médio | Implementar saudação dinâmica por horário + DOMContentLoaded |
| I3 | `initials()` duplicada | `utils.js`, `auth.js` | Baixo | Médio | Corrigir versão insegura em `utils.js` |
| I4 | `writeJSON` sem try/catch | `auth.js` linha 25 | Baixo | Médio | Adicionar try/catch com showToast de erro |
| I5 | Rate limiting no login | `auth.js` | Médio | Médio | Bloqueio após 5 tentativas por 30s |
| I6 | Módulos sem página marcados | `sidebar.js` | Médio | Médio | Adicionar flag `comingSoon` e CSS disabled |
| I7 | PDV sem sidebar.js | `pdv.html` | Médio | Médio | Refatorar para usar sidebar.js compartilhado |
| I8 | Schema SQL incompleto | `database/schema.sql` | Médio | Médio | Adicionar 7 tabelas ausentes |
| I9 | Senha em plaintext | `auth.js` | Médio | Alto | Hash SHA-256 via SubtleCrypto |
| I10 | Catálogo sem documentação de acesso | `catalogo.html` | Baixo | Baixo | Comentar intenção (pública vs privada) |

---

### 🟡 MELHORIA — Quando possível

| # | Problema | Arquivo(s) | Esforço | Impacto | Solução |
|---|---|---|---|---|---|
| M1 | pdv.html monolítico (7.667 linhas) | `pdv.html` | Alto | Médio | Extrair para `pdv.js` + `pdv.css` |
| M2 | financeiro.html muito longo (3.213 linhas) | `financeiro.html` | Alto | Baixo | Separar lógica em `financeiro.js` |
| M3 | Validação CPF/CNPJ com dígito verificador | `utils.js`, `clientes.html` | Médio | Médio | Adicionar `validarCPF()` e `validarCNPJ()` em utils.js |
| M4 | Multi-empresa via prefixo dinâmico | Todos os módulos | Alto | Alto | Prefixar chaves com `empresa_id` da sessão |
| M5 | Paginação em financeiro | `financeiro.html` | Médio | Baixo | Implementar paginação de 20 itens em lançamentos |
| M6 | Dashboard com KPIs reais | `dashboard.html` | Alto | Alto | Ler dados de vendas/estoque/financeiro do localStorage |
| M7 | global.css organizado por seções | `global.css` | Baixo | Baixo | Adicionar comentários de seção claros |

---

## 📊 BLOCO 7 — MÉTRICAS DO PROJETO

---

### Linhas de código por arquivo

| Arquivo | Linhas | Tipo |
|---|---|---|
| pdv.html | 7.667 | HTML+CSS+JS |
| financeiro.html | 3.213 | HTML+CSS+JS |
| configuracoes.html | 1.695 | HTML+CSS+JS |
| global.css | 1.438 | CSS |
| pedidos.html | 1.654 | HTML+CSS+JS |
| produtos.html | 1.587 | HTML+CSS+JS |
| estoque.html | 1.477 | HTML+CSS+JS |
| catalogo.html | 1.325 | HTML+CSS+JS |
| clientes.html | 1.293 | HTML+CSS+JS |
| cadastro.html | 1.239 | HTML+CSS+JS |
| vendas.html | 1.156 | HTML+CSS+JS |
| dashboard.html | 1.354 | HTML+CSS+JS |
| landing.html | 1.006 | HTML+CSS+JS |
| login.html | 311 | HTML+CSS+JS |
| auth.js | 188 | JS |
| utils.js | 81 | JS |
| sidebar.js | 76 | JS |
| database/schema.sql | 107 | SQL |
| **TOTAL** | **26.872** | — |

---

### Funções JavaScript por arquivo

| Arquivo | Funções |
|---|---|
| pdv.html | 121 |
| financeiro.html | 44 |
| pedidos.html | 36 |
| produtos.html | 32 |
| clientes.html | 29 |
| vendas.html | 27 |
| configuracoes.html | 22 |
| catalogo.html | 23 |
| estoque.html | 23 |
| cadastro.html | 15 |
| auth.js | 15 |
| utils.js | 8 |
| dashboard.html | 4 |
| login.html | 2 |
| landing.html | 1 |
| sidebar.js | 0 (IIFE) |
| **TOTAL** | **~406** |

---

### Chaves localStorage únicas

| Chave | Módulo(s) | Status |
|---|---|---|
| `nexoerp.users` | auth.js, configuracoes.html | ✅ |
| `nexoerp.session` | auth.js | ✅ |
| `nexoerp.demo_removed` | auth.js, configuracoes.html | ✅ |
| `nexoerp.config` | configuracoes.html | ✅ |
| `nexoerp.pedidos` | pedidos.html | ✅ |
| `nexoerp.vendas` | pedidos.html, vendas.html | ✅ |
| `nexoerp.financeiro` | financeiro.html | ✅ |
| `nexoerp.pdv.config` | pdv.html | ✅ |
| `nexoerp.pdv.caixa` | pdv.html | ✅ |
| `nexoerp.user` | sidebar.js | ❌ Fantasma |
| `sistemy.produtos` | produtos.html, catalogo.html, pdv.html | ❌ Prefixo errado |
| `catalogo-cfg` | catalogo.html | ❌ Sem prefixo |
| **Total: 12** | — | **9 corretas · 3 com problema** |

---

### Módulos: status geral

| Categoria | Total | Status |
|---|---|---|
| Páginas HTML | 16 | — |
| ✅ Completas (funcionais, com persistência) | 6 | login, landing, pedidos, vendas, financeiro, configuracoes |
| ⚠️ Parciais (funcionais mas com falhas) | 8 | dashboard, pdv, produtos, catalogo, clientes, estoque, cadastro, dashboard |
| ❌ Quebradas | 1 | sidebar.js (chave errada) |
| 🚧 Incompletas | 1 | schema.sql |

---

### Itens de menu sem implementação

| Label | Section |
|---|---|
| Relatórios | Financeiro |
| Fiscal / NF-e | Financeiro |
| Parceiros | Sistema |
| WhatsApp | Integrações |
| **Total: 4 de 14** | — |

---

### Complexidade estimada por página

| Página | Complexidade | Justificativa |
|---|---|---|
| pdv.html | 🔴 Alto | 7.667 linhas, 121 funções, lógica de caixa, PIX, split |
| financeiro.html | 🔴 Alto | 3.213 linhas, 44 funções, múltiplos fluxos financeiros |
| pedidos.html | 🟠 Médio | 1.654 linhas, 36 funções, fluxo de pedido completo |
| produtos.html | 🟠 Médio | 1.587 linhas, 32 funções, CRUD com localStorage |
| configuracoes.html | 🟠 Médio | 1.695 linhas, gestão de usuários e empresa |
| estoque.html | 🟠 Médio | 1.477 linhas, movimentações e depósitos |
| clientes.html | 🟠 Médio | 1.293 linhas, 29 funções, modal multi-step |
| catalogo.html | 🟡 Simples | 1.325 linhas, visual dinâmico mas lógica simples |
| vendas.html | 🟡 Simples | 1.156 linhas, listagem com filtros |
| dashboard.html | 🟡 Simples | 1.354 linhas, 4 funções, dados hardcoded |
| cadastro.html | 🟡 Simples | 1.239 linhas, formulário multi-step |
| landing.html | 🟡 Simples | 1.006 linhas, marketing estático |
| login.html | 🟡 Simples | 311 linhas, formulário simples |

---

### Arquivo mais complexo

**`pdv.html`** é o arquivo mais complexo do projeto em todos os critérios:
- **Maior:** 7.667 linhas (28,5% do total do projeto)
- **Mais funções:** 121 funções JavaScript
- **Mais dependências:** utils.js, auth.js, qrcode.js (CDN), sidebar próprio embutido
- **Mais estados:** caixa aberto/fechado, carrinho, split de conta, métodos de pagamento (dinheiro, pix, cartão, parcelado), configuração de terminal
- **Mais chaves localStorage:** 2 próprias + lê `sistemy.produtos` com chave errada

---

*Fim do relatório — NexoERP Auditoria v1.0 — 2026-06-02*
