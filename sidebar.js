(function() {
    const MENU = [
      { label: 'Dashboard',       href: 'dashboard.html',     icon: 'bi-grid-1x2-fill',            section: 'Principal' },
      { label: 'PDV',             href: 'pdv.html',           icon: 'bi-display',                  section: 'Principal' },
      { label: 'Pedidos',         href: 'pedidos.html',       icon: 'bi-file-earmark-text-fill',   section: 'Principal' },
      { label: 'Vendas',          href: 'vendas.html',        icon: 'bi-cart4',                    section: 'Principal', badge: '12' },
      { label: 'Clientes',        href: 'clientes.html',      icon: 'bi-people-fill',              section: 'Principal' },
      { label: 'Produtos',        href: 'produtos.html',      icon: 'bi-box-seam-fill',            section: 'Principal' },
      { label: 'Estoque',         href: 'estoque.html',       icon: 'bi-stack',                    section: 'Principal' },
      { label: 'Relatórios',      href: '#',                  icon: 'bi-graph-up-arrow',           section: 'Financeiro' },
      { label: 'Financeiro',      href: 'financeiro.html',    icon: 'bi-credit-card-2-back-fill',  section: 'Financeiro' },
      { label: 'Fiscal / NF-e',   href: '#',                  icon: 'bi-receipt-cutoff',           section: 'Financeiro' },
      { label: 'Parceiros',       href: '#',                  icon: 'bi-briefcase-fill',           section: 'Sistema' },
      { label: 'Configurações',   href: 'configuracoes.html', icon: 'bi-gear-fill',                section: 'Sistema' },
    ];
  
    const currentPage = window.location.pathname.split('/').pop() || 'dashboard.html';
  
    // Group by section
    const sections = [...new Set(MENU.map(i => i.section))];
  
    let sectionsHTML = sections.map(sec => {
      const items = MENU.filter(i => i.section === sec).map(item => {
        const active = item.href === currentPage ? 'active' : '';
        const badge  = item.badge ? `<span class="badge">${item.badge}</span>` : '';
        return `
          <a href="${item.href}" class="nav-item ${active}">
            <i class="bi ${item.icon}"></i>
            <span class="nav-label">${item.label}</span>
            ${badge}
          </a>`;
      }).join('');
  
      return `
        <div class="sidebar-section">
          <div class="sidebar-section-label">${sec}</div>
          ${items}
        </div>`;
    }).join('');
  
    const user = JSON.parse(localStorage.getItem('nexoerp.user') || '{}');
    const userName  = user.name  || 'Usuário';
    const userRole  = user.role  || 'Administrador';
    const userInitials = userName.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase();
  
    const html = `
      <aside class="sidebar collapsed" id="sidebar">
        <div class="sidebar-brand">
          <div class="brand-icon">N</div>
          <span class="brand-text">Nexo<span>ERP</span></span>
        </div>
        <div class="sidebar-toggle" onclick="toggleSidebar()" id="sidebarToggle">
          <i class="bi bi-chevron-right" id="toggleIcon"></i>
        </div>
        ${sectionsHTML}
        <div class="sidebar-footer">
          <div class="user-row">
            <div class="user-avatar">${userInitials}</div>
            <div class="user-info">
              <div class="user-name">${userName}</div>
              <div class="user-role">${userRole}</div>
            </div>
            <i class="bi bi-three-dots-vertical" style="color:var(--muted);margin-left:auto;font-size:15px;flex-shrink:0"></i>
          </div>
          <a class="nav-item" onclick="NexoAuth.confirmLogout()" style="cursor:pointer;color:var(--danger)">
            <i class="bi bi-box-arrow-left"></i>
            <span class="nav-label">Sair</span>
          </a>
        </div>
      </aside>`;
  
    document.getElementById('sidebar-root').outerHTML = html;
  })();