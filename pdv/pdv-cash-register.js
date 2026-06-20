    // ═══════════════════════════════════════════════
    // CAIXA — Abertura, Fechamento, Sangria, Suprimento
    // ═══════════════════════════════════════════════
    let caixaState = null;
    let caixaStatusLoaded = false;
    let caixaTab = 'sangria';

    async function loadCaixa() {
      try {
        const r = await NexoAuth.apiFetch('/caixas/aberto');
        if (r.ok) caixaState = r.data;
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
      const formas = todayStats.formas || {};
      const vendasDinheiro = formas.dinheiro || 0;
      const vendasCartao = (formas.credito || 0) + (formas.debito || 0);
      const vendasBeneficios = (formas.voucher || 0) + (formas.vale || 0);
      const saldo = caixaState.fundo + totalSup - totalSang + vendasDinheiro;
      document.getElementById('caixaModalTitle').textContent = 'Gerenciar Caixa';
      document.getElementById('caixaModalBody').innerHTML = `
        <div class="caixa-resumo">
          <div class="caixa-resumo-row"><span>Fundo inicial</span><span>R$ ${fmt(caixaState.fundo)}</span></div>
          <div class="caixa-resumo-row"><span>Suprimentos</span><span style="color:var(--accent)">+ R$ ${fmt(totalSup)}</span></div>
          <div class="caixa-resumo-row"><span>Sangrias</span><span style="color:var(--danger)">− R$ ${fmt(totalSang)}</span></div>
          <div class="caixa-resumo-row"><span>Total vendido</span><span>R$ ${fmt(todayStats.total)}</span></div>
          <div class="caixa-resumo-row"><span>Vendas em dinheiro</span><span style="color:var(--accent)">+ R$ ${fmt(vendasDinheiro)}</span></div>
          <div class="caixa-resumo-row"><span>Pix</span><span>R$ ${fmt(formas.pix || 0)}</span></div>
          <div class="caixa-resumo-row"><span>Crédito e débito</span><span>R$ ${fmt(vendasCartao)}</span></div>
          <div class="caixa-resumo-row"><span>Voucher e vale</span><span>R$ ${fmt(vendasBeneficios)}</span></div>
          <div class="caixa-resumo-row"><span>Fiado</span><span>R$ ${fmt(formas.fiado || 0)}</span></div>
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
      const vendasDinheiro = todayStats.formas?.dinheiro || 0;
      const saldoEsperado = caixaState.fundo + totalSup - totalSang + vendasDinheiro;
      const ticketMedio = todayStats.count > 0 ? todayStats.total / todayStats.count : 0;

      const breakdown = {};
      const estornos = salesHistory.filter(s => s.estornada);
      const totalEstornos = estornos.reduce((s, v) => s + (parseFloat(String(v.total).replace(/\./g, '').replace(',', '.')) || 0), 0);
      salesHistory.filter(s => !s.estornada).forEach(sale => {
        _getSalePayments(sale).forEach(payment => {
          const key = payment.metodo || 'multiplo';
          const val = payment.valor || 0;
          if (!breakdown[key]) breakdown[key] = { count: 0, total: 0 };
          breakdown[key].count++;
          breakdown[key].total += val;
        });
      });

      const labels = { dinheiro: 'Dinheiro', pix: 'Pix', credito: 'Crédito', debito: 'Débito', voucher: 'Voucher', vale: 'Vale-refeição', fiado: 'Fiado', multiplo: 'Múltiplo (sem detalhes)' };
      const icons = { dinheiro: 'bi-cash-coin', pix: 'bi-qr-code-scan', credito: 'bi-credit-card-fill', debito: 'bi-credit-card', voucher: 'bi-ticket-perforated-fill', vale: 'bi-ticket-detailed', fiado: 'bi-journal-text', multiplo: 'bi-layout-split' };
      const order = ['dinheiro', 'pix', 'debito', 'credito', 'voucher', 'vale', 'fiado', 'multiplo'];
      const payRows = order.filter(key => breakdown[key]).map(k => {
        const v = breakdown[k];
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
          <div class="fcx-row"><span>Total vendido (${todayStats.count})</span><span>R$ ${fmt(todayStats.total)}</span></div>
          <div class="fcx-row g"><span>Vendas em dinheiro</span><span>+ R$ ${fmt(vendasDinheiro)}</span></div>
          ${estornos.length ? `<div class="fcx-row d"><span>Estornos registrados (${estornos.length})</span><span>R$ ${fmt(totalEstornos)}</span></div>` : ''}
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
            totalVendas: todayStats.total,
          }),
        });

        if (!r.ok) { NexoToast.error('Erro ao fechar caixa'); return; }

        caixaState = null;
        caixaStatusLoaded = true;
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
