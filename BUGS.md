# PDV — Bugs e Melhorias

## Como usar este arquivo com Claude Code
Abra o Claude Code no VS Code, aponte para a raiz do projeto e diga:
> "Leia o BUGS.md e corrija os itens com status `[ ]` começando pelos críticos."

---

## 🔴 Críticos — corrigir antes do próximo deploy

- [x] **#7 / #24** — Remover cupom TESTE de produção
  - `'TESTE': { tipo: '%', valor: 100 }` está nos cupons ativos
  - Qualquer pessoa que saiba o código zera qualquer venda

- [x] **#1 / #10** — Limite de qty vs. estoque no carrinho
  - `addToCart()` não verifica se qty já no carrinho excede o estoque
  - Botão `+` também não tem limite — permite qty: 999 com 2 unidades em estoque

- [x] **#2** — Impressão usa `salesHistory[0]` fixo
  - `imprimirCupom(salesHistory[0])` pode imprimir a venda errada após reload
  - Deve referenciar a venda atual pelo ID, não pelo índice

- [x] **#3** — PIX gera QR sem validar chave
  - `gerarPixQR()` não verifica se a chave PIX está preenchida nas configurações
  - Gera QR inválido silenciosamente

- [x] **#4** — Race condition no cancelamento do terminal
  - `_termTimeout` pode chamar `finalizarVenda()` mesmo após o operador cancelar
  - Acontece se o cancelamento ocorrer próximo dos 1.2s da fase de aprovação

---

## 🟠 Funcionais — próximo sprint

- [x] **#11 / #22** — Qty editável no carrinho + suspendedCarts em sessionStorage
  - Operador precisa clicar `+` N vezes para mudar quantidade — sem input direto
  - Vendas suspensas somem no reload; mover para `sessionStorage` resolve

- [x] **#15** — Botão `← Sistema` sem aviso de carrinho cheio
  - Navegar com itens no carrinho não exibe confirmação
  - Todos os itens são perdidos silenciosamente

- [x] **#16** — Categorias sem produtos aparecem nos chips
  - Categorias com todos os produtos inativos ainda aparecem no filtro
  - Ao clicar exibem grid vazio sem aviso

- [x] **#5** — Split aceita gap de R$ 0,01
  - `if (rest > 0.01)` permite confirmar pagamento dividido com centavo faltando
  - Pode causar caixa desbalanceado

- [x] **#6** — Desconto em R$ sem feedback visual
  - `Math.min()` limita o desconto corretamente mas o campo não avisa o operador

- [x] **#8** — Split sem limite de itens
  - Botão "Adicionar" no pagamento dividido não tem máximo de linhas

---

## 🟡 UX — impacta o operador

- [x] **#12** — Sem preço negociado por item
  - Não há como alterar o preço de um item específico no carrinho

- [x] **#13** — Sem observação/nota na venda
  - Não é possível adicionar comentário (ex: "entrega em domicílio")

- [x] **#14** — Busca não limpa categoria ao usar Enter
  - Campo limpa mas filtro de categoria anterior permanece ativo

---

## 🟢 Melhorias — quando der

- [ ] **#19** — Badge de estoque restante no carrinho
  - Produto com estoque baixo poderia mostrar "Restam 2" no item do carrinho

- [x] **#17** — Atalho `?` / `F1` para lista de atalhos
  - Novos operadores não descobrem F6, F7, F8 etc.

- [x] **#18** — Feedback sonoro no scanner
  - Bip simples ao escanear confirma leitura sem olhar para a tela

- [x] **#23** — Ícone colorido por método no drawer de vendas
  - Verde = dinheiro, azul = cartão — leitura do histórico mais rápida

- [ ] **#20** — Tamanho dos cards configurável
  - Pequeno / médio / grande além de grade/lista

- [ ] **#21** — Produtos favoritos / mais vendidos no topo
  - Ordenar por vendas decrescentes ou fixar favoritos
