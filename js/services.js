/**
 * ==============================================================================
 * ZAPURSE FINTECH CRM - DYNAMIC SERVICES VIEW HANDLER
 * ==============================================================================
 */

const Services = {
  currentService: '',

  async openService(serviceName) {
    this.currentService = serviceName;
    App.switchView('services');

    // Update screen title badge & headers
    document.getElementById('current-screen-badge').textContent = serviceName;
    document.getElementById('service-view-title').textContent = serviceName;
    document.getElementById('service-view-subtitle').textContent = `Dedicated live monitoring & transactions matrix for ${serviceName}.`;

    try {
      const data = await Api.get('getInitialData');
      const sales = (data.recentSales || []).filter(s => s.serviceName === serviceName);
      
      // Calculate Service Totals
      let totalVol = 0;
      let totalTxns = 0;
      sales.forEach(s => {
        totalVol += Number(s.volume) || 0;
        totalTxns += Number(s.txnCount) || 0;
      });

      document.getElementById('service-view-total-vol').textContent = '₹' + totalVol.toLocaleString('en-IN');
      document.getElementById('service-view-total-txns').textContent = totalTxns.toLocaleString('en-IN');

      // Top Merchants for this Service
      const topMerchants = [...sales].sort((a, b) => b.volume - a.volume).slice(0, 5);
      const topContainer = document.getElementById('service-top-merchants');
      if (topMerchants.length === 0) {
        topContainer.innerHTML = `<div class="text-center py-4 text-slate-500 text-xs">No transactions recorded for ${serviceName} yet.</div>`;
      } else {
        topContainer.innerHTML = topMerchants.map(m => `
          <div class="p-2.5 bg-slate-950/70 border border-slate-800 rounded-xl flex items-center justify-between">
            <div>
              <p class="text-xs font-bold text-white">${m.clientName}</p>
              <p class="text-[11px] text-slate-400">${m.mobile} • ${m.txnCount} txns</p>
            </div>
            <span class="text-xs font-mono font-bold text-emerald-400">₹${Number(m.volume).toLocaleString('en-IN')}</span>
          </div>
        `).join('');
      }

      // Bottom / Inactive Merchants for this Service
      const bottomMerchants = [...sales].sort((a, b) => a.volume - b.volume).slice(0, 5);
      const bottomContainer = document.getElementById('service-bottom-merchants');
      if (bottomMerchants.length === 0) {
        bottomContainer.innerHTML = `<div class="text-center py-4 text-slate-500 text-xs">No merchants found.</div>`;
      } else {
        bottomContainer.innerHTML = bottomMerchants.map(m => `
          <div class="p-2.5 bg-slate-950/70 border border-slate-800 rounded-xl flex items-center justify-between">
            <div>
              <p class="text-xs font-bold text-white">${m.clientName}</p>
              <p class="text-[11px] text-slate-400">Volume: ₹${Number(m.volume).toLocaleString('en-IN')}</p>
            </div>
            <button onclick="Calling.openCallModalById('${m.clientId}')" class="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg text-xs font-semibold transition">
              Call Now
            </button>
          </div>
        `).join('');
      }

      // Render Service Transactions Table
      const tbody = document.getElementById('service-sales-tbody');
      if (sales.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-slate-500">No records found for ${serviceName}.</td></tr>`;
      } else {
        tbody.innerHTML = sales.map(item => `
          <tr class="hover:bg-slate-800/40 transition">
            <td class="py-3 px-3.5 font-mono text-brand-400 font-semibold">${item.txnId}</td>
            <td class="py-3 px-3.5 text-slate-400">${item.date}</td>
            <td class="py-3 px-3.5 font-bold text-white">${item.clientName}</td>
            <td class="py-3 px-3.5 text-slate-400">${item.mobile}</td>
            <td class="py-3 px-3.5 text-right font-mono">${item.txnCount}</td>
            <td class="py-3 px-3.5 text-right font-mono font-bold text-white">₹${Number(item.volume).toLocaleString('en-IN')}</td>
            <td class="py-3 px-3.5 text-center">
              <button onclick="Calling.openCallModalById('${item.clientId}')" class="px-2 py-1 bg-brand-600/20 hover:bg-brand-600 text-brand-400 hover:text-white rounded-lg text-xs font-semibold transition">
                Call
              </button>
            </td>
          </tr>
        `).join('');
      }

    } catch (err) {
      console.error('Error loading service:', err);
    }

    if (window.lucide) lucide.createIcons();
  }
};
