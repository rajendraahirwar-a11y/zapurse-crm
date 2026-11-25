# 🚀 Zapurse Fintech CRM — Google Apps Script Backend Setup Guide

Is guide me bataya gaya hai ki **2 minute** me Google Sheet aur Google Apps Script backend kaise deploy karein:

---

### Step 1: Nayi Google Sheet Banayein
1. [Google Sheets](https://sheets.new) par jayein aur ek nayi blank spreadsheet banayein.
2. Iska naam rakhein: **`Zapurse_CRM_DB`**.

---

### Step 2: Google Apps Script Editor Kholein
1. Google Sheet ke menu me **Extensions** > **Apps Script** par click karein.
2. Code editor me jo default `function myFunction() {}` hai use pura delete kar dein.
3. Hamare project ke `backend/Code.gs` file ka pura code copy karke wahan paste kar dein.
4. File ko save karein (**Ctrl + S** ya Save icon).

---

### Step 3: Database & Demo Data Initialize Karein (One-Click Setup)
1. Apps Script editor ke top toolbar me function dropdown me se **`setupDatabase`** select karein.
2. **Run** button par click karein.
3. Pehli baar Google aapse Permissions mangega:
   - **Review Permissions** par click karein.
   - Apna Google Account select karein.
   - **Advanced** par click karein aur niche **Go to Untitled project (unsafe)** par click karein.
   - **Allow** par click karein.
4. Script run hote hi aapki Google Sheet me **6 Master Tabs** auto-create ho jayenge:
   - `Users` (Default Admin login: `admin` / `admin123`)
   - `Sales_Data` (ZAP AEPS, RISLDMT, ZAPUPI, etc. ki sample sales)
   - `Clients_Master` (Different inactivity days wale sample clients)
   - `Calling_Logs` (Sample call history)
   - `Admin_Config` (Dynamic questions, limits & services list)
   - `API_Sync_Logs` (Sync status logs)

---

### Step 4: Web App Deploy Karein (API URL Prapt Karein)
1. Top right corner me **Deploy** button par click karein > **New deployment**.
2. Left side gear icon par click karke **Web app** select karein.
3. Form me yeh settings bharein:
   - **Description:** `Zapurse CRM API v1`
   - **Execute as:** `Me (aapka email)`
   - **Who has access:** **`Anyone`** *(Yeh zaroori hai taaki GitHub Pages frontend bina Google login issue ke API call kar sake)*.
4. **Deploy** button par click karein.
5. Deployment complete hote hi aapko **Web app URL** milega (e.g., `https://script.google.com/macros/s/AKfycbx.../exec`).
6. **Is URL ko copy kar lijiye!** Yeh URL frontend ke `js/config.js` me dalna hoga.

---

### Step 5: Test Connection
Aap is URL ko browser me khol kar check kar sakte hain:
`https://script.google.com/macros/s/.../exec?action=ping`
Agar aapko `{"status":"ONLINE","app":"Zapurse Fintech CRM API"}` dikhe, to aapka backend 100% active hai!
