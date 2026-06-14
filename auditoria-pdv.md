# Relatório de Auditoria — Fluxo do PDV NexoERP

> Auditoria de leitura (sem alteração de código). Mapeia o fluxo completo do PDV:
> frontend (`pdv.html`), backend (`nexoerp-api`: `vendas.js`, `caixas.js`, `financeiro.js`),
> `schema.prisma` e `dashboard.html`. Data: 2026-06-14.

## Regra contábil base usada como referência
- Venda finalizada = faturamento.
- Pagamento recebido = receita recebida + caixa.
- Venda fiado = faturamento + contas a receber (NÃO entra no caixa até ser recebido).
- Conta a pagar lançada = obrigação; conta paga = despesa realizada + saída de caixa.
- Faturamento ≠ caixa. Receita recebida ≠ contas a receber. Lucro ≠ saldo de caixa.

---

## A) Resumo executivo

### ✅ Correto (contábil)
- **Fiado correto de ponta a ponta.** Gera venda + faturamento + lançamento `receita/avencer`
  com `clienteId` e `vencimento`; NÃO entra em receita recebida nem no caixa; aparece em
  contas a receber; baixa estoque. Exige cliente real e vencimento.
- **Dinheiro e Pix** geram `receita/pago` → faturamento + receita recebida + caixa.
- **Estoque** baixa só ao criar a venda no backend; não baixa em carrinho suspenso; devolve no estorno.
- **Estorno** consistente: venda `estornada` + lançamento `estornado` (fora de todos os KPIs) + devolve estoque.
- **Cadastro rápido de cliente no fiado** cria registro real, deduplica por CPF e vincula `clienteId`.

### ⚠️ Parcialmente correto
- **Caixa**: fiado excluído corretamente, mas "saldo esperado" mistura dinheiro físico com cartão/Pix/voucher (P1-A).
- **Crédito/Débito**: viram recebimento à vista imediato no caixa, sem recebível futuro, sem MDR, sem gravar bandeira/parcelas.
- **Dashboard**: faturamento/receita recebida/contas a receber corretos; mas não há KPI de saldo de caixa real — o "fluxo de caixa" é receitas pagas − despesas pagas.

### ❌ Errado
- **Split não envia o detalhamento ao backend.** Payload manda só `metodo:'split'` + total; backend cria UM lançamento `pago`. Composição das formas é perdida.
- **Config do PDV não persiste no backend.** Modelo `ConfiguracaoPDV` existe no schema mas nenhuma rota o expõe. Tudo em `localStorage`, com chave Pix fixa hardcoded como default.
- **Divergência de nomes**: frontend envia `metodo:'split'`; filtro de vendas no backend reconhece `'multiplo'`.
- **Crédito com juros**: comprovante mostra total com juros; venda/lançamento gravam o total base.

### 🔴 Riscos contábeis principais
1. Caixa físico nunca vai bater (cartão/Pix/voucher somados ao dinheiro).
2. Split perde a composição — impossível auditar formas de recebimento.
3. Cartão de crédito como caixa instantâneo — superestima caixa e ignora MDR.
4. Chave Pix hardcoded — risco de pagamento na conta errada.

---

## B) Fluxo atual do PDV (passo a passo)

1. **Abertura de caixa** — `confirmarAbertura()` → `POST /api/caixas` com `operador`, `operadorId`
   (sessão), `fundo` (default 200), `aberturaStr`. Backend fecha caixa anterior do mesmo operador
   e cria novo `aberto:true`. Vínculo correto por `operadorId`.
2. **Venda** — produtos no `cart` (estado local); estoque ainda NÃO baixa. Suspensão usa
   `CarrinhoSuspenso` + localStorage, sem afetar estoque.
3. **Pagamento** — `selectMethod()` exibe a UI da forma; `confirmPayment()` valida (Pix pago,
   fiado com cliente+vencimento+limite, split fechado e confirmado).
4. **Criação da venda** — `_buildSale()` + `_registrarVenda()` → `POST /api/vendas`. Backend em
   transação: decrementa estoque + `Movimentacao` por item; cria `Venda`; incrementa `cliente.compras`;
   cria UM `Lancamento` de receita.
5. **Financeiro** — lançamento nasce `pago` (vencimento/pagoEm = hoje) para tudo, exceto **fiado**
   (`avencer`, pagoEm null, vencimento informado, clienteId preenchido).
6. **Fechamento de caixa** — frontend calcula `saldoEsperado = fundo + suprimentos − sangrias + todayStats.total`
   e salva `totalVendas` via `PUT /api/caixas/:id`. NÃO há reconciliação com os lançamentos financeiros.

---

## C) Análise por forma de pagamento

| Forma | Comportamento atual | Comportamento correto | Divergência |
|---|---|---|---|
| **Pix** | Venda + `receita/pago` + caixa + faturamento. QR local com `valor=total`, chave do config. Status 100% simulado. | Pix recebido = caixa. | Só simulado, sem PSP. Chave de localStorage com default hardcoded. OK contábil. |
| **Dinheiro** | Venda + `receita/pago` + caixa. Troco no front, não enviado. | Idem. | OK. Troco não persiste (não crítico). |
| **Débito** | `receita/pago` imediato no caixa. | Aceitável (D+1), idealmente recebível/não-caixa físico. | Caixa instantâneo; bandeira não gravada. |
| **Crédito** | `receita/pago` imediato. Juros/parcelas/bandeira só visuais. Total gravado = base. | Recebível futuro líquido de MDR; total = o que o cliente paga. | Mistura venda com recebimento; comprovante ≠ financeiro; sem MDR; sem parcelamento gravado. |
| **Voucher / Vale-refeição** | `receita/pago` + caixa. Dois métodos (`voucher` e `vale`). | Recebível de operadora / não-caixa físico. | Entra no caixa de dinheiro indevidamente. |
| **Split / Dividir** | Payload manda só `metodo:'split'` + total → 1 lançamento `pago`. Partes não persistidas. | Um lançamento por parte, cada um com sua forma/status. | ❌ Composição perdida; `split` ≠ filtro `multiplo` do backend. |
| **Fiado** | Venda + faturamento + estoque + `receita/avencer` + contas a receber. Exige cliente+vencimento+limite. | Exatamente isso. | ✅ Correto. |

---

## D) Análise do Fiado (camada por camada)

- **Frontend** (`getFiadoData`, `confirmPayment`): exige `clienteId`, `vencimento`, bloqueia `depois < 0` (acima do limite). ✅
- **Cadastro rápido** (`criarClienteFiado`): valida CPF, deduplica por CPF, cria `Cliente` real (`POST /clientes`), retorna e vincula `clienteId`. Aparece em Clientes. ✅
- **Payload** (`_registrarVenda`): envia `clienteId`, `vencimentoFiado` e `fiado{clienteId,vencimento}`. ✅
- **Backend** (`vendas.js`): valida `cidFiado` + `vencFiado`; lançamento `status:'avencer'`, `pagoEm:null`, `vencimento`, `clienteId`. ✅
- **Financeiro**: `avencer` ≠ `pago` → fora de `/resumo`; aparece em contas a receber. ✅
- **Dashboard**: faturamento inclui (venda `concluida`); receitas excluem (só `pago`); `pendRec` inclui. ✅
- **Caixa**: `todayStats.total` soma só `metodo !== 'fiado'`. ✅

**Veredito:** parte mais bem-feita do sistema. Único cuidado: não há permissão específica para vender fiado.

---

## E) Lista de correções prioritárias

**P0 — quebra contábil grave**
- **P0-1 — Split não persiste a composição.** Enviar array de partes no payload e criar um lançamento por forma (ou ao menos gravar o breakdown).

**P1 — erro importante**
- **P1-A — Caixa mistura formas de pagamento.** Separar caixa físico (fundo + vendas em dinheiro + suprimentos − sangrias − troco) de cartão/Pix/voucher.
- **P1-B — Config do PDV só no localStorage + chave Pix hardcoded.** Criar rota `GET/PUT /api/configuracoes-pdv` (modelo já existe) e carregar a chave Pix real.
- **P1-C — Crédito/Débito como caixa instantâneo.** Definir com o contador recebível vs. à vista e MDR; no mínimo separar do caixa de dinheiro.
- **P1-D — Naming `split` vs `multiplo`** no filtro de vendas — filtro quebrado.

**P2 — melhoria**
- **P2-1 — Bandeira/parcelas do cartão não vão ao backend.**
- **P2-2 — Crédito: comprovante com juros ≠ financeiro com total base.**
- **P2-3 — Voucher/Vale entram no caixa de dinheiro.**
- **P2-4 — Reload do caixa**: `_loadTodayData` reconstrói `salesHistory` sem flag `estornada`.
- **P2-5 — Sem permissão específica para fiado/estorno**; estorno não grava `operadorId`.
- **P2-6 — descMax/precoMin não validados no backend** (só PIN de supervisor em localStorage).

**P3 — futuro**
- Integração Pix real (PSP).
- Reconciliar fechamento de caixa contra lançamentos.
- Ativar ou remover o modelo `ConfiguracaoPDV`.

---

## F) Plano de execução

**Fase 1 — Integridade do recebimento (P0/P1 contábil)**
- Persistir composição do split.
- Separar formas no caixa (dinheiro físico vs. eletrônico).
- Decidir regra de crédito/débito (recebível vs. à vista, MDR).

**Fase 2 — Dashboard/Financeiro**
- KPI de saldo de caixa real (distinto de lucro regime caixa).
- Breakdown por forma alimentado pelo split corrigido.
- Alinhar `split`/`multiplo` e total-com-juros do crédito.

**Fase 3 — Caixa e fechamento**
- Reconciliação caixa × lançamentos; estorno com operador; reload sem perder estornos.
- Config PDV no backend (rota + chave Pix real).

**Fase 4 — Contas a receber e extrato do cliente**
- Permissão para fiado; baixa de fiado como `pago` com extrato por cliente.

---

## G) Conclusão

Fiado, estoque e estorno já funcionam como ERP profissional. O que NÃO está à altura:
(1) split perde a composição; (2) caixa não distingue dinheiro de cartão/Pix; (3) crédito como
caixa instantâneo sem MDR/recebível; (4) config do PDV (incl. chave Pix) não persiste no backend.
Resolver P0-1 e P1-A/B/C eleva o PDV ao padrão profissional em todos os impactos:
faturamento, receita recebida, contas a receber, caixa, estoque, histórico, dashboard e financeiro.

### Referências de código
- Payload da venda: `pdv.html` → `_registrarVenda()` (~linha 10221) e `_buildSale()` (~10173).
- Split (sem persistência): `pdv.html` → `renderSplitItems`/`processarSplitItem` (~9696–9890); validação em `confirmPayment` (~10031).
- Pix: `gerarPixQR`/`_buildPixPayload` (~9430–9492); `simularPagamentoPix` (~9579).
- Config PDV (localStorage): `savePdvConfig` (~9977) e default `PDV_CONFIG` (~7887, chave Pix hardcoded).
- Caixa: `confirmarAbertura` (~10660), `renderFechamentoCaixa` (~10746), `confirmarFechamentoCaixa` (~10801).
- Backend venda/lançamento: `nexoerp-api/src/routes/vendas.js` (POST ~171–284, status `avencer/pago` ~266).
- Backend caixa: `nexoerp-api/src/routes/caixas.js`.
- Backend financeiro `/resumo` (só `pago`): `nexoerp-api/src/routes/financeiro.js` (~79–108).
- Schema: `nexoerp-api/prisma/schema.prisma` (`Venda` ~252, `Lancamento` ~278, `Caixa` ~366, `ConfiguracaoPDV` ~450 — sem rota).
- Dashboard KPIs: `dashboard.html` (~1673–1790).
