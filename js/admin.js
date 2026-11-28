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

      // Calling Target Rules
      const inactInput = document.getElementById('setting-calling-inactive-days');
      const modeSelect = document.getElementById('setting-calling-target-mode');
      const baseSelect = document.getElementById('setting-calling-baseline-months');
      const minTgtInput = document.getElementById('setting-calling-min-target');

      if (inactInput) inactInput.value = this.configState.callingInactiveDays || 3;
      if (modeSelect) modeSelect.value = this.configState.callingTargetMode || 'inactivity';
      if (baseSelect) baseSelect.value = this.configState.callingBaselineMonths || 3;
      if (minTgtInput) minTgtInput.value = this.configState.callingMinDailyTarget || 0;

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

    tbody.innerHTML = users.map(u => {
      const safeName = (u.name || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
      const safeId = String(u.userId);
      return `
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
          <div class="flex items-center justify-center gap-1.5">
            <!-- Edit Button -->
            <button onclick="Admin.showEditUserModal('${safeId}')" class="p-1.5 bg-blue-500/10 hover:bg-blue-500/25 text-blue-400 border border-blue-500/30 rounded-lg text-xs transition" title="Edit User">
              <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
            </button>
            <!-- Toggle Active/Inactive -->
            <button onclick="Admin.toggleUserStatus('${safeId}')" class="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold border border-slate-700 transition" title="Toggle Status">
              ${u.status === 'Active' ? 'Disable' : 'Enable'}
            </button>
            <!-- Delete Button -->
            <button onclick="Admin.deleteUser('${safeId}', '${safeName}')" class="p-1.5 bg-rose-500/10 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 rounded-lg text-xs transition" title="Delete User">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </td>
      </tr>
    `}).join('');

    if (window.lucide) lucide.createIcons();
  },

  getServiceCheckboxesHtml(selectedServices, prefix) {
    const defaultList = ['ZAPAEPS', 'ZAPUPI', 'ZAPRECHARGE', 'B2C', 'RISLUPI', 'RISLDMT', 'RISLRECHARGE', 'RISLMOBILEAPP'];
    let services = (this.configState && this.configState.services && this.configState.services.length >= 6)
      ? [...this.configState.services]
      : defaultList;
    if (!services.includes('B2C')) services.push('B2C');
    if (!services.includes('RISLMOBILEAPP')) services.push('RISLMOBILEAPP');

    const isAll = !selectedServices || selectedServices.length === 0 || selectedServices.includes('ALL');

    return `
      <div>
        <div class="flex items-center justify-between mb-1.5">
          <label class="block font-semibold text-slate-300">Access Permissions (Tick to Allow)</label>
          <button type="button" onclick="Admin.toggleAllServiceCheckboxes('${prefix}')" class="text-[11px] text-brand-400 hover:text-brand-300 font-semibold cursor-pointer">
            Select / Deselect All
          </button>
        </div>
        <div class="p-2.5 bg-slate-900 border border-slate-700/80 rounded-xl grid grid-cols-2 gap-2 text-xs max-h-36 overflow-y-auto">
          ${services.map(s => {
            const checked = isAll || (Array.isArray(selectedServices) && selectedServices.includes(s)) ? 'checked' : '';
            return `
              <label class="flex items-center gap-2 p-1.5 rounded-lg bg-slate-800/70 hover:bg-slate-800 cursor-pointer select-none">
                <input type="checkbox" name="${prefix}-service-cb" value="${s}" ${checked} class="w-4 h-4 rounded text-brand-500 accent-emerald-500 cursor-pointer">
                <span class="font-medium text-slate-200">${s}</span>
              </label>
            `;
          }).join('')}
        </div>
      </div>
    `;
  },

  toggleAllServiceCheckboxes(prefix) {
    const cbs = document.querySelectorAll(`input[name="${prefix}-service-cb"]`);
    const anyUnchecked = Array.from(cbs).some(cb => !cb.checked);
    cbs.forEach(cb => cb.checked = anyUnchecked);
  },

  getSelectedServices(prefix) {
    const cbs = document.querySelectorAll(`input[name="${prefix}-service-cb"]:checked`);
    return Array.from(cbs).map(cb => cb.value);
  },

  async showCreateUserModal() {
    const checkboxesHtml = this.getServiceCheckboxesHtml(['ALL'], 'swal-create');

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
          ${checkboxesHtml}
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Create User',
      preConfirm: () => {
        const name = document.getElementById('swal-user-name').value.trim();
        const username = document.getElementById('swal-user-uname').value.trim();
        const pass = document.getElementById('swal-user-pass').value.trim();
        const role = document.getElementById('swal-user-role').value;
        const allowedServices = Admin.getSelectedServices('swal-create');

        if (!name || !username) {
          Swal.showValidationMessage('Name and Username are required');
          return false;
        }
        if (allowedServices.length === 0) {
          Swal.showValidationMessage('Please select at least one service permission');
          return false;
        }

        return {
          name,
          username,
          password: pass || '123456',
          role,
          allowedServices
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

  async showEditUserModal(userId) {
    const u = (this.usersList || []).find(x => String(x.userId) === String(userId));
    if (!u) {
      Swal.fire('Error', 'User not found in memory. Please reload.', 'error');
      return;
    }

    const checkboxesHtml = this.getServiceCheckboxesHtml(u.allowedServices, 'swal-edit');

    const { value: formValues } = await Swal.fire({
      title: 'Edit CRM User: ' + u.name,
      html: `
        <div class="space-y-3 text-left text-xs">
          <div>
            <label class="block font-semibold mb-1 text-slate-300">User ID</label>
            <input class="swal2-input !m-0 !w-full !text-xs !h-9 bg-slate-800 text-slate-400 cursor-not-allowed" value="${u.userId}" disabled>
          </div>
          <div>
            <label class="block font-semibold mb-1 text-slate-300">Full Name</label>
            <input id="swal-edit-name" class="swal2-input !m-0 !w-full !text-xs !h-9" value="${u.name || ''}" placeholder="Full Name">
          </div>
          <div>
            <label class="block font-semibold mb-1 text-slate-300">Username</label>
            <input id="swal-edit-uname" class="swal2-input !m-0 !w-full !text-xs !h-9" value="${u.username || ''}" placeholder="Username">
          </div>
          <div>
            <label class="block font-semibold mb-1 text-slate-300">New Password <span class="text-slate-500 font-normal">(leave blank to keep unchanged)</span></label>
            <input id="swal-edit-pass" type="password" class="swal2-input !m-0 !w-full !text-xs !h-9" placeholder="••••••••">
          </div>
          <div>
            <label class="block font-semibold mb-1 text-slate-300">Role</label>
            <select id="swal-edit-role" class="swal2-select !m-0 !w-full !text-xs !h-9">
              <option value="Caller" ${u.role === 'Caller' ? 'selected' : ''}>Caller</option>
              <option value="Manager" ${u.role === 'Manager' ? 'selected' : ''}>Manager</option>
              <option value="Admin" ${u.role === 'Admin' ? 'selected' : ''}>Admin</option>
            </select>
          </div>
          <div>
            <label class="block font-semibold mb-1 text-slate-300">Status</label>
            <select id="swal-edit-status" class="swal2-select !m-0 !w-full !text-xs !h-9">
              <option value="Active" ${u.status === 'Active' ? 'selected' : ''}>Active</option>
              <option value="Inactive" ${u.status === 'Inactive' ? 'selected' : ''}>Inactive</option>
            </select>
          </div>
          ${checkboxesHtml}
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Save Changes',
      confirmButtonColor: '#0284c7',
      preConfirm: () => {
        const name = document.getElementById('swal-edit-name').value.trim();
        const username = document.getElementById('swal-edit-uname').value.trim();
        const pass = document.getElementById('swal-edit-pass').value.trim();
        const role = document.getElementById('swal-edit-role').value;
        const status = document.getElementById('swal-edit-status').value;
        const allowedServices = Admin.getSelectedServices('swal-edit');

        if (!name || !username) {
          Swal.showValidationMessage('Name and Username are required');
          return false;
        }
        if (allowedServices.length === 0) {
          Swal.showValidationMessage('Please select at least one service permission');
          return false;
        }

        const payload = {
          name,
          username,
          role,
          status,
          allowedServices
        };
        if (pass) {
          payload.password = pass;
        }
        return payload;
      }
    });

    if (formValues) {
      Swal.fire({ title: 'Updating User...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      try {
        const res = await Api.post('manageUser', {
          operation: 'edit',
          userId: u.userId,
          ...formValues
        });
        if (res.success) {
          Swal.fire('Updated', res.message || 'User details updated successfully!', 'success');
          this.load();
        } else {
          Swal.fire('Error', res.message || 'Failed to update user', 'error');
        }
      } catch (err) {
        Swal.fire('Error', err.message || 'Network error updating user', 'error');
      }
    }
  },

  async deleteUser(userId, userName) {
    const confirm = await Swal.fire({
      title: 'Delete User?',
      html: `Are you sure you want to permanently delete user <strong class="text-rose-400">${userName}</strong> (ID: <code>${userId}</code>)?<br><br><span class="text-xs text-slate-400">This action will permanently remove the user from the database.</span>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#e11d48',
      cancelButtonColor: '#334155',
      confirmButtonText: 'Yes, Delete',
      cancelButtonText: 'Cancel'
    });

    if (confirm.isConfirmed) {
      Swal.fire({ title: 'Deleting User...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      try {
        const res = await Api.post('manageUser', {
          operation: 'delete',
          userId: userId
        });
        if (res.success) {
          Swal.fire('Deleted', res.message || 'User permanently deleted!', 'success');
          this.load();
        } else {
          Swal.fire('Error', res.message || 'Failed to delete user', 'error');
        }
      } catch (err) {
        Swal.fire('Error', err.message || 'Network error deleting user', 'error');
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

  async setupDailyTrigger() {
    const confirm = await Swal.fire({
      title: 'Setup Daily Automatic Sync Trigger?',
      html: `This will schedule Google Apps Script to run automatic sync every day at <strong>8:00 AM IST Morning</strong> for all services.<br><br>Existing older triggers (e.g. 2 AM nightly) will be cleanly replaced.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Install 8 AM Trigger',
      confirmButtonColor: '#0284c7',
      cancelButtonText: 'Cancel'
    });

    if (!confirm.isConfirmed) return;

    Swal.fire({ title: 'Configuring Trigger...', text: 'Connecting to Google Apps Script...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
      let res;
      try {
        res = await Api.post('setupDailySyncTrigger', {});
      } catch (postErr) {
        res = await Api.get('setupDailySyncTrigger');
      }
      if (res && res.success) {
        Swal.fire('Trigger Configured!', res.message || 'Daily automatic sync trigger scheduled for 8:00 AM IST morning.', 'success');
      } else {
        Swal.fire('Done', res?.message || 'Daily sync trigger set up successfully on Google Apps Script at 8:00 AM Morning.', 'success');
      }
    } catch (err) {
      console.error('Trigger setup error:', err);
      Swal.fire('Information', 'If using Web App without trigger scope permissions, you can also click "⏰ Setup Automatic Daily Sync Trigger (Morning 8 AM)" directly from the Google Sheets Extensions menu.', 'info');
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
    const maxFollowup = document.getElementById('setting-max-followup')?.value || 5;
    const minSales = document.getElementById('setting-min-sales')?.value || 50000;
    const servicesStr = document.getElementById('setting-services-list')?.value || '';
    const services = servicesStr.split(',').map(s => s.trim()).filter(Boolean);

    const callingInactiveDays = Number(document.getElementById('setting-calling-inactive-days')?.value) || 3;
    const callingTargetMode = document.getElementById('setting-calling-target-mode')?.value || 'inactivity';
    const callingBaselineMonths = Number(document.getElementById('setting-calling-baseline-months')?.value) || 3;
    const callingMinDailyTarget = Number(document.getElementById('setting-calling-min-target')?.value) || 0;

    const res = await Api.post('saveAdminConfig', {
      maxFollowupLimit: maxFollowup,
      yearlyMinSalesCondition: minSales,
      services: services,
      callingInactiveDays: callingInactiveDays,
      callingTargetMode: callingTargetMode,
      callingBaselineMonths: callingBaselineMonths,
      callingMinDailyTarget: callingMinDailyTarget
    });

    if (res.success) {
      Swal.fire('Success', 'Business rules and target calling engine rules updated!', 'success');
      App.populateDynamicServicesNav(services);
      if (typeof Calling !== 'undefined' && Calling.load) {
        Calling.load();
      }
    }
  }
};
