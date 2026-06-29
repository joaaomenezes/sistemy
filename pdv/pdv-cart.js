    function addToCart(id) {
      if (!caixaStatusLoaded) {
        NexoToast.info('Carregando status do caixa...');
        return;
      }

      // Bloquear se caixa fechado
      if (!isCaixaAberto()) {
        showCaixaFechadoAlert();
        return;
      }

      const p = PRODUCTS.find(x => x.id === id);
      if (!p || (p.estoque === 0 && !p.vendaSemEstoque)) return;

      if (cartCollapsed) {
        toggleCart();
      }

      const existing = cart.find(c => c.id === id);
      if (existing) {
        if (existing.qty >= p.estoque) { NexoToast.warning('Estoque esgotado para esse produto'); return; }
        existing.qty++;
      } else { cart.push({ ...p, qty: 1, _precoOriginal: p.preco, _descR: 0 }); }
      // pulse animation
      const card = document.getElementById(`pc-${id}`);
      if (card) { card.classList.remove('added'); void card.offsetWidth; card.classList.add('added'); }
      renderCart();
      renderProducts();
      NexoToast.success(`${p.nome} adicionado`);
      updateAI();
    }

    function removeFromCart(id) {
      cart = cart.filter(c => c.id !== id);
      renderCart(); renderProducts();
    }

    function changeQty(id, delta) {
      const item = cart.find(c => c.id === id);
      if (!item) return;
      if (delta > 0) {
        const prod = PRODUCTS.find(p => p.id === id);
        if (prod && item.qty >= prod.estoque) { NexoToast.warning('Estoque esgotado para esse produto'); return; }
      }
      item.qty += delta;
      if (item.qty <= 0) removeFromCart(id);
      else { renderCart(); renderProducts(); }
    }

    function setQty(id, rawVal) {
      const item = cart.find(c => c.id === id);
      if (!item) return;
      const prod = PRODUCTS.find(p => p.id === id);
      const max = prod ? prod.estoque : item.estoque;
      const qty = Math.max(1, Math.min(parseInt(rawVal) || 1, max));
      if (qty !== parseInt(rawVal)) NexoToast.warning('Quantidade ajustada ao limite de estoque');
      item.qty = qty;
      renderCart();
      renderProducts();
    }

    // ── Item edit modal ───────────────────────────────────
    let _editingItemId  = null;
    let _pendingItemEdit = null;
    let _iedDiscTipo    = '%';
    let _pinInput       = '';
    let _pinMode        = 'itemEdit';
    let _pinResolve     = null;

    function openItemEdit(id) {
      const item = cart.find(c => c.id === id);
      if (!item) return;
      _editingItemId = id;
      _iedDiscTipo   = '%';
      document.getElementById('ied-nome').textContent      = item.nome;
      document.getElementById('ied-preco').value           = (item._precoOriginal ?? item.preco).toFixed(2);
      document.getElementById('ied-desc-val').value        = '';
      document.getElementById('ied-tipo-btn').textContent  = '%';
      updateIedPreview();
      document.getElementById('itemEditOverlay').classList.add('open');
      setTimeout(() => document.getElementById('ied-preco').focus(), 100);
    }

    function closeItemEdit() {
      document.getElementById('itemEditOverlay').classList.remove('open');
    }

    function toggleIedTipo() {
      _iedDiscTipo = _iedDiscTipo === '%' ? 'R$' : '%';
      document.getElementById('ied-tipo-btn').textContent = _iedDiscTipo;
      updateIedPreview();
    }

    function updateIedPreview() {
      const preco   = Math.max(0, parseFloat(String(document.getElementById('ied-preco').value).replace(',','.')) || 0);
      const descVal = Math.max(0, parseFloat(String(document.getElementById('ied-desc-val').value).replace(',','.')) || 0);
      const descR   = _iedDiscTipo === '%' ? preco * (descVal / 100) : Math.min(descVal, preco);
      const final   = Math.max(0, preco - descR);
      document.getElementById('ied-preview-val').textContent = 'R$ ' + fmt(final);
    }

    function submitItemEdit() {
      const preco   = Math.max(0, parseFloat(String(document.getElementById('ied-preco').value).replace(',','.')) || 0);
      const descVal = Math.max(0, parseFloat(String(document.getElementById('ied-desc-val').value).replace(',','.')) || 0);
      const descR   = _iedDiscTipo === '%' ? preco * (descVal / 100) : Math.min(descVal, preco);
      const final   = Math.max(0, preco - descR);
      _pendingItemEdit = { precoOriginal: preco, descR, precoFinal: final };

      const session = NexoAuth.getSession();
      const isDono  = session?.user?.isDono || session?.user?.permissions === null;
      if (isDono) {
        applyItemEdit();
      } else {
        const cfg = JSON.parse(localStorage.getItem('nexoerp.config') || '{}');
        if (!cfg._supervisorPin) {
          NexoToast.warning('PIN de supervisor não configurado. Contate o administrador.');
          return;
        }
        closeItemEdit();
        openPinModal();
      }
    }

    function applyItemEdit() {
      const item = cart.find(c => c.id === _editingItemId);
      if (!item || !_pendingItemEdit) return;
      item._precoOriginal = _pendingItemEdit.precoOriginal;
      item._descR         = _pendingItemEdit.descR;
      item.preco          = _pendingItemEdit.precoFinal;
      item._precoNegociado = item.preco !== (PRODUCTS.find(p => p.id === item.id) || {}).preco;
      _pendingItemEdit = null;
      closeItemEdit();
      closePinModal();
      renderCart();
      NexoToast.success('Item atualizado!');
    }

    // ── PIN supervisor ────────────────────────────────────
    function openPinModal(options = {}) {
      _pinMode = options.mode || 'itemEdit';
      _pinResolve = typeof options.resolve === 'function' ? options.resolve : null;
      _pinInput = '';
      _updatePinDots();
      const title = document.querySelector('#pinOverlay .pin-title');
      const sub = document.querySelector('#pinOverlay .pin-sub');
      if (title) title.textContent = options.title || 'PIN de Supervisor';
      if (sub) sub.textContent = options.sub || 'Autorização necessária para alterar preço ou desconto';
      document.getElementById('pinOverlay').classList.add('open');
    }

    function closePinModal() {
      document.getElementById('pinOverlay').classList.remove('open');
      _pinInput = '';
      if (_pinResolve) {
        _pinResolve(null);
        _pinResolve = null;
      }
      _pinMode = 'itemEdit';
      _updatePinDots();
    }

    function _closePinModalSilent() {
      document.getElementById('pinOverlay').classList.remove('open');
      _pinInput = '';
      _pinResolve = null;
      _pinMode = 'itemEdit';
      _updatePinDots();
    }

    function requestSupervisorPin(options = {}) {
      return new Promise(resolve => {
        openPinModal({
          mode: 'collect',
          resolve,
          title: options.title || 'PIN de Supervisor',
          sub: options.sub || 'Autorização necessária para liberar esta venda fiado',
        });
      });
    }

    function pinKey(val) {
      if (val === 'del') {
        _pinInput = _pinInput.slice(0, -1);
      } else if (_pinInput.length < 4) {
        _pinInput += val;
      }
      _updatePinDots();
      if (_pinInput.length === 4) setTimeout(_verifyPin, 150);
    }

    function _updatePinDots() {
      for (let i = 0; i < 4; i++) {
        document.getElementById(`pin-dot-${i}`).classList.toggle('filled', i < _pinInput.length);
      }
    }

    function _verifyPin() {
      if (_pinMode === 'collect') {
        const pin = _pinInput;
        const resolve = _pinResolve;
        _closePinModalSilent();
        if (resolve) resolve(pin);
        return;
      }

      const cfg = JSON.parse(localStorage.getItem('nexoerp.config') || '{}');
      if (_pinInput === String(cfg._supervisorPin || '')) {
        applyItemEdit();
      } else {
        _pinInput = '';
        _updatePinDots();
        const dots = document.getElementById('pinDots');
        dots.classList.remove('shake');
        void dots.offsetWidth;
        dots.classList.add('shake');
        NexoToast.error('PIN incorreto.');
      }
    }

    function confirmClearCart() {
      if (!cart.length) return;
      showConfirm(
        'Limpar o carrinho?',
        'Todos os itens serão removidos.',
        clearCart,
        { confirmText: 'Limpar', icon: '🗑️' }
      );
    }

    function clearCart() {
      if (!cart.length) return;
      cart = [];
      clearCpf();
      document.getElementById('discInput').value = '';
      renderCart(); renderProducts();
    }

    function renderCart() {
      const container = document.getElementById('cartItems');
      const empty = document.getElementById('cartEmpty');
      const count = cart.reduce((s, c) => s + c.qty, 0);
      document.getElementById('cartCount').textContent = count;

      if (!cart.length) {
        container.innerHTML = '';
        container.appendChild(empty);
        empty.style.display = 'flex';
        document.getElementById('btnFinalizar').disabled = true;
        updateSummary();
        syncCollapsedTab(0);
        return;
      }
      empty.style.display = 'none';
      document.getElementById('btnFinalizar').disabled = false;

      container.innerHTML = cart.map(item => {
        const maxQty = (PRODUCTS.find(p => p.id === item.id) || item).estoque;
        const orig   = item._precoOriginal ?? item.preco;
        const isModified = item.preco !== orig || (item._descR || 0) > 0;
        const discBadge  = (item._descR || 0) > 0
          ? `<span class="ci-disc-badge">-R$ ${fmt(item._descR)}</span>` : '';
        return `
    <div class="cart-item" id="ci-${item.id}">
      <div class="ci-emoji ${hasProductImage(item) ? 'has-photo' : ''}" onclick="openItemEdit('${item.id}')" style="cursor:pointer">${productVisualMarkup(item, 'cart')}</div>
      <div class="ci-info" onclick="openItemEdit('${item.id}')" style="cursor:pointer">
        <div class="ci-name">${escapeHtml(item.nome)}</div>
        <div class="ci-price${isModified ? ' ci-price-negociado' : ''}">
          R$ ${fmt(item.preco)} un${discBadge}
        </div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
        <div class="ci-subtotal">R$ ${fmt(item.preco * item.qty)}</div>
        <div class="ci-qty">
          <div class="qty-btn" onclick="event.stopPropagation();changeQty('${item.id}',-1)">−</div>
          <input class="qty-val" type="number" min="1" max="${maxQty}" value="${item.qty}"
            onchange="setQty('${item.id}', this.value)"
            onclick="event.stopPropagation();this.select()" inputmode="numeric">
          <div class="qty-btn" onclick="event.stopPropagation();changeQty('${item.id}',1)">+</div>
        </div>
      </div>
      <div class="ci-remove" onclick="event.stopPropagation();removeFromCart('${item.id}')"><i class="bi bi-x"></i></div>
    </div>
  `;
      }).join('');
      container.appendChild(empty);
      updateSummary();
      syncCollapsedTab();
    }

    function calcCart() {
      const subtotal = cart.reduce((s, c) => s + (c.preco * c.qty), 0);
      const discRaw = parseFloat(document.getElementById('discInput').value) || 0;
      let disc = 0;
      if (discType === '%') disc = subtotal * (discRaw / 100);
      else disc = Math.min(discRaw, subtotal);
      const total = Math.max(0, subtotal - disc);
      return { subtotal, disc, total };
    }

    function getTotal() { return calcCart().total; }

    function updateSummary() {
      const { subtotal, disc, total } = calcCart();
      document.getElementById('sumSubtotal').textContent = `R$ ${fmt(subtotal)}`;
      document.getElementById('sumDiscount').textContent = disc > 0 ? `— R$ ${fmt(disc)}` : '— R$ 0,00';
      document.getElementById('sumDiscount').style.color = disc > 0 ? 'var(--warn)' : 'var(--muted)';
      document.getElementById('sumTotal').textContent = `R$ ${fmt(total)}`;
      syncCollapsedTab(total);
    }

    function setDiscType(t) {
      discType = t;
      document.getElementById('discPct').classList.toggle('active', t === '%');
      document.getElementById('discVal').classList.toggle('active', t === 'R$');
      updateSummary();
    }

    // ═══════════════════════════════════════════════
