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
    localStorage.setItem(key, JSON.stringify(value));
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
    if (confirm('Deseja sair da sua conta?')) {
      logout('landing.html');
    }
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

    const greeting = document.querySelector('.page-header h1, .header-title h1');
    if (greeting && /^Bom dia,/.test(greeting.textContent.trim())) {
      greeting.textContent = `Bom dia, ${user.name.split(' ')[0] || user.name}`;
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
