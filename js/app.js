/**
 * ==============================================================================
 * ZAPURSE FINTECH CRM - MASTER APPLICATION CONTROLLER
 * ==============================================================================
 */

const App = {
  currentView: 'dashboard',

  init() {
    // 0. Initialize Theme (Dark / Light)
    this.initTheme();

    // 1. Initialize Auth
    Auth.init();

    // 2. Hash routing listener
    window.addEventListener('hashchange', () => {
      const hash = window.location.hash.replace('#', '');
      if (hash && hash !== this.currentView) {
        this.navigate(hash);
      }
    });

    // 3. Update API Status Pill
    this.updateApiStatusIndicator();
  },

  initTheme() {
    const saved = localStorage.getItem(Config.STORAGE_KEY_THEME) || 'dark';
    this.applyTheme(saved);
  },

  toggleTheme() {
    const isDark = document.documentElement.classList.contains('dark');
    const next = isDark ? 'light' : 'dark';
    this.applyTheme(next);
  },

  applyTheme(theme) {
    const html = document.documentElement;
    const icon = document.getElementById('theme-toggle-icon');
    const text = document.getElementById('theme-toggle-text');
    const btn = document.getElementById('theme-toggle-btn');

    if (theme === 'light') {
      html.classList.remove('dark');
      html.classList.add('light');
      localStorage.setItem(Config.STORAGE_KEY_THEME, 'light');
      if (icon) {
        icon.setAttribute('data-lucide', 'moon');
        icon.className = 'w-3.5 h-3.5 text-indigo-500';
      }
      if (text) text.textContent = 'Dark';
      if (btn) btn.title = 'Switch to Dark Mode';
    } else {
      html.classList.remove('light');
      html.classList.add('dark');
      localStorage.setItem(Config.STORAGE_KEY_THEME, 'dark');
      if (icon) {
        icon.setAttribute('data-lucide', 'sun');
        icon.className = 'w-3.5 h-3.5 text-amber-400';
      }
      if (text) text.textContent = 'Light';
      if (btn) btn.title = 'Switch to Light Mode';
    }

    if (window.lucide) lucide.createIcons();
    if (window.Dashboard && Dashboard.chartInstance && Dashboard.cachedChartData && Dashboard.cachedChartData.length > 0) {
      Dashboard.renderChart(Dashboard.cachedChartData);
    }
  },

  onUserLoggedIn() {
    // Populate Services in Sidebar
    const services = Config.DEFAULT_SERVICES;
    this.populateDynamicServicesNav(services);

    // Initial view load
    const hash = window.location.hash.replace('#', '') || 'dashboard';
    this.navigate(hash);
  },

  populateDynamicServicesNav(services) {
    const container = document.getElementById('dynamic-services-nav');
    const badge = document.getElementById('services-count-badge');
    if (!container) return;

    if (badge) badge.textContent = services.length;

    container.innerHTML = services.map(s => `
      <a href="#service-${encodeURIComponent(s)}" onclick="Services.openService('${s}')"
        class="nav-link flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800/60 transition group">
        <span class="flex items-center gap-2">
          <span class="w-1.5 h-1.5 rounded-full bg-brand-500 group-hover:scale-125 transition-transform"></span>
          <span>${s}</span>
        </span>
        <i data-lucide="chevron-right" class="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-300"></i>
      </a>
    `).join('');

    // Also sync all service filter dropdowns across views
    ['calling-filter-service', 'sales-filter-service'].forEach(id => {
      const sel = document.getElementById(id);
      if (sel) {
        const cur = sel.value || 'ALL';
        sel.innerHTML = `<option value="ALL">All Services</option>` +
          services.map(s => `<option value="${s}" ${s === cur ? 'selected' : ''}>${s}</option>`).join('');
      }
    });

    // Populate Dedicated Services Picker Sheet (For mobile navigation)
    this.populateServicesPickerList(services);

    if (window.lucide) lucide.createIcons();
  },

  navigate(viewName, param) {
    if (viewName === 'services') {
      const serviceName = param || Services.currentService || Config.DEFAULT_SERVICES[0];
      Services.openService(serviceName);
      this.updateMobileBottomNav('services');
      this.closeMobileSidebar();
      return;
    }

    if (viewName.startsWith('service-')) {
      const serviceName = decodeURIComponent(viewName.replace('service-', ''));
      Services.openService(serviceName);
      this.updateMobileBottomNav('services');
      this.closeMobileSidebar();
      return;
    }

    this.switchView(viewName);

    // Load view module data
    if (viewName === 'dashboard') {
      Dashboard.load();
    } else if (viewName === 'calling') {
      Calling.load();
    } else if (viewName === 'reports') {
      Reports.load();
    } else if (viewName === 'admin') {
      Admin.load();
    }

    this.updateMobileBottomNav(viewName);

    // Close mobile drawer on navigation
    this.closeMobileSidebar();
  },

  updateMobileBottomNav(viewName) {
    const map = {
      'dashboard': 'mobile-btn-dashboard',
      'calling': 'mobile-btn-calling',
      'services': 'mobile-btn-services'
    };
    const activeBtnId = map[viewName];
    ['mobile-btn-dashboard', 'mobile-btn-calling', 'mobile-btn-services', 'mobile-btn-more'].forEach(id => {
      const b = document.getElementById(id);
      if (!b) return;
      if (id === activeBtnId) {
        b.classList.remove('text-slate-400');
        b.classList.add('text-brand-400', 'font-bold');
      } else {
        b.classList.remove('text-brand-400', 'font-bold');
        b.classList.add('text-slate-400');
      }
    });
  },

  toggleMobileMoreSheet() {
    const sheet = document.getElementById('mobile-more-sheet');
    if (!sheet) return;
    const isHidden = sheet.classList.contains('hidden');
    if (isHidden) {
      sheet.classList.remove('hidden');
      if (window.lucide) lucide.createIcons();
    } else {
      sheet.classList.add('hidden');
    }
  },

  openServicesPicker() {
    const sheet = document.getElementById('services-picker-sheet');
    if (!sheet) return;
    this.populateServicesPickerList();
    sheet.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
  },

  closeServicesPicker() {
    const sheet = document.getElementById('services-picker-sheet');
    if (sheet) sheet.classList.add('hidden');
  },

  populateServicesPickerList(services) {
    const list = document.getElementById('services-picker-list');
    if (!list) return;
    const servs = services || Config.DEFAULT_SERVICES;
    const current = (window.Services && Services.currentService) || servs[0];

    list.innerHTML = servs.map(s => {
      const meta = (Config.SERVICE_META && Config.SERVICE_META[s]) || {
        title: s,
        icon: 'layers',
        badge: 'Fintech Service',
        desc: `Dedicated live monitoring & transactions for ${s}`
      };
      const isActive = (s === current);
      return `
        <div onclick="Services.openService('${s}'); App.closeServicesPicker(); App.updateMobileBottomNav('services');"
          class="service-picker-card p-3.5 rounded-2xl cursor-pointer transition-all border ${
            isActive 
              ? 'bg-brand-500/15 border-brand-500/50 shadow-md ring-1 ring-brand-500/30' 
              : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700/60 hover:border-slate-600'
          } group flex items-start gap-3">
          <div class="w-10 h-10 rounded-xl ${
            isActive ? 'bg-brand-500 text-white' : 'bg-slate-900 border border-slate-700/60 text-brand-400 group-hover:text-brand-300'
          } flex items-center justify-center shrink-0">
            <i data-lucide="${meta.icon}" class="w-5 h-5"></i>
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between gap-1">
              <h4 class="text-xs font-bold text-white group-hover:text-brand-300 transition truncate">${meta.title}</h4>
              <span class="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full ${
                isActive ? 'bg-brand-400/20 text-brand-300 border border-brand-400/30' : 'bg-slate-700/60 text-slate-300'
              }">${meta.badge}</span>
            </div>
            <p class="text-[11px] text-slate-400 line-clamp-2 mt-0.5 leading-snug">${meta.desc}</p>
          </div>
          <div class="shrink-0 self-center">
            <i data-lucide="chevron-right" class="w-4 h-4 ${isActive ? 'text-brand-400' : 'text-slate-500 group-hover:text-slate-300'}"></i>
          </div>
        </div>
      `;
    }).join('');

    if (window.lucide) lucide.createIcons();
  },

  switchView(viewName) {
    this.currentView = viewName;

    // View containers
    ['dashboard', 'services', 'calling', 'reports', 'admin'].forEach(v => {
      const el = document.getElementById(`view-${v}`);
      if (v === viewName) {
        el?.classList.remove('hidden');
      } else {
        el?.classList.add('hidden');
      }
    });

    // Update screen badge
    const badge = document.getElementById('current-screen-badge');
    if (badge) {
      badge.textContent = viewName.charAt(0).toUpperCase() + viewName.slice(1);
    }

    // Update Sidebar active link
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.remove('active');
    });
    const activeLink = document.getElementById(`nav-${viewName}`);
    if (activeLink) {
      activeLink.classList.add('active');
    }

    if (window.lucide) lucide.createIcons();
  },

  toggleMobileSidebar() {
    const sidebar = document.getElementById('app-sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    sidebar.classList.toggle('-translate-x-full');
    backdrop.classList.toggle('hidden');
  },

  closeMobileSidebar() {
    const sidebar = document.getElementById('app-sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    sidebar.classList.add('-translate-x-full');
    backdrop.classList.add('hidden');
  },

  updateApiStatusIndicator() {
    const pill = document.getElementById('api-status-pill');
    const text = document.getElementById('api-status-text');
    if (!pill || !text) return;

    if (Config.isDemoMode()) {
      pill.className = 'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 cursor-pointer';
      text.textContent = 'Demo Mode (Click to connect live API)';
    } else {
      pill.className = 'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 cursor-pointer';
      text.textContent = 'Live Sheets API';
    }
  },

  showApiConfigModal() {
    const modal = document.getElementById('api-config-modal');
    modal.classList.remove('hidden');
    document.getElementById('modal-api-url').value = Config.getApiUrl();
  },

  hideApiConfigModal() {
    document.getElementById('api-config-modal').classList.add('hidden');
  },

  saveApiUrlFromModal() {
    const url = document.getElementById('modal-api-url').value.trim();
    if (url) {
      Config.setApiUrl(url);
      Swal.fire('Saved', 'Google Apps Script Web App URL updated successfully!', 'success');
    }
    this.hideApiConfigModal();
    this.updateApiStatusIndicator();
    this.navigate(this.currentView);
  },

  saveApiUrlFromAdmin() {
    const url = document.getElementById('admin-api-url-input').value.trim();
    if (url) {
      Config.setApiUrl(url);
      Swal.fire('Connected', 'API URL saved! Backend connection is active.', 'success');
    }
    this.updateApiStatusIndicator();
  },

  useDemoMode() {
    Config.setDemoMode(true);
    this.hideApiConfigModal();
    this.updateApiStatusIndicator();
    Swal.fire('Demo Mode Active', 'Operating on fast local storage dataset with sample Zapurse transactions.', 'info');
    this.navigate(this.currentView);
  },

  async testApiConnection() {
    const url = document.getElementById('modal-api-url')?.value || Config.getApiUrl();
    if (!url) {
      Swal.fire('Missing URL', 'Please enter a valid Google Apps Script Web App URL first.', 'warning');
      return;
    }

    Swal.fire({
      title: 'Testing Connection...',
      text: 'Pinging Google Apps Script Web App',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    try {
      const res = await fetch(`${url}?action=ping`);
      const data = await res.json();
      if (data.status === 'ONLINE') {
        Swal.fire({
          icon: 'success',
          title: 'Connection Successful!',
          text: `Connected to: ${data.app}`
        });
      } else {
        Swal.fire('Warning', 'Received response but status not ONLINE', 'warning');
      }
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Connection Failed',
        text: 'Could not connect: ' + err.message + '. Make sure Web App deployment has "Who has access: Anyone".'
      });
    }
  },

  async triggerManualSync() {
    const { value: syncChoice } = await Swal.fire({
      title: '🔄 Sync Zapurse Core API',
      text: 'Fetch live MIS Report CSV directly from Zapurse fintech servers for all 6 services (ZAPAEPS, ZAPUPI, ZAPRECHARGE, RISLUPI, RISLDMT, RISLRECHARGE):',
      icon: 'info',
      showCancelButton: true,
      confirmButtonText: '⚡ Quick Sync (New Data)',
      showDenyButton: true,
      denyButtonText: '🧹 Clean & Resync (Fix Dates)',
      confirmButtonColor: '#0284c7',
      denyButtonColor: '#10b981',
      cancelButtonText: 'Cancel'
    });

    if (syncChoice === false) return; // Cancelled

    let isClean = false;
    let fromDate = '';
    let toDate = '';

    const now = new Date();
    const toStr = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;
    const past30 = new Date();
    past30.setDate(now.getDate() - 30);
    const fromStr = `${String(past30.getDate()).padStart(2, '0')}-${String(past30.getMonth() + 1).padStart(2, '0')}-${past30.getFullYear()}`;

    if (syncChoice === true) {
      // Quick Sync (Incremental / Last 30 Days)
      fromDate = fromStr;
      toDate = toStr;
      isClean = false;
    } else if (syncChoice === undefined) {
      // User clicked 'Clean & Resync (Fix Dates)' (Deny button)
      const confirmClean = await Swal.fire({
        title: '🧹 Clean & Resync Database?',
        text: 'This will wipe old duplicate sales records and re-sync fresh MIS data with exact transaction dates. (Calling Logs and Users will be safe). Proceed?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Yes, Clean & Resync',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#ef4444'
      });
      if (!confirmClean.isConfirmed) return;
      fromDate = fromStr;
      toDate = toStr;
      isClean = true;
    }

    const icon = document.getElementById('sync-icon');
    if (icon) icon.classList.add('animate-spin');

    Swal.fire({
      title: isClean ? '🧹 Clean Resyncing...' : '🔄 Connecting to Zapurse MIS API...',
      text: 'Fetching and processing CSV reports across all services...',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    try {
      const res = await Api.get('syncExternalSalesAPI', { 
        fromDate: fromDate, 
        toDate: toDate, 
        clean: isClean ? 'true' : 'false' 
      });
      
      Swal.fire({
        icon: res.success ? 'success' : 'warning',
        title: isClean ? 'Clean Resync Completed!' : 'API Sync Completed!',
        html: `
          <div class="text-xs text-left space-y-1">
            <p><strong>Status:</strong> ${res.success ? 'Success' : 'Error'}</p>
            <p><strong>Processed Rows:</strong> ${res.totalRowsProcessed || 0}</p>
            <p><strong>Clean Records Added:</strong> ${res.recordsAdded || 0}</p>
            <p><strong>Active Clients:</strong> ${res.clientsCount || 0}</p>
            <p class="text-emerald-400 font-semibold mt-2">✓ Yesterday Sales & Analytics Updated!</p>
          </div>
        `
      });
      if (window.Api && typeof Api.clearCache === 'function') {
        Api.clearCache();
      }
      this.navigate(this.currentView);
    } catch (err) {
      Swal.fire('Sync Error', err.message, 'error');
    } finally {
      if (icon) icon.classList.remove('animate-spin');
    }
  }
};

// Start application when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  App.init();
});
