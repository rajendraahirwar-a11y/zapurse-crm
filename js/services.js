/**
 * ==============================================================================
 * ZAPURSE FINTECH CRM - DYNAMIC SERVICES VIEW HANDLER (WITH DATE FILTERING)
 * ==============================================================================
 */

const Services = {
  currentService: '',
  allServiceSales: [],
  filteredServiceSales: [],
  activeDateFilter: 'yesterday', // 'yesterday' (Default as per user requirement) | 'today' | '7days' | 'custom' | 'all'
  systemYesterdayDate: '',
  systemTodayDate: '',
  customFromDate: '',
  customToDate: '',

  async openService(serviceName) {
    this.currentService = serviceName;
    App.switchView('services');

    // Update mobile bottom nav state
    if (window.App && typeof App.updateMobileBottomNav === 'function') {
      App.updateMobileBottomNav('services');
    }

    // Update screen title badge & headers
    const badge = document.getElementById('current-screen-badge');
    if (badge) badge.textContent = serviceName;
    const title = document.getElementById('service-view-title');
    if (title) title.textContent = serviceName;
    const subtitle = document.getElementById('service-view-subtitle');
    if (subtitle) subtitle.textContent = `Dedicated live monitoring & transactions matrix for ${serviceName}.`;

    // Reset date filter state to Yesterday (Default)
    this.activeDateFilter = 'yesterday';
    this.customFromDate = '';
    this.customToDate = '';
    const fromInput = document.getElementById('service-from-date');
    const toInput = document.getElementById('service-to-date');
    const searchInput = document.getElementById('service-search-input');
    if (fromInput) fromInput.value = '';
    if (toInput) toInput.value = '';
    if (searchInput) searchInput.value = '';

    // Determine Today & Yesterday
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    this.systemTodayDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

    // Reuse closed business date from Dashboard if available
    if (window.Dashboard && Dashboard.systemYesterdayDate) {
      this.systemYesterdayDate = Dashboard.systemYesterdayDate;
    } else {
      const yDate = new Date(now);
      yDate.setDate(now.getDate() - 1);
      this.systemYesterdayDate = `${yDate.getFullYear()}-${pad(yDate.getMonth() + 1)}-${pad(yDate.getDate())}`;
    }

    // ⚡ ZERO-LATENCY PRE-RENDER: If Dashboard already loaded sales in memory, render immediately!
    let hasPreRendered = false;
    if (window.Dashboard && Array.isArray(Dashboard.allSalesData) && Dashboard.allSalesData.length > 0) {
      const immediateSales = Dashboard.allSalesData.filter(s => {
        if (Config.isPaymentGatewayUser(s.clientName, s.mobile)) return false;
        return (s.serviceName || '').toUpperCase() === (serviceName || '').toUpperCase();
      });
      if (immediateSales.length > 0) {
        this.allServiceSales = immediateSales;
        this.updatePillUI();
        this.renderFilteredView();
        hasPreRendered = true;
      }
    }

    // Show loading indicator only if no pre-rendered data exists
    const volElem = document.getElementById('service-view-total-vol');
    const txnsElem = document.getElementById('service-view-total-txns');
    const tbody = document.getElementById('service-sales-tbody');

    if (!hasPreRendered) {
      if (volElem) volElem.textContent = 'Loading...';
      if (txnsElem) txnsElem.textContent = 'Loading...';
      if (tbody) tbody.innerHTML = `<tr><td colspan="9" class="text-center py-8 text-slate-400 font-medium"><i data-lucide="loader-2" class="w-5 h-5 animate-spin inline mr-2 text-brand-400"></i>Loading live ${serviceName} transactions...</td></tr>`;
      if (window.lucide) lucide.createIcons();
    }

    try {
      let data = await Api.get('getServiceData', { service: serviceName });

      // Fallback if needed
      if (!data || data.totalVolume === undefined) {
        console.warn('getServiceData returned empty, using fallback to getInitialData');
        const initData = await Api.get('getInitialData');
        const filtered = (initData.recentSales || []).filter(s => {
          if (Config.isPaymentGatewayUser(s.clientName, s.mobile)) return false;
          return (s.serviceName || '').toUpperCase() === (serviceName || '').toUpperCase();
        });
        let fVol = 0, fTxns = 0;
        filtered.forEach(s => { fVol += Number(s.volume) || 0; fTxns += Number(s.txnCount) || 0; });
        data = {
          serviceName: serviceName,
          totalVolume: fVol,
          totalTxnCount: fTxns,
          transactions: filtered
        };
      }

      // Filter out internal Payment Gateway User
      const sales = (data.transactions || []).filter(item => !Config.isPaymentGatewayUser(item.clientName, item.mobile));
      this.allServiceSales = sales;

      // Auto-adjust yesterday if recent sales exist but calendar yesterday doesn't match
      if (this.allServiceSales.length > 0) {
        const hasYesterday = this.allServiceSales.some(d => (d.date || '').startsWith(this.systemYesterdayDate));
        if (!hasYesterday) {
          const dates = [...new Set(this.allServiceSales.map(d => (d.date || '').substring(0, 10)).filter(Boolean))].sort().reverse();
          if (dates.length > 0) {
            this.systemYesterdayDate = dates[0];
          }
        }
      }

      this.updatePillUI();
      this.renderFilteredView();

    } catch (err) {
      console.error('Error loading service:', err);
      if (volElem) volElem.textContent = 'Error';
      if (txnsElem) txnsElem.textContent = 'Error';
      if (tbody) tbody.innerHTML = `<tr><td colspan="9" class="text-center py-6 text-rose-400 font-medium">Failed to load ${serviceName} data. Check network or reload.</td></tr>`;
    }

    if (window.lucide) lucide.createIcons();
  },

  updatePillUI() {
    const pills = ['all', 'yesterday', 'today', '7days'];
    pills.forEach(p => {
      const btn = document.getElementById(`srv-pill-${p}`);
      if (btn) {
        if (p === this.activeDateFilter) {
          btn.className = 'srv-pill-btn active px-3 py-1.5 rounded-lg text-xs font-bold bg-brand-600 text-white shadow-sm transition';
        } else {
          btn.className = 'srv-pill-btn px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 transition';
        }
      }
    });
  },

  applyQuickFilter(range) {
    this.activeDateFilter = range;
    this.customFromDate = '';
    this.customToDate = '';
    const fromInput = document.getElementById('service-from-date');
    const toInput = document.getElementById('service-to-date');
    if (fromInput) fromInput.value = '';
    if (toInput) toInput.value = '';

    this.updatePillUI();
    this.renderFilteredView();
  },

  applyCustomDateFilter() {
    const from = document.getElementById('service-from-date')?.value;
    const to = document.getElementById('service-to-date')?.value;

    if (!from && !to) {
      Swal.fire('Select Dates', 'Please choose From Date and/or To Date', 'info');
      return;
    }

    this.customFromDate = from || '';
    this.customToDate = to || '';
    this.activeDateFilter = 'custom';

    // Unselect quick pills
    ['all', 'yesterday', 'today', '7days'].forEach(p => {
      const btn = document.getElementById(`srv-pill-${p}`);
      if (btn) {
        btn.className = 'srv-pill-btn px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 transition';
      }
    });

    this.renderFilteredView();
  },

  resetFilter() {
    const fromInput = document.getElementById('service-from-date');
    const toInput = document.getElementById('service-to-date');
    const searchInput = document.getElementById('service-search-input');
    if (fromInput) fromInput.value = '';
    if (toInput) toInput.value = '';
    if (searchInput) searchInput.value = '';

    this.customFromDate = '';
    this.customToDate = '';
    this.activeDateFilter = 'yesterday';
    this.updatePillUI();
    this.renderFilteredView();
  },

  filterTable() {
    this.renderFilteredView();
  },

  renderFilteredView() {
    const query = (document.getElementById('service-search-input')?.value || '').toLowerCase().trim();

    // 7 days ago
    const now = new Date();
    const d7 = new Date(now);
    d7.setDate(now.getDate() - 7);
    const pad = (n) => String(n).padStart(2, '0');
    const d7Str = `${d7.getFullYear()}-${pad(d7.getMonth() + 1)}-${pad(d7.getDate())}`;

    // Filter items
    this.filteredServiceSales = this.allServiceSales.filter(item => {
      const itemDate = (item.date || '').substring(0, 10);

      // Date Range Filter
      if (this.activeDateFilter === 'yesterday') {
        if (this.systemYesterdayDate && itemDate !== this.systemYesterdayDate) return false;
      } else if (this.activeDateFilter === 'today') {
        if (this.systemTodayDate && itemDate !== this.systemTodayDate) return false;
      } else if (this.activeDateFilter === '7days') {
        if (itemDate < d7Str) return false;
      } else if (this.activeDateFilter === 'custom') {
        if (this.customFromDate && itemDate < this.customFromDate) return false;
        if (this.customToDate && itemDate > this.customToDate) return false;
      }

      // Search Filter
      if (query) {
        const str = `${item.txnId || ''} ${item.clientId || ''} ${item.clientName || ''} ${item.mobile || ''} ${item.parentName || ''} ${item.parentMobile || ''}`.toLowerCase();
        if (!str.includes(query)) return false;
      }

      return true;
    });

    // Compute Totals
    let totalVol = 0;
    let totalTxns = 0;
    const merchantMap = {};

    this.filteredServiceSales.forEach(s => {
      const v = Number(s.volume) || 0;
      const c = Number(s.txnCount) || 1;
      totalVol += v;
      totalTxns += c;

      const mKey = s.clientId || s.clientName || 'UNKNOWN';
      if (!merchantMap[mKey]) {
        merchantMap[mKey] = {
          clientId: s.clientId || '-',
          clientName: s.clientName || '-',
          mobile: s.mobile || '-',
          volume: 0,
          txnCount: 0
        };
      }
      merchantMap[mKey].volume += v;
      merchantMap[mKey].txnCount += c;
    });

    // Update Header Metric Cards
    const volElem = document.getElementById('service-view-total-vol');
    const txnsElem = document.getElementById('service-view-total-txns');
    if (volElem) volElem.textContent = '₹' + totalVol.toLocaleString('en-IN');
    if (txnsElem) txnsElem.textContent = totalTxns.toLocaleString('en-IN');

    // Update Date Filter Status Tag
    const filterTag = document.getElementById('service-filter-status-tag');
    if (filterTag) {
      let label = 'All Transactions';
      if (this.activeDateFilter === 'yesterday') label = `Yesterday (${this.systemYesterdayDate})`;
      else if (this.activeDateFilter === 'today') label = `Today (${this.systemTodayDate})`;
      else if (this.activeDateFilter === '7days') label = 'Last 7 Days';
      else if (this.activeDateFilter === 'custom') label = `${this.customFromDate || 'Start'} to ${this.customToDate || 'End'}`;
      filterTag.textContent = `${label} • ${this.filteredServiceSales.length} records`;
    }

    // Sort Merchants for Top and Bottom Performers
    const merchantList = Object.values(merchantMap);
    const topMerchants = [...merchantList].sort((a, b) => b.volume - a.volume).slice(0, 5);
    const bottomMerchants = [...merchantList].sort((a, b) => a.volume - b.volume).slice(0, 5);

    // Render Top Merchants
    const topContainer = document.getElementById('service-top-merchants');
    if (topContainer) {
      if (topMerchants.length === 0) {
        topContainer.innerHTML = `<div class="text-center py-6 text-slate-500 text-xs font-medium">No transactions match the selected filters.</div>`;
      } else {
        topContainer.innerHTML = topMerchants.map(m => `
          <div class="p-3 bg-slate-950/80 border border-slate-800/80 rounded-xl flex items-center justify-between hover:border-slate-700 transition">
            <div class="truncate mr-2">
              <p class="text-xs font-bold text-white truncate">${m.clientName || m.clientId}</p>
              <p class="text-[11px] text-slate-400">${m.clientId} • ${m.mobile || '-'} • <span class="text-slate-300 font-semibold">${m.txnCount} txns</span></p>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-xs font-mono font-bold text-lime-400">₹${Number(m.volume).toLocaleString('en-IN')}</span>
              <button onclick="Calling.openCallModalById('${m.clientId}')" class="p-1.5 bg-lime-500/10 hover:bg-lime-500/20 text-lime-400 border border-lime-500/30 rounded-lg text-xs font-semibold transition" title="Call Merchant">
                <i data-lucide="phone" class="w-3.5 h-3.5"></i>
              </button>
            </div>
          </div>
        `).join('');
      }
    }

    // Render Lowest Active Merchants
    const bottomContainer = document.getElementById('service-bottom-merchants');
    if (bottomContainer) {
      if (bottomMerchants.length === 0) {
        bottomContainer.innerHTML = `<div class="text-center py-6 text-slate-500 text-xs font-medium">No merchants found.</div>`;
      } else {
        bottomContainer.innerHTML = bottomMerchants.map(m => `
          <div class="p-3 bg-slate-950/80 border border-slate-800/80 rounded-xl flex items-center justify-between hover:border-slate-700 transition">
            <div class="truncate mr-2">
              <p class="text-xs font-bold text-white truncate">${m.clientName || m.clientId}</p>
              <p class="text-[11px] text-slate-400">${m.clientId} • Volume: <span class="text-rose-400 font-semibold">₹${Number(m.volume).toLocaleString('en-IN')}</span></p>
            </div>
            <button onclick="Calling.openCallModalById('${m.clientId}')" class="px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg text-xs font-semibold transition flex items-center gap-1 shrink-0">
              <i data-lucide="phone-call" class="w-3.5 h-3.5"></i>
              <span>Call Now</span>
            </button>
          </div>
        `).join('');
      }
    }

    // Render Service Transactions Table
    const tbody = document.getElementById('service-sales-tbody');
    if (tbody) {
      if (this.filteredServiceSales.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="text-center py-8 text-slate-500 font-medium">No records found for the selected date range.</td></tr>`;
      } else {
        tbody.innerHTML = this.filteredServiceSales.map(item => `
          <tr class="hover:bg-slate-800/40 transition border-b border-slate-800/50">
            <td class="py-3 px-3.5 text-slate-300 font-mono whitespace-nowrap text-xs">${item.date || '-'}</td>
            <td class="py-3 px-3.5 font-mono text-brand-400 font-semibold text-xs whitespace-nowrap">${item.clientId || '-'}</td>
            <td class="py-3 px-3.5 font-bold text-white text-xs">${item.clientName || '-'}</td>
            <td class="py-3 px-3.5 text-slate-300 font-mono text-xs whitespace-nowrap">${item.mobile || '-'}</td>
            <td class="py-3 px-3.5 text-slate-300 text-xs">${item.parentName || '-'}</td>
            <td class="py-3 px-3.5 text-slate-400 font-mono text-xs whitespace-nowrap">${item.parentMobile || '-'}</td>
            <td class="py-3 px-3.5 text-right font-mono font-semibold text-xs">${item.txnCount || 1}</td>
            <td class="py-3 px-3.5 text-right font-mono font-bold text-white text-xs whitespace-nowrap">₹${Number(item.volume).toLocaleString('en-IN')}</td>
            <td class="py-3 px-3.5 text-center">
              <button onclick="Calling.openCallModalById('${item.clientId}')" class="px-2.5 py-1 bg-lime-500/10 hover:bg-lime-500/25 text-lime-400 hover:text-white border border-lime-500/30 rounded-lg text-xs font-semibold transition flex items-center gap-1 mx-auto">
                <i data-lucide="phone" class="w-3 h-3"></i>
                <span>Call</span>
              </button>
            </td>
          </tr>
        `).join('');
      }
    }

    if (window.lucide) lucide.createIcons();
  },

  exportCSV() {
    if (!this.filteredServiceSales || this.filteredServiceSales.length === 0) {
      Swal.fire('No Data', 'No transactions to export for current filter', 'info');
      return;
    }

    const headers = ['TransactionDateTime', 'Kiosk ID', 'Client_Name', 'ClientMobileNo', 'Parent_Name', 'Parent Mobile No', 'Service', 'TotalNumberoftransaction', 'Amount'];
    const rows = this.filteredServiceSales.map(d => [
      `"${d.date}"`,
      `"${d.clientId}"`,
      `"${(d.clientName || '').replace(/"/g, '""')}"`,
      `"${d.mobile || ''}"`,
      `"${(d.parentName || '').replace(/"/g, '""')}"`,
      `"${d.parentMobile || ''}"`,
      `"${this.currentService}"`,
      d.txnCount || 1,
      d.volume
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${this.currentService}_Sales_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};
