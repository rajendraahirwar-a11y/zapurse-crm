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
    const inactiveDays = this.currentInactiveDays;
    const includeToday = document.getElementById('calling-include-today-toggle')?.checked ? 'true' : 'false';
    const minYearlySales = document.getElementById('calling-filter-yearly')?.value || '';
    const service = document.getElementById('calling-filter-service')?.value || 'ALL';
    const search = document.getElementById('calling-filter-search')?.value || '';

    const tbody = document.getElementById('calling-queue-tbody');
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="9" class="text-center py-8 text-slate-500">Loading filtered merchants queue...</td></tr>`;
    }

    try {
      const res = await Api.get('getClients', {
        inactiveDays,
        includeToday,
        minYearlySales,
        service,
        search
      });

      this.currentClientList = res.clients || [];
      this.renderQueue(this.currentClientList);

      // Update badge counts
      const badge = document.getElementById('calling-badge-count');
      if (badge) badge.textContent = this.currentClientList.length;

      const summary = document.getElementById('calling-queue-summary');
      if (summary) summary.textContent = `Showing ${this.currentClientList.length} merchants matching criteria.`;

    } catch (err) {
      console.error('Failed to load calling queue:', err);
    }
  },

  applyQuickFilter(days) {
    this.currentInactiveDays = days;
    document.querySelectorAll('.calling-filter-btn').forEach(btn => {
      if (btn.getAttribute('data-days') === days) {
        btn.className = 'calling-filter-btn active px-3 py-1.5 rounded-xl text-xs font-semibold bg-brand-600 text-white border border-brand-500 shadow-md shadow-brand-600/30 transition';
      } else {
        btn.className = 'calling-filter-btn px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700 transition';
      }
    });
    this.load();
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
      tbody.innerHTML = `<tr><td colspan="9" class="text-center py-8 text-slate-500">No merchants found for this filter criteria.</td></tr>`;
      return;
    }

    tbody.innerHTML = clients.map(c => {
      // Inactive badge color
      let badgeColor = 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      if (c.inactiveDays >= 30) badgeColor = 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      else if (c.inactiveDays >= 10) badgeColor = 'bg-amber-500/10 text-amber-400 border-amber-500/20';

      const isLocked = c.status === 'Locked';
      const isConverted = c.status === 'Converted';

      let statusBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Active</span>`;
      if (isLocked) {
        statusBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">Locked (${c.followupsCount})</span>`;
      } else if (isConverted) {
        statusBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">Converted</span>`;
      }

      return `
        <tr class="hover:bg-slate-800/40 transition">
          <td class="py-3 px-3.5 font-mono text-brand-400 font-semibold">${c.clientId}</td>
          <td class="py-3 px-3.5 font-bold text-white">${c.clientName}</td>
          <td class="py-3 px-3.5 text-slate-300">${c.mobile}</td>
          <td class="py-3 px-3.5 text-slate-400">${c.cityState}</td>
          <td class="py-3 px-3.5">
            <span class="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
              ${c.primaryService || 'General'}
            </span>
          </td>
          <td class="py-3 px-3.5">
            <span class="px-2 py-0.5 rounded-full text-xs font-bold border ${badgeColor}">
              ${c.inactiveDays === 999 ? 'No Txns' : `${c.inactiveDays} Days`}
            </span>
          </td>
          <td class="py-3 px-3.5 text-right font-mono font-bold text-white">
            ₹${Number(c.yearlySales || 0).toLocaleString('en-IN')}
          </td>
          <td class="py-3 px-3.5 text-center">
            ${statusBadge}
          </td>
          <td class="py-3 px-3.5 text-center">
            <button onclick="Calling.openCallModalById('${c.clientId}')" 
              class="px-3 py-1.5 ${isLocked ? 'bg-slate-800 text-slate-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/30'} rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 mx-auto">
              <i data-lucide="phone-call" class="w-3.5 h-3.5"></i>
              <span>${isLocked ? 'View' : 'Call'}</span>
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
    if (!timelineList) return;

    timelineList.innerHTML = `<p class="text-slate-500 text-center py-2">Loading past interactions...</p>`;

    try {
      const res = await Api.get('getClientHistory', { clientId });
      const timeline = res.timeline || [];

      if (timeline.length === 0) {
        timelineList.innerHTML = `<p class="text-slate-500 text-center py-2">No prior calling records found.</p>`;
        return;
      }

      timelineList.innerHTML = timeline.map(t => {
        let recordingPlayer = '';
        if (t.recordingUrl && t.recordingUrl.startsWith('http')) {
          recordingPlayer = `
            <div class="mt-2 pt-2 border-t border-slate-800/80">
              <span class="text-[10px] text-slate-400 font-bold block mb-1">Call Audio Recording:</span>
              <audio controls class="w-full h-8">
                <source src="${t.recordingUrl}" type="audio/mpeg">
                Your browser does not support audio playback.
              </audio>
            </div>
          `;
        }

        // Parse QA responses
        let qaBadges = '';
        if (t.qaResponses && typeof t.qaResponses === 'object') {
          qaBadges = Object.entries(t.qaResponses).map(([k, v]) => `
            <span class="px-2 py-0.5 bg-slate-800 text-slate-300 rounded text-[10px]">
              ${v}
            </span>
          `).join(' ');
        }

        return `
          <div class="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-1.5">
            <div class="flex items-center justify-between">
              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-500/10 text-brand-400 border border-brand-500/20">
                ${t.callOutcome || 'Connected'}
              </span>
              <span class="text-[10px] text-slate-500 font-mono">
                ${new Date(t.timestamp).toLocaleString()}
              </span>
            </div>
            <p class="text-xs text-white font-medium">${t.notes || 'Routine follow-up call'}</p>
            ${qaBadges ? `<div class="flex flex-wrap gap-1 pt-1">${qaBadges}</div>` : ''}
            ${recordingPlayer}
          </div>
        `;
      }).join('');

    } catch (err) {
      timelineList.innerHTML = `<p class="text-rose-400 text-center py-2">Failed to load history</p>`;
    }
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
    this.cachedQuestions.forEach(q => {
      const el = document.getElementById(`dyn-${q.id}`);
      if (el) qaResponses[q.id] = el.value;
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
      notes: qaResponses['q6'] || `${outcome} - Followup scheduled`
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
