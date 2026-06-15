    // ═══════════════════════════════════════════════
    // VENDAS SUSPENSAS
    // ═══════════════════════════════════════════════
    let suspendedCarts = [];
    const _SUSP_KEY = 'nexoerp.pdv.suspendedCarts';

    function _saveSuspended() {
      try { localStorage.setItem(_SUSP_KEY, JSON.stringify(suspendedCarts)); } catch (e) { }
    }
    function _loadSuspended() {
      try {
        const raw = localStorage.getItem(_SUSP_KEY);
        if (raw) suspendedCarts = JSON.parse(raw);
      } catch (e) { }
    }

    function suspendBtnClick() {
      if (cart.length) openSuspendLabelModal();
      else if (suspendedCarts.length) openSuspendedPanel();
      else NexoToast.warning('Carrinho vazio — nada para suspender.');
    }

    function openSuspendLabelModal() {
      document.getElementById('suspendLabelInput').value = '';
      document.getElementById('suspendLabelOverlay').classList.add('open');
      setTimeout(() => document.getElementById('suspendLabelInput').focus(), 80);
    }

    function closeSuspendLabelModal() {
      document.getElementById('suspendLabelOverlay').classList.remove('open');
    }

    function confirmarSuspensao() {
      const label = document.getElementById('suspendLabelInput').value.trim() || 'Sem identificação';
      const { total } = calcCart();
      suspendedCarts.unshift({
        id: Date.now(),
        label,
        items: cart.map(c => ({ ...c })),
        discType,
        discInput: document.getElementById('discInput').value,
        cpf: cpfNota,
        cpfInput: document.getElementById('cpfNotaInput').value,
        cupom: cupomAtivo ? { ...cupomAtivo } : null,
        total,
        time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        timestamp: Date.now(),
      });
      clearCart();
      clearCpf();
      document.getElementById('discInput').value = '';
      cupomAtivo = null;
      updateCupomBadge();
      setDiscType('%');
      closeSuspendLabelModal();
      _saveSuspended();
      _updateSuspendUI();
      NexoToast.info(`Venda suspensa — "${label}"`);
    }

    function openSuspendedPanel() {
      _renderSuspendedList();
      document.getElementById('suspendedOverlay').classList.add('open');
    }

    function closeSuspendedPanel() {
      document.getElementById('suspendedOverlay').classList.remove('open');
    }

    function retomarVenda(idx) {
      const saved = suspendedCarts[idx];
      if (!saved) return;
      if (cart.length) {
        showConfirm(
          'Carrinho atual tem itens',
          `Suspender a venda atual e retomar "${saved.label}"?`,
          () => {
            // Suspende o atual silenciosamente
            const { total } = calcCart();
            suspendedCarts.push({
              id: Date.now(),
              label: 'Venda em andamento',
              items: cart.map(c => ({ ...c })),
              discType,
              discInput: document.getElementById('discInput').value,
              cpf: cpfNota,
              cpfInput: document.getElementById('cpfNotaInput').value,
              cupom: cupomAtivo ? { ...cupomAtivo } : null,
              total,
              time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
              timestamp: Date.now(),
            });
            clearCart(); clearCpf();
            document.getElementById('discInput').value = '';
            cupomAtivo = null; updateCupomBadge(); setDiscType('%');
            // Agora retoma — re-busca o índice pois array mudou
            const newIdx = suspendedCarts.findIndex(s => s.id === saved.id);
            _carregarSuspensa(newIdx);
          },
          { confirmText: 'Suspender e Retomar', icon: '⏸️' }
        );
        return;
      }
      _carregarSuspensa(idx);
    }

    function _carregarSuspensa(idx) {
      const saved = suspendedCarts.splice(idx, 1)[0];
      cart = saved.items;
      discType = saved.discType;
      document.getElementById('discInput').value = saved.discInput;
      setDiscType(saved.discType);
      if (saved.cpf) {
        document.getElementById('cpfNotaInput').value = saved.cpfInput;
        cpfNota = saved.cpf;
        setCpfStatus('ok', '✓ CPF válido');
        document.getElementById('cpfClearBtn').classList.add('visible');
      }
      cupomAtivo = saved.cupom || null;
      updateCupomBadge();
      renderCart();
      renderProducts();
      _saveSuspended();
      _updateSuspendUI();
      closeSuspendedPanel();
      NexoToast.success(`Venda retomada — "${saved.label}"`);
    }

    function descartarSuspensa(idx) {
      const saved = suspendedCarts[idx];
      if (!saved) return;
      showConfirm(
        'Descartar venda suspensa?',
        `"${escapeHtml(saved.label)}" · ${saved.items.reduce((s, i) => s + i.qty, 0)} item(s) · R$ ${fmt(saved.total)}`,
        () => {
          suspendedCarts.splice(idx, 1);
          _saveSuspended();
          _renderSuspendedList();
          _updateSuspendUI();
          if (!suspendedCarts.length) closeSuspendedPanel();
          NexoToast.info('Venda suspensa descartada');
        },
        { confirmText: 'Descartar', icon: '🗑️' }
      );
    }

    function _renderSuspendedList() {
      const list = document.getElementById('suspendedList');
      const count = document.getElementById('suspendedCount');
      if (count) count.textContent = suspendedCarts.length;
      if (!suspendedCarts.length) {
        list.innerHTML = `
          <div style="text-align:center;padding:40px 20px;color:var(--muted)">
            <i class="bi bi-pause-circle" style="font-size:40px;color:var(--border);display:block;margin-bottom:12px"></i>
            Nenhuma venda suspensa no momento.
          </div>`;
        return;
      }
      list.innerHTML = suspendedCarts.map((s, i) => {
        const qtyTotal = s.items.reduce((acc, it) => acc + it.qty, 0);
        const elapsed = Math.floor((Date.now() - s.timestamp) / 60000);
        const elapsedStr = elapsed < 1 ? 'agora mesmo' : elapsed === 1 ? 'há 1 min' : `há ${elapsed} min`;
        return `
          <div class="suspended-item">
            <div class="suspended-item-top">
              <div class="suspended-item-label">
                <i class="bi bi-pause-circle-fill" style="color:var(--accent2);font-size:15px"></i>
                ${escapeHtml(s.label)}
              </div>
              <span class="suspended-item-time">${escapeHtml(s.time)} · ${elapsedStr}</span>
            </div>
            <div class="suspended-item-info">
              <span><i class="bi bi-box-seam"></i> ${qtyTotal} item${qtyTotal !== 1 ? 's' : ''}</span>
              ${s.cpf ? `<span><i class="bi bi-person-vcard"></i> CPF: ${escapeHtml(s.cpf)}</span>` : ''}
              ${s.cupom ? `<span><i class="bi bi-ticket-perforated-fill"></i> ${escapeHtml(s.cupom.codigo)}</span>` : ''}
            </div>
            <div class="suspended-item-total">R$ ${fmt(s.total)}</div>
            <div class="suspended-item-btns" style="margin-top:10px">
              <button class="btn-retomar" onclick="retomarVenda(${i})">
                <i class="bi bi-play-circle-fill"></i> Retomar
              </button>
              <button class="btn-descartar-susp" onclick="descartarSuspensa(${i})">
                <i class="bi bi-trash3"></i> Descartar
              </button>
            </div>
          </div>`;
      }).join('');
    }

    function _updateSuspendUI() {
      const n = suspendedCarts.length;
      const btn = document.getElementById('cartSuspendBtn');
      const badge = document.getElementById('suspendBadge');
      const bar = document.getElementById('suspendedBar');
      const barText = document.getElementById('suspendedBarText');
      if (btn) btn.classList.toggle('has-suspended', n > 0);
      if (badge) { badge.textContent = n; badge.style.display = n > 0 ? 'flex' : 'none'; }
      if (bar) bar.classList.toggle('show', n > 0);
      if (barText) barText.textContent = `${n} venda${n !== 1 ? 's' : ''} suspensa${n !== 1 ? 's' : ''}`;
    }

