(function () {
  const USERS_KEY    = 'nexoerp.users';
  const SESSION_KEY  = 'nexoerp.session';
  const LOCKOUT_KEY  = 'nexoerp.login.lockout';

  // Lista de todos os módulos do sistema para permissões
  const ALL_MODULES = [
    'dashboard','pdv','pedidos','vendas','clientes',
    'produtos','estoque','financeiro','relatorios','configuracoes'
  ];

  const demoUser = {
    id: 'demo-admin',
    name: 'Joao Desenvolvedor',
    username: 'admin',
    email: 'admin@nexoerp.com',
    passwordHash: '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', // SHA-256('admin123')
    isDono: true,
    permissions: null, // null = acesso total irrestrito
    company: 'NexoERP Demo',
    createdAt: new Date().toISOString()
  };

  // ── Crypto ────────────────────────────────────────────
  async function sha256(str) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // ── Storage helpers ───────────────────────────────────
  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      if (err.name === 'QuotaExceededError') {
        console.error('[NexoERP] localStorage cheio:', key);
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

  // ── Rate limiting ─────────────────────────────────────
  const MAX_ATTEMPTS = 5;
  const LOCKOUT_MS   = 30 * 1000;

  function getLockout() {
    return readJSON(LOCKOUT_KEY, { attempts: 0, lockedUntil: 0 });
  }

  function isLockedOut() {
    const lk = getLockout();
    return lk.attempts >= MAX_ATTEMPTS && Date.now() < lk.lockedUntil;
  }

  function lockoutSecondsLeft() {
    return Math.ceil((getLockout().lockedUntil - Date.now()) / 1000);
  }

  function registerFailedAttempt() {
    const lk = getLockout();
    const attempts = lk.attempts + 1;
    writeJSON(LOCKOUT_KEY, {
      attempts,
      lockedUntil: attempts >= MAX_ATTEMPTS ? Date.now() + LOCKOUT_MS : lk.lockedUntil
    });
  }

  function clearLockout() {
    localStorage.removeItem(LOCKOUT_KEY);
  }

  // ── Demo user ─────────────────────────────────────────
  const DEMO_REMOVED_KEY = 'nexoerp.demo_removed';

  // Todas as chaves de dados que devem ser apagadas ao criar uma nova conta
  const DATA_KEYS = [
    'nexoerp.produtos', 'nexoerp.clientes', 'nexoerp.fornecedores',
    'nexoerp.vendas', 'nexoerp.pedidos', 'nexoerp.financeiro',
    'nexoerp.movimentacoes', 'nexoerp.depositos', 'nexoerp.catalogo.config',
    'nexoerp.pdv.config', 'nexoerp.pdv.vendas', 'nexoerp.pdv.caixa', 'nexoerp.pdv.suspendedCarts',
    'nexoerp.custos', 'nexoerp.custos.categorias',
    'nexoerp.relatorios.historico', 'nexoerp.categorias',
    'nexoerp.config',
    'sistemy.produtos', 'catalogo-cfg', // legado
  ];

  function ensureDemoUser() {
    const users = readJSON(USERS_KEY, []);
    const demoRemoved = localStorage.getItem(DEMO_REMOVED_KEY) === 'true';
    const idx = users.findIndex(u => u.id === demoUser.id || normalize(u.email) === normalize(demoUser.email));
    if (!demoRemoved) {
      if (idx < 0) {
        users.unshift(demoUser);
        writeJSON(USERS_KEY, users);
      } else {
        // Atualiza campos desatualizados (hash, isDono, permissions)
        let changed = false;
        if (users[idx].passwordHash !== demoUser.passwordHash) { users[idx].passwordHash = demoUser.passwordHash; changed = true; }
        if (!users[idx].isDono) { users[idx].isDono = true; changed = true; }
        if (!('permissions' in users[idx])) { users[idx].permissions = null; changed = true; }
        if (changed) writeJSON(USERS_KEY, users);
      }
    }
    return users;
  }

  // ── Sessão pública (o que fica gravado no nexoerp.session) ─
  // Inclui isDono e permissions para que requirePermission() e
  // sidebar.js possam funcionar sem ler nexoerp.users novamente.
  function publicUser(user) {
    return {
      id:          user.id,
      name:        user.name,
      username:    user.username,
      email:       user.email,
      company:     user.company || '',
      isDono:      !!user.isDono,
      permissions: user.permissions ?? null
    };
  }

  function createSession(user, remember) {
    const now = Date.now();
    const ttl = remember ? 1000 * 60 * 60 * 24 * 30 : 1000 * 60 * 60 * 8;
    const session = { user: publicUser(user), createdAt: new Date(now).toISOString(), expiresAt: now + ttl };
    writeJSON(SESSION_KEY, session);
    return session;
  }

  function getUsers() {
    return ensureDemoUser();
  }

  // ── Migração de senhas plaintext ──────────────────────
  async function migratePasswordIfNeeded(user) {
    if (user.password && !user.passwordHash) {
      const hash = await sha256(user.password);
      const users = readJSON(USERS_KEY, []);
      const idx = users.findIndex(u => u.id === user.id);
      if (idx >= 0) {
        users[idx].passwordHash = hash;
        delete users[idx].password;
        writeJSON(USERS_KEY, users);
      }
      user.passwordHash = hash;
      delete user.password;
    }
  }

  // ── API pública ───────────────────────────────────────

  // Registro público (cadastro.html) — cria o Dono da empresa.
  async function registerUser(data) {
    const users = getUsers();
    const email    = normalize(data.email);
    const username = normalize(data.username);

    if (!email || !username || !data.password) {
      return { ok: false, message: 'Preencha usuario, e-mail e senha.' };
    }

    const duplicated = users.some(u =>
      normalize(u.email) === email || normalize(u.username) === username
    );
    if (duplicated) {
      return { ok: false, message: 'Este e-mail ou usuario ja esta cadastrado.' };
    }

    const passwordHash = await sha256(data.password);
    const user = {
      id: `user-${Date.now()}`,
      name:     data.name || username,
      username,
      email,
      passwordHash,
      isDono:      true,   // quem registra via página pública é o Dono
      permissions: null,   // null = acesso total irrestrito
      company:  data.company || '',
      segment:  data.segment || '',
      plan:     data.plan || '',
      createdAt: new Date().toISOString()
    };

    // Novo registro = empresa nova, começa do zero — limpa todos os dados
    DATA_KEYS.forEach(k => localStorage.removeItem(k));
    const saved = writeJSON(USERS_KEY, [user]);
    if (!saved) return { ok: false, message: 'Erro ao salvar dados. Armazenamento local cheio.' };

    localStorage.setItem(DEMO_REMOVED_KEY, 'true');
    localStorage.removeItem(SESSION_KEY);

    const session = createSession(user, true);
    const check = readJSON(SESSION_KEY, null);
    if (!check || check.user?.id !== user.id) {
      return { ok: false, message: 'Erro ao criar sessão. Tente novamente.' };
    }

    return { ok: true, user: publicUser(user) };
  }

  // Criação de sub-usuário pelo Dono/gestor (configuracoes.html).
  // Não cria sessão — apenas adiciona ao nexoerp.users.
  async function addSubUser(data) {
    const users = readJSON(USERS_KEY, []);
    const email    = normalize(data.email);
    const username = normalize(data.username || data.email.split('@')[0]);

    if (!email || !data.password) {
      return { ok: false, message: 'Preencha e-mail e senha.' };
    }

    if (users.some(u => normalize(u.email) === email || normalize(u.username) === username)) {
      return { ok: false, message: 'Este e-mail ou usuário já está cadastrado.' };
    }

    const passwordHash = await sha256(data.password);

    // Garante que o objeto permissions só contém chaves válidas e
    // que 'configuracoes' só é concedida se o criador também a tem.
    const perms = {};
    ALL_MODULES.forEach(mod => {
      perms[mod] = !!(data.permissions && data.permissions[mod]);
    });

    const user = {
      id:          `user-${Date.now()}`,
      name:        data.name || username,
      username,
      email,
      passwordHash,
      isDono:      false,
      permissions: perms,
      company:     data.company || '',
      createdAt:   new Date().toISOString()
    };

    users.push(user);
    const saved = writeJSON(USERS_KEY, users);
    if (!saved) return { ok: false, message: 'Erro ao salvar. Armazenamento local cheio.' };

    return { ok: true, user };
  }

  // Atualiza dados de um sub-usuário existente (sem alterar senha se não fornecida).
  async function updateSubUser(id, data) {
    const users = readJSON(USERS_KEY, []);
    const idx = users.findIndex(u => u.id === id);
    if (idx < 0) return { ok: false, message: 'Usuário não encontrado.' };

    const u = users[idx];

    // Impede alterar o Dono por esta rota
    if (u.isDono) return { ok: false, message: 'O Dono não pode ser editado por esta rota.' };

    u.name  = data.name  || u.name;
    u.email = normalize(data.email) || u.email;

    if (data.username) {
      const newUsername = normalize(data.username);
      const taken = users.some((x, i) => i !== idx && normalize(x.username) === newUsername);
      if (taken) return { ok: false, message: 'Este login já está em uso por outro usuário.' };
      u.username = newUsername;
    }

    if (data.password) {
      u.passwordHash = await sha256(data.password);
      delete u.password;
    }

    if (data.permissions) {
      const perms = {};
      ALL_MODULES.forEach(mod => { perms[mod] = !!(data.permissions[mod]); });
      u.permissions = perms;
    }

    users[idx] = u;
    const saved = writeJSON(USERS_KEY, users);
    if (!saved) return { ok: false, message: 'Erro ao salvar.' };

    return { ok: true, user: u };
  }

  async function login(identifier, password, remember) {
    if (isLockedOut()) {
      return { ok: false, message: `Muitas tentativas. Aguarde ${lockoutSecondsLeft()}s antes de tentar novamente.` };
    }

    const needle = normalize(identifier);
    const user = getUsers().find(u =>
      normalize(u.email) === needle || normalize(u.username) === needle
    );

    if (!user) {
      registerFailedAttempt();
      return { ok: false, message: 'Usuario ou senha incorretos.' };
    }

    const inputHash  = await sha256(password);
    const hashMatch      = user.passwordHash && user.passwordHash === inputHash;
    const plaintextMatch = user.password && String(user.password) === String(password);

    if (!hashMatch && !plaintextMatch) {
      registerFailedAttempt();
      const lk = getLockout();
      const remaining = MAX_ATTEMPTS - lk.attempts;
      if (remaining > 0) {
        return { ok: false, message: `Usuario ou senha incorretos. ${remaining} tentativa${remaining > 1 ? 's' : ''} restante${remaining > 1 ? 's' : ''}.` };
      }
      return { ok: false, message: `Conta bloqueada por ${lockoutSecondsLeft()}s após múltiplas tentativas incorretas.` };
    }

    clearLockout();
    await migratePasswordIfNeeded(user);
    return { ok: true, session: createSession(user, remember) };
  }

  function getSession() {
    const session = readJSON(SESSION_KEY, null);
    if (!session || !session.user || Date.now() > Number(session.expiresAt || 0)) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    // Migra sessões antigas que não tinham isDono / permissions
    if (session.user.isDono === undefined || !('permissions' in session.user)) {
      const users = readJSON(USERS_KEY, []);
      const full  = users.find(u => u.id === session.user.id);
      if (full) {
        session.user.isDono      = !!full.isDono;
        session.user.permissions = full.permissions ?? null;
        writeJSON(SESSION_KEY, session);
      }
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
    try {
      const caixaRaw = localStorage.getItem('nexoerp.pdv.caixa');
      if (caixaRaw) {
        const caixa = JSON.parse(caixaRaw);
        if (caixa && caixa.aberto) { _showLogoutCaixaAlert(); return; }
      }
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
    el.style.cssText = `position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#0f1929;border:1px solid rgba(255,107,53,.3);border-radius:14px;padding:14px 18px;box-shadow:0 20px 50px rgba(0,0,0,.5);z-index:9999;min-width:340px;max-width:460px;display:flex;align-items:center;gap:12px;animation:slideUp .3s cubic-bezier(.34,1.2,.64,1) both;font-family:'Inter',sans-serif;`;
    el.innerHTML = `<div style="width:38px;height:38px;border-radius:10px;background:rgba(255,107,53,.15);display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#ff6b35;font-size:16px"><i class="bi bi-lock-fill"></i></div><div style="flex:1"><strong style="display:block;font-size:13px;color:#e8edf5;margin-bottom:2px">Caixa aberto por ${operador}</strong><span style="font-size:12px;color:#94a3b8">Feche o caixa antes de sair para manter o controle do turno.</span></div><div style="display:flex;gap:6px;flex-shrink:0"><button onclick="location.href='pdv.html'" style="padding:6px 12px;border-radius:8px;border:none;background:#00c896;color:#021c14;font-size:12px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif">Ir ao PDV</button><button onclick="document.getElementById('_logoutCaixaAlert').remove();if(confirm('Deseja sair da sua conta?')){localStorage.removeItem('nexoerp.session');location.href='landing.html'}" style="padding:6px 12px;border-radius:8px;border:1px solid rgba(255,255,255,.1);background:none;color:#94a3b8;font-size:12px;font-weight:600;cursor:pointer;font-family:'Inter',sans-serif">Ignorar e Sair</button></div>`;
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
    document.querySelectorAll('.user-name, .u-name').forEach(el => { el.textContent = user.name; });
    document.querySelectorAll('.user-role, .u-role').forEach(el => {
      el.textContent = user.isDono ? 'Dono' : 'Colaborador';
    });
    document.querySelectorAll('.user-avatar, .u-avatar').forEach(el => { el.textContent = initials(user.name); });
    const greeting = document.querySelector('.page-header h1, .header-title h1, #greeting-text');
    if (greeting && /^Bo[ma]\s+(dia|tarde|noite),/.test(greeting.textContent.trim())) {
      const firstName = user.name.split(' ')[0] || user.name;
      greeting.textContent = `${getGreeting()}, ${firstName} 👋`;
    }
  }

  window.NexoAuth = {
    getUsers,
    registerUser,
    addSubUser,
    updateSubUser,
    login,
    getSession,
    requireAuth,
    logout,
    confirmLogout,
    renderCurrentUser,
    ALL_MODULES
  };
})();
