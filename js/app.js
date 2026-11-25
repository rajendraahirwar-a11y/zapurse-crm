/**
 * ==============================================================================
 * ZAPURSE FINTECH CRM - MASTER APPLICATION CONTROLLER
 * ==============================================================================
 */

const App = {
  currentView: 'dashboard',

  init() {
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

    if (window.lucide) lucide.createIcons();
  },

  navigate(viewName) {
    if (viewName.startsWith('service-')) {
      const serviceName = decodeURIComponent(viewName.replace('service-', ''));
      Services.openService(serviceName);
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

    // Close mobile drawer on navigation
    this.closeMobileSidebar();
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
    const icon = document.getElementById('sync-icon');
    if (icon) icon.classList.add('animate-spin');

    try {
      const res = await Api.get('syncExternalSalesAPI');
      Swal.fire({
        icon: 'success',
        title: 'Synced!',
        text: res.message || 'Data synchronized with Google Sheets.',
        timer: 1500,
        showConfirmButton: false
      });
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
