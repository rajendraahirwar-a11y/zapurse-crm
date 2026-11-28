/**
 * ==============================================================================
 * ZAPURSE FINTECH CRM - DASHBOARD CONTROLLER & VISUAL ANALYTICS
 * ==============================================================================
 */

const Dashboard = {
  chartInstance: null,
  activeChartMetric: 'volume', // 'volume' | 'txns'
  cachedChartData: [],
  allSalesData: [],
  filteredSalesData: [],
  currentPage: 1,
  pageSize: 10,
  activeDateFilter: 'yesterday', // 'yesterday' (default) | 'today' | '7days' | 'custom' | 'all'
  systemYesterdayDate: '',
  systemTodayDate: '',
  customFromDate: '',
  customToDate: '',

  async load() {
    try {
      // Show loading feedback if no cache is immediately available
      const tbody = document.getElementById('sales-tbody');
      const hasCached = (Api._cache && Api._cache['getInitialData']) || sessionStorage.getItem('zap_cache_getInitialData');
      if (tbody && !hasCached) {
        tbody.innerHTML = `<tr><td colspan="10" class="text-center py-8 text-slate-400 font-medium"><i data-lucide="loader-2" class="w-4 h-4 animate-spin inline mr-2 text-brand-400"></i>Loading live sales transactions...</td></tr>`;
        if (window.lucide) lucide.createIcons();
      }

      const data = await Api.get('getInitialData');
      
      // Determine Yesterday & Today date strings
      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      this.systemTodayDate = data.kpis?.today?.date || `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

      const yDate = new Date(now);
      yDate.setDate(now.getDate() - 1);
      this.systemYesterdayDate = data.kpis?.yesterday?.date || `${yDate.getFullYear()}-${pad(yDate.getMonth() + 1)}-${pad(yDate.getDate())}`;

      // 1. Render Top 4 KPI Cards
      this.renderKPIs(data.kpis);

      // 2. Render Monthly Sales Bar Chart (Jan - Dec)
      this.cachedChartData = data.chartData || [];
      this.renderChart(this.cachedChartData);

      // 3. Render Lowest Performing Clients Alert Box
      const lowestClients = (data.lowestPerforming || []).filter(item => !Config.isPaymentGatewayUser(item.clientName, item.mobile));
      this.renderLowestPerforming(lowestClients);

      // 4. Render Master Sales Table (Skip Payment Gateway User)
      const rawSales = data.recentSales || [];
      this.allSalesData = rawSales.filter(item => !Config.isPaymentGatewayUser(item.clientName, item.mobile));

      // Auto-fallback: If yesterday date has no rows in allSalesData, use latest recorded date
      if (this.allSalesData.length > 0) {
        const hasYesterday = this.allSalesData.some(d => (d.date || '').startsWith(this.systemYesterdayDate));
        if (!hasYesterday) {
          // Sort dates descending to find latest closed date
          const dates = [...new Set(this.allSalesData.map(d => (d.date || '').substring(0, 10)).filter(Boolean))].sort().reverse();
          if (dates.length > 0) {
            this.systemYesterdayDate = dates[0];
          }
        }
      }

      this.populateServiceDropdowns(data.services || []);
      
      // Apply default date filter (Yesterday)
      this.setDateFilter('yesterday', false);
      this.filterSalesTable();

    } catch (err) {
      console.error('Failed to load dashboard:', err);
    }
  },

  renderKPIs(kpis) {
    if (!kpis) return;
    const formatRupee = (num) => '₹' + Number(num || 0).toLocaleString('en-IN');
    const formatCount = (num) => Number(num || 0).toLocaleString('en-IN');

    // Yesterday
    document.getElementById('kpi-yesterday-vol').textContent = formatRupee(kpis.yesterday?.volume);
    document.getElementById('kpi-yesterday-count').textContent = formatCount(kpis.yesterday?.count);

    // Monthly
    document.getElementById('kpi-monthly-vol').textContent = formatRupee(kpis.monthly?.volume);
    document.getElementById('kpi-monthly-count').textContent = formatCount(kpis.monthly?.count);

    // Yearly
    document.getElementById('kpi-yearly-vol').textContent = formatRupee(kpis.yearly?.volume);
    document.getElementById('kpi-yearly-count').textContent = formatCount(kpis.yearly?.count);

    // Today's Follow-ups
    document.getElementById('kpi-today-followups').textContent = formatCount(kpis.todayFollowups);
  },

  renderChart(chartData) {
    const ctx = document.getElementById('monthlySalesChart');
    if (!ctx) return;

    if (this.chartInstance) {
      this.chartInstance.destroy();
    }

    const labels = chartData.map(d => d.month);
    const dataValues = chartData.map(d => this.activeChartMetric === 'volume' ? d.volume : d.txnCount);

    const backgroundColors = chartData.map(d => {
      if (d.isHighest) return '#10b981'; // Green
      if (d.isLowest) return '#f43f5e';  // Red
      return '#0284c7';                 // Fintech Brand Blue
    });

    const borderColors = chartData.map(d => {
      if (d.isHighest) return '#059669';
      if (d.isLowest) return '#e11d48';
      return '#0369a1';
    });

    const isLight = document.documentElement.classList.contains('light');
    const gridColor = isLight ? '#e2e8f0' : '#1e293b';
    const tickColor = isLight ? '#64748b' : '#94a3b8';
    const tooltipBg = isLight ? '#ffffff' : '#0f172a';
    const tooltipBorder = isLight ? '#cbd5e1' : '#334155';
    const tooltipTitle = isLight ? '#0f172a' : '#f8fafc';
    const tooltipBody = isLight ? '#475569' : '#94a3b8';

    this.chartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: this.activeChartMetric === 'volume' ? 'Sales Volume (₹)' : 'Transaction Count',
          data: dataValues,
          backgroundColor: backgroundColors,
          borderColor: borderColors,
          borderWidth: 1.5,
          borderRadius: 6,
          barPercentage: 0.65
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: tooltipBg,
            borderColor: tooltipBorder,
            borderWidth: 1,
            titleColor: tooltipTitle,
            bodyColor: tooltipBody,
            callbacks: {
              label: (context) => {
                const item = chartData[context.dataIndex];
                const tag = item.isHighest ? ' (Highest Month ★)' : (item.isLowest ? ' (Lowest Month ⚠️)' : '');
                if (this.activeChartMetric === 'volume') {
                  return ` Volume: ₹${Number(context.raw).toLocaleString('en-IN')}${tag}`;
                } else {
                  return ` Txns: ${Number(context.raw).toLocaleString('en-IN')}${tag}`;
                }
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: tickColor, font: { size: 11 } }
          },
          y: {
            grid: { color: gridColor },
            ticks: {
              color: tickColor,
              font: { size: 11 },
              callback: (val) => {
                if (this.activeChartMetric === 'volume') {
                  return val >= 100000 ? `₹${(val / 100000).toFixed(1)}L` : `₹${val}`;
                }
                return val;
              }
            }
          }
        }
      }
    });
  },

  switchChartMetric(metric) {
    this.activeChartMetric = metric;
    const volBtn = document.getElementById('chart-toggle-vol');
    const txnsBtn = document.getElementById('chart-toggle-txns');

    if (metric === 'volume') {
      volBtn.className = 'px-2.5 py-1 text-xs rounded-lg bg-brand-600 text-white font-medium transition';
      txnsBtn.className = 'px-2.5 py-1 text-xs rounded-lg bg-slate-800 text-slate-400 hover:text-white font-medium transition';
    } else {
      txnsBtn.className = 'px-2.5 py-1 text-xs rounded-lg bg-brand-600 text-white font-medium transition';
      volBtn.className = 'px-2.5 py-1 text-xs rounded-lg bg-slate-800 text-slate-400 hover:text-white font-medium transition';
    }

    if (this.cachedChartData.length > 0) {
      this.renderChart(this.cachedChartData);
    }
  },

  renderLowestPerforming(clients) {
    const container = document.getElementById('lowest-clients-list');
    if (!container) return;

    if (!clients || clients.length === 0) {
      container.innerHTML = `<div class="text-center py-4 text-slate-500 text-xs">All merchants meet healthy volume thresholds.</div>`;
      return;
    }

    container.innerHTML = clients.map(c => `
      <div class="lowest-client-card p-2.5 rounded-xl flex items-center justify-between transition">
        <div class="space-y-0.5 truncate mr-2">
          <div class="flex items-center gap-1.5 flex-wrap">
            <span class="client-name text-xs font-bold truncate">${c.clientName}</span>
            <span class="client-sales-badge text-[10px] font-bold px-1.5 py-0.5 rounded-md">
              ₹${Number(c.yearlySales).toLocaleString('en-IN')}
            </span>
          </div>
          <p class="client-meta text-[11px]">
            ${c.cityState || 'India'} • <span class="client-service font-semibold">${c.primaryService || 'General'}</span>
          </p>
        </div>
        <button onclick="Calling.openCallModalById('${c.clientId}')" class="call-action-btn p-2 rounded-lg text-xs font-semibold shrink-0 transition" title="Direct Retention Call">
          <i data-lucide="phone" class="w-3.5 h-3.5"></i>
        </button>
      </div>
    `).join('');

    if (window.lucide) lucide.createIcons();
  },

  populateServiceDropdowns(services) {
    const sel = document.getElementById('sales-filter-service');
    if (!sel) return;

    const currentVal = sel.value;
    sel.innerHTML = `<option value="ALL">All Services</option>` +
      services.map(s => `<option value="${s}">${s}</option>`).join('');

    if (currentVal && services.includes(currentVal)) {
      sel.value = currentVal;
    }
  },

  setDateFilter(type, shouldFilter = true) {
    this.activeDateFilter = type;

    // Update pill buttons
    const pills = ['yesterday', 'today', '7days', 'all'];
    pills.forEach(p => {
      const btn = document.getElementById(`dash-pill-${p}`);
      if (btn) {
        if (p === type) {
          btn.className = 'dash-pill-btn active px-3 py-1.5 rounded-lg text-xs font-bold bg-brand-600 text-white shadow-sm transition';
        } else {
          btn.className = 'dash-pill-btn px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 transition';
        }
      }
    });

    if (shouldFilter) {
      this.filterSalesTable();
    }
  },

  applyCustomDateFilter() {
    const from = document.getElementById('dash-date-from')?.value;
    const to = document.getElementById('dash-date-to')?.value;

    if (!from && !to) {
      Swal.fire('Select Date', 'Please pick a From Date or To Date', 'info');
      return;
    }

    this.customFromDate = from || '';
    this.customToDate = to || '';
    this.activeDateFilter = 'custom';

    // Unhighlight all quick pills
    ['yesterday', 'today', '7days', 'all'].forEach(p => {
      const btn = document.getElementById(`dash-pill-${p}`);
      if (btn) {
        btn.className = 'dash-pill-btn px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 transition';
      }
    });

    this.filterSalesTable();
  },

  resetDateFilter() {
    const fromInput = document.getElementById('dash-date-from');
    const toInput = document.getElementById('dash-date-to');
    if (fromInput) fromInput.value = '';
    if (toInput) toInput.value = '';
    this.customFromDate = '';
    this.customToDate = '';
    this.setDateFilter('yesterday', true);
  },

  filterSalesTable() {
    const serviceFilter = document.getElementById('sales-filter-service')?.value || 'ALL';
    const query = (document.getElementById('sales-search-input')?.value || '').toLowerCase().trim();

    // Calculate 7 days ago string
    const now = new Date();
    const d7 = new Date(now);
    d7.setDate(now.getDate() - 7);
    const pad = (n) => String(n).padStart(2, '0');
    const d7Str = `${d7.getFullYear()}-${pad(d7.getMonth() + 1)}-${pad(d7.getDate())}`;

    this.filteredSalesData = this.allSalesData.filter(item => {
      const itemDate = (item.date || '').substring(0, 10);

      // 1. Date Filter
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

      // 2. Service Filter
      if (serviceFilter !== 'ALL' && item.serviceName !== serviceFilter) {
        return false;
      }

      // 3. Search query
      if (query) {
        const str = `${item.txnId || ''} ${item.clientId || ''} ${item.clientName || ''} ${item.mobile || ''} ${item.parentName || ''} ${item.parentMobile || ''} ${item.serviceName || ''}`.toLowerCase();
        if (!str.includes(query)) return false;
      }

      return true;
    });

    // Update summary badge on header
    const summaryBadge = document.getElementById('sales-date-badge');
    if (summaryBadge) {
      let label = 'Yesterday';
      if (this.activeDateFilter === 'yesterday') label = `Yesterday (${this.systemYesterdayDate || 'Closed Day'})`;
      else if (this.activeDateFilter === 'today') label = `Today (${this.systemTodayDate})`;
      else if (this.activeDateFilter === '7days') label = 'Last 7 Days';
      else if (this.activeDateFilter === 'custom') label = `Custom: ${this.customFromDate || 'Start'} to ${this.customToDate || 'End'}`;
      else if (this.activeDateFilter === 'all') label = 'All Recorded Dates';

      let totalAmt = 0;
      this.filteredSalesData.forEach(d => { totalAmt += Number(d.volume) || 0; });
      summaryBadge.innerHTML = `<span>${label}</span> <span class="font-normal opacity-80">• ${this.filteredSalesData.length} records • ₹${totalAmt.toLocaleString('en-IN')}</span>`;
    }

    this.currentPage = 1;
    this.renderSalesTablePage();
  },

  renderSalesTablePage() {
    const tbody = document.getElementById('master-sales-tbody');
    if (!tbody) return;

    const total = this.filteredSalesData.length;
    if (total === 0) {
      tbody.innerHTML = `<tr><td colspan="10" class="text-center py-8 text-slate-500 font-medium">No transactions found for the selected date filter.</td></tr>`;
      document.getElementById('sales-pagination-info').textContent = 'Showing 0 of 0';
      document.getElementById('sales-prev-btn').disabled = true;
      document.getElementById('sales-next-btn').disabled = true;
      return;
    }

    const start = (this.currentPage - 1) * this.pageSize;
    const end = Math.min(start + this.pageSize, total);
    const pageItems = this.filteredSalesData.slice(start, end);

    tbody.innerHTML = pageItems.map(item => `
      <tr class="hover:bg-slate-800/40 transition">
        <td class="py-3 px-3.5 text-slate-300 font-mono whitespace-nowrap text-xs">${item.date}</td>
        <td class="py-3 px-3.5 font-mono text-brand-400 font-semibold text-xs whitespace-nowrap">${item.clientId || '-'}</td>
        <td class="py-3 px-3.5 font-bold text-white text-xs">${item.clientName || '-'}</td>
        <td class="py-3 px-3.5 text-slate-300 font-mono text-xs whitespace-nowrap">${item.mobile || '-'}</td>
        <td class="py-3 px-3.5 text-slate-300 text-xs">${item.parentName || '-'}</td>
        <td class="py-3 px-3.5 text-slate-400 font-mono text-xs whitespace-nowrap">${item.parentMobile || '-'}</td>
        <td class="py-3 px-3.5 whitespace-nowrap">
          ${Config.getServiceBadgeHtml(item.serviceName)}
        </td>
        <td class="py-3 px-3.5 text-right font-mono font-semibold text-xs">${Number(item.txnCount || 1).toLocaleString('en-IN')}</td>
        <td class="py-3 px-3.5 text-right font-mono font-bold text-white text-xs whitespace-nowrap">₹${Number(item.volume).toLocaleString('en-IN')}</td>
        <td class="py-3 px-3.5 text-center">
          <button onclick="Calling.openCallModalById('${item.clientId}')" class="px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/30 rounded-lg text-xs font-semibold transition flex items-center gap-1 mx-auto" title="Call Merchant">
            <i data-lucide="phone" class="w-3 h-3"></i>
            <span>Call</span>
          </button>
        </td>
      </tr>
    `).join('');

    document.getElementById('sales-pagination-info').textContent = `Showing ${start + 1}-${end} of ${total}`;
    document.getElementById('sales-prev-btn').disabled = this.currentPage <= 1;
    document.getElementById('sales-next-btn').disabled = end >= total;

    if (window.lucide) lucide.createIcons();
  },

  changePageSize(val) {
    this.pageSize = Number(val);
    this.currentPage = 1;
    this.renderSalesTablePage();
  },

  prevPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.renderSalesTablePage();
    }
  },

  nextPage() {
    if ((this.currentPage * this.pageSize) < this.filteredSalesData.length) {
      this.currentPage++;
      this.renderSalesTablePage();
    }
  },

  exportSalesCSV() {
    if (!this.filteredSalesData || this.filteredSalesData.length === 0) {
      Swal.fire('No Data', 'No transactions to export', 'info');
      return;
    }

    const headers = ['TransactionDateTime', 'Kiosk ID', 'Client_Name', 'ClientMobileNo', 'Parent_Name', 'Parent Mobile No', 'Service', 'TotalNumberoftransaction', 'Amount'];
    const rows = this.filteredSalesData.map(d => [
      `"${d.date}"`,
      `"${d.clientId}"`,
      `"${(d.clientName || '').replace(/"/g, '""')}"`,
      `"${d.mobile || ''}"`,
      `"${(d.parentName || '').replace(/"/g, '""')}"`,
      `"${d.parentMobile || ''}"`,
      `"${d.serviceName}"`,
      d.txnCount,
      d.volume
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Zapurse_Sales_${this.activeDateFilter}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};
