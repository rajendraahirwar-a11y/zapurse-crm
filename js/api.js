/**
 * ==============================================================================
 * ZAPURSE FINTECH CRM - API CLIENT & LOCAL DATA FALLBACK
 * ==============================================================================
 */

const Api = {

  /**
   * Send GET request to Apps Script Web App
   */
  async get(action, params = {}) {
    if (Config.isDemoMode()) {
      return this.handleDemoGet(action, params);
    }

    const apiUrl = Config.getApiUrl();
    const queryParams = new URLSearchParams({ action, ...params });
    const fullUrl = `${apiUrl}?${queryParams.toString()}`;

    try {
      const response = await fetch(fullUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });
      const data = await response.json();
      return data;
    } catch (err) {
      console.warn('Live API request failed:', err);
      if (Config.isDemoMode()) {
        return this.handleDemoGet(action, params);
      }
      throw err;
    }
  },

  /**
   * Send POST request to Apps Script Web App
   */
  async post(action, payload = {}) {
    if (Config.isDemoMode()) {
      return this.handleDemoPost(action, payload);
    }

    const apiUrl = Config.getApiUrl();
    const bodyData = JSON.stringify({ action, ...payload });

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8' // Standard CORS workaround for Apps Script
        },
        body: bodyData
      });
      const data = await response.json();
      return data;
    } catch (err) {
      console.warn('Live API POST failed:', err);
      if (Config.isDemoMode()) {
        return this.handleDemoPost(action, payload);
      }
      throw err;
    }
  },

  /**
   * Convert File object to Base64 data string
   */
  fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });
  },

  /* ===========================================================================
     DEMO MODE LOCAL STORAGE ENGINE (INSTANT OUT-OF-THE-BOX WORKABILITY)
     =========================================================================== */

  _getDemoDb() {
    let db = localStorage.getItem('zapurse_crm_local_db');
    if (!db) {
      db = this._seedInitialDb();
      localStorage.setItem('zapurse_crm_local_db', JSON.stringify(db));
    } else {
      try {
        db = JSON.parse(db);
      } catch (e) {
        db = this._seedInitialDb();
      }
    }
    return db;
  },

  _saveDemoDb(db) {
    localStorage.setItem('zapurse_crm_local_db', JSON.stringify(db));
  },

  _seedInitialDb() {
    const now = new Date();
    const curYear = now.getFullYear();

    const daysAgo = (d) => {
      const dt = new Date();
      dt.setDate(now.getDate() - d);
      return dt.toISOString().split('T')[0];
    };

    return {
      users: [
        { userId: 'USR001', name: 'Admin Master', username: 'admin', password: 'admin123', role: 'Admin', allowedServices: ['ALL'], allowedModules: ['ALL'], status: 'Active' },
        { userId: 'USR002', name: 'Rahul Sharma', username: 'rahul', password: 'rahul123', role: 'Manager', allowedServices: ['ALL'], allowedModules: ['DASHBOARD', 'SERVICES', 'CALLING', 'REPORTS'], status: 'Active' },
        { userId: 'USR003', name: 'Pooja Verma', username: 'pooja', password: 'pooja123', role: 'Caller', allowedServices: ['ZAPAEPS', 'ZAPUPI', 'ZAPRECHARGE'], allowedModules: ['DASHBOARD', 'CALLING'], status: 'Active' },
        { userId: 'USR004', name: 'Amit Patel', username: 'amit', password: 'amit123', role: 'Caller', allowedServices: ['RISLDMT', 'RISLUPI', 'RISLRECHARGE'], allowedModules: ['DASHBOARD', 'CALLING'], status: 'Active' }
      ],
      config: {
        maxFollowupLimit: 5,
        yearlyMinSalesCondition: 50000,
        services: [...Config.DEFAULT_SERVICES],
        dynamicQuestions: [...Config.DEFAULT_QUESTIONS]
      },
      clients: [
        { clientId: 'CL1001', clientName: 'Jai Mahaveer Telecom', mobile: '9829012345', cityState: 'Jaipur, Rajasthan', assignedUser: 'pooja', lastTxnDate: daysAgo(1), yearlySales: 1250000, followupsCount: 1, status: 'Active', primaryService: 'ZAPAEPS' },
        { clientId: 'CL1002', clientName: 'Krishna Digital Point', mobile: '9829023456', cityState: 'Kota, Rajasthan', assignedUser: 'pooja', lastTxnDate: daysAgo(5), yearlySales: 45000, followupsCount: 2, status: 'Active', primaryService: 'ZAPUPI' },
        { clientId: 'CL1003', clientName: 'Rathore E-Mitra Kendra', mobile: '9829034567', cityState: 'Jodhpur, Rajasthan', assignedUser: 'amit', lastTxnDate: daysAgo(9), yearlySales: 23000, followupsCount: 3, status: 'Active', primaryService: 'RISLDMT' },
        { clientId: 'CL1004', clientName: 'Balaji Multi Services', mobile: '9829045678', cityState: 'Udaipur, Rajasthan', assignedUser: 'amit', lastTxnDate: daysAgo(16), yearlySales: 12000, followupsCount: 4, status: 'Active', primaryService: 'RISLUPI' },
        { clientId: 'CL1005', clientName: 'Sharma Communication', mobile: '9829056789', cityState: 'Ajmer, Rajasthan', assignedUser: 'pooja', lastTxnDate: daysAgo(35), yearlySales: 89000, followupsCount: 5, status: 'Locked', primaryService: 'ZAPRECHARGE' },
        { clientId: 'CL1006', clientName: 'Gupta Online Center', mobile: '9829067890', cityState: 'Bikaner, Rajasthan', assignedUser: 'amit', lastTxnDate: daysAgo(85), yearlySales: 15000, followupsCount: 0, status: 'Active', primaryService: 'RISLRECHARGE' },
        { clientId: 'CL1007', clientName: 'Verma Tech Solutions', mobile: '9829078901', cityState: 'Alwar, Rajasthan', assignedUser: 'pooja', lastTxnDate: daysAgo(3), yearlySales: 340000, followupsCount: 1, status: 'Active', primaryService: 'ZAPAEPS' },
        { clientId: 'CL1008', clientName: 'Shree Ram Cyber Cafe', mobile: '9829089012', cityState: 'Sikar, Rajasthan', assignedUser: 'amit', lastTxnDate: daysAgo(12), yearlySales: 48000, followupsCount: 2, status: 'Active', primaryService: 'RISLDMT' },
        { clientId: 'CL1009', clientName: 'Aman Pay Point', mobile: '9829090123', cityState: 'Bhilwara, Rajasthan', assignedUser: 'pooja', lastTxnDate: daysAgo(22), yearlySales: 62000, followupsCount: 1, status: 'Active', primaryService: 'ZAPUPI' },
        { clientId: 'CL1010', clientName: 'Apex Banking Mitra', mobile: '9829091234', cityState: 'Sri Ganganagar, Raj', assignedUser: 'amit', lastTxnDate: daysAgo(0), yearlySales: 780000, followupsCount: 0, status: 'Active', primaryService: 'RISLUPI' }
      ],
      sales: [
        { txnId: 'TXN9001', date: `${curYear}-01-15`, clientId: 'CL1001', clientName: 'Jai Mahaveer Telecom', mobile: '9829012345', serviceName: 'ZAPAEPS', txnCount: 140, volume: 450000, commission: 2250 },
        { txnId: 'TXN9002', date: `${curYear}-02-18`, clientId: 'CL1007', clientName: 'Verma Tech Solutions', mobile: '9829078901', serviceName: 'ZAPAEPS', txnCount: 85, volume: 230000, commission: 1150 },
        { txnId: 'TXN9003', date: `${curYear}-03-10`, clientId: 'CL1002', clientName: 'Krishna Digital Point', mobile: '9829023456', serviceName: 'ZAPUPI', txnCount: 210, volume: 180000, commission: 900 },
        { txnId: 'TXN9004', date: `${curYear}-04-20`, clientId: 'CL1003', clientName: 'Rathore E-Mitra Kendra', mobile: '9829034567', serviceName: 'RISLDMT', txnCount: 65, volume: 320000, commission: 1600 },
        { txnId: 'TXN9005', date: `${curYear}-05-14`, clientId: 'CL1010', clientName: 'Apex Banking Mitra', mobile: '9829091234', serviceName: 'RISLUPI', txnCount: 320, volume: 490000, commission: 2450 },
        { txnId: 'TXN9006', date: `${curYear}-06-25`, clientId: 'CL1004', clientName: 'Balaji Multi Services', mobile: '9829045678', serviceName: 'RISLUPI', txnCount: 45, volume: 95000, commission: 475 },
        { txnId: 'TXN9007', date: `${curYear}-07-08`, clientId: 'CL1005', clientName: 'Sharma Communication', mobile: '9829056789', serviceName: 'ZAPRECHARGE', txnCount: 350, volume: 75000, commission: 1875 },
        { txnId: 'TXN9008', date: `${curYear}-08-19`, clientId: 'CL1009', clientName: 'Aman Pay Point', mobile: '9829090123', serviceName: 'ZAPUPI', txnCount: 180, volume: 220000, commission: 1100 },
        { txnId: 'TXN9009', date: `${curYear}-09-11`, clientId: 'CL1008', clientName: 'Shree Ram Cyber Cafe', mobile: '9829089012', serviceName: 'RISLDMT', txnCount: 90, volume: 190000, commission: 950 },
        { txnId: 'TXN9010', date: `${curYear}-10-05`, clientId: 'CL1001', clientName: 'Jai Mahaveer Telecom', mobile: '9829012345', serviceName: 'ZAPAEPS', txnCount: 240, volume: 720000, commission: 3600 },
        { txnId: 'TXN9011', date: `${curYear}-11-01`, clientId: 'CL1006', clientName: 'Gupta Online Center', mobile: '9829067890', serviceName: 'RISLRECHARGE', txnCount: 110, volume: 42000, commission: 1050 },
        { txnId: 'TXN9012', date: `${curYear}-11-20`, clientId: 'CL1010', clientName: 'Apex Banking Mitra', mobile: '9829091234', serviceName: 'RISLUPI', txnCount: 195, volume: 290000, commission: 1450 }
      ],
      calls: [
        {
          callId: 'CAL1001',
          timestamp: new Date().toISOString(),
          clientId: 'CL1001',
          clientName: 'Jai Mahaveer Telecom',
          callerUser: 'pooja',
          callOutcome: 'Connected',
          qaResponses: {
            q1: 'Connected with Owner',
            q2: 'Server/Technical Issues',
            q3: 'Testing Spice Money',
            q4: '4 - Satisfied',
            q5: 'Will start today',
            q6: 'Portal login reset explained, committed 5 AEPS txns today.'
          },
          recordingUrl: 'https://drive.google.com',
          nextFollowup: new Date(Date.now() + 86400000).toISOString(),
          calendarEventId: 'evt_demo_101',
          notes: 'Positive response, followup set for tomorrow.'
        }
      ]
    };
  },

  handleDemoGet(action, params) {
    const db = this._getDemoDb();

    switch (action) {
      case 'ping':
        return { status: 'ONLINE', app: 'Zapurse Fintech CRM Local Demo', time: new Date().toISOString() };

      case 'getInitialData': {
        const now = new Date();
        const curYear = now.getFullYear();
        const curMonth = now.getMonth();
        let yesterday = new Date();
        yesterday.setDate(now.getDate() - 1);
        const yestStr = yesterday.toISOString().split('T')[0];

        let yesterdaySales = { volume: 0, count: 0 };
        let monthlySales = { volume: 0, count: 0 };
        let yearlySales = { volume: 0, count: 0 };

        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        let monthlyChartVolumes = new Array(12).fill(0);
        let monthlyChartTxns = new Array(12).fill(0);

        db.sales.forEach(s => {
          const d = new Date(s.date);
          const dStr = s.date;
          const vol = Number(s.volume) || 0;
          const cnt = Number(s.txnCount) || 0;

          if (d.getFullYear() === curYear) {
            yearlySales.volume += vol;
            yearlySales.count += cnt;

            const m = d.getMonth();
            monthlyChartVolumes[m] += vol;
            monthlyChartTxns[m] += cnt;

            if (m === curMonth) {
              monthlySales.volume += vol;
              monthlySales.count += cnt;
            }
          }

          if (dStr === yestStr) {
            yesterdaySales.volume += vol;
            yesterdaySales.count += cnt;
          }
        });

        // Min/Max for chart color highlighting
        let maxMonthIdx = 0, minMonthIdx = 0, maxVol = -1, minVol = Infinity;
        monthlyChartVolumes.forEach((v, idx) => {
          if (v > maxVol) { maxVol = v; maxMonthIdx = idx; }
          if (v < minVol) { minVol = v; minMonthIdx = idx; }
        });

        const chartData = monthNames.map((name, idx) => ({
          month: name,
          volume: monthlyChartVolumes[idx],
          txnCount: monthlyChartTxns[idx],
          isHighest: idx === maxMonthIdx && maxVol > 0,
          isLowest: idx === minMonthIdx && minVol < Infinity
        }));

        const lowestPerforming = [...db.clients]
          .filter(c => c.status !== 'Locked')
          .sort((a, b) => a.yearlySales - b.yearlySales)
          .slice(0, 5);

        return {
          kpis: {
            yesterday: yesterdaySales,
            monthly: monthlySales,
            yearly: yearlySales,
            todayFollowups: 2
          },
          chartData: chartData,
          lowestPerforming: lowestPerforming,
          recentSales: db.sales.slice(-10).reverse(),
          services: db.config.services,
          config: db.config
        };
      }

      case 'getClients': {
        const inactiveFilter = params.inactiveDays ? (params.inactiveDays === 'ALL' ? null : Number(params.inactiveDays)) : null;
        const includeToday = params.includeToday === 'true';
        const minYearlySales = params.minYearlySales ? Number(params.minYearlySales) : null;
        const serviceFilter = params.service || 'ALL';
        const searchQuery = params.search ? params.search.toLowerCase() : '';
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];

        let results = [];
        db.clients.forEach(c => {
          let lastDate = new Date(c.lastTxnDate);
          let isToday = c.lastTxnDate === todayStr;
          let diffDays = 0;
          if (!isNaN(lastDate.getTime())) {
            diffDays = Math.max(0, Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)));
          } else {
            diffDays = 999;
          }

          if (!includeToday && isToday) return;
          if (inactiveFilter !== null && diffDays < inactiveFilter) return;
          if (minYearlySales !== null && c.yearlySales > minYearlySales) return;
          if (serviceFilter !== 'ALL' && c.primaryService !== serviceFilter) return;

          if (searchQuery) {
            const combined = `${c.clientId} ${c.clientName} ${c.mobile} ${c.cityState}`.toLowerCase();
            if (!combined.includes(searchQuery)) return;
          }

          results.push({
            ...c,
            inactiveDays: diffDays
          });
        });

        results.sort((a, b) => b.inactiveDays - a.inactiveDays);
        return { total: results.length, clients: results };
      }

      case 'getClientHistory': {
        const client = db.clients.find(c => c.clientId === params.clientId);
        const timeline = db.calls.filter(c => c.clientId === params.clientId).reverse();
        const transactions = db.sales.filter(s => s.clientId === params.clientId).reverse();
        return { client, timeline, transactions };
      }

      case 'getAdminConfig': {
        return {
          config: db.config,
          users: db.users
        };
      }

      case 'getReports': {
        const callerStats = {};
        db.calls.forEach(c => {
          const u = c.callerUser || 'pooja';
          if (!callerStats[u]) callerStats[u] = { user: u, totalCalls: 0, connected: 0, busy: 0, rnr: 0, notInterested: 0 };
          callerStats[u].totalCalls++;
          const out = (c.callOutcome || '').toLowerCase();
          if (out.includes('connect')) callerStats[u].connected++;
          else if (out.includes('busy')) callerStats[u].busy++;
          else if (out.includes('not')) callerStats[u].notInterested++;
          else callerStats[u].rnr++;
        });

        return {
          callers: Object.values(callerStats),
          matrix: db.clients
        };
      }

      default:
        return { error: 'Unknown action' };
    }
  },

  handleDemoPost(action, payload) {
    const db = this._getDemoDb();

    switch (action) {
      case 'login': {
        const user = db.users.find(u => u.username.toLowerCase() === (payload.username || '').toLowerCase());
        if (!user) return { success: false, message: 'User not found' };
        if (user.password !== payload.password) return { success: false, message: 'Incorrect password' };
        if (user.status !== 'Active') return { success: false, message: 'Account disabled' };

        return {
          success: true,
          user: {
            userId: user.userId,
            name: user.name,
            username: user.username,
            role: user.role,
            allowedServices: user.allowedServices,
            allowedModules: user.allowedModules,
            status: user.status
          }
        };
      }

      case 'saveCallLog': {
        const callId = 'CAL' + Math.floor(100000 + Math.random() * 900000);
        const newCall = {
          callId: callId,
          timestamp: new Date().toISOString(),
          clientId: payload.clientId,
          clientName: payload.clientName,
          callerUser: payload.callerUser || 'caller',
          callOutcome: payload.callOutcome || 'Connected',
          qaResponses: payload.qaResponses || {},
          recordingUrl: payload.audioBase64 ? 'https://drive.google.com/mock-audio-recording.mp3' : '',
          nextFollowup: payload.nextFollowupDateTime || '',
          calendarEventId: payload.nextFollowupDateTime ? ('evt_cal_' + Date.now()) : '',
          notes: payload.notes || ''
        };

        db.calls.push(newCall);

        // Update Client
        const client = db.clients.find(c => c.clientId === payload.clientId);
        let newCount = 1;
        let isNowLocked = false;
        if (client) {
          client.followupsCount = (client.followupsCount || 0) + 1;
          newCount = client.followupsCount;
          if (newCount >= db.config.maxFollowupLimit) {
            client.status = 'Locked';
            isNowLocked = true;
          } else if (payload.markConverted) {
            client.status = 'Converted';
          }
        }

        this._saveDemoDb(db);

        return {
          success: true,
          callId: callId,
          newFollowupsCount: newCount,
          isLocked: isNowLocked,
          recordingUrl: newCall.recordingUrl,
          calendarEventId: newCall.calendarEventId,
          message: isNowLocked
            ? `Call logged! Client reached max limit (${db.config.maxFollowupLimit}) and is now auto-locked.`
            : 'Call recorded and scheduled successfully!'
        };
      }

      case 'saveAdminConfig': {
        if (payload.maxFollowupLimit !== undefined) db.config.maxFollowupLimit = Number(payload.maxFollowupLimit);
        if (payload.yearlyMinSalesCondition !== undefined) db.config.yearlyMinSalesCondition = Number(payload.yearlyMinSalesCondition);
        if (payload.services !== undefined) db.config.services = payload.services;
        if (payload.dynamicQuestions !== undefined) db.config.dynamicQuestions = payload.dynamicQuestions;
        this._saveDemoDb(db);
        return { success: true, message: 'Settings saved locally!' };
      }

      case 'manageUser': {
        if (payload.operation === 'create') {
          const newId = 'USR' + Math.floor(100 + Math.random() * 900);
          db.users.push({
            userId: newId,
            name: payload.name,
            username: payload.username,
            password: payload.password || '123456',
            role: payload.role || 'Caller',
            allowedServices: payload.allowedServices || ['ALL'],
            allowedModules: payload.allowedModules || ['ALL'],
            status: 'Active'
          });
          this._saveDemoDb(db);
          return { success: true, message: 'User created successfully', userId: newId };
        } else if (payload.operation === 'toggleStatus') {
          const u = db.users.find(x => x.userId === payload.userId);
          if (u) {
            u.status = u.status === 'Active' ? 'Inactive' : 'Active';
            this._saveDemoDb(db);
            return { success: true, message: `User status changed to ${u.status}` };
          }
          return { success: false, message: 'User not found' };
        }
        return { success: false, message: 'Unsupported user operation' };
      }

      default:
        return { error: 'Unknown post action' };
    }
  }
};
