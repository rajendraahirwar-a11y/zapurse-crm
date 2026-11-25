/**
 * ==============================================================================
 * ZAPURSE FINTECH CRM - MASTER BACKEND (Google Apps Script)
 * ==============================================================================
 * Architecture:
 * - Google Sheets: Relational Database Storage
 * - Google Drive: Audio Call Recordings Storage Folder ("Zapurse_Call_Recordings")
 * - Google Calendar: Automatic Follow-up Reminders & Alerts
 * - REST API Endpoints: doGet & doPost supporting JSON payloads & CORS
 * ==============================================================================
 */

// Global Sheet Names
const TABS = {
  USERS: 'Users',
  SALES: 'Sales_Data',
  CLIENTS: 'Clients_Master',
  CALLS: 'Calling_Logs',
  CONFIG: 'Admin_Config',
  SYNC_LOGS: 'API_Sync_Logs'
};

/**
 * ------------------------------------------------------------------------------
 * 1. DATABASE INITIALIZATION & SEEDING FUNCTION
 * Run this function once from the Apps Script editor to create all sheets,
 * headers, default admin credentials, and initial demo data.
 * ------------------------------------------------------------------------------
 */
function setupDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Users Sheet
  let usersSheet = getOrCreateSheet(ss, TABS.USERS);
  if (usersSheet.getLastRow() === 0) {
    usersSheet.appendRow(['UserID', 'Name', 'Username', 'Password', 'Role', 'Allowed_Services', 'Allowed_Modules', 'Status', 'Created_At']);
    usersSheet.getRange(1, 1, 1, 9).setFontWeight('bold').setBackground('#1e293b').setFontColor('#ffffff');
    
    // Default Users
    usersSheet.appendRow(['USR001', 'Admin Master', 'admin', 'admin123', 'Admin', 'ALL', 'ALL', 'Active', new Date()]);
    usersSheet.appendRow(['USR002', 'Rahul Sharma', 'rahul', 'rahul123', 'Manager', 'ALL', 'DASHBOARD,SERVICES,CALLING,REPORTS', 'Active', new Date()]);
    usersSheet.appendRow(['USR003', 'Pooja Verma', 'pooja', 'pooja123', 'Caller', 'ZAP AEPS,ZAPUPI,ZAPRECHARGE', 'DASHBOARD,CALLING', 'Active', new Date()]);
    usersSheet.appendRow(['USR004', 'Amit Patel', 'amit', 'amit123', 'Caller', 'RISLDMT,RISLUPI,RISL RECHARGE', 'DASHBOARD,CALLING', 'Active', new Date()]);
  }

  // 2. Admin_Config Sheet
  let configSheet = getOrCreateSheet(ss, TABS.CONFIG);
  if (configSheet.getLastRow() === 0) {
    configSheet.appendRow(['Key', 'Value', 'Description', 'Updated_At']);
    configSheet.getRange(1, 1, 1, 4).setFontWeight('bold').setBackground('#1e293b').setFontColor('#ffffff');
    
    configSheet.appendRow(['Max_Followup_Limit', '5', 'Max calls allowed per client before auto-locking', new Date()]);
    configSheet.appendRow(['Yearly_Min_Sales_Condition', '50000', 'Minimum yearly sales threshold in Rupees', new Date()]);
    configSheet.appendRow(['Services_List', JSON.stringify(['ZAP AEPS', 'ZAPRECHARGE', 'ZAPUPI', 'RISLDMT', 'RISLUPI', 'RISL RECHARGE']), 'Active Services list', new Date()]);
    
    const sampleQuestions = [
      { id: 'q1', text: 'Call Connect Status', type: 'select', options: ['Connected with Owner', 'Connected with Staff', 'Call Later', 'Wrong Number'] },
      { id: 'q2', text: 'Reason for Drop in Transactions', type: 'select', options: ['Server/Technical Issues', 'Margin/Commission Issue', 'Switched to Competitor', 'Low Customer Footfall', 'Banking Portal Blocked', 'Other'] },
      { id: 'q3', text: 'Competitor Portal (If applicable)', type: 'text', placeholder: 'e.g. Spice Money, PayNearby, RNFI' },
      { id: 'q4', text: 'Customer Satisfaction Rating', type: 'select', options: ['5 - Highly Satisfied', '4 - Satisfied', '3 - Neutral', '2 - Dissatisfied', '1 - Very Unhappy'] },
      { id: 'q5', text: 'Commitment for Next Txn', type: 'select', options: ['Will start today', 'Within 2-3 days', 'Next week', 'Not interested'] },
      { id: 'q6', text: 'Specific Remarks / Feedback', type: 'textarea', placeholder: 'Detailed call summary...' }
    ];
    configSheet.appendRow(['Dynamic_Questions', JSON.stringify(sampleQuestions), 'Dynamic caller questionnaire form', new Date()]);
    configSheet.appendRow(['Drive_Folder_Name', 'Zapurse_Call_Recordings', 'Google Drive folder name for audio uploads', new Date()]);
  }

  // 3. Clients_Master Sheet
  let clientsSheet = getOrCreateSheet(ss, TABS.CLIENTS);
  if (clientsSheet.getLastRow() === 0) {
    clientsSheet.appendRow(['Client_ID', 'Client_Name', 'Mobile', 'City_State', 'Assigned_User', 'Last_Txn_Date', 'Yearly_Sales', 'Total_Followups_Count', 'Lead_Status', 'Primary_Service', 'Created_At']);
    clientsSheet.getRange(1, 1, 1, 11).setFontWeight('bold').setBackground('#1e293b').setFontColor('#ffffff');
    
    // Seed sample clients across different activity buckets (today, 5 days ago, 12 days ago, 25 days ago, 45 days ago)
    const today = new Date();
    const daysAgo = (d) => {
      let dt = new Date();
      dt.setDate(today.getDate() - d);
      return Utilities.formatDate(dt, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    };

    const sampleClients = [
      ['CL1001', 'Jai Mahaveer Telecom', '9829012345', 'Jaipur, Rajasthan', 'pooja', daysAgo(1), 1250000, 1, 'Active', 'ZAP AEPS'],
      ['CL1002', 'Krishna Digital Point', '9829023456', 'Kota, Rajasthan', 'pooja', daysAgo(5), 45000, 2, 'Active', 'ZAPUPI'],
      ['CL1003', 'Rathore E-Mitra Kendra', '9829034567', 'Jodhpur, Rajasthan', 'amit', daysAgo(9), 23000, 3, 'Active', 'RISLDMT'],
      ['CL1004', 'Balaji Multi Services', '9829045678', 'Udaipur, Rajasthan', 'amit', daysAgo(16), 12000, 4, 'Active', 'RISLUPI'],
      ['CL1005', 'Sharma Communication', '9829056789', 'Ajmer, Rajasthan', 'pooja', daysAgo(35), 89000, 5, 'Locked', 'ZAPRECHARGE'],
      ['CL1006', 'Gupta Online Center', '9829067890', 'Bikaner, Rajasthan', 'amit', daysAgo(85), 15000, 0, 'Active', 'RISL RECHARGE'],
      ['CL1007', 'Verma Tech Solutions', '9829078901', 'Alwar, Rajasthan', 'pooja', daysAgo(3), 340000, 1, 'Active', 'ZAP AEPS'],
      ['CL1008', 'Shree Ram Cyber Cafe', '9829089012', 'Sikar, Rajasthan', 'amit', daysAgo(12), 48000, 2, 'Active', 'RISLDMT'],
      ['CL1009', 'Aman Pay Point', '9829090123', 'Bhilwara, Rajasthan', 'pooja', daysAgo(22), 62000, 1, 'Active', 'ZAPUPI'],
      ['CL1010', 'Apex Banking Mitra', '9829091234', 'Sri Ganganagar, Raj', 'amit', daysAgo(0), 780000, 0, 'Active', 'RISLUPI']
    ];

    sampleClients.forEach(c => clientsSheet.appendRow([...c, new Date()]));
  }

  // 4. Sales_Data Sheet
  let salesSheet = getOrCreateSheet(ss, TABS.SALES);
  if (salesSheet.getLastRow() === 0) {
    salesSheet.appendRow(['Txn_ID', 'Date', 'Client_ID', 'Client_Name', 'Mobile', 'Service_Name', 'Txn_Count', 'Volume_Amount', 'Commission_Revenue', 'Sync_Timestamp']);
    salesSheet.getRange(1, 1, 1, 10).setFontWeight('bold').setBackground('#1e293b').setFontColor('#ffffff');

    // Generate recent sales
    const services = ['ZAP AEPS', 'ZAPRECHARGE', 'ZAPUPI', 'RISLDMT', 'RISLUPI', 'RISL RECHARGE'];
    let curYear = new Date().getFullYear();
    
    // Sample monthly spread
    const demoSales = [
      ['TXN9001', curYear + '-01-15', 'CL1001', 'Jai Mahaveer Telecom', '9829012345', 'ZAP AEPS', 140, 450000, 2250, new Date()],
      ['TXN9002', curYear + '-02-18', 'CL1007', 'Verma Tech Solutions', '9829078901', 'ZAP AEPS', 85, 230000, 1150, new Date()],
      ['TXN9003', curYear + '-03-10', 'CL1002', 'Krishna Digital Point', '9829023456', 'ZAPUPI', 210, 180000, 900, new Date()],
      ['TXN9004', curYear + '-04-20', 'CL1003', 'Rathore E-Mitra Kendra', '9829034567', 'RISLDMT', 65, 320000, 1600, new Date()],
      ['TXN9005', curYear + '-05-14', 'CL1010', 'Apex Banking Mitra', '9829091234', 'RISLUPI', 320, 490000, 2450, new Date()],
      ['TXN9006', curYear + '-06-25', 'CL1004', 'Balaji Multi Services', '9829045678', 'RISLUPI', 45, 95000, 475, new Date()],
      ['TXN9007', curYear + '-07-08', 'CL1005', 'Sharma Communication', '9829056789', 'ZAPRECHARGE', 350, 75000, 1875, new Date()],
      ['TXN9008', curYear + '-08-19', 'CL1009', 'Aman Pay Point', '9829090123', 'ZAPUPI', 180, 220000, 1100, new Date()],
      ['TXN9009', curYear + '-09-11', 'CL1008', 'Shree Ram Cyber Cafe', '9829089012', 'RISLDMT', 90, 190000, 950, new Date()],
      ['TXN9010', curYear + '-10-05', 'CL1001', 'Jai Mahaveer Telecom', '9829012345', 'ZAP AEPS', 240, 720000, 3600, new Date()],
      ['TXN9011', curYear + '-11-01', 'CL1006', 'Gupta Online Center', '9829067890', 'RISL RECHARGE', 110, 42000, 1050, new Date()],
      ['TXN9012', curYear + '-11-20', 'CL1010', 'Apex Banking Mitra', '9829091234', 'RISLUPI', 195, 290000, 1450, new Date()]
    ];
    demoSales.forEach(s => salesSheet.appendRow(s));
  }

  // 5. Calling_Logs Sheet
  let callSheet = getOrCreateSheet(ss, TABS.CALLS);
  if (callSheet.getLastRow() === 0) {
    callSheet.appendRow(['Call_ID', 'Timestamp', 'Client_ID', 'Client_Name', 'Caller_User', 'Call_Outcome', 'QA_Responses', 'Recording_Drive_URL', 'Next_Followup_DateTime', 'Calendar_Event_ID', 'Notes']);
    callSheet.getRange(1, 1, 1, 11).setFontWeight('bold').setBackground('#1e293b').setFontColor('#ffffff');
    
    // Sample calling logs
    const sampleQA = JSON.stringify({
      q1: 'Connected with Owner',
      q2: 'Server/Technical Issues',
      q3: 'Testing Spice Money',
      q4: '4 - Satisfied',
      q5: 'Will start today',
      q6: 'Portal login reset explained, committed 5 AEPS txns today.'
    });

    callSheet.appendRow([
      'CAL1001',
      new Date(),
      'CL1001',
      'Jai Mahaveer Telecom',
      'pooja',
      'Connected',
      sampleQA,
      'https://drive.google.com',
      new Date(Date.now() + 86400000).toISOString(),
      'evt_demo_101',
      'Positive response, followup set for tomorrow.'
    ]);
  }

  // 6. API_Sync_Logs Sheet
  let syncSheet = getOrCreateSheet(ss, TABS.SYNC_LOGS);
  if (syncSheet.getLastRow() === 0) {
    syncSheet.appendRow(['Sync_ID', 'Timestamp', 'Status', 'Records_Fetched', 'Message']);
    syncSheet.getRange(1, 1, 1, 5).setFontWeight('bold').setBackground('#1e293b').setFontColor('#ffffff');
    syncSheet.appendRow(['SYNC1001', new Date(), 'SUCCESS', 12, 'Initial database setup and demo seed completed.']);
  }

  return { success: true, message: 'Zapurse CRM Database initialized successfully with all 6 tabs!' };
}

function getOrCreateSheet(ss, name) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  return sheet;
}

/**
 * ------------------------------------------------------------------------------
 * 2. REST API: doGet HANDLER
 * Handles read operations from GitHub Pages frontend
 * ------------------------------------------------------------------------------
 */
function doGet(e) {
  try {
    const params = e && e.parameter ? e.parameter : {};
    const action = params.action || 'ping';

    let responseData = {};

    switch (action) {
      case 'ping':
        responseData = { status: 'ONLINE', app: 'Zapurse Fintech CRM API', time: new Date().toISOString() };
        break;

      case 'getInitialData':
        responseData = getInitialDataHandler(params);
        break;

      case 'getClients':
        responseData = getClientsHandler(params);
        break;

      case 'getClientHistory':
        responseData = getClientHistoryHandler(params.clientId);
        break;

      case 'getAdminConfig':
        responseData = getAdminConfigHandler();
        break;

      case 'getReports':
        responseData = getReportsHandler(params);
        break;

      case 'syncExternalSalesAPI':
        responseData = syncExternalSalesAPIHandler();
        break;

      default:
        responseData = { error: 'Unknown action: ' + action };
        break;
    }

    return createJsonResponse(responseData);
  } catch (err) {
    return createJsonResponse({ error: err.message, stack: err.stack });
  }
}

/**
 * ------------------------------------------------------------------------------
 * 3. REST API: doPost HANDLER
 * Handles write/update operations from GitHub Pages frontend
 * ------------------------------------------------------------------------------
 */
function doPost(e) {
  try {
    let payload = {};
    if (e.postData && e.postData.contents) {
      try {
        payload = JSON.parse(e.postData.contents);
      } catch (ex) {
        payload = e.parameter || {};
      }
    } else if (e.parameter) {
      payload = e.parameter;
    }

    const action = payload.action;
    let responseData = {};

    switch (action) {
      case 'login':
        responseData = loginHandler(payload.username, payload.password);
        break;

      case 'saveCallLog':
        responseData = saveCallLogHandler(payload);
        break;

      case 'saveAdminConfig':
        responseData = saveAdminConfigHandler(payload);
        break;

      case 'manageUser':
        responseData = manageUserHandler(payload);
        break;

      case 'importSalesData':
        responseData = importSalesDataHandler(payload.salesList);
        break;

      case 'initDb':
        responseData = setupDatabase();
        break;

      default:
        responseData = { error: 'Invalid or missing action in POST payload' };
        break;
    }

    return createJsonResponse(responseData);
  } catch (err) {
    return createJsonResponse({ error: err.message, stack: err.stack });
  }
}

/**
 * Standard CORS JSON Response
 */
function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * ------------------------------------------------------------------------------
 * 4. HANDLERS IMPLEMENTATION
 * ------------------------------------------------------------------------------
 */

// A. Login Handler
function loginHandler(username, password) {
  if (!username || !password) {
    return { success: false, message: 'Username and password are required' };
  }
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(TABS.USERS);
  if (!sheet) return { success: false, message: 'Database not initialized. Run setupDatabase().' };

  const data = sheet.getDataRange().getValues();
  // Columns: UserID(0), Name(1), Username(2), Password(3), Role(4), Allowed_Services(5), Allowed_Modules(6), Status(7)
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (String(row[2]).trim().toLowerCase() === String(username).trim().toLowerCase()) {
      if (String(row[3]) === String(password)) {
        if (String(row[7]).toLowerCase() !== 'active') {
          return { success: false, message: 'User account is inactive or disabled' };
        }
        return {
          success: true,
          user: {
            userId: row[0],
            name: row[1],
            username: row[2],
            role: row[4],
            allowedServices: String(row[5]).split(',').map(s => s.trim()),
            allowedModules: String(row[6]).split(',').map(m => m.trim()),
            status: row[7]
          }
        };
      } else {
        return { success: false, message: 'Incorrect password' };
      }
    }
  }
  return { success: false, message: 'User not found' };
}

// B. Initial Dashboard Data Handler
function getInitialDataHandler(params) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const salesSheet = ss.getSheetByName(TABS.SALES);
  const clientsSheet = ss.getSheetByName(TABS.CLIENTS);
  const callsSheet = ss.getSheetByName(TABS.CALLS);
  const configSheet = ss.getSheetByName(TABS.CONFIG);

  if (!salesSheet || !clientsSheet) {
    setupDatabase();
  }

  const salesData = salesSheet.getDataRange().getValues();
  const clientsData = clientsSheet.getDataRange().getValues();
  const callsData = callsSheet ? callsSheet.getDataRange().getValues() : [];
  const configData = configSheet ? configSheet.getDataRange().getValues() : [];

  // Parse Config
  let configMap = {};
  for (let i = 1; i < configData.length; i++) {
    configMap[configData[i][0]] = configData[i][1];
  }

  // Calculate Dates
  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = now.getMonth(); // 0-11
  
  let yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  const yestStr = Utilities.formatDate(yesterday, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const todayStr = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd');

  // KPI Metrics
  let yesterdaySales = { volume: 0, count: 0 };
  let monthlySales = { volume: 0, count: 0 };
  let yearlySales = { volume: 0, count: 0 };

  // Monthly Chart Array (Jan - Dec)
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  let monthlyChartVolumes = new Array(12).fill(0);
  let monthlyChartTxns = new Array(12).fill(0);

  // Parse Sales Rows: Txn_ID(0), Date(1), Client_ID(2), Client_Name(3), Mobile(4), Service_Name(5), Txn_Count(6), Volume_Amount(7), Commission_Revenue(8)
  for (let i = 1; i < salesData.length; i++) {
    const row = salesData[i];
    const txnDate = new Date(row[1]);
    const txnDateStr = Utilities.formatDate(txnDate, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    const txnCount = Number(row[6]) || 0;
    const vol = Number(row[7]) || 0;

    // Yearly
    if (txnDate.getFullYear() === curYear) {
      yearlySales.volume += vol;
      yearlySales.count += txnCount;

      // Month Chart
      const m = txnDate.getMonth();
      monthlyChartVolumes[m] += vol;
      monthlyChartTxns[m] += txnCount;

      // Current Month
      if (m === curMonth) {
        monthlySales.volume += vol;
        monthlySales.count += txnCount;
      }
    }

    // Yesterday
    if (txnDateStr === yestStr) {
      yesterdaySales.volume += vol;
      yesterdaySales.count += txnCount;
    }
  }

  // Find Min & Max month for visual color coding (Red / Green)
  let maxMonthIdx = 0;
  let minMonthIdx = 0;
  let maxVol = -1;
  let minVol = Infinity;

  monthlyChartVolumes.forEach((v, idx) => {
    if (v > maxVol) {
      maxVol = v;
      maxMonthIdx = idx;
    }
    // Consider months up to current month or non-zero
    if (idx <= curMonth && v < minVol) {
      minVol = v;
      minMonthIdx = idx;
    }
  });

  const chartData = monthNames.map((name, idx) => ({
    month: name,
    volume: monthlyChartVolumes[idx],
    txnCount: monthlyChartTxns[idx],
    isHighest: idx === maxMonthIdx && maxVol > 0,
    isLowest: idx === minMonthIdx && minVol < Infinity
  }));

  // Scheduled Calls for Today
  let todayFollowupsCount = 0;
  for (let i = 1; i < callsData.length; i++) {
    const followDate = callsData[i][8]; // Next_Followup_DateTime
    if (followDate) {
      const fd = new Date(followDate);
      if (!isNaN(fd.getTime())) {
        const fdStr = Utilities.formatDate(fd, Session.getScriptTimeZone(), 'yyyy-MM-dd');
        if (fdStr === todayStr) {
          todayFollowupsCount++;
        }
      }
    }
  }

  // Lowest Performing Clients (Bottom 5 by Yearly Sales or Active but 0 recent txns)
  let clientList = [];
  // Columns: Client_ID(0), Client_Name(1), Mobile(2), City_State(3), Assigned_User(4), Last_Txn_Date(5), Yearly_Sales(6), Total_Followups_Count(7), Lead_Status(8), Primary_Service(9)
  for (let i = 1; i < clientsData.length; i++) {
    const row = clientsData[i];
    clientList.push({
      clientId: row[0],
      clientName: row[1],
      mobile: row[2],
      cityState: row[3],
      assignedUser: row[4],
      lastTxnDate: row[5] instanceof Date ? Utilities.formatDate(row[5], Session.getScriptTimeZone(), 'yyyy-MM-dd') : String(row[5]),
      yearlySales: Number(row[6]) || 0,
      followupsCount: Number(row[7]) || 0,
      status: row[8],
      primaryService: row[9] || 'General'
    });
  }

  // Sort lowest performing clients (lowest yearly sales first)
  const lowestPerforming = [...clientList]
    .filter(c => c.status !== 'Locked')
    .sort((a, b) => a.yearlySales - b.yearlySales)
    .slice(0, 5);

  // Recent 10 Transactions
  const recentSales = salesData.slice(1).slice(-10).reverse().map(r => ({
    txnId: r[0],
    date: r[1] instanceof Date ? Utilities.formatDate(r[1], Session.getScriptTimeZone(), 'yyyy-MM-dd') : String(r[1]),
    clientId: r[2],
    clientName: r[3],
    mobile: r[4],
    serviceName: r[5],
    txnCount: r[6],
    volume: r[7],
    commission: r[8]
  }));

  // Services list
  let services = ['ZAP AEPS', 'ZAPRECHARGE', 'ZAPUPI', 'RISLDMT', 'RISLUPI', 'RISL RECHARGE'];
  if (configMap['Services_List']) {
    try {
      services = JSON.parse(configMap['Services_List']);
    } catch (e) {}
  }

  return {
    kpis: {
      yesterday: yesterdaySales,
      monthly: monthlySales,
      yearly: yearlySales,
      todayFollowups: todayFollowupsCount
    },
    chartData: chartData,
    lowestPerforming: lowestPerforming,
    recentSales: recentSales,
    services: services,
    config: {
      maxFollowupLimit: Number(configMap['Max_Followup_Limit']) || 5,
      yearlyMinSalesCondition: Number(configMap['Yearly_Min_Sales_Condition']) || 50000
    }
  };
}

// C. Smart Calling Engine Clients Filter Handler
function getClientsHandler(params) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(TABS.CLIENTS);
  if (!sheet) return { clients: [], total: 0 };

  const data = sheet.getDataRange().getValues();
  const now = new Date();
  const todayStr = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd');

  const inactiveFilter = params.inactiveDays ? Number(params.inactiveDays) : null; // e.g. 4, 7, 10, 15, 30, 90
  const includeToday = params.includeToday === 'true';
  const minYearlySales = params.minYearlySales ? Number(params.minYearlySales) : null;
  const serviceFilter = params.service || 'ALL';
  const searchQuery = params.search ? params.search.toLowerCase() : '';
  const statusFilter = params.status || 'ALL'; // Active / Locked / ALL

  let results = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const clientId = String(row[0]);
    const clientName = String(row[1]);
    const mobile = String(row[2]);
    const cityState = String(row[3]);
    const assignedUser = String(row[4]);
    const lastTxnDateRaw = row[5];
    const yearlySales = Number(row[6]) || 0;
    const followupsCount = Number(row[7]) || 0;
    const status = String(row[8]);
    const primaryService = String(row[9] || 'General');

    // Parse date & calculate inactivity
    let lastTxnDateObj = new Date(lastTxnDateRaw);
    let inactiveDays = 0;
    let isTodayTxn = false;

    if (!isNaN(lastTxnDateObj.getTime())) {
      const dateStr = Utilities.formatDate(lastTxnDateObj, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      if (dateStr === todayStr) {
        isTodayTxn = true;
        inactiveDays = 0;
      } else {
        const diffMs = now.getTime() - lastTxnDateObj.getTime();
        inactiveDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
      }
    } else {
      inactiveDays = 999;
    }

    // Filter: Include / Exclude today's active clients
    if (!includeToday && isTodayTxn) {
      continue;
    }

    // Filter: Inactivity Days (e.g. at least inactiveDays)
    if (inactiveFilter !== null && inactiveDays < inactiveFilter) {
      continue;
    }

    // Filter: Yearly Condition
    if (minYearlySales !== null && yearlySales > minYearlySales) {
      // If filtering for clients who did LESS than condition
      continue;
    }

    // Filter: Service
    if (serviceFilter !== 'ALL' && primaryService !== serviceFilter) {
      continue;
    }

    // Filter: Status
    if (statusFilter !== 'ALL' && status !== statusFilter) {
      continue;
    }

    // Filter: Search Query (Client ID, Name, Mobile, City)
    if (searchQuery) {
      const combined = (clientId + ' ' + clientName + ' ' + mobile + ' ' + cityState).toLowerCase();
      if (!combined.includes(searchQuery)) {
        continue;
      }
    }

    results.push({
      clientId: clientId,
      clientName: clientName,
      mobile: mobile,
      cityState: cityState,
      assignedUser: assignedUser,
      lastTxnDate: !isNaN(lastTxnDateObj.getTime()) ? Utilities.formatDate(lastTxnDateObj, Session.getScriptTimeZone(), 'yyyy-MM-dd') : 'No Record',
      inactiveDays: inactiveDays,
      yearlySales: yearlySales,
      followupsCount: followupsCount,
      status: status,
      primaryService: primaryService
    });
  }

  // Sort by inactive days descending (most inactive first)
  results.sort((a, b) => b.inactiveDays - a.inactiveDays);

  return {
    total: results.length,
    clients: results
  };
}

// D. Client Details & Timeline History Handler
function getClientHistoryHandler(clientId) {
  if (!clientId) return { error: 'clientId required' };

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const clientsSheet = ss.getSheetByName(TABS.CLIENTS);
  const callsSheet = ss.getSheetByName(TABS.CALLS);
  const salesSheet = ss.getSheetByName(TABS.SALES);

  let clientInfo = null;
  const clientsData = clientsSheet.getDataRange().getValues();
  for (let i = 1; i < clientsData.length; i++) {
    if (String(clientsData[i][0]) === String(clientId)) {
      clientInfo = {
        clientId: clientsData[i][0],
        clientName: clientsData[i][1],
        mobile: clientsData[i][2],
        cityState: clientsData[i][3],
        assignedUser: clientsData[i][4],
        lastTxnDate: clientsData[i][5] instanceof Date ? Utilities.formatDate(clientsData[i][5], Session.getScriptTimeZone(), 'yyyy-MM-dd') : String(clientsData[i][5]),
        yearlySales: Number(clientsData[i][6]) || 0,
        followupsCount: Number(clientsData[i][7]) || 0,
        status: clientsData[i][8],
        primaryService: clientsData[i][9]
      };
      break;
    }
  }

  // Calls Timeline
  let timeline = [];
  if (callsSheet) {
    const callsData = callsSheet.getDataRange().getValues();
    for (let i = 1; i < callsData.length; i++) {
      if (String(callsData[i][2]) === String(clientId)) {
        let qaParsed = {};
        try {
          qaParsed = JSON.parse(callsData[i][6]);
        } catch (e) {
          qaParsed = { raw: callsData[i][6] };
        }

        timeline.push({
          callId: callsData[i][0],
          timestamp: callsData[i][1] instanceof Date ? callsData[i][1].toISOString() : String(callsData[i][1]),
          callerUser: callsData[i][4],
          callOutcome: callsData[i][5],
          qaResponses: qaParsed,
          recordingUrl: callsData[i][7],
          nextFollowup: callsData[i][8],
          notes: callsData[i][10]
        });
      }
    }
  }

  // Sort timeline latest first
  timeline.reverse();

  // Client's Recent Transactions
  let transactions = [];
  if (salesSheet) {
    const salesData = salesSheet.getDataRange().getValues();
    for (let i = 1; i < salesData.length; i++) {
      if (String(salesData[i][2]) === String(clientId)) {
        transactions.push({
          txnId: salesData[i][0],
          date: salesData[i][1] instanceof Date ? Utilities.formatDate(salesData[i][1], Session.getScriptTimeZone(), 'yyyy-MM-dd') : String(salesData[i][1]),
          serviceName: salesData[i][5],
          txnCount: salesData[i][6],
          volume: salesData[i][7],
          commission: salesData[i][8]
        });
      }
    }
  }
  transactions.reverse();

  return {
    client: clientInfo,
    timeline: timeline,
    transactions: transactions
  };
}

// E. Save Call Log (With Audio Upload to Drive & Calendar Sync)
function saveCallLogHandler(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const callsSheet = ss.getSheetByName(TABS.CALLS);
  const clientsSheet = ss.getSheetByName(TABS.CLIENTS);
  const configSheet = ss.getSheetByName(TABS.CONFIG);

  if (!callsSheet || !clientsSheet) {
    return { success: false, message: 'CRM Sheets missing. Run setupDatabase().' };
  }

  // Fetch Config
  let maxLimit = 5;
  if (configSheet) {
    const configData = configSheet.getDataRange().getValues();
    for (let i = 1; i < configData.length; i++) {
      if (configData[i][0] === 'Max_Followup_Limit') {
        maxLimit = Number(configData[i][1]) || 5;
        break;
      }
    }
  }

  // 1. Audio Upload to Google Drive if audioBase64 exists
  let driveFileUrl = '';
  if (payload.audioBase64) {
    try {
      driveFileUrl = uploadAudioToDrive(
        payload.audioBase64,
        payload.audioFileName || ('Call_' + payload.clientId + '_' + Date.now() + '.mp3')
      );
    } catch (driveErr) {
      driveFileUrl = 'Upload Failed: ' + driveErr.message;
    }
  }

  // 2. Google Calendar Event Creation if Next_Followup_DateTime provided
  let calendarEventId = '';
  if (payload.nextFollowupDateTime) {
    try {
      calendarEventId = createCalendarReminder(
        payload.clientName || payload.clientId,
        payload.nextFollowupDateTime,
        payload.notes || 'Zapurse CRM Follow-up Call'
      );
    } catch (calErr) {
      calendarEventId = 'Cal Sync Skipped: ' + calErr.message;
    }
  }

  // 3. Insert into Calling_Logs
  const callId = 'CAL' + Math.floor(100000 + Math.random() * 900000);
  const timestamp = new Date();
  const qaJsonStr = typeof payload.qaResponses === 'object' ? JSON.stringify(payload.qaResponses) : String(payload.qaResponses || '{}');

  callsSheet.appendRow([
    callId,
    timestamp,
    payload.clientId,
    payload.clientName || '',
    payload.callerUser || 'caller',
    payload.callOutcome || 'Connected',
    qaJsonStr,
    driveFileUrl,
    payload.nextFollowupDateTime || '',
    calendarEventId,
    payload.notes || ''
  ]);

  // 4. Update Clients_Master Follow-up Count & Auto-Lock check
  let newCount = 1;
  let isNowLocked = false;
  const clientsData = clientsSheet.getDataRange().getValues();

  for (let i = 1; i < clientsData.length; i++) {
    if (String(clientsData[i][0]) === String(payload.clientId)) {
      const currentCount = Number(clientsData[i][7]) || 0;
      newCount = currentCount + 1;
      
      let newStatus = clientsData[i][8];
      if (newCount >= maxLimit) {
        newStatus = 'Locked';
        isNowLocked = true;
      } else if (payload.markConverted) {
        newStatus = 'Converted';
      }

      // Update Total_Followups_Count (Col 8, index 8 in 1-based) & Lead_Status (Col 9, index 9)
      clientsSheet.getRange(i + 1, 8).setValue(newCount);
      clientsSheet.getRange(i + 1, 9).setValue(newStatus);
      break;
    }
  }

  return {
    success: true,
    callId: callId,
    newFollowupsCount: newCount,
    isLocked: isNowLocked,
    recordingUrl: driveFileUrl,
    calendarEventId: calendarEventId,
    message: isNowLocked 
      ? 'Call logged! Client reached max followup limit (' + maxLimit + ') and is now auto-locked.' 
      : 'Call logged successfully and follow-up scheduled!'
  };
}

/**
 * Upload Base64 Audio File to Google Drive Folder
 */
function uploadAudioToDrive(base64Data, filename) {
  const folderName = 'Zapurse_Call_Recordings';
  let folder;
  const folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) {
    folder = folders.next();
  } else {
    folder = DriveApp.createFolder(folderName);
    folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  }

  // Strip data:audio/*;base64, if present
  let cleanBase64 = base64Data;
  let contentType = 'audio/mpeg';
  if (base64Data.indexOf(';base64,') > -1) {
    const parts = base64Data.split(';base64,');
    contentType = parts[0].replace('data:', '');
    cleanBase64 = parts[1];
  }

  const decodedBytes = Utilities.base64Decode(cleanBase64);
  const blob = Utilities.newBlob(decodedBytes, contentType, filename);
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  return file.getUrl();
}

/**
 * Create Follow-up Event in Google Calendar
 */
function createCalendarReminder(clientName, followupIsoString, notes) {
  const startTime = new Date(followupIsoString);
  if (isNaN(startTime.getTime())) return '';

  const endTime = new Date(startTime.getTime() + 15 * 60 * 1000); // 15 mins call slot
  const title = '📞 Zapurse Call: ' + clientName;
  const description = 'Scheduled Follow-up call.\nNotes: ' + notes;

  const cal = CalendarApp.getDefaultCalendar();
  if (cal) {
    const event = cal.createEvent(title, startTime, endTime, { description: description });
    return event.getId();
  }
  return '';
}

// F. Admin Config & Dynamic Questions Handler
function getAdminConfigHandler() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const configSheet = ss.getSheetByName(TABS.CONFIG);
  const usersSheet = ss.getSheetByName(TABS.USERS);

  let configMap = {};
  if (configSheet) {
    const data = configSheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      configMap[data[i][0]] = data[i][1];
    }
  }

  let users = [];
  if (usersSheet) {
    const uData = usersSheet.getDataRange().getValues();
    for (let i = 1; i < uData.length; i++) {
      users.push({
        userId: uData[i][0],
        name: uData[i][1],
        username: uData[i][2],
        role: uData[i][4],
        allowedServices: String(uData[i][5]).split(',').map(s => s.trim()),
        allowedModules: String(uData[i][6]).split(',').map(m => m.trim()),
        status: uData[i][7]
      });
    }
  }

  let questions = [];
  if (configMap['Dynamic_Questions']) {
    try {
      questions = JSON.parse(configMap['Dynamic_Questions']);
    } catch (e) {}
  }

  let services = ['ZAP AEPS', 'ZAPRECHARGE', 'ZAPUPI', 'RISLDMT', 'RISLUPI', 'RISL RECHARGE'];
  if (configMap['Services_List']) {
    try {
      services = JSON.parse(configMap['Services_List']);
    } catch (e) {}
  }

  return {
    config: {
      maxFollowupLimit: Number(configMap['Max_Followup_Limit']) || 5,
      yearlyMinSalesCondition: Number(configMap['Yearly_Min_Sales_Condition']) || 50000,
      services: services,
      dynamicQuestions: questions
    },
    users: users
  };
}

// G. Save Admin Configuration
function saveAdminConfigHandler(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const configSheet = ss.getSheetByName(TABS.CONFIG);
  if (!configSheet) return { success: false, message: 'Config sheet missing' };

  const data = configSheet.getDataRange().getValues();

  function updateOrInsertKey(key, value) {
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === key) {
        configSheet.getRange(i + 1, 2).setValue(value);
        configSheet.getRange(i + 1, 4).setValue(new Date());
        return;
      }
    }
    configSheet.appendRow([key, value, 'Admin updated', new Date()]);
  }

  if (payload.maxFollowupLimit !== undefined) {
    updateOrInsertKey('Max_Followup_Limit', String(payload.maxFollowupLimit));
  }
  if (payload.yearlyMinSalesCondition !== undefined) {
    updateOrInsertKey('Yearly_Min_Sales_Condition', String(payload.yearlyMinSalesCondition));
  }
  if (payload.services !== undefined) {
    updateOrInsertKey('Services_List', JSON.stringify(payload.services));
  }
  if (payload.dynamicQuestions !== undefined) {
    updateOrInsertKey('Dynamic_Questions', JSON.stringify(payload.dynamicQuestions));
  }

  return { success: true, message: 'Configuration saved successfully!' };
}

// H. User Management (Add / Update / Toggle Status)
function manageUserHandler(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(TABS.USERS);
  if (!sheet) return { success: false, message: 'Users sheet missing' };

  const data = sheet.getDataRange().getValues();
  const op = payload.operation; // 'create' | 'update' | 'toggleStatus'

  if (op === 'create') {
    // Check duplicate username
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][2]).toLowerCase() === String(payload.username).toLowerCase()) {
        return { success: false, message: 'Username already exists' };
      }
    }
    const userId = 'USR' + Math.floor(100 + Math.random() * 900);
    sheet.appendRow([
      userId,
      payload.name,
      payload.username,
      payload.password || '123456',
      payload.role || 'Caller',
      Array.isArray(payload.allowedServices) ? payload.allowedServices.join(',') : (payload.allowedServices || 'ALL'),
      Array.isArray(payload.allowedModules) ? payload.allowedModules.join(',') : (payload.allowedModules || 'ALL'),
      'Active',
      new Date()
    ]);
    return { success: true, message: 'User created successfully', userId: userId };
  }

  if (op === 'update' || op === 'toggleStatus') {
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(payload.userId)) {
        if (op === 'toggleStatus') {
          const currentStatus = String(data[i][7]);
          const newStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';
          sheet.getRange(i + 1, 8).setValue(newStatus);
          return { success: true, message: 'User status updated to ' + newStatus };
        } else {
          if (payload.name) sheet.getRange(i + 1, 2).setValue(payload.name);
          if (payload.password) sheet.getRange(i + 1, 4).setValue(payload.password);
          if (payload.role) sheet.getRange(i + 1, 5).setValue(payload.role);
          if (payload.allowedServices) {
            sheet.getRange(i + 1, 6).setValue(Array.isArray(payload.allowedServices) ? payload.allowedServices.join(',') : payload.allowedServices);
          }
          if (payload.allowedModules) {
            sheet.getRange(i + 1, 7).setValue(Array.isArray(payload.allowedModules) ? payload.allowedModules.join(',') : payload.allowedModules);
          }
          return { success: true, message: 'User details updated successfully' };
        }
      }
    }
    return { success: false, message: 'User ID not found' };
  }

  return { success: false, message: 'Invalid operation' };
}

// I. Analytics & Reports Handler (Client Matrix & Caller Productivity)
function getReportsHandler(params) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const salesSheet = ss.getSheetByName(TABS.SALES);
  const callsSheet = ss.getSheetByName(TABS.CALLS);
  const clientsSheet = ss.getSheetByName(TABS.CLIENTS);

  // 1. Caller Productivity
  let callerStats = {};
  if (callsSheet) {
    const calls = callsSheet.getDataRange().getValues();
    for (let i = 1; i < calls.length; i++) {
      const user = String(calls[i][4]) || 'Unknown';
      const outcome = String(calls[i][5]);
      if (!callerStats[user]) {
        callerStats[user] = { user: user, totalCalls: 0, connected: 0, busy: 0, rnr: 0, notInterested: 0 };
      }
      callerStats[user].totalCalls++;
      if (outcome.toLowerCase().includes('connect')) callerStats[user].connected++;
      else if (outcome.toLowerCase().includes('busy')) callerStats[user].busy++;
      else if (outcome.toLowerCase().includes('not')) callerStats[user].notInterested++;
      else callerStats[user].rnr++;
    }
  }

  // 2. Client Sales Matrix (Top 100 Clients with Monthly Volume & Service breakdown)
  let clientMatrix = [];
  if (clientsSheet) {
    const cData = clientsSheet.getDataRange().getValues();
    for (let i = 1; i < cData.length; i++) {
      clientMatrix.push({
        clientId: cData[i][0],
        clientName: cData[i][1],
        mobile: cData[i][2],
        city: cData[i][3],
        service: cData[i][9],
        yearlySales: Number(cData[i][6]) || 0,
        followupsCount: Number(cData[i][7]) || 0,
        status: cData[i][8]
      });
    }
  }

  return {
    callers: Object.values(callerStats),
    matrix: clientMatrix
  };
}

// J. Import Bulk Sales Data from External API or Webhook
function importSalesDataHandler(salesList) {
  if (!Array.isArray(salesList) || salesList.length === 0) {
    return { success: false, message: 'No sales records provided' };
  }
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(TABS.SALES);
  const clientsSheet = ss.getSheetByName(TABS.CLIENTS);

  let inserted = 0;
  salesList.forEach(s => {
    sheet.appendRow([
      s.txnId || ('TXN' + Date.now() + Math.floor(Math.random() * 100)),
      s.date || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'),
      s.clientId,
      s.clientName,
      s.mobile || '',
      s.serviceName || 'General',
      s.txnCount || 1,
      s.volume || 0,
      s.commission || 0,
      new Date()
    ]);
    inserted++;
  });

  return { success: true, message: inserted + ' sales records imported successfully!' };
}

// K. Dummy Sync Endpoint for Automated Triggers
function syncExternalSalesAPIHandler() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const syncSheet = ss.getSheetByName(TABS.SYNC_LOGS);
  const syncId = 'SYNC' + Date.now();
  
  if (syncSheet) {
    syncSheet.appendRow([syncId, new Date(), 'SUCCESS', 0, 'Manual sync triggered. Backend is up-to-date.']);
  }
  return { success: true, syncId: syncId, message: 'External API sync finished successfully.' };
}
