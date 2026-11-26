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
    const badge = document.getElementById('current-screen-badge');
    if (badge) badge.textContent = serviceName;
    const title = document.getElementById('service-view-title');
    if (title) title.textContent = serviceName;
    const subtitle = document.getElementById('service-view-subtitle');
    if (subtitle) subtitle.textContent = `Dedicated live monitoring & transactions matrix for ${serviceName}.`;

    // Show loading state
    const volElem = document.getElementById('service-view-total-vol');
    const txnsElem = document.getElementById('service-view-total-txns');
    const tbody = document.getElementById('service-sales-tbody');
    const topContainer = document.getElementById('service-top-merchants');
    const bottomContainer = document.getElementById('service-bottom-merchants');

    if (volElem) volElem.textContent = 'Loading...';
    if (txnsElem) txnsElem.textContent = 'Loading...';
    if (tbody) tbody.innerHTML = `<tr><td colspan="9" class="text-center py-8 text-slate-400 font-medium"><i data-lucide="loader-2" class="w-5 h-5 animate-spin inline mr-2 text-brand-400"></i>Loading live ${serviceName} transactions from Google Sheets...</td></tr>`;
    if (window.lucide) lucide.createIcons();

    try {
      let data = await Api.get('getServiceData', { service: serviceName });

      // Fallback if Apps Script is still running previous version
      if (!data || data.totalVolume === undefined) {
        console.warn('getServiceData returned empty, trying fallback to getInitialData');
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
          topMerchants: [...filtered].sort((a, b) => b.volume - a.volume).slice(0, 5),
          bottomMerchants: [...filtered].sort((a, b) => a.volume - b.volume).slice(0, 5),
          transactions: filtered
        };
      }

      // Filter out internal Payment Gateway user
      const sales = (data.transactions || []).filter(item => !Config.isPaymentGatewayUser(item.clientName, item.mobile));
      const topMerchants = (data.topMerchants || []).filter(item => !Config.isPaymentGatewayUser(item.clientName, item.mobile));
      const bottomMerchants = (data.bottomMerchants || []).filter(item => !Config.isPaymentGatewayUser(item.clientName, item.mobile));

      let totalVol = data.totalVolume || 0;
      let totalTxns = data.totalTxnCount || 0;
      // Recompute if un-skipped payment gateway user was in aggregated totals
      if (sales.length !== (data.transactions || []).length) {
        totalVol = 0;
        totalTxns = 0;
        sales.forEach(s => { totalVol += Number(s.volume) || 0; totalTxns += Number(s.txnCount) || 0; });
      }

      if (volElem) volElem.textContent = '₹' + totalVol.toLocaleString('en-IN');
      if (txnsElem) txnsElem.textContent = totalTxns.toLocaleString('en-IN');

      // Top Merchants for this Service
      if (topContainer) {
        if (topMerchants.length === 0) {
          topContainer.innerHTML = `<div class="text-center py-6 text-slate-500 text-xs font-medium">No transactions recorded for ${serviceName} yet.</div>`;
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

      // Bottom / Inactive Merchants for this Service
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

      // Render Service Transactions Table (With All 10 Columns)
      if (tbody) {
        if (sales.length === 0) {
          tbody.innerHTML = `<tr><td colspan="9" class="text-center py-8 text-slate-500 font-medium">No records found for ${serviceName}.</td></tr>`;
        } else {
          tbody.innerHTML = sales.map(item => `
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

    } catch (err) {
      console.error('Error loading service:', err);
      if (volElem) volElem.textContent = 'Error';
      if (txnsElem) txnsElem.textContent = 'Error';
      if (tbody) tbody.innerHTML = `<tr><td colspan="9" class="text-center py-6 text-rose-400 font-medium">Failed to load ${serviceName} data. Check network or deploy updated backend.</td></tr>`;
    }

    if (window.lucide) lucide.createIcons();
  }
};
