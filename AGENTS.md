# NexoERP — Frontend (sistemy)

## O que é este projeto
ERP completo em HTML/CSS/JS puro (sem framework). Migrado de localStorage para API REST. O backend fica em outro repositório: `nexoerp-api`.

## Como rodar
1. Sobe a API primeiro: `cd nexoerp-api && npm run dev`
2. Abre esta pasta no VS Code → clica em **Go Live** (extensão Live Server)
3. Sistema abre em `http://127.0.0.1:5500`
4. Login dev: `admin@loja.com` / `123456`

> **IMPORTANTE:** Nunca abrir os `.html` diretamente pelo Windows Explorer (file://). O navegador bloqueia fetch para http:// nesse caso. Sempre usar o Live Server ou `npx serve .`.

## Stack e arquitetura
- **Frontend:** HTML + CSS + JS puro, sem React/Vue/Angular
- **API:** `http://localhost:3333/api` (hardcoded em `auth.js:4` — mudar antes do deploy)
- **Auth:** JWT salvo em `nexoerp.session` no localStorage; `NexoAuth.apiFetch(path)` adiciona Bearer token e retorna JSON parsed
- **Multi-tenant:** todo dado é filtrado por `empresaId` via JWT no backend
- **IDs:** CUID strings (ex: `cmq1e6qbp0004q8ogwtt81g0u`) — sempre usar aspas em onclick handlers: `onclick="fn('${item.id}')"`

## Arquivos globais
- `auth.js` — autenticação, sessão, rate limiting, apiFetch, sub-usuários
- `sidebar.js` — menu lateral, permissões, navegação
- `global.css` — variáveis de tema, componentes base (nem todos os módulos usam — dashboard e pdv têm CSS próprio)

## Padrão de cada módulo
```js
// 1. requireAuth no topo
const session = NexoAuth.requireAuth();

// 2. apiFetch retorna JSON parsed diretamente
const r = await NexoAuth.apiFetch('/produtos');
if (r.ok) { /* usa r.data ou r.items */ }

// 3. IDs são strings — aspas obrigatórias em onclick
`<button onclick="editar('${item.id}')">Editar</button>`

// 4. Datas: NUNCA usar new Date("YYYY-MM-DD") puro (vira UTC e quebra filtros)
// Sempre: new Date(data + 'T00:00:00') / new Date(data + 'T23:59:59')
```

## Status de migração localStorage → API
**100% concluída.** Todos os módulos usam a API. Exceções intencionais (estado local de sessão, sem necessidade de persistência):
- `pdv.html` — `nexoerp.pdv.suspendedCarts` (carrinhos suspensos)
- `financeiro.html` — `custoCats` / `despesaCats` (listas de categorias, config de UI)
- `configuracoes.html` — configurações de tema/UI

## Módulos e o que cada um faz
| Módulo | Rota principal | Observações |
|--------|---------------|-------------|
| `login.html` | `/api/auth/login` | Rate limiting 5 tentativas, 30s bloqueio |
| `cadastro.html` | `/api/auth/register` | Cria empresa + usuário dono em transação |
| `dashboard.html` | Promise.all de 5 endpoints | Bug 2 pendente: Lucro Líquido ignora custos |
| `pdv.html` | `/api/vendas`, `/api/caixas` | Full-screen, caixa por turno, estorno |
| `pedidos.html` | `/api/pedidos` | Kanban + lista, fluxo orçamento→concluído |
| `vendas.html` | `/api/vendas` | Histórico PDV+pedidos, estorno com motivo |
| `clientes.html` | `/api/clientes` | Tabela+grid, clientes e fornecedores |
| `produtos.html` | `/api/produtos`, `/api/categorias` | Tabela+grid, modal 4 abas |
| `estoque.html` | `/api/estoque`, `/api/depositos` | Alertas estoque crítico/baixo |
| `financeiro.html` | `/api/financeiro`, `/api/custos` | DRE, contas a pagar/receber, caixa |
| `relatorios.html` | 7 endpoints via loadAllData() | CSV export, histórico via API |
| `configuracoes.html` | `/api/usuarios` | CRUD sub-usuários, permissões por módulo |

## Bugs conhecidos e pendentes
- **Bug 2 — Lucro Líquido no Dashboard:** mostra faturamento bruto porque `custos` não é carregado no `initDashboard`. Afeta também KPI Despesas e DRE. **Aguardando contador definir regra** (o que entra como custo, regime caixa vs competência).

## Roadmap
Ver arquivo `ROADMAP.md` na raiz deste repositório. 9 fases definidas.

## Regras de negócio importantes
- PDV **não** vincula cliente — só Pedidos vinculam cliente a transação
- Estoque decrementa ao **faturar** o pedido (não ao concluir)
- Cancelar pedido faturado/concluído reverte estoque + estorna lançamento
- `cliente.pedidos` incrementa só quando pedido vai para `concluido`
- Vendas PDV criam lançamento `receita/pago` — não aparecem em Contas a Receber

## Credenciais de desenvolvimento
- **E-mail:** `admin@loja.com`
- **Senha:** `123456`
- **Empresa:** NexoERP Dev
- Banco: Neon (nuvem, sa-east-1 São Paulo) — mesmo banco no PC e no notebook

## Próximo passo no roadmap
**Fase 1 — Fundação Técnica:**
- 1.1 Tornar API_URL configurável (hoje hardcoded em `auth.js:4`)
- 1.2 Sistema de toast global
- 1.4 Configurações com efeito real (moeda, formato de data)
