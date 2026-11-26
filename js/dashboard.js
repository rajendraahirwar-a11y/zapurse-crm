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

  async load() {
    try {
      const data = await Api.get('getInitialData');
      
      // 1. Render Top 4 KPI Cards
      this.renderKPIs(data.kpis);

      // 2. Render Monthly Sales Bar Chart (Jan - Dec)
      this.cachedChartData = data.chartData || [];
      this.renderChart(this.cachedChartData);

      // 3. Render Lowest Performing Clients Alert Box
      this.renderLowestPerforming(data.lowestPerforming || []);

      // 4. Render Master Sales Table
      this.allSalesData = data.recentSales || [];
      this.populateServiceDropdowns(data.services || []);
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

    // Color coding:
    // Green (#10b981) for Highest, Red (#f43f5e) for Lowest, Blue (#0284c7) for others
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
            backgroundColor: '#0f172a',
            borderColor: '#334155',
            borderWidth: 1,
            titleColor: '#f8fafc',
            bodyColor: '#94a3b8',
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
            ticks: { color: '#94a3b8', font: { size: 11 } }
          },
          y: {
            grid: { color: '#1e293b' },
            ticks: {
              color: '#94a3b8',
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
      <div class="p-2.5 bg-slate-950/70 border border-slate-800 rounded-xl flex items-center justify-between hover:border-rose-500/30 transition">
        <div class="space-y-0.5">
          <p class="text-xs font-bold text-white flex items-center gap-1.5">
            <span>${c.clientName}</span>
            <span class="text-[10px] font-medium text-rose-400 bg-rose-500/10 px-1.5 py-0.2 rounded border border-rose-500/20">
              ₹${Number(c.yearlySales).toLocaleString('en-IN')}
            </span>
          </p>
          <p class="text-[11px] text-slate-400">
            ${c.cityState} • <span class="text-slate-300">${c.primaryService || 'General'}</span>
          </p>
        </div>
        <button onclick="Calling.openCallModalById('${c.clientId}')" class="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg text-xs font-semibold transition" title="Direct Retention Call">
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

  filterSalesTable() {
    const serviceFilter = document.getElementById('sales-filter-service').value;
    const query = (document.getElementById('sales-search-input').value || '').toLowerCase();

    this.filteredSalesData = this.allSalesData.filter(item => {
      if (serviceFilter !== 'ALL' && item.serviceName !== serviceFilter) {
        return false;
      }
      if (query) {
        const str = `${item.txnId} ${item.clientName} ${item.mobile} ${item.serviceName}`.toLowerCase();
        if (!str.includes(query)) return false;
      }
      return true;
    });

    this.currentPage = 1;
    this.renderSalesTablePage();
  },

  renderSalesTablePage() {
    const tbody = document.getElementById('master-sales-tbody');
    if (!tbody) return;

    const total = this.filteredSalesData.length;
    if (total === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center py-6 text-slate-500">No transactions match your current filters.</td></tr>`;
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
        <td class="py-3 px-3.5 text-slate-300 font-mono whitespace-nowrap">${item.date}</td>
        <td class="py-3 px-3.5 font-mono text-brand-400 font-semibold">${item.clientId}</td>
        <td class="py-3 px-3.5 font-bold text-white">${item.clientName}</td>
        <td class="py-3 px-3.5 text-slate-300 font-mono">${item.mobile || '-'}</td>
        <td class="py-3 px-3.5 text-slate-300">${item.parentName || '-'}</td>
        <td class="py-3 px-3.5 text-slate-400 font-mono">${item.parentMobile || '-'}</td>
        <td class="py-3 px-3.5">
          <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-brand-400 border border-slate-700">
            ${item.serviceName}
          </span>
        </td>
        <td class="py-3 px-3.5 text-right font-mono">${Number(item.txnCount).toLocaleString('en-IN')}</td>
        <td class="py-3 px-3.5 text-right font-mono font-bold text-white">₹${Number(item.volume).toLocaleString('en-IN')}</td>
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
    link.setAttribute('download', `Zapurse_Sales_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};
