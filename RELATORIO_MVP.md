# RELATÓRIO MVP — NexoERP (Sistemy)

**Data:** 2026-06-04  
**Analista:** Claude Sonnet 4.6  
**Escopo:** Análise completa de todos os 23 arquivos do projeto  
**Stack:** HTML/CSS/JS puro · localStorage · Sem framework · Sem backend real  
**Baseline:** RELATORIO_AUDITORIA.md de 2026-06-02

---

## RESUMO EXECUTIVO

O sistema está **75–80% pronto para um MVP demo**. A espinha dorsal funciona: login, PDV, Vendas, Pedidos, Financeiro, Produtos, Clientes, Estoque e Dashboard lêem e escrevem dados reais no localStorage de forma consistente. Os bugs críticos da auditoria anterior (sidebar com chave fantasma, chaves `sistemy.produtos`, XSS em catálogo/pedidos, ausência de persistência em clientes e estoque) foram **todos corrigidos**.

Os 4 bloqueadores que ainda impedem produção são pequenos e todos corrigíveis em menos de 4 horas no total.

---

## 1. O QUE JÁ ESTÁ FUNCIONANDO E PODE IR PARA PRODUÇÃO

### ✅ Fluxo de autenticação (`auth.js` + `login.html` + `cadastro.html`)
- Login com usuário/email + senha funcional
- Sessão com TTL (8h normal, 30 dias "lembrar de mim")
- Expiração de sessão com redirect automático para login
- Cadastro de novo usuário com remoção automática do demo ao registrar
- Guard `requireAuth()` presente em todos os módulos (exceto catalogo — pode ser intencional)
- Logout com detecção de caixa aberto (avisa antes de sair do PDV)
- `renderCurrentUser()` popula nome, cargo e iniciais em todas as páginas

### ✅ Sidebar (`sidebar.js`)
- Corrigido: lê `nexoerp.session` corretamente
- Geração dinâmica do menu por seção
- Destaque de item ativo por URL
- Módulos `comingSoon` com badge "Em breve" e click bloqueado
- Iniciais do usuário calculadas corretamente

### ✅ PDV (`pdv.html` — 276 KB, ~7.800 linhas)
O módulo mais completo do sistema. Funcional de ponta a ponta:
- Abertura/fechamento de caixa com operador e saldo inicial
- Grid de produtos com busca, filtro por categoria, scanner de código de barras
- Carrinho com qty editável, desconto por item e desconto global
- Pagamento em dinheiro, PIX (QR Code), cartão crédito/débito, pagamento dividido (split)
- Finalização com impressão de cupom
- Histórico de vendas do dia com estorno
- Vendas suspensas (pausa de venda)
- Atalhos de teclado (F6–F8, F1/?)
- Feedback sonoro no scanner
- Integração com `nexoerp.produtos` para ler e decrementar estoque

### ✅ Vendas (`vendas.html`)
- Lista paginada com busca, filtro por status e período
- Drawer de detalhe com itens, totais, desconto, método de pagamento
- Estorno com campo de motivo
- Lê `nexoerp.pdv.vendas` (PDV) e `nexoerp.vendas` (Pedidos) de forma unificada
- Ícones coloridos por método de pagamento

### ✅ Pedidos (`pedidos.html`)
- Kanban (Pendente / Aprovado / Faturado) + visão Lista
- CRUD completo: criar, editar, aprovar, cancelar
- Campo de observações, condição de pagamento, parcelas
- Persistência em `nexoerp.pedidos`

### ✅ Financeiro (`financeiro.html`)
- Lançamentos de receitas e despesas
- Filtros por tipo, status, categoria e período
- Contas a receber / contas a pagar
- Centro de custos com despesas recorrentes
- Gráfico donut de distribuição de despesas
- Alerta de títulos vencidos
- Persistência em `nexoerp.financeiro`

### ✅ Produtos (`produtos.html`)
- CRUD completo com todas as abas: Geral, Preço & Fiscal, Estoque, Imagem
- Filtro, busca, ordenação, grid/lista
- Migração one-shot da chave `sistemy.produtos` → `nexoerp.produtos`
- Persistência em `nexoerp.produtos`

### ✅ Clientes/Parceiros (`clientes.html`)
- CRUD completo PF/PJ com máscaras (CPF, CNPJ, CEP, telefone)
- Busca, filtro por tipo, ordenação por coluna
- Persistência em `nexoerp.clientes`
- Integração com fornecedores (`nexoerp.fornecedores`)

### ✅ Estoque (`estoque.html`)
- KPIs: total de itens, valor em estoque, abaixo do mínimo, zerados, giro
- Alertas de estoque crítico e baixo com filtro rápido
- Registro de movimentações (entrada, saída, ajuste, transferência, inventário)
- Histórico com paginação
- Persistência em `nexoerp.produtos` + `nexoerp.movimentacoes`

### ✅ Dashboard (`dashboard.html`)
- KPIs reais calculados de `nexoerp.vendas`, `nexoerp.financeiro`, `nexoerp.produtos`, `nexoerp.clientes`
- Faturamento, receitas, despesas, lucro líquido, pedidos, clientes, estoque
- Feed de últimas transações
- Data dinâmica com saudação por horário

### ✅ Catálogo (`catalogo.html`)
- Vitrine pública de produtos (sem auth — intencional)
- Tema customizável: fonte, cor primária, sombra, modo compacto
- Chips de categoria, busca, filtro out-of-stock
- escapeHTML aplicado em todos os campos

### ✅ Relatórios (`relatorios.html`)
- 8+ relatórios: Histórico de Vendas, Produtos Mais Vendidos, Ticket Médio, Posição de Estoque, Margem de Lucro, Giro de Estoque, Fluxo de Caixa, DRE Simplificado
- Filtros por data, status, método de pagamento, fonte
- Cálculo combinando `nexoerp.pdv.vendas` + `nexoerp.vendas`

### ✅ Setup Demo (`setup-demo.html`)
- Popula localStorage com 15 produtos, 15 clientes, 47 vendas, 20 pedidos, ~80 lançamentos financeiros
- Dados com datas reais de dez/2025 a jun/2026
- Interface visual com log de progresso

### ✅ Landing Page (`landing.html`)
- Marketing completo, feature list, planos de preço, testimonials
- Nenhuma lógica de negócio — só HTML estático

---

## 2. O QUE ESTÁ INCOMPLETO OU PELA METADE

### ⚠️ Configurações não salvam nada (`configuracoes.html`)
**Severidade: Alta** — O botão "Salvar alterações" chama `saveChanges()` que apenas esconde a barra e exibe um toast. Nenhum dado é gravado no `nexoerp.config`. O `CFG_KEY = 'nexoerp.config'` está declarado mas jamais usado em `localStorage.setItem()`.

Campos afetados que parecem salvar mas não salvam:
- Nome do sistema / marca
- Cor de destaque (color picker)
- Upload de logo
- Configurações da empresa (nome, CNPJ, endereço)
- Configurações do PDV (chave PIX, impressora)
- Qualquer configuração de usuário

```js
// ATUAL (src: configuracoes.html linha 1471):
function saveChanges() {
  isDirty = false;
  document.getElementById('saveBar').classList.remove('show');
  showToast('Configurações salvas com sucesso!');  // só o toast
}

// NECESSÁRIO: localStorage.setItem(CFG_KEY, JSON.stringify(coletarFormulario()));
```

### ⚠️ Permissões decorativas (`configuracoes.html`)
A tabela de permissões por perfil (Admin / Gerente / Vendedor / Caixa) é apenas visual. Nenhum módulo lê `nexoerp.config` para verificar o perfil do usuário logado antes de renderizar. Um usuário com role "Caixa" pode acessar Financeiro e Configurações sem restrição.

### ⚠️ PDV sem sidebar (`pdv.html`)
PDV é uma página standalone sem `sidebar-root` nem `<script src="sidebar.js">`. O usuário que está no PDV não tem navegação para outros módulos. Pode ser intencional (POS mode), mas falta ao menos um botão "← Voltar ao sistema" visível (o link `← Sistema` existe mas fica escondido em drawer).

### ⚠️ Schema SQL incompleto (`database/schema.sql`)
O arquivo SQL define apenas 6 das 13+ tabelas necessárias para um backend real. Faltam: `vendas`, `itens_venda`, `pedidos`, `itens_pedido`, `movimentacoes_estoque`, `lancamentos_financeiros`, `configuracoes`. Isso não bloqueia o MVP frontend-only mas será problema na hora de migrar para backend.

### ⚠️ Vírgula faltando no SQL (`database/schema.sql` linha 55)
```sql
-- ATUAL (quebrado):
vendedor_id INTEGER REFERENCES usuarios(id)
observacoes TEXT,

-- CORRETO:
vendedor_id        INTEGER REFERENCES usuarios(id),
observacoes        TEXT,
```

### ⚠️ "Esqueceu a senha?" sem funcionalidade (`login.html` linha 251)
O link `<a href="#" class="forgot">Esqueceu a senha?</a>` não abre nenhum modal nem redireciona. Para um sistema com localStorage, a solução mínima é um modal que peça e-mail e limpe a sessão com instrução de contato.

### ⚠️ Landing anuncia features inexistentes
`landing.html` lista como features do plano:
- "PDV completo com emissão fiscal" — NF-e não existe (comingSoon)
- "Relatórios com inteligência artificial" — sem IA de nenhum tipo

Se a landing for usada para captação real, isso pode gerar problema de expectativa.

---

## 3. BUGS CRÍTICOS QUE BLOQUEIAM O MVP

### 🔴 BUG-MVP-1 — XSS em `vendas.html` (drawer de detalhe)

**Arquivo:** `vendas.html` linhas 1062–1083  
**Risco:** Médio-Alto — dados de vendas são inseridos via innerHTML sem sanitização

```js
// VULNERÁVEL (vendas.html linha 1070):
`<div class="dp-row"><span class="dp-label">${l}</span><span class="dp-val">${val}</span></div>`

// VULNERÁVEL (linha 1076–1079):
`<div class="item-emoji">${item.emoji}</div>
 <div class="item-name">${item.nome}</div>`
```

Os campos `v.cliente`, `v.operador`, `v.estornoMotivo`, `item.nome`, `item.emoji` não passam por `escapeHTML()`. Se um usuário cadastrar um cliente com nome `<img src=x onerror=alert(1)>`, o XSS dispara ao abrir o detalhe da venda.

**Correção:** Envolver todas essas interpolações com `escapeHTML()`, exatamente como foi feito corretamente em `pedidos.html` e `catalogo.html`.

---

### 🔴 BUG-MVP-2 — Senhas em texto puro no localStorage

**Arquivo:** `auth.js` linhas 10, 109, 142  
**Risco:** Alto — qualquer extensão de browser ou acesso físico ao DevTools expõe todas as senhas

```js
// auth.js linha 10 — demo user com senha visível:
password: 'admin123',

// auth.js linha 109 — nova senha salva como string:
password: data.password,

// auth.js linha 142 — comparação sem hash:
if (!user || String(user.password) !== String(password)) {
```

O localStorage é completamente acessível via DevTools > Application > Storage. Qualquer pessoa com acesso ao browser pode abrir `nexoerp.users` e ler todas as senhas.

**Correção mínima (SHA-256 com SubtleCrypto):**
```js
async function hashPassword(pwd) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pwd));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}
```

---

### 🔴 BUG-MVP-3 — Sem proteção contra brute-force no login

**Arquivo:** `auth.js` função `login()` (linha 136)  
**Risco:** Médio — tentativas ilimitadas de senha sem qualquer limitação

A função `login()` não conta tentativas falhas. Um atacante pode testar senhas indefinidamente via script no console do browser. Para localStorage, a solução mínima são 5 tentativas com bloqueio de 30s por chave `nexoerp.login.lockout`.

---

### 🔴 BUG-MVP-4 — Configurações não persistem (crítico para uso real)

Detalhado na Seção 2. O sistema aparentemente funciona mas qualquer configuração feita pelo usuário (nome da empresa, cor, PIX, etc.) some ao recarregar. Para um MVP demo isso é aceitável; para produção real, é um bloqueador.

---

## 4. O QUE FALTA PARA UM MVP MÍNIMO VIÁVEL

Para "entrar em produção" como um sistema de demonstração com dados reais de um cliente pequeno, os itens abaixo são necessários:

### Obrigatório antes de mostrar para cliente

| # | Item | Arquivo(s) | Complexidade |
|---|------|-----------|-------------|
| O1 | Corrigir XSS em vendas.html | `vendas.html` L1062–1083 | Baixa (30 min) |
| O2 | Configurações salvar no localStorage | `configuracoes.html` L1471 | Baixa (2h) |
| O3 | Hash SHA-256 nas senhas | `auth.js` | Média (3h) |
| O4 | Correção vírgula SQL | `database/schema.sql` L55 | Trivial (1 min) |

### Desejável antes de mostrar para cliente

| # | Item | Arquivo(s) | Complexidade |
|---|------|-----------|-------------|
| D1 | Bloqueio de 5 tentativas no login | `auth.js` | Baixa (1h) |
| D2 | Modal "Esqueceu a senha?" com instrução | `login.html` | Baixa (1h) |
| D3 | Remover claims de AI e NF-e da landing (ou marcar como "Em breve") | `landing.html` | Trivial (15 min) |
| D4 | Favicon + `<meta name="application-name">` | Todos os HTML | Baixa (30 min) |

---

## 5. O QUE É NICE-TO-HAVE E PODE FICAR PARA DEPOIS

### Segurança e Multi-tenant
- **S1** — Enforcement real das permissões por role (cada página verifica o perfil antes de renderizar)
- **S2** — Prefixo dinâmico `nexoerp.{empresa_id}.chave` para suportar múltiplos tenants (hoje tudo compartilhado em um namespace flat)
- **S3** — Content Security Policy via `<meta http-equiv="Content-Security-Policy">`

### Módulos não implementados (sidebar mostra "Em breve")
- **N1** — Fiscal / NF-e (integração com SEFAZ)
- **N2** — WhatsApp (integração com API Oficial ou Evolution API)

### UX e Funcionalidade
- **N3** — Validação de CPF/CNPJ com dígito verificador real (hoje aceita `123.456.789-01`)
- **N4** — Export CSV/PDF em todos os módulos com tabela
- **N5** — Import de produtos e clientes via CSV
- **N6** — Modo responsivo completo para mobile (hoje só colapsa a sidebar — tabelas de 8 colunas quebram em tela pequena)
- **N7** — PWA manifest + service worker para uso offline
- **N8** — Tamanho dos cards configurável no PDV (#20 do BUGS.md)
- **N9** — Badge de estoque restante no carrinho do PDV (#19 do BUGS.md)
- **N10** — Produtos favoritos/mais vendidos no topo do PDV (#21 do BUGS.md)

### Arquitetura
- **N11** — Extrair JS/CSS do `pdv.html` (276 KB) para `pdv.js` + `pdv.css` — manutenibilidade
- **N12** — Completar `database/schema.sql` com as 7+ tabelas restantes (preparação para backend)
- **N13** — Completar a tabela de permissões e aplicar em cada módulo
- **N14** — Configurações lendo e aplicando tema em tempo real (cor primária em CSS var)

---

## 6. PLANO DE AÇÃO PRIORIZADO

### FASE 1 — Patch imediato (~5 horas) — Desbloqueia MVP

| Prioridade | Item | Arquivo | Tempo estimado |
|-----------|------|---------|----------------|
| P1 🔴 | Corrigir XSS em `vendas.html` (escapeHTML em drawer) | `vendas.html` L1062–1083 | 30 min |
| P2 🔴 | Implementar hash SHA-256 nas senhas (`auth.js`) | `auth.js` | 3h |
| P3 🔴 | Adicionar bloqueio de login após 5 tentativas | `auth.js` | 1h |
| P4 🔴 | Implementar save real em `saveChanges()` | `configuracoes.html` | 2h |
| P5 🟠 | Corrigir vírgula no `schema.sql` linha 55 | `schema.sql` | 1 min |
| P6 🟠 | Modal "Esqueceu a senha?" (instrução de contato) | `login.html` | 1h |
| P7 🟠 | Remover/marcar como "Em breve" features de IA e NF-e na landing | `landing.html` | 15 min |
| P8 🟠 | Adicionar favicon em todos os HTMLs | Todos | 30 min |

**Total estimado: ~8 horas de trabalho**

---

### FASE 2 — Hardening (~12 horas) — Antes de clientes reais

| Prioridade | Item | Arquivo | Tempo estimado |
|-----------|------|---------|----------------|
| P9 🟠 | Enforcement de permissões por role em cada módulo | Todos | 4h |
| P10 🟠 | Validação real de CPF/CNPJ com dígito verificador | `utils.js`, `clientes.html` | 2h |
| P11 🟠 | Export CSV em Vendas, Clientes, Produtos, Financeiro | 4 arquivos | 4h |
| P12 🟡 | Completar schema.sql com tabelas ausentes | `schema.sql` | 2h |
| P13 🟡 | Configurações lendo e aplicando tema via CSS vars | `configuracoes.html` | 2h |

---

### FASE 3 — Escala (~20+ horas) — Crescimento

| Item | Esforço estimado |
|------|-----------------|
| Multi-tenant com prefixo dinâmico (`nexoerp.{id}.*`) | 8h (refatoração em todos os módulos) |
| Responsividade mobile completa (tabelas scroll horizontal) | 6h |
| PDV: extrair para `pdv.js` + `pdv.css` | 4h |
| PWA manifest + service worker | 3h |
| Import CSV de produtos e clientes | 4h |
| Módulo Fiscal / NF-e | 40h+ (integração com SEFAZ) |
| WhatsApp API integration | 20h+ |

---

## DIAGNÓSTICO FINAL

```
Módulo            Status      Produção-Ready?   Bloqueador
────────────────────────────────────────────────────────────
Login/Auth        ✅ OK        Sim (c/ hash)     Hash senha
Dashboard         ✅ OK        Sim               —
PDV               ✅ OK        Sim               —
Vendas            ⚠️  XSS      Não               BUG-MVP-1
Pedidos           ✅ OK        Sim               —
Financeiro        ✅ OK        Sim               —
Produtos          ✅ OK        Sim               —
Clientes          ✅ OK        Sim               —
Estoque           ✅ OK        Sim               —
Catálogo          ✅ OK        Sim (público)     —
Relatórios        ✅ OK        Sim               —
Configurações     🔴 Fake      Não               BUG-MVP-4
Landing           ⚠️  Claims   Parcial           D3
Setup Demo        ✅ OK        Sim               —
Fiscal/NF-e       ❌ N/A       Não               Coming Soon
WhatsApp          ❌ N/A       Não               Coming Soon
schema.sql        ⚠️  Parcial  Não (irrelevante) C1 + incompleto
```

**Conclusão:** 11 de 14 módulos funcionais estão prontos para demo/produção. Os 3 bloqueadores críticos (XSS em Vendas, senhas plaintext, configurações falsas) são corrigíveis em uma tarde de trabalho. O sistema impressiona pela riqueza de funcionalidades — o PDV em especial está no nível de produtos comerciais — mas precisa desses patches antes de ir ao ar com dados reais de clientes.
