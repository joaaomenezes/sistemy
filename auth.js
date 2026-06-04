(function () {
  const USERS_KEY = 'nexoerp.users';
  const SESSION_KEY = 'nexoerp.session';

  const demoUser = {
    id: 'demo-admin',
    name: 'Joao Desenvolvedor',
    username: 'admin',
    email: 'admin@nexoerp.com',
    password: 'admin123',
    role: 'Administrador',
    company: 'NexoERP Demo',
    createdAt: new Date().toISOString()
  };

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (err) {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      if (err.name === 'QuotaExceededError') {
        console.error('[NexoERP] localStorage cheio — não foi possível salvar:', key);
        if (typeof showToast === 'function') showToast('❌ Armazenamento local cheio. Exporte seus dados.', 'error');
      }
      return false;
    }
  }

  function normalize(value) {
    return String(value || '').trim().toLowerCase();
  }

  function initials(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'NX';
    return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
  }

  const DEMO_REMOVED_KEY = 'nexoerp.demo_removed';

  function ensureDemoUser() {
    const users = readJSON(USERS_KEY, []);
    const demoRemoved = localStorage.getItem(DEMO_REMOVED_KEY) === 'true';
    const exists = users.some(user => user.id === demoUser.id || normalize(user.email) === normalize(demoUser.email));
    if (!exists && !demoRemoved) {
      users.unshift(demoUser);
      writeJSON(USERS_KEY, users);
    }
    return users;
  }

  function publicUser(user) {
    return {
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      role: user.role || 'Administrador',
      company: user.company || ''
    };
  }

  function createSession(user, remember) {
    const now = Date.now();
    const ttl = remember ? 1000 * 60 * 60 * 24 * 30 : 1000 * 60 * 60 * 8;
    const session = {
      user: publicUser(user),
      createdAt: new Date(now).toISOString(),
      expiresAt: now + ttl
    };
    writeJSON(SESSION_KEY, session);
    return session;
  }

  function getUsers() {
    return ensureDemoUser();
  }

  function registerUser(data) {
    const users = getUsers();
    const email = normalize(data.email);
    const username = normalize(data.username);

    if (!email || !username || !data.password) {
      return { ok: false, message: 'Preencha usuario, e-mail e senha.' };
    }

    const duplicated = users.some(user =>
      normalize(user.email) === email || normalize(user.username) === username
    );
    if (duplicated) {
      return { ok: false, message: 'Este e-mail ou usuario ja esta cadastrado.' };
    }

    const user = {
      id: `user-${Date.now()}`,
      name: data.name || username,
      username,
      email,
      password: data.password,
      role: data.role || 'Administrador',
      company: data.company || '',
      segment: data.segment || '',
      plan: data.plan || '',
      createdAt: new Date().toISOString()
    };

    users.unshift(user);
    writeJSON(USERS_KEY, users);
    createSession(user, true);
    return { ok: true, user: publicUser(user) };
  }

  function login(identifier, password, remember) {
    const needle = normalize(identifier);
    const user = getUsers().find(item =>
      normalize(item.email) === needle || normalize(item.username) === needle
    );

    if (!user || String(user.password) !== String(password)) {
      return { ok: false, message: 'Usuario ou senha incorretos.' };
    }

    return { ok: true, session: createSession(user, remember) };
  }

  function getSession() {
    const session = readJSON(SESSION_KEY, null);
    if (!session || !session.user || Date.now() > Number(session.expiresAt || 0)) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return session;
  }

  function requireAuth() {
    const session = getSession();
    if (!session) {
      const next = encodeURIComponent(location.pathname.split('/').pop() || 'dashboard.html');
      location.href = `login.html?next=${next}`;
      return null;
    }
    return session;
  }

  function logout(redirectTo = 'login.html') {
    localStorage.removeItem(SESSION_KEY);
    location.href = redirectTo;
  }

  function confirmLogout() {
    // Verifica se há um caixa aberto antes de sair
    try {
      const caixaRaw = localStorage.getItem('nexoerp.pdv.caixa');
      if (caixaRaw) {
        const caixa = JSON.parse(caixaRaw);
        if (caixa && caixa.aberto) {
          _showLogoutCaixaAlert();
          return;
        }
      }
    } catch (_) {}
    if (confirm('Deseja sair da sua conta?')) {
      logout('landing.html');
    }
  }

  function _showLogoutCaixaAlert() {
    const existing = document.getElementById('_logoutCaixaAlert');
    if (existing) { existing.remove(); return; }

    const operador = (() => {
      try {
        return JSON.parse(localStorage.getItem('nexoerp.pdv.caixa'))?.operador || 'Operador';
      } catch (_) { return 'Operador'; }
    })();

    const el = document.createElement('div');
    el.id = '_logoutCaixaAlert';
    el.style.cssText = `
      position:fixed;bottom:24px;left:50%;transform:translateX(-50%);
      background:#0f1929;border:1px solid rgba(255,107,53,.3);border-radius:14px;
      padding:14px 18px;box-shadow:0 20px 50px rgba(0,0,0,.5);z-index:9999;
      min-width:340px;max-width:460px;display:flex;align-items:center;gap:12px;
      animation:slideUp .3s cubic-bezier(.34,1.2,.64,1) both;font-family:'Inter',sans-serif;
    `;
    el.innerHTML = `
      <div style="width:38px;height:38px;border-radius:10px;background:rgba(255,107,53,.15);
                  display:flex;align-items:center;justify-content:center;flex-shrink:0;
                  color:#ff6b35;font-size:16px">
        <i class="bi bi-lock-fill"></i>
      </div>
      <div style="flex:1">
        <strong style="display:block;font-size:13px;color:#e8edf5;margin-bottom:2px">
          Caixa aberto por ${operador}
        </strong>
        <span style="font-size:12px;color:#94a3b8">
          Feche o caixa antes de sair para manter o controle do turno.
        </span>
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0">
        <button onclick="location.href='pdv.html'"
          style="padding:6px 12px;border-radius:8px;border:none;background:#00c896;
                 color:#021c14;font-size:12px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif">
          Ir ao PDV
        </button>
        <button onclick="document.getElementById('_logoutCaixaAlert').remove();
                         if(confirm('Deseja sair da sua conta?')){localStorage.removeItem('nexoerp.session');location.href='landing.html'}"
          style="padding:6px 12px;border-radius:8px;border:1px solid rgba(255,255,255,.1);
                 background:none;color:#94a3b8;font-size:12px;font-weight:600;cursor:pointer;font-family:'Inter',sans-serif">
          Ignorar e Sair
        </button>
      </div>`;
    document.body.appendChild(el);
    setTimeout(() => el.parentNode && el.remove(), 12000);
  }

  function getGreeting() {
    const h = new Date().getHours();
    return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  }

  function renderCurrentUser() {
    const session = getSession();
    if (!session) return;
    const user = session.user;

    document.querySelectorAll('.user-name, .u-name').forEach(el => {
      el.textContent = user.name;
    });
    document.querySelectorAll('.user-role, .u-role').forEach(el => {
      el.textContent = user.role || 'Administrador';
    });
    document.querySelectorAll('.user-avatar, .u-avatar').forEach(el => {
      el.textContent = initials(user.name);
    });

    const greeting = document.querySelector('.page-header h1, .header-title h1, #greeting-text');
    if (greeting && /^Bo[ma]\s+(dia|tarde|noite),/.test(greeting.textContent.trim())) {
      const firstName = user.name.split(' ')[0] || user.name;
      greeting.textContent = `${getGreeting()}, ${firstName} 👋`;
    }
  }

  window.NexoAuth = {
    getUsers,
    registerUser,
    login,
    getSession,
    requireAuth,
    logout,
    confirmLogout,
    renderCurrentUser
  };
})();
