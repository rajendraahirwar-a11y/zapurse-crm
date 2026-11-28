/**
 * ==============================================================================
 * ZAPURSE FINTECH CRM - CONFIGURATION & STATE STORE
 * ==============================================================================
 */

const Config = {
  // Default Permanent Live Google Apps Script Web App URL
  DEFAULT_API_URL: 'https://script.google.com/macros/s/AKfycbwWTIOKwbKAbYULkoQfAUubevtRqpQ71kDiaQ8vp3vPy--uMT3o2gFx2fveFPd6Ayo2DA/exec',

  // Storage Keys
  STORAGE_KEY_API_URL: 'zapurse_crm_api_url',
  STORAGE_KEY_USER: 'zapurse_crm_active_user',
  STORAGE_KEY_DEMO_MODE: 'zapurse_crm_demo_mode',
  STORAGE_KEY_THEME: 'zapurse_theme',

  // Default Services Catalog (Exact Zapurse API Service Types)
  DEFAULT_SERVICES: [
    'ZAPAEPS',
    'ZAPUPI',
    'ZAPRECHARGE',
    'B2C',
    'RISLUPI',
    'RISLDMT',
    'RISLRECHARGE',
    'RISLMOBILEAPP'
  ],

  // Visual & Feature Metadata for Services Catalog
  SERVICE_META: {
    'ZAPAEPS': {
      title: 'ZAP AEPS',
      icon: 'fingerprint',
      badge: 'AEPS Micro-ATM',
      desc: 'Aadhaar Enabled Payment System sales, cash-out & balance stats'
    },
    'ZAPUPI': {
      title: 'ZAP UPI',
      icon: 'qr-code',
      badge: 'UPI QR Pay',
      desc: 'Dynamic UPI QR collections, gateway transactions & settlements'
    },
    'ZAPRECHARGE': {
      title: 'ZAP RECHARGE',
      icon: 'smartphone',
      badge: 'Utility & Mobile',
      desc: 'Mobile prepaid/postpaid, DTH & fast bill payment transactions'
    },
    'B2C': {
      title: 'B2C GATEWAY',
      icon: 'credit-card',
      badge: 'B2C Gateway',
      desc: 'Direct consumer recharge, payments & gateway transaction reports'
    },
    'RISLUPI': {
      title: 'RISL UPI',
      icon: 'landmark',
      badge: 'Govt RISL Portal',
      desc: 'Govt of Rajasthan RISL digital portal UPI payment streams'
    },
    'RISLDMT': {
      title: 'RISL DMT',
      icon: 'send',
      badge: 'Money Transfer',
      desc: 'Domestic Money Transfer & direct account IMPS/NEFT payouts'
    },
    'RISLRECHARGE': {
      title: 'RISL RECHARGE',
      icon: 'zap',
      badge: 'RISL Bill Pay',
      desc: 'Govt RISL utility bills, electricity & E-Mitra recharge services'
    },
    'RISLMOBILEAPP': {
      title: 'RISL MOBILE APP',
      icon: 'smartphone',
      badge: 'RISL App Pay',
      desc: 'Govt RISL Mobile Application transactions & digital payments'
    }
  },

  // Default Dynamic Questions for Calling Script (Configured to User Exact Requirements)
  DEFAULT_QUESTIONS: [
    { 
      id: 'q1', 
      text: 'Call Status', 
      type: 'select', 
      options: [
        'Connected with Owner', 
        'Connected with Staff', 
        'Call Later / Busy', 
        'Ringing No Response (RNR)', 
        'Switched Off / Not Reachable', 
        'Wrong Number'
      ] 
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
  ],

  // System Rule Defaults
  DEFAULT_MAX_FOLLOWUPS: 5,
  DEFAULT_MIN_YEARLY_SALES: 50000,

  /**
   * Get Active Google Apps Script Web App URL
   */
  getApiUrl() {
    return localStorage.getItem(this.STORAGE_KEY_API_URL) || this.DEFAULT_API_URL;
  },

  /**
   * Set Google Apps Script Web App URL
   */
  setApiUrl(url) {
    if (url) {
      localStorage.setItem(this.STORAGE_KEY_API_URL, url.trim());
      localStorage.setItem(this.STORAGE_KEY_DEMO_MODE, 'false');
    } else {
      localStorage.removeItem(this.STORAGE_KEY_API_URL);
    }
  },

  /**
   * Check if running in Standalone Demo Mode (default: false since live URL is configured)
   */
  isDemoMode() {
    const manualDemo = localStorage.getItem(this.STORAGE_KEY_DEMO_MODE) === 'true';
    const noUrl = !this.getApiUrl();
    return manualDemo || (noUrl && !this.DEFAULT_API_URL);
  },

  setDemoMode(enable) {
    localStorage.setItem(this.STORAGE_KEY_DEMO_MODE, enable ? 'true' : 'false');
  },

  /**
   * Check if client/merchant is internal payment gateway user to skip
   */
  isPaymentGatewayUser(name, mobile) {
    const cleanName = String(name || '').toUpperCase().replace(/\s+/g, ' ').trim();
    const cleanMobile = String(mobile || '').trim();
    if (cleanName.includes('PAYMENTGATEWAY') || cleanName.includes('PAYMENT GATEWAY')) return true;
    if (cleanName.includes('ZAPURSE PAYMENTGATEWAY USER')) return true;
    if (cleanMobile === '7024219540') return true;
    return false;
  },

  /**
   * Universal Service Badge Component (Crisp & High Contrast in both Dark & Light Themes)
   */
  getServiceBadgeHtml(serviceName) {
    const s = String(serviceName || 'General').toUpperCase().trim();
    let themeClass = 'srv-badge-default';
    if (s.includes('AEPS')) themeClass = 'srv-badge-aeps';
    else if (s === 'B2C' || s.includes('B2C')) themeClass = 'srv-badge-b2c';
    else if (s.includes('MOBILEAPP') || s.includes('MOBILE_APP') || s.includes('APP')) themeClass = 'srv-badge-rislapp';
    else if (s.includes('UPI')) themeClass = 'srv-badge-upi';
    else if (s.includes('RECHARGE')) themeClass = 'srv-badge-recharge';
    else if (s.includes('DMT')) themeClass = 'srv-badge-dmt';

    return `<span class="service-pill-badge ${themeClass}">${serviceName || 'General'}</span>`;
  }
};
