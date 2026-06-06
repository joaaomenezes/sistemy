(function () {
  const SESSION_KEY = 'nexoerp.session';
  const LOCKOUT_KEY = 'nexoerp.login.lockout';
  const API_URL     = 'http://localhost:3333/api';

  const ALL_MODULES = [
    'dashboard','pdv','pedidos','vendas','clientes',
    'produtos','estoque','financeiro','relatorios','configuracoes'
  ];

  // ── Storage helpers ───────────────────────────────────
  function readJSON(key, fallback) {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
    catch (_) { return fallback; }
  }

  function writeJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (err) {
      if (err.name === 'QuotaExceededError') console.error('[NexoERP] localStorage cheio:', key);
      return false;
    }
  }

  function normalize(v) { return String(v || '').trim().toLowerCase(); }

  function initials(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'NX';
    return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
  }

  // ── Rate limiting ─────────────────────────────────────
  const MAX_ATTEMPTS = 5;
  const LOCKOUT_MS   = 30_000;

  function getLockout()         { return readJSON(LOCKOUT_KEY, { attempts: 0, lockedUntil: 0 }); }
  function isLockedOut()        { const lk = getLockout(); return lk.attempts >= MAX_ATTEMPTS && Date.now() < lk.lockedUntil; }
  function lockoutSecondsLeft() { return Math.ceil((getLockout().lockedUntil - Date.now()) / 1000); }
  function clearLockout()       { localStorage.removeItem(LOCKOUT_KEY); }

  function registerFailedAttempt() {
    const lk = getLockout();
    const attempts = lk.attempts + 1;
    writeJSON(LOCKOUT_KEY, { attempts, lockedUntil: attempts >= MAX_ATTEMPTS ? Date.now() + LOCKOUT_MS : lk.lockedUntil });
  }

  // ── API helper ────────────────────────────────────────
  async function apiFetch(path, options = {}) {
    const session = readJSON(SESSION_KEY, null);
    const token   = session?.token;

    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });
    return res.json();
  }

  // ── Normaliza usuário da API para o formato do frontend ─
  function normalizeUser(u) {
    return {
      id:          u.id,
      name:        u.nome || u.name || u.username,
      username:    u.username,
      email:       u.email,
      company:     u.company || '',
      isDono:      !!u.isDono,
      permissions: u.permissions ?? null,
      empresaId:   u.empresaId,
    };
  }

  // ── Sessão ────────────────────────────────────────────
  function createSession(user, token, remember) {
    const ttl     = remember ? 1000 * 60 * 60 * 24 * 30 : 1000 * 60 * 60 * 8;
    const session = { token, user, createdAt: new Date().toISOString(), expiresAt: Date.now() + ttl };
    writeJSON(SESSION_KEY, session);
    return session;
  }

  function getSession() {
    const session = readJSON(SESSION_KEY, null);
    if (!session || !session.user || Date.now() > Number(session.expiresAt || 0)) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return session;
  }

  function getToken() {
    return readJSON(SESSION_KEY, null)?.token || null;
  }

  // ── Login ─────────────────────────────────────────────
  async function login(identifier, password, remember) {
    if (isLockedOut()) {
      return { ok: false, message: `Muitas tentativas. Aguarde ${lockoutSecondsLeft()}s antes de tentar novamente.` };
    }

    try {
      const data = await apiFetch('/auth/login', {
        method: 'POST',
        body:   JSON.stringify({ identifier: normalize(identifier), password, rememberMe: !!remember }),
      });

      if (!data.ok) {
        registerFailedAttempt();
        const remaining = MAX_ATTEMPTS - getLockout().attempts;
        if (remaining > 0) {
          return { ok: false, message: `${data.message || 'Usuário ou senha incorretos.'} ${remaining} tentativa${remaining > 1 ? 's' : ''} restante${remaining > 1 ? 's' : ''}.` };
        }
        return { ok: false, message: `Conta bloqueada por ${lockoutSecondsLeft()}s após múltiplas tentativas.` };
      }

      clearLockout();
      const user    = normalizeUser(data.user);
      const session = createSession(user, data.token, !!remember);
      return { ok: true, session };
    } catch (err) {
      console.error('[NexoAuth] login:', err);
      return { ok: false, message: 'Erro ao conectar com o servidor. Verifique se a API está rodando.' };
    }
  }

  // ── Registro (cadastro de nova empresa) ───────────────
  async function registerUser(data) {
    try {
      const result = await apiFetch('/auth/register', {
        method: 'POST',
        body:   JSON.stringify({
          nome:         data.name || data.username,
          username:     normalize(data.username),
          email:        normalize(data.email),
          password:     data.password,
          company:      data.company      || '',
          segmento:     data.segment      || data.segmento || '',
          telefone:     data.telefone     || '',
          cidade:       data.cidade       || '',
          funcionarios: data.funcionarios || '',
        }),
      });

      if (!result.ok) return { ok: false, message: result.message || 'Erro ao criar conta.' };

      const user    = normalizeUser(result.user);
      const session = createSession(user, result.token, true);
      return { ok: true, user, session };
    } catch (err) {
      console.error('[NexoAuth] registerUser:', err);
      return { ok: false, message: 'Erro ao conectar com o servidor. Verifique se a API está rodando.' };
    }
  }

  // ── Gerenciamento de sub-usuários ────────────────────
  async function addSubUser(data) {
    try {
      const result = await apiFetch('/usuarios', {
        method: 'POST',
        body: JSON.stringify({
          nome:        data.name || data.nome || data.username,
          username:    normalize(data.username),
          email:       normalize(data.email),
          password:    data.password,
          permissions: data.permissions || {},
        }),
      });
      if (!result.ok) return { ok: false, message: result.message || 'Erro ao criar usuário.' };
      return { ok: true, user: result.data };
    } catch (err) {
      console.error('[NexoAuth] addSubUser:', err);
      return { ok: false, message: 'Erro ao conectar com o servidor.' };
    }
  }

  async function updateSubUser(id, data) {
    try {
      const result = await apiFetch(`/usuarios/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...(data.name     && { nome:     data.name }),
          ...(data.username && { username: normalize(data.username) }),
          ...(data.email    && { email:    normalize(data.email) }),
          ...(data.password && { password: data.password }),
          ...(data.permissions && { permissions: data.permissions }),
        }),
      });
      if (!result.ok) return { ok: false, message: result.message || 'Erro ao atualizar usuário.' };
      return { ok: true, user: result.data };
    } catch (err) {
      console.error('[NexoAuth] updateSubUser:', err);
      return { ok: false, message: 'Erro ao conectar com o servidor.' };
    }
  }

  async function removeSubUser(id) {
    try {
      const result = await apiFetch(`/usuarios/${id}`, { method: 'DELETE' });
      if (!result.ok) return { ok: false, message: result.message || 'Erro ao remover usuário.' };
      return { ok: true };
    } catch (err) {
      console.error('[NexoAuth] removeSubUser:', err);
      return { ok: false, message: 'Erro ao conectar com o servidor.' };
    }
  }

  // ── Proteção de rotas ─────────────────────────────────
  function requireAuth() {
    const session = getSession();
    if (!session) {
      const next = encodeURIComponent(location.pathname.split('/').pop() || 'dashboard.html');
      location.href = `login.html?next=${next}`;
      return null;
    }
    return session;
  }

  // ── Logout ────────────────────────────────────────────
  function logout(redirectTo = 'login.html') {
    localStorage.removeItem(SESSION_KEY);
    location.href = redirectTo;
  }

  function confirmLogout() {
    try {
      const caixa = JSON.parse(localStorage.getItem('nexoerp.pdv.caixa') || 'null');
      if (caixa?.aberto) { _showLogoutCaixaAlert(); return; }
    } catch (_) {}
    if (confirm('Deseja sair da sua conta?')) logout('landing.html');
  }

  function _showLogoutCaixaAlert() {
    const existing = document.getElementById('_logoutCaixaAlert');
    if (existing) { existing.remove(); return; }
    const operador = (() => {
      try { return JSON.parse(localStorage.getItem('nexoerp.pdv.caixa'))?.operador || 'Operador'; } catch (_) { return 'Operador'; }
    })();
    const el = document.createElement('div');
    el.id = '_logoutCaixaAlert';
    el.style.cssText = `position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#0f1929;border:1px solid rgba(255,107,53,.3);border-radius:14px;padding:14px 18px;box-shadow:0 20px 50px rgba(0,0,0,.5);z-index:9999;min-width:340px;max-width:460px;display:flex;align-items:center;gap:12px;font-family:'Inter',sans-serif;`;
    el.innerHTML = `<div style="width:38px;height:38px;border-radius:10px;background:rgba(255,107,53,.15);display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#ff6b35;font-size:16px"><i class="bi bi-lock-fill"></i></div><div style="flex:1"><strong style="display:block;font-size:13px;color:#e8edf5;margin-bottom:2px">Caixa aberto por ${operador}</strong><span style="font-size:12px;color:#94a3b8">Feche o caixa antes de sair para manter o controle do turno.</span></div><div style="display:flex;gap:6px;flex-shrink:0"><button onclick="location.href='pdv.html'" style="padding:6px 12px;border-radius:8px;border:none;background:#00c896;color:#021c14;font-size:12px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif">Ir ao PDV</button><button onclick="document.getElementById('_logoutCaixaAlert').remove();if(confirm('Deseja sair da sua conta?')){localStorage.removeItem('nexoerp.session');location.href='landing.html'}" style="padding:6px 12px;border-radius:8px;border:1px solid rgba(255,255,255,.1);background:none;color:#94a3b8;font-size:12px;font-weight:600;cursor:pointer;font-family:'Inter',sans-serif">Ignorar e Sair</button></div>`;
    document.body.appendChild(el);
    setTimeout(() => el.parentNode && el.remove(), 12000);
  }

  // ── Utilitários de UI ─────────────────────────────────
  function getGreeting() {
    const h = new Date().getHours();
    return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  }

  function renderCurrentUser() {
    const session = getSession();
    if (!session) return;
    const user = session.user;
    document.querySelectorAll('.user-name, .u-name').forEach(el => { el.textContent = user.name; });
    document.querySelectorAll('.user-role, .u-role').forEach(el => { el.textContent = user.isDono ? 'Dono' : 'Colaborador'; });
    document.querySelectorAll('.user-avatar, .u-avatar').forEach(el => { el.textContent = initials(user.name); });
    const greeting = document.querySelector('.page-header h1, .header-title h1, #greeting-text');
    if (greeting && /^Bo[ma]\s+(dia|tarde|noite),/.test(greeting.textContent.trim())) {
      greeting.textContent = `${getGreeting()}, ${user.name.split(' ')[0]} 👋`;
    }
  }

  window.NexoAuth = {
    registerUser,
    login,
    getSession,
    getToken,
    requireAuth,
    logout,
    confirmLogout,
    renderCurrentUser,
    addSubUser,
    updateSubUser,
    removeSubUser,
    ALL_MODULES,
    apiFetch,
  };
})();
