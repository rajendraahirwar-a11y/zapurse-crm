/**
 * ==============================================================================
 * ZAPURSE FINTECH CRM - ANALYTICS & REPORTS CONTROLLER
 * ==============================================================================
 */

const Reports = {
  cachedMatrix: [],

  async load() {
    try {
      const res = await Api.get('getReports');
      
      // 1. Render Caller Productivity Cards
      this.renderCallerProductivity(res.callers || []);

      // 2. Render Client Performance Matrix
      this.cachedMatrix = res.matrix || [];
      this.renderMatrix(this.cachedMatrix);

    } catch (err) {
      console.error('Failed to load reports:', err);
    }
  },

  renderCallerProductivity(callers) {
    const container = document.getElementById('caller-productivity-grid');
    if (!container) return;

    if (!callers || callers.length === 0) {
      container.innerHTML = `<div class="col-span-3 text-center py-6 text-slate-500 text-xs">No calling productivity records found yet.</div>`;
      return;
    }

    container.innerHTML = callers.map(c => {
      const total = c.totalCalls || 1;
      const connectRate = Math.round(((c.connected || 0) / total) * 100);

      return `
        <div class="p-4 bg-slate-950/80 border border-slate-800 rounded-xl space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="w-8 h-8 rounded-full bg-brand-600/20 text-brand-400 font-bold flex items-center justify-center text-xs">
                ${c.user.charAt(0).toUpperCase()}
              </div>
              <span class="font-bold text-white text-sm capitalize">${c.user}</span>
            </div>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              ${connectRate}% Connected
            </span>
          </div>

          <div class="grid grid-cols-3 gap-2 text-center pt-1 border-t border-slate-800/80">
            <div>
              <span class="text-[10px] uppercase text-slate-400 block font-semibold">Total Calls</span>
              <span class="text-sm font-bold text-white">${c.totalCalls}</span>
            </div>
            <div>
              <span class="text-[10px] uppercase text-slate-400 block font-semibold">Connected</span>
              <span class="text-sm font-bold text-emerald-400">${c.connected}</span>
            </div>
            <div>
              <span class="text-[10px] uppercase text-slate-400 block font-semibold">RNR / Busy</span>
              <span class="text-sm font-bold text-amber-400">${(c.busy || 0) + (c.rnr || 0)}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');
  },

  renderMatrix(matrix) {
    const tbody = document.getElementById('matrix-tbody');
    if (!tbody) return;

    if (!matrix || matrix.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center py-6 text-slate-500">No client records available.</td></tr>`;
      return;
    }

    tbody.innerHTML = matrix.map(m => {
      const followups = m.followupsCount !== undefined ? m.followupsCount : (m.followups || 0);
      const isLocked = m.status === 'Locked' || followups >= 5;

      return `
        <tr class="hover:bg-slate-800/40 transition">
          <td class="py-3 px-3.5 font-mono text-brand-400 font-semibold">${m.clientId}</td>
          <td class="py-3 px-3.5 font-bold text-white">${m.clientName}</td>
          <td class="py-3 px-3.5 text-slate-400 font-mono">${m.mobile}</td>
          <td class="py-3 px-3.5 text-slate-300 font-medium">${m.cityState || m.city || 'India'}</td>
          <td class="py-3 px-3.5 whitespace-nowrap">
            ${Config.getServiceBadgeHtml(m.primaryService || m.service || 'General')}
          </td>
          <td class="py-3 px-3.5 text-right font-mono font-bold text-white">
            ₹${Number(m.yearlySales || 0).toLocaleString('en-IN')}
          </td>
          <td class="py-3 px-3.5 text-center font-bold">
            <span class="${isLocked ? 'text-rose-400 font-extrabold' : 'text-slate-300'}">
              ${followups} / 5
            </span>
          </td>
          <td class="py-3 px-3.5 text-center">
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold ${isLocked ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}">
              ${isLocked ? 'Locked' : (m.status || 'Active')}
            </span>
          </td>
        </tr>
      `;
    }).join('');
  },

  exportReportCSV() {
    if (!this.cachedMatrix || this.cachedMatrix.length === 0) {
      Swal.fire('No Data', 'No matrix data available to export', 'info');
      return;
    }

    const headers = ['Client ID', 'Client Name', 'Mobile', 'City/State', 'Primary Service', 'Yearly Sales (INR)', 'Followups Count', 'Status'];
    const rows = this.cachedMatrix.map(m => [
      `"${m.clientId}"`,
      `"${m.clientName.replace(/"/g, '""')}"`,
      `"${m.mobile}"`,
      `"${m.cityState || m.city || ''}"`,
      `"${m.primaryService || m.service || ''}"`,
      m.yearlySales || 0,
      m.followupsCount || 0,
      `"${m.status || 'Active'}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Zapurse_Client_Matrix_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};
