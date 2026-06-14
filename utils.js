/* ═══════════════════════════════════════════════════
   SISTEMY ERP — utils.js
   Funções utilitárias compartilhadas por todas as páginas
   ═══════════════════════════════════════════════════ */

// ── Formatação ────────────────────────────────────────
function fmt(v) {
  return (v || 0).toFixed(2)
    .replace('.', ',')
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// ── Toast ─────────────────────────────────────────────
function showToast(msg, type) {
  if (!type) {
    if (msg.startsWith('❌')) type = 'error';
    else if (msg.startsWith('⚠️')) type = 'warning';
    else type = 'success';
  }
  const t = document.getElementById('toast');
  if (!t) return;
  t.className = `toast ${type}`;
  const icon = t.querySelector('i');
  if (icon) {
    const icons = { success: 'bi-check-circle-fill', warning: 'bi-exclamation-triangle-fill', error: 'bi-x-circle-fill', info: 'bi-info-circle-fill' };
    icon.className = `bi ${icons[type] || icons.success}`;
  }
  document.getElementById('toastMsg').textContent = msg;
  t.classList.add('show');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), 3000);
}

// ── Sidebar ───────────────────────────────────────────
let sidebarCollapsed = true;

function toggleSidebar() {
  sidebarCollapsed = !sidebarCollapsed;
  document.getElementById('sidebar').classList.toggle('collapsed', sidebarCollapsed);
  document.getElementById('mainContent').classList.toggle('collapsed', sidebarCollapsed);
  document.getElementById('toggleIcon').className = sidebarCollapsed
    ? 'bi bi-chevron-right'
    : 'bi bi-chevron-left';
}

// ── Máscaras ──────────────────────────────────────────
function maskPhone(el) {
  let v = el.value.replace(/\D/g, '').substring(0, 11);
  if (v.length > 6) v = `(${v.slice(0,2)}) ${v.slice(2,7)}-${v.slice(7)}`;
  else if (v.length > 2) v = `(${v.slice(0,2)}) ${v.slice(2)}`;
  el.value = v;
}

function maskCEP(el) {
  let v = el.value.replace(/\D/g, '').substring(0, 8);
  if (v.length > 5) v = v.slice(0,5) + '-' + v.slice(5);
  el.value = v;
}

function maskCNPJ(el) {
  let v = el.value.replace(/\D/g, '').substring(0, 14);
  if (v.length > 12) v = v.slice(0,2)+'.'+v.slice(2,5)+'.'+v.slice(5,8)+'/'+v.slice(8,12)+'-'+v.slice(12);
  else if (v.length > 8) v = v.slice(0,2)+'.'+v.slice(2,5)+'.'+v.slice(5,8)+'/'+v.slice(8);
  else if (v.length > 5) v = v.slice(0,2)+'.'+v.slice(2,5)+'.'+v.slice(5);
  else if (v.length > 2) v = v.slice(0,2)+'.'+v.slice(2);
  el.value = v;
}

function maskCPF(el) {
  let v = el.value.replace(/\D/g, '').substring(0, 11);
  if (v.length > 9) v = v.slice(0,3)+'.'+v.slice(3,6)+'.'+v.slice(6,9)+'-'+v.slice(9);
  else if (v.length > 6) v = v.slice(0,3)+'.'+v.slice(3,6)+'.'+v.slice(6);
  else if (v.length > 3) v = v.slice(0,3)+'.'+v.slice(3);
  el.value = v;
}

// ── Validação CPF / CNPJ ─────────────────────────────
function validarCPF(cpf) {
  const n = cpf.replace(/\D/g, '');
  if (n.length !== 11 || /^(\d)\1{10}$/.test(n)) return false;
  let s = 0;
  for (let i = 0; i < 9; i++) s += +n[i] * (10 - i);
  let r = (s * 10) % 11; if (r === 10 || r === 11) r = 0;
  if (r !== +n[9]) return false;
  s = 0;
  for (let i = 0; i < 10; i++) s += +n[i] * (11 - i);
  r = (s * 10) % 11; if (r === 10 || r === 11) r = 0;
  return r === +n[10];
}

function validarCNPJ(cnpj) {
  const n = cnpj.replace(/\D/g, '');
  if (n.length !== 14 || /^(\d)\1{13}$/.test(n)) return false;
  const calc = (len) => {
    let s = 0, p = len - 7;
    for (let i = 0; i < len; i++) { s += +n[i] * p--; if (p < 2) p = 9; }
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === +n[12] && calc(13) === +n[13];
}

// ── Sanitização XSS ──────────────────────────────────
function escapeHTML(str) {
  const d = document.createElement('div');
  d.textContent = String(str == null ? '' : str);
  return d.innerHTML;
}

// ── Iniciais (avatares) ───────────────────────────────
function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'NX';
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
}

// ── Controle de acesso por permissão individual ───────
// Mapa: página → chave de permissão no objeto user.permissions
const _PAGE_PERM_KEY = {
  'dashboard.html':     'dashboard',
  'pdv.html':           'pdv',
  'pedidos.html':       'pedidos',
  'vendas.html':        'vendas',
  'clientes.html':      'clientes',
  'produtos.html':      'produtos',
  'estoque.html':       'estoque',
  'financeiro.html':    'financeiro',
  'relatorios.html':    'relatorios',
  'configuracoes.html': 'configuracoes',
};

// Chame após NexoAuth.requireAuth(). Redireciona para dashboard se acesso negado.
function requirePermission() {
  const page    = location.pathname.split('/').pop() || 'dashboard.html';
  const permKey = _PAGE_PERM_KEY[page];
  if (!permKey) return; // página não mapeada: acesso livre

  let session = null;
  try { session = JSON.parse(localStorage.getItem('nexoerp.session') || 'null'); } catch(_) {}
  if (!session || !session.user) return; // requireAuth já redireciona

  // Dono (isDono = true OU permissions = null) → acesso total irrestrito
  if (session.user.isDono || session.user.permissions === null) return;

  const perms = session.user.permissions || {};
  if (!perms[permKey]) {
    // Encontra a primeira página acessível para evitar loop infinito em dashboard.html
    const fallback = Object.keys(_PAGE_PERM_KEY).find(p => p !== page && perms[_PAGE_PERM_KEY[p]]);
    location.href = fallback
      ? fallback + '?denied=' + encodeURIComponent(page)
      : 'login.html?reason=no-access';
  }
}

// ── Tema dinâmico ─────────────────────────────────────
// Lê nexoerp.config e aplica --accent ao :root assim que utils.js carrega.
// Executado imediatamente (não precisa de DOMContentLoaded) porque só mexe em CSS vars.
(function applyTheme() {
  try {
    const cfg = JSON.parse(localStorage.getItem('nexoerp.config') || '{}');
    if (cfg._corSel && /^#[0-9a-f]{6}$/i.test(cfg._corSel)) {
      document.documentElement.style.setProperty('--accent', cfg._corSel);
      // Deriva variações mais claras para hover e bg states
      document.documentElement.style.setProperty('--accent2', cfg._corSel);
    }
  } catch (_) {}
})();

// ── NexoSkeleton — placeholders animados durante loading ─────
window.NexoSkeleton = {
  // Gera linhas de skeleton para um <tbody>
  tableRows(count = 7, cols = 5) {
    const widths = [55, 75, 40, 50, 35, 65, 45];
    const cells = Array.from({ length: cols }, (_, i) =>
      `<td style="padding:14px 12px"><span class="skeleton skeleton-line" style="width:${widths[i % widths.length]}%"></span></td>`
    ).join('');
    return Array.from({ length: count }, () => `<tr>${cells}</tr>`).join('');
  },
  // Gera um bloco skeleton para valor de KPI
  kpiVal(w = '90px', h = '28px') {
    return `<span class="skeleton" style="width:${w};height:${h}"></span>`;
  },
  kpiCards(count = 4) {
    return Array.from({ length: count }, () => `
      <div class="kpi-mini" aria-busy="true">
        <span class="skeleton skeleton-avatar"></span>
        <span class="skeleton-stack" style="flex:1">
          <span class="skeleton skeleton-title"></span>
          <span class="skeleton skeleton-line" style="width:56%"></span>
        </span>
      </div>
    `).join('');
  },
  card(titleWidth = '48%') {
    return `
      <div class="skeleton-stack" aria-busy="true">
        <span class="skeleton skeleton-title" style="width:${titleWidth}"></span>
        <span class="skeleton skeleton-line"></span>
        <span class="skeleton skeleton-line" style="width:82%"></span>
        <span class="skeleton skeleton-line" style="width:64%"></span>
      </div>
    `;
  },
  empty(icon = 'bi-inbox', title = 'Nenhum registro encontrado', text = 'Tente ajustar os filtros ou cadastre um novo item.') {
    return `<div class="empty-state show"><i class="bi ${icon}"></i><h3>${escapeHTML(title)}</h3><p>${escapeHTML(text)}</p></div>`;
  },
};

// ── NexoConfig — formatadores que respeitam nexoerp.config ──
window.NexoConfig = {
  _read() {
    try { return JSON.parse(localStorage.getItem('nexoerp.config') || '{}'); } catch(_) { return {}; }
  },
  formatCurrency(value) {
    const cfg = this._read();
    const casas = cfg.casasDecimais != null ? Number(cfg.casasDecimais) : 2;
    const formatted = (value || 0).toFixed(casas)
      .replace('.', ',')
      .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    const symbols = { BRL: 'R$', USD: 'US$', EUR: '€' };
    const symbol = symbols[cfg.moeda] || 'R$';
    return `${symbol} ${formatted}`;
  },
  formatDate(dateStr) {
    if (!dateStr) return '';
    const cfg = this._read();
    const d = new Date(String(dateStr).includes('T') ? dateStr : dateStr + 'T00:00:00');
    const dd   = String(d.getDate()).padStart(2, '0');
    const mm   = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    switch (cfg.fmtData) {
      case 'MM/DD/AAAA': return `${mm}/${dd}/${yyyy}`;
      case 'AAAA-MM-DD': return `${yyyy}-${mm}-${dd}`;
      default:           return `${dd}/${mm}/${yyyy}`;
    }
  },
};

// ── Export CSV ────────────────────────────────────────
function downloadCSV(filename, header, rows) {
  const escape = v => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
  const lines = [header, ...rows].map(r => r.map(escape).join(','));
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
  if (typeof showToast === 'function') showToast('✅ CSV exportado com sucesso!');
}
