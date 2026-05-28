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
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.className = `toast ${type}`;
  const icon = t.querySelector('i');
  if (icon) {
    icon.className = type === 'success'
      ? 'bi bi-check-circle-fill'
      : 'bi bi-exclamation-triangle-fill';
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

// ── Iniciais (avatares) ───────────────────────────────
function initials(name) {
  const w = (name || '').trim().split(' ');
  return (w[0][0] + (w[1]?.[0] || '')).toUpperCase();
}
