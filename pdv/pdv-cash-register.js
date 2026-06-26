    // ═══════════════════════════════════════════════
    // CAIXA — Abertura, Fechamento, Sangria, Suprimento
    // ═══════════════════════════════════════════════
    let caixaState = null;
    let caixaStatusLoaded = false;
    let caixaTab = 'sangria';
    let caixaResumoState = null;

    async function loadCaixa() {
      try {
        const r = await NexoAuth.apiFetch('/caixas/aberto');
        if (r.ok) {
          caixaState = r.data;
          await loadCaixaResumo();
        }
      } catch (_) { }
      finally { caixaStatusLoaded = true; }
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

    function _emptyPaymentSummary() {
      return { count: 0, total: 0 };
    }

    function buildLocalCaixaResumo() {
      const movs = caixaState?.movimentos || [];
      const totalSang = movs.filter(m => m.tipo === 'Sangria').reduce((s, m) => s + Number(m.valor || 0), 0);
      const totalSup = movs.filter(m => m.tipo === 'Suprimento').reduce((s, m) => s + Number(m.valor || 0), 0);
      const formas = todayStats.formas || {};
      const dinheiro = formas.dinheiro || 0;
      const totalVendido = todayStats.total || 0;
      return {
        fonte: 'local',
        movimentos: movs,
        movimentacoes: { sangrias: totalSang, suprimentos: totalSup },
        vendas: {
          count: todayStats.count || 0,
          total: totalVendido,
          ticketMedio: todayStats.count > 0 ? totalVendido / todayStats.count : 0,
          estornos: { count: salesHistory.filter(s => s.estornada).length, total: 0 },
        },
        formas: {
          dinheiro: { count: 0, total: dinheiro },
          pix:      { count: 0, total: formas.pix || 0 },
          debito:   { count: 0, total: formas.debito || 0 },
          credito:  { count: 0, total: formas.credito || 0 },
          voucher:  { count: 0, total: formas.voucher || 0 },
          vale:     { count: 0, total: formas.vale || 0 },
          fiado:    { count: 0, total: formas.fiado || 0 },
          outros:   { count: 0, total: formas.multiplo || 0 },
        },
        cartao: { taxasPrevistas: 0, liquidoPrevisto: (formas.debito || 0) + (formas.credito || 0) },
        financeiro: { recebido: dinheiro + (formas.pix || 0), aReceber: (formas.debito || 0) + (formas.credito || 0) + (formas.fiado || 0) },
        dinheiroEsperado: Number(caixaState?.fundo || 0) + totalSup - totalSang + dinheiro,
        totalVendido,
      };
    }

    function getCaixaResumo() {
      return caixaResumoState || caixaState?.resumo || buildLocalCaixaResumo();
    }

    async function loadCaixaResumo({ rerender = false } = {}) {
      if (!caixaState?.id) return null;
      try {
        const r = await NexoAuth.apiFetch(`/caixas/${caixaState.id}/resumo`);
        if (!r.ok) return null;
        caixaResumoState = r.data;
        caixaState.resumo = r.data;
        if (Array.isArray(r.data.movimentos)) caixaState.movimentos = r.data.movimentos;
        if (rerender && document.getElementById('caixaOverlay')?.classList.contains('open')) {
          renderCaixaAberto();
        }
        return r.data;
      } catch (_) {
        return null;
      }
    }

    function initCaixaUI() {
      const btn = document.getElementById('caixaBtn');
      const label = document.getElementById('caixaBtnLabel');
      if (!caixaStatusLoaded) {
        btn && btn.classList.add('fechado');
        if (label) label.textContent = 'Carregando caixa...';
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

    function openCaixa() {
      if (!caixaStatusLoaded) {
        NexoToast.info('Carregando status do caixa...');
        return;
      }
      document.getElementById('caixaOverlay').classList.add('open');
      if (!isCaixaAberto()) renderAberturaCaixa();
      else {
        caixaTab = 'sangria';
        renderCaixaAberto();
        loadCaixaResumo({ rerender: true });
      }
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
        caixaState = r.data;
        caixaResumoState = null;
        todayStats = _createTodayStats();
        salesHistory = [];
        updateStats();
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
      const resumo = getCaixaResumo();
      const movs = resumo.movimentos || caixaState.movimentos || [];
      const totalSang = resumo.movimentacoes?.sangrias || 0;
      const totalSup = resumo.movimentacoes?.suprimentos || 0;
      const formas = resumo.formas || {};
      const vendasDinheiro = formas.dinheiro?.total || 0;
      const vendasBeneficios = (formas.voucher?.total || 0) + (formas.vale?.total || 0);
      const saldo = resumo.dinheiroEsperado || 0;
      document.getElementById('caixaModalTitle').textContent = 'Gerenciar Caixa';
      document.getElementById('caixaModalBody').innerHTML = `
        <div class="caixa-resumo">
          <div class="caixa-resumo-row"><span>Fundo inicial</span><span>R$ ${fmt(caixaState.fundo)}</span></div>
          <div class="caixa-resumo-row"><span>Suprimentos</span><span style="color:var(--accent)">+ R$ ${fmt(totalSup)}</span></div>
          <div class="caixa-resumo-row"><span>Sangrias</span><span style="color:var(--danger)">− R$ ${fmt(totalSang)}</span></div>
          <div class="caixa-resumo-row"><span>Total vendido</span><span>R$ ${fmt(resumo.vendas?.total || resumo.totalVendido || 0)}</span></div>
          <div class="caixa-resumo-row"><span>Vendas em dinheiro</span><span style="color:var(--accent)">+ R$ ${fmt(vendasDinheiro)}</span></div>
          <div class="caixa-resumo-row"><span>Pix recebido</span><span>R$ ${fmt(formas.pix?.total || 0)}</span></div>
          <div class="caixa-resumo-row"><span>Cartão débito</span><span>R$ ${fmt(formas.debito?.total || 0)}</span></div>
          <div class="caixa-resumo-row"><span>Cartão crédito</span><span>R$ ${fmt(formas.credito?.total || 0)}</span></div>
          <div class="caixa-resumo-row"><span>Voucher e vale</span><span>R$ ${fmt(vendasBeneficios)}</span></div>
          <div class="caixa-resumo-row"><span>Fiado</span><span>R$ ${fmt(formas.fiado?.total || 0)}</span></div>
          <div class="caixa-resumo-row total"><span>Dinheiro esperado no caixa</span><span>R$ ${fmt(saldo)}</span></div>
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
        caixaResumoState = r.data.resumo || null;
        caixaTab = 'historico'; renderCaixaAberto();
        NexoToast.success((tipoAtual === 'sangria' ? 'Sangria' : 'Suprimento') + ' de R$ ' + fmt(valor) + ' registrado');
      } catch (_) {
        NexoToast.error('Erro ao registrar movimento');
      } finally {
        restoreLoading();
      }
    }

    async function fecharCaixa() {
      await renderFechamentoCaixa();
    }

    async function renderFechamentoCaixa() {
      document.getElementById('caixaModalTitle').textContent = 'Fechamento de Caixa';
      document.getElementById('caixaModalBody').innerHTML = `
        <p style="color:var(--muted);font-size:13px;text-align:center;padding:22px 0">Calculando resumo oficial do caixa...</p>`;
      document.getElementById('caixaModalFooter').innerHTML = `
        <button class="cm-btn ghost" onclick="renderCaixaAberto()"><i class="bi bi-arrow-left"></i> Voltar</button>`;
      await loadCaixaResumo();

      const agora = new Date();
      const horaFechamento = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const resumo = getCaixaResumo();
      const totalSang = resumo.movimentacoes?.sangrias || 0;
      const totalSup = resumo.movimentacoes?.suprimentos || 0;
      const vendasDinheiro = resumo.formas?.dinheiro?.total || 0;
      const saldoEsperado = resumo.dinheiroEsperado || 0;
      const ticketMedio = resumo.vendas?.ticketMedio || 0;
      const estornos = resumo.vendas?.estornos || { count: 0, total: 0 };

      const labels = { dinheiro: 'Dinheiro', pix: 'Pix', credito: 'Crédito', debito: 'Débito', voucher: 'Voucher', vale: 'Vale-refeição', fiado: 'Fiado', outros: 'Outros' };
      const icons = { dinheiro: 'bi-cash-coin', pix: 'bi-qr-code-scan', credito: 'bi-credit-card-fill', debito: 'bi-credit-card', voucher: 'bi-ticket-perforated-fill', vale: 'bi-ticket-detailed', fiado: 'bi-journal-text', outros: 'bi-wallet2' };
      const order = ['dinheiro', 'pix', 'debito', 'credito', 'voucher', 'vale', 'fiado', 'outros'];
      const payRows = order.filter(key => (resumo.formas?.[key]?.total || 0) > 0).map(k => {
        const v = resumo.formas[k] || _emptyPaymentSummary();
        return `
        <div class="fcx-pay-row">
          <span class="fcx-pay-label"><i class="bi ${icons[k] || 'bi-wallet2'}" style="margin-right:6px"></i>${labels[k] || k}</span>
          <span class="fcx-pay-count">${v.count} pagamento${v.count !== 1 ? 's' : ''}</span>
          <span class="fcx-pay-val">R$ ${fmt(v.total)}</span>
        </div>`;
      }).join('') || `<p style="color:var(--muted);font-size:12px;text-align:center;padding:6px 0">Nenhuma venda neste turno</p>`;

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
          <div class="fcx-row"><span>Total vendido (${resumo.vendas?.count || 0})</span><span>R$ ${fmt(resumo.vendas?.total || resumo.totalVendido || 0)}</span></div>
          <div class="fcx-row g"><span>Vendas em dinheiro</span><span>+ R$ ${fmt(vendasDinheiro)}</span></div>
          ${estornos.count ? `<div class="fcx-row d"><span>Estornos registrados (${estornos.count})</span><span>R$ ${fmt(estornos.total)}</span></div>` : ''}
          <div class="fcx-row total"><span>Dinheiro esperado no caixa</span><span>R$ ${fmt(saldoEsperado)}</span></div>
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
          }),
        });

        if (!r.ok) { NexoToast.error('Erro ao fechar caixa'); return; }

        const resumoFinal = r.data?.resumo || caixaResumoState || buildLocalCaixaResumo();
        caixaState = null;
        caixaResumoState = null;
        todayStats = _createTodayStats();
        salesHistory = [];
        caixaStatusLoaded = true;
        _overtimeShown = false;
        _overtimeLastShown = 0;
        updateStats();
        initCaixaUI(); closeCaixa();
        NexoToast.success(`Caixa fechado - ${resumoFinal.vendas?.count || 0} venda${(resumoFinal.vendas?.count || 0) !== 1 ? 's' : ''} - R$ ${fmt(resumoFinal.vendas?.total || resumoFinal.totalVendido || 0)}`);
      } catch (_) {
        NexoToast.error('Erro ao fechar caixa');
      } finally {
        restoreLoading();
      }
    }
