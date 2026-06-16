NexoAuth.requireAuth();
    requirePermission();

    // ═══════════════════════════════════════════════
    // DATA
    // ═══════════════════════════════════════════════

    let PRODUCTS = [];

    function _mapProduto(p) {
      return {
        id: p.id,
        nome: p.nome || '—',
        sku: p.sku || '',
        ean: p.ean || '',
        cat: p.cat || 'Outros',
        preco: p.preco || 0,
        estoque: p.estoque ?? 0,
        emoji: p.emoji || '📦',
        imagem: productImageOf(p),
        promo: !!p.destaque,
        vendas: p.vendas || 0,
        custo: p.custo,
        estoqueMin: p.estoqueMin,
        estoqueMax: p.estoqueMax,
        deposito: p.deposito,
        fornecedor: p.fornecedor,
        ncm: p.ncm,
        marca: p.marca,
        unidade: p.unidade,
        localizacao: p.posicao,
        vendaSemEstoque: !!p.vendaSemEstoque,
        controlEstoque: p.controlEstoque !== false,
      };
    }

    async function loadProdutos() {
      try {
        const r = await NexoAuth.apiFetch('/produtos');
        if (r.ok && Array.isArray(r.data)) {
          PRODUCTS = r.data
            .filter(p => p.status !== 'inativo' && p.exibirPdv !== false)
            .map(_mapProduto);
        }
      } catch (_) { }
    }


    let cart = [];
    let discType = '%';
    let selectedMethod = 'dinheiro';
    let vendaObs = '';
    let salesHistory = [];
    let todayStats = { count: 0, total: 0 };
    let aiVisible = false;
    let activeCat = null;
    let currentPage = 0;
    let pageSize = 18;

    const emptyProdsEl = document.getElementById('emptyProds');

    // ═══════════════════════════════════════════════
    // INIT
    // ═══════════════════════════════════════════════

    // ── View mode: grade / lista ──
    function setView(mode) {
      const grid = document.getElementById('prodGrid');
      const btnG = document.getElementById('btnGrid');
      const btnL = document.getElementById('btnList');
      if (mode === 'list') {
        grid.classList.add('list-mode');
        btnG.classList.remove('active');
        btnL.classList.add('active');
      } else {
        grid.classList.remove('list-mode');
        btnG.classList.add('active');
        btnL.classList.remove('active');
      }
      currentPage = 0;
      calcPageSize();
      renderProducts();
    }

    // ── Barra de estoque: cor e largura ──
    function stockBarStyle(estoque) {
      const max = 200;
      const pct = Math.min(100, Math.round((estoque / max) * 100));
      let color = 'var(--accent)';
      if (pct <= 5) color = 'var(--danger)';
      else if (pct <= 15) color = 'var(--warn)';
      return { pct, color };
    }


    // ═══════════════════════════════════════════════
    // MODAL DE CONFIRMAÇÃO
    // ═══════════════════════════════════════════════
    let _confirmCallback = null;

    function showConfirm(title, msg, onConfirm, { confirmText = 'Confirmar', icon = '⚠️' } = {}) {
      _confirmCallback = onConfirm;
      document.getElementById('confirmTitle').textContent = title;
      document.getElementById('confirmMsg').textContent = msg;
      document.getElementById('confirmIcon').textContent = icon;
      document.getElementById('confirmOkBtn').textContent = confirmText;
      document.getElementById('confirmOverlay').classList.add('open');
    }

    function _resolveConfirm(ok) {
      document.getElementById('confirmOverlay').classList.remove('open');
      if (ok && _confirmCallback) _confirmCallback();
      _confirmCallback = null;
    }

    // ── Inputs com validação ──────────────────────────
    function onDiscInput() {
      const el = document.getElementById('discInput');
      el.value = el.value.replace(/[^\d,\.]/g, '');
      updateSummary();
      if (discType === 'R$') {
        const subtotal = cart.reduce((s, c) => s + (c.preco * c.qty), 0);
        const val = parseFloat(el.value.replace(',', '.')) || 0;
        const capped = val > subtotal && subtotal > 0;
        el.style.color = capped ? 'var(--warn)' : '';
        el.title = capped ? `Desconto limitado ao subtotal: R$ ${fmt(subtotal)}` : '';
      } else {
        el.style.color = '';
        el.title = '';
      }
    }

    function onPayValueInput() {
      const el = document.getElementById('payValueInput');
      el.value = el.value.replace(/[^\d,\.]/g, '');
      calcTroco();
    }

    // Restaura vendas e stats do turno atual (operador logado) via API
    async function _loadTodayData() {
      try {
        const today = new Date().toLocaleDateString('pt-BR');
        const session = NexoAuth.getSession();
        const opId = session?.user?.id || '';
        const r = await NexoAuth.apiFetch(`/vendas?tipo=pdv&operadorId=${opId}`);
        if (!r.ok || !Array.isArray(r.data)) return;
        const hojeVendas = r.data.filter(v => v.dataStr === today);
        if (!hojeVendas.length) return;

        let count = 0, total = 0;
        hojeVendas.forEach(v => {
          if (v.status !== 'estornada') {
            count++;
            if ((v.metodo || '').toLowerCase() !== 'fiado') total += v.total || 0;
          }
        });
        todayStats = { count, total };

        // Reconstrói salesHistory para o drawer funcionar após reload
        salesHistory = hojeVendas.map(v => ({
          id: v.id,
          total: fmt(v.total || 0),
          subtotal: v.subtotal || v.total || 0,
          desconto: v.desconto || 0,
          troco: 0,
          method: v.metodo ? (v.metodo.charAt(0).toUpperCase() + v.metodo.slice(1)) : 'Dinheiro',
          brand: null,
          parcelas: null,
          client: v.cliente || 'Venda Balcão',
          cupom: null,
          time: v.horaStr || '—',
          items: (v.itens || []).reduce((s, i) => s + (i.qty || 0), 0),
          cartSnapshot: (v.itens || []).map(i => ({
            id: i.id,
            nome: i.nome || '—',
            emoji: i.emoji || '📦',
            preco: i.preco || 0,
            qty: i.qty || 0,
          })),
          estornada: v.status === 'estornada',
        }));
      } catch (_) { }
    }

    async function init() {
      NexoAuth.renderCurrentUser();
      _loadSuspended();
      await loadProdutos();
      buildCategoriasBar();
      calcPageSize();
      renderProducts();
      buildQuickCash();
      document.getElementById('payValueInput').value = '';
      document.addEventListener('keydown', handleKeys);
      updateStats();
      initCaixaUI();

      _loadTodayData().then(() => {
        updateStats();
      });
      loadCaixa().then(() => {
        initCaixaUI();
        checkCaixaOvertime();
      });

      // Verificar turno prolongado ao carregar e a cada hora
      setInterval(checkCaixaOvertime, 60 * 60 * 1000);
      let _resizeRaf = null;
      const gridResizeObserver = new ResizeObserver(() => {
        if (_resizeRaf) cancelAnimationFrame(_resizeRaf);
        _resizeRaf = requestAnimationFrame(() => { calcPageSize(); renderProducts(); });
      });
      gridResizeObserver.observe(document.getElementById('prodGridWrap'));
    }


    // ═══════════════════════════════════════════════
    // PRODUCTS
    // ═══════════════════════════════════════════════
    function handleSearchKey(e) {
      if (e.key !== 'Enter') return;
      const q = document.getElementById('searchInput').value.trim();

      // Exact EAN or SKU → scanner-style add (beep + indicator)
      if (q.length >= 3) {
        const exact = PRODUCTS.find(p =>
          (p.ean && p.ean === q) || p.sku.toLowerCase() === q.toLowerCase()
        );
        if (exact) {
          addToCart(exact.id);
          _beep(1200, 80);
          const ind = document.getElementById('barcodeIndicator');
          document.getElementById('barcodeVal').textContent = q;
          ind.classList.add('show');
          setTimeout(() => ind.classList.remove('show'), 2000);
          document.getElementById('searchInput').value = '';
          activeCat = null;
          buildCategoriasBar();
          renderProducts();
          document.getElementById('searchInput').focus();
          return;
        }
      }

      // Fallback: único resultado no filtro geral
      const list = getFiltered();
      if (list.length !== 1) return;
      addToCart(list[0].id);
      document.getElementById('searchInput').value = '';
      activeCat = null;
      buildCategoriasBar();
      renderProducts();
      document.getElementById('searchInput').focus();
    }

    function norm(s) {
      return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }

    function getFiltered() {
      const q = norm(document.getElementById('searchInput').value.trim());
      let list = q ? PRODUCTS : (activeCat ? PRODUCTS.filter(p => p.cat === activeCat) : PRODUCTS);
      if (q) list = list.filter(p =>
        norm(p.nome).includes(q) || p.sku.toLowerCase().includes(q) || p.ean === q
      );
      return [...list].sort((a, b) => norm(a.nome).localeCompare(norm(b.nome)));
    }

    const gridHeaderCount = document.getElementById('gridHeaderCount');

    function renderProducts() {
      const grid = document.getElementById('prodGrid');
      const pagination = document.getElementById('gridPagination');
      const allList = getFiltered();
      const q = document.getElementById('searchInput').value.trim();

      const totalPages = Math.max(1, Math.ceil(allList.length / pageSize));
      if (currentPage >= totalPages) currentPage = totalPages - 1;
      if (currentPage < 0) currentPage = 0;

      const list = allList.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

      if (!allList.length) {
        grid.innerHTML = '';
        grid.appendChild(emptyProdsEl);
        const hasAnyProduct = PRODUCTS.length > 0;
        emptyProdsEl.innerHTML = hasAnyProduct
          ? '<i class="bi bi-search"></i><p>Nenhum produto encontrado.<br>Tente outro termo.</p>'
          : '<i class="bi bi-box-seam"></i><p>Nenhum produto cadastrado.<br><a href="produtos.html" style="color:var(--accent)">Cadastre seus produtos</a> para começar a vender.</p>';
        emptyProdsEl.classList.add('show');
        gridHeaderCount.textContent = '';
        pagination.classList.remove('show');
        return;
      }
      emptyProdsEl.classList.remove('show');

      if (q) {
        gridHeaderCount.textContent = `${allList.length} resultado${allList.length !== 1 ? 's' : ''}`;
      } else {
        gridHeaderCount.textContent = `${allList.length} produto${allList.length !== 1 ? 's' : ''}`;
      }

      grid.innerHTML = list.map(p => {
        const inCart = cart.find(c => c.id === p.id);
        const lowStock = p.estoque > 0 && p.estoque <= 5;
        const outStock = p.estoque === 0;
        const bar = stockBarStyle(p.estoque);
        const nomeSafe = escapeHtml(p.nome);
        const skuSafe = escapeHtml(p.sku);
        return `<div class="prod-card ${outStock ? 'out' : ''}" id="pc-${p.id}" onclick="addToCart('${p.id}')" title="${nomeSafe} — ${skuSafe}">
      <div class="prod-img ${hasProductImage(p) ? 'has-photo' : ''}" style="background:${hasProductImage(p) ? 'var(--surface)' : outStock ? 'rgba(255,71,87,.04)' : 'rgba(0,200,150,.04)'}">
        ${productVisualMarkup(p)}
        ${lowStock ? `<span class="prod-low-badge">Baixo</span>` : ''}
        ${p.promo ? `<span class="prod-promo-badge">Promo</span>` : ''}
        ${inCart ? `<div style="position:absolute;top:6px;left:6px;background:var(--accent);color:#021c14;font-size:9px;font-weight:800;padding:2px 6px;border-radius:100px">${inCart.qty}x</div>` : ''}
      </div>
      <div class="prod-body">
        <div class="prod-name">${nomeSafe}</div>
        <div class="prod-price">R$ ${fmt(p.preco)}</div>
        <div class="prod-stock">${outStock ? '<span style="color:var(--danger)">Sem estoque</span>' : p.estoque + ' un'}</div>
        ${!outStock ? `<div class="prod-stock-bar"><div class="prod-stock-bar-fill" style="width:${bar.pct}%;background:${bar.color}"></div></div>` : ''}
      </div>
    </div>`;
      }).join('');

      if (totalPages > 1) {
        pagination.classList.add('show');
        document.getElementById('pagPrev').disabled = currentPage === 0;
        document.getElementById('pagNext').disabled = currentPage === totalPages - 1;
        document.getElementById('pagInfo').textContent = `${currentPage + 1} / ${totalPages}`;
      } else {
        pagination.classList.remove('show');
      }
    }

    function buildCategoriasBar() {
      const catsComEstoque = new Set(PRODUCTS.filter(p => p.estoque > 0).map(p => p.cat));
      if (activeCat && !catsComEstoque.has(activeCat)) activeCat = null;
      const cats = [...catsComEstoque].sort();
      const bar = document.getElementById('categoriasBar');
      bar.innerHTML = [null, ...cats].map(cat =>
        `<button class="cat-chip${activeCat === cat ? ' active' : ''}" onclick="selectCat(${cat === null ? 'null' : `'${escapeHtml(cat)}'`})">${cat || 'Todos'}</button>`
      ).join('');
    }

    function selectCat(cat) {
      activeCat = cat;
      currentPage = 0;
      buildCategoriasBar();
      renderProducts();
    }

    function calcPageSize() {
      const wrap = document.getElementById('prodGridWrap');
      if (!wrap) return;
      const isListMode = document.getElementById('prodGrid').classList.contains('list-mode');
      const availW = wrap.clientWidth - 32;
      const availH = wrap.clientHeight - 58;

      if (isListMode) {
        pageSize = Math.max(1, Math.floor((availH + 5) / 57));
      } else {
        const cols = Math.max(1, Math.floor((availW + 10) / 170));
        const rows = Math.max(1, Math.floor((availH + 10) / 195));
        pageSize = Math.max(1, cols * rows);
      }
    }

    function changePage(dir) {
      currentPage += dir;
      renderProducts();
    }

    // ═══════════════════════════════════════════════
    // CART
    // ═══════════════════════════════════════════════
    // ── Alerta caixa fechado ──
    function showCaixaFechadoAlert() {
      const existing = document.getElementById('caixaFechadoAlert');
      if (existing) existing.remove();

      const el = document.createElement('div');
      el.id = 'caixaFechadoAlert';

      const isFirstTime = !caixaState;

      if (isFirstTime) {
        el.className = 'caixa-fechado-alert onboarding';
        el.innerHTML = `
          <div class="cfa-header">
            <div class="cfa-icon"><i class="bi bi-cash-register"></i></div>
            <div class="cfa-text">
              <strong>Antes de vender, abra o caixa</strong>
              <span>O caixa registra o início do turno e controla o fluxo de dinheiro.</span>
            </div>
          </div>
          <div class="cfa-steps">
            <div class="cfa-step"><span class="cfa-step-num">1</span>Clique em <b style="color:var(--text);margin:0 3px">Abrir Caixa</b> abaixo</div>
            <div class="cfa-step"><span class="cfa-step-num">2</span>Informe o valor inicial em caixa</div>
            <div class="cfa-step"><span class="cfa-step-num">3</span>Pronto — comece a vender</div>
          </div>
          <button class="cfa-btn-full" onclick="openCaixa();document.getElementById('caixaFechadoAlert').remove()">
            <i class="bi bi-unlock-fill"></i> Abrir Caixa agora
          </button>`;
      } else {
        el.className = 'caixa-fechado-alert';
        el.innerHTML = `
          <div class="cfa-icon"><i class="bi bi-lock-fill"></i></div>
          <div class="cfa-text">
            <strong>Caixa fechado</strong>
            <span>Abra o caixa para adicionar produtos.</span>
          </div>
          <button class="cfa-btn" onclick="openCaixa();document.getElementById('caixaFechadoAlert').remove()">
            Abrir Caixa
          </button>`;
        setTimeout(() => { if (el.parentNode) el.remove(); }, 4000);
      }

      document.body.appendChild(el);
    }

    function _primeiraPagemAcessivel() {
      try {
        const session = JSON.parse(localStorage.getItem('nexoerp.session') || '{}');
        const user = session?.user;
        if (!user || user.isDono || user.permissions === null) return 'dashboard.html';
        const perms = user.permissions || {};
        const fallback = Object.keys(_PAGE_PERM_KEY).find(p => p !== 'pdv.html' && perms[_PAGE_PERM_KEY[p]]);
        return fallback || 'dashboard.html';
      } catch (_) { return 'dashboard.html'; }
    }

    function voltarSistema() {
      const destino = _primeiraPagemAcessivel();
      if (!cart.length) { window.location.href = destino; return; }
      showConfirm(
        'Voltar ao sistema?',
        `Há ${cart.length} item(s) no carrinho. Todos serão perdidos.`,
        () => { window.location.href = destino; },
        { confirmText: 'Sair assim mesmo', icon: '⚠️' }
      );
    }

    // CLIENT
    // ═══════════════════════════════════════════════
    // -- CPF na Nota --
    let cpfNota = '';
    const elCpfInput = document.getElementById('cpfNotaInput');
    const elCpfClear = document.getElementById('cpfClearBtn');
    const elCpfStatus = document.getElementById('cpfStatus');

    function setCpfStatus(tipo, msg) {
      elCpfStatus.className = 'cpf-nota-status' + (tipo ? ' ' + tipo : '');
      if (msg !== undefined) elCpfStatus.textContent = msg;
    }

    function handleCpfInput(el) {
      let v = el.value.replace(/\D/g, '').substring(0, 11);
      if (v.length > 9) v = v.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
      else if (v.length > 6) v = v.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
      else if (v.length > 3) v = v.replace(/(\d{3})(\d{1,3})/, '$1.$2');
      el.value = v;
      const digits = v.replace(/\D/g, '');
      elCpfClear.classList.toggle('visible', digits.length > 0);
      setCpfStatus('');
      cpfNota = '';
      if (digits.length === 11) {
        if (isValidCpf(digits)) {
          setCpfStatus('ok', '\u2713 CPF v\u00e1lido');
          cpfNota = v;
        } else {
          setCpfStatus('err', '\u2717 CPF inv\u00e1lido');
        }
      }
    }

    function validateCpf() {
      const digits = elCpfInput.value.replace(/\D/g, '');
      if (digits.length > 0 && digits.length < 11) {
        setCpfStatus('err', '\u2717 CPF incompleto');
      }
    }

    function clearCpf() {
      elCpfInput.value = '';
      elCpfClear.classList.remove('visible');
      setCpfStatus('');
      cpfNota = '';
    }

    function isValidCpf(c) {
      if (/^(\d)\1{10}$/.test(c)) return false;
      let s = 0, r;
      for (let i = 0; i < 9; i++) s += +c[i] * (10 - i);
      r = (s * 10) % 11; if (r === 10 || r === 11) r = 0;
      if (r !== +c[9]) return false;
      s = 0;
      for (let i = 0; i < 10; i++) s += +c[i] * (11 - i);
      r = (s * 10) % 11; if (r === 10 || r === 11) r = 0;
      return r === +c[10];
    }

    // ═══════════════════════════════════════════════
    // PAYMENT MODAL
    // ═══════════════════════════════════════════════
    // ── configurações de cartão ──
    let selectedBrand = 'Visa';
    let selectedParcela = 1;
    let fiadoClientes = [];
    let selectedFiadoCliente = null;
    let fiadoClientesLoaded = false;
    let fiadoCreditoData = null;

    function renderPaySummary() {
      const { subtotal, disc, total } = calcCart();
      const itemCount = cart.reduce((s, c) => s + c.qty, 0);
      const summaryItems = document.getElementById('paySummaryItems');
      const session = NexoAuth.getSession();
      const operatorName = session?.user?.name || session?.user?.email || 'PDV';

      if (summaryItems) {
        summaryItems.innerHTML = cart.map(item => `
          <div class="pay-summary-item">
            <div class="pay-summary-emoji ${hasProductImage(item) ? 'has-photo' : ''}">${productVisualMarkup(item, 'pay')}</div>
            <div>
              <div class="pay-summary-name">${escapeHtml(item.nome || 'Produto')}</div>
              <div class="pay-summary-code">Código: ${escapeHtml(String(item.codigo || item.cod || item.id || '—'))}</div>
            </div>
            <div class="pay-summary-money">
              R$ ${fmt(item.preco * item.qty)}
              <span>x${item.qty}</span>
            </div>
          </div>
        `).join('');
      }

      const setText = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
      };
      setText('paySummaryCount', `${itemCount} ${itemCount === 1 ? 'item' : 'itens'}`);
      setText('paySummarySubtotal', `R$ ${fmt(subtotal)}`);
      setText('paySummaryDiscount', disc > 0 ? `- R$ ${fmt(disc)}` : '- R$ 0,00');
      setText('paySummaryTotal', `R$ ${fmt(total)}`);
      setText('payOperatorName', operatorName);
    }

    function openPayModal() {
      if (!cart.length) return;
      const total = getTotal();
      document.getElementById('payTotalBadge').textContent = `R$ ${fmt(total)}`;
      document.getElementById('payValueInput').value = `R$ ${fmt(total)}`;
      resetFiadoForm();
      renderPaySummary();
      document.getElementById('payOverlay').classList.add('open');
      selectMethod(document.getElementById('payMethodDinheiro'), 'dinheiro');
      calcTroco();
      renderSplitItems();
    }

    function closePayModal() {
      document.getElementById('payOverlay').classList.remove('open');
      resetPixPanel();
      resetTerminalPanel();
      splitItems = [];
      vendaObs = '';
      selectedFiadoCliente = null;
      const obsEl = document.getElementById('vendaObsInput');
      if (obsEl) obsEl.value = '';
    }
    function handlePayOverlay(e) { if (e.target === document.getElementById('payOverlay')) closePayModal(); }
    function handleCancelPay() {
      if (terminalAtivo) { cancelarTerminal(); } else { closePayModal(); }
    }

    function selectMethod(el, method) {
      document.querySelectorAll('.pay-method').forEach(m => m.classList.remove('selected'));
      el.classList.add('selected');
      selectedMethod = method;

      const isCash = method === 'dinheiro';
      const isPix = method === 'pix';
      const isCard = method === 'credito' || method === 'debito';
      const isSplit = method === 'split';
      const isVoucher = method === 'voucher';
      const isFiado = method === 'fiado';
      const isVale = method === 'vale';

      // mostra/esconde seções
      resetTerminalPanel();
      document.getElementById('payValueSection').style.display = (isCard || isPix || isSplit) ? 'none' : 'block';
      document.getElementById('cardSection').style.display = isCard ? 'block' : 'none';
      document.getElementById('splitSection').style.display = isSplit ? 'block' : 'none';
      document.getElementById('pixSection').classList.toggle('show', isPix);
      document.getElementById('quickCash').style.display = isCash ? 'flex' : 'none';
      document.querySelector('.pay-footer-actions')?.classList.toggle('fiado-mode', isFiado);
      if (!pixFlowAtivo) document.querySelector('.pay-footer-actions')?.classList.remove('pix-mode');

      if (!isPix) resetPixPanel();

      document.querySelector('.pay-step-row').style.display = isFiado ? 'none' : 'flex';
      document.querySelector('.pay-methods').style.display = isFiado ? 'none' : 'grid';
      document.querySelector('.pay-step:not(.pay-proof-step)').style.display = isFiado ? 'none' : '';
      document.querySelector('.pay-proof-step').style.display = isFiado ? 'none' : '';
      document.getElementById('fiadoSection').classList.toggle('show', isFiado);

      const title = document.querySelector('.pay-header h2');
      const sub = document.querySelector('.pay-header-sub');
      if (title) title.textContent = isFiado ? 'Pagamento no Fiado' : 'Pagamento';
      if (sub) sub.textContent = isFiado ? 'Selecione o cliente ou cadastre uma venda fiada' : 'Escolha a forma de pagamento';

      const valueLabel = document.getElementById('payValueLabel');
      if (valueLabel) {
        const labels = {
          dinheiro: 'Valor recebido em dinheiro',
          voucher: 'Valor recebido em voucher',
          fiado: 'Valor fiado',
          vale: 'Valor recebido no vale refeição',
        };
        valueLabel.textContent = labels[method] || 'Valor recebido';
      }

      const confirmBtn = document.getElementById('btnConfirmPay');
      if (isPix) {
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = '<i class="bi bi-clock"></i> Aguardando PIX... <span>F12</span>';
      } else if (!terminalAtivo) {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = isFiado
          ? '<i class="bi bi-check2"></i> Confirmar fiado <span>F12</span>'
          : '<i class="bi bi-check2"></i> Confirmar pagamento <span>F12</span>';
      }

      if (isCard) {
        // débito = só à vista, crédito = parcelas
        document.getElementById('parcelasWrap').style.display = method === 'credito' ? 'block' : 'none';
        selectedBrand = 'Visa';
        selectedParcela = 1;
        // reset bandeira selecionada
        document.querySelectorAll('.brand-btn').forEach((b, i) => b.classList.toggle('selected', i === 0));
        renderParcelas();
        atualizarResumoCartao();
      }

      if (isSplit) { renderSplitItems(); updateSplitRestante(); }

      if (isVoucher || isFiado || isVale) {
        const total = getTotal();
        document.getElementById('payValueInput').value = `R$ ${fmt(total)}`;
        calcTroco();
      }

      if (isFiado) {
        ensureFiadoDefaults();
        loadFiadoClientes();
        updateFiadoSummary();
      }
    }

    function returnToPayMethods() {
      selectMethod(document.getElementById('payMethodDinheiro'), 'dinheiro');
    }

    function parseMoneyInput(value) {
      const normalized = String(value || '')
        .replace(/\s/g, '')
        .replace('R$', '')
        .replace(/\./g, '')
        .replace(',', '.')
        .replace(/[^\d.]/g, '');
      return parseFloat(normalized) || 0;
    }

    function formatDateBR(iso) {
      if (!iso) return '--/--/----';
      const [y, m, d] = iso.split('-');
      return y && m && d ? `${d}/${m}/${y}` : iso;
    }

    function defaultFiadoDueDate() {
      const d = new Date();
      d.setDate(d.getDate() + 30);
      return d.toISOString().slice(0, 10);
    }

    function ensureFiadoDefaults() {
      const venc = document.getElementById('fiadoVencInput');
      if (venc && !venc.value) venc.value = defaultFiadoDueDate();
    }

    function resetFiadoForm() {
      selectedFiadoCliente = null;
      fiadoCreditoData = null;
      const search = document.getElementById('fiadoSearchInput');
      const venc   = document.getElementById('fiadoVencInput');
      if (search) search.value = '';
      if (venc) venc.value = defaultFiadoDueDate();
      closeNovoClienteModal();
      updateFiadoSummary();
    }

    async function loadFiadoClientes() {
      if (fiadoClientesLoaded) {
        renderFiadoClientes();
        return;
      }
      const list = document.getElementById('fiadoClientesList');
      if (list) list.innerHTML = '<div class="fiado-empty">Carregando clientes...</div>';
      try {
        const r = await NexoAuth.apiFetch('/clientes?secao=clientes&status=ativo');
        fiadoClientes = r.ok ? (r.data || []).slice(0, 3) : [];
        fiadoClientesLoaded = true;
      } catch (_) {
        fiadoClientes = [];
      }
      renderFiadoClientes();
    }

    function renderFiadoClientes() {
      const list = document.getElementById('fiadoClientesList');
      if (!list) return;
      const q = (document.getElementById('fiadoSearchInput')?.value || '').trim().toLowerCase();
      const filtered = fiadoClientes
        .filter(c => !q || `${c.nome || ''} ${c.doc || ''}`.toLowerCase().includes(q))
        .slice(0, 5);

      if (!filtered.length) {
        list.innerHTML = '<div class="fiado-empty">Nenhum cliente encontrado. Clique em <strong>+ Novo cliente</strong> para cadastrar.</div>';
        return;
      }

      list.innerHTML = filtered.map(c => {
        const limite = Number(c.limite) || 0;
        const limiteLabel = limite > 0 ? `R$ ${fmt(limite)}` : 'Sem limite';
        const selected = selectedFiadoCliente?.id === c.id ? ' selected' : '';
        return `
          <div class="fiado-client${selected}" onclick="selectFiadoCliente('${c.id}')">
            <div class="fiado-avatar"><i class="bi bi-person"></i></div>
            <div>
              <div class="fiado-client-name">${escapeHtml(c.nome || 'Cliente')}</div>
              <div class="fiado-client-doc">${escapeHtml(c.doc || 'CPF não informado')}</div>
            </div>
            <div class="fiado-client-limit">Limite: <strong>${limiteLabel}</strong></div>
            <i class="bi bi-chevron-right"></i>
          </div>
        `;
      }).join('');
    }

    function selectFiadoCliente(id) {
      selectedFiadoCliente = fiadoClientes.find(c => c.id === id) || null;
      fiadoCreditoData = null;
      renderFiadoClientes();
      updateFiadoSummary();
      if (selectedFiadoCliente) loadFiadoCredito(selectedFiadoCliente.id);
    }

    async function loadFiadoCredito(clienteId) {
      if (!clienteId) { fiadoCreditoData = null; updateFiadoSummary(); return; }
      const r = await NexoAuth.apiFetch(`/clientes/${clienteId}/credito`);
      fiadoCreditoData = r.ok ? r.data : null;
      updateFiadoSummary();
    }

    function focusFiadoQuickClient() {
      openNovoClienteModal();
    }

    function openNovoClienteModal() {
      ['ncNome', 'ncTel', 'ncCpf', 'ncLimite'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.value = ''; el.classList.remove('err'); }
      });
      ['ncNomeErr', 'ncTelErr', 'ncCpfErr'].forEach(id => {
        document.getElementById(id)?.classList.remove('show');
      });
      document.getElementById('novoClienteOverlay').classList.add('open');
      setTimeout(() => document.getElementById('ncNome').focus(), 80);
    }

    function closeNovoClienteModal() {
      document.getElementById('novoClienteOverlay').classList.remove('open');
      ['ncNome', 'ncTel', 'ncCpf', 'ncLimite'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.value = ''; el.classList.remove('err'); }
      });
      ['ncNomeErr', 'ncTelErr', 'ncCpfErr'].forEach(id => {
        document.getElementById(id)?.classList.remove('show');
      });
    }

    function ncSetErr(inputId, errId, show) {
      document.getElementById(inputId).classList.toggle('err', show);
      document.getElementById(errId).classList.toggle('show', show);
    }

    async function criarClienteFiado() {
      const nomeEl  = document.getElementById('ncNome');
      const telEl   = document.getElementById('ncTel');
      const cpfEl   = document.getElementById('ncCpf');
      const nome    = nomeEl.value.trim();
      const tel     = telEl.value.trim();
      const cpfRaw  = cpfEl.value.trim();
      const cpfDigits = cpfRaw.replace(/\D/g, '');

      let ok = true;

      if (!nome) { ncSetErr('ncNome', 'ncNomeErr', true); ok = false; }
      else ncSetErr('ncNome', 'ncNomeErr', false);

      if (!tel) { ncSetErr('ncTel', 'ncTelErr', true); ok = false; }
      else ncSetErr('ncTel', 'ncTelErr', false);

      if (!cpfDigits || cpfDigits.length !== 11 || !isValidCpf(cpfDigits)) {
        ncSetErr('ncCpf', 'ncCpfErr', true); ok = false;
      } else ncSetErr('ncCpf', 'ncCpfErr', false);

      if (!ok) return;

      const restoreLoading = setButtonLoading(document.getElementById('btnCriarClienteFiado'), 'Cadastrando...');

      try {
        const busca = await NexoAuth.apiFetch(`/clientes?q=${encodeURIComponent(cpfRaw)}&secao=clientes&limit=10`);
        if (busca.ok) {
          const existente = (busca.data || []).find(c => c.doc && c.doc.replace(/\D/g, '') === cpfDigits);
          if (existente) {
            selectedFiadoCliente = existente;
            if (!fiadoClientes.find(c => c.id === existente.id)) fiadoClientes.unshift(existente);
            closeNovoClienteModal();
            renderFiadoClientes();
            updateFiadoSummary();
            NexoToast.warning(`CPF ja cadastrado - cliente ${existente.nome} selecionado.`);
            return;
          }
        }

        const limite = parseFloat(document.getElementById('ncLimite').value) || 0;

        const r = await NexoAuth.apiFetch('/clientes', {
          method: 'POST',
          body: JSON.stringify({
            nome,
            tel,
            doc: cpfRaw,
            tipo: 'pf',
            secao: 'clientes',
            limite,
            status: 'ativo',
            cadastro: new Date().toLocaleDateString('pt-BR'),
          }),
        });
        if (!r.ok) { NexoToast.error(r.message || 'Erro ao cadastrar cliente.'); return; }

        fiadoClientes.unshift(r.data);
        selectedFiadoCliente = r.data;
        fiadoCreditoData = null;
        closeNovoClienteModal();
        renderFiadoClientes();
        updateFiadoSummary();
        loadFiadoCredito(r.data.id);
        NexoToast.success(`Cliente ${r.data.nome} cadastrado.`);
      } catch (_) {
        NexoToast.error('Erro ao cadastrar cliente.');
      } finally {
        restoreLoading();
      }
    }

    function getFiadoData() {
      const total        = getTotal();
      const clienteNome  = selectedFiadoCliente?.nome || '';
      const vencimento   = document.getElementById('fiadoVencInput')?.value || defaultFiadoDueDate();
      const loading      = !!selectedFiadoCliente && fiadoCreditoData === null;
      const limiteCredito   = fiadoCreditoData?.limiteCredito  ?? Number(selectedFiadoCliente?.limite || 0);
      const totalEmAberto   = fiadoCreditoData?.totalEmAberto  ?? 0;
      const limiteDisponivel = fiadoCreditoData?.limiteDisponivel ?? (limiteCredito > 0 ? limiteCredito : 0);
      const depois = limiteCredito > 0 ? limiteDisponivel - total : 0;
      return {
        clienteId: selectedFiadoCliente?.id || null,
        clienteNome,
        limiteCredito,
        totalEmAberto,
        limiteDisponivel,
        total,
        depois,
        vencimento,
        loading,
      };
    }

    function updateFiadoSummary() {
      const d = getFiadoData();
      const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
      const dash = d.loading ? '...' : '—';
      const hasLimite = d.limiteCredito > 0;

      set('fiadoResumoLimite',    !selectedFiadoCliente ? '—' : d.loading ? '...' : hasLimite ? `R$ ${fmt(d.limiteCredito)}` : 'Sem limite');
      set('fiadoResumoEmAberto',  !selectedFiadoCliente ? '—' : d.loading ? '...' : `R$ ${fmt(d.totalEmAberto)}`);
      set('fiadoResumoDisponivel',!selectedFiadoCliente ? '—' : d.loading ? '...' : hasLimite ? `R$ ${fmt(d.limiteDisponivel)}` : '—');
      set('fiadoResumoTotal',     `R$ ${fmt(d.total)}`);
      set('fiadoResumoDepois',    !selectedFiadoCliente ? '—' : hasLimite ? `R$ ${fmt(d.depois)}` : '—');

      const dispEl = document.getElementById('fiadoResumoDisponivel');
      if (dispEl) dispEl.className = (hasLimite && d.limiteDisponivel < 0) ? 'bad' : 'good';
      const depoisEl = document.getElementById('fiadoResumoDepois');
      if (depoisEl) depoisEl.className = (hasLimite && d.depois < 0) ? 'bad' : 'good';

      const avisoSem = document.getElementById('fiadoAvisoLimite');
      if (avisoSem) avisoSem.classList.toggle('show', !!selectedFiadoCliente && !d.loading && !hasLimite);
      const avisoAcima = document.getElementById('fiadoAvisoAcimaLimite');
      if (avisoAcima) avisoAcima.classList.toggle('show', !!selectedFiadoCliente && !d.loading && hasLimite && d.depois < 0);
    }

    function selectBrand(el, brand) {
      document.querySelectorAll('.brand-btn').forEach(b => b.classList.remove('selected'));
      el.classList.add('selected');
      selectedBrand = brand;
      atualizarResumoCartao();
    }

    function renderParcelas() {
      const total = getTotal();
      const grid = document.getElementById('parcelasGrid');
      if (!grid) return;
      let html = '';
      for (let n = 1; n <= PDV_CONFIG.maxParcelas; n++) {
        const temJuros = n >= PDV_CONFIG.jurosAPartirDe;
        let valorParc, totalFinal;
        if (temJuros) {
          // juros compostos simulados
          const fator = Math.pow(1 + PDV_CONFIG.taxaJurosMensal, n);
          totalFinal = total * fator;
          valorParc = totalFinal / n;
        } else {
          valorParc = total / n;
          totalFinal = total;
        }
        const sel = selectedParcela === n ? 'selected' : '';
        const tag = temJuros
          ? `<span class="parcela-tag com-juros">+ juros</span>`
          : `<span class="parcela-tag sem-juros">sem juros</span>`;
        html += `
          <div class="parcela-btn ${sel}" onclick="selecionarParcela(${n})">
            <div class="parcela-num">${n}×</div>
            <div class="parcela-val">R$ ${fmt(valorParc)}</div>
            ${tag}
          </div>`;
      }
      grid.innerHTML = html;
      atualizarResumoCartao();
    }

    function selecionarParcela(n) {
      selectedParcela = n;
      document.querySelectorAll('.parcela-btn').forEach((el, i) => {
        el.classList.toggle('selected', i + 1 === n);
      });
      atualizarResumoCartao();
    }

    function atualizarResumoCartao() {
      const total = getTotal();
      const isDebito = selectedMethod === 'debito';
      const n = isDebito ? 1 : selectedParcela;
      const temJuros = !isDebito && n >= PDV_CONFIG.jurosAPartirDe;

      let totalFinal;
      if (temJuros) {
        totalFinal = total * Math.pow(1 + PDV_CONFIG.taxaJurosMensal, n);
      } else {
        totalFinal = total;
      }
      const valorParc = totalFinal / n;

      const desc = document.getElementById('cardResumoDesc');
      const tag = document.getElementById('cardResumoTag');
      const tot = document.getElementById('cardResumoTotal');
      if (!desc) return;

      desc.textContent = isDebito
        ? `À vista no cartão ${selectedBrand}`
        : `${n}× de R$ ${fmt(valorParc)} — ${selectedBrand}`;

      tag.className = `parcela-tag ${temJuros ? 'com-juros' : 'sem-juros'}`;
      tag.textContent = temJuros ? `Total com juros: R$ ${fmt(totalFinal)}` : 'sem juros';
      tot.textContent = `R$ ${fmt(isDebito ? total : totalFinal)}`;
    }

    function buildQuickCash() {
      const wrap = document.getElementById('quickCash');
      const notes = PDV_CONFIG.notasRapidas;
      wrap.innerHTML = notes.map(n => `<button class="qc-btn" onclick="setQuickCash(${n})">R$ ${n}</button>`).join('');
      wrap.innerHTML += `<button class="qc-btn" onclick="setExact()">Exato</button>`;
    }

    function setQuickCash(v) {
      document.getElementById('payValueInput').value = `R$ ${fmt(v)}`;
      calcTroco();
    }
    function setExact() {
      document.getElementById('payValueInput').value = `R$ ${fmt(getTotal())}`;
      calcTroco();
    }

    function calcTroco() {
      const raw = document.getElementById('payValueInput').value.replace(/[^\d,]/g, '').replace(',', '.');
      const received = parseFloat(raw) || 0;
      const total = getTotal();
      const troco = received - total;
      const el = document.getElementById('trocoVal');
      el.textContent = `R$ ${fmt(Math.abs(troco))}`;
      el.className = `t-val ${troco < 0 ? 'neg' : ''}`;
    }

    // ═══════════════════════════════════════════════
    // PIX — QR Code, Timer, Status
    // ═══════════════════════════════════════════════
    const PIX_TIMEOUT = 300; // 5 minutos em segundos
    let pixTimerInterval = null;
    let pixSecondsLeft = PIX_TIMEOUT;
    let pixPago = false;
    let pixPayloadAtual = '';
    let pixFlowAtivo = false;

    // ── helpers para geração de payload EMV-PIX ──────────────────────
    function _pixField(id, value) {
      const v = String(value);
      return `${id}${v.length.toString().padStart(2, '0')}${v}`;
    }
    function _pixCRC16(str) {
      let crc = 0xFFFF;
      for (let i = 0; i < str.length; i++) {
        crc ^= str.charCodeAt(i) << 8;
        for (let j = 0; j < 8; j++) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
      }
      return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
    }
    function _buildPixPayload(chave, valor, nome, cidade) {
      const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9 @.+\-_]/g, '').toUpperCase().trim();
      const mai = _pixField('00', 'br.gov.bcb.pix') + _pixField('01', chave);
      const body =
        _pixField('00', '01') +
        _pixField('26', mai) +
        _pixField('52', '0000') +
        _pixField('53', '986') +
        _pixField('54', parseFloat(valor).toFixed(2)) +
        _pixField('58', 'BR') +
        _pixField('59', norm(nome).substring(0, 25)) +
        _pixField('60', norm(cidade).substring(0, 15)) +
        _pixField('62', _pixField('05', '***')) +
        '6304';
      return body + _pixCRC16(body);
    }

    function gerarPixQR() {
      const total = getTotal();
      const chave = PDV_CONFIG.pixChave;
      if (!chave || !chave.trim()) {
        NexoToast.warning('Configure a chave PIX nas configurações antes de gerar o QR.');
        return;
      }
      const payload = _buildPixPayload(
        chave.trim(),
        total,
        PDV_CONFIG.pixBeneficiario || PDV_CONFIG.lojaNome || 'LOJA',
        PDV_CONFIG.pixCidade || 'BRASIL'
      );
      pixPayloadAtual = payload;

      showPixFlowScreen();
      document.getElementById('pixFlowPayload').textContent = payload;
      document.getElementById('pixKeyValue').textContent = payload;
      document.getElementById('pixSimBtn').style.display = 'inline';

      const container = document.getElementById('pixFlowQrCanvas');
      container.innerHTML = '';
      if (window._pixQrInstance) { try { window._pixQrInstance.clear(); } catch (e) { } }

      setTimeout(() => {
        window._pixQrInstance = new QRCode(container, {
          text: payload,
          width: 230, height: 230,
          colorDark: '#000000', colorLight: '#ffffff',
          correctLevel: QRCode.CorrectLevel.M,
        });
      }, 50);

      pixSecondsLeft = PIX_TIMEOUT;
      pixPago = false;
      atualizarTimerPix();
      clearInterval(pixTimerInterval);
      pixTimerInterval = setInterval(() => {
        pixSecondsLeft--;
        atualizarTimerPix();
        if (pixSecondsLeft <= 0) {
          clearInterval(pixTimerInterval);
          expirarPix();
        }
      }, 1000);
    }

    function showPixFlowScreen() {
      pixFlowAtivo = true;
      document.querySelector('.pay-step-row').style.display = 'none';
      document.querySelector('.pay-methods').style.display = 'none';
      document.querySelector('.pay-step:not(.pay-proof-step)').style.display = 'none';
      document.querySelector('.pay-proof-step').style.display = 'none';
      document.getElementById('fiadoSection').classList.remove('show');
      document.getElementById('pixFlowSection').classList.add('show');
      document.querySelector('.pay-footer-actions')?.classList.remove('fiado-mode');
      document.querySelector('.pay-footer-actions')?.classList.add('pix-mode');
      const title = document.querySelector('.pay-header h2');
      const sub = document.querySelector('.pay-header-sub');
      if (title) title.textContent = 'Pagamento via PIX';
      if (sub) sub.textContent = 'Escaneie o QR Code ou copie o código PIX';
      const cancelBtn = document.getElementById('btnCancelPay');
      if (cancelBtn) cancelBtn.innerHTML = '<i class="bi bi-x-lg"></i> Cancelar venda';
      const confirmBtn = document.getElementById('btnConfirmPay');
      if (confirmBtn) {
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = 'Aguardando pagamento... <i class="bi bi-arrow-repeat"></i>';
      }
      const progress = document.getElementById('pixFlowProgressStatus');
      const confirm = document.getElementById('pixFlowConfirmStatus');
      const statusTitle = document.getElementById('pixFlowStatusTitle');
      const statusText = document.getElementById('pixFlowStatusText');
      if (progress) progress.textContent = 'Aguardando';
      if (confirm) confirm.textContent = 'Pendente';
      if (statusTitle) statusTitle.textContent = 'Aguardando pagamento...';
      if (statusText) statusText.textContent = 'Assim que recebermos a confirmação do seu banco, a venda poderá ser finalizada.';
      document.getElementById('pixFlowSimBtn').style.display = '';
    }

    function hidePixFlowScreen() {
      pixFlowAtivo = false;
      document.getElementById('pixFlowSection')?.classList.remove('show');
      document.querySelector('.pay-footer-actions')?.classList.remove('pix-mode');
      const cancelBtn = document.getElementById('btnCancelPay');
      if (cancelBtn) cancelBtn.textContent = 'Cancelar';
    }

    function atualizarTimerPix() {
      const min = String(Math.floor(pixSecondsLeft / 60)).padStart(2, '0');
      const sec = String(pixSecondsLeft % 60).padStart(2, '0');
      const timerEl = document.getElementById('pixTimer');
      const barEl = document.getElementById('pixTimerBar');
      const flowTimer = document.getElementById('pixFlowTimer');
      if (timerEl) timerEl.textContent = `${min}:${sec}`;
      if (flowTimer) flowTimer.textContent = `${min}:${sec}`;
      const pct = (pixSecondsLeft / PIX_TIMEOUT) * 100;

      if (barEl) {
        barEl.style.width = `${pct}%`;
        barEl.classList.toggle('warn', pct <= 40 && pct > 20);
        barEl.classList.toggle('urgent', pct <= 20);
      }
      if (timerEl) timerEl.classList.toggle('urgente', pixSecondsLeft <= 60);
      if (flowTimer) flowTimer.classList.toggle('urgente', pixSecondsLeft <= 60);
    }

    function expirarPix() {
      const badge = document.getElementById('pixQrBadge');
      if (badge) { badge.className = 'pix-qr-status-badge expirado'; badge.textContent = 'Expirado'; }
      const dot = document.getElementById('pixStatusDot');
      if (dot) dot.className = 'pix-status-dot expirado';
      const txt = document.getElementById('pixStatusText');
      if (txt) txt.textContent = 'QR Code expirado. Gere um novo.';
      document.getElementById('pixSimBtn').style.display = 'none';
      const bar = document.getElementById('pixTimerBar');
      if (bar) bar.style.width = '0%';
      const timer = document.getElementById('pixTimer');
      if (timer) timer.textContent = '00:00';
      const flowTimer = document.getElementById('pixFlowTimer');
      if (flowTimer) flowTimer.textContent = '00:00';
      const statusTitle = document.getElementById('pixFlowStatusTitle');
      const statusText = document.getElementById('pixFlowStatusText');
      if (statusTitle) statusTitle.textContent = 'QR Code expirado';
      if (statusText) statusText.textContent = 'Volte para as formas de pagamento e gere um novo QR Code PIX.';
      const simFlow = document.getElementById('pixFlowSimBtn');
      if (simFlow) simFlow.style.display = 'none';
      const genBtn = document.getElementById('pixGenBtn');
      genBtn.innerHTML = '<i class="bi bi-arrow-clockwise"></i> Gerar novo QR Code';
      genBtn.style.display = '';
      document.getElementById('pixQrWrap').classList.remove('show');
    }

    function simularPagamentoPix() {
      if (pixPago || pixSecondsLeft <= 0) return;
      pixPago = true;
      clearInterval(pixTimerInterval);

      // Atualiza badge do QR
      const badge = document.getElementById('pixQrBadge');
      if (badge) { badge.className = 'pix-qr-status-badge pago'; badge.textContent = 'Pago ✓'; }

      // Atualiza status dot e texto
      const dot = document.getElementById('pixStatusDot');
      if (dot) dot.className = 'pix-status-dot pago';
      const txt = document.getElementById('pixStatusText');
      if (txt) txt.textContent = 'Pagamento confirmado!';
      document.getElementById('pixSimBtn').style.display = 'none';
      const flowStatus = document.getElementById('pixFlowProgressStatus');
      const flowConfirm = document.getElementById('pixFlowConfirmStatus');
      const statusTitle = document.getElementById('pixFlowStatusTitle');
      const statusText = document.getElementById('pixFlowStatusText');
      const flowIcon = document.getElementById('pixFlowWaitIcon');
      if (flowStatus) flowStatus.textContent = 'Confirmado';
      if (flowConfirm) flowConfirm.textContent = 'Pronto';
      if (statusTitle) statusTitle.textContent = 'Pagamento confirmado!';
      if (statusText) statusText.textContent = 'PIX recebido. Confirme para finalizar a venda.';
      if (flowIcon) { flowIcon.style.animation = 'none'; flowIcon.innerHTML = '<i class="bi bi-check-lg"></i>'; }
      document.getElementById('pixFlowSimBtn').style.display = 'none';

      // Para a barra no verde total
      const bar = document.getElementById('pixTimerBar');
      if (bar) {
        bar.style.width = '100%';
        bar.style.background = 'var(--accent)';
      }
      const timer = document.getElementById('pixTimer');
      if (timer) { timer.textContent = '✓'; timer.classList.remove('urgente'); }
      const flowTimer = document.getElementById('pixFlowTimer');
      if (flowTimer) { flowTimer.textContent = '✓'; flowTimer.classList.remove('urgente'); }

      NexoToast.success('PIX recebido! Confirme o pagamento.');

      // Habilita botão confirmar após 1s
      setTimeout(() => {
        const btn = document.getElementById('btnConfirmPay');
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = '<i class="bi bi-check2"></i> Confirmar pagamento <span>F12</span>';
        }
      }, 800);
    }

    function copiarChavePix() {
      const chave = pixPayloadAtual || document.getElementById('pixFlowPayload')?.textContent || document.getElementById('pixKeyValue')?.textContent || '';
      navigator.clipboard.writeText(chave).then(() => {
        const btn = document.getElementById('pixCopyBtn');
        const flowBtn = document.getElementById('pixFlowCopyBtn');
        if (btn) {
          btn.classList.add('copied');
          btn.innerHTML = '<i class="bi bi-check2"></i> Copiado!';
        }
        if (flowBtn) flowBtn.innerHTML = '<i class="bi bi-check2"></i> Copiado!';
        setTimeout(() => {
          if (btn) {
            btn.classList.remove('copied');
            btn.innerHTML = '<i class="bi bi-copy"></i> Copiar';
          }
          if (flowBtn) flowBtn.innerHTML = '<i class="bi bi-copy"></i> Copiar';
        }, 2000);
      }).catch(() => {
        NexoToast.warning('Não foi possível copiar automaticamente.');
      });
    }

    function resetPixPanel() {
      clearInterval(pixTimerInterval);
      pixPago = false;
      pixSecondsLeft = PIX_TIMEOUT;
      pixPayloadAtual = '';
      hidePixFlowScreen();

      const genBtn = document.getElementById('pixGenBtn');
      if (genBtn) {
        genBtn.style.display = '';
        genBtn.innerHTML = '<i class="bi bi-qr-code"></i> Gerar QR Code PIX';
      }
      const wrap = document.getElementById('pixQrWrap');
      if (wrap) wrap.classList.remove('show');

      const badge = document.getElementById('pixQrBadge');
      if (badge) { badge.className = 'pix-qr-status-badge aguardando'; badge.textContent = 'Aguardando'; }

      const dot = document.getElementById('pixStatusDot');
      if (dot) dot.className = 'pix-status-dot';

      const txt = document.getElementById('pixStatusText');
      if (txt) txt.textContent = 'Aguardando pagamento...';

      const sim = document.getElementById('pixSimBtn');
      if (sim) sim.style.display = 'none';

      const bar = document.getElementById('pixTimerBar');
      if (bar) { bar.style.width = '100%'; bar.style.background = 'var(--accent)'; }

      const timer = document.getElementById('pixTimer');
      if (timer) { timer.textContent = '05:00'; timer.classList.remove('urgente'); }
      const flowTimer = document.getElementById('pixFlowTimer');
      if (flowTimer) { flowTimer.textContent = '05:00'; flowTimer.classList.remove('urgente'); }
      const flowPayload = document.getElementById('pixFlowPayload');
      if (flowPayload) flowPayload.textContent = '—';
      const flowQr = document.getElementById('pixFlowQrCanvas');
      if (flowQr) flowQr.innerHTML = '';
    }

    // ── split ──────────────────────────────────────────────────────
    let splitItems = [];
    const SPLIT_FLOW_METHODS = ['PIX', 'Crédito', 'Débito'];
    const SPLIT_STATUS_LABEL = { pendente: 'Pendente', aguardando: 'Aguardando', confirmado: 'Confirmado ✓', recusado: 'Recusado' };

    function renderSplitItems() {
      if (!splitItems.length) splitItems = [
        { method: 'PIX', value: '', status: 'pendente' },
        { method: 'Dinheiro', value: '', status: 'pendente' }
      ];
      const METHODS = ['Dinheiro', 'PIX', 'Crédito', 'Débito', 'Voucher'];
      const wrap = document.getElementById('splitItems');

      wrap.innerHTML = splitItems.map((item, i) => {
        const val = parseFloat((item.value || '0').replace(',', '.')) || 0;
        const hasValue = val > 0;
        const requiresFlow = SPLIT_FLOW_METHODS.includes(item.method);
        const isPix = item.method === 'PIX';
        const isCard = item.method === 'Crédito' || item.method === 'Débito';
        const locked = item.status === 'aguardando' || item.status === 'confirmado';

        // Botão de ação
        let actionBtn = '';
        if (requiresFlow && hasValue && item.status === 'pendente') {
          const cls = isPix ? 'pix-btn' : 'card-btn';
          const lbl = isPix
            ? '<i class="bi bi-qr-code"></i> Gerar PIX'
            : '<i class="bi bi-phone"></i> Processar';
          actionBtn = `<button id="split-btn-${i}" class="split-process-btn ${cls}" onclick="processarSplitItem(${i})">${lbl}</button>`;
        } else if (item.status === 'recusado') {
          actionBtn = `<button id="split-btn-${i}" class="split-process-btn retry-btn" onclick="processarSplitItem(${i})"><i class="bi bi-arrow-clockwise"></i> Tentar novamente</button>`;
        }

        // Sub-painel (PIX ou terminal)
        let subPanel = '';
        if (item.status === 'aguardando' || item.status === 'confirmado') {
          const ok = item.status === 'confirmado';
          if (isPix) {
            subPanel = `
              <div class="split-sub-panel show">
                <div class="split-pix-content">
                  <div class="split-qr-frame"><div id="split-qr-${i}"></div></div>
                  <div class="pix-key-wrap" style="margin:0;width:100%">
                    <span class="pix-key-label">Valor</span>
                    <span class="pix-key-value">R$ ${fmt(val)}</span>
                  </div>
                  <div class="pix-status-row">
                    <div class="pix-status-dot ${ok ? 'pago' : ''}"></div>
                    <span>${ok ? 'Pagamento confirmado!' : 'Aguardando pagamento PIX...'}</span>
                    ${!ok ? `<button class="pix-sim-btn" onclick="simularSplitPix(${i})">Simular pagamento</button>` : ''}
                  </div>
                </div>
              </div>`;
          } else if (isCard) {
            subPanel = `
              <div class="split-sub-panel show">
                <div class="split-term-content">
                  <div class="split-term-icon ${ok ? 'aprovado' : 'aguardando'}">
                    <i class="bi ${ok ? 'bi-check-lg' : 'bi-phone'}"></i>
                  </div>
                  <span style="font-size:12px;color:var(--muted)">${ok ? 'Pagamento aprovado!' : 'Peça ao cliente para inserir o cartão'}</span>
                  ${!ok ? `
                    <div class="term-sim-btns" style="width:100%">
                      <button class="term-btn-aprovar" onclick="simularSplitAprovacao(${i})"><i class="bi bi-check2-circle"></i> Simular aprovação</button>
                      <button class="term-btn-recusar" onclick="simularSplitRecusa(${i})">Recusar</button>
                    </div>` : ''}
                </div>
              </div>`;
          }
        }

        return `
          <div class="split-item-wrap ${item.status}" id="split-wrap-${i}">
            <div class="split-item">
              <select class="split-method-sel" onchange="onSplitMethodChange(${i},this.value)" ${locked ? 'disabled' : ''}>
                ${METHODS.map(m => `<option ${m === item.method ? 'selected' : ''}>${m}</option>`).join('')}
              </select>
              <input class="split-val-inp" type="text" placeholder="R$ 0,00"
                value="${item.value}" oninput="onSplitValueInput(${i},this.value)"
                ${locked ? 'disabled' : ''}>
              <span class="split-status-badge ${item.status}">${SPLIT_STATUS_LABEL[item.status]}</span>
              ${actionBtn}
              <span class="split-remove" onclick="removeSplitItem(${i})" ${locked ? 'style="opacity:.3;pointer-events:none"' : ''}><i class="bi bi-x"></i></span>
            </div>
            ${subPanel}
          </div>`;
      }).join('');

      updateSplitRestante();
      setTimeout(_rebuildSplitQRs, 60);
    }

    function _rebuildSplitQRs() {
      splitItems.forEach((item, i) => {
        if (item.method !== 'PIX' || item.status !== 'aguardando') return;
        const container = document.getElementById(`split-qr-${i}`);
        if (!container || container.children.length > 0) return;
        const val = parseFloat((item.value || '0').replace(',', '.')) || 0;
        const chave = PDV_CONFIG.pixChave;
        const benef = PDV_CONFIG.pixBeneficiario.substring(0, 25).toUpperCase();
        const cidade = PDV_CONFIG.pixCidade.substring(0, 15).toUpperCase();
        const payload = `00020126580014br.gov.bcb.pix0136${chave}5204000053039865404${val.toFixed(2)}5913${benef}6009${cidade}62070503***6304ABCD`;
        new QRCode(container, { text: payload, width: 110, height: 110, colorDark: '#000000', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M });
      });
    }

    function onSplitMethodChange(i, method) {
      splitItems[i].method = method;
      splitItems[i].status = 'pendente';
      _autoConfirmCash(i);
      renderSplitItems();
    }

    function onSplitValueInput(i, val) {
      splitItems[i].value = val;
      const prevStatus = splitItems[i].status;
      _autoConfirmCash(i);
      updateSplitRestante();

      // Atualiza badge e borda sem re-render completo (preserva cursor)
      const wrap = document.getElementById(`split-wrap-${i}`);
      if (wrap) {
        wrap.className = `split-item-wrap ${splitItems[i].status}`;
        const badge = wrap.querySelector('.split-status-badge');
        if (badge) {
          badge.className = `split-status-badge ${splitItems[i].status}`;
          badge.textContent = SPLIT_STATUS_LABEL[splitItems[i].status];
        }
      }

      // Mostra/esconde botão de processar sem re-render (preserva foco)
      if (SPLIT_FLOW_METHODS.includes(splitItems[i].method) && splitItems[i].status === 'pendente') {
        const hasVal = parseFloat((val || '0').replace(',', '.')) > 0;
        const btn = document.getElementById(`split-btn-${i}`);
        if (hasVal && !btn && wrap) {
          const isPix = splitItems[i].method === 'PIX';
          const cls = isPix ? 'pix-btn' : 'card-btn';
          const lbl = isPix
            ? '<i class="bi bi-qr-code"></i> Gerar PIX'
            : '<i class="bi bi-phone"></i> Processar';
          const newBtn = document.createElement('button');
          newBtn.id = `split-btn-${i}`;
          newBtn.className = `split-process-btn ${cls}`;
          newBtn.innerHTML = lbl;
          newBtn.onclick = () => processarSplitItem(i);
          const removeSpan = wrap.querySelector('.split-remove');
          wrap.querySelector('.split-item').insertBefore(newBtn, removeSpan);
        } else if (!hasVal && btn) {
          btn.remove();
        }
      }
    }

    function _autoConfirmCash(i) {
      const item = splitItems[i];
      if (item.method !== 'Dinheiro' && item.method !== 'Voucher') return;
      if (item.status === 'aguardando') return; // não sobrescreve processamento ativo
      item.status = parseFloat((item.value || '0').replace(',', '.')) > 0 ? 'confirmado' : 'pendente';
    }

    function processarSplitItem(i) {
      splitItems[i].status = 'aguardando';
      renderSplitItems();
    }

    function simularSplitPix(i) {
      splitItems[i].status = 'confirmado';
      renderSplitItems();
      NexoToast.success(`PIX confirmado — parcela ${i + 1}`);
    }

    function simularSplitAprovacao(i) {
      splitItems[i].status = 'confirmado';
      renderSplitItems();
      NexoToast.success(`Cartão aprovado — parcela ${i + 1}`);
    }

    function simularSplitRecusa(i) {
      splitItems[i].status = 'recusado';
      renderSplitItems();
      NexoToast.error(`Cartão recusado — parcela ${i + 1}`);
    }

    function addSplitItem() {
      if (splitItems.length >= 5) { NexoToast.warning('Máximo de 5 parcelas no pagamento dividido.'); return; }
      splitItems.push({ method: 'Dinheiro', value: '', status: 'pendente' });
      renderSplitItems();
    }

    function removeSplitItem(i) {
      splitItems.splice(i, 1);
      renderSplitItems();
    }

    function updateSplitRestante() {
      const total = getTotal();
      const paid = splitItems.reduce((s, x) => s + (parseFloat((x.value || '0').replace(',', '.')) || 0), 0);
      const rest = Math.max(0, total - paid);
      document.getElementById('splitRestante').textContent = `R$ ${fmt(rest)}`;
    }

    // ═══════════════════════════════════════════════
    // MODAL CONFIG PDV
    // ═══════════════════════════════════════════════
    let _pdvConfigTab = 'pix';
    const ALL_NOTES = [10, 20, 50, 100, 200];

    function openPdvConfig() {
      _pdvConfigTab = 'pix';
      _renderPdvConfig();
      document.getElementById('pdvConfigOverlay').classList.add('open');
    }

    function closePdvConfig() {
      document.getElementById('pdvConfigOverlay').classList.remove('open');
    }

    function setPdvConfigTab(tab) {
      _pdvConfigTab = tab;
      document.querySelectorAll('.pdv-config-tab').forEach(t =>
        t.classList.toggle('active', t.dataset.tab === tab));
      document.querySelectorAll('.pdv-config-panel').forEach(p =>
        p.classList.toggle('show', p.dataset.panel === tab));
    }

    function _renderPdvConfig() {
      const cfg = PDV_CONFIG;

      // PIX
      document.getElementById('cfgPixTipo').value = cfg.pixTipoChave;
      document.getElementById('cfgPixChave').value = cfg.pixChave;
      document.getElementById('cfgPixBenef').value = cfg.pixBeneficiario;
      document.getElementById('cfgPixCidade').value = cfg.pixCidade;
      onCfgPixTipoChange();

      // Cartão
      document.getElementById('cfgTermOp').value = cfg.terminalOperadora;
      document.getElementById('cfgTermId').value = cfg.terminalId;
      document.getElementById('cfgMaxParcelas').value = cfg.maxParcelas;
      document.getElementById('cfgJurosAPartir').value = cfg.jurosAPartirDe;
      document.getElementById('cfgTaxaJuros').value = (cfg.taxaJurosMensal * 100).toFixed(2);
      onCfgTermOpChange();

      // Caixa — toggles
      document.getElementById('cfgExigirFundo').checked = cfg.exigirFundo;
      document.getElementById('cfgExigirOperador').checked = cfg.exigirOperador;
      document.getElementById('cfgOvertimeEnabled').checked = cfg.overtimeEnabled;
      document.getElementById('cfgOvertimeHours').value = cfg.overtimeHours;
      onCfgOvertimeChange();

      // Notas rápidas
      document.getElementById('cfgNotasGrid').innerHTML = ALL_NOTES.map(n => `
        <div class="config-note-chip ${cfg.notasRapidas.includes(n) ? 'active' : ''}"
             data-note="${n}" onclick="this.classList.toggle('active')">R$ ${n}</div>
      `).join('');

      // Cupom
      document.getElementById('cfgLojaNome').value = cfg.lojaNome;
      document.getElementById('cfgLojaCnpj').value = cfg.lojaCnpj;
      document.getElementById('cfgLojaRodape').value = cfg.lojaRodape;

      setPdvConfigTab(_pdvConfigTab);
    }

    function onCfgPixTipoChange() {
      const placeholders = {
        cpf: '000.000.000-00', cnpj: '00.000.000/0001-00',
        email: 'contato@loja.com', telefone: '+55 11 99999-9999',
        aleatoria: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      };
      const tipo = document.getElementById('cfgPixTipo').value;
      document.getElementById('cfgPixChave').placeholder = placeholders[tipo] || '';
    }

    function onCfgTermOpChange() {
      const isDemo = document.getElementById('cfgTermOp').value === 'demo';
      const termId = document.getElementById('cfgTermId');
      termId.disabled = isDemo;
      termId.placeholder = isDemo ? 'Não aplicável no modo demonstração' : 'Informe o ID do terminal';
    }

    function onCfgOvertimeChange() {
      const enabled = document.getElementById('cfgOvertimeEnabled').checked;
      document.getElementById('cfgOvertimeHoursGroup').style.display = enabled ? '' : 'none';
    }

    function savePdvConfig() {
      const taxa = parseFloat(document.getElementById('cfgTaxaJuros').value) || 0;
      const notas = [...document.querySelectorAll('.config-note-chip.active')]
        .map(c => parseInt(c.dataset.note)).sort((a, b) => a - b);

      const newConfig = {
        pixTipoChave: document.getElementById('cfgPixTipo').value,
        pixChave: document.getElementById('cfgPixChave').value.trim(),
        pixBeneficiario: document.getElementById('cfgPixBenef').value.trim(),
        pixCidade: document.getElementById('cfgPixCidade').value.trim().toUpperCase(),
        terminalOperadora: document.getElementById('cfgTermOp').value,
        terminalId: document.getElementById('cfgTermId').value.trim(),
        maxParcelas: Math.max(1, parseInt(document.getElementById('cfgMaxParcelas').value) || 12),
        jurosAPartirDe: Math.max(1, parseInt(document.getElementById('cfgJurosAPartir').value) || 4),
        taxaJurosMensal: taxa / 100,
        exigirFundo: document.getElementById('cfgExigirFundo').checked,
        exigirOperador: document.getElementById('cfgExigirOperador').checked,
        overtimeEnabled: document.getElementById('cfgOvertimeEnabled').checked,
        overtimeHours: Math.max(1, parseInt(document.getElementById('cfgOvertimeHours').value) || 8),
        notasRapidas: notas.length ? notas : [10, 20, 50, 100, 200],
        lojaNome: document.getElementById('cfgLojaNome').value.trim(),
        lojaCnpj: document.getElementById('cfgLojaCnpj').value.trim(),
        lojaRodape: document.getElementById('cfgLojaRodape').value.trim(),
      };

      localStorage.setItem(PDV_CONFIG_KEY, JSON.stringify(newConfig));
      Object.assign(PDV_CONFIG, newConfig);
      buildQuickCash();
      closePdvConfig();
      NexoToast.success('Configurações salvas');
    }

    function confirmPayment() {
      if (selectedMethod === 'pix' && !pixPago) {
        NexoToast.warning('Aguardando confirmação do PIX.');
        return;
      }
      if (selectedMethod === 'fiado') {
        const fiado = getFiadoData();
        if (!fiado.clienteId) {
          NexoToast.warning('Para venda fiado, selecione ou cadastre um cliente.');
          document.getElementById('fiadoSearchInput')?.focus();
          return;
        }
        if (!fiado.vencimento) {
          NexoToast.warning('Informe o vencimento do fiado.');
          document.getElementById('fiadoVencInput')?.focus();
          return;
        }
        if (fiado.depois < 0) {
          NexoToast.warning('Limite de crédito insuficiente para esta venda.');
          return;
        }
      }
      if (selectedMethod === 'split') {
        const total = getTotal();
        const paid = splitItems.reduce((s, x) => s + (parseFloat((x.value || '0').replace(',', '.')) || 0), 0);
        const rest = total - paid;
        if (Math.round(rest * 100) > 0) {
          NexoToast.warning(`Faltam R$ ${fmt(rest)} para completar o pagamento.`);
          return;
        }
        const unconfirmed = splitItems.filter(x => x.status !== 'confirmado');
        if (unconfirmed.length > 0) {
          const hasAguardando = unconfirmed.some(x => x.status === 'aguardando');
          NexoToast.warning(hasAguardando
            ? 'Aguardando confirmação de pagamento(s).'
            : 'Processe todos os pagamentos antes de confirmar.');
          return;
        }
      }
      const isCard = selectedMethod === 'credito' || selectedMethod === 'debito';
      if (isCard) { enviarParaMaquininha(); return; }
      finalizarVenda();
    }

    // ═══════════════════════════════════════════════
    // TERMINAL / MAQUININHA
    // ═══════════════════════════════════════════════
    let terminalAtivo = false;
    let _termTimeout = null;

    function enviarParaMaquininha() {
      const total = getTotal();
      const isDebito = selectedMethod === 'debito';
      const n = isDebito ? 1 : selectedParcela;
      const temJuros = !isDebito && n >= PDV_CONFIG.jurosAPartirDe;
      const totalFinal = temJuros ? total * Math.pow(1 + PDV_CONFIG.taxaJurosMensal, n) : total;

      terminalAtivo = true;

      // Esconde seções do modal
      document.getElementById('cardSection').style.display = 'none';
      document.querySelectorAll('.pay-method').forEach(m => m.style.pointerEvents = 'none');

      // Preenche painel
      document.getElementById('termTotal').textContent = `R$ ${fmt(isDebito ? total : totalFinal)}`;
      document.getElementById('termBandeira').textContent = selectedBrand;
      document.getElementById('termTipoLabel').textContent = isDebito ? 'Débito à vista' : `Crédito ${n}×`;

      document.getElementById('terminalSection').classList.add('show');

      // Esconde botão confirmar, muda texto cancelar
      document.getElementById('btnConfirmPay').style.display = 'none';
      document.getElementById('btnCancelPay').textContent = 'Cancelar operação';

      // Fase 1: conectando
      setTerminalStatus('enviando');

      // Fase 2: aguardando cliente (após 1.8s)
      clearTimeout(_termTimeout);
      _termTimeout = setTimeout(() => setTerminalStatus('aguardando'), 1800);
    }

    function setTerminalStatus(status) {
      const iconWrap = document.getElementById('termIconWrap');
      const icon = document.getElementById('termIcon');
      const badge = document.getElementById('termBadge');
      const msg = document.getElementById('termMsg');
      const sub = document.getElementById('termSub');
      const simBtns = document.getElementById('termSimBtns');
      const demoLabel = document.getElementById('termDemoLabel');

      iconWrap.className = `term-icon-wrap ${status}`;
      badge.className = `term-badge ${status}`;

      if (status === 'enviando') {
        icon.className = 'bi bi-phone';
        badge.textContent = 'Conectando...';
        msg.textContent = 'Conectando à maquininha';
        sub.textContent = 'Estabelecendo comunicação com o terminal de pagamento';
        simBtns.style.display = 'none';
        demoLabel.textContent = '';
      } else if (status === 'aguardando') {
        icon.className = 'bi bi-phone';
        badge.textContent = 'Aguardando';
        msg.textContent = 'Aguardando o cliente';
        sub.textContent = 'Peça ao cliente para aproximar, inserir ou passar o cartão na maquininha';
        simBtns.style.display = 'flex';
        demoLabel.textContent = 'Modo demonstração — simule a resposta da maquininha';
      } else if (status === 'aprovado') {
        icon.className = 'bi bi-check-lg';
        badge.textContent = 'Aprovado ✓';
        msg.textContent = 'Pagamento aprovado!';
        sub.textContent = 'Transação autorizada pela operadora';
        simBtns.style.display = 'none';
        demoLabel.textContent = '';
      } else if (status === 'recusado') {
        icon.className = 'bi bi-x-lg';
        badge.textContent = 'Não autorizado';
        msg.textContent = 'Pagamento não autorizado';
        sub.textContent = 'Tente outro cartão ou selecione outra forma de pagamento';
        simBtns.style.display = 'none';
        demoLabel.textContent = '';
      }
    }

    function simularAprovacaoTerminal() {
      setTerminalStatus('aprovado');
      NexoToast.success('Pagamento aprovado pela operadora!');
      clearTimeout(_termTimeout);
      _termTimeout = setTimeout(() => { if (terminalAtivo) finalizarVenda(); }, 1200);
    }

    function simularRecusaTerminal() {
      setTerminalStatus('recusado');
      NexoToast.error('Pagamento recusado. Tente outro cartão.');
      clearTimeout(_termTimeout);
      // Volta ao estado de seleção de cartão após 2.5s
      _termTimeout = setTimeout(() => {
        cancelarTerminal();
        document.getElementById('cardSection').style.display = 'block';
      }, 2500);
    }

    function cancelarTerminal() {
      terminalAtivo = false;
      clearTimeout(_termTimeout);
      document.getElementById('terminalSection').classList.remove('show');
      document.getElementById('btnConfirmPay').style.display = '';
      document.getElementById('btnCancelPay').textContent = 'Cancelar';
      document.querySelectorAll('.pay-method').forEach(m => m.style.pointerEvents = '');
    }

    function resetTerminalPanel() {
      terminalAtivo = false;
      clearTimeout(_termTimeout);
      const section = document.getElementById('terminalSection');
      if (section) section.classList.remove('show');
      const confirmBtn = document.getElementById('btnConfirmPay');
      if (confirmBtn) confirmBtn.style.display = '';
      const cancelBtn = document.getElementById('btnCancelPay');
      if (cancelBtn) cancelBtn.textContent = 'Cancelar';
      document.querySelectorAll('.pay-method').forEach(m => m.style.pointerEvents = '');
    }

    function _buildSale(total) {
      const subtotal = cart.reduce((s, c) => s + (c.preco * c.qty), 0);
      const isCard = selectedMethod === 'credito' || selectedMethod === 'debito';
      const isFiado = selectedMethod === 'fiado';
      const fiadoData = isFiado ? getFiadoData() : null;

      let troco = 0;
      if (selectedMethod === 'dinheiro') {
        const recebido = parseFloat(document.getElementById('payValueInput').value.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
        troco = Math.max(0, recebido - total);
      }

      let totalCartao = total;
      if (selectedMethod === 'credito' && selectedParcela >= PDV_CONFIG.jurosAPartirDe) {
        totalCartao = total * Math.pow(1 + PDV_CONFIG.taxaJurosMensal, selectedParcela);
      }

      let methodLabel = selectedMethod.charAt(0).toUpperCase() + selectedMethod.slice(1);
      if (isCard) {
        const n = selectedMethod === 'debito' ? 1 : selectedParcela;
        methodLabel = `${selectedBrand} ${n}×`;
      } else if (isFiado) {
        methodLabel = 'Fiado';
      }

      return {
        id: `#V${4900 + salesHistory.length + 1}`,
        total: fmt(isCard ? totalCartao : total),
        subtotal,
        desconto: subtotal - total,
        troco,
        method: methodLabel,
        brand: isCard ? selectedBrand : null,
        parcelas: isCard ? (selectedMethod === 'debito' ? 1 : selectedParcela) : null,
        client: isFiado
          ? (fiadoData.clienteNome || 'Venda fiada')
          : (cpfNota ? `CPF: ${cpfNota}` : 'Venda Balcão'),
        cupom: cupomAtivo ? cupomAtivo.codigo : null,
        obs: isFiado
          ? [vendaObs, fiadoData.obs, `Vencimento: ${formatDateBR(fiadoData.vencimento)}`].filter(Boolean).join(' · ')
          : (vendaObs || null),
        fiado: fiadoData,
        time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        items: cart.reduce((s, c) => s + c.qty, 0),
        cartSnapshot: cart.map(c => ({ ...c })),
      };
    }

    async function _registrarVenda(sale, total) {
      const session = NexoAuth.getSession();
      const operador = session?.user?.name || 'PDV';
      const operadorId = session?.user?.id || null;
      const now = new Date();

      const _isFiado = selectedMethod === 'fiado';
      const payload = {
        cliente: sale.client || 'Venda Balcão',
        ...(_isFiado && sale.fiado?.clienteId ? { clienteId: sale.fiado.clienteId } : {}),
        operador,
        operadorId,
        metodo: selectedMethod || 'dinheiro',
        itens: (sale.cartSnapshot || []).map(c => ({
          id: c.id,
          nome: c.nome || '',
          emoji: c.emoji || '📦',
          preco: c.preco,
          qty: c.qty,
          subtotal: c.preco * c.qty,
        })),
        subtotal: sale.subtotal,
        desconto: sale.desconto || 0,
        total,
        obs: sale.obs || null,
        tipo: 'pdv',
        dataStr: now.toLocaleDateString('pt-BR'),
        horaStr: sale.time || now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        ...(_isFiado && sale.fiado ? {
          vencimentoFiado: sale.fiado.vencimento,
          fiado: {
            clienteId:  sale.fiado.clienteId,
            vencimento: sale.fiado.vencimento,
          },
        } : {}),
      };

      const r = await NexoAuth.apiFetch('/vendas', { method: 'POST', body: JSON.stringify(payload) });
      if (!r.ok) throw new Error(r.message || 'Erro ao registrar venda');

      // Usa o id gerado pela API
      sale.id = r.data.id;

      salesHistory.unshift(sale);
      todayStats.count++;
      if (selectedMethod !== 'fiado') todayStats.total += total;
      updateStats();
      cupomAtivo = null;
      updateCupomBadge();

      // Atualiza estoque local para reflectir o UI imediatamente
      (sale.cartSnapshot || []).forEach(item => {
        const prod = PRODUCTS.find(p => p.id === item.id);
        if (prod) {
          if (prod.controlEstoque !== false) prod.estoque = Math.max(0, prod.estoque - item.qty);
          prod.vendas = (prod.vendas || 0) + item.qty;
        }
      });
    }

    let _successTimer = null;

    function _mostrarSucesso(sale, total) {
      document.getElementById('successTotal').textContent = `R$ ${fmt(total)}`;
      document.getElementById('successSubtitle').textContent = `${sale.method} · ${sale.client}`;
      const sid = sale.id;
      document.getElementById('successActions').innerHTML = `
        <hr class="suc-divider">
        <div class="suc-label">Compartilhar cupom</div>
        <div class="suc-share-row">
          <button id="sucPrintBtn" class="suc-btn share" onclick="_cancelSuccessTimer();imprimirCupom(salesHistory.find(s=>s.id==='${sid}'))">
            <i class="bi bi-printer"></i>Imprimir
          </button>
          <button class="suc-btn share" onclick="_cancelSuccessTimer();_compartilharEmail(salesHistory.find(s=>s.id==='${sid}'))">
            <i class="bi bi-envelope"></i>E-mail
          </button>
          <button class="suc-btn share" onclick="_cancelSuccessTimer();_compartilharWhatsApp(salesHistory.find(s=>s.id==='${sid}'))">
            <i class="bi bi-whatsapp"></i>WhatsApp
          </button>
        </div>
        <button class="suc-btn primary" onclick="_cancelSuccessTimer();closeSuccess()">
          <i class="bi bi-plus-lg"></i> Nova Venda
        </button>
        <div class="suc-progress" id="sucProgress"><div class="suc-progress-bar" id="sucProgressBar"></div></div>
        <div class="suc-countdown" id="sucCountdown">Fechando em <span id="sucCountNum">10</span>s · <span style="cursor:pointer;text-decoration:underline" onclick="_cancelSuccessTimer()">manter aberto</span></div>
      `;
      document.getElementById('successOverlay').classList.add('show');

      // Progress bar animation
      requestAnimationFrame(() => {
        const bar = document.getElementById('sucProgressBar');
        if (bar) bar.classList.add('running');
      });

      // Auto-close countdown
      let secs = 10;
      _successTimer = setInterval(() => {
        secs--;
        const el = document.getElementById('sucCountNum');
        if (el) el.textContent = secs;
        if (secs <= 0) { _cancelSuccessTimer(); closeSuccess(); }
      }, 1000);
    }

    function _cancelSuccessTimer() {
      if (_successTimer) { clearInterval(_successTimer); _successTimer = null; }
      const prog = document.getElementById('sucProgress');
      const cd = document.getElementById('sucCountdown');
      if (prog) prog.style.display = 'none';
      if (cd) cd.style.display = 'none';
    }

    async function finalizarVenda() {
      const btn = document.getElementById('btnConfirmPay');
      const restoreLoading = setButtonLoading(btn, 'Finalizando...');
      try {
        const total = getTotal();
        const sale = _buildSale(total);
        await _registrarVenda(sale, total);
        closePayModal();
        _mostrarSucesso(sale, total);
        clearCart();
      } catch (err) {
        NexoToast.error(err.message || 'Erro ao registrar venda. Tente novamente.');
      } finally {
        restoreLoading();
      }
    }

    function closeSuccess() {
      _cancelSuccessTimer();
      document.getElementById('successOverlay').classList.remove('show');
      document.getElementById('searchInput').value = '';
      activeCat = null;
      currentPage = 0;
      buildCategoriasBar();
      renderProducts();
    }

    function updateStats() { /* stats exibidos no drawer de turno */ }

    // ═══════════════════════════════════════════════
    // DRAWER — HISTÓRICO
    // ═══════════════════════════════════════════════
    function _methodBadge(method) {
      const m = (method || '').toLowerCase();
      let icon = 'bi-wallet2', color = 'var(--muted)';
      if (m.includes('dinheiro')) { icon = 'bi-cash-coin'; color = '#00c896'; }
      else if (m.includes('pix')) { icon = 'bi-qr-code'; color = '#00b4ff'; }
      else if (m.includes('créd') || m.includes('cred')) { icon = 'bi-credit-card-fill'; color = '#a78bfa'; }
      else if (m.includes('déb') || m.includes('deb')) { icon = 'bi-credit-card'; color = '#818cf8'; }
      else if (m.includes('voucher')) { icon = 'bi-ticket-perforated'; color = '#fb923c'; }
      else if (m.includes('split')) { icon = 'bi-intersect'; color = '#94a3b8'; }
      return `<i class="bi ${icon}" style="color:${color}"></i> <span style="color:${color};font-weight:600">${escapeHtml(method)}</span>`;
    }

    function openDrawer() {
      renderDrawer();
      document.getElementById('salesDrawer').classList.add('open');
      document.getElementById('drawerBackdrop').classList.add('open');
    }

    function closeDrawer() {
      document.getElementById('salesDrawer').classList.remove('open');
      document.getElementById('drawerBackdrop').classList.remove('open');
    }
    function renderDrawer() {
      const body = document.getElementById('drawerBody');
      const turnoEl = document.getElementById('drawerTurno');

      turnoEl.innerHTML = todayStats.count
        ? `<span class="drawer-turno-label">${todayStats.count} venda${todayStats.count !== 1 ? 's' : ''} no turno</span>
           <span class="drawer-turno-val">R$ ${fmt(todayStats.total)}</span>`
        : `<span class="drawer-turno-label">Nenhuma venda no turno</span><span class="drawer-turno-val">R$ 0,00</span>`;

      if (!salesHistory.length) {
        body.innerHTML = `
          <div class="drawer-empty">
            <i class="bi bi-receipt"></i>
            <p>Nenhuma venda realizada ainda.<br>As vendas do turno aparecerão aqui.</p>
          </div>`;
        return;
      }

      const ultimas = salesHistory.slice(0, 5);
      body.innerHTML = ultimas.map(v => {
        const itens = (v.cartSnapshot || []).slice(0, 4).map(i =>
          `<div class="venda-item-row">
            <span>${escapeHtml(i.nome.substring(0, 26))}${i.nome.length > 26 ? '…' : ''} ×${i.qty}</span>
            <span>R$ ${fmt(i.preco * i.qty)}</span>
          </div>`
        ).join('');
        const maisItens = (v.cartSnapshot || []).length > 4
          ? `<div class="venda-item-row"><span style="color:var(--muted);font-style:italic">+ ${v.cartSnapshot.length - 4} item(s)…</span><span></span></div>`
          : '';
        const idx = salesHistory.indexOf(v);
        const isEstornada = !!v.estornada;
        return `
          <div class="venda-item${isEstornada ? ' estornada' : ''}">
            <div class="venda-top">
              <span class="venda-id">${escapeHtml(v.id)}${isEstornada ? '<span class="venda-estorno-badge">Estornada</span>' : ''}</span>
              <span class="venda-total${isEstornada ? ' riscado' : ''}">R$ ${escapeHtml(v.total)}</span>
            </div>
            <div class="venda-info">
              <span><i class="bi bi-clock"></i> ${escapeHtml(v.time)}</span>
              <span>${_methodBadge(v.method)}</span>
              <span><i class="bi bi-person"></i> ${escapeHtml(v.client)}</span>
            </div>
            <div class="venda-items-list">${itens}${maisItens}</div>
            <div class="venda-actions" style="margin-top:10px">
              <button class="venda-btn primary" onclick="imprimirCupom(salesHistory[${idx}])">
                <i class="bi bi-printer"></i> Reimprimir
              </button>
              ${!isEstornada ? `<button class="venda-btn danger-btn" onclick="estornarVenda(${idx})">
                <i class="bi bi-arrow-counterclockwise"></i> Estornar
              </button>` : ''}
            </div>
          </div>`;
      }).join('');
    }

    function estornarVenda(idx) {
      const sale = salesHistory[idx];
      if (!sale || sale.estornada) return;
      showConfirm(
        'Estornar venda?',
        `${sale.id} · R$ ${sale.total} · ${sale.method}. O estoque será devolvido e o valor subtraído do turno.`,
        async () => {
          try {
            const r = await NexoAuth.apiFetch(`/vendas/${sale.id}`, {
              method: 'PUT',
              body: JSON.stringify({ status: 'estornada', estornoMotivo: 'Estorno manual PDV' }),
            });
            if (!r.ok) { NexoToast.error(r.message || 'Erro ao estornar venda'); return; }

            sale.estornada = true;
            const val = parseFloat(String(sale.total).replace(/\./g, '').replace(',', '.')) || 0;
            todayStats.count = Math.max(0, todayStats.count - 1);
            if ((sale.method || '').toLowerCase() !== 'fiado')
              todayStats.total = Math.max(0, todayStats.total - val);

            // Reverte estoque local
            (sale.cartSnapshot || []).forEach(item => {
              const prod = PRODUCTS.find(p => p.id === item.id);
              if (prod) prod.estoque += item.qty;
            });

            updateStats();
            renderProducts();
            renderDrawer();
            NexoToast.success(`Venda ${sale.id} estornada`);
          } catch (err) {
            NexoToast.error('Erro ao estornar: ' + err.message);
          }
        },
        { confirmText: 'Estornar', icon: '↩️' }
      );
    }

    // ═══════════════════════════════════════════════
    // NEXO AI
    // ═══════════════════════════════════════════════
    function toggleAI() { aiVisible = !aiVisible; document.getElementById('aiPanel').classList.toggle('show', aiVisible); updateAI(); }

    function updateAI() {
      const suggestions = [];
      if (cart.find(c => c.cat === 'Alimentos')) suggestions.push({ icon: 'bi-cup-hot', text: `<strong>Café Torrado 500g</strong> combina bem com itens de alimentos.` });
      if (cart.find(c => c.id === 9)) suggestions.push({ icon: 'bi-stars', text: `Clientes que compram água também levam <strong>Biscoito Recheado</strong>.` });
      if (cart.length > 0) {
        const subtotal = cart.reduce((s, c) => s + (c.preco * c.qty), 0);
        if (subtotal < 50) suggestions.push({ icon: 'bi-graph-up-arrow', text: `Ticket atual <strong>R$ ${fmt(subtotal)}</strong>. Sugerir um item adicional pode aumentar o ticket.` });
      }
      const low = PRODUCTS.filter(p => p.estoque > 0 && p.estoque <= 5);
      if (low.length) suggestions.push({ icon: 'bi-exclamation-triangle', text: `<strong>${low[0].nome}</strong> com estoque crítico (${low[0].estoque} un).` });
      if (!suggestions.length) suggestions.push({ icon: 'bi-lightbulb', text: `Carrinho vazio. Busque por nome ou use o código de barras.` });
      document.getElementById('aiSuggestions').innerHTML = suggestions.slice(0, 3).map(s => `
    <div class="ai-suggestion"><i class="bi ${s.icon}"></i><span>${s.text}</span></div>
  `).join('');
    }

    // ═══════════════════════════════════════════════
    // KEYBOARD SHORTCUTS
    // ═══════════════════════════════════════════════
    function handleKeys(e) {
      const tag = document.activeElement.tagName;

      // Enter no modal de sucesso → aciona imprimir
      if (e.key === 'Enter' && document.getElementById('successOverlay').classList.contains('show')) {
        e.preventDefault();
        document.getElementById('sucPrintBtn')?.click();
        return;
      }

      const anyModalOpen = document.getElementById('payOverlay').classList.contains('open') ||
        document.getElementById('caixaOverlay').classList.contains('open') ||
        document.getElementById('cupomOverlay').classList.contains('open') ||
        document.getElementById('estoqueOverlay').classList.contains('open');

      // Redireciona qualquer tecla alfanumérica para a busca se nenhum input estiver ativo
      if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT' && !anyModalOpen) {
        if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
          document.getElementById('searchInput').focus();
        }
      }

      if (document.getElementById('payOverlay').classList.contains('open')) {
        const payShortcutMap = {
          F1: ['pix', '.pay-method:nth-child(1)'],
          F2: ['dinheiro', '#payMethodDinheiro'],
          F3: ['debito', '.pay-method:nth-child(3)'],
          F4: ['credito', '.pay-method:nth-child(4)'],
          F5: ['voucher', '.pay-method:nth-child(5)'],
          F6: ['fiado', '.pay-method:nth-child(6)'],
          F7: ['vale', '.pay-method:nth-child(7)'],
          F8: ['split', '#payMethodSplit'],
        };

        if (payShortcutMap[e.key]) {
          e.preventDefault();
          const [method, selector] = payShortcutMap[e.key];
          const el = document.querySelector(selector);
          if (el) selectMethod(el, method);
          return;
        }
        if (e.key === 'F12') {
          e.preventDefault();
          document.getElementById('btnConfirmPay')?.click();
          return;
        }
      }

      // F1 / ? — atalhos
      if (e.key === 'F1' || e.key === '?') { e.preventDefault(); openAtalhos(); return; }
      // F3 — focus search
      if (e.key === 'F3') { e.preventDefault(); document.getElementById('searchInput').focus(); return; }
      // F4 — CPF na nota
      if (e.key === 'F4') { e.preventDefault(); document.getElementById('cpfNotaInput').focus(); return; }
      // F2 — finalizar
      if (e.key === 'F2') { e.preventDefault(); if (cart.length) openPayModal(); return; }
      // F5 — últimas vendas
      if (e.key === 'F5') { e.preventDefault(); openDrawer(); return; }
      // F6 — suspender venda / abrir suspensas
      if (e.key === 'F6') { e.preventDefault(); suspendBtnClick(); return; }
      // F7 — painel de vendas suspensas
      if (e.key === 'F7') { e.preventDefault(); if (suspendedCarts.length) openSuspendedPanel(); else NexoToast.info('Nenhuma venda suspensa.'); return; }
      // F8 — estoque simplificado
      if (e.key === 'F8') { e.preventDefault(); openEstoqueModal(); return; }
      // DEL — remove último item / Ctrl+DEL — limpa carrinho
      if (e.key === 'Delete') {
        if (anyModalOpen) return;
        e.preventDefault();
        if (e.ctrlKey) { clearCart(); }
        else if (cart.length) { changeQty(cart[cart.length - 1].id, -1); }
        return;
      }
      // ESC — fechar modais (do mais aninhado pro mais externo)
      if (e.key === 'Escape') {
        const cfa = document.getElementById('caixaFechadoAlert');
        if (cfa) { cfa.remove(); return; }
        if (document.getElementById('pinOverlay')?.classList.contains('open'))          { closePinModal(); return; }
        if (document.getElementById('itemEditOverlay')?.classList.contains('open'))     { closeItemEdit(); return; }
        if (document.getElementById('confirmOverlay').classList.contains('open'))       { _resolveConfirm(false); return; }
        if (document.getElementById('cupomOverlay').classList.contains('open'))         { closeCupom(); return; }
        if (document.getElementById('caixaOverlay').classList.contains('open'))         { closeCaixa(); return; }
        if (document.getElementById('pdvConfigOverlay').classList.contains('open'))     { closePdvConfig(); return; }
        if (document.getElementById('atalhosOverlay').classList.contains('open'))       { closeAtalhos(); return; }
        if (document.getElementById('estoqueOverlay').classList.contains('open'))       { closeEstoqueModal(); return; }
        if (document.getElementById('suspendedOverlay').classList.contains('open'))     { closeSuspendedPanel(); return; }
        if (document.getElementById('suspendLabelOverlay').classList.contains('open'))  { closeSuspendLabelModal(); return; }
        closePayModal(); closeDrawer();
        _cancelSuccessTimer();
        document.getElementById('successOverlay').classList.remove('show');
        document.getElementById('aiPanel').classList.remove('show'); aiVisible = false;
        return;
      }
    }


    // ═══════════════════════════════════════════════
    // CAIXA — Abertura, Fechamento, Sangria, Suprimento
    // ═══════════════════════════════════════════════
    let caixaState = null;
    let caixaStatusLoaded = false;
    let caixaLoadPromise = null;
    let caixaLoadFailed = false;
    let caixaTab = 'sangria';

    async function loadCaixa() {
      if (caixaLoadPromise) return caixaLoadPromise;

      caixaLoadPromise = (async () => {
        try {
          const r = await NexoAuth.apiFetch('/caixas/aberto');
          caixaLoadFailed = !r.ok;
          if (r.ok) caixaState = r.data;
          return r;
        } catch (err) {
          caixaLoadFailed = true;
          return { ok: false, error: err };
        } finally {
          caixaStatusLoaded = true;
          caixaLoadPromise = null;
        }
      })();

      return caixaLoadPromise;
    }

    function isCaixaAberto() { return caixaState && caixaState.aberto; }

    function setButtonLoading(btn, label) {
      if (!btn) return () => {};
      const previousHtml = btn.innerHTML;
      const previousDisabled = btn.disabled;
      btn.disabled = true;
      btn.innerHTML = `<i class="bi bi-arrow-repeat"></i> ${label}`;
      return () => {
        btn.disabled = previousDisabled;
        btn.innerHTML = previousHtml;
      };
    }

    function initCaixaUI() {
      const btn = document.getElementById('caixaBtn');
      const label = document.getElementById('caixaBtnLabel');
      if (!caixaStatusLoaded) {
        btn && btn.classList.add('fechado');
        if (label) label.textContent = 'Carregando caixa...';
        return;
      }
      if (caixaLoadFailed) {
        btn && btn.classList.add('fechado');
        if (label) label.textContent = 'Erro no caixa';
        return;
      }
      if (isCaixaAberto()) {
        const nome = caixaState.operador || 'Operador';
        btn && btn.classList.remove('fechado');
        if (label) label.textContent = `Caixa — ${nome}`;
      } else {
        btn && btn.classList.add('fechado');
        if (label) label.textContent = 'Abrir Caixa';
      }
    }

    function renderCaixaLoading() {
      document.getElementById('caixaModalTitle').textContent = 'Carregando Caixa';
      document.getElementById('caixaModalBody').innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;min-height:220px;color:var(--muted);text-align:center">
          <i class="bi bi-arrow-repeat" style="font-size:34px;color:var(--accent)"></i>
          <div>
            <strong style="display:block;color:var(--text);font-size:15px;margin-bottom:4px">Verificando status do caixa...</strong>
            <span style="font-size:13px">Aguarde um instante.</span>
          </div>
        </div>`;
      document.getElementById('caixaModalFooter').innerHTML = `
        <button class="cm-btn ghost" onclick="closeCaixa()">Fechar</button>`;
    }

    function renderCaixaLoadError() {
      document.getElementById('caixaModalTitle').textContent = 'Erro no Caixa';
      document.getElementById('caixaModalBody').innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;min-height:220px;color:var(--muted);text-align:center">
          <i class="bi bi-exclamation-triangle" style="font-size:34px;color:var(--warn)"></i>
          <div>
            <strong style="display:block;color:var(--text);font-size:15px;margin-bottom:4px">Nao foi possivel carregar o caixa.</strong>
            <span style="font-size:13px">Verifique a conexao e tente novamente.</span>
          </div>
        </div>`;
      document.getElementById('caixaModalFooter').innerHTML = `
        <button class="cm-btn ghost" onclick="closeCaixa()">Fechar</button>
        <button class="cm-btn confirm" onclick="openCaixa(true)"><i class="bi bi-arrow-clockwise"></i> Tentar novamente</button>`;
    }

    async function openCaixa(forceReload = false) {
      if (forceReload) {
        caixaStatusLoaded = false;
        caixaState = null;
        caixaLoadFailed = false;
      }
      document.getElementById('caixaOverlay').classList.add('open');
      if (!caixaStatusLoaded) {
        renderCaixaLoading();
        const r = await loadCaixa();
        initCaixaUI();
        if (!document.getElementById('caixaOverlay').classList.contains('open')) return;
        if (!r?.ok && !caixaState) {
          renderCaixaLoadError();
          return;
        }
      }
      if (caixaLoadFailed) {
        renderCaixaLoadError();
        return;
      }
      if (!isCaixaAberto()) renderAberturaCaixa();
      else { caixaTab = 'sangria'; renderCaixaAberto(); }
    }

    function closeCaixa() {
      document.getElementById('caixaOverlay').classList.remove('open');
    }

    function renderAberturaCaixa() {
      const _sess = NexoAuth.getSession();
      const _nomeOp = escapeHtml(_sess?.user?.name || '');
      document.getElementById('caixaModalTitle').textContent = 'Abrir Caixa';
      document.getElementById('caixaModalBody').innerHTML = `
        <p style="color:var(--muted);font-size:13px;margin-bottom:18px">Informe o fundo de troco para iniciar o turno.</p>
        <div class="caixa-input-group">
          <label>Operador</label>
          <input class="caixa-input" id="caixaOperador" type="text" value="${_nomeOp}" placeholder="Nome">
        </div>
        <div class="caixa-input-group">
          <label>Fundo de troco (R$)</label>
          <input class="caixa-input big" id="caixaFundo" type="number" min="0" step="0.01" placeholder="0,00" value="200">
        </div>
        <div class="caixa-input-group">
          <label>Observação (opcional)</label>
          <input class="caixa-input" id="caixaObs" type="text" placeholder="Ex: Turno manhã">
        </div>`;
      document.getElementById('caixaModalFooter').innerHTML = `
        <button class="cm-btn ghost" onclick="closeCaixa()">Cancelar</button>
        <button class="cm-btn confirm" onclick="confirmarAbertura()"><i class="bi bi-unlock-fill"></i> Abrir Caixa</button>`;
    }

    async function confirmarAbertura() {
      const fundo = parseFloat(document.getElementById('caixaFundo').value) || 0;
      const operador = document.getElementById('caixaOperador').value || 'Operador';
      const obs = document.getElementById('caixaObs').value;
      const session = NexoAuth.getSession();
      const aberturaStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const restoreLoading = setButtonLoading(document.querySelector('#caixaModalFooter .cm-btn.confirm'), 'Abrindo...');

      try {
        const r = await NexoAuth.apiFetch('/caixas', {
          method: 'POST',
          body: JSON.stringify({ operador, operadorId: session?.user?.id || null, fundo, obs, aberturaStr }),
        });

        if (!r.ok) { NexoToast.error('Erro ao abrir caixa'); return; }

        caixaStatusLoaded = true;
        caixaLoadFailed = false;
        caixaState = r.data;
        initCaixaUI(); closeCaixa();
        NexoToast.success('Caixa aberto - fundo R$ ' + fmt(fundo));
      } catch (_) {
        NexoToast.error('Erro ao abrir caixa');
      } finally {
        restoreLoading();
      }
    }

    function renderCaixaAberto() {
      const tab = caixaTab;
      const movs = caixaState.movimentos || [];
      const totalSang = movs.filter(m => m.tipo === 'Sangria').reduce((s, m) => s + m.valor, 0);
      const totalSup = movs.filter(m => m.tipo === 'Suprimento').reduce((s, m) => s + m.valor, 0);
      const saldo = caixaState.fundo + totalSup - totalSang + todayStats.total;
      document.getElementById('caixaModalTitle').textContent = 'Gerenciar Caixa';
      document.getElementById('caixaModalBody').innerHTML = `
        <div class="caixa-resumo">
          <div class="caixa-resumo-row"><span>Fundo inicial</span><span>R$ ${fmt(caixaState.fundo)}</span></div>
          <div class="caixa-resumo-row"><span>Suprimentos</span><span style="color:var(--accent)">+ R$ ${fmt(totalSup)}</span></div>
          <div class="caixa-resumo-row"><span>Sangrias</span><span style="color:var(--danger)">− R$ ${fmt(totalSang)}</span></div>
          <div class="caixa-resumo-row"><span>Vendas</span><span style="color:var(--accent)">+ R$ ${fmt(todayStats.total)}</span></div>
          <div class="caixa-resumo-row total"><span>Saldo atual</span><span>R$ ${fmt(saldo)}</span></div>
        </div>
        <div class="caixa-tabs">
          <button class="caixa-tab ${tab === 'sangria' ? 'active' : ''}" onclick="setCaixaTab('sangria')"><i class="bi bi-arrow-up-circle"></i> Sangria</button>
          <button class="caixa-tab ${tab === 'suprimento' ? 'active' : ''}" onclick="setCaixaTab('suprimento')"><i class="bi bi-arrow-down-circle"></i> Suprimento</button>
          <button class="caixa-tab ${tab === 'historico' ? 'active' : ''}" onclick="setCaixaTab('historico')"><i class="bi bi-list-ul"></i> Histórico</button>
        </div>
        ${tab === 'historico' ? `<div class="mov-list">${movs.length ? movs.slice().reverse().map(m => `
          <div class="mov-item">
            <div><div style="font-weight:600">${m.tipo}</div><div class="mov-tipo">${m.hora} · ${m.obs || '—'}</div></div>
            <div class="mov-valor ${m.tipo === 'Sangria' ? 'e' : 's'}">${m.tipo === 'Sangria' ? '−' : '+'} R$ ${fmt(m.valor)}</div>
          </div>`).join('') : '<p style="color:var(--muted);text-align:center;padding:20px 0;font-size:13px">Nenhuma movimentação.</p>'}
        </div>` : `
          <div class="caixa-input-group">
            <label>Valor (R$)</label>
            <input class="caixa-input big" id="movValor" type="number" min="0.01" step="0.01" placeholder="0,00">
          </div>
          <div class="caixa-input-group">
            <label>Motivo</label>
            <input class="caixa-input" id="movObs" type="text" placeholder="${tab === 'sangria' ? 'Ex: Recolha parcial' : 'Ex: Reforço de troco'}">
          </div>`}`;
      document.getElementById('caixaModalFooter').innerHTML = tab === 'historico' ? `
        <button class="cm-btn ghost" onclick="closeCaixa()">Fechar</button>
        <button class="cm-btn danger" onclick="fecharCaixa()"><i class="bi bi-lock-fill"></i> Fechar Caixa</button>` : `
        <button class="cm-btn ghost" onclick="closeCaixa()">Cancelar</button>
        <button class="cm-btn confirm" onclick="confirmarMovimento()">Confirmar ${tab === 'sangria' ? 'Sangria' : 'Suprimento'}</button>`;
    }

    function setCaixaTab(tab) { caixaTab = tab; renderCaixaAberto(); }

    async function confirmarMovimento() {
      const valor = parseFloat(document.getElementById('movValor').value);
      if (!valor || valor <= 0) { NexoToast.warning('Informe um valor valido'); return; }
      const obs = document.getElementById('movObs').value;
      const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const movimento = { tipo: caixaTab === 'sangria' ? 'Sangria' : 'Suprimento', valor, obs, hora };
      const tipoAtual = caixaTab;
      const restoreLoading = setButtonLoading(document.querySelector('#caixaModalFooter .cm-btn.confirm'), 'Registrando...');

      try {
        const r = await NexoAuth.apiFetch(`/caixas/${caixaState.id}`, {
          method: 'PUT',
          body: JSON.stringify({ movimento }),
        });

        if (!r.ok) { NexoToast.error('Erro ao registrar movimento'); return; }

        caixaState = r.data;
        caixaTab = 'historico'; renderCaixaAberto();
        NexoToast.success((tipoAtual === 'sangria' ? 'Sangria' : 'Suprimento') + ' de R$ ' + fmt(valor) + ' registrado');
      } catch (_) {
        NexoToast.error('Erro ao registrar movimento');
      } finally {
        restoreLoading();
      }
    }

    function fecharCaixa() {
      renderFechamentoCaixa();
    }

    function renderFechamentoCaixa() {
      const agora = new Date();
      const horaFechamento = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const movs = caixaState.movimentos || [];
      const totalSang = movs.filter(m => m.tipo === 'Sangria').reduce((s, m) => s + m.valor, 0);
      const totalSup = movs.filter(m => m.tipo === 'Suprimento').reduce((s, m) => s + m.valor, 0);
      const saldoEsperado = caixaState.fundo + totalSup - totalSang + todayStats.total;
      const ticketMedio = todayStats.count > 0 ? todayStats.total / todayStats.count : 0;

      const KNOWN = ['Dinheiro', 'Pix', 'Voucher', 'Split'];
      const breakdown = {};
      const estornos = salesHistory.filter(s => s.estornada);
      const totalEstornos = estornos.reduce((s, v) => s + (parseFloat(String(v.total).replace(/\./g, '').replace(',', '.')) || 0), 0);
      salesHistory.filter(s => !s.estornada).forEach(sale => {
        const val = parseFloat(String(sale.total).replace(/\./g, '').replace(',', '.')) || 0;
        const key = KNOWN.includes(sale.method) ? sale.method : 'Cartão';
        if (!breakdown[key]) breakdown[key] = { count: 0, total: 0 };
        breakdown[key].count++;
        breakdown[key].total += val;
      });

      const icons = { Dinheiro: 'bi-cash-coin', Pix: 'bi-qr-code-scan', Cartão: 'bi-credit-card', Voucher: 'bi-ticket-perforated-fill', Split: 'bi-layout-split' };
      const payRows = Object.entries(breakdown).map(([k, v]) => `
        <div class="fcx-pay-row">
          <span class="fcx-pay-label"><i class="bi ${icons[k] || 'bi-cash'}" style="margin-right:6px"></i>${k}</span>
          <span class="fcx-pay-count">${v.count} venda${v.count !== 1 ? 's' : ''}</span>
          <span class="fcx-pay-val">R$ ${fmt(v.total)}</span>
        </div>`).join('') || `<p style="color:var(--muted);font-size:12px;text-align:center;padding:6px 0">Nenhuma venda neste turno</p>`;

      document.getElementById('caixaModalTitle').textContent = 'Fechamento de Caixa';
      document.getElementById('caixaModalBody').innerHTML = `
        <div class="fcx-periodo">
          <i class="bi bi-clock"></i>
          <span>Turno: <strong>${caixaState.aberturaStr}</strong> → <strong>${horaFechamento}</strong></span>
          <span class="fcx-operador">${caixaState.operador}</span>
        </div>
        <div class="fcx-section">
          <div class="fcx-section-label">Vendas por forma de pagamento</div>
          ${payRows}
        </div>
        <div class="fcx-section">
          <div class="fcx-row"><span>Fundo inicial</span><span>R$ ${fmt(caixaState.fundo)}</span></div>
          <div class="fcx-row g"><span>Suprimentos</span><span>+ R$ ${fmt(totalSup)}</span></div>
          <div class="fcx-row d"><span>Sangrias</span><span>− R$ ${fmt(totalSang)}</span></div>
          <div class="fcx-row g"><span>Total em vendas (${todayStats.count})</span><span>+ R$ ${fmt(todayStats.total)}</span></div>
          ${estornos.length ? `<div class="fcx-row d"><span>Estornos (${estornos.length})</span><span>− R$ ${fmt(totalEstornos)}</span></div>` : ''}
          <div class="fcx-row total"><span>Saldo esperado</span><span>R$ ${fmt(saldoEsperado)}</span></div>
        </div>
        <div class="fcx-ticket">Ticket médio: <strong>R$ ${fmt(ticketMedio)}</strong></div>`;

      document.getElementById('caixaModalFooter').innerHTML = `
        <button class="cm-btn ghost" onclick="renderCaixaAberto()"><i class="bi bi-arrow-left"></i> Voltar</button>
        <button class="cm-btn danger" onclick="confirmarFechamentoCaixa()"><i class="bi bi-lock-fill"></i> Confirmar Fechamento</button>`;
    }

    async function confirmarFechamentoCaixa() {
      const restoreLoading = setButtonLoading(document.querySelector('#caixaModalFooter .cm-btn.danger'), 'Fechando...');

      try {
        const r = await NexoAuth.apiFetch(`/caixas/${caixaState.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            aberto: false,
            fechamento: new Date().toISOString(),
            totalVendas: todayStats.total,
          }),
        });

        if (!r.ok) { NexoToast.error('Erro ao fechar caixa'); return; }

        caixaState = null;
        caixaStatusLoaded = true;
        caixaLoadFailed = false;
        _overtimeShown = false;
        _overtimeLastShown = 0;
        initCaixaUI(); closeCaixa();
        NexoToast.success(`Caixa fechado - ${todayStats.count} venda${todayStats.count !== 1 ? 's' : ''} - R$ ${fmt(todayStats.total)}`);
      } catch (_) {
        NexoToast.error('Erro ao fechar caixa');
      } finally {
        restoreLoading();
      }
    }

    // ═══════════════════════════════════════════════
    // CAIXA OVERTIME — alerta de turno prolongado
    // ═══════════════════════════════════════════════
    const CAIXA_OVERTIME_HOURS = 8;
    let _overtimeShown = false;    // "não mostrar mais" marcado pelo usuário
    let _overtimeLastShown = 0;    // timestamp da última exibição

    function checkCaixaOvertime() {
      if (!PDV_CONFIG.overtimeEnabled) return;
      if (_overtimeShown) return;
      if (!isCaixaAberto() || !caixaState.abertura) return;
      if (_overtimeLastShown && Date.now() - _overtimeLastShown < 60 * 60 * 1000) return;
      const elapsed = Date.now() - new Date(caixaState.abertura).getTime();
      const totalMin = Math.floor(elapsed / 60000);
      const hours = Math.floor(totalMin / 60);
      const minutes = totalMin % 60;
      if (hours < PDV_CONFIG.overtimeHours) return;
      _overtimeLastShown = Date.now();
      _showCaixaOvertimeAlert(hours, minutes);
    }

    function _showCaixaOvertimeAlert(hours, minutes) {
      const existing = document.getElementById('caixaOvertimeOverlay');
      if (existing) existing.remove();

      const timeStr = minutes > 0 ? `${hours}h ${String(minutes).padStart(2, '0')}min` : `${hours}h`;
      const operador = caixaState.operador || 'Operador';
      const aberturaStr = caixaState.aberturaStr || '—';

      const overlay = document.createElement('div');
      overlay.id = 'caixaOvertimeOverlay';
      overlay.className = 'caixa-overtime-overlay';
      overlay.innerHTML = `
        <div class="caixa-overtime-card">
          <div class="cot-icon">⏰</div>
          <div class="cot-title">Turno prolongado</div>
          <div class="cot-time">${timeStr}</div>
          <div class="cot-desc">
            O caixa foi aberto por <strong style="color:var(--text)">${escapeHtml(operador)}</strong> às <strong style="color:var(--text)">${escapeHtml(aberturaStr)}</strong> e ainda está aberto.<br><br>
            Recomendamos fechar o caixa atual e iniciar um novo turno para manter o controle correto por operador.
          </div>
          <div class="cot-btns">
            <button class="cot-btn-fechar" onclick="_overtimeFechaCaixa()">
              <i class="bi bi-lock-fill"></i> Fechar Caixa
            </button>
            <button class="cot-btn-continuar" onclick="_overtimeContinuar()">
              Continuar
            </button>
          </div>
          <label style="display:flex;align-items:center;justify-content:center;gap:8px;margin-top:18px;cursor:pointer;font-size:12px;color:var(--muted);user-select:none">
            <input type="checkbox" id="overtimeDontShow" style="accent-color:var(--accent);width:14px;height:14px;cursor:pointer">
            Não mostrar novamente neste turno
          </label>
        </div>`;
      document.body.appendChild(overlay);
    }

    function _overtimeContinuar() {
      const check = document.getElementById('overtimeDontShow');
      if (check && check.checked) _overtimeShown = true;
      document.getElementById('caixaOvertimeOverlay')?.remove();
    }

    function _overtimeFechaCaixa() {
      document.getElementById('caixaOvertimeOverlay')?.remove();
      document.getElementById('caixaOverlay').classList.add('open');
      renderFechamentoCaixa();
    }

    // ── Aviso de caixa aberto ao tentar fazer logout ──
    function _checkCaixaBeforeLogout() {
      if (!isCaixaAberto()) { NexoAuth.confirmLogout(); return; }

      const existing = document.getElementById('logoutCaixaAlert');
      if (existing) { existing.remove(); return; }

      const el = document.createElement('div');
      el.id = 'logoutCaixaAlert';
      el.className = 'caixa-fechado-alert';
      el.style.borderColor = 'rgba(255,107,53,.3)';
      el.innerHTML = `
        <div class="cfa-icon" style="background:rgba(255,107,53,.12);color:var(--warn)">
          <i class="bi bi-lock-fill"></i>
        </div>
        <div class="cfa-text">
          <strong>Caixa ainda aberto</strong>
          <span>Feche o caixa antes de sair para manter o controle do turno.</span>
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0">
          <button class="cfa-btn"
            onclick="openCaixa();document.getElementById('logoutCaixaAlert')?.remove()">
            Fechar Caixa
          </button>
          <button class="cfa-btn"
            style="background:var(--card);border:1px solid var(--border);color:var(--muted)"
            onclick="document.getElementById('logoutCaixaAlert')?.remove();NexoAuth.confirmLogout()">
            Ignorar e Sair
          </button>
        </div>`;
      document.body.appendChild(el);
      setTimeout(() => el.parentNode && el.remove(), 10000);
    }

    // ═══════════════════════════════════════════════
    // CUPOM DE DESCONTO
    // ═══════════════════════════════════════════════
    const CUPONS = {
      'PROMO10': { tipo: '%', valor: 10, desc: '10% de desconto' },
      'PROMO20': { tipo: '%', valor: 20, desc: '20% de desconto' },
      'FRETE': { tipo: 'R$', valor: 15, desc: 'R$ 15,00 de desconto' },
      'BEMVINDO': { tipo: '%', valor: 5, desc: '5% para novos clientes' },
      'VIP50': { tipo: 'R$', valor: 50, desc: 'R$ 50,00 VIP' },
    };
    let cupomAtivo = null;

    function openCupom() {
      document.getElementById('cupomOverlay').classList.add('open');
      document.getElementById('cupomField').value = cupomAtivo ? cupomAtivo.codigo : '';
      document.getElementById('cupomResult').className = 'cupom-result';
      document.getElementById('cupomResult').textContent = '';
      setTimeout(() => document.getElementById('cupomField').focus(), 100);
    }
    function closeCupom() { document.getElementById('cupomOverlay').classList.remove('open'); }

    function applyCupom() {
      const code = document.getElementById('cupomField').value.trim().toUpperCase();
      const result = document.getElementById('cupomResult');
      if (!code) { result.className = 'cupom-result err'; result.textContent = 'Digite um código.'; return; }
      const cupom = CUPONS[code];
      if (!cupom) { result.className = 'cupom-result err'; result.textContent = '❌ Cupom inválido ou expirado.'; return; }
      cupomAtivo = { codigo: code, ...cupom };
      document.getElementById('discInput').value = cupom.valor;
      setDiscType(cupom.tipo);
      updateSummary();
      result.className = 'cupom-result ok';
      result.textContent = '✅ ' + cupom.desc + ' aplicado!';
      updateCupomBadge();
      setTimeout(closeCupom, 1200);
    }

    function removeCupom() {
      cupomAtivo = null;
      document.getElementById('discInput').value = '';
      updateSummary(); updateCupomBadge();
      NexoToast.info('Cupom removido');
    }

    function updateCupomBadge() {
      const btn = document.getElementById('discCupom');
      if (!btn) return;
      if (cupomAtivo) {
        btn.style.borderColor = 'rgba(0,200,150,.4)'; btn.style.color = 'var(--accent)';
        btn.title = cupomAtivo.codigo + ' — clique para remover'; btn.onclick = removeCupom;
      } else {
        btn.style.borderColor = ''; btn.style.color = ''; btn.title = 'Cupom de desconto'; btn.onclick = openCupom;
      }
    }

    // ═══════════════════════════════════════════════
    // IMPRESSÃO DE CUPOM
    // ═══════════════════════════════════════════════
    function _cupomHtml(sale) {
      const items = sale.cartSnapshot || [];
      const dateStr = new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const itemsHtml = items.map(i => `
        <div class="cp-row"><span class="cp-item-name">${escapeHtml(i.nome.substring(0, 22))}</span><span class="cp-item-val">${i.qty}x R$ ${fmt(i.preco)}</span></div>
        <div class="cp-row" style="color:#555;font-size:11px"><span></span><span class="cp-item-val">= R$ ${fmt(i.preco * i.qty)}</span></div>
      `).join('');
      return `<div class="cupom-print">
        ${sale.estornada ? '<div class="cp-estorno-stamp">Estornada</div>' : ''}
        <div class="cp-logo">${escapeHtml(PDV_CONFIG.lojaNome)}</div>
        <div class="cp-sub">CNPJ ${escapeHtml(PDV_CONFIG.lojaCnpj)}</div>
        <div class="cp-sub">${dateStr}</div>
        <div class="cp-sep"></div>
        <div style="font-size:10px;color:#555;margin-bottom:6px;text-align:center">CUPOM NÃO FISCAL</div>
        ${itemsHtml}
        <div class="cp-sep"></div>
        <div class="cp-row"><span>Subtotal</span><span>R$ ${fmt(sale.subtotal || 0)}</span></div>
        ${(sale.desconto || 0) > 0 ? `<div class="cp-row"><span>Desconto${sale.cupom ? ' (' + escapeHtml(sale.cupom) + ')' : ''}</span><span>− R$ ${fmt(sale.desconto)}</span></div>` : ''}
        <div class="cp-row bold"><span>TOTAL</span><span>R$ ${escapeHtml(sale.total)}</span></div>
        <div class="cp-sep"></div>
        <div class="cp-row"><span>Pagamento</span><span>${escapeHtml(sale.method)}</span></div>
        ${(sale.troco || 0) > 0 ? `<div class="cp-row"><span>Troco</span><span>R$ ${fmt(sale.troco)}</span></div>` : ''}
        <div class="cp-sep"></div>
        <div class="cp-center" style="font-size:10px">Operador: ${escapeHtml(caixaState && caixaState.operador ? caixaState.operador : 'Operador')}</div>
        ${sale.obs ? `<div class="cp-sep"></div><div class="cp-center" style="font-size:10px;font-style:italic">Obs: ${escapeHtml(sale.obs)}</div>` : ''}
        <div class="cp-sep"></div>
        <div class="cp-footer">${escapeHtml(PDV_CONFIG.lojaRodape)}</div>
      </div>`;
    }

    function _buildTextReceipt(sale) {
      const sep = '─'.repeat(32);
      const items = (sale.cartSnapshot || []).map(i =>
        `${i.nome.substring(0, 20).padEnd(20)} ${String(i.qty + 'x').padStart(4)} R$ ${fmt(i.preco * i.qty)}`
      ).join('\n');
      const dateStr = new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      return [
        PDV_CONFIG.lojaNome,
        'CNPJ: ' + PDV_CONFIG.lojaCnpj,
        dateStr,
        sep,
        'CUPOM NÃO FISCAL',
        sep,
        items,
        sep,
        'Subtotal: R$ ' + fmt(sale.subtotal || 0),
        (sale.desconto || 0) > 0 ? 'Desconto: -R$ ' + fmt(sale.desconto) : '',
        'TOTAL: R$ ' + sale.total,
        sep,
        'Pagamento: ' + sale.method,
        (sale.troco || 0) > 0 ? 'Troco: R$ ' + fmt(sale.troco) : '',
        sep,
        PDV_CONFIG.lojaRodape,
      ].filter(Boolean).join('\n');
    }

    function _compartilharEmail(sale) {
      const text = _buildTextReceipt(sale);
      window.open('mailto:?subject=' + encodeURIComponent('Cupom - ' + PDV_CONFIG.lojaNome) + '&body=' + encodeURIComponent(text));
    }

    function _compartilharWhatsApp(sale) {
      const text = _buildTextReceipt(sale);
      window.open('https://wa.me/?text=' + encodeURIComponent(text));
    }

    function imprimirCupom(sale) {
      const frame = document.getElementById('printFrame');
      frame.innerHTML = _cupomHtml(sale);
      // frame permanece oculto — @media print { display: block !important } o exibe só na impressão
      setTimeout(() => { window.print(); frame.innerHTML = ''; }, 150);
    }

    function fecharImpressao() { const f = document.getElementById('printFrame'); f.style.display = 'none'; f.innerHTML = ''; }

    function openAtalhos() { document.getElementById('atalhosOverlay').classList.add('open'); }
    function closeAtalhos() { document.getElementById('atalhosOverlay').classList.remove('open'); }

    // ═══════════════════════════════════════════════
    // LEITOR DE CÓDIGO DE BARRAS
    // ═══════════════════════════════════════════════
    let barcodeBuffer = '', barcodeTimer = null;
    const BARCODE_TIMEOUT = 80;

    document.addEventListener('keypress', function (e) {
      const tag = document.activeElement.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (document.getElementById('payOverlay').classList.contains('open')) return;
      if (document.getElementById('caixaOverlay').classList.contains('open')) return;
      if (document.getElementById('itemEditOverlay')?.classList.contains('open')) return;
      if (document.getElementById('pinOverlay')?.classList.contains('open')) return;
      if (e.key === 'Enter') {
        if (barcodeBuffer.length >= 3) processBarcode(barcodeBuffer.trim());
        barcodeBuffer = ''; return;
      }
      barcodeBuffer += e.key;
      clearTimeout(barcodeTimer);
      barcodeTimer = setTimeout(() => {
        if (barcodeBuffer.length > 0) {
          document.getElementById('searchInput').value = barcodeBuffer;
          renderProducts(); document.getElementById('searchInput').focus();
        }
        barcodeBuffer = '';
      }, BARCODE_TIMEOUT);
    });

    function _beep(freq = 1200, dur = 80, vol = 0.15) {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(vol, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur / 1000);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + dur / 1000);
      } catch (e) { }
    }

    function processBarcode(code) {
      const ind = document.getElementById('barcodeIndicator');
      document.getElementById('barcodeVal').textContent = code;
      ind.classList.add('show'); setTimeout(() => ind.classList.remove('show'), 2000);
      const prod = PRODUCTS.find(p => p.sku.toLowerCase() === code.toLowerCase() || (p.ean && p.ean === code));
      if (prod) { _beep(1200, 80); addToCart(prod.id); NexoToast.success(prod.nome); }
      else { _beep(400, 200); document.getElementById('searchInput').value = code; renderProducts(); NexoToast.warning('Produto não encontrado: ' + code); }
    }

    // ═══════════════════════════════════════════════
    // CART TOGGLE
    // ═══════════════════════════════════════════════
    let cartCollapsed = false;
    function toggleCart() {
      cartCollapsed = !cartCollapsed;
      document.getElementById('carrinhoArea').classList.toggle('collapsed', cartCollapsed);
      document.getElementById('cartToggleIcon').className =
        cartCollapsed ? 'bi bi-chevron-left' : 'bi bi-chevron-right';
      document.documentElement.style.setProperty('--ai-right', cartCollapsed ? '74px' : '376px');
    }
    function syncCollapsedTab(preComputedTotal) {
      const count = cart.reduce((s, c) => s + c.qty, 0);
      const total = preComputedTotal !== undefined ? preComputedTotal : getTotal();
      const ccCount = document.getElementById('ccCount');
      const ccTotal = document.getElementById('ccTotal');
      const ccFin = document.getElementById('ccFin');
      if (ccCount) ccCount.textContent = count;
      if (ccTotal) ccTotal.textContent = `R$ ${fmt(total)}`;
      if (ccFin) ccFin.classList.toggle('disabled', cart.length === 0);
    }

    // ═══════════════════════════════════════════════
    // MODAL ESTOQUE SIMPLIFICADO (F8)
    // ═══════════════════════════════════════════════
    const ESTOQUE_EXTRA = {};

    function openEstoqueModal() {
      document.getElementById('estoqueOverlay').classList.add('open');
      setTimeout(() => document.getElementById('emSearchInput').focus(), 80);
    }

    function closeEstoqueModal() {
      document.getElementById('estoqueOverlay').classList.remove('open');
    }

    function handleEstoqueOverlay(e) {
      if (e.target === document.getElementById('estoqueOverlay')) closeEstoqueModal();
    }

    function clearEstoqueSearch() {
      const inp = document.getElementById('emSearchInput');
      inp.value = '';
      inp.focus();
      searchEstoque('');
    }

    function searchEstoque(q) {
      const clear = document.getElementById('emSearchClear');
      const emEmpty = document.getElementById('emEmpty');
      const emProduct = document.getElementById('emProduct');
      const emNotFound = document.getElementById('emNotFound');
      clear.classList.toggle('show', q.length > 0);

      if (!q.trim()) {
        emEmpty.style.display = '';
        emProduct.style.display = 'none';
        emNotFound.style.display = 'none';
        return;
      }

      const term = q.toLowerCase().trim();
      const found = PRODUCTS.find(p =>
        p.nome.toLowerCase().includes(term) ||
        p.sku.toLowerCase().includes(term) ||
        (p.ean && p.ean.includes(term))
      );

      emEmpty.style.display = 'none';
      if (!found) {
        emProduct.style.display = 'none';
        emNotFound.style.display = '';
        return;
      }

      emNotFound.style.display = 'none';
      emProduct.style.display = '';
      renderEstoqueProd(found);
    }

    function renderEstoqueProd(p) {
      const ex = ESTOQUE_EXTRA[p.id] || {};
      const custo = p.custo ?? ex.custo ?? (p.preco * 0.55);
      const margem = ((p.preco - custo) / custo * 100);
      const estoqueMin = p.estoqueMin ?? ex.estoqueMin ?? 0;
      const estoqueMax = p.estoqueMax ?? ex.estoqueMax ?? 100;
      const disponivel = Math.max(0, p.estoque - Math.floor(p.estoque * 0.05));
      const pct = estoqueMax > 0 ? Math.min(100, Math.round((p.estoque / estoqueMax) * 100)) : 0;
      const barColor = p.estoque === 0 ? 'var(--danger)' : p.estoque <= estoqueMin ? 'var(--warn)' : 'var(--accent)';
      const faturamento30 = (p.preco * (p.vendas || 0) / 12).toFixed(2);
      const lucro30 = ((p.preco - custo) * (p.vendas || 0) / 12).toFixed(2);
      const giro30 = Math.round((p.vendas || 0) / 12);
      const badgeCls = p.estoque === 0 ? 'out' : '';
      const badgeTxt = p.estoque === 0 ? 'Sem estoque' : p.estoque <= estoqueMin ? 'Estoque baixo' : 'Ativo';

      document.getElementById('emProduct').innerHTML = `
        <div class="em-prod-card">
          <div class="em-prod-emoji ${hasProductImage(p) ? 'has-photo' : ''}">${productVisualMarkup(p, 'stock')}</div>
          <div style="flex:1;min-width:0">
            <div class="em-prod-name">
              ${p.nome}
              <span class="em-prod-badge ${badgeCls}">${badgeTxt}</span>
            </div>
            <div class="em-prod-meta">
              <span><i class="bi bi-upc"></i> ${p.sku}</span>
              <span><i class="bi bi-qr-code"></i> EAN: ${p.ean || '—'}</span>
              ${(p.ncm || ex.ncm) ? `<span><i class="bi bi-file-earmark-text"></i> NCM: ${p.ncm || ex.ncm}</span>` : ''}
            </div>
          </div>
        </div>

        <div class="em-prices-row">
          <div class="em-price-card">
            <div class="em-price-label">Preço de Custo</div>
            <div class="em-price-val" style="color:var(--muted)">R$ ${fmt(custo)}</div>
            <div class="em-price-sub">Última compra: ${ex.ultimaEntrada || '—'}</div>
          </div>
          <div class="em-price-card">
            <div class="em-price-label">Preço de Venda</div>
            <div class="em-price-val" style="color:var(--accent)">R$ ${fmt(p.preco)}</div>
            <div class="em-price-sub">${p.promo ? '🏷️ Em promoção' : 'Preço regular'}</div>
          </div>
          <div class="em-price-card">
            <div class="em-price-label">Margem de Lucro</div>
            <div class="em-price-val" style="color:${margem >= 30 ? 'var(--accent)' : margem >= 10 ? 'var(--warn)' : 'var(--danger)'}">
              ${margem.toFixed(2)}%
            </div>
            <div class="em-price-sub">R$ ${fmt(p.preco - custo)} por unidade</div>
          </div>
        </div>

        <div class="em-stock-grid">
          <div class="em-stock-card">
            <div class="em-stock-icon" style="color:${barColor}"><i class="bi bi-boxes"></i></div>
            <div class="em-stock-val" style="color:${barColor}">${p.estoque}</div>
            <div class="em-stock-lbl">Estoque Atual</div>
            <div class="em-stock-bar-bg"><div class="em-stock-bar-fill" style="width:${pct}%;background:${barColor}"></div></div>
          </div>
          <div class="em-stock-card">
            <div class="em-stock-icon" style="color:var(--warn)"><i class="bi bi-arrow-down-circle"></i></div>
            <div class="em-stock-val" style="color:var(--warn)">${estoqueMin}</div>
            <div class="em-stock-lbl">Estoque Mínimo</div>
          </div>
          <div class="em-stock-card">
            <div class="em-stock-icon" style="color:var(--accent2)"><i class="bi bi-arrow-up-circle"></i></div>
            <div class="em-stock-val" style="color:var(--accent2)">${estoqueMax}</div>
            <div class="em-stock-lbl">Estoque Máximo</div>
          </div>
          <div class="em-stock-card">
            <div class="em-stock-icon" style="color:var(--accent)"><i class="bi bi-check-circle"></i></div>
            <div class="em-stock-val" style="color:var(--accent)">${disponivel}</div>
            <div class="em-stock-lbl">Disponível</div>
          </div>
        </div>

        <div class="em-detail-grid">
          <div class="em-detail-item">
            <i class="bi bi-tag em-detail-icon"></i>
            <div><div class="em-detail-lbl">Categoria</div><div class="em-detail-val">${p.cat}</div></div>
          </div>
          <div class="em-detail-item">
            <i class="bi bi-building em-detail-icon"></i>
            <div><div class="em-detail-lbl">Depósito</div><div class="em-detail-val">${p.deposito || ex.deposito || '—'}</div></div>
          </div>
          <div class="em-detail-item">
            <i class="bi bi-geo-alt em-detail-icon"></i>
            <div><div class="em-detail-lbl">Localização</div><div class="em-detail-val">${p.localizacao || ex.localizacao || '—'}</div></div>
          </div>
          <div class="em-detail-item">
            <i class="bi bi-truck em-detail-icon"></i>
            <div><div class="em-detail-lbl">Fornecedor</div><div class="em-detail-val">${p.fornecedor || ex.fornecedor || '—'}</div></div>
          </div>
          <div class="em-detail-item">
            <i class="bi bi-calendar2 em-detail-icon"></i>
            <div><div class="em-detail-lbl">Última Entrada</div><div class="em-detail-val">${ex.ultimaEntrada || '—'}</div></div>
          </div>
          <div class="em-detail-item">
            <i class="bi bi-rulers em-detail-icon"></i>
            <div><div class="em-detail-lbl">Unidade / Peso</div><div class="em-detail-val">${p.unidade || ex.unidade || 'UN'} · ${ex.peso || '—'}</div></div>
          </div>
          <div class="em-detail-item">
            <i class="bi bi-arrow-repeat em-detail-icon"></i>
            <div><div class="em-detail-lbl">Giro (30 dias)</div><div class="em-detail-val">${giro30} un</div></div>
          </div>
          <div class="em-detail-item">
            <i class="bi bi-cash-coin em-detail-icon"></i>
            <div><div class="em-detail-lbl">Faturamento (30d)</div><div class="em-detail-val" style="color:var(--accent)">R$ ${fmt(parseFloat(faturamento30))}</div></div>
          </div>
          <div class="em-detail-item">
            <i class="bi bi-graph-up em-detail-icon"></i>
            <div><div class="em-detail-lbl">Lucro (30 dias)</div><div class="em-detail-val" style="color:var(--accent)">R$ ${fmt(parseFloat(lucro30))}</div></div>
          </div>
          <div class="em-detail-item">
            <i class="bi bi-shop em-detail-icon"></i>
            <div><div class="em-detail-lbl">Marca</div><div class="em-detail-val">${p.marca || ex.marca || '—'}</div></div>
          </div>
        </div>
      `;
    }

    init();
