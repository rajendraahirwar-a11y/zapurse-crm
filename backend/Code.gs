/**
 * ==============================================================================
 * ZAPURSE FINTECH CRM - MASTER BACKEND & LIVE MIS API SYNC
 * ==============================================================================
 * Architecture:
 * - Core API: Zapurse ExportMISReportCsv (Live Postman/cURL integration)
 * - Supported Services: ZAPAEPS, ZAPUPI, ZAPRECHARGE, RISLUPI, RISLDMT, RISLRECHARGE
 * - Google Sheets: Relational Database Storage (6 Structured Tabs)
 * - Google Drive: Audio Call Recordings Storage Folder ("Zapurse_Call_Recordings")
 * - Google Calendar: Automatic Follow-up Reminders & Alerts
 * - REST API Endpoints: doGet & doPost supporting JSON payloads & CORS
 * ==============================================================================
 */

// 1. Zapurse Core API Configuration
const ZAPURSE_CONFIG = {
  API_URL: "https://zapurse.com/atishayapi/wlservices/ExportMISReportCsv",
  USERNAME: "7024219540",
  LOGIN_MOBILE: "9311555271",
  AUTHORIZATION: "basic NA",
  SERVICE_TYPES: [
    "ZAPAEPS",
    "ZAPUPI",
    "ZAPRECHARGE",
    "RISLUPI",
    "RISLDMT",
    "RISLRECHARGE"
  ]
};

// 2. Global Database Sheet Names
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
 * ON-OPEN SPREADSHEET CUSTOM MENU
 * Appears automatically inside the Google Sheet toolbar for 1-click execution!
 * ------------------------------------------------------------------------------
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('⚡ Zapurse CRM')
    .addItem('🔄 Quick Sync (Incremental / Last 30 Days)', 'menuSyncLast30Days')
    .addItem('📅 Sync Custom Date Range', 'menuSyncFullRange')
    .addSeparator()
    .addItem('🧹 Clean & Resync (Fix Dates & Duplicates)', 'menuCleanAndResync')
    .addItem('🛠️ Initialize / Reset Database Tabs', 'setupDatabase')
    .addItem('⏰ Setup Automatic Daily Sync Trigger (Nightly 2 AM)', 'setupDailySyncTrigger')
    .addToUi();
}

function menuSyncLast30Days() {
  const now = new Date();
  const past30 = new Date();
  past30.setDate(now.getDate() - 30);

  const fromStr = Utilities.formatDate(past30, 'Asia/Kolkata', 'dd-MM-yyyy');
  const toStr = Utilities.formatDate(now, 'Asia/Kolkata', 'dd-MM-yyyy');

  SpreadsheetApp.getActiveSpreadsheet().toast('Starting Zapurse API Sync for all 6 services...', 'Syncing', 5);
  const result = syncAllZapurseServices(fromStr, toStr);

  SpreadsheetApp.getUi().alert(
    `Sync Completed!\n\n` +
    `• Total Transactions Processed: ${result.totalRowsProcessed}\n` +
    `• New Records Added: ${result.recordsAdded}\n` +
    `• Clients In Master: ${result.clientsCount}\n` +
    `• Status: ${result.success ? 'SUCCESS' : 'PARTIAL ERROR'}`
  );
}

function menuSyncFullRange() {
  const ui = SpreadsheetApp.getUi();
  const fromPrompt = ui.prompt('Zapurse MIS Sync', 'Enter From Date (DD-MM-YYYY):', ui.ButtonSet.OK_CANCEL);
  if (fromPrompt.getSelectedButton() !== ui.Button.OK) return;
  const fromDate = fromPrompt.getResponseText().trim() || '01-11-2026';

  const toPrompt = ui.prompt('Zapurse MIS Sync', 'Enter To Date (DD-MM-YYYY):', ui.ButtonSet.OK_CANCEL);
  if (toPrompt.getSelectedButton() !== ui.Button.OK) return;
  const toDate = toPrompt.getResponseText().trim() || '26-11-2026';

  SpreadsheetApp.getActiveSpreadsheet().toast(`Syncing from ${fromDate} to ${toDate}...`, 'Syncing', 5);
  const result = syncAllZapurseServices(fromDate, toDate);

  ui.alert(
    `Sync Result for ${fromDate} to ${toDate}:\n\n` +
    `• Processed: ${result.totalRowsProcessed}\n` +
    `• New Records Added: ${result.recordsAdded}\n` +
    `• Total Active Clients: ${result.clientsCount}`
  );
}

function menuCleanAndResync() {
  const ui = SpreadsheetApp.getUi();
  const resp = ui.alert(
    'Clean & Resync Zapurse Database',
    'This will clear existing duplicate sales entries and re-fetch clean, accurate MIS records with exact transaction dates from Zapurse API.\n\nNote: Calling Logs and Users will NOT be affected.\n\nDo you want to continue?',
    ui.ButtonSet.YES_NO
  );
  if (resp !== ui.Button.YES) return;

  const now = new Date();
  const past30 = new Date();
  past30.setDate(now.getDate() - 30);
  const fromStr = Utilities.formatDate(past30, 'Asia/Kolkata', 'dd-MM-yyyy');
  const toStr = Utilities.formatDate(now, 'Asia/Kolkata', 'dd-MM-yyyy');

  SpreadsheetApp.getActiveSpreadsheet().toast('Clearing old data and fetching clean MIS records with correct dates & parent info...', 'Clean Resyncing', 15);
  const result = cleanAndResyncDatabase(fromStr, toStr);

  ui.alert(
    `Clean Resync Completed!\n\n` +
    `• Date Range: ${fromStr} to ${toStr}\n` +
    `• Records Processed: ${result.totalRowsProcessed}\n` +
    `• Clean Transactions Added: ${result.recordsAdded}\n` +
    `• Active Clients: ${result.clientsCount}\n\n` +
    `Yesterday Sales and Parent Distributor columns are now completely accurate!`
  );
}

/**
 * Clears old sales and re-syncs fresh, deduplicated records with proper dates & parent distributor details
 */
function cleanAndResyncDatabase(fromDate, toDate, specificServices) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheetsExist(ss);

  const salesSheet = ss.getSheetByName(TABS.SALES);
  const clientsSheet = ss.getSheetByName(TABS.CLIENTS);

  // Clear data rows in Sales_Data (leaving Row 1 headers intact)
  const salesLastRow = salesSheet.getLastRow();
  if (salesLastRow > 1) {
    salesSheet.getRange(2, 1, salesLastRow - 1, salesSheet.getLastColumn()).clearContent();
  }

  // Clear data rows in Clients_Master (leaving Row 1 headers intact)
  const clientsLastRow = clientsSheet.getLastRow();
  if (clientsLastRow > 1) {
    clientsSheet.getRange(2, 1, clientsLastRow - 1, clientsSheet.getLastColumn()).clearContent();
  }

  return syncAllZapurseServices(fromDate, toDate, specificServices);
}

/**
 * ------------------------------------------------------------------------------
 * 3. MASTER ZAPURSE API SYNC FUNCTION
 * Fetches MIS Report CSV for all service types & auto-updates Sales & Clients!
 * Captures Parent_Name & Parent_Mobile for distribution hierarchy tracking!
 * ------------------------------------------------------------------------------
 */
function syncAllZapurseServices(fromDate, toDate, specificServices) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheetsExist(ss);

  const salesSheet = ss.getSheetByName(TABS.SALES);
  const clientsSheet = ss.getSheetByName(TABS.CLIENTS);
  const syncLogsSheet = ss.getSheetByName(TABS.SYNC_LOGS);

  // Default dates if omitted (IST Timezone)
  const now = new Date();
  if (!toDate) {
    toDate = Utilities.formatDate(now, 'Asia/Kolkata', 'dd-MM-yyyy');
  }
  if (!fromDate) {
    let d = new Date();
    d.setDate(now.getDate() - 30);
    fromDate = Utilities.formatDate(d, 'Asia/Kolkata', 'dd-MM-yyyy');
  }

  const servicesToSync = specificServices && Array.isArray(specificServices) && specificServices.length > 0
    ? specificServices
    : ZAPURSE_CONFIG.SERVICE_TYPES;

  let totalRowsProcessed = 0;
  let newRecordsAdded = 0;
  let serviceStatus = {};

  // Build an in-memory set of existing Txn_IDs to avoid duplicates
  const existingSales = salesSheet.getDataRange().getValues();
  const existingTxnIds = new Set();
  for (let i = 1; i < existingSales.length; i++) {
    const tid = String(existingSales[i][0]).trim();
    if (tid) existingTxnIds.add(tid);
  }

  // Build an in-memory map of existing Clients in Clients_Master
  const clientsData = clientsSheet.getDataRange().getValues();
  const clientsMap = new Map(); // clientId -> object
  for (let i = 1; i < clientsData.length; i++) {
    const cid = String(clientsData[i][0]).trim();
    if (cid) {
      clientsMap.set(cid, {
        row: i + 1,
        clientName: clientsData[i][1],
        mobile: clientsData[i][2],
        cityState: clientsData[i][3],
        assignedUser: clientsData[i][4],
        lastTxnDate: clientsData[i][5],
        yearlySales: Number(clientsData[i][6]) || 0,
        followupsCount: Number(clientsData[i][7]) || 0,
        leadStatus: clientsData[i][8],
        primaryService: clientsData[i][9],
        parentName: clientsData[i][11] || '',
        parentMobile: clientsData[i][12] || ''
      });
    }
  }

  const rowsToAppendSales = [];

  // Loop through all services (ZAPAEPS, ZAPUPI, ZAPRECHARGE, RISLUPI, RISLDMT, RISLRECHARGE)
  for (let s = 0; s < servicesToSync.length; s++) {
    const serviceType = servicesToSync[s];
    try {
      Logger.log(`[Zapurse API] Fetching MIS Report for: ${serviceType} (${fromDate} to ${toDate})`);
      const csvRows = fetchZapurseMISReportCsv(serviceType, fromDate, toDate);

      if (!csvRows || csvRows.length <= 1) {
        Logger.log(`[Zapurse API] No data returned for ${serviceType}`);
        serviceStatus[serviceType] = { count: 0, status: 'NO_DATA' };
        continue;
      }

      const headers = csvRows[0].map(h => String(h).trim().toLowerCase());
      Logger.log(`[Zapurse API] Headers for ${serviceType}: ${JSON.stringify(headers)}`);

      // Dynamic header mapping
      const colMap = mapCsvHeaders(headers);

      let serviceAddedCount = 0;

      for (let r = 1; r < csvRows.length; r++) {
        const row = csvRows[r];
        if (!row || row.length === 0 || (row.length === 1 && String(row[0]).trim() === '')) continue;

        totalRowsProcessed++;

        // Extract values using dynamic column map
        let txnId = colMap.txnId !== -1 && row[colMap.txnId] ? String(row[colMap.txnId]).trim() : '';
        let dateVal = colMap.date !== -1 && row[colMap.date] ? String(row[colMap.date]).trim() : '';
        let clientId = colMap.clientId !== -1 && row[colMap.clientId] ? String(row[colMap.clientId]).trim() : '';
        let clientName = colMap.clientName !== -1 && row[colMap.clientName] ? String(row[colMap.clientName]).trim() : '';
        let mobile = colMap.mobile !== -1 && row[colMap.mobile] ? String(row[colMap.mobile]).trim() : '';
        let parentName = colMap.parentName !== -1 && row[colMap.parentName] ? String(row[colMap.parentName]).trim() : '';
        let parentMobile = colMap.parentMobile !== -1 && row[colMap.parentMobile] ? String(row[colMap.parentMobile]).trim() : '';
        let volume = colMap.volume !== -1 && row[colMap.volume] ? (Number(String(row[colMap.volume]).replace(/[^0-9.-]+/g, '')) || 0) : 0;
        let commission = colMap.commission !== -1 && row[colMap.commission] ? (Number(String(row[colMap.commission]).replace(/[^0-9.-]+/g, '')) || 0) : 0;
        let txnCount = colMap.txnCount !== -1 && row[colMap.txnCount] ? (Number(row[colMap.txnCount]) || 1) : 1;
        let statusVal = colMap.status !== -1 && row[colMap.status] ? String(row[colMap.status]).trim().toUpperCase() : 'SUCCESS';
        let stateVal = colMap.state !== -1 && row[colMap.state] ? String(row[colMap.state]).trim() : 'Rajasthan, India';

        // Filter out failed transactions if status column exists
        if (statusVal && statusVal.includes('FAIL')) {
          continue;
        }

        // Normalize Date to standard YYYY-MM-DD
        let formattedDate = normalizeDateString(dateVal);

        // Ensure Client ID & Name exist
        if (!clientId) {
          clientId = mobile ? `CL_${mobile}` : `CL_${serviceType}_${r}`;
        }

        // Reuse client details if already known in clientsMap
        if (clientsMap.has(clientId)) {
          const existingC = clientsMap.get(clientId);
          if (!clientName && existingC.clientName && !existingC.clientName.startsWith('Merchant ')) {
            clientName = existingC.clientName;
          }
          if (!mobile && existingC.mobile) {
            mobile = existingC.mobile;
          }
          if (!parentName && existingC.parentName) {
            parentName = existingC.parentName;
          }
          if (!parentMobile && existingC.parentMobile) {
            parentMobile = existingC.parentMobile;
          }
        }

        if (!clientName) {
          clientName = `Merchant ${clientId}`;
        }

        // Deterministic composite Txn ID if missing: prevents duplicates on re-sync
        if (!txnId) {
          txnId = `${serviceType}_${formattedDate}_${clientId}_${txnCount}_${Math.round(volume)}`;
        }

        // Deduplication Check
        if (existingTxnIds.has(txnId)) {
          continue; // Skip already inserted transactions
        }
        existingTxnIds.add(txnId);

        // Prepare row for Sales_Data (12 Columns):
        // ['Txn_ID', 'Date', 'Kiosk_ID', 'Client_Name', 'Mobile', 'Parent_Name', 'Parent_Mobile', 'Service_Name', 'Txn_Count', 'Volume_Amount', 'Commission_Revenue', 'Sync_Timestamp']
        rowsToAppendSales.push([
          txnId,
          formattedDate,
          clientId,
          clientName,
          mobile,
          parentName || '-',
          parentMobile || '-',
          serviceType,
          txnCount,
          volume,
          commission,
          new Date()
        ]);

        newRecordsAdded++;
        serviceAddedCount++;

        // Update in-memory Clients_Master
        if (clientsMap.has(clientId)) {
          const c = clientsMap.get(clientId);
          c.yearlySales += volume;
          if (c.lastTxnDate < formattedDate) {
            c.lastTxnDate = formattedDate;
          }
          if (!c.mobile && mobile) c.mobile = mobile;
          if (!c.parentName && parentName) c.parentName = parentName;
          if (!c.parentMobile && parentMobile) c.parentMobile = parentMobile;
          if ((!c.clientName || c.clientName.startsWith('Merchant ')) && clientName && !clientName.startsWith('Merchant ')) {
            c.clientName = clientName;
          }
        } else {
          // New Client to be inserted in Clients_Master
          clientsMap.set(clientId, {
            row: null, // New
            clientName: clientName,
            mobile: mobile,
            cityState: stateVal,
            assignedUser: (clientsMap.size % 2 === 0) ? 'pooja' : 'amit',
            lastTxnDate: formattedDate,
            yearlySales: volume,
            followupsCount: 0,
            leadStatus: 'Active',
            primaryService: serviceType,
            parentName: parentName,
            parentMobile: parentMobile
          });
        }
      }

      serviceStatus[serviceType] = { count: serviceAddedCount, status: 'SUCCESS' };
      Utilities.sleep(300); // Friendly throttle between API calls

    } catch (err) {
      Logger.log(`[Zapurse API] Error in service ${serviceType}: ${err.message}`);
      serviceStatus[serviceType] = { count: 0, status: 'ERROR', error: err.message };
    }
  }

  // Batch insert new records into Sales_Data in one single call
  if (rowsToAppendSales.length > 0) {
    salesSheet.getRange(salesSheet.getLastRow() + 1, 1, rowsToAppendSales.length, rowsToAppendSales[0].length)
      .setValues(rowsToAppendSales);
  }

  // Batch update or insert Clients_Master in memory
  syncClientsMasterTable(clientsSheet, clientsMap);

  // Log in API_Sync_Logs
  const syncId = 'SYNC_' + Date.now();
  const summaryMsg = `Processed ${totalRowsProcessed} CSV records. Added ${newRecordsAdded} new transactions across ${servicesToSync.length} services.`;
  if (syncLogsSheet) {
    syncLogsSheet.appendRow([syncId, new Date(), 'SUCCESS', newRecordsAdded, summaryMsg]);
  }

  return {
    success: true,
    syncId: syncId,
    totalRowsProcessed: totalRowsProcessed,
    recordsAdded: newRecordsAdded,
    clientsCount: clientsMap.size,
    serviceStatus: serviceStatus,
    message: summaryMsg
  };
}

/**
 * Executes UrlFetchApp call directly to Zapurse MIS Export API
 */
function fetchZapurseMISReportCsv(serviceType, fromDate, toDate) {
  const options = {
    method: "post",
    contentType: "application/json",
    headers: {
      Authorization: ZAPURSE_CONFIG.AUTHORIZATION,
      Username: ZAPURSE_CONFIG.USERNAME
    },
    payload: JSON.stringify({
      FromDate: fromDate,
      ToDate: toDate,
      LoginMobileNumber: ZAPURSE_CONFIG.LOGIN_MOBILE,
      ServiceType: serviceType
    }),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(ZAPURSE_CONFIG.API_URL, options);
  const responseCode = response.getResponseCode();

  if (responseCode !== 200) {
    Logger.log(`[Zapurse API] HTTP ${responseCode}: ${response.getContentText()}`);
    return null;
  }

  // Strip BOM \uFEFF if present
  const rawText = response.getContentText().replace(/^\uFEFF/, "").trim();
  if (!rawText) return null;

  return Utilities.parseCsv(rawText);
}

/**
 * Dynamic Column Header Mapping for Flexible Zapurse MIS Reports
 * Handles ZAPAEPS, ZAPUPI, ZAPRECHARGE, RISLUPI, RISLDMT, RISLRECHARGE headers
 * Captures Parent_Name, ParentMobileNo, KIOSKCODE, Amount, Count, DateTime
 */
function mapCsvHeaders(headers) {
  const findIdx = (regex) => headers.findIndex(h => regex.test(h.replace(/[^a-z0-9]/g, '')));

  return {
    txnId: findIdx(/^(txnid|transactionid|rrn|referenceno|refno|id)$/),
    date: findIdx(/^(transactiondatetime|txndatetime|txndate|transactiondate|date|createdon|createdat|timestamp|time)$/),
    clientId: findIdx(/^(kioskcode|kioskid|agentcode|retailerid|clientid|merchantid|agentid|customercode|userid|outletcode)$/),
    clientName: findIdx(/^(clientname|agentname|retailername|merchantname|name|outletname)$/),
    mobile: findIdx(/^(clientmobileno|clientmobile|mobile|mobileno|phone|contact|agentmobile|customermobile)$/),
    parentName: findIdx(/^(parentname|distributorname|distributor|parent|supername)$/),
    parentMobile: findIdx(/^(parentmobileno|parentmobile|distributormobile|distributorphoneno|supermobile)$/),
    volume: findIdx(/^(amount|volume|txnamount|totalamount|transactionamount|grossamount)$/),
    commission: findIdx(/^(commissionamount|commission|comm|margin|retailercommission|revenue)$/),
    txnCount: findIdx(/^(totalnumberoftransaction|totalnumberoftransactions|count|txncount|numberoftxns)$/),
    status: findIdx(/^(status|txnstatus|transactionstatus|recordstatus)$/),
    state: findIdx(/^(state|citystate|region)$/)
  };
}

/**
 * Normalizes varied Date strings to standard YYYY-MM-DD
 * Supports: "25 - Nov - 2026", "25-Nov-2026", "25-11-2026", "25/11/2026", "2026-11-25", etc.
 */
function normalizeDateString(dateVal) {
  if (!dateVal) return Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyy-MM-dd');
  
  const str = String(dateVal).trim();
  const monthMap = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
  };

  // Format 1: "25 - Nov - 2026" or "25-Nov-2026" or "25 Nov 2026"
  const alphaMatch = str.match(/^(\d{1,2})\s*[-/\s]\s*([A-Za-z]{3,9})\s*[-/\s]\s*(\d{4})/);
  if (alphaMatch) {
    const day = alphaMatch[1].padStart(2, '0');
    const monStr = alphaMatch[2].substring(0, 3).toLowerCase();
    const mon = monthMap[monStr] || '01';
    const yr = alphaMatch[3];
    return `${yr}-${mon}-${day}`;
  }

  // Format 2: "25-11-2026" or "25/11/2026" (DD-MM-YYYY)
  const dmyMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const mon = dmyMatch[2].padStart(2, '0');
    const yr = dmyMatch[3];
    return `${yr}-${mon}-${day}`;
  }

  // Format 3: "2026-11-25" (YYYY-MM-DD)
  const ymdMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (ymdMatch) {
    const yr = ymdMatch[1];
    const mon = ymdMatch[2].padStart(2, '0');
    const day = ymdMatch[3].padStart(2, '0');
    return `${yr}-${mon}-${day}`;
  }

  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return Utilities.formatDate(d, 'Asia/Kolkata', 'yyyy-MM-dd');
  }

  return Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyy-MM-dd');
}

/**
 * Synchronizes Clients_Master using fast in-memory batch updates
 */
function syncClientsMasterTable(clientsSheet, clientsMap) {
  const dataRange = clientsSheet.getDataRange();
  const existingRows = dataRange.getValues();
  const rowsToAppend = [];
  let hasUpdates = false;

  clientsMap.forEach((c, cid) => {
    if (c.row && c.row <= existingRows.length) {
      const rIdx = c.row - 1; // 0-based
      if (c.clientName && existingRows[rIdx][1] !== c.clientName) {
        existingRows[rIdx][1] = c.clientName;
        hasUpdates = true;
      }
      if (c.mobile && existingRows[rIdx][2] !== c.mobile) {
        existingRows[rIdx][2] = c.mobile;
        hasUpdates = true;
      }
      if (existingRows[rIdx][5] !== c.lastTxnDate) {
        existingRows[rIdx][5] = c.lastTxnDate;
        hasUpdates = true;
      }
      if (existingRows[rIdx][6] !== c.yearlySales) {
        existingRows[rIdx][6] = c.yearlySales;
        hasUpdates = true;
      }
      if (c.parentName && existingRows[rIdx][11] !== c.parentName) {
        existingRows[rIdx][11] = c.parentName;
        hasUpdates = true;
      }
      if (c.parentMobile && existingRows[rIdx][12] !== c.parentMobile) {
        existingRows[rIdx][12] = c.parentMobile;
        hasUpdates = true;
      }
    } else if (!c.row) {
      // New Client: Queue for batch append
      rowsToAppend.push([
        cid,
        c.clientName,
        c.mobile,
        c.cityState,
        c.assignedUser,
        c.lastTxnDate,
        c.yearlySales,
        c.followupsCount,
        c.leadStatus,
        c.primaryService,
        new Date(),
        c.parentName || '-',
        c.parentMobile || '-'
      ]);
    }
  });

  if (hasUpdates && existingRows.length > 1) {
    dataRange.setValues(existingRows);
  }

  if (rowsToAppend.length > 0) {
    clientsSheet.getRange(clientsSheet.getLastRow() + 1, 1, rowsToAppend.length, rowsToAppend[0].length)
      .setValues(rowsToAppend);
  }
}

/**
 * Sets up an automated Google Apps Script Time-driven trigger (Daily Nightly Sync)
 */
function setupDailySyncTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => {
    if (t.getHandlerFunction() === 'triggerDailyZapurseSync') {
      ScriptApp.deleteTrigger(t);
    }
  });

  ScriptApp.newTrigger('triggerDailyZapurseSync')
    .timeBased()
    .everyDays(1)
    .atHour(2) // Runs every night at 2:00 AM IST
    .create();

  SpreadsheetApp.getUi().alert('Nightly Auto-Sync Trigger Created!\n\nZapurse MIS will automatically sync every day at 2:00 AM.');
}

function triggerDailyZapurseSync() {
  const now = new Date();
  const past7 = new Date();
  past7.setDate(now.getDate() - 7); // Sync last 7 days daily to capture revisions
  const fromStr = Utilities.formatDate(past7, 'Asia/Kolkata', 'dd-MM-yyyy');
  const toStr = Utilities.formatDate(now, 'Asia/Kolkata', 'dd-MM-yyyy');

  syncAllZapurseServices(fromStr, toStr);
}

/**
 * ------------------------------------------------------------------------------
 * 4. DATABASE INITIALIZATION FUNCTION
 * ------------------------------------------------------------------------------
 */
function setupDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheetsExist(ss);
  return { success: true, message: 'Zapurse CRM Database initialized successfully with all 6 tabs!' };
}

function ensureSheetsExist(ss) {
  // 1. Users
  let usersSheet = getOrCreateSheet(ss, TABS.USERS);
  if (usersSheet.getLastRow() === 0) {
    usersSheet.appendRow(['UserID', 'Name', 'Username', 'Password', 'Role', 'Allowed_Services', 'Allowed_Modules', 'Status', 'Created_At']);
    usersSheet.getRange(1, 1, 1, 9).setFontWeight('bold').setBackground('#0f172a').setFontColor('#ffffff');
    usersSheet.appendRow(['USR001', 'Admin Master', 'admin', 'admin123', 'Admin', 'ALL', 'ALL', 'Active', new Date()]);
    usersSheet.appendRow(['USR002', 'Rahul Sharma', 'rahul', 'rahul123', 'Manager', 'ALL', 'DASHBOARD,SERVICES,CALLING,REPORTS', 'Active', new Date()]);
    usersSheet.appendRow(['USR003', 'Pooja Verma', 'pooja', 'pooja123', 'Caller', 'ZAPAEPS,ZAPUPI,ZAPRECHARGE', 'DASHBOARD,CALLING', 'Active', new Date()]);
    usersSheet.appendRow(['USR004', 'Amit Patel', 'amit', 'amit123', 'Caller', 'RISLDMT,RISLUPI,RISLRECHARGE', 'DASHBOARD,CALLING', 'Active', new Date()]);
  }

  // 2. Admin_Config (Exact User-Requested Questionnaire)
  let configSheet = getOrCreateSheet(ss, TABS.CONFIG);
  if (configSheet.getLastRow() === 0) {
    configSheet.appendRow(['Key', 'Value', 'Description', 'Updated_At']);
    configSheet.getRange(1, 1, 1, 4).setFontWeight('bold').setBackground('#0f172a').setFontColor('#ffffff');
    configSheet.appendRow(['Max_Followup_Limit', '5', 'Max calls allowed per client before auto-locking', new Date()]);
    configSheet.appendRow(['Yearly_Min_Sales_Condition', '50000', 'Minimum yearly sales threshold in Rupees', new Date()]);
    configSheet.appendRow(['Services_List', JSON.stringify(ZAPURSE_CONFIG.SERVICE_TYPES), 'Active Zapurse services list', new Date()]);
    
    const standardQuestions = [
      { 
        id: 'q1', 
        text: 'Call Status', 
        type: 'select', 
        options: ['Connected with Owner', 'Connected with Staff', 'Call Later / Busy', 'Ringing No Response (RNR)', 'Switched Off / Not Reachable', 'Wrong Number'] 
      },
      { 
        id: 'q2', 
        text: 'Convince Status', 
        type: 'select', 
        options: [
          'Fully Convinced (Will start transactions today)', 
          'Agreed (Within 2-3 days)', 
          'Follow-up Required (Call scheduled)', 
          'Needs Margin / Commission Rate Revision', 
          'Technical / Server Issue (Support Needed)', 
          'Not Convinced (Prefers Competitor Portal)', 
          'Not Interested / Shop Closed'
        ] 
      },
      { 
        id: 'q3', 
        text: 'Reason for Drop in Transactions', 
        type: 'select', 
        options: [
          'Margin / Commission Issue', 
          'Banking Portal / Server Down Issue', 
          'Switched to Competitor (Spice Money, PayNearby, RNFI)', 
          'Bank Account Freeze / Blocked', 
          'Low Customer Footfall', 
          'Regular Transactor (No Issue)', 
          'Other'
        ] 
      },
      { 
        id: 'q4', 
        text: 'Remark (Call Discussion Summary)', 
        type: 'textarea', 
        placeholder: 'Retailer se kya baat hui, kya samasya batayi, kya commitment diya...' 
      },
      { 
        id: 'q5', 
        text: 'Five References (Retailer Referrals)', 
        type: 'textarea', 
        placeholder: 'Retailer ke 5 mitra retailers ke Name aur Mobile No:\n1. Name - Mobile\n2. Name - Mobile\n3. Name - Mobile\n4. Name - Mobile\n5. Name - Mobile' 
      }
    ];
    configSheet.appendRow(['Dynamic_Questions', JSON.stringify(standardQuestions), 'Dynamic caller questionnaire form', new Date()]);
  }

  // 3. Clients_Master
  let clientsSheet = getOrCreateSheet(ss, TABS.CLIENTS);
  if (clientsSheet.getLastRow() === 0) {
    clientsSheet.appendRow(['Client_ID', 'Client_Name', 'Mobile', 'City_State', 'Assigned_User', 'Last_Txn_Date', 'Yearly_Sales', 'Total_Followups_Count', 'Lead_Status', 'Primary_Service', 'Created_At', 'Parent_Name', 'Parent_Mobile']);
    clientsSheet.getRange(1, 1, 1, 13).setFontWeight('bold').setBackground('#0f172a').setFontColor('#ffffff');
  }

  // 4. Sales_Data (12 Columns with Parent Distributor Hierarchy)
  let salesSheet = getOrCreateSheet(ss, TABS.SALES);
  if (salesSheet.getLastRow() === 0) {
    salesSheet.appendRow(['Txn_ID', 'Date', 'Kiosk_ID', 'Client_Name', 'Mobile', 'Parent_Name', 'Parent_Mobile', 'Service_Name', 'Txn_Count', 'Volume_Amount', 'Commission_Revenue', 'Sync_Timestamp']);
    salesSheet.getRange(1, 1, 1, 12).setFontWeight('bold').setBackground('#0f172a').setFontColor('#ffffff');
  }

  // 5. Calling_Logs
  let callSheet = getOrCreateSheet(ss, TABS.CALLS);
  if (callSheet.getLastRow() === 0) {
    callSheet.appendRow(['Call_ID', 'Timestamp', 'Client_ID', 'Client_Name', 'Caller_User', 'Call_Outcome', 'QA_Responses', 'Recording_Drive_URL', 'Next_Followup_DateTime', 'Calendar_Event_ID', 'Notes']);
    callSheet.getRange(1, 1, 1, 11).setFontWeight('bold').setBackground('#0f172a').setFontColor('#ffffff');
  }

  // 6. API_Sync_Logs
  let syncSheet = getOrCreateSheet(ss, TABS.SYNC_LOGS);
  if (syncSheet.getLastRow() === 0) {
    syncSheet.appendRow(['Sync_ID', 'Timestamp', 'Status', 'Records_Fetched', 'Message']);
    syncSheet.getRange(1, 1, 1, 5).setFontWeight('bold').setBackground('#0f172a').setFontColor('#ffffff');
    syncSheet.appendRow(['SYNC_INIT', new Date(), 'SUCCESS', 0, 'Database tables initialized.']);
  }
}

function getOrCreateSheet(ss, name) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  return sheet;
}

/**
 * ------------------------------------------------------------------------------
 * 5. REST API: doGet & doPost HANDLERS
 * ------------------------------------------------------------------------------
 */
function doGet(e) {
  try {
    const params = e && e.parameter ? e.parameter : {};
    const action = params.action || 'ping';

    let responseData = {};

    switch (action) {
      case 'ping':
        responseData = { status: 'ONLINE', app: 'Zapurse Fintech CRM Live API', time: new Date().toISOString() };
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

      case 'getServiceData':
        responseData = getServiceDataHandler(params.service);
        break;

      case 'getReports':
        responseData = getReportsHandler(params);
        break;

      case 'syncExternalSalesAPI':
      case 'syncZapurse':
        if (params.clean === 'true') {
          responseData = cleanAndResyncDatabase(params.fromDate, params.toDate, params.services ? params.services.split(',') : null);
        } else {
          responseData = syncAllZapurseServices(params.fromDate, params.toDate, params.services ? params.services.split(',') : null);
        }
        break;

      case 'cleanResync':
        responseData = cleanAndResyncDatabase(params.fromDate, params.toDate, params.services ? params.services.split(',') : null);
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

      case 'getServiceData':
        responseData = getServiceDataHandler(payload.service);
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

      case 'syncExternalSalesAPI':
      case 'syncZapurse':
        if (payload.clean === true || payload.clean === 'true') {
          responseData = cleanAndResyncDatabase(payload.fromDate, payload.toDate, payload.services);
        } else {
          responseData = syncAllZapurseServices(payload.fromDate, payload.toDate, payload.services);
        }
        break;

      case 'cleanResync':
        responseData = cleanAndResyncDatabase(payload.fromDate, payload.toDate, payload.services);
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

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * ------------------------------------------------------------------------------
 * 6. SUB-HANDLERS
 * ------------------------------------------------------------------------------
 */

function loginHandler(username, password) {
  if (!username || !password) return { success: false, message: 'Username and password required' };
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(TABS.USERS);
  if (!sheet) return { success: false, message: 'Database not initialized.' };

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (String(row[2]).trim().toLowerCase() === String(username).trim().toLowerCase()) {
      if (String(row[3]) === String(password)) {
        if (String(row[7]).toLowerCase() !== 'active') {
          return { success: false, message: 'User account disabled' };
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

/**
 * Ultra-Fast Date Formatting Helper (Pure JS IST conversion)
 * Handles Date objects and date strings with 0 latency
 */
function fastFormatDate(d) {
  if (!d) return '';
  if (typeof d === 'string') return d.length >= 10 ? d.substring(0, 10) : d;
  if (d instanceof Date) {
    if (isNaN(d.getTime())) return '';
    // IST is UTC + 5:30 (19,800,000 ms)
    const istTime = new Date(d.getTime() + 19800000);
    const y = istTime.getUTCFullYear();
    const m = istTime.getUTCMonth() + 1;
    const day = istTime.getUTCDate();
    return y + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
  }
  return String(d);
}

function getInitialDataHandler(params) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const salesSheet = ss.getSheetByName(TABS.SALES);
  const clientsSheet = ss.getSheetByName(TABS.CLIENTS);
  const callsSheet = ss.getSheetByName(TABS.CALLS);
  const configSheet = ss.getSheetByName(TABS.CONFIG);

  if (!salesSheet || !clientsSheet) {
    ensureSheetsExist(ss);
  }

  const salesData = salesSheet ? salesSheet.getDataRange().getValues() : [];
  const clientsData = clientsSheet ? clientsSheet.getDataRange().getValues() : [];
  const callsData = callsSheet ? callsSheet.getDataRange().getValues() : [];
  const configData = configSheet ? configSheet.getDataRange().getValues() : [];

  let configMap = {};
  for (let i = 1; i < configData.length; i++) {
    configMap[configData[i][0]] = configData[i][1];
  }

  // Exact IST Dates
  const now = new Date();
  const todayStr = Utilities.formatDate(now, 'Asia/Kolkata', 'yyyy-MM-dd');

  let yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  const yestStr = Utilities.formatDate(yesterday, 'Asia/Kolkata', 'yyyy-MM-dd');

  const curYear = parseInt(todayStr.substring(0, 4), 10);
  const curMonth = parseInt(todayStr.substring(5, 7), 10) - 1;

  let yesterdaySales = { volume: 0, count: 0 };
  let todaySales = { volume: 0, count: 0 };
  let monthlySales = { volume: 0, count: 0 };
  let yearlySales = { volume: 0, count: 0 };
  const serviceTotals = {};

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  let monthlyChartVolumes = new Array(12).fill(0);
  let monthlyChartTxns = new Array(12).fill(0);

  // Dynamic Header Column Mapping for Sales_Data (supports both 10 and 12-col schemas)
  const salesHeaders = salesData.length > 0 ? salesData[0].map(h => String(h).trim().toLowerCase()) : [];
  const pNameIdx = salesHeaders.indexOf('parent_name');
  const pMobIdx = salesHeaders.indexOf('parent_mobile');
  const svcIdx = salesHeaders.indexOf('service_name') !== -1 ? salesHeaders.indexOf('service_name') : (pNameIdx !== -1 ? 7 : 5);
  const cntIdx = salesHeaders.indexOf('txn_count') !== -1 ? salesHeaders.indexOf('txn_count') : (pNameIdx !== -1 ? 8 : 6);
  const volIdx = salesHeaders.indexOf('volume_amount') !== -1 ? salesHeaders.indexOf('volume_amount') : (pNameIdx !== -1 ? 9 : 7);
  const commIdx = salesHeaders.indexOf('commission_revenue') !== -1 ? salesHeaders.indexOf('commission_revenue') : (pNameIdx !== -1 ? 10 : 8);

  // High-Speed Loop over Sales Data
  for (let i = 1; i < salesData.length; i++) {
    const row = salesData[i];
    const dateRaw = row[1];
    let year = 0;
    let month = -1;
    let dStr = '';

    if (dateRaw instanceof Date) {
      dStr = fastFormatDate(dateRaw);
      if (dStr && dStr.length >= 10) {
        year = parseInt(dStr.substring(0, 4), 10);
        month = parseInt(dStr.substring(5, 7), 10) - 1;
      }
    } else if (typeof dateRaw === 'string' && dateRaw.length >= 10) {
      dStr = dateRaw.substring(0, 10);
      year = parseInt(dStr.substring(0, 4), 10);
      month = parseInt(dStr.substring(5, 7), 10) - 1;
    }

    const txnCount = Number(row[cntIdx]) || 1;
    const vol = Number(row[volIdx]) || 0;

    if (year === curYear) {
      yearlySales.volume += vol;
      yearlySales.count += txnCount;

      if (month >= 0 && month < 12) {
        monthlyChartVolumes[month] += vol;
        monthlyChartTxns[month] += txnCount;
      }

      if (month === curMonth) {
        monthlySales.volume += vol;
        monthlySales.count += txnCount;
      }
    }

    if (dStr === yestStr) {
      yesterdaySales.volume += vol;
      yesterdaySales.count += txnCount;
    }

    if (dStr === todayStr) {
      todaySales.volume += vol;
      todaySales.count += txnCount;
    }

    const sName = String(row[svcIdx] || '').trim().toUpperCase();
    if (sName) {
      if (!serviceTotals[sName]) serviceTotals[sName] = { volume: 0, count: 0 };
      serviceTotals[sName].volume += vol;
      serviceTotals[sName].count += txnCount;
    }
  }

  // Min / Max color coding
  let maxMonthIdx = 0, minMonthIdx = 0, maxVol = -1, minVol = Infinity;
  monthlyChartVolumes.forEach((v, idx) => {
    if (v > maxVol) { maxVol = v; maxMonthIdx = idx; }
    if (idx <= curMonth && v < minVol) { minVol = v; minMonthIdx = idx; }
  });

  const chartData = monthNames.map((name, idx) => ({
    month: name,
    volume: monthlyChartVolumes[idx],
    txnCount: monthlyChartTxns[idx],
    isHighest: idx === maxMonthIdx && maxVol > 0,
    isLowest: idx === minMonthIdx && minVol < Infinity
  }));

  // Today's Followups
  let todayFollowupsCount = 0;
  for (let i = 1; i < callsData.length; i++) {
    const followDate = callsData[i][8];
    if (followDate && fastFormatDate(followDate) === todayStr) {
      todayFollowupsCount++;
    }
  }

  // Lowest Performing Clients (Fast slice)
  let clientList = [];
  const clientLimit = Math.min(clientsData.length, 500);
  for (let i = 1; i < clientLimit; i++) {
    const row = clientsData[i];
    clientList.push({
      clientId: row[0],
      clientName: row[1],
      mobile: row[2],
      cityState: row[3],
      assignedUser: row[4],
      lastTxnDate: fastFormatDate(row[5]),
      yearlySales: Number(row[6]) || 0,
      followupsCount: Number(row[7]) || 0,
      status: row[8],
      primaryService: row[9] || 'General',
      parentName: row[11] || '-',
      parentMobile: row[12] || '-'
    });
  }

  const lowestPerforming = clientList
    .filter(c => c.status !== 'Locked')
    .sort((a, b) => a.yearlySales - b.yearlySales)
    .slice(0, 5);

  const recentRows = salesData.slice(1).slice(-100).reverse();
  const recentSales = recentRows.map(r => ({
    txnId: r[0],
    date: fastFormatDate(r[1]),
    clientId: r[2],
    clientName: r[3],
    mobile: r[4],
    parentName: pNameIdx !== -1 ? (r[pNameIdx] || '-') : '-',
    parentMobile: pMobIdx !== -1 ? (r[pMobIdx] || '-') : '-',
    serviceName: r[svcIdx] || 'General',
    txnCount: Number(r[cntIdx]) || 1,
    volume: Number(r[volIdx]) || 0,
    commission: Number(r[commIdx]) || 0
  }));

  let services = ZAPURSE_CONFIG.SERVICE_TYPES;
  if (configMap['Services_List']) {
    try { services = JSON.parse(configMap['Services_List']); } catch (e) {}
  }

  return {
    kpis: {
      yesterday: yesterdaySales,
      today: todaySales,
      monthly: monthlySales,
      yearly: yearlySales,
      todayFollowups: todayFollowupsCount
    },
    chartData: chartData,
    lowestPerforming: lowestPerforming,
    serviceTotals: serviceTotals,
    recentSales: recentSales,
    services: services,
    config: {
      maxFollowupLimit: Number(configMap['Max_Followup_Limit']) || 5,
      yearlyMinSalesCondition: Number(configMap['Yearly_Min_Sales_Condition']) || 50000
    }
  };
}

function getClientsHandler(params) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(TABS.CLIENTS);
  if (!sheet) return { clients: [], total: 0 };

  const data = sheet.getDataRange().getValues();
  const now = new Date();
  const nowMs = now.getTime();
  const todayStr = fastFormatDate(now);

  const inactiveFilter = params.inactiveDays ? (params.inactiveDays === 'ALL' ? null : Number(params.inactiveDays)) : null;
  const includeToday = params.includeToday === 'true';
  const minYearlySales = params.minYearlySales ? Number(params.minYearlySales) : null;
  const serviceFilter = params.service || 'ALL';
  const searchQuery = params.search ? params.search.toLowerCase() : '';

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
    const parentName = row[11] || '-';
    const parentMobile = row[12] || '-';

    let inactiveDays = 999;
    let isTodayTxn = false;
    let dateStr = '';

    if (lastTxnDateRaw instanceof Date) {
      dateStr = fastFormatDate(lastTxnDateRaw);
      const diffMs = nowMs - lastTxnDateRaw.getTime();
      inactiveDays = Math.max(0, Math.floor(diffMs / 86400000));
    } else if (typeof lastTxnDateRaw === 'string' && lastTxnDateRaw.length >= 10) {
      dateStr = lastTxnDateRaw.substring(0, 10);
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        const diffMs = nowMs - d.getTime();
        inactiveDays = Math.max(0, Math.floor(diffMs / 86400000));
      }
    }

    if (dateStr === todayStr) {
      isTodayTxn = true;
      inactiveDays = 0;
    }

    if (!includeToday && isTodayTxn) continue;
    if (inactiveFilter !== null && inactiveDays < inactiveFilter) continue;
    if (minYearlySales !== null && yearlySales > minYearlySales) continue;
    if (serviceFilter !== 'ALL' && primaryService !== serviceFilter) continue;

    if (searchQuery) {
      const combined = `${clientId} ${clientName} ${mobile} ${parentName} ${cityState}`.toLowerCase();
      if (!combined.includes(searchQuery)) continue;
    }

    results.push({
      clientId: clientId,
      clientName: clientName,
      mobile: mobile,
      cityState: cityState,
      assignedUser: assignedUser,
      lastTxnDate: dateStr || 'No Record',
      inactiveDays: inactiveDays,
      yearlySales: yearlySales,
      followupsCount: followupsCount,
      status: status,
      primaryService: primaryService,
      parentName: parentName,
      parentMobile: parentMobile
    });

    if (results.length >= 400) break; // Fast paging cap for smooth UI
  }

  results.sort((a, b) => b.inactiveDays - a.inactiveDays);
  return { total: results.length, clients: results };
}

/**
 * Enhanced Client History: returns Timeline, Transactions, and Day-by-Day 7-Day Sales Breakdown
 */
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
        lastTxnDate: fastFormatDate(clientsData[i][5]),
        yearlySales: Number(clientsData[i][6]) || 0,
        followupsCount: Number(clientsData[i][7]) || 0,
        status: clientsData[i][8],
        primaryService: clientsData[i][9],
        parentName: clientsData[i][11] || '',
        parentMobile: clientsData[i][12] || ''
      };
      break;
    }
  }

  // 1. Calling Timeline & Interactions
  let timeline = [];
  if (callsSheet) {
    const callsData = callsSheet.getDataRange().getValues();
    for (let i = 1; i < callsData.length; i++) {
      if (String(callsData[i][2]) === String(clientId)) {
        let qaParsed = {};
        try { qaParsed = JSON.parse(callsData[i][6]); } catch (e) { qaParsed = { raw: callsData[i][6] }; }
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
  timeline.reverse();

  // 2. Client Transactions List
  let transactions = [];
  if (salesSheet) {
    const salesData = salesSheet.getDataRange().getValues();
    const headers = salesData.length > 0 ? salesData[0].map(h => String(h).trim().toLowerCase()) : [];
    const pNameIdx = headers.indexOf('parent_name');
    const pMobIdx = headers.indexOf('parent_mobile');
    const svcIdx = headers.indexOf('service_name') !== -1 ? headers.indexOf('service_name') : (pNameIdx !== -1 ? 7 : 5);
    const cntIdx = headers.indexOf('txn_count') !== -1 ? headers.indexOf('txn_count') : (pNameIdx !== -1 ? 8 : 6);
    const volIdx = headers.indexOf('volume_amount') !== -1 ? headers.indexOf('volume_amount') : (pNameIdx !== -1 ? 9 : 7);
    const commIdx = headers.indexOf('commission_revenue') !== -1 ? headers.indexOf('commission_revenue') : (pNameIdx !== -1 ? 10 : 8);

    for (let i = 1; i < salesData.length; i++) {
      if (String(salesData[i][2]) === String(clientId)) {
        const rowPName = pNameIdx !== -1 ? salesData[i][pNameIdx] : '';
        const rowPMob = pMobIdx !== -1 ? salesData[i][pMobIdx] : '';
        if (clientInfo && !clientInfo.parentName && rowPName) clientInfo.parentName = rowPName;
        if (clientInfo && !clientInfo.parentMobile && rowPMob) clientInfo.parentMobile = rowPMob;

        transactions.push({
          txnId: salesData[i][0],
          date: fastFormatDate(salesData[i][1]),
          clientId: salesData[i][2],
          clientName: salesData[i][3],
          mobile: salesData[i][4],
          parentName: rowPName || '-',
          parentMobile: rowPMob || '-',
          serviceName: salesData[i][svcIdx] || 'General',
          txnCount: Number(salesData[i][cntIdx]) || 1,
          volume: Number(salesData[i][volIdx]) || 0,
          commission: Number(salesData[i][commIdx]) || 0
        });
      }
    }
  }
  transactions.reverse();

  // 3. Day-by-Day 7-Day Performance Calculation (Today down to 6 days ago)
  const now = new Date();
  const past7Days = [];
  for (let d = 0; d < 7; d++) {
    const dt = new Date();
    dt.setDate(now.getDate() - d);
    const dateStr = Utilities.formatDate(dt, 'Asia/Kolkata', 'yyyy-MM-dd');
    const dayLabel = d === 0 ? 'Today' : (d === 1 ? 'Yesterday' : Utilities.formatDate(dt, 'Asia/Kolkata', 'dd MMM (EEE)'));
    past7Days.push({
      date: dateStr,
      label: dayLabel,
      volume: 0,
      count: 0,
      services: []
    });
  }

  let total7DayVolume = 0;
  let total7DayTxns = 0;

  transactions.forEach(t => {
    const match = past7Days.find(d => d.date === t.date);
    if (match) {
      match.volume += Number(t.volume) || 0;
      match.count += Number(t.txnCount) || 0;
      if (t.serviceName && !match.services.includes(t.serviceName)) {
        match.services.push(t.serviceName);
      }
      total7DayVolume += Number(t.volume) || 0;
      total7DayTxns += Number(t.txnCount) || 0;
    }
  });

  return {
    client: clientInfo,
    timeline: timeline,
    transactions: transactions,
    last7DaysSales: past7Days,
    total7DayVolume: total7DayVolume,
    total7DayTxns: total7DayTxns
  };
}

/**
 * Service Data Handler: aggregates all volume, count, top/bottom merchants, and latest transactions for a specific service
 */
function getServiceDataHandler(serviceName) {
  if (!serviceName) return { error: 'serviceName required' };
  const targetService = String(serviceName).trim().toUpperCase();

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const salesSheet = ss.getSheetByName(TABS.SALES);
  if (!salesSheet) {
    return { serviceName: serviceName, totalVolume: 0, totalTxnCount: 0, topMerchants: [], bottomMerchants: [], transactions: [] };
  }

  const salesData = salesSheet.getDataRange().getValues();
  if (salesData.length <= 1) {
    return { serviceName: serviceName, totalVolume: 0, totalTxnCount: 0, topMerchants: [], bottomMerchants: [], transactions: [] };
  }

  const headers = salesData[0].map(h => String(h).trim().toLowerCase());
  const pNameIdx = headers.indexOf('parent_name');
  const pMobIdx = headers.indexOf('parent_mobile');
  const svcIdx = headers.indexOf('service_name') !== -1 ? headers.indexOf('service_name') : (pNameIdx !== -1 ? 7 : 5);
  const cntIdx = headers.indexOf('txn_count') !== -1 ? headers.indexOf('txn_count') : (pNameIdx !== -1 ? 8 : 6);
  const volIdx = headers.indexOf('volume_amount') !== -1 ? headers.indexOf('volume_amount') : (pNameIdx !== -1 ? 9 : 7);
  const commIdx = headers.indexOf('commission_revenue') !== -1 ? headers.indexOf('commission_revenue') : (pNameIdx !== -1 ? 10 : 8);

  let totalVolume = 0;
  let totalTxnCount = 0;
  const merchantMap = {};
  const transactions = [];

  for (let i = 1; i < salesData.length; i++) {
    const row = salesData[i];
    const rowSvc = String(row[svcIdx] || '').trim().toUpperCase();
    if (rowSvc !== targetService && targetService !== 'ALL') {
      continue;
    }

    const txnCount = Number(row[cntIdx]) || 1;
    const vol = Number(row[volIdx]) || 0;
    const comm = Number(row[commIdx]) || 0;
    const clientId = String(row[2] || '');
    const clientName = String(row[3] || '');
    const mobile = String(row[4] || '');
    const pName = pNameIdx !== -1 ? String(row[pNameIdx] || '-') : '-';
    const pMob = pMobIdx !== -1 ? String(row[pMobIdx] || '-') : '-';

    totalVolume += vol;
    totalTxnCount += txnCount;

    // Aggregate by Merchant
    if (clientId) {
      if (!merchantMap[clientId]) {
        merchantMap[clientId] = {
          clientId: clientId,
          clientName: clientName || clientId,
          mobile: mobile,
          parentName: pName,
          parentMobile: pMob,
          volume: 0,
          txnCount: 0
        };
      }
      merchantMap[clientId].volume += vol;
      merchantMap[clientId].txnCount += txnCount;
      if (!merchantMap[clientId].mobile && mobile) merchantMap[clientId].mobile = mobile;
      if (merchantMap[clientId].parentName === '-' && pName !== '-') merchantMap[clientId].parentName = pName;
      if (merchantMap[clientId].parentMobile === '-' && pMob !== '-') merchantMap[clientId].parentMobile = pMob;
    }

    // Collect transaction record
    transactions.push({
      txnId: row[0],
      date: fastFormatDate(row[1]),
      clientId: clientId,
      clientName: clientName,
      mobile: mobile,
      parentName: pName,
      parentMobile: pMob,
      serviceName: row[svcIdx] || serviceName,
      txnCount: txnCount,
      volume: vol,
      commission: comm
    });
  }

  // Merchants sorted by volume
  const merchantList = Object.values(merchantMap);
  const topMerchants = [...merchantList].sort((a, b) => b.volume - a.volume).slice(0, 5);
  const bottomMerchants = [...merchantList].sort((a, b) => a.volume - b.volume).slice(0, 5);

  // Take latest 250 transactions (reversed so latest is first)
  const latestTxns = transactions.slice(-250).reverse();

  return {
    serviceName: serviceName,
    totalVolume: totalVolume,
    totalTxnCount: totalTxnCount,
    topMerchants: topMerchants,
    bottomMerchants: bottomMerchants,
    transactions: latestTxns
  };
}

function saveCallLogHandler(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const callsSheet = ss.getSheetByName(TABS.CALLS);
  const clientsSheet = ss.getSheetByName(TABS.CLIENTS);
  const configSheet = ss.getSheetByName(TABS.CONFIG);

  if (!callsSheet || !clientsSheet) return { success: false, message: 'CRM Sheets missing.' };

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

  // Audio Upload to Google Drive if audioBase64 exists
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

  // Google Calendar Event Creation
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

  // Insert Calling Log
  const callId = 'CAL' + Math.floor(100000 + Math.random() * 900000);
  const qaJsonStr = typeof payload.qaResponses === 'object' ? JSON.stringify(payload.qaResponses) : String(payload.qaResponses || '{}');

  callsSheet.appendRow([
    callId,
    new Date(),
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

  // Update Client Follow-up Count & Auto-Lock
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
      ? `Call logged! Client reached max limit (${maxLimit}) and is now locked.` 
      : 'Call recorded and scheduled successfully!'
  };
}

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

function createCalendarReminder(clientName, followupIsoString, notes) {
  const startTime = new Date(followupIsoString);
  if (isNaN(startTime.getTime())) return '';

  const endTime = new Date(startTime.getTime() + 15 * 60 * 1000);
  const title = '📞 Zapurse Call: ' + clientName;
  const description = 'Scheduled Follow-up call.\nNotes: ' + notes;

  const cal = CalendarApp.getDefaultCalendar();
  if (cal) {
    const event = cal.createEvent(title, startTime, endTime, { description: description });
    return event.getId();
  }
  return '';
}

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
    try { questions = JSON.parse(configMap['Dynamic_Questions']); } catch (e) {}
  }

  let services = ZAPURSE_CONFIG.SERVICE_TYPES;
  if (configMap['Services_List']) {
    try { services = JSON.parse(configMap['Services_List']); } catch (e) {}
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

function saveAdminConfigHandler(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const configSheet = ss.getSheetByName(TABS.CONFIG);
  if (!configSheet) return { success: false, message: 'Config sheet missing' };

  const data = configSheet.getDataRange().getValues();

  function updateOrInsert(key, value) {
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === key) {
        configSheet.getRange(i + 1, 2).setValue(value);
        configSheet.getRange(i + 1, 4).setValue(new Date());
        return;
      }
    }
    configSheet.appendRow([key, value, 'Updated', new Date()]);
  }

  if (payload.maxFollowupLimit !== undefined) updateOrInsert('Max_Followup_Limit', String(payload.maxFollowupLimit));
  if (payload.yearlyMinSalesCondition !== undefined) updateOrInsert('Yearly_Min_Sales_Condition', String(payload.yearlyMinSalesCondition));
  if (payload.services !== undefined) updateOrInsert('Services_List', JSON.stringify(payload.services));
  if (payload.dynamicQuestions !== undefined) updateOrInsert('Dynamic_Questions', JSON.stringify(payload.dynamicQuestions));

  return { success: true, message: 'Settings saved successfully!' };
}

function manageUserHandler(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(TABS.USERS);
  if (!sheet) return { success: false, message: 'Users sheet missing' };

  const data = sheet.getDataRange().getValues();
  const op = payload.operation;

  if (op === 'create') {
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
    return { success: true, message: 'User created', userId: userId };
  }

  if (op === 'toggleStatus') {
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(payload.userId)) {
        const cur = String(data[i][7]);
        const next = cur === 'Active' ? 'Inactive' : 'Active';
        sheet.getRange(i + 1, 8).setValue(next);
        return { success: true, message: 'Status updated to ' + next };
      }
    }
  }
  return { success: false, message: 'Invalid operation' };
}

function getReportsHandler(params) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const callsSheet = ss.getSheetByName(TABS.CALLS);
  const clientsSheet = ss.getSheetByName(TABS.CLIENTS);

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

  let clientMatrix = [];
  if (clientsSheet) {
    const cData = clientsSheet.getDataRange().getValues();
    const matrixLimit = Math.min(cData.length, 500);
    for (let i = 1; i < matrixLimit; i++) {
      clientMatrix.push({
        clientId: cData[i][0],
        clientName: cData[i][1],
        mobile: cData[i][2],
        city: cData[i][3],
        service: cData[i][9],
        yearlySales: Number(cData[i][6]) || 0,
        followupsCount: Number(cData[i][7]) || 0,
        status: cData[i][8],
        parentName: cData[i][11] || '-',
        parentMobile: cData[i][12] || '-'
      });
    }
  }

  return { callers: Object.values(callerStats), matrix: clientMatrix };
}
