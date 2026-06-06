# NexoERP — Roadmap de Produto

> Última atualização: 2026-06-06
> Base: análise completa dos módulos (frontend + backend)

---

## Como ler este documento

- **Fase** = conjunto de entregas com tema comum e dependência entre si
- **Esforço:** P = pequeno (horas), M = médio (1–2 dias), G = grande (3–5 dias)
- **Impacto:** 🔴 crítico · 🟠 importante · 🟡 qualidade · 🔵 diferencial
- As fases são sequenciais — concluir a anterior desbloqueia a próxima

---

## Fase 1 — Fundação Técnica
> Pré-requisito para qualquer cliente real. Nada que quebre em produção.

| # | Tarefa | Módulo | Esforço | Impacto |
|---|--------|--------|---------|---------|
| 1.1 | Tornar API_URL configurável (variável no topo de auth.js) | auth.js | P | 🔴 |
| 1.2 | Sistema de toast/notificação global (`NexoToast.show()`) | global | M | 🔴 |
| 1.3 | Skeleton de loading em todos os módulos | global | M | 🟠 |
| 1.4 | Configurações com efeito real (moeda, formato de data, decimais) | configuracoes | M | 🔴 |
| 1.5 | Troca de senha do usuário logado | configuracoes | P | 🟠 |
| 1.6 | Remover código morto da migração localStorage no sidebar.js | sidebar.js | P | 🟡 |
| 1.7 | Avatar da topbar lendo da sessão (hoje mostra "JD" fixo) | configuracoes | P | 🟡 |

---

## Fase 2 — PDV Completo
> O PDV é o módulo mais usado no dia a dia. Precisa estar perfeito.

| # | Tarefa | Módulo | Esforço | Impacto |
|---|--------|--------|---------|---------|
| 2.1 | Desconto por item e desconto global no carrinho | pdv | M | 🔴 |
| 2.2 | Campo de busca por código de barras / SKU | pdv | P | 🟠 |
| 2.3 | Vincular cliente à venda PDV (campo opcional no checkout) | pdv + backend | M | 🟠 |
| 2.4 | Impressão de cupom/recibo (página dedicada de print) | pdv | M | 🟠 |
| 2.5 | Observação interna por venda PDV | pdv | P | 🟡 |

---

## Fase 3 — Pedidos e Clientes
> Fluxo comercial completo: do orçamento ao recebimento.

| # | Tarefa | Módulo | Esforço | Impacto |
|---|--------|--------|---------|---------|
| 3.1 | Impressão / PDF de orçamento e pedido | pedidos | G | 🔴 |
| 3.2 | Alerta visual de orçamento vencido (campo validade já existe) | pedidos | P | 🟠 |
| 3.3 | Paginação em Pedidos (carrega X por vez, botão "carregar mais") | pedidos | M | 🟠 |
| 3.4 | Histórico de compras visível no card do cliente | clientes | M | 🟠 |
| 3.5 | Campo de endereço completo no cliente (CEP + autofill) | clientes | M | 🟡 |
| 3.6 | Importação em lote de clientes via CSV | clientes + backend | G | 🟡 |

---

## Fase 4 — Produtos e Estoque
> Catálogo rico e controle de estoque confiável.

| # | Tarefa | Módulo | Esforço | Impacto |
|---|--------|--------|---------|---------|
| 4.1 | Upload de imagem real para produto (armazenamento a definir) | produtos + backend | G | 🟠 |
| 4.2 | Paginação em Produtos | produtos | M | 🟠 |
| 4.3 | Atualização de preço em lote (selecionar N produtos → novo preço) | produtos | M | 🟠 |
| 4.4 | Variações de produto (cor, tamanho) vinculadas ao produto-pai | produtos + backend | G | 🔵 |
| 4.5 | Transferência entre depósitos (UI do fluxo completo) | estoque | M | 🟠 |
| 4.6 | Inventário periódico (contagem física vs. sistema) | estoque + backend | G | 🟡 |
| 4.7 | Validade de produto com alerta (segmentos alimentício/farmácia) | estoque | M | 🔵 |

---

## Fase 5 — Financeiro Avançado
> Fechar o ciclo financeiro com precisão.

| # | Tarefa | Módulo | Esforço | Impacto |
|---|--------|--------|---------|---------|
| 5.1 | Bug 2: Lucro Líquido considera Centro de Custo (aguarda contador) | dashboard + financeiro | G | 🔴 |
| 5.2 | Parcelamento real (1 lançamento → N lançamentos futuros) | financeiro + backend | G | 🟠 |
| 5.3 | Alertas de vencimento (contas a vencer em 3/7/15 dias) | financeiro | M | 🟠 |
| 5.4 | Anexo de comprovante/nota nos lançamentos | financeiro + backend | G | 🟡 |
| 5.5 | DRE com custos corretos (reflexo do item 5.1) | financeiro | M | 🟠 |
| 5.6 | Conciliação bancária (importar extrato OFX) | financeiro + backend | G | 🔵 |

---

## Fase 6 — Relatórios e Acesso
> Dados que geram decisão. Acesso seguro para todos.

| # | Tarefa | Módulo | Esforço | Impacto |
|---|--------|--------|---------|---------|
| 6.1 | Export PDF nos relatórios (além do CSV) | relatorios | M | 🟠 |
| 6.2 | Gráficos visuais nos relatórios (charts na tela) | relatorios | G | 🟡 |
| 6.3 | Relatório de comissão por vendedor | relatorios + backend | M | 🟡 |
| 6.4 | Agendamento de relatório (envio por e-mail) | relatorios + backend | G | 🔵 |
| 6.5 | Fluxo real de "Esqueceu a senha" (e-mail de reset) | login + backend | M | 🟠 |
| 6.6 | Painel "Plano" funcional (ou remover botões vazios) | configuracoes | P | 🟡 |

---

## Fase 7 — Deploy em Produção
> Do localhost para o mundo.

| # | Tarefa | Onde | Esforço | Impacto |
|---|--------|------|---------|---------|
| 7.1 | Deploy da API no Railway (conectar ao repo nexoerp-api) | Railway | M | 🔴 |
| 7.2 | Deploy do frontend no Netlify (conectar ao repo sistemy) | Netlify | P | 🔴 |
| 7.3 | Atualizar API_URL no frontend para o domínio do Railway | auth.js | P | 🔴 |
| 7.4 | Configurar domínio personalizado (se houver) | DNS | M | 🟡 |
| 7.5 | Variáveis de ambiente no Railway (DATABASE_URL, JWT_SECRET) | Railway | P | 🔴 |

---

## Fase 8 — Escala e Performance
> Quando tiver usuários reais e volume de dados.

| # | Tarefa | Módulo | Esforço | Impacto |
|---|--------|--------|---------|---------|
| 8.1 | Paginação completa em todos os módulos (Vendas, Clientes restantes) | global | G | 🔴 |
| 8.2 | CSS consolidado — eliminar duplicação entre módulos | global.css | G | 🟡 |
| 8.3 | Responsividade mobile básica em todos os módulos | global | G | 🟠 |
| 8.4 | Cache de API com invalidação (evitar re-fetch desnecessário) | global | G | 🟡 |

---

## Fase 9 — Integrações (Diferencial de Produto)
> Funcionalidades que elevam o NexoERP acima da concorrência.

| # | Tarefa | Módulo | Esforço | Impacto |
|---|--------|--------|---------|---------|
| 9.1 | NF-e (Nota Fiscal Eletrônica) — integração com SEFAZ | fiscal + backend | G | 🔴* |
| 9.2 | WhatsApp — envio de orçamento/pedido via link | pedidos | M | 🔵 |
| 9.3 | PIX — geração de QR Code no checkout PDV | pdv + backend | M | 🔵 |
| 9.4 | Integração com marketplace (Mercado Livre, Shopify) | backend | G | 🔵 |
| 9.5 | App mobile (PWA como primeiro passo) | global | G | 🔵 |

> *NF-e é obrigatório para clientes que emitem nota — timing depende do segmento dos clientes.

---

## Visão geral de sequência

```
AGORA          1–2 meses      3–4 meses      5–6 meses      6+ meses
─────────────────────────────────────────────────────────────────────
Fase 1         Fase 2         Fase 4         Fase 6         Fase 9
Fundação       PDV            Produtos       Relatórios     Integrações
               Fase 3         Fase 5         Fase 7
               Pedidos        Financeiro     Deploy
               Clientes                      Fase 8
                                             Escala
```

---

## O que NÃO está neste roadmap (decisões pendentes)

- **Nome do sistema** — renomear de NexoERP para outro nome quando definido
- **Modelo de negócio / planos** — Starter, Pro, Enterprise (preços, limites)
- **Multi-empresa por usuário** — hoje cada login é uma empresa; suporte a múltiplas empresas exige mudança de arquitetura
- **Bug 2 (Lucro Líquido)** — aguardando definição do contador sobre regra de custo

---

*Roadmap vivo — atualizar conforme decisões de produto e feedback de clientes.*
