/**
 * ==============================================================================
 * ZAPURSE FINTECH CRM - MASTER BACKEND & LIVE MIS API ENGINE
 * ==============================================================================
 * Integration:
 * - Direct Zapurse ExportMISReportCsv API
 * - 6 Core Services: ZAPAEPS, ZAPUPI, ZAPRECHARGE, RISLUPI, RISLDMT, RISLRECHARGE
 * - Master Report Multi-Service Ingestion with RISL State Rule (RAJASTHAN)
 * - REST API Endpoints: doGet & doPost supporting JSON payloads & CORS
 * ==============================================================================
 */

/**
 * ============================================================================
 * 1. GLOBAL CONFIGURATION
 * ============================================================================
 */
const CONFIG = {
  API_URL: "https://zapurse.com/atishayapi/wlservices/ExportMISReportCsv",
  USERNAME: "7024219540",
  AUTHORIZATION: "basic NA",
  LOGIN_MOBILE: "9311555271",
  FROM_DATE: "25-11-2026",
  TO_DATE: "25-11-2026",
  DEFAULT_RISL_STATE: "RAJASTHAN", // RISL services ke liye default state
  SERVICE_TYPES: [
    "ZAPAEPS",
    "ZAPUPI",
    "ZAPRECHARGE",
    "B2C",
    "RISLUPI",
    "RISLDMT",
    "RISLRECHARGE"
  ]
};

// Backward-compatible alias
const ZAPURSE_CONFIG = CONFIG;

// Database Sheet Names
const TABS = {
  MASTER_REPORT: 'Master Report',
  SALES: 'Sales_Data',
  CLIENTS: 'Clients_Master',
  CALLS: 'Calling_Logs',
  USERS: 'Users',
  CONFIG: 'Admin_Config',
  SYNC_LOGS: 'API_Sync_Logs'
};

/**
 * Safe Alert Helper:
 * Trigger/automation me bina crash huye chalega aur UI me alert dikhayega.
 */
function showSafeAlert(title, message) {
  try {
    SpreadsheetApp.getUi().alert(`${title}\n\n${message}`);
  } catch (e) {
    Logger.log(`[ALERT - ${title}]: ${message}`);
  }
}

/**
 * STRICT RULE: Sirf aur sirf RISL wali services me hi State ko RAJASTHAN karega.
 * Baaki kisi bhi service (ZAP etc.) ko touch nahi karega.
 */
function applyRislStateRule(rows, serviceType) {
  if (!rows || rows.length === 0 || !rows[0]) return rows;

  const isRisl = serviceType.toUpperCase().startsWith("RISL");
  if (!isRisl) {
    return rows; // No changes to ZAP services
  }

  // Yahan sirf RISL services hi aayengi (RISLDMT, RISLUPI, RISLRECHARGE)
  let stateColIndex = rows[0].findIndex(h => {
    const clean = String(h).trim().toLowerCase().replace(/[^a-z]/g, "");
    return clean === "state" || clean === "statename";
  });

  if (stateColIndex === -1) {
    rows[0].push("State");
    stateColIndex = rows[0].length - 1;
    for (let i = 1; i < rows.length; i++) {
      rows[i].push(CONFIG.DEFAULT_RISL_STATE);
    }
  } else {
    for (let i = 1; i < rows.length; i++) {
      const val = rows[i][stateColIndex] ? String(rows[i][stateColIndex]).trim() : "";
      if (!val || val.toUpperCase() === "NA" || val === "-" || val.toLowerCase() === "null") {
        rows[i][stateColIndex] = CONFIG.DEFAULT_RISL_STATE;
      }
    }
  }

  return rows;
}

/**
 * B2C GATEWAY RECHARGE HANDLER:
 * Filters only 'Success' transactions and normalizes 43 columns into standard CRM structure
 */
function normalizeB2CRows(rows) {
  if (!rows || rows.length <= 1) return rows;
  const h = rows[0].map(x => String(x).trim());
  const findIdx = (regex) => h.findIndex(col => regex.test(col.toLowerCase().replace(/[^a-z0-9]/g, '')));

  const stIdx = findIdx(/^(rechargestatus|paymentstatus|status)/);
  const amtIdx = findIdx(/^(rechargeamount|amount|totalamount)/);
  const dateIdx = findIdx(/^(rechargedate|orderdate|date)/);
  const nameIdx = findIdx(/^(customername|clientname|name)/);
  const mobIdx = findIdx(/^(loginmobilenumber|clientmobileno|mobile)/);
  const stateIdx = findIdx(/^(statename|state)/);
  const opIdx = findIdx(/^(operatorname|operator)/);
  const recNumIdx = findIdx(/^(rechargenumber|parentmobileno)/);
  const rcptIdx = findIdx(/^(receiptid|orderid|kioskcode)/);

  const stdHeaders = ['TransactionDateTime', 'TotalNumberoftransaction', 'Client_Name', 'Client_MobileNo', 'Parent_Name', 'ParentMobileNo', 'Amount', 'CommissionAmount', 'State', 'KIOSKCODE', 'RecordStatus'];
  const result = [stdHeaders];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const status = stIdx !== -1 && r[stIdx] ? String(r[stIdx]).trim() : 'Success';
    if (status.toLowerCase() !== 'success') {
      continue; // Filter only Success records as specified in user reference code
    }

    const recDate = dateIdx !== -1 && r[dateIdx] ? String(r[dateIdx]).trim() : '';
    const recNum = recNumIdx !== -1 && r[recNumIdx] ? String(r[recNumIdx]).trim() : '';
    const custName = nameIdx !== -1 && r[nameIdx] ? String(r[nameIdx]).trim() : (recNum ? ('Customer ' + recNum) : 'B2C User');
    const mob = mobIdx !== -1 && r[mobIdx] ? String(r[mobIdx]).trim() : '';
    const opName = opIdx !== -1 && r[opIdx] ? String(r[opIdx]).trim() : 'B2C Operator';
    const amt = amtIdx !== -1 && r[amtIdx] ? String(r[amtIdx]).trim() : '0';
    const state = stateIdx !== -1 && r[stateIdx] ? String(r[stateIdx]).trim() : 'Rajasthan, India';
    const rcpt = rcptIdx !== -1 && r[rcptIdx] ? String(r[rcptIdx]).trim() : ('B2C_' + i);

    result.push([
      recDate,
      '1',
      custName,
      mob,
      opName,
      recNum,
      amt,
      '0',
      state,
      rcpt,
      'Success'
    ]);
  }

  return result;
}

/**
 * ============================================================================
 * 2. CORE PURE API CALL FUNCTION
 * ============================================================================
 */
function fetchPayGatewayReport(filters) {
  const options = {
    method: "post",
    contentType: "application/json",
    headers: {
      Authorization: CONFIG.AUTHORIZATION,
      Username: CONFIG.USERNAME
    },
    payload: JSON.stringify({
      FromDate: filters.FromDate,
      ToDate: filters.ToDate,
      LoginMobileNumber: filters.LoginMobileNumber,
      ServiceType: filters.ServiceType
    }),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(CONFIG.API_URL, options);
    const responseCode = response.getResponseCode();

    if (responseCode !== 200) {
      Logger.log(`[${filters.ServiceType}] HTTP ${responseCode}: ${response.getContentText()}`);
      return null;
    }

    const rawText = response.getContentText().replace(/^\uFEFF/, "").trim();

    if (!rawText) {
      Logger.log(`[${filters.ServiceType}] Empty response from API.`);
      return null;
    }

    if (rawText.startsWith("{") || rawText.startsWith("[")) {
      Logger.log(`[${filters.ServiceType}] API returned JSON instead of CSV: ${rawText}`);
      return null;
    }

    let rows;
    try {
      rows = Utilities.parseCsv(rawText);
    } catch (parseErr) {
      Logger.log(`[${filters.ServiceType}] CSV Parsing failed: ${parseErr.message}`);
      return null;
    }

    if (!rows || rows.length === 0 || !rows[0] || rows[0].length === 0) {
      Logger.log(`[${filters.ServiceType}] Zero rows or columns found.`);
      return null;
    }

    if (rows.length === 1 && rows[0].length === 1 && rows[0][0].trim() === "") {
      Logger.log(`[${filters.ServiceType}] Blank row returned.`);
      return null;
    }

    if (filters.ServiceType.toUpperCase() === "B2C") {
      rows = normalizeB2CRows(rows);
    } else {
      rows = applyRislStateRule(rows, filters.ServiceType);
    }
    return rows;

  } catch (err) {
    Logger.log(`[${filters.ServiceType}] Network/Fetch Exception: ${err.message}`);
    return null;
  }
}

/**
 * STRICT RULE: Skip internal Zapurse Payment Gateway system account
 */
function isPaymentGatewayUser(name, mobile) {
  const cleanName = String(name || '').toUpperCase().replace(/\s+/g, ' ').trim();
  const cleanMobile = String(mobile || '').trim();
  if (cleanName.includes('PAYMENTGATEWAY') || cleanName.includes('PAYMENT GATEWAY')) return true;
  if (cleanName.includes('ZAPURSE PAYMENTGATEWAY USER')) return true;
  if (cleanMobile === '7024219540') return true;
  return false;
}

/**
 * ============================================================================
 * 3. ALL SERVICES IN SINGLE MASTER SHEET (MASTER REPORT)
 * ============================================================================
 */
function updateAllServicesInMasterSheet(customFromDate, customToDate) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheetsExist(ss);

  const masterSheetName = TABS.MASTER_REPORT;
  let sheet = ss.getSheetByName(masterSheetName);
  if (!sheet) {
    sheet = ss.insertSheet(masterSheetName);
  }

  const fromDate = customFromDate || CONFIG.FROM_DATE;
  const toDate = customToDate || CONFIG.TO_DATE;

  const serviceResults = [];
  let masterHeaders = ["Service Name"];
  let totalRecords = 0;
  let summary = [];

  for (let i = 0; i < CONFIG.SERVICE_TYPES.length; i++) {
    const service = CONFIG.SERVICE_TYPES[i];
    Logger.log(`Master Report ke liye fetch ho raha hai: ${service}...`);

    const filters = {
      FromDate: fromDate,
      ToDate: toDate,
      LoginMobileNumber: CONFIG.LOGIN_MOBILE,
      ServiceType: service
    };

    const rows = fetchPayGatewayReport(filters);

    if (rows && rows.length > 1 && rows[0] && rows[0].length > 0) {
      const headers = rows[0].map((h, idx) => String(h).trim() || `Col_${idx + 1}`);
      const dataRows = rows.slice(1);

      // Detect Client_Name and Mobile indices in this service
      const clientNameIdx = headers.findIndex(h => /^(clientname|name)/i.test(h.replace(/[^a-z0-9]/gi, '')));
      const mobileIdx = headers.findIndex(h => /^(clientmobileno|mobile)/i.test(h.replace(/[^a-z0-9]/gi, '')));

      // Filter out internal Payment Gateway User
      const filteredDataRows = dataRows.filter(row => {
        const rowName = clientNameIdx !== -1 ? row[clientNameIdx] : '';
        const rowMobile = mobileIdx !== -1 ? row[mobileIdx] : '';
        return !isPaymentGatewayUser(rowName, rowMobile);
      });

      headers.forEach(h => {
        if (!masterHeaders.includes(h)) {
          masterHeaders.push(h);
        }
      });

      serviceResults.push({
        service: service,
        headers: headers,
        dataRows: filteredDataRows
      });

      totalRecords += filteredDataRows.length;
      summary.push(`✅ ${service}: ${filteredDataRows.length} records`);
    } else {
      summary.push(`⚠️ ${service}: No Data / Blank`);
    }

    Utilities.sleep(300);
  }

  if (serviceResults.length === 0 || totalRecords === 0) {
    showSafeAlert("Notice", "Kisi bhi service me koi data nahi mila.");
    return { success: false, recordsAdded: 0, totalRowsProcessed: 0, message: "No data found" };
  }

  const headerIndexMap = {};
  masterHeaders.forEach((h, idx) => {
    headerIndexMap[h] = idx;
  });

  const finalMasterData = [];
  finalMasterData.push(masterHeaders);

  serviceResults.forEach(item => {
    const serviceName = item.service;
    const itemHeaders = item.headers;

    item.dataRows.forEach(row => {
      const newRow = new Array(masterHeaders.length).fill("");
      newRow[0] = serviceName;

      itemHeaders.forEach((hName, colIdx) => {
        const targetColIdx = headerIndexMap[hName];
        if (targetColIdx !== undefined && row[colIdx] !== undefined) {
          newRow[targetColIdx] = row[colIdx];
        }
      });

      finalMasterData.push(newRow);
    });
  });

  if (sheet.getFilter()) sheet.getFilter().remove();
  sheet.clearContents();
  sheet.getRange(1, 1, finalMasterData.length, finalMasterData[0].length).setValues(finalMasterData);
  sheet.getRange(1, 1, 1, finalMasterData[0].length).setFontWeight("bold").setBackground("#0f172a").setFontColor("#ffffff");
  sheet.setFrozenRows(1);

  // Sync Clients Master automatically from Master Report records
  syncClientsFromMasterData(ss, finalMasterData);

  showSafeAlert(
    "Master Report Success",
    `Total Records: ${totalRecords}\n\n` + summary.join("\n")
  );

  return {
    success: true,
    recordsAdded: totalRecords,
    totalRowsProcessed: totalRecords,
    clientsCount: totalRecords
  };
}

/**
 * ============================================================================
 * 5. MASTER SALES DATA LOADER FOR CRM API & FRONTEND
 * Reads directly from 'Master Report' (or 'Sales_Data') and provides clean,
 * 100% positive, non-shifted transactions matrix!
 * ============================================================================
 */
/**
 * Helper to parse transactions from any given sheet
 */
function parseSheetRows(sheet, defaultServiceName) {
  if (!sheet) return [];
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];

  const rawHeaders = values[0].map(h => String(h).trim().toLowerCase().replace(/[^a-z0-9]/g, ''));
  const svcIdx = rawHeaders.indexOf('servicename');
  const dateIdx = rawHeaders.findIndex(h => /^(transactiondatetime|txndatetime|txndate|date)/.test(h));
  const cntIdx = rawHeaders.findIndex(h => /^(totalnumberoftransaction|count|txns|txncount)/.test(h));
  const amtIdx = rawHeaders.findIndex(h => /^(amount|totalamount|volume|volumeamount)/.test(h));
  const commIdx = rawHeaders.findIndex(h => /^(commissionamount|commission|commissionrevenue)/.test(h));
  const kioskIdx = rawHeaders.findIndex(h => /^(kioskcode|kioskid|agentcode|clientid)/.test(h));
  const clientNameIdx = rawHeaders.findIndex(h => /^(clientname|name)/.test(h));
  const mobileIdx = rawHeaders.findIndex(h => /^(clientmobileno|mobile)/.test(h));
  const pNameIdx = rawHeaders.findIndex(h => /^(parentname|parent)/.test(h));
  const pMobIdx = rawHeaders.findIndex(h => /^(parentmobileno|parentmobile)/.test(h));
  const stateIdx = rawHeaders.findIndex(h => /^(state|statename)/.test(h));

  const rows = [];
  for (let i = 1; i < values.length; i++) {
    const r = values[i];
    let sName = svcIdx !== -1 && r[svcIdx] ? String(r[svcIdx]).trim() : defaultServiceName;
    const dateRaw = dateIdx !== -1 ? r[dateIdx] : '';
    const dStr = normalizeDateString(dateRaw);
    
    // Strict parsing of count and volume
    let txnCount = cntIdx !== -1 ? (Number(r[cntIdx]) || 1) : 1;
    let volume = amtIdx !== -1 ? (Number(r[amtIdx]) || 0) : 0;
    const commission = commIdx !== -1 ? (Number(r[commIdx]) || 0) : 0;
    
    // Strict Sanity checks:
    if (volume < 0) volume = 0; // NEVER negative
    if (txnCount <= 0 || txnCount > 50000) txnCount = 1; // NEVER phone numbers

    const kioskId = kioskIdx !== -1 && r[kioskIdx] ? String(r[kioskIdx]).trim() : '';
    const mobile = mobileIdx !== -1 && r[mobileIdx] ? String(r[mobileIdx]).trim() : '';
    const clientId = kioskId || (mobile ? ('CL_' + mobile) : ('CL_' + i));
    const clientName = clientNameIdx !== -1 && r[clientNameIdx] ? String(r[clientNameIdx]).trim() : ('Merchant ' + clientId);
    const parentName = pNameIdx !== -1 && r[pNameIdx] ? String(r[pNameIdx]).trim() : '-';
    const parentMobile = pMobIdx !== -1 && r[pMobIdx] ? String(r[pMobIdx]).trim() : '-';
    const state = stateIdx !== -1 && r[stateIdx] ? String(r[stateIdx]).trim() : 'Rajasthan, India';

    // Strictly skip internal Payment Gateway user
    if (isPaymentGatewayUser(clientName, mobile)) {
      continue;
    }

    // If service name is empty or missing, detect from KIOSKCODE or index
    if (!sName || sName === '-' || sName === 'General') {
      if (kioskId.startsWith('K')) sName = 'RISLRECHARGE';
      else sName = defaultServiceName || 'General';
    }

    rows.push({
      txnId: `${sName}_${dStr}_${clientId}_${i}`,
      date: dStr,
      dateRaw: dateRaw,
      clientId: clientId,
      clientName: clientName,
      mobile: mobile,
      parentName: parentName,
      parentMobile: parentMobile,
      serviceName: sName,
      txnCount: txnCount,
      volume: volume,
      commission: commission,
      state: state
    });
  }
  return rows;
}

function getMasterSalesData(ss) {
  // 1. Try 'Master Report' first
  let masterSheet = ss.getSheetByName(TABS.MASTER_REPORT);
  if (masterSheet && masterSheet.getLastRow() > 1) {
    const rows = parseSheetRows(masterSheet, 'General');
    if (rows.length > 0) return rows;
  }

  // 2. Try individual service sheets (ZAPAEPS, ZAPUPI, ZAPRECHARGE, RISLUPI, RISLDMT, RISLRECHARGE)
  let combined = [];
  for (let s = 0; s < CONFIG.SERVICE_TYPES.length; s++) {
    const sName = CONFIG.SERVICE_TYPES[s];
    const sSheet = ss.getSheetByName(sName);
    if (sSheet && sSheet.getLastRow() > 1) {
      combined = combined.concat(parseSheetRows(sSheet, sName));
    }
  }
  if (combined.length > 0) return combined;

  // 3. Try legacy 'Sales_Data'
  let salesSheet = ss.getSheetByName(TABS.SALES);
  if (salesSheet && salesSheet.getLastRow() > 1) {
    return parseSheetRows(salesSheet, 'General');
  }

  return [];
}

/**
 * Sync Clients Master automatically from Master Data records
 */
function syncClientsFromMasterData(ss, finalMasterData) {
  const clientsSheet = ss.getSheetByName(TABS.CLIENTS);
  if (!clientsSheet || finalMasterData.length <= 1) return;

  const rawHeaders = finalMasterData[0].map(h => String(h).trim().toLowerCase().replace(/[^a-z0-9]/g, ''));
  const svcIdx = rawHeaders.indexOf('servicename');
  const dateIdx = rawHeaders.findIndex(h => /^(transactiondatetime|txndatetime|txndate|date)/.test(h));
  const kioskIdx = rawHeaders.findIndex(h => /^(kioskcode|kioskid|agentcode|clientid)/.test(h));
  const clientNameIdx = rawHeaders.findIndex(h => /^(clientname|name)/.test(h));
  const mobileIdx = rawHeaders.findIndex(h => /^(clientmobileno|mobile)/.test(h));
  const pNameIdx = rawHeaders.findIndex(h => /^(parentname|parent)/.test(h));
  const pMobIdx = rawHeaders.findIndex(h => /^(parentmobileno|parentmobile)/.test(h));
  const amtIdx = rawHeaders.findIndex(h => /^(amount|totalamount|volume)/.test(h));
  const stateIdx = rawHeaders.findIndex(h => /^(state|statename)/.test(h));

  const clientsMap = new Map();
  for (let i = 1; i < finalMasterData.length; i++) {
    const r = finalMasterData[i];
    const kioskId = kioskIdx !== -1 && r[kioskIdx] ? String(r[kioskIdx]).trim() : '';
    const mobile = mobileIdx !== -1 && r[mobileIdx] ? String(r[mobileIdx]).trim() : '';
    const clientId = kioskId || (mobile ? ('CL_' + mobile) : ('CL_' + i));
    const clientName = clientNameIdx !== -1 && r[clientNameIdx] ? String(r[clientNameIdx]).trim() : ('Merchant ' + clientId);
    const parentName = pNameIdx !== -1 && r[pNameIdx] ? String(r[pNameIdx]).trim() : '-';
    const parentMobile = pMobIdx !== -1 && r[pMobIdx] ? String(r[pMobIdx]).trim() : '-';
    const sName = svcIdx !== -1 && r[svcIdx] ? String(r[svcIdx]).trim() : 'General';
    const vol = amtIdx !== -1 ? (Number(r[amtIdx]) || 0) : 0;
    const dStr = normalizeDateString(dateIdx !== -1 ? r[dateIdx] : '');
    const state = stateIdx !== -1 && r[stateIdx] ? String(r[stateIdx]).trim() : 'Rajasthan, India';

    // Strictly skip internal Payment Gateway user from Clients Master
    if (isPaymentGatewayUser(clientName, mobile)) {
      continue;
    }

    if (!clientsMap.has(clientId)) {
      clientsMap.set(clientId, {
        clientId: clientId,
        clientName: clientName,
        mobile: mobile,
        cityState: state,
        assignedUser: (clientsMap.size % 2 === 0) ? 'pooja' : 'amit',
        lastTxnDate: dStr,
        yearlySales: vol,
        followupsCount: 0,
        leadStatus: 'Active',
        primaryService: sName,
        createdAt: new Date(),
        parentName: parentName,
        parentMobile: parentMobile
      });
    } else {
      const c = clientsMap.get(clientId);
      c.yearlySales += vol;
      if (dStr > c.lastTxnDate) c.lastTxnDate = dStr;
      if (parentName !== '-' && c.parentName === '-') c.parentName = parentName;
      if (parentMobile !== '-' && c.parentMobile === '-') c.parentMobile = parentMobile;
    }
  }

  const existingData = clientsSheet.getDataRange().getValues();
  if (existingData.length <= 1) {
    const rowsToAppend = [];
    clientsMap.forEach(c => {
      rowsToAppend.push([
        c.clientId, c.clientName, c.mobile, c.cityState, c.assignedUser,
        c.lastTxnDate, c.yearlySales, c.followupsCount, c.leadStatus,
        c.primaryService, c.createdAt, c.parentName, c.parentMobile
      ]);
    });
    if (rowsToAppend.length > 0) {
      clientsSheet.getRange(2, 1, rowsToAppend.length, rowsToAppend[0].length).setValues(rowsToAppend);
    }
  }
}

/**
 * ============================================================================
 * 6. SPREADSHEET TOOLBAR MENU & SYNC SHORTCUTS
 * ============================================================================
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("⚡ Zapurse CRM")
    .addItem("📊 Update Master Report (All Services)", "updateAllServicesInMasterSheet")
    .addSeparator()
    .addItem("🔄 Quick Sync Today", "menuSyncToday")
    .addItem("📅 Sync Custom Date Range", "menuSyncFullRange")
    .addSeparator()
    .addItem("🛠️ Initialize / Reset Database Tabs", "setupDatabase")
    .addItem("⏰ Setup Automatic Daily Sync Trigger (Nightly 2 AM)", "setupDailySyncTrigger")
    .addToUi();
}

function menuSyncToday() {
  const now = new Date();
  const todayStr = Utilities.formatDate(now, 'Asia/Kolkata', 'dd-MM-yyyy');
  updateAllServicesInMasterSheet(todayStr, todayStr);
}

function menuSyncLast30Days() {
  const now = new Date();
  const past30 = new Date();
  past30.setDate(now.getDate() - 30);
  const fromStr = Utilities.formatDate(past30, 'Asia/Kolkata', 'dd-MM-yyyy');
  const toStr = Utilities.formatDate(now, 'Asia/Kolkata', 'dd-MM-yyyy');
  updateAllServicesInMasterSheet(fromStr, toStr);
}

function menuSyncFullRange() {
  const ui = SpreadsheetApp.getUi();
  const fromPrompt = ui.prompt('Zapurse MIS Sync', 'Enter From Date (DD-MM-YYYY):', ui.ButtonSet.OK_CANCEL);
  if (fromPrompt.getSelectedButton() !== ui.Button.OK) return;
  const fromDate = fromPrompt.getResponseText().trim() || '25-11-2026';

  const toPrompt = ui.prompt('Zapurse MIS Sync', 'Enter To Date (DD-MM-YYYY):', ui.ButtonSet.OK_CANCEL);
  if (toPrompt.getSelectedButton() !== ui.Button.OK) return;
  const toDate = toPrompt.getResponseText().trim() || '26-11-2026';

  updateAllServicesInMasterSheet(fromDate, toDate);
}

function syncAllZapurseServices(fromDate, toDate) {
  return updateAllServicesInMasterSheet(fromDate, toDate);
}

function cleanAndResyncDatabase(fromDate, toDate) {
  return updateAllServicesInMasterSheet(fromDate, toDate);
}

/**
 * ============================================================================
 * 7. REST API ENDPOINTS (GET & POST) FOR CRM WEB APP
 * ============================================================================
 */
function doGet(e) {
  try {
    const params = (e && e.parameter) ? e.parameter : {};
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
        responseData = updateAllServicesInMasterSheet(params.fromDate, params.toDate);
        break;

      case 'cleanResync':
        responseData = updateAllServicesInMasterSheet(params.fromDate, params.toDate);
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
        responseData = updateAllServicesInMasterSheet(payload.fromDate, payload.toDate);
        break;

      case 'cleanResync':
        responseData = updateAllServicesInMasterSheet(payload.fromDate, payload.toDate);
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
 * ============================================================================
 * 8. CRM SUB-HANDLERS (DASHBOARD, SERVICES, CALLING)
 * ============================================================================
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

function fastFormatDate(d) {
  if (!d) return '';
  if (typeof d === 'string') return d.length >= 10 ? d.substring(0, 10) : d;
  if (d instanceof Date) {
    if (isNaN(d.getTime())) return '';
    const istTime = new Date(d.getTime() + 19800000);
    const y = istTime.getUTCFullYear();
    const m = istTime.getUTCMonth() + 1;
    const day = istTime.getUTCDate();
    return y + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
  }
  return String(d);
}

function normalizeDateString(dateVal) {
  if (!dateVal) return Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyy-MM-dd');
  const str = String(dateVal).trim();
  const monthMap = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
  };

  const alphaMatch = str.match(/^(\d{1,2})\s*[-/\s]\s*([A-Za-z]{3,9})\s*[-/\s]\s*(\d{4})/);
  if (alphaMatch) {
    const day = alphaMatch[1].padStart(2, '0');
    const monStr = alphaMatch[2].substring(0, 3).toLowerCase();
    const mon = monthMap[monStr] || '01';
    const yr = alphaMatch[3];
    return `${yr}-${mon}-${day}`;
  }

  const dmyMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const mon = dmyMatch[2].padStart(2, '0');
    const yr = dmyMatch[3];
    return `${yr}-${mon}-${day}`;
  }

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
 * Initial Data Handler: calculates Dashboard KPIs, Charts, and Service Totals
 */
function getInitialDataHandler(params) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const allSales = getMasterSalesData(ss);
  const clientsSheet = ss.getSheetByName(TABS.CLIENTS);
  const callsSheet = ss.getSheetByName(TABS.CALLS);
  const configSheet = ss.getSheetByName(TABS.CONFIG);

  const clientsData = clientsSheet ? clientsSheet.getDataRange().getValues() : [];
  const callsData = callsSheet ? callsSheet.getDataRange().getValues() : [];
  const configData = configSheet ? configSheet.getDataRange().getValues() : [];

  let configMap = {};
  for (let i = 1; i < configData.length; i++) {
    configMap[configData[i][0]] = configData[i][1];
  }

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

  // Fast Loop over parsed Sales Data
  for (let i = 0; i < allSales.length; i++) {
    const s = allSales[i];
    const dStr = s.date;
    let year = 0;
    let month = -1;

    if (dStr && dStr.length >= 10) {
      year = parseInt(dStr.substring(0, 4), 10);
      month = parseInt(dStr.substring(5, 7), 10) - 1;
    }

    const txnCount = s.txnCount;
    const vol = s.volume;

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

    const sName = s.serviceName.toUpperCase();
    if (sName && sName !== '-') {
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

  // Lowest Performing Clients
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

  const recentSales = allSales.slice(-100).reverse();

  let services = CONFIG.SERVICE_TYPES;
  if (configMap['Services_List']) {
    try {
      const parsed = JSON.parse(configMap['Services_List']);
      if (Array.isArray(parsed) && parsed.length >= 6) {
        services = parsed;
        if (!services.includes('B2C')) services.push('B2C');
      }
    } catch (e) {}
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

/**
 * Service Data Handler: aggregates all volume, count, top/bottom merchants, and latest transactions for a specific service
 */
function getServiceDataHandler(serviceName) {
  if (!serviceName) return { error: 'serviceName required' };
  const targetService = String(serviceName).trim().toUpperCase();

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const allSales = getMasterSalesData(ss);

  let totalVolume = 0;
  let totalTxnCount = 0;
  const merchantMap = {};
  const transactions = [];

  for (let i = 0; i < allSales.length; i++) {
    const s = allSales[i];
    const rowSvc = s.serviceName.toUpperCase();
    if (rowSvc !== targetService && targetService !== 'ALL') {
      continue;
    }

    totalVolume += s.volume;
    totalTxnCount += s.txnCount;

    // Aggregate by Merchant
    if (s.clientId) {
      if (!merchantMap[s.clientId]) {
        merchantMap[s.clientId] = {
          clientId: s.clientId,
          clientName: s.clientName || s.clientId,
          mobile: s.mobile,
          parentName: s.parentName,
          parentMobile: s.parentMobile,
          volume: 0,
          txnCount: 0
        };
      }
      merchantMap[s.clientId].volume += s.volume;
      merchantMap[s.clientId].txnCount += s.txnCount;
      if (!merchantMap[s.clientId].mobile && s.mobile) merchantMap[s.clientId].mobile = s.mobile;
      if (merchantMap[s.clientId].parentName === '-' && s.parentName !== '-') merchantMap[s.clientId].parentName = s.parentName;
      if (merchantMap[s.clientId].parentMobile === '-' && s.parentMobile !== '-') merchantMap[s.clientId].parentMobile = s.parentMobile;
    }

    transactions.push(s);
  }

  // Merchants sorted by volume
  const merchantList = Object.values(merchantMap);
  const topMerchants = [...merchantList].sort((a, b) => b.volume - a.volume).slice(0, 5);
  const bottomMerchants = [...merchantList].sort((a, b) => a.volume - b.volume).slice(0, 5);

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

/**
 * Client History Handler: returns Timeline, Transactions, and Day-by-Day 7-Day Sales Breakdown
 */
function getClientHistoryHandler(clientId) {
  if (!clientId) return { error: 'clientId required' };
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const clientsSheet = ss.getSheetByName(TABS.CLIENTS);
  const callsSheet = ss.getSheetByName(TABS.CALLS);
  const allSales = getMasterSalesData(ss);

  let clientInfo = null;
  if (clientsSheet) {
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
  }

  // 1. Calling Timeline
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
  for (let i = 0; i < allSales.length; i++) {
    const s = allSales[i];
    if (String(s.clientId) === String(clientId)) {
      if (clientInfo && !clientInfo.parentName && s.parentName !== '-') clientInfo.parentName = s.parentName;
      if (clientInfo && !clientInfo.parentMobile && s.parentMobile !== '-') clientInfo.parentMobile = s.parentMobile;
      transactions.push(s);
    }
  }
  transactions.reverse();

  // 3. Day-by-Day 7-Day Performance
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
      match.count += Number(t.txnCount) || 1;
      if (!match.services.includes(t.serviceName)) match.services.push(t.serviceName);
      total7DayVolume += Number(t.volume) || 0;
      total7DayTxns += Number(t.txnCount) || 1;
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
    const status = String(row[8] || 'Active');
    const primaryService = String(row[9] || 'General');
    const parentName = row[11] || '-';
    const parentMobile = row[12] || '-';

    const lastTxnFormatted = fastFormatDate(lastTxnDateRaw);

    if (searchQuery) {
      const match = clientId.toLowerCase().includes(searchQuery) ||
                    clientName.toLowerCase().includes(searchQuery) ||
                    mobile.includes(searchQuery);
      if (!match) continue;
    }

    if (serviceFilter !== 'ALL' && primaryService.toLowerCase() !== serviceFilter.toLowerCase()) {
      continue;
    }

    if (minYearlySales !== null && yearlySales < minYearlySales) {
      continue;
    }

    if (inactiveFilter !== null && lastTxnFormatted) {
      const parts = lastTxnFormatted.split('-');
      if (parts.length === 3) {
        const txnDate = new Date(parts[0], parts[1] - 1, parts[2]);
        const diffDays = Math.floor((nowMs - txnDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays < inactiveFilter) continue;
      }
    }

    if (!includeToday && lastTxnFormatted === todayStr) {
      continue;
    }

    results.push({
      clientId: clientId,
      clientName: clientName,
      mobile: mobile,
      cityState: cityState,
      assignedUser: assignedUser,
      lastTxnDate: lastTxnFormatted,
      yearlySales: yearlySales,
      followupsCount: followupsCount,
      status: status,
      primaryService: primaryService,
      parentName: parentName,
      parentMobile: parentMobile
    });
  }

  return { total: results.length, clients: results };
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

  let driveFileUrl = '';
  if (payload.audioBase64) {
    try {
      const folderName = "Zapurse_Call_Recordings";
      let folderIterator = DriveApp.getFoldersByName(folderName);
      let folder;
      if (folderIterator.hasNext()) {
        folder = folderIterator.next();
      } else {
        folder = DriveApp.createFolder(folderName);
      }
      const fileName = `Call_${payload.clientId}_${Date.now()}.mp3`;
      const audioBlob = Utilities.newBlob(Utilities.base64Decode(payload.audioBase64), 'audio/mp3', fileName);
      const driveFile = folder.createFile(audioBlob);
      driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      driveFileUrl = driveFile.getUrl();
    } catch (e) {
      Logger.log('Audio save error: ' + e.message);
    }
  }

  let calendarEventId = '';
  if (payload.nextFollowup) {
    try {
      const followupDate = new Date(payload.nextFollowup);
      if (!isNaN(followupDate.getTime())) {
        const cal = CalendarApp.getDefaultCalendar();
        if (cal) {
          const event = cal.createEvent(
            `Follow-up Call: ${payload.clientName || payload.clientId}`,
            followupDate,
            new Date(followupDate.getTime() + 15 * 60 * 1000),
            { description: `Caller: ${payload.callerUser}\nNotes: ${payload.notes || ''}` }
          );
          calendarEventId = event.getId();
        }
      }
    } catch (e) {
      Logger.log('Calendar event error: ' + e.message);
    }
  }

  const callId = 'CALL' + Date.now();
  callsSheet.appendRow([
    callId,
    new Date(),
    payload.clientId,
    payload.clientName || '',
    payload.callerUser || 'pooja',
    payload.callOutcome || 'Connected',
    JSON.stringify(payload.qaResponses || {}),
    driveFileUrl,
    payload.nextFollowup || '',
    calendarEventId,
    payload.notes || ''
  ]);

  const cData = clientsSheet.getDataRange().getValues();
  for (let i = 1; i < cData.length; i++) {
    if (String(cData[i][0]) === String(payload.clientId)) {
      const currentFollowups = Number(cData[i][7]) || 0;
      const newFollowups = currentFollowups + 1;
      clientsSheet.getRange(i + 1, 8).setValue(newFollowups);

      if (newFollowups >= maxLimit) {
        clientsSheet.getRange(i + 1, 9).setValue('Locked');
      } else if (payload.leadStatus) {
        clientsSheet.getRange(i + 1, 9).setValue(payload.leadStatus);
      }
      break;
    }
  }

  return { success: true, callId: callId, recordingUrl: driveFileUrl };
}

function getAdminConfigHandler() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const configSheet = ss.getSheetByName(TABS.CONFIG);
  const usersSheet = ss.getSheetByName(TABS.USERS);

  let config = {};
  if (configSheet) {
    const cData = configSheet.getDataRange().getValues();
    for (let i = 1; i < cData.length; i++) {
      let val = cData[i][1];
      try { val = JSON.parse(val); } catch (e) {}
      config[cData[i][0]] = val;
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
        allowedServices: String(uData[i][5]).split(','),
        allowedModules: String(uData[i][6]).split(','),
        status: uData[i][7],
        lastLogin: uData[i][8] ? fastFormatDate(uData[i][8]) : 'Never'
      });
    }
  }

  return { config: config, users: users };
}

function saveAdminConfigHandler(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const configSheet = ss.getSheetByName(TABS.CONFIG);
  if (!configSheet) return { success: false, message: 'Config sheet missing' };

  const data = configSheet.getDataRange().getValues();
  const settings = payload.settings || {};

  Object.keys(settings).forEach(key => {
    let valueStr = typeof settings[key] === 'object' ? JSON.stringify(settings[key]) : String(settings[key]);
    let found = false;
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === key) {
        configSheet.getRange(i + 1, 2).setValue(valueStr);
        configSheet.getRange(i + 1, 4).setValue(new Date());
        found = true;
        break;
      }
    }
    if (!found) {
      configSheet.appendRow([key, valueStr, 'Admin setting: ' + key, new Date()]);
    }
  });

  return { success: true, message: 'Configuration saved successfully' };
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
      payload.name || 'CRM Staff',
      payload.username,
      payload.password || '123456',
      payload.role || 'Caller',
      Array.isArray(payload.allowedServices) ? payload.allowedServices.join(',') : 'ZAPAEPS,ZAPRECHARGE,RISLDMT',
      Array.isArray(payload.allowedModules) ? payload.allowedModules.join(',') : 'calling',
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
    return { success: false, message: 'User ID not found' };
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
      const user = calls[i][4] || 'pooja';
      if (!callerStats[user]) {
        callerStats[user] = { user: user, totalCalls: 0, connected: 0, busy: 0, rnr: 0, notInterested: 0 };
      }
      callerStats[user].totalCalls++;
      const outcome = String(calls[i][5]).toLowerCase();
      if (outcome.includes('connect')) callerStats[user].connected++;
      else if (outcome.includes('busy')) callerStats[user].busy++;
      else if (outcome.includes('not')) callerStats[user].notInterested++;
      else callerStats[user].rnr++;
    }
  }

  let clientMatrix = [];
  if (clientsSheet) {
    const cData = clientsSheet.getDataRange().getValues();
    for (let i = 1; i < Math.min(cData.length, 100); i++) {
      clientMatrix.push({
        clientId: cData[i][0],
        clientName: cData[i][1],
        mobile: cData[i][2],
        service: cData[i][9],
        yearlySales: Number(cData[i][6]) || 0,
        followups: Number(cData[i][7]) || 0,
        status: cData[i][8]
      });
    }
  }

  return { callers: Object.values(callerStats), matrix: clientMatrix };
}

/**
 * ============================================================================
 * 9. DATABASE INITIALIZATION & TRIGGERS
 * ============================================================================
 */
function setupDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheetsExist(ss);
  return { success: true, message: 'Zapurse CRM Database Sheets Initialized Successfully!' };
}

function ensureSheetsExist(ss) {
  let masterSheet = getOrCreateSheet(ss, TABS.MASTER_REPORT);
  if (masterSheet.getLastRow() === 0) {
    masterSheet.appendRow(["Service Name", "TransactionDateTime", "TotalNumberoftransaction", "Client_Name", "Client_MobileNo", "Amount", "State"]);
    masterSheet.getRange(1, 1, 1, 7).setFontWeight('bold').setBackground('#0f172a').setFontColor('#ffffff');
  }

  let userSheet = getOrCreateSheet(ss, TABS.USERS);
  if (userSheet.getLastRow() === 0) {
    userSheet.appendRow(['User_ID', 'Full_Name', 'Username', 'Password', 'Role', 'Allowed_Services', 'Allowed_Modules', 'Status', 'Last_Login']);
    userSheet.getRange(1, 1, 1, 9).setFontWeight('bold').setBackground('#0f172a').setFontColor('#ffffff');
    userSheet.appendRow(['USR001', 'Admin Master', 'admin', 'admin123', 'Admin', 'ALL', 'ALL', 'Active', new Date()]);
    userSheet.appendRow(['USR002', 'Rahul Manager', 'rahul', 'rahul123', 'Manager', 'ALL', 'dashboard,services,calling,reports', 'Active', '']);
    userSheet.appendRow(['USR003', 'Pooja Caller', 'pooja', 'pooja123', 'Caller', 'ZAPAEPS,ZAPRECHARGE,RISLDMT', 'calling', 'Active', '']);
  }

  let configSheet = getOrCreateSheet(ss, TABS.CONFIG);
  if (configSheet.getLastRow() === 0) {
    configSheet.appendRow(['Config_Key', 'Config_Value', 'Description', 'Updated_At']);
    configSheet.getRange(1, 1, 1, 4).setFontWeight('bold').setBackground('#0f172a').setFontColor('#ffffff');
    configSheet.appendRow(['Services_List', JSON.stringify(CONFIG.SERVICE_TYPES), 'Active Fintech Services', new Date()]);
    configSheet.appendRow(['Max_Followup_Limit', '5', 'Max calls before client lock', new Date()]);
    configSheet.appendRow(['Yearly_Min_Sales_Condition', '50000', 'Threshold for dormant client alert', new Date()]);
  }

  let clientsSheet = getOrCreateSheet(ss, TABS.CLIENTS);
  if (clientsSheet.getLastRow() === 0) {
    clientsSheet.appendRow(['Client_ID', 'Client_Name', 'Mobile', 'City_State', 'Assigned_User', 'Last_Txn_Date', 'Yearly_Sales', 'Total_Followups_Count', 'Lead_Status', 'Primary_Service', 'Created_At', 'Parent_Name', 'Parent_Mobile']);
    clientsSheet.getRange(1, 1, 1, 13).setFontWeight('bold').setBackground('#0f172a').setFontColor('#ffffff');
  }

  let callSheet = getOrCreateSheet(ss, TABS.CALLS);
  if (callSheet.getLastRow() === 0) {
    callSheet.appendRow(['Call_ID', 'Timestamp', 'Client_ID', 'Client_Name', 'Caller_User', 'Call_Outcome', 'QA_Responses', 'Recording_Drive_URL', 'Next_Followup_DateTime', 'Calendar_Event_ID', 'Notes']);
    callSheet.getRange(1, 1, 1, 11).setFontWeight('bold').setBackground('#0f172a').setFontColor('#ffffff');
  }

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

function setupDailySyncTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'dailyNightlySync') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  ScriptApp.newTrigger('dailyNightlySync')
    .timeBased()
    .atHour(2)
    .everyDays(1)
    .inTimezone('Asia/Kolkata')
    .create();

  showSafeAlert('Automation Trigger Installed', 'Daily automatic sync is scheduled at 2:00 AM IST nightly.');
}

function dailyNightlySync() {
  const now = new Date();
  const past30 = new Date();
  past30.setDate(now.getDate() - 30);
  const fromStr = Utilities.formatDate(past30, 'Asia/Kolkata', 'dd-MM-yyyy');
  const toStr = Utilities.formatDate(now, 'Asia/Kolkata', 'dd-MM-yyyy');
  updateAllServicesInMasterSheet(fromStr, toStr);
}
