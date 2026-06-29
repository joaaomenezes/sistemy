# Analise de Codigo Morto - NexoERP

## Resumo

- Total de itens analisados: 39
- Seguro remover: 9
- Provavelmente seguro, mas precisa validar: 19
- Nao remover: 11
- Possivel impacto em performance: medio/alto no frontend, principalmente por HTML/CSS grandes, CSS duplicado por pagina, imagens da landing e bibliotecas externas carregadas em paginas especificas.

## Remocao executada

Data: 2026-06-28

Lote autorizado pelo dono do projeto:

- `vendas.html`: removidos `applyFiltersLegacyUnused` e `loadVendas`.
- `clientes.html`: removido `filterTable`.
- `financeiro.html`: removidos `_normalizeLancamentos` e `_finUpdateLabel`.
- `relatorios.html`: removido `getCategorias`.
- `pdv/pdv-cart.js`: removido `setItemPrice`.
- `pdv/pdv.js`: removidos `parseMoneyInput` e `fecharImpressao`.

Validacao apos remocao:

- Busca por todos os nomes removidos nao retornou referencias restantes.
- Remocao limitada a funcoes sem chamada encontrada.
- Nenhuma regra de negocio, layout, banco, endpoint ou fluxo financeiro foi alterado.

---

## Seguro remover

### Item: `applyFiltersLegacyUnused`

**Tipo:** Funcao
**Arquivo:** `vendas.html`
**Motivo:** Funcao legada substituida por `applyFilters()`. O proprio nome indica uso antigo e o corpo tem `return applyFilters();` antes do codigo legado, tornando o restante inalcançavel.
**Evidencia:** Busca por `applyFiltersLegacyUnused` encontrou apenas a declaracao em `vendas.html`. Os eventos e filtros chamam `applyFilters()`.
**Risco:** Baixo
**Acao recomendada:** Removido no lote de limpeza de codigo morto.

---

### Item: `loadVendas(tipo)`

**Tipo:** Funcao
**Arquivo:** `vendas.html`
**Motivo:** Carregamento antigo de vendas sem paginacao/server-side. Foi substituido por `loadVendasPage()` e `loadVendasResumo()`.
**Evidencia:** Busca por `loadVendas(` encontrou apenas a declaracao. Chamadas atuais usam `/vendas?` via `loadVendasPage()` e `/vendas/resumo?` via `loadVendasResumo()`.
**Risco:** Baixo
**Acao recomendada:** Removido no lote de limpeza de codigo morto.

---

### Item: `filterTable`

**Tipo:** Funcao
**Arquivo:** `clientes.html`
**Motivo:** Wrapper antigo que apenas faz `currentPage = 1; applyFilters();`. Nao ha chamada em HTML inline nem em JS.
**Evidencia:** Busca por `filterTable` encontrou apenas a declaracao em `clientes.html`.
**Risco:** Baixo
**Acao recomendada:** Removido no lote de limpeza de codigo morto.

---

### Item: `_normalizeLancamentos`

**Tipo:** Funcao / migracao localStorage antiga
**Arquivo:** `financeiro.html`
**Motivo:** Funcao de migracao de registros legados de `desc/venc/categ` para `descricao/vencimento/categoria`. O financeiro atual carrega dados pela API e nao usa essa normalizacao.
**Evidencia:** Busca por `_normalizeLancamentos` encontrou apenas a declaracao.
**Risco:** Baixo
**Acao recomendada:** Removido no lote de limpeza de codigo morto.

---

### Item: `_finUpdateLabel`

**Tipo:** Funcao
**Arquivo:** `financeiro.html`
**Motivo:** Variante antiga de atualizacao do label de periodo. A implementacao atual usa `_finUpdateLabelStr()`.
**Evidencia:** Busca por `_finUpdateLabel` encontrou declaracao e chamadas somente para `_finUpdateLabelStr`, nao para `_finUpdateLabel`.
**Risco:** Baixo
**Acao recomendada:** Removido no lote de limpeza de codigo morto.

---

### Item: `getCategorias`

**Tipo:** Funcao
**Arquivo:** `relatorios.html`
**Motivo:** Funcao declarada sem chamadas. Os filtros/relatorios atuais carregam dados por `loadAllData()` e chamadas diretas a endpoints.
**Evidencia:** Busca por `getCategorias` encontrou apenas a declaracao.
**Risco:** Baixo
**Acao recomendada:** Removido no lote de limpeza de codigo morto.

---

### Item: `setItemPrice`

**Tipo:** Funcao
**Arquivo:** `pdv/pdv-cart.js`
**Motivo:** Funcao antiga para alterar preco diretamente no carrinho. O fluxo atual de alteracao de preco/desconto usa modal de edicao de item e PIN de supervisor.
**Evidencia:** Busca por `setItemPrice` encontrou apenas a declaracao. Nao ha `onclick`, listener ou chamada dinamica encontrada.
**Risco:** Baixo
**Acao recomendada:** Removido no lote de limpeza de codigo morto; validar PDV no teste manual.

---

### Item: `parseMoneyInput`

**Tipo:** Funcao
**Arquivo:** `pdv/pdv.js`
**Motivo:** Parser monetario declarado sem chamadas. O PDV usa outros parsers/formatadores nos fluxos atuais.
**Evidencia:** Busca por `parseMoneyInput` encontrou apenas a declaracao.
**Risco:** Baixo
**Acao recomendada:** Removido no lote de limpeza de codigo morto; validar venda dinheiro/cartao/fiado no teste manual.

---

### Item: `fecharImpressao`

**Tipo:** Funcao
**Arquivo:** `pdv/pdv.js`
**Motivo:** Funcao para fechar frame de impressao sem chamadas atuais.
**Evidencia:** Busca por `fecharImpressao` encontrou apenas a declaracao.
**Risco:** Baixo
**Acao recomendada:** Removido no lote de limpeza de codigo morto; validar impressao/recibo do PDV no teste manual.

---

## Provavelmente seguro, mas precisa validar

### Item: `dashboard-prototipo.html`

**Tipo:** HTML / pagina antiga
**Arquivo:** `dashboard-prototipo.html`
**Motivo:** Parece prototipo antigo do dashboard. O fluxo principal usa `dashboard.html`.
**Possivel uso indireto:** Pode ser usado como referencia visual/manual pelo dono do projeto, mesmo sem link no fluxo.
**Como validar antes de remover:** Buscar no GitHub/Vercel se existe rota publicada ou link externo apontando para `dashboard-prototipo.html`; perguntar se ainda serve como referencia de design.
**Risco:** Baixo

---

### Item: `build.sh`

**Tipo:** Script de build
**Arquivo:** `build.sh`
**Motivo:** Gera `config.js` a partir de `API_URL`, mas o repo possui `config.js` versionado apontando para Railway.
**Possivel uso indireto:** Pode estar configurado manualmente como build command no Vercel.
**Como validar antes de remover:** Conferir no painel Vercel se o build command usa `build.sh`. Se nao usar, remover.
**Risco:** Medio

---

### Item: `recConfirm`

**Tipo:** Funcao
**Arquivo:** `login.html`
**Motivo:** Funcao encontrada sem chamada direta no codigo. Parece relacionada a reenvio/confirmacao de e-mail.
**Possivel uso indireto:** Pode ser chamada por HTML gerado dinamicamente ou por evento inline em modal de confirmacao.
**Como validar antes de remover:** Testar fluxo de login com e-mail nao confirmado e reenvio de confirmacao. Remover apenas se nenhuma acao depender dela.
**Risco:** Medio

---

### Item: `gerarParcelas`

**Tipo:** Funcao
**Arquivo:** `pedidos.html`
**Motivo:** Stub que apenas comenta que parcelas sao geradas na hora de salvar por `gerarParcelasCalc`.
**Possivel uso indireto:** Pode estar preso em algum evento inline antigo nao capturado por busca simples, embora a busca tenha encontrado apenas a declaracao.
**Como validar antes de remover:** Criar/editar pedido parcelado e verificar se `gerarParcelasCalc` segue gerando as parcelas no save.
**Risco:** Baixo

---

### Item: `_checkCaixaBeforeLogout`

**Tipo:** Funcao
**Arquivo:** `pdv/pdv.js`
**Motivo:** Funcao de alerta de caixa aberto no logout. O fluxo global atual usa `NexoAuth.confirmLogout()` via `sidebar.js`.
**Possivel uso indireto:** Pode ser chamada por algum elemento criado dinamicamente no PDV ou ter sido mantida para UX especifica do PDV.
**Como validar antes de remover:** Abrir PDV com caixa aberto e tentar sair pelo menu/sidebar. Confirmar que o alerta global continua funcionando.
**Risco:** Medio

---

### Item: `.legacy-card-options`

**Tipo:** CSS / HTML
**Arquivo:** `pdv.html`, `pdv/pdv.css`
**Motivo:** Classe com nome de legado em bloco de configuracao de cartao. Ainda aparece no HTML e no CSS, mas pode ser sobra de layout antigo.
**Possivel uso indireto:** Como ainda esta no HTML, remover CSS pode alterar layout do modal de configuracao.
**Como validar antes de remover:** Abrir configuracoes do PDV, aba cartao, comparar layout antes/depois.
**Risco:** Medio

---

### Item: endpoints REST de detalhe nao consumidos pelo frontend

**Tipo:** Endpoint
**Arquivo:** `nexoerp-api/src/routes/*`
**Motivo:** Algumas rotas de detalhe seguem o padrao REST, mas nao aparecem como chamadas atuais do frontend: exemplos `GET /api/auth/me`, `GET /api/produtos/:id`, `GET /api/pedidos/:id`, `GET /api/vendas/:id`, `GET /api/financeiro/:id`, `GET /api/fornecedores/:id`.
**Possivel uso indireto:** Podem ser usadas por API externa, testes manuais, integraçoes futuras ou telas que abrem dados a partir de lista local.
**Como validar antes de remover:** Conferir logs de producao/Railway por 7 dias e buscar chamadas a essas rotas; remover apenas se nao houver consumidores externos.
**Risco:** Alto

---

### Item: `catalogo.html`

**Tipo:** HTML / pagina funcional isolada
**Arquivo:** `catalogo.html`
**Motivo:** Usa `localStorage` (`nexoerp.produtos`) e parece ser uma vitrine/catalogo isolado, fora da API principal.
**Possivel uso indireto:** Esta linkado no `sidebar.js` e no dashboard como "Catalogo"; portanto nao e morto, mas pode ser modulo antigo/desalinhado da arquitetura API.
**Como validar antes de remover:** Confirmar se a funcionalidade de catalogo ainda faz parte do produto. Se sim, manter e planejar migracao; se nao, remover da navegacao antes de apagar arquivo.
**Risco:** Medio

---

### Item: `ROADMAP_AUTH_EMAIL.md`

**Tipo:** Documento antigo
**Arquivo:** `ROADMAP_AUTH_EMAIL.md`
**Motivo:** Parece roadmap antigo de autenticacao/e-mail, possivelmente substituido pelos docs de auditoria.
**Possivel uso indireto:** Pode preservar historico de decisao.
**Como validar antes de remover:** Comparar com `docs/auditoria-producao/*` e manter somente se tiver informacao unica.
**Risco:** Baixo

---

### Item: `_movTime`

**Tipo:** Funcao
**Arquivo:** `financeiro.html`
**Motivo:** Helper declarado dentro de `renderTabelas()`, mas sem chamada encontrada. A ordenacao/paginacao atual das movimentacoes usa outros caminhos.
**Possivel uso indireto:** Baixo. Por estar dentro de escopo local, nao pode ser chamado por HTML inline externo.
**Como validar antes de remover:** Abrir Financeiro, conferir aba de movimentacoes, contas a pagar/receber e DRE; depois buscar novamente por `_movTime`.
**Risco:** Baixo

---

### Item: `setPeriod`

**Tipo:** Funcao
**Arquivo:** `financeiro.html`
**Motivo:** Funcao antiga de botao de periodo. A tela atual usa o date picker `finSelPeriod`, `finApplyCustom` e `_finUpdateLabelStr`.
**Possivel uso indireto:** Pode sobrar de HTML antigo se algum botao inline ainda for reintroduzido manualmente, mas a busca atual encontrou apenas a declaracao.
**Como validar antes de remover:** Testar todos os filtros de periodo do Financeiro, principalmente DRE e graficos.
**Risco:** Baixo

---

### Item: `.nx-btn-icon`

**Tipo:** CSS
**Arquivo:** `global.css`
**Motivo:** Seletor aparece apenas na definicao CSS. Nao ha classe `nx-btn-icon` em HTML/JS atual.
**Possivel uso indireto:** Pode ser classe reservada para componentes futuros ou HTML inserido manualmente.
**Como validar antes de remover:** Buscar por `nx-btn-icon` depois de abrir todas as telas principais; se continuar sem uso, remover do CSS global.
**Risco:** Baixo

---

### Item: `.status-pill.orcamento`

**Tipo:** CSS
**Arquivo:** `global.css`
**Motivo:** Classe especifica para status `orcamento`, mas a busca atual nao encontrou uso literal no HTML/JS. Os status de pedidos podem estar usando outras classes.
**Possivel uso indireto:** Pode ser montada dinamicamente por `status-pill ${status}` caso algum pedido tenha status `orcamento`.
**Como validar antes de remover:** Criar/abrir pedido em status orcamento e inspecionar se a classe aparece no DOM.
**Risco:** Medio

---

### Item: `.dp-btn.purple`

**Tipo:** CSS
**Arquivo:** `global.css`
**Motivo:** Variante visual de botao roxo encontrada apenas na definicao CSS.
**Possivel uso indireto:** Pode ser usada por componente antigo de date picker ou por classe aplicada dinamicamente.
**Como validar antes de remover:** Testar filtros de data em dashboard/financeiro/relatorios e inspecionar DOM por `dp-btn purple`.
**Risco:** Baixo

---

### Item: `.pay-body`

**Tipo:** CSS
**Arquivo:** `pdv/pdv.css`
**Motivo:** Classe aparece apenas na definicao CSS. A area de pagamento atual usa outras classes `pay-*`.
**Possivel uso indireto:** Pode ter sido removida do HTML do modal de pagamento, mas CSS ficou.
**Como validar antes de remover:** Abrir modal de pagamento no PDV e buscar no DOM por `pay-body`.
**Risco:** Baixo

---

### Item: aliases antigos de skeleton (`.nx-skeleton-*`)

**Tipo:** CSS
**Arquivo:** `global.css`, `utils.js`
**Motivo:** O JS atual gera classes `skeleton`, `skeleton-line`, `skeleton-title`, `skeleton-avatar`, `skeleton-stack`. As aliases com prefixo `nx-skeleton-*` aparecem apenas no CSS.
**Possivel uso indireto:** Podem ser compatibilidade para telas antigas ou HTML futuro.
**Como validar antes de remover:** Buscar no DOM apos carregamento das telas com loading; se so aparecerem classes sem prefixo `nx-`, remover aliases `nx-skeleton-*` mantendo `skeleton-*`.
**Risco:** Baixo

---

### Item: referencias antigas a Netlify no roadmap raiz

**Tipo:** Documento antigo
**Arquivo:** `ROADMAP.md`
**Motivo:** O frontend agora esta no Vercel, mas o roadmap raiz ainda menciona deploy no Netlify.
**Possivel uso indireto:** Documentacao historica; nao pesa runtime, mas pode confundir deploy.
**Como validar antes de remover:** Confirmar se `ROADMAP.md` ainda e documento ativo ou se foi substituido por `docs/auditoria-producao/ROADMAP_CORRECOES.md`.
**Risco:** Baixo

---

### Item: referencias antigas a Netlify no backend

**Tipo:** Documento antigo / configuracao de exemplo
**Arquivo:** `nexoerp-api/README.md`
**Motivo:** O README do backend ainda usa `https://nexoerp.netlify.app` como exemplo de `CORS_ORIGIN` e `PUBLIC_APP_URL`.
**Possivel uso indireto:** Nao afeta deploy se as variaveis reais do Railway estiverem corretas, mas pode induzir erro em nova configuracao.
**Como validar antes de remover:** Atualizar exemplo para dominio Vercel/dominio proprio e conferir Railway.
**Risco:** Baixo

---

### Item: dump local de backup

**Tipo:** Arquivo local / backup
**Arquivo:** `nexoerp-api/backups/*.dump`
**Motivo:** Existe dump local de teste no backend. Nao e codigo e nao deve ir para o Git se `backups/` estiver ignorado.
**Possivel uso indireto:** Pode ser evidencia do teste de restore feito na Fase 1.
**Como validar antes de remover:** Confirmar que nao esta trackeado no Git e que existe backup/branch de restore no Neon antes de apagar localmente.
**Risco:** Baixo

---

## Nao remover

### Item: `confirmar-email.html`

**Tipo:** HTML / fluxo de autenticacao
**Arquivo:** `confirmar-email.html`
**Motivo:** Parece pouco referenciado no frontend, mas e chamado por link gerado pelo backend via `PUBLIC_APP_URL/confirmar-email.html?token=...`.
**Onde ainda e usado:** `nexoerp-api/src/services/emailVerification.js`.

---

### Item: `NexoSkeleton.tableRows` e classes `skeleton-*`

**Tipo:** JS / CSS
**Arquivo:** `utils.js`, `global.css`
**Motivo:** Alguns seletores pareciam pouco usados, mas `NexoSkeleton.tableRows()` e `NexoSkeleton.kpiVal()` sao usados por clientes, produtos, pedidos, vendas, estoque, financeiro e dashboard.
**Onde ainda e usado:** Chamadas `NexoSkeleton.*` em praticamente todas as telas de listagem.

---

### Item: bibliotecas externas de relatorio

**Tipo:** Biblioteca externa
**Arquivo:** `relatorios.html`
**Motivo:** `jspdf`, `jspdf-autotable` e `xlsx` aumentam peso da pagina, mas sustentam exportacao/relatorios.
**Onde ainda e usado:** Exportacao PDF/Excel/CSV em `relatorios.html`.

---

### Item: dependencias principais do backend

**Tipo:** Dependencia npm
**Arquivo:** `nexoerp-api/package.json`
**Motivo:** A varredura encontrou uso direto de `@prisma/client`, `prisma`, `zod`, `bcryptjs`, `jsonwebtoken`, `cors`, `helmet`, `dotenv`, `morgan` e `mercadopago`. Nao ha pacote obvio para remover agora.
**Onde ainda e usado:** Rotas, middlewares, scripts de backup/restore/teste e integracao Mercado Pago.

---

### Item: `terminalOperadora: 'demo'`

**Tipo:** Configuracao default
**Arquivo:** `nexoerp-api/src/routes/configuracoes-pdv.js`, `nexoerp-api/prisma/schema.prisma`
**Motivo:** Parece mock pela palavra `demo`, mas e default real da configuracao de terminal/cartao do PDV.
**Onde ainda e usado:** Configuracoes do PDV e schema Prisma.

---

### Item: `utils.js`

**Tipo:** JS global
**Arquivo:** `utils.js`
**Motivo:** Apesar de ter funcoes genericas e algum estado local, ainda fornece mascaras, permissao, skeleton loading, formatadores e status financeiro usados por varias telas.
**Onde ainda e usado:** `clientes.html`, `configuracoes.html`, `cadastro.html`, `dashboard.html`, `financeiro.html`, `vendas.html`, `produtos.html`, `pedidos.html`, `estoque.html`, `relatorios.html`, `pdv.html`.

---

### Item: `assets/screenshots/*`

**Tipo:** Asset / imagem
**Arquivo:** `assets/screenshots/*.png`
**Motivo:** Parecem assets de marketing, mas sao carregados diretamente pela landing page.
**Onde ainda e usado:** `landing.html` referencia `assets/screenshots/pdv.png`, `dashboard.png`, `financeiro.png`, `estoque.png`, `relatorios.png`, `pedidos.png` e `produtos.png`.

---

### Item: paginas institucionais `landing.html` e `sobre.html`

**Tipo:** HTML
**Arquivo:** `landing.html`, `sobre.html`
**Motivo:** Nao fazem parte do ERP autenticado, mas ainda compoem fluxo publico de entrada/cadastro/login.
**Onde ainda e usado:** `login.html` e `cadastro.html` linkam para `landing.html`; `landing.html` linka para `sobre.html`.

---

### Item: `ajuda.html`

**Tipo:** HTML
**Arquivo:** `ajuda.html`
**Motivo:** Parece conter TODOs e estado local de onboarding, mas esta linkado no menu lateral como Central de Ajuda.
**Onde ainda e usado:** `sidebar.js` inclui item `Central de Ajuda` apontando para `ajuda.html`.

---

### Item: endpoints Mercado Pago / Pix / Webhook

**Tipo:** Endpoint / integracao
**Arquivo:** `nexoerp-api/src/routes/integracoes-pix.js`, `nexoerp-api/src/routes/pix.js`, `nexoerp-api/src/routes/webhooks.js`
**Motivo:** Alguns endpoints sao chamados por provedor externo ou por fluxos especificos do PDV; baixa frequencia nao significa codigo morto.
**Onde ainda e usado:** `pdv/pdv.js`, `pdv/pdv-config.js` e Mercado Pago via webhook externo.

---

### Item: `vercel.json`

**Tipo:** Config de deploy
**Arquivo:** `vercel.json`
**Motivo:** O frontend agora roda no Vercel. O arquivo configura redirect da raiz para `landing.html` e headers basicos de seguranca.
**Onde ainda e usado:** Deploy do frontend no Vercel.

---

## Analise de impacto

1. O que pode estar pesando o sistema.

Os maiores pesos estao no frontend: paginas HTML muito grandes com CSS/JS inline, principalmente `financeiro.html` (~245 KB), `pdv/pdv.js` (~165 KB), `pdv/pdv.css` (~156 KB), `dashboard.html` (~137 KB), `produtos.html` (~102 KB), `clientes.html` (~88 KB), `pedidos.html` (~88 KB) e `estoque.html` (~82 KB). Tambem pesam as imagens de marketing em `assets/screenshots/*.png` e as bibliotecas externas em `relatorios.html` (`jspdf`, `jspdf-autotable`, `xlsx`) carregadas quando a pagina abre. Isso pesa mais que as pequenas funcoes mortas.

2. O que e realmente codigo morto.

Os candidatos mais fortes ja removidos foram funcoes declaradas e sem chamadas: `applyFiltersLegacyUnused`, `loadVendas`, `filterTable`, `_normalizeLancamentos`, `_finUpdateLabel`, `getCategorias`, `setItemPrice`, `parseMoneyInput` e `fecharImpressao`. Na segunda varredura, os candidatos mais fortes restantes sao `_movTime`, `setPeriod`, `gerarParcelas`, `.nx-btn-icon`, `.dp-btn.purple`, `.pay-body` e aliases antigos `nx-skeleton-*`.

3. O que e apenas codigo duplicado, mas ainda usado.

Ha duplicacao de CSS/componentes entre paginas e funcoes parecidas de mascara/formato em HTMLs diferentes, mas parte disso ainda e usado por eventos inline. `global.css` convive com CSS proprio por pagina, e `pdv/pdv.css` concentra muito estilo especifico. Isso e duplicacao/arquitetura, nao codigo morto seguro.

4. O que pode ser removido com baixo risco.

Proximo lote de baixo risco: `_movTime`, `setPeriod`, `gerarParcelas`, `.nx-btn-icon`, `.dp-btn.purple`, `.pay-body` e aliases `nx-skeleton-*`, desde que a validacao visual/DOM confirme ausencia de uso.

5. O que precisa de teste antes de remover.

PDV (`_checkCaixaBeforeLogout`, `.pay-body`), login/e-mail (`recConfirm`), pedidos parcelados (`gerarParcelas`), CSS de status dinamico (`.status-pill.orcamento`), aliases de skeleton e qualquer endpoint REST nao consumido diretamente pelo frontend.

6. Quais arquivos devem ser limpos primeiro.

Ordem recomendada:

- `financeiro.html`: validar/remover `_movTime` e `setPeriod`.
- `pedidos.html`: validar/remover `gerarParcelas`.
- `global.css`: validar/remover `.nx-btn-icon`, `.dp-btn.purple` e aliases `nx-skeleton-*`.
- `pdv/pdv.css`: validar/remover `.pay-body`.
- `dashboard-prototipo.html`: remover somente se nao for mais referencia visual nem rota publica.
- `ROADMAP.md`, `ROADMAP_AUTH_EMAIL.md` e `nexoerp-api/README.md`: limpar referencias antigas a Netlify/Vercel depois de confirmar quais docs seguem ativos.

7. Se vale a pena fazer a limpeza antes do beta.

Sim, vale fazer uma limpeza pequena antes do beta, mas em lotes pequenos e testados. A limpeza de funcoes mortas de baixo risco reduz ruido e facilita manutencao. Nao recomendo mexer agora em endpoints REST, CSS amplo, paginas institucionais ou `catalogo.html` sem decisao de produto.
