/**
 * ==============================================================================
 * ZAPURSE FINTECH CRM - SMART CALLING ENGINE
 * ==============================================================================
 */

const Calling = {
  currentInactiveDays: '15',
  currentClientList: [],
  activeCallingClient: null,
  cachedQuestions: [],
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
      tbody.innerHTML = `<tr><td colspan="9" class="text-center py-8 text-slate-500"><i data-lucide="loader-2" class="w-5 h-5 animate-spin inline mr-2 text-brand-400"></i>Loading target calling queue...</td></tr>`;
      if (window.lucide) lucide.createIcons();
    }

    try {
      const res = await Api.get('getClients', {
        includeToday,
        service,
        search
      });

      // Update active rule display chip
      const ruleTextElem = document.getElementById('calling-active-rule-text');
      if (ruleTextElem && res.activeRule?.ruleText) {
        ruleTextElem.textContent = 'Rule: ' + res.activeRule.ruleText;
      }

      const rawClients = res.clients || [];
      this.currentClientList = rawClients.filter(c => !Config.isPaymentGatewayUser(c.clientName, c.mobile));
      this.renderQueue(this.currentClientList);

      // Update badge counts
      const badge = document.getElementById('calling-badge-count');
      if (badge) badge.textContent = this.currentClientList.length;

      const summary = document.getElementById('calling-queue-summary');
      if (summary) {
        summary.textContent = `Showing ${this.currentClientList.length} merchants matching target calling criteria.`;
      }

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

  renderQueue(clients) {
    const tbody = document.getElementById('calling-queue-tbody');
    if (!tbody) return;

    if (!clients || clients.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" class="text-center py-8 text-slate-500">No merchants matching calling criteria currently. All merchants meeting targets!</td></tr>`;
      return;
    }

    tbody.innerHTML = clients.map(c => {
      // Safe Inactive Days
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

      // Retention Reason Tag
      let reasonTag = '';
      if (c.callingTag === 'Zero Sales') {
        reasonTag = `
          <span class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30 inline-flex items-center gap-1.5 shadow-sm">
            <i data-lucide="alert-octagon" class="w-3.5 h-3.5"></i>
            <span>${c.callingReason || 'Calling Required: 0 Sales'}</span>
          </span>
        `;
      } else if (c.callingTag === 'Target Shortfall') {
        reasonTag = `
          <span class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 inline-flex items-center gap-1.5 shadow-sm">
            <i data-lucide="trending-down" class="w-3.5 h-3.5"></i>
            <span>${c.callingReason || 'Target Shortfall'}</span>
          </span>
        `;
      } else {
        reasonTag = `
          <span class="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
            ${inactiveDays === 999 ? 'No Txns' : `${inactiveDays}d Inactive`}
          </span>
        `;
      }

      return `
        <tr class="hover:bg-slate-800/40 transition">
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
          <td class="py-3 px-3.5 text-center">
            <button onclick="Calling.openCallModalById('${c.clientId}')" 
              class="px-3 py-1.5 ${isLocked ? 'bg-slate-800 text-slate-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/30'} rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 mx-auto">
              <i data-lucide="phone-call" class="w-3.5 h-3.5"></i>
              <span>${isLocked ? 'View' : 'Call Now'}</span>
            </button>
          </td>
        </tr>
      `;
    }).join('');

    if (window.lucide) lucide.createIcons();
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
