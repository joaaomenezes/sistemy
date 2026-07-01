# Plano de Implementação

## Fase 1 - Fundação da Marca

- Criar a pasta `docs/brand`.
- Adicionar `tokens.css`.
- Adicionar `design-system.css`.
- Documentar logo, favicon, ícones e tipografia.

## Fase 2 - Assets

- Criar/exportar logos em SVG.
- Criar arquivos de favicon.
- Criar app icons.
- Criar assets de manifest/PWA.

## Fase 3 - Integração CSS

Mover arquivos CSS de produção para um local adequado, se necessário:

```text
assets/css/tokens.css
assets/css/design-system.css
```

Depois:

- Importar tokens globalmente.
- Importar Inter.
- Adicionar classes reutilizáveis.

## Fase 4 - Aplicar no Shell Principal

- Sidebar
- Topbar
- Layout global
- Botões
- Inputs
- Cards

## Fase 5 - Aplicar Página por Página

- Dashboard
- Financeiro
- DRE
- Contas a receber
- Contas a pagar
- PDV
- Vendas
- Clientes
- Produtos
- Estoque
- Relatórios
- Configurações
- Landing page
- Login

## Fase 6 - QA

Testar:

- Carregamento do dashboard
- Navegação da sidebar
- Busca da topbar
- Fluxo de venda no PDV
- Modais de pagamento
- Filtros do financeiro
- Dropdowns da DRE
- Formulários de clientes
- Formulários de produtos
- Login
- Responsividade da landing page
- Layout mobile

## Próxima Tarefa Recomendada

Aplicar a identidade visual Azzys primeiro na landing page, página de login, sidebar, topbar e configuração de favicon.

Depois aplicar o design system página por página: dashboard, financeiro, DRE, PDV, clientes, produtos, estoque e relatórios.
