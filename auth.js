(function () {
  const SESSION_KEY = 'nexoerp.session';
  const LOCKOUT_KEY = 'nexoerp.login.lockout';
  const API_URL = (function () {
    if (window.NEXO_CONFIG && window.NEXO_CONFIG.apiUrl) return window.NEXO_CONFIG.apiUrl;
    const h = window.location.hostname;
    if (h === 'localhost' || h === '127.0.0.1') return 'http://localhost:3333/api';
    return 'https://CONFIGURAR-ANTES-DO-DEPLOY.railway.app/api';
  })();

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
        if (data.code === 'EMAIL_NOT_VERIFIED') {
          return {
            ok: false,
            code: data.code,
            email: data.email,
            message: data.message || 'Confirme seu e-mail antes de acessar o sistema.',
          };
        }
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

      if (result.requiresEmailVerification) {
        return {
          ok: true,
          requiresEmailVerification: true,
          email: result.email,
          message: result.message,
          verification: result.verification,
        };
      }

      const user    = normalizeUser(result.user);
      const session = createSession(user, result.token, true);
      return { ok: true, user, session, verification: result.verification };
    } catch (err) {
      console.error('[NexoAuth] registerUser:', err);
      return { ok: false, message: 'Erro ao conectar com o servidor. Verifique se a API está rodando.' };
    }
  }

  async function verifyEmail(token) {
    try {
      const result = await apiFetch('/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({ token }),
      });
      if (!result.ok) return { ok: false, message: result.message || 'Erro ao confirmar e-mail.' };
      const user = normalizeUser(result.user);
      const session = createSession(user, result.token, true);
      return { ok: true, user, session, message: result.message };
    } catch (err) {
      console.error('[NexoAuth] verifyEmail:', err);
      return { ok: false, message: 'Erro ao conectar com o servidor.' };
    }
  }

  async function resendVerification(identifier) {
    try {
      const result = await apiFetch('/auth/resend-verification', {
        method: 'POST',
        body: JSON.stringify({ identifier: normalize(identifier) }),
      });
      return result.ok
        ? { ok: true, message: result.message, verification: result.verification }
        : { ok: false, message: result.message || 'Erro ao reenviar confirmação.' };
    } catch (err) {
      console.error('[NexoAuth] resendVerification:', err);
      return { ok: false, message: 'Erro ao conectar com o servidor.' };
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

  async function updateMyProfile(data) {
    try {
      const result = await apiFetch('/auth/me', {
        method: 'PATCH',
        body: JSON.stringify({
          ...(data.name     && { nome:     data.name }),
          ...(data.username && { username: normalize(data.username) }),
          ...(data.email    && { email:    normalize(data.email) }),
          ...(data.password && { password: data.password }),
        }),
      });
      if (!result.ok) return { ok: false, message: result.message || 'Erro ao atualizar perfil.' };
      const session = getSession();
      if (session) {
        session.user = { ...session.user, ...normalizeUser(result.data) };
        writeJSON(SESSION_KEY, session);
      }
      return { ok: true, user: result.data };
    } catch (err) {
      console.error('[NexoAuth] updateMyProfile:', err);
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
  function _setAvatar(session) {
    const nome = session?.user?.nome || session?.user?.username || '';
    const parts = nome.trim().split(/\s+/);
    const initials = parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : nome.slice(0, 2).toUpperCase();
    document.querySelectorAll('.user-avatar').forEach(el => {
      if (el.textContent.trim() === 'JD' || el.textContent.trim() === '') el.textContent = initials;
    });
  }

  function requireAuth() {
    const session = getSession();
    if (!session) {
      const next = encodeURIComponent(location.pathname.split('/').pop() || 'dashboard.html');
      location.href = `login.html?next=${next}`;
      return null;
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => _setAvatar(session));
    } else {
      _setAvatar(session);
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

  // ── Toast global ─────────────────────────────────────
  const _TOAST_TYPES = {
    success: { icon: 'bi-check-circle-fill',          color: '#00c896', border: 'rgba(0,200,150,.25)'  },
    error:   { icon: 'bi-x-circle-fill',              color: '#ff4757', border: 'rgba(255,71,87,.25)'  },
    warning: { icon: 'bi-exclamation-triangle-fill',  color: '#f5b700', border: 'rgba(245,183,0,.25)'  },
    info:    { icon: 'bi-info-circle-fill',           color: '#0077ff', border: 'rgba(0,119,255,.25)'  },
  };

  let _toastContainer = null;
  function _getToastContainer() {
    if (!_toastContainer || !document.documentElement.contains(_toastContainer)) {
      _toastContainer = document.createElement('div');
      _toastContainer.id = 'nexo-toast-container';
      // Usa position:fixed no documentElement para escapar de overflow:hidden no body (ex: PDV)
      _toastContainer.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:2147483647;display:flex;flex-direction:column;gap:10px;pointer-events:none;';
      const style = document.createElement('style');
      style.textContent = '@keyframes _nxTIn{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}@keyframes _nxTOut{from{opacity:1;transform:translateX(0)}to{opacity:0;transform:translateX(20px)}}';
      document.head.appendChild(style);
      document.documentElement.appendChild(_toastContainer);
    }
    return _toastContainer;
  }

  function _stripEmojis(str) {
    return String(str).replace(/^[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}✅❌⚠️ℹ️\s]+/u, '').trim();
  }

  function _toast(message, type = 'info', duration = 3500) {
    const t = _TOAST_TYPES[type] || _TOAST_TYPES.info;
    const msg = _stripEmojis(message);
    const el = document.createElement('div');
    el.style.cssText = `display:flex;align-items:center;gap:12px;padding:13px 16px;background:#10151e;border:1px solid ${t.border};border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,.4);min-width:280px;max-width:380px;pointer-events:all;animation:_nxTIn .25s ease;font-family:'Inter',sans-serif;`;
    el.innerHTML = `<i class="bi ${t.icon}" style="color:${t.color};font-size:18px;flex-shrink:0"></i><span style="font-size:13px;color:#e8edf5;line-height:1.4;flex:1">${msg}</span><i class="bi bi-x" style="color:#6b7f96;font-size:16px;cursor:pointer;flex-shrink:0" onclick="this.parentElement.remove()"></i>`;
    _getToastContainer().appendChild(el);
    setTimeout(() => {
      el.style.animation = '_nxTOut .3s ease forwards';
      setTimeout(() => el.remove(), 300);
    }, duration);
  }

  window.NexoToast = {
    show:    (msg, type, ms)  => _toast(msg, type, ms),
    success: (msg, ms)        => _toast(msg, 'success', ms),
    error:   (msg, ms)        => _toast(msg, 'error',   ms),
    warning: (msg, ms)        => _toast(msg, 'warning', ms),
    info:    (msg, ms)        => _toast(msg, 'info',    ms),
  };

  window.NexoAuth = {
    registerUser,
    verifyEmail,
    resendVerification,
    login,
    getSession,
    getToken,
    requireAuth,
    logout,
    confirmLogout,
    renderCurrentUser,
    addSubUser,
    updateSubUser,
    updateMyProfile,
    removeSubUser,
    ALL_MODULES,
    apiFetch,
  };
})();
