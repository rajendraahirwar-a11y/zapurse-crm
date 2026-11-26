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
    'RISLUPI',
    'RISLDMT',
    'RISLRECHARGE'
  ],

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
  }
};
