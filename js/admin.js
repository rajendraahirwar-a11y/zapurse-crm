/**
 * ==============================================================================
 * ZAPURSE FINTECH CRM - ADMIN CONTROL PANEL CONTROLLER
 * ==============================================================================
 */

const Admin = {
  currentTab: 'users',
  configState: null,
  usersList: [],

  async load() {
    if (!Auth.isAdmin()) {
      Swal.fire('Access Denied', 'Only Admins can access this panel.', 'warning');
      App.navigate('dashboard');
      return;
    }

    try {
      const data = await Api.get('getAdminConfig');
      this.configState = data.config || {};
      this.usersList = data.users || [];

      // Sub-tab 1: Users
      this.renderUsers(this.usersList);

      // Sub-tab 2: Dynamic Questions
      this.renderQuestions(this.configState.dynamicQuestions || Config.DEFAULT_QUESTIONS);

      // Sub-tab 3: System Settings
      document.getElementById('setting-max-followup').value = this.configState.maxFollowupLimit || 5;
      document.getElementById('setting-min-sales').value = this.configState.yearlyMinSalesCondition || 50000;
      document.getElementById('setting-services-list').value = (this.configState.services || Config.DEFAULT_SERVICES).join(', ');

      // Sub-tab 4: Connection
      document.getElementById('admin-api-url-input').value = Config.getApiUrl();

    } catch (err) {
      console.error('Failed to load admin config:', err);
    }
  },

  switchTab(tab) {
    this.currentTab = tab;
    ['users', 'questions', 'settings', 'connection'].forEach(t => {
      const content = document.getElementById(`admin-subtab-${t}`);
      const btn = document.getElementById(`admin-tab-${t}-btn`);
      if (t === tab) {
        content?.classList.remove('hidden');
        btn?.classList.add('bg-brand-600', 'text-white');
        btn?.classList.remove('bg-slate-800', 'text-slate-400');
      } else {
        content?.classList.add('hidden');
        btn?.classList.remove('bg-brand-600', 'text-white');
        btn?.classList.add('bg-slate-800', 'text-slate-400');
      }
    });
  },

  renderUsers(users) {
    const tbody = document.getElementById('admin-users-tbody');
    if (!tbody) return;

    if (!users || users.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-slate-500">No users found.</td></tr>`;
      return;
    }

    tbody.innerHTML = users.map(u => `
      <tr class="hover:bg-slate-800/40 transition">
        <td class="py-3 px-3.5 font-mono text-brand-400 font-semibold">${u.userId}</td>
        <td class="py-3 px-3.5 font-bold text-white">${u.name}</td>
        <td class="py-3 px-3.5 text-slate-400">${u.username}</td>
        <td class="py-3 px-3.5">
          <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${u.role === 'Admin' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-brand-500/10 text-brand-400 border border-brand-500/20'}">
            ${u.role}
          </span>
        </td>
        <td class="py-3 px-3.5 text-slate-300">
          ${(u.allowedServices || []).join(', ')}
        </td>
        <td class="py-3 px-3.5">
          <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${u.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-700 text-slate-400'}">
            ${u.status}
          </span>
        </td>
        <td class="py-3 px-3.5 text-center">
          <button onclick="Admin.toggleUserStatus('${u.userId}')" class="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold border border-slate-700 transition">
            ${u.status === 'Active' ? 'Disable' : 'Enable'}
          </button>
        </td>
      </tr>
    `).join('');
  },

  async showCreateUserModal() {
    const { value: formValues } = await Swal.fire({
      title: 'Add New CRM User',
      html: `
        <div class="space-y-3 text-left text-xs">
          <div>
            <label class="block font-semibold mb-1">Full Name</label>
            <input id="swal-user-name" class="swal2-input !m-0 !w-full !text-xs !h-9" placeholder="e.g. Suresh Meena">
          </div>
          <div>
            <label class="block font-semibold mb-1">Username</label>
            <input id="swal-user-uname" class="swal2-input !m-0 !w-full !text-xs !h-9" placeholder="e.g. suresh">
          </div>
          <div>
            <label class="block font-semibold mb-1">Password</label>
            <input id="swal-user-pass" type="password" class="swal2-input !m-0 !w-full !text-xs !h-9" placeholder="••••••">
          </div>
          <div>
            <label class="block font-semibold mb-1">Role</label>
            <select id="swal-user-role" class="swal2-select !m-0 !w-full !text-xs !h-9">
              <option value="Caller">Caller</option>
              <option value="Manager">Manager</option>
              <option value="Admin">Admin</option>
            </select>
          </div>
          <div>
            <label class="block font-semibold mb-1">Allowed Services (Comma separated or ALL)</label>
            <input id="swal-user-services" class="swal2-input !m-0 !w-full !text-xs !h-9" value="ALL" placeholder="ALL or ZAP AEPS, ZAPUPI">
          </div>
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Create User',
      preConfirm: () => {
        return {
          name: document.getElementById('swal-user-name').value.trim(),
          username: document.getElementById('swal-user-uname').value.trim(),
          password: document.getElementById('swal-user-pass').value.trim(),
          role: document.getElementById('swal-user-role').value,
          allowedServices: document.getElementById('swal-user-services').value.split(',').map(s => s.trim())
        };
      }
    });

    if (formValues && formValues.username) {
      const res = await Api.post('manageUser', {
        operation: 'create',
        ...formValues
      });
      if (res.success) {
        Swal.fire('Success', res.message, 'success');
        this.load();
      } else {
        Swal.fire('Error', res.message, 'error');
      }
    }
  },

  async toggleUserStatus(userId) {
    const res = await Api.post('manageUser', {
      operation: 'toggleStatus',
      userId: userId
    });
    if (res.success) {
      this.load();
    }
  },

  renderQuestions(questions) {
    const container = document.getElementById('dynamic-questions-list');
    if (!container) return;

    container.innerHTML = questions.map((q, idx) => `
      <div class="p-3 bg-slate-950/80 border border-slate-800 rounded-xl flex items-center justify-between gap-3" data-idx="${idx}">
        <div class="flex-1 space-y-1">
          <div class="flex items-center gap-2">
            <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-slate-400">${q.id}</span>
            <input type="text" value="${q.text}" onchange="Admin.updateQuestionText(${idx}, this.value)"
              class="flex-1 px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs font-semibold">
          </div>
          <div class="flex items-center gap-2 text-[11px] text-slate-400">
            <span>Type: <strong class="text-brand-400">${q.type}</strong></span>
            ${q.options ? `<span>• Options: ${q.options.join(', ')}</span>` : ''}
          </div>
        </div>
        <button onclick="Admin.removeQuestion(${idx})" class="p-2 text-slate-500 hover:text-rose-400 rounded-lg transition" title="Delete Question">
          <i data-lucide="trash-2" class="w-4 h-4"></i>
        </button>
      </div>
    `).join('');

    if (window.lucide) lucide.createIcons();
  },

  updateQuestionText(idx, val) {
    if (this.configState.dynamicQuestions[idx]) {
      this.configState.dynamicQuestions[idx].text = val;
    }
  },

  removeQuestion(idx) {
    this.configState.dynamicQuestions.splice(idx, 1);
    this.renderQuestions(this.configState.dynamicQuestions);
  },

  async addNewQuestionPrompt() {
    const { value: qText } = await Swal.fire({
      title: 'New Dynamic Question',
      input: 'text',
      inputLabel: 'Question Title / Prompt',
      placeholder: 'e.g. Current Portal Commission Rate...',
      showCancelButton: true
    });

    if (qText) {
      const newId = 'q' + (this.configState.dynamicQuestions.length + 1);
      this.configState.dynamicQuestions.push({
        id: newId,
        text: qText,
        type: 'select',
        options: ['Yes', 'No', 'Partial', 'Not Disclosed']
      });
      this.renderQuestions(this.configState.dynamicQuestions);
    }
  },

  async saveDynamicQuestions() {
    const res = await Api.post('saveAdminConfig', {
      dynamicQuestions: this.configState.dynamicQuestions
    });
    if (res.success) {
      Swal.fire('Saved', 'Dynamic questions saved successfully!', 'success');
      Calling.cachedQuestions = []; // invalidate cache
    }
  },

  async saveSystemSettings() {
    const maxFollowup = document.getElementById('setting-max-followup').value;
    const minSales = document.getElementById('setting-min-sales').value;
    const servicesStr = document.getElementById('setting-services-list').value;
    const services = servicesStr.split(',').map(s => s.trim()).filter(Boolean);

    const res = await Api.post('saveAdminConfig', {
      maxFollowupLimit: maxFollowup,
      yearlyMinSalesCondition: minSales,
      services: services
    });

    if (res.success) {
      Swal.fire('Success', 'Business rules and services catalog updated!', 'success');
      App.populateDynamicServicesNav(services);
    }
  }
};
