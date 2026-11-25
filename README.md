# ⚡ Zapurse Fintech CRM — Sales & Smart Calling Command Center

Ek modern, superfast, zero-server-cost **Fintech CRM** jo **GitHub Pages** (Frontend) aur **Google Apps Script + Google Sheets** (Backend & Database) ke Hybrid Architecture par chalta hai.

---

## 🌟 Key Highlights & Architecture

1. **Lightning Fast & PWA App Ready:**
   - HTML5 + Tailwind CSS + Vanilla JS + Chart.js + SweetAlert2.
   - Mobile par instant khulega bina kisi Google iframe delay ke.
   - Android & iOS par **"Install App" / "Add to Home screen"** karke native app ki tarah chalta hai.
2. **Zero Server Cost & 100% Data Privacy:**
   - Saara data aapke hi Google Account (Google Sheets + Google Drive) me secure rehta hai.
   - Koi third-party monthly hosting fee nahi.
3. **Core Fintech Services Out-of-the-Box:**
   - `ZAP AEPS`, `ZAPRECHARGE`, `ZAPUPI`, `RISLDMT`, `RISLUPI`, `RISL RECHARGE` + Admin nayi services kabhi bhi add kar sakta hai.
4. **Smart Calling Engine:**
   - One-Click Inactivity Filters: **4 Days, 7 Days, 10 Days, 15 Days, 30 Days, 3 Months**.
   - **Include / Exclude Today's Sales** live switch.
   - **Direct Phone Dialer button** (`tel:` link).
   - **Past History Timeline** + purani call recordings sunne ka **Audio Player**.
   - **Dynamic Questions Form** (Admin dynamic questionnaire set kar sakta hai).
   - **Recording File Upload** seedha aapke **Google Drive** folder (`Zapurse_Call_Recordings`) me upload hota hai.
   - **Next Follow-up Scheduler** caller ke **Google Calendar** me automatic reminder event banata hai.
   - **Max Follow-up Lock protection** (Admin limit jaise 5 calls hote hi client auto-lock).
5. **Interactive Analytics:**
   - Jan–Dec Monthly Sales Bar Chart jisme **highest month Green** aur **lowest month Red** highlight hota hai.
   - Lowest performing clients alert box with 1-click retention calling.
   - Caller productivity metrics (Connected rate %, Busy, RNR).

---

## 📁 Project Structure

```text
d:\ZAP_CRM\
├── index.html               # Main CRM Single Page Application (GitHub Pages ready)
├── manifest.json            # PWA manifest (Installable as Android/iOS app)
├── sw.js                   # Service Worker for fast caching & offline-ready shell
├── css/
│   └── styles.css          # Fintech dark theme styling & smooth animations
├── js/
│   ├── config.js           # Configuration, API URLs & system defaults
│   ├── api.js              # Fetch client communicating with Google Apps Script + Demo Mode fallback
│   ├── auth.js             # Authentication, session & role permissions (Admin/Manager/Caller)
│   ├── dashboard.js        # KPI cards, Chart.js monthly chart, master sales table
│   ├── services.js         # Dedicated views for ZAP AEPS, ZAPUPI, RISLDMT, etc.
│   ├── calling.js          # Smart Calling Engine, filters, drawer, audio upload & calendar sync
│   ├── reports.js          # Matrix and caller productivity analytics + CSV export
│   ├── admin.js            # Admin control panel (Users, Dynamic Questions, Limits, Services)
│   └── app.js              # Routing, layout, navigation & sync orchestrator
└── backend/
    ├── Code.gs             # Complete Google Apps Script backend source code
    └── README_DEPLOY.md    # Step-by-step Apps Script deployment guide
```

---

## 🚀 Step-by-Step Deployment Guide

### Step 1: Google Sheet & Backend Setup (Sirf 2 Minute)

1. [Google Sheets](https://sheets.new) par jayein aur ek nayi sheet banayein jiska naam rakhein: `Zapurse_CRM_DB`.
2. Menu me **Extensions** > **Apps Script** par click karein.
3. Hamare folder `backend/Code.gs` ka pura code copy karke wahan paste karein aur **Save (Ctrl + S)** karein.
4. Top toolbar me function dropdown se **`setupDatabase`** select karke **Run** par click karein.
   *(Pehli baar Google permissions allow karein)*.
   - Yeh aapki sheet me 6 tabs auto-create kar dega: `Users`, `Sales_Data`, `Clients_Master`, `Calling_Logs`, `Admin_Config`, `API_Sync_Logs` sample data ke saath!
5. Apps Script editor ke top-right me **Deploy** > **New deployment** par click karein:
   - Select type: **Web app**
   - Description: `Zapurse CRM API`
   - Execute as: **Me**
   - Who has access: **Anyone** *(Zaroori taaki frontend connect kar sake)*
6. **Deploy** button dabayein aur apna **Web app URL** copy kar lijiye.

*(Visual step guide ke liye dekhein: [`backend/README_DEPLOY.md`](backend/README_DEPLOY.md))*

---

### Step 2: GitHub Pages par Frontend Deploy Karein (Free Hosting)

1. [GitHub](https://github.com) par ek naya repository banayein (e.g. `zapurse-crm`).
2. Is repository me hamare project ke saare files push karein:
   ```bash
   git init
   git add .
   git commit -m "Initial commit for Zapurse Fintech CRM"
   git branch -M main
   git remote add origin https://github.com/<your-username>/zapurse-crm.git
   git push -u origin main
   ```
3. GitHub repo me **Settings** > **Pages** par jayein.
4. **Build and deployment** section me:
   - Source: **Deploy from a branch**
   - Branch: **`main`** / Folder: **`/(root)`**
   - **Save** par click karein.
5. 1 minute me aapka live link ready ho jayega: `https://<your-username>.github.io/zapurse-crm/`.

---

### Step 3: Connect Frontend to Backend

1. Apne GitHub Pages URL ya local `index.html` ko browser me kholein.
2. Login screen par **Backend URL Config** par click karein (ya Admin panel me **Backend Connection API** tab me jayein).
3. Step 1 me mila hua **Google Apps Script Web App URL** paste karein aur **Save & Connect** par click karein.
4. **Ping Test** dabakar status check karein — screen par `API Online` ka green badge dikhai dega!

---

## 🔑 Default Login Credentials

Aap turant login karke test kar sakte hain (Demo mode me ya live Google Sheet ke saath):

| Role | Username | Password | Access Rights |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin` | `admin123` | Full access (Dashboard, Services, Calling, Reports, Admin Panel, Settings) |
| **Manager** | `rahul` | `rahul123` | Dashboard, Services, Calling, Reports (Admin panel hidden) |
| **Caller** | `pooja` | `pooja123` | Dashboard, Calling (Services: ZAP AEPS, ZAPUPI, ZAPRECHARGE) |
| **Caller** | `amit` | `amit123` | Dashboard, Calling (Services: RISLDMT, RISLUPI, RISL RECHARGE) |

---

## 📱 Mobile App (PWA) Installation

- **Android (Chrome):** Site open karne par niche **"Add Zapurse CRM to Home screen"** ka banner aayega, ya 3-dots menu dabakar **"Install App"** select karein.
- **iPhone (Safari):** Safari share button (share icon) dabayein aur **"Add to Home Screen"** select karein.
- Phone ki home screen par Zapurse Fintech ka icon ban jayega aur ekdam native app ki tarah bina URL bar ke full-screen chalega!
