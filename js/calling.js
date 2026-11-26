/**
 * ==============================================================================
 * ZAPURSE FINTECH CRM - SMART CALLING ENGINE (v16 Tabs, WhatsApp & Pitch Tool)
 * ==============================================================================
 */

const Calling = {
  currentInactiveDays: '15',
  currentClientList: [],
  activeCallingClient: null,
  cachedQuestions: [],
  currentTab: 'today', // 'today', 'pending', 'completed', 'distributors', 'leaderboard'
  cachedCallsLogs: [],
  currentStats: { totalQueue: 0, todayCompleted: 0, pendingUncalled: 0, followupsDue: 0 },
  activePitchClient: null,
  activeWhatsAppClient: null,
  mediaRecorder: null,
  audioChunks: [],
  recordedBlob: null,
  isRecording: false,
  recInterval: null,
  recSeconds: 0,

  async load() {
    this.populateServiceDropdown();
    const includeToday = document.getElementById('calling-include-today-toggle')?.checked ? 'true' : 'false';
    const service = document.getElementById('calling-filter-service')?.value || 'ALL';
    const search = document.getElementById('calling-filter-search')?.value || '';

    const tbody = document.getElementById('calling-queue-tbody');
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="9" class="text-center py-8 text-slate-500"><i data-lucide="loader-2" class="w-5 h-5 animate-spin inline mr-2 text-brand-400"></i>Loading calling queue & metrics...</td></tr>`;
      if (window.lucide) lucide.createIcons();
    }

    try {
      const todayStr = new Date().toISOString().substring(0, 10);
      const [resClients, resLogs] = await Promise.all([
        Api.get('getClients', { includeToday, service, search }),
        Api.get('getCallingLogs', { date: todayStr }).catch(() => ({ calls: [] }))
      ]);

      // Update active rule display chip
      const ruleTextElem = document.getElementById('calling-active-rule-text');
      if (ruleTextElem && resClients.activeRule?.ruleText) {
        ruleTextElem.textContent = 'Rule: ' + resClients.activeRule.ruleText;
      }

      this.cachedCallsLogs = resLogs.calls || [];
      const rawClients = resClients.clients || [];
      this.currentClientList = rawClients.filter(c => !Config.isPaymentGatewayUser(c.clientName, c.mobile));

      // Calculate stats
      const totalQueue = this.currentClientList.length;
      const todayCompleted = this.currentClientList.filter(c => c.isCalledToday).length || this.cachedCallsLogs.length;
      const pendingUncalled = this.currentClientList.filter(c => !c.isCalledToday).length;
      const followupsDue = this.currentClientList.filter(c => c.nextFollowup && c.nextFollowup <= todayStr && !c.isCalledToday).length;

      this.currentStats = { totalQueue, todayCompleted, pendingUncalled, followupsDue };

      // Update Top KPI Cards
      const kpiTotal = document.getElementById('kpi-target-queue');
      const kpiDone = document.getElementById('kpi-today-done');
      const kpiPending = document.getElementById('kpi-pending-calls');
      const kpiDue = document.getElementById('kpi-followups-due');
      if (kpiTotal) kpiTotal.textContent = totalQueue;
      if (kpiDone) kpiDone.textContent = todayCompleted;
      if (kpiPending) kpiPending.textContent = pendingUncalled;
      if (kpiDue) kpiDue.textContent = followupsDue;

      // Update Sub-Tab Badges
      const bToday = document.getElementById('tab-badge-today');
      const bPending = document.getElementById('tab-badge-pending');
      const bDone = document.getElementById('tab-badge-completed');
      const bDist = document.getElementById('tab-badge-distributors');
      if (bToday) bToday.textContent = pendingUncalled;
      if (bPending) bPending.textContent = this.getPendingClients().length;
      if (bDone) bDone.textContent = todayCompleted;

      const distMap = this.getDistributorsMap();
      if (bDist) bDist.textContent = Object.keys(distMap).length;

      // Update Sidebar & Mobile Badge counts
      const sidebarBadge = document.getElementById('calling-badge-count');
      if (sidebarBadge) sidebarBadge.textContent = pendingUncalled;
      const mobileBadge = document.getElementById('mobile-calling-badge');
      if (mobileBadge) mobileBadge.textContent = pendingUncalled;

      // Render Active Tab View
      this.renderCurrentView();

    } catch (err) {
      console.error('Failed to load calling queue:', err);
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="9" class="text-center py-8 text-rose-400 font-medium">Failed to load calling queue. Please retry.</td></tr>`;
      }
    }
  },

  populateServiceDropdown(services) {
    const sel = document.getElementById('calling-filter-service');
    if (!sel) return;
    const currentVal = sel.value || 'ALL';
    const sList = services && services.length > 0 ? services : Config.DEFAULT_SERVICES;
    sel.innerHTML = `<option value="ALL">All Services</option>` +
      sList.map(s => `<option value="${s}" ${s === currentVal ? 'selected' : ''}>${s}</option>`).join('');
  },

  handleSearch() {
    clearTimeout(this._searchTimer);
    this._searchTimer = setTimeout(() => {
      this.load();
    }, 300);
  },

  switchTab(tabName) {
    this.currentTab = tabName;
    const tabButtons = ['today', 'pending', 'completed', 'distributors', 'leaderboard'];
    tabButtons.forEach(t => {
      const btn = document.getElementById(`calling-tab-btn-${t}`);
      if (!btn) return;
      if (t === tabName) {
        btn.className = 'calling-subtab active px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap bg-brand-500/15 text-brand-400 border border-brand-500/30';
      } else {
        btn.className = 'calling-subtab px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 border border-transparent transition flex items-center gap-2 whitespace-nowrap';
      }
    });

    const tableContainer = document.getElementById('calling-table-container');
    const leaderboardContainer = document.getElementById('calling-leaderboard-container');

    if (tabName === 'leaderboard') {
      if (tableContainer) tableContainer.classList.add('hidden');
      if (leaderboardContainer) leaderboardContainer.classList.remove('hidden');
      this.renderLeaderboard();
    } else {
      if (tableContainer) tableContainer.classList.remove('hidden');
      if (leaderboardContainer) leaderboardContainer.classList.add('hidden');
      this.renderCurrentView();
    }
  },

  getPendingClients() {
    const todayStr = new Date().toISOString().substring(0, 10);
    return this.currentClientList.filter(c => {
      if (c.isCalledToday) return false;
      const hasFollowup = (c.followupsCount || 0) > 0;
      const isDue = Boolean(c.nextFollowup && c.nextFollowup <= todayStr);
      const isOlder = Boolean(c.lastCallDate && c.lastCallDate < todayStr);
      return hasFollowup || isDue || isOlder;
    });
  },

  getDistributorsMap() {
    const map = {};
    this.currentClientList.forEach(c => {
      if (c.isCalledToday) return; // Only count uncalled
      const parentName = c.parentName && c.parentName !== '-' ? c.parentName : 'Direct Master Merchants';
      const parentMob = c.parentMobile && c.parentMobile !== '-' ? c.parentMobile : '';
      const key = `${parentName}_${parentMob}`;
      if (!map[key]) {
        map[key] = {
          parentName: parentName,
          parentMobile: parentMob,
          retailersCount: 0,
          clients: [],
          totalDroppedVol: 0
        };
      }
      map[key].retailersCount++;
      map[key].clients.push(c);
      map[key].totalDroppedVol += Number(c.shortfall || c.sevenDaySales?.volume || 0);
    });
    return map;
  },

  renderCurrentView() {
    const summary = document.getElementById('calling-queue-summary');
    const heading = document.getElementById('calling-table-heading');

    if (this.currentTab === 'today') {
      if (heading) heading.innerHTML = `<i data-lucide="phone-forwarded" class="w-4 h-4 text-emerald-400"></i><span>Today's Target Calling Queue (Fresh)</span>`;
      const uncalled = this.currentClientList.filter(c => !c.isCalledToday);
      if (summary) summary.textContent = `Showing ${uncalled.length} fresh merchants needing calls today.`;
      this.renderStandardTableHeaders();
      this.renderQueueRows(uncalled, 'today');

    } else if (this.currentTab === 'pending') {
      if (heading) heading.innerHTML = `<i data-lucide="clock-4" class="w-4 h-4 text-rose-400"></i><span>Pending & Rollover Calls Queue</span>`;
      const pending = this.getPendingClients();
      if (summary) summary.textContent = `Showing ${pending.length} pending rollover calls from previous batches/follow-ups.`;
      this.renderStandardTableHeaders();
      this.renderQueueRows(pending, 'pending');

    } else if (this.currentTab === 'completed') {
      if (heading) heading.innerHTML = `<i data-lucide="check-check" class="w-4 h-4 text-emerald-400"></i><span>Calls Completed Today</span>`;
      this.renderCompletedTable();

    } else if (this.currentTab === 'distributors') {
      if (heading) heading.innerHTML = `<i data-lucide="network" class="w-4 h-4 text-sky-400"></i><span>Parent Distributor Downline Retention Summary</span>`;
      this.renderDistributorsTable();
    }
    if (window.lucide) lucide.createIcons();
  },

  renderStandardTableHeaders() {
    const thead = document.getElementById('calling-thead');
    if (!thead) return;
    thead.innerHTML = `
      <tr>
        <th class="py-3 px-3.5">Client ID</th>
        <th class="py-3 px-3.5">Merchant Name</th>
        <th class="py-3 px-3.5">Mobile</th>
        <th class="py-3 px-3.5">Service</th>
        <th class="py-3 px-3.5 text-right">7-Day Sales (₹)</th>
        <th class="py-3 px-3.5 text-center">7-Day Txns</th>
        <th class="py-3 px-3.5">Inactivity / Target Status</th>
        <th class="py-3 px-3.5 text-center">Follow-ups</th>
        <th class="py-3 px-3.5 text-center">Action</th>
      </tr>
    `;
  },

  renderQueueRows(clients, mode = 'today') {
    const tbody = document.getElementById('calling-queue-tbody');
    if (!tbody) return;

    if (!clients || clients.length === 0) {
      const msg = mode === 'pending' 
        ? 'No pending calls currently! All previous calls completed.'
        : 'All merchants have been called today or meet sales targets!';
      tbody.innerHTML = `<tr><td colspan="9" class="text-center py-8 text-slate-500 font-medium">${msg}</td></tr>`;
      return;
    }

    tbody.innerHTML = clients.map(c => {
      let inactiveDays = c.inactiveDays;
      if (inactiveDays === undefined && c.lastTxnDate) {
        const parts = String(c.lastTxnDate).substring(0, 10).split('-');
        if (parts.length === 3) {
          const d = new Date(parts[0], parts[1] - 1, parts[2]);
          inactiveDays = Math.max(0, Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24)));
        }
      }
      if (inactiveDays === undefined || isNaN(inactiveDays)) inactiveDays = 999;

      const vol7 = Number(c.sevenDaySales?.volume || 0);
      const txns7 = Number(c.sevenDaySales?.count || 0);
      const isLocked = c.status === 'Locked' || (c.followupsCount || 0) >= 5;
      const isConverted = c.status === 'Converted';

      let statusBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Active</span>`;
      if (isLocked) {
        statusBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">Locked</span>`;
      } else if (isConverted) {
        statusBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">Converted</span>`;
      }

      // Highlight Badge
      let reasonTag = '';
      if (c.callingTag === 'Zero Sales') {
        const inactText = inactiveDays === 999 ? 'No Txns' : `${inactiveDays}d Inactive`;
        reasonTag = `
          <span class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 inline-flex items-center gap-1.5 shadow-sm">
            <i data-lucide="alert-circle" class="w-3.5 h-3.5"></i>
            <span>0 Sales (${inactText})</span>
          </span>
        `;
      } else if (c.callingTag === 'Target Shortfall') {
        const dropAmount = Number(c.shortfall || 0).toLocaleString('en-IN');
        reasonTag = `
          <span class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 inline-flex items-center gap-1.5 shadow-sm">
            <i data-lucide="trending-down" class="w-3.5 h-3.5"></i>
            <span>₹${dropAmount} Below Target</span>
          </span>
        `;
      } else {
        reasonTag = `
          <span class="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
            ${inactiveDays === 999 ? 'No Txns' : `${inactiveDays}d Inactive`}
          </span>
        `;
      }

      const rowHighlight = c.callingTag === 'Zero Sales' ? 'bg-rose-500/[0.04]' : (c.callingTag === 'Target Shortfall' ? 'bg-amber-500/[0.04]' : '');

      return `
        <tr class="hover:bg-slate-800/40 transition ${rowHighlight}">
          <td class="py-3 px-3.5 font-mono text-brand-400 font-semibold">${c.clientId}</td>
          <td class="py-3 px-3.5">
            <div class="font-bold text-white">${c.clientName}</div>
            ${c.parentName && c.parentName !== '-' ? `<div class="text-[11px] text-slate-400 font-normal">Parent: ${c.parentName}</div>` : ''}
          </td>
          <td class="py-3 px-3.5 whitespace-nowrap">
            <a href="tel:${c.mobile}" class="font-mono font-semibold text-slate-300 hover:text-emerald-400 transition" title="Click to Call">
              ${c.mobile}
            </a>
          </td>
          <td class="py-3 px-3.5 whitespace-nowrap">
            ${Config.getServiceBadgeHtml(c.primaryService || 'General')}
          </td>
          <td class="py-3 px-3.5 text-right font-mono font-bold whitespace-nowrap">
            ${vol7 === 0 ? '<span class="text-rose-400">₹0</span>' : `<span class="text-emerald-400">₹${vol7.toLocaleString('en-IN')}</span>`}
          </td>
          <td class="py-3 px-3.5 text-center whitespace-nowrap">
            <span class="px-2 py-0.5 rounded-lg text-xs font-semibold ${txns7 === 0 ? 'bg-rose-500/10 text-rose-400' : 'bg-slate-800 text-slate-300'}">
              ${txns7} Txns
            </span>
          </td>
          <td class="py-3 px-3.5 whitespace-nowrap">
            ${reasonTag}
          </td>
          <td class="py-3 px-3.5 text-center whitespace-nowrap">
            <div class="flex items-center justify-center gap-1.5">
              <span class="font-bold text-xs ${isLocked ? 'text-rose-400 font-extrabold' : 'text-slate-300'}">
                ${c.followupsCount || 0} / 5
              </span>
              ${statusBadge}
            </div>
          </td>
          <td class="py-3 px-3.5 text-center whitespace-nowrap">
            <div class="flex items-center justify-center gap-1.5">
              <!-- Direct WhatsApp Button -->
              <button type="button" onclick="Calling.openWhatsAppByClientId('${c.clientId}')"
                class="p-2 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 rounded-xl transition cursor-pointer" title="Direct WhatsApp Message">
                <i data-lucide="message-square" class="w-3.5 h-3.5"></i>
              </button>

              <!-- Call Now Button -->
              <button type="button" onclick="Calling.openCallModalById('${c.clientId}')" 
                class="px-2.5 py-1.5 ${isLocked ? 'bg-slate-800 text-slate-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/30'} rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer">
                <i data-lucide="phone-call" class="w-3.5 h-3.5"></i>
                <span>${isLocked ? 'View' : 'Call'}</span>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    if (window.lucide) lucide.createIcons();
  },

  renderCompletedTable() {
    const thead = document.getElementById('calling-thead');
    const tbody = document.getElementById('calling-queue-tbody');
    const summary = document.getElementById('calling-queue-summary');
    if (!thead || !tbody) return;

    thead.innerHTML = `
      <tr>
        <th class="py-3 px-3.5">Time / Date</th>
        <th class="py-3 px-3.5">Client Name</th>
        <th class="py-3 px-3.5">Mobile</th>
        <th class="py-3 px-3.5">Caller Staff</th>
        <th class="py-3 px-3.5">Call Outcome</th>
        <th class="py-3 px-3.5">Next Follow-up</th>
        <th class="py-3 px-3.5">Caller Notes</th>
        <th class="py-3 px-3.5 text-center">Action</th>
      </tr>
    `;

    // Filter calls logged today
    const logs = this.cachedCallsLogs;
    if (summary) summary.textContent = `Total ${logs.length} calls completed and logged today.`;

    if (!logs || logs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center py-8 text-slate-500 font-medium">No calls logged today yet. Telecaller calls will appear here immediately after saving.</td></tr>`;
      return;
    }

    tbody.innerHTML = logs.map(l => {
      const timeStr = l.timestamp ? new Date(l.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : l.date;
      let outcomePill = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">${l.callOutcome || 'Connected'}</span>`;
      if (String(l.callOutcome).toLowerCase().includes('back')) {
        outcomePill = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">${l.callOutcome}</span>`;
      } else if (String(l.callOutcome).toLowerCase().includes('switch')) {
        outcomePill = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">${l.callOutcome}</span>`;
      }

      return `
        <tr class="hover:bg-slate-800/40 transition">
          <td class="py-3 px-3.5 font-mono text-slate-400 whitespace-nowrap">${timeStr}</td>
          <td class="py-3 px-3.5">
            <div class="font-bold text-white">${l.clientName || l.clientId}</div>
            <div class="text-[10px] text-slate-500 font-mono">${l.clientId}</div>
          </td>
          <td class="py-3 px-3.5 whitespace-nowrap">
            <span class="font-mono text-slate-300">${l.clientMobile || '-'}</span>
          </td>
          <td class="py-3 px-3.5 font-semibold text-slate-300 capitalize">${l.callerUser || 'Staff'}</td>
          <td class="py-3 px-3.5 whitespace-nowrap">${outcomePill}</td>
          <td class="py-3 px-3.5 font-mono text-slate-400 whitespace-nowrap">${l.nextFollowup ? String(l.nextFollowup).substring(0, 16) : '-'}</td>
          <td class="py-3 px-3.5 text-slate-300 max-w-xs truncate" title="${l.notes || ''}">${l.notes || '-'}</td>
          <td class="py-3 px-3.5 text-center whitespace-nowrap">
            <button onclick="Calling.openCallModalById('${l.clientId}')" class="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition">
              Re-Call / View
            </button>
          </td>
        </tr>
      `;
    }).join('');

    if (window.lucide) lucide.createIcons();
  },

  renderDistributorsTable() {
    const thead = document.getElementById('calling-thead');
    const tbody = document.getElementById('calling-queue-tbody');
    const summary = document.getElementById('calling-queue-summary');
    if (!thead || !tbody) return;

    thead.innerHTML = `
      <tr>
        <th class="py-3 px-3.5">Parent Distributor</th>
        <th class="py-3 px-3.5">Distributor Mobile</th>
        <th class="py-3 px-3.5 text-center">Inactive Downline Retailers</th>
        <th class="py-3 px-3.5 text-right">Estimated Sales Shortfall (₹)</th>
        <th class="py-3 px-3.5">Retailers Names Summary</th>
        <th class="py-3 px-3.5 text-center">Action</th>
      </tr>
    `;

    const distMap = this.getDistributorsMap();
    const distList = Object.values(distMap).sort((a, b) => b.retailersCount - a.retailersCount);
    if (summary) summary.textContent = `Grouped under ${distList.length} Parent Distributors.`;

    if (distList.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-slate-500 font-medium">No distributors with inactive retailers found.</td></tr>`;
      return;
    }

    tbody.innerHTML = distList.map(d => {
      const topRetailers = d.clients.slice(0, 3).map(c => c.clientName).join(', ') + (d.retailersCount > 3 ? ` +${d.retailersCount - 3} more` : '');
      const cleanDistName = (d.parentName || 'Distributor').split("'").join("");

      return `
        <tr class="hover:bg-slate-800/40 transition">
          <td class="py-3 px-3.5">
            <div class="font-bold text-white flex items-center gap-2">
              <i data-lucide="network" class="w-4 h-4 text-sky-400"></i>
              <span>${d.parentName}</span>
            </div>
          </td>
          <td class="py-3 px-3.5 font-mono text-slate-300 whitespace-nowrap">
            ${d.parentMobile ? `<a href="tel:${d.parentMobile}" class="hover:text-emerald-400 transition">${d.parentMobile}</a>` : '-'}
          </td>
          <td class="py-3 px-3.5 text-center whitespace-nowrap">
            <span class="px-2.5 py-1 rounded-full text-xs font-extrabold bg-rose-500/15 text-rose-400 border border-rose-500/30">
              ${d.retailersCount} Inactive Retailers
            </span>
          </td>
          <td class="py-3 px-3.5 text-right font-mono font-bold text-rose-400 whitespace-nowrap">
            ₹${d.totalDroppedVol.toLocaleString('en-IN')}
          </td>
          <td class="py-3 px-3.5 text-slate-400 text-xs max-w-sm truncate" title="${topRetailers}">
            ${topRetailers}
          </td>
          <td class="py-3 px-3.5 text-center whitespace-nowrap">
            <div class="flex items-center justify-center gap-1.5">
              ${d.parentMobile ? `
                <button type="button" onclick="Calling.openDistributorWhatsApp('${d.parentMobile}', '${cleanDistName}', ${d.retailersCount})"
                  class="p-2 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 rounded-xl transition cursor-pointer" title="WhatsApp Distributor">
                  <i data-lucide="message-square" class="w-3.5 h-3.5"></i>
                </button>
                <a href="tel:${d.parentMobile}" class="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1">
                  <i data-lucide="phone-call" class="w-3.5 h-3.5"></i>
                  <span>Call Distributor</span>
                </a>
              ` : `<span class="text-slate-500 text-xs">Direct Account</span>`}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    if (window.lucide) lucide.createIcons();
  },

  renderLeaderboard() {
    const container = document.getElementById('calling-leaderboard-container');
    if (!container) return;

    // Group logs by caller user
    const stats = {};
    (this.cachedCallsLogs || []).forEach(l => {
      const u = l.callerUser || 'Staff';
      if (!stats[u]) {
        stats[u] = { user: u, total: 0, connected: 0, callbacks: 0, switched: 0 };
      }
      stats[u].total++;
      const outcome = String(l.callOutcome || '').toLowerCase();
      if (outcome.includes('connect')) stats[u].connected++;
      if (outcome.includes('back')) stats[u].callbacks++;
      if (outcome.includes('switch') || outcome.includes('competitor')) stats[u].switched++;
    });

    const userList = Object.values(stats).sort((a, b) => b.total - a.total);

    container.innerHTML = `
      <div class="flex items-center justify-between pb-3 border-b border-slate-800">
        <div>
          <h3 class="text-sm font-bold text-white flex items-center gap-2">
            <i data-lucide="trophy" class="w-4 h-4 text-amber-400"></i>
            <span>Daily Telecaller Productivity & Retention Scorecard</span>
          </h3>
          <p class="text-xs text-slate-400">Real-time caller output, connected rates, and churn reason distribution.</p>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
        ${userList.length === 0 ? `
          <div class="col-span-3 text-center py-10 text-slate-500">
            No calls logged today yet. Caller stats update live as staff dials and logs calls.
          </div>
        ` : userList.map((u, idx) => {
          const rate = u.total > 0 ? Math.round((u.connected / u.total) * 100) : 0;
          return `
            <div class="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2.5">
                  <div class="w-8 h-8 rounded-full bg-brand-500/20 text-brand-400 flex items-center justify-center font-extrabold text-xs">
                    #${idx + 1}
                  </div>
                  <div>
                    <h4 class="font-bold text-white text-sm capitalize">${u.user}</h4>
                    <span class="text-[10px] text-slate-400">Retention Agent</span>
                  </div>
                </div>
                <span class="px-2.5 py-1 rounded-full text-xs font-extrabold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  ${rate}% Connected
                </span>
              </div>

              <div class="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800/80 text-center">
                <div class="p-2 bg-slate-900 rounded-lg">
                  <span class="text-[10px] text-slate-400 block">Total Calls</span>
                  <span class="text-base font-extrabold text-white">${u.total}</span>
                </div>
                <div class="p-2 bg-slate-900 rounded-lg">
                  <span class="text-[10px] text-emerald-400 block">Connected</span>
                  <span class="text-base font-extrabold text-emerald-400">${u.connected}</span>
                </div>
                <div class="p-2 bg-slate-900 rounded-lg">
                  <span class="text-[10px] text-amber-400 block">Call Backs</span>
                  <span class="text-base font-extrabold text-amber-400">${u.callbacks}</span>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    if (window.lucide) lucide.createIcons();
  },

  /* ==========================================================================
     WHATSAPP DIRECT MESSAGING HELPERS
     ========================================================================== */
  openWhatsAppByClientId(clientId) {
    const c = this.currentClientList.find(x => x.clientId === clientId);
    if (c) {
      this.openWhatsAppModal(c.mobile, c.clientName, c.primaryService);
    }
  },

  openWhatsAppModal(mobile, clientName, service) {
    this.activeWhatsAppClient = { mobile, clientName, service };
    const modal = document.getElementById('whatsapp-modal');
    if (!modal) return;
    const nameEl = document.getElementById('wa-merchant-name');
    const mobEl = document.getElementById('wa-merchant-mobile');
    if (nameEl) nameEl.textContent = clientName || 'Retailer';
    if (mobEl) mobEl.textContent = mobile || '';
    this.onWhatsAppTemplateChange();
    modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
  },

  closeWhatsAppModal() {
    const modal = document.getElementById('whatsapp-modal');
    if (modal) modal.classList.add('hidden');
  },

  onWhatsAppTemplateChange() {
    const tpl = document.getElementById('wa-template-select')?.value || 'retention';
    const name = this.activeWhatsAppClient?.clientName || 'Merchant Partner';
    const service = this.activeWhatsAppClient?.service || 'Zapurse';
    const textarea = document.getElementById('wa-message-text');
    if (!textarea) return;

    if (tpl === 'retention') {
      textarea.value = `नमस्ते ${name} जी! ZapPurse फिनटेक सपोर्ट से। आपकी आईडी (${service}) पर पिछले कुछ दिनों से कोई ट्रांजैक्शन नहीं हुआ है। क्या आपको बायोमेट्रिक डिवाइस (मंत्रा/मॉर्फो), वॉलेट या लॉगिन में कोई समस्या आ रही है? तुरंत सहायता के लिए यहाँ रिप्लाई करें।`;
    } else if (tpl === 'device_help') {
      textarea.value = `नमस्ते ${name} जी, क्या आपकी बायोमेट्रिक मशीन या पोर्टल में कोई टेक्निकल एरर आ रहा है? हमारी टेक्निकल सपोर्ट टीम तुरंत इसे ठीक करेगी। कृपया एरर का फोटो या रिप्लाई भेजें।`;
    } else if (tpl === 'commission_boost') {
      textarea.value = `बधाई ${name} जी! ZapPurse पोर्टल पर AEPS, UPI और Recharge पर सबसे ज्यादा कमीशन और बेस्ट सक्सेस रेट चालू है। आज ही ट्रांजैक्शन शुरू करें और एक्स्ट्रा कमाई पाएं!`;
    } else {
      textarea.value = `नमस्ते ${name} जी, ZapPurse सपोर्ट टीम की तरफ से...`;
    }
  },

  sendWhatsAppNow() {
    const mobile = this.activeWhatsAppClient?.mobile || '';
    const text = document.getElementById('wa-message-text')?.value || '';
    if (!mobile) {
      Swal.fire('Error', 'Mobile number missing', 'error');
      return;
    }
    const clean = mobile.replace(/[^0-9]/g, '').slice(-10);
    this.closeWhatsAppModal();
    window.open(`https://wa.me/91${clean}?text=${encodeURIComponent(text)}`, '_blank');
  },

  openWhatsAppFromModal() {
    if (!this.activeCallingClient) return;
    this.openWhatsAppModal(
      this.activeCallingClient.mobile,
      this.activeCallingClient.clientName,
      this.activeCallingClient.primaryService
    );
  },

  openDistributorWhatsApp(parentMobile, parentName, count) {
    if (!parentMobile) return;
    const clean = parentMobile.replace(/[^0-9]/g, '').slice(-10);
    const msg = `नमस्ते ${parentName} जी! ZapPurse से। आपके डाउनलाइन नेटवर्क के ${count} रिटेलर्स ने पिछले कुछ दिनों से कोई ट्रांजैक्शन नहीं किया है। कृपया उनसे तुरंत संपर्क करें ताकि उनके एरिया का बिजनेस चालू रहे। किसी भी समस्या के समाधान के लिए हमें रिप्लाई करें।`;
    window.open(`https://wa.me/91${clean}?text=${encodeURIComponent(msg)}`, '_blank');
  },

  /* ==========================================================================
     MERCHANT COMMISSION & EARNING PITCH CALCULATOR TOOL
     ========================================================================== */
  openPitchCalculator(clientName) {
    this.activePitchClient = clientName || 'Retailer Partner';
    const modal = document.getElementById('pitch-calc-modal');
    if (!modal) return;
    const nameElem = document.getElementById('pitch-calc-merchant-name');
    if (nameElem) nameElem.textContent = this.activePitchClient;
    modal.classList.remove('hidden');
    this.updatePitchCalculations();
    if (window.lucide) lucide.createIcons();
  },

  closePitchCalculator() {
    const modal = document.getElementById('pitch-calc-modal');
    if (modal) modal.classList.add('hidden');
  },

  updatePitchCalculations() {
    const aepsTxns = Number(document.getElementById('calc-range-aeps')?.value || 5);
    const rechargeTxns = Number(document.getElementById('calc-range-recharge')?.value || 10);
    const dmtVol = Number(document.getElementById('calc-range-dmt')?.value || 15000);

    const valAeps = document.getElementById('calc-val-aeps');
    const valRec = document.getElementById('calc-val-recharge');
    const valDmt = document.getElementById('calc-val-dmt');
    if (valAeps) valAeps.textContent = `${aepsTxns} txns/day`;
    if (valRec) valRec.textContent = `${rechargeTxns} txns/day`;
    if (valDmt) valDmt.textContent = `₹${dmtVol.toLocaleString('en-IN')}/day`;

    // Formulas: AEPS avg ₹8/txn, Recharge avg ₹7.5/txn, DMT 0.5%
    const dailyProfit = Math.round((aepsTxns * 8) + (rechargeTxns * 7.5) + (dmtVol * 0.005));
    const monthlyProfit = dailyProfit * 30;
    const yearlyProfit = dailyProfit * 365;

    const rDaily = document.getElementById('calc-result-daily');
    const rMonthly = document.getElementById('calc-result-monthly');
    const rYearly = document.getElementById('calc-result-yearly');
    if (rDaily) rDaily.textContent = `₹${dailyProfit.toLocaleString('en-IN')}`;
    if (rMonthly) rMonthly.textContent = `₹${monthlyProfit.toLocaleString('en-IN')}`;
    if (rYearly) rYearly.textContent = `₹${yearlyProfit.toLocaleString('en-IN')}`;

    const scriptElem = document.getElementById('pitch-script-text');
    if (scriptElem) {
      scriptElem.textContent = `"सर, अगर आप ZapPurse पोर्टल से रोज़ सिर्फ ${aepsTxns} AEPS निकासी और ${rechargeTxns} रिचार्ज करेंगे, तो महीने का ₹${monthlyProfit.toLocaleString('en-IN')} सीधा मुनाफा आपकी दुकान का बढ़ेगा! हमारी आईडी में 99.5% का हाईएस्ट सक्सेस रेट मिलता है।"`;
    }
  },

  copyPitchScript() {
    const script = document.getElementById('pitch-script-text')?.textContent?.trim() || '';
    if (navigator.clipboard) {
      navigator.clipboard.writeText(script);
      Swal.fire({ icon: 'success', title: 'Pitch Script Copied!', timer: 1500, showConfirmButton: false });
    }
  },

  sendPitchViaWhatsApp() {
    const script = document.getElementById('pitch-script-text')?.textContent?.trim() || '';
    const phone = this.activeCallingClient?.mobile || '';
    if (!phone) {
      Swal.fire('Notice', 'Please open a merchant call or enter mobile number first.', 'info');
      return;
    }
    const clean = phone.replace(/[^0-9]/g, '').slice(-10);
    window.open(`https://wa.me/91${clean}?text=${encodeURIComponent(script)}`, '_blank');
  },

  async openCallModalById(clientId) {
    const client = this.currentClientList.find(c => c.clientId === clientId);
    if (client) {
      this.openCallModal(client);
    } else {
      // Fetch details from backend
      try {
        const res = await Api.get('getClientHistory', { clientId });
        if (res.client) {
          this.openCallModal(res.client);
        }
      } catch (e) {
        Swal.fire('Error', 'Unable to fetch client details', 'error');
      }
    }
  },

  async openCallModal(client) {
    this.activeCallingClient = client;
    const modal = document.getElementById('call-modal');
    modal.classList.remove('hidden');

    // Populate Headers
    document.getElementById('call-modal-client-name').textContent = client.clientName;
    document.getElementById('call-modal-client-sub').textContent = `${client.clientId} • ${client.cityState} • ${client.primaryService || 'Fintech'}`;
    
    // Parent Distributor Info
    const parentSub = document.getElementById('call-modal-parent-sub');
    const parentText = document.getElementById('call-modal-parent-text');
    if (client.parentName && client.parentName !== '-') {
      parentText.textContent = `Parent Distributor: ${client.parentName} ${client.parentMobile && client.parentMobile !== '-' ? '(Mob: ' + client.parentMobile + ')' : ''}`;
      parentSub.classList.remove('hidden');
    } else {
      parentSub.classList.add('hidden');
    }

    document.getElementById('call-modal-mobile').textContent = client.mobile;
    document.getElementById('call-modal-tel-link').href = `tel:${client.mobile}`;

    // Status Badge
    const statusBadge = document.getElementById('call-modal-status-badge');
    statusBadge.textContent = client.status || 'Active';
    if (client.status === 'Locked') {
      statusBadge.className = 'px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20';
    } else {
      statusBadge.className = 'px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
    }

    // Follow-up Count & Limit
    const limitBox = document.getElementById('call-modal-limit-box');
    const followupCountSpan = document.getElementById('call-modal-followup-count');
    followupCountSpan.textContent = `Call #${client.followupsCount || 0} / 5 Limit`;

    if ((client.followupsCount || 0) >= 5 || client.status === 'Locked') {
      limitBox.className = 'p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between';
      followupCountSpan.innerHTML = `<span class="text-rose-400 font-bold">Auto-Locked (Limit Reached)</span>`;
    } else {
      limitBox.className = 'p-3 rounded-xl bg-slate-800/60 border border-slate-700 flex items-center justify-between';
    }

    // Reset Form Fields
    document.getElementById('call-modal-audio-file').value = '';
    document.getElementById('call-modal-next-date').value = '';
    document.getElementById('call-modal-next-time').value = '';
    document.getElementById('call-modal-outcome').value = 'Connected';
    document.getElementById('call-modal-mark-converted').checked = false;

    // Render Dynamic Questions
    await this.renderDynamicQuestions();

    // Fetch and render Past Call History Timeline
    await this.loadPastHistory(client.clientId);

    if (window.lucide) lucide.createIcons();
  },

  closeCallModal() {
    this.stopLiveRecordingIfActive();
    document.getElementById('call-modal').classList.add('hidden');
    this.activeCallingClient = null;
    this.recordedBlob = null;
    const preview = document.getElementById('live-rec-preview');
    if (preview) {
      preview.src = '';
      preview.classList.add('hidden');
    }
  },

  async toggleLiveRecording() {
    if (this.isRecording) {
      // Stop Recording
      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop();
      }
      this.isRecording = false;
      clearInterval(this.recInterval);
      document.getElementById('recording-timer')?.classList.add('hidden');
      document.getElementById('rec-btn-text').textContent = 'Re-record Voice';
      document.getElementById('start-rec-btn').className = 'px-3.5 py-1.5 rounded-xl bg-slate-800 text-slate-300 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition';
    } else {
      // Start Recording
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.audioChunks = [];
        this.mediaRecorder = new MediaRecorder(stream);

        this.mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) this.audioChunks.push(e.data);
        };

        this.mediaRecorder.onstop = () => {
          this.recordedBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
          const audioUrl = URL.createObjectURL(this.recordedBlob);
          const preview = document.getElementById('live-rec-preview');
          if (preview) {
            preview.src = audioUrl;
            preview.classList.remove('hidden');
          }
          // Stop mic tracks
          stream.getTracks().forEach(t => t.stop());
        };

        this.mediaRecorder.start();
        this.isRecording = true;
        this.recSeconds = 0;

        const timerEl = document.getElementById('recording-timer');
        if (timerEl) {
          timerEl.classList.remove('hidden');
          timerEl.textContent = '● REC 00:00';
        }

        this.recInterval = setInterval(() => {
          this.recSeconds++;
          const mins = String(Math.floor(this.recSeconds / 60)).padStart(2, '0');
          const secs = String(this.recSeconds % 60).padStart(2, '0');
          if (timerEl) timerEl.textContent = `● REC ${mins}:${secs}`;
        }, 1000);

        document.getElementById('rec-btn-text').textContent = 'Stop Recording';
        document.getElementById('start-rec-btn').className = 'px-3.5 py-1.5 rounded-xl bg-rose-600 text-white border border-rose-500 shadow-lg shadow-rose-600/40 text-xs font-bold flex items-center gap-1.5 transition animate-pulse';

      } catch (err) {
        Swal.fire('Microphone Permission', 'Could not access microphone: ' + err.message, 'warning');
      }
    }
    if (window.lucide) lucide.createIcons();
  },

  stopLiveRecordingIfActive() {
    if (this.isRecording) {
      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop();
      }
      this.isRecording = false;
      clearInterval(this.recInterval);
      document.getElementById('recording-timer')?.classList.add('hidden');
    }
  },

  toggleHistoryAccordion() {
    const content = document.getElementById('call-modal-history-content');
    const chevron = document.getElementById('history-accordion-chevron');
    content.classList.toggle('hidden');
    chevron.classList.toggle('rotate-180');
  },

  async renderDynamicQuestions() {
    const container = document.getElementById('call-modal-dynamic-questions-container');
    if (!container) return;

    if (this.cachedQuestions.length === 0) {
      try {
        const configData = await Api.get('getAdminConfig');
        this.cachedQuestions = configData.config?.dynamicQuestions || Config.DEFAULT_QUESTIONS;
      } catch (e) {
        this.cachedQuestions = Config.DEFAULT_QUESTIONS;
      }
    }

    container.innerHTML = this.cachedQuestions.map(q => {
      if (q.type === 'select') {
        return `
          <div>
            <label class="block text-[11px] font-semibold text-slate-300 mb-1">${q.text}</label>
            <select id="dyn-${q.id}" class="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs">
              ${(q.options || []).map(opt => `<option value="${opt}">${opt}</option>`).join('')}
            </select>
          </div>
        `;
      } else if (q.type === 'textarea') {
        return `
          <div>
            <label class="block text-[11px] font-semibold text-slate-300 mb-1">${q.text}</label>
            <textarea id="dyn-${q.id}" rows="2" placeholder="${q.placeholder || ''}" class="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs"></textarea>
          </div>
        `;
      } else {
        return `
          <div>
            <label class="block text-[11px] font-semibold text-slate-300 mb-1">${q.text}</label>
            <input type="text" id="dyn-${q.id}" placeholder="${q.placeholder || ''}" class="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs">
          </div>
        `;
      }
    }).join('');
  },

  async loadPastHistory(clientId) {
    const timelineList = document.getElementById('call-modal-timeline-list');
    const historyCountBadge = document.getElementById('call-modal-history-count');
    const daysTbody = document.getElementById('call-modal-7days-tbody');
    const summaryBadge = document.getElementById('call-modal-7days-summary');

    if (timelineList) timelineList.innerHTML = `<p class="text-slate-500 text-center py-2">Loading past interactions...</p>`;
    if (daysTbody) daysTbody.innerHTML = `<tr><td colspan="4" class="text-center py-3 text-slate-500">Loading 7-day sales breakdown...</td></tr>`;

    try {
      const res = await Api.get('getClientHistory', { clientId });

      // 1. Render Parent Info if present in client record
      if (res.client) {
        const parentSub = document.getElementById('call-modal-parent-sub');
        const parentText = document.getElementById('call-modal-parent-text');
        if (parentSub && parentText && (res.client.parentName || res.client.parentMobile)) {
          const pName = res.client.parentName && res.client.parentName !== '-' ? res.client.parentName : '';
          const pMob = res.client.parentMobile && res.client.parentMobile !== '-' ? res.client.parentMobile : '';
          if (pName || pMob) {
            parentText.textContent = `Parent Distributor: ${pName || '-'} (Mob: ${pMob || '-'})`;
            parentSub.classList.remove('hidden');
          }
        }
      }

      // 2. Render Previous 7 Days Day-by-Day Sales Table
      const sales7 = res.last7DaysSales || [];
      if (summaryBadge) {
        summaryBadge.textContent = `Total 7-Day: ₹${Number(res.total7DayVolume || 0).toLocaleString('en-IN')} (${Number(res.total7DayTxns || 0).toLocaleString('en-IN')} Txns)`;
      }

      if (daysTbody) {
        if (sales7.length === 0) {
          daysTbody.innerHTML = `<tr><td colspan="4" class="text-center py-3 text-slate-500">No transactions recorded in the last 7 days.</td></tr>`;
        } else {
          daysTbody.innerHTML = sales7.map(d => {
            const isZero = d.volume === 0;
            const statusBadge = isZero
              ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">0 Txns (Drop)</span>`
              : `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Active (${d.count})</span>`;
            
            const volText = isZero 
              ? `<span class="text-slate-500 font-mono">₹0</span>`
              : `<span class="text-emerald-400 font-mono font-bold">₹${Number(d.volume).toLocaleString('en-IN')}</span>`;
            
            const countText = isZero
              ? `<span class="text-slate-500 font-mono">0</span>`
              : `<span class="text-white font-mono font-semibold">${d.count}</span>`;

            return `
              <tr class="hover:bg-slate-800/40 transition">
                <td class="py-2.5 px-3 font-semibold text-white">
                  ${d.label} <span class="text-[10px] text-slate-500 font-mono block">${d.date}</span>
                </td>
                <td class="py-2.5 px-3 text-right">${countText}</td>
                <td class="py-2.5 px-3 text-right">${volText}</td>
                <td class="py-2.5 px-3 text-center">${statusBadge}</td>
              </tr>
            `;
          }).join('');
        }
      }

      // 3. Render Complete Past History Timeline
      const timeline = res.timeline || [];
      if (historyCountBadge) {
        historyCountBadge.textContent = `${timeline.length} previous call${timeline.length === 1 ? '' : 's'}`;
      }

      if (timelineList) {
        if (timeline.length === 0) {
          timelineList.innerHTML = `
            <div class="text-center py-4 text-slate-500">
              <p>No prior calling records found. This is Call #1 for this merchant.</p>
            </div>
          `;
        } else {
          timelineList.innerHTML = timeline.map((t, idx) => {
            let recordingPlayer = '';
            if (t.recordingUrl && t.recordingUrl.startsWith('http')) {
              recordingPlayer = `
                <div class="mt-2.5 p-2 bg-slate-950 rounded-lg border border-slate-800">
                  <span class="text-[10px] text-slate-400 font-semibold flex items-center gap-1 mb-1">
                    <i data-lucide="play" class="w-3 h-3 text-brand-400"></i> Call Audio Recording:
                  </span>
                  <audio controls class="w-full h-7">
                    <source src="${t.recordingUrl}" type="audio/mpeg">
                    Your browser does not support audio playback.
                  </audio>
                </div>
              `;
            }

            let qaHtml = '';
            if (t.qaResponses && typeof t.qaResponses === 'object') {
              qaHtml = `
                <div class="space-y-1 pt-1.5 border-t border-slate-800/60 mt-1.5 text-[11px]">
                  ${Object.entries(t.qaResponses).map(([k, v]) => `
                    <div class="flex items-start gap-1">
                      <span class="text-slate-400 font-semibold min-w-[90px]">${k}:</span>
                      <span class="text-slate-200 font-medium whitespace-pre-line">${v}</span>
                    </div>
                  `).join('')}
                </div>
              `;
            }

            let followupInfo = '';
            if (t.nextFollowup) {
              followupInfo = `
                <div class="mt-1.5 text-[10px] text-amber-400/90 flex items-center gap-1">
                  <i data-lucide="clock" class="w-3 h-3"></i>
                  <span>Scheduled Follow-up: <strong>${t.nextFollowup}</strong></span>
                </div>
              `;
            }

            return `
              <div class="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-1.5 hover:border-slate-700 transition">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-1.5">
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-500/10 text-brand-400 border border-brand-500/20">
                      Call #${timeline.length - idx} • ${t.callOutcome || 'Connected'}
                    </span>
                    <span class="text-[10px] text-slate-400 font-medium">by <strong>${t.callerUser || 'caller'}</strong></span>
                  </div>
                  <span class="text-[10px] text-slate-400 font-mono">
                    ${new Date(t.timestamp).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                  </span>
                </div>

                ${t.notes ? `<p class="text-xs text-white font-medium pl-1 border-l-2 border-brand-500">${t.notes}</p>` : ''}
                ${qaHtml}
                ${followupInfo}
                ${recordingPlayer}
              </div>
            `;
          }).join('');
        }
      }

    } catch (err) {
      if (timelineList) timelineList.innerHTML = `<p class="text-rose-400 text-center py-2">Failed to load history: ${err.message}</p>`;
      if (daysTbody) daysTbody.innerHTML = `<tr><td colspan="4" class="text-center py-3 text-rose-400">Failed to load 7-day sales.</td></tr>`;
    }

    if (window.lucide) lucide.createIcons();
  },

  async submitCallLog() {
    if (!this.activeCallingClient) return;

    const btn = document.getElementById('call-modal-save-btn');
    const outcome = document.getElementById('call-modal-outcome').value;
    const markConverted = document.getElementById('call-modal-mark-converted').checked;
    const nextDate = document.getElementById('call-modal-next-date').value;
    const nextTime = document.getElementById('call-modal-next-time').value;

    let nextFollowupDateTime = '';
    if (nextDate) {
      nextFollowupDateTime = `${nextDate}T${nextTime || '11:00'}:00`;
    }

    // Collect Dynamic QA responses
    const qaResponses = {};
    let remarkText = '';
    this.cachedQuestions.forEach(q => {
      const el = document.getElementById(`dyn-${q.id}`);
      if (el) {
        const val = el.value.trim();
        qaResponses[q.text] = val;
        if (q.text.toLowerCase().includes('remark') && val) {
          remarkText = val;
        }
      }
    });

    // Check for Audio File upload or Live In-Browser Recording
    const fileInput = document.getElementById('call-modal-audio-file');
    let audioBase64 = '';
    let audioFileName = '';

    if (this.recordedBlob) {
      audioFileName = `VoiceNote_${this.activeCallingClient.clientId}_${Date.now()}.webm`;
      try {
        audioBase64 = await Api.fileToBase64(this.recordedBlob);
      } catch (e) {
        console.warn('Recorded blob base64 failed:', e);
      }
    } else if (fileInput.files && fileInput.files[0]) {
      const file = fileInput.files[0];
      audioFileName = file.name;
      try {
        audioBase64 = await Api.fileToBase64(file);
      } catch (e) {
        console.warn('Audio base64 conversion failed:', e);
      }
    }

    const payload = {
      clientId: this.activeCallingClient.clientId,
      clientName: this.activeCallingClient.clientName,
      callerUser: Auth.getCurrentUser()?.username || 'caller',
      callOutcome: outcome,
      qaResponses: qaResponses,
      audioBase64: audioBase64,
      audioFileName: audioFileName,
      nextFollowupDateTime: nextFollowupDateTime,
      markConverted: markConverted,
      notes: remarkText || `${outcome} - Followup scheduled`
    };

    btn.disabled = true;
    btn.innerHTML = `<span>Saving & Syncing...</span> <i data-lucide="loader" class="w-4 h-4 animate-spin"></i>`;
    if (window.lucide) lucide.createIcons();

    try {
      const res = await Api.post('saveCallLog', payload);

      if (res.success) {
        Swal.fire({
          icon: 'success',
          title: 'Call Logged!',
          text: res.message || 'Call recording uploaded & Google Calendar synced successfully!',
          timer: 2000,
          showConfirmButton: false
        });

        this.closeCallModal();
        this.load(); // Refresh queue
        Dashboard.load(); // Refresh KPIs
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Submission Failed',
          text: res.message || 'Error saving call log'
        });
      }
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Failed to save call: ' + err.message
      });
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<i data-lucide="check" class="w-4 h-4"></i> <span>Save Call & Sync Calendar</span>`;
      if (window.lucide) lucide.createIcons();
    }
  }
};
