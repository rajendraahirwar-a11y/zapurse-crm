/**
 * ==============================================================================
 * ZAPURSE FINTECH CRM - AUTHENTICATION & ROLE MANAGEMENT
 * ==============================================================================
 */

const Auth = {
  currentUser: null,

  init() {
    const saved = localStorage.getItem(Config.STORAGE_KEY_USER) || sessionStorage.getItem(Config.STORAGE_KEY_USER);
    if (saved) {
      try {
        this.currentUser = JSON.parse(saved);
        this.showApp();
      } catch (e) {
        this.showLogin();
      }
    } else {
      this.showLogin();
    }
  },

  getCurrentUser() {
    return this.currentUser;
  },

  isLoggedIn() {
    return !!this.currentUser;
  },

  isAdmin() {
    return this.currentUser && this.currentUser.role === 'Admin';
  },

  isManager() {
    return this.currentUser && (this.currentUser.role === 'Admin' || this.currentUser.role === 'Manager');
  },

  hasServiceAccess(serviceName) {
    if (!this.currentUser) return false;
    if (this.currentUser.role === 'Admin') return true;
    if (this.currentUser.allowedServices.includes('ALL')) return true;
    return this.currentUser.allowedServices.includes(serviceName);
  },

  fillDemo(u, p) {
    document.getElementById('login-username').value = u;
    document.getElementById('login-password').value = p;
  },

  async handleLogin() {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value.trim();
    const remember = document.getElementById('login-remember').checked;
    const btn = document.getElementById('login-btn');

    if (!username || !password) {
      Swal.fire({
        icon: 'warning',
        title: 'Missing Fields',
        text: 'Please enter both username and password.'
      });
      return;
    }

    btn.disabled = true;
    btn.innerHTML = `<span>Signing In...</span> <i data-lucide="loader" class="w-4 h-4 animate-spin"></i>`;
    if (window.lucide) lucide.createIcons();

    try {
      const res = await Api.post('login', { username, password });

      if (res.success && res.user) {
        this.currentUser = res.user;
        const storage = remember ? localStorage : sessionStorage;
        storage.setItem(Config.STORAGE_KEY_USER, JSON.stringify(res.user));

        Swal.fire({
          icon: 'success',
          title: `Welcome, ${res.user.name}!`,
          text: `Logged in as ${res.user.role}`,
          timer: 1500,
          showConfirmButton: false
        });

        this.showApp();
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Login Failed',
          text: res.message || 'Invalid username or password'
        });
      }
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Failed to connect: ' + err.message
      });
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<span>Sign In to CRM</span> <i data-lucide="arrow-right" class="w-4 h-4"></i>`;
      if (window.lucide) lucide.createIcons();
    }
  },

  logout() {
    Swal.fire({
      title: 'Sign Out?',
      text: 'Are you sure you want to end your current CRM session?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#0284c7',
      cancelButtonColor: '#334155',
      confirmButtonText: 'Yes, Sign Out'
    }).then((result) => {
      if (result.isConfirmed) {
        this.currentUser = null;
        localStorage.removeItem(Config.STORAGE_KEY_USER);
        sessionStorage.removeItem(Config.STORAGE_KEY_USER);
        this.showLogin();
      }
    });
  },

  showLogin() {
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('app-container').classList.add('hidden');
    if (window.lucide) lucide.createIcons();
  },

  showApp() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app-container').classList.remove('hidden');

    // Update Header Profile Info
    document.getElementById('user-display-name').textContent = this.currentUser.name;
    document.getElementById('user-role-badge').textContent = this.currentUser.role;
    document.getElementById('user-avatar-initials').textContent = (this.currentUser.name || 'U').charAt(0).toUpperCase();

    // Toggle Admin Panel Link
    const adminNavLink = document.getElementById('nav-admin');
    if (adminNavLink) {
      if (this.isAdmin()) {
        adminNavLink.classList.remove('hidden');
      } else {
        adminNavLink.classList.add('hidden');
      }
    }
    const mobileMoreAdmin = document.getElementById('mobile-more-admin-link');
    if (mobileMoreAdmin) {
      if (this.isAdmin()) {
        mobileMoreAdmin.classList.remove('hidden');
      } else {
        mobileMoreAdmin.classList.add('hidden');
      }
    }

    // Initialize App & Modules
    App.onUserLoggedIn();
    if (window.lucide) lucide.createIcons();
  }
};
