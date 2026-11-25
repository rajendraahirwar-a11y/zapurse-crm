/**
 * ==============================================================================
 * ZAPURSE FINTECH CRM - CONFIGURATION & STATE STORE
 * ==============================================================================
 */

const Config = {
  // Storage Keys
  STORAGE_KEY_API_URL: 'zapurse_crm_api_url',
  STORAGE_KEY_USER: 'zapurse_crm_active_user',
  STORAGE_KEY_DEMO_MODE: 'zapurse_crm_demo_mode',

  // Default Services Catalog (Exact Zapurse API Service Types)
  DEFAULT_SERVICES: [
    'ZAPAEPS',
    'ZAPUPI',
    'ZAPRECHARGE',
    'RISLUPI',
    'RISLDMT',
    'RISLRECHARGE'
  ],

  // Default Dynamic Questions for Calling Script
  DEFAULT_QUESTIONS: [
    { id: 'q1', text: 'Call Connect Status', type: 'select', options: ['Connected with Owner', 'Connected with Staff', 'Call Later', 'Wrong Number'] },
    { id: 'q2', text: 'Reason for Drop in Transactions', type: 'select', options: ['Server/Technical Issues', 'Margin/Commission Issue', 'Switched to Competitor', 'Low Customer Footfall', 'Banking Portal Blocked', 'Other'] },
    { id: 'q3', text: 'Competitor Portal (If applicable)', type: 'text', placeholder: 'e.g. Spice Money, PayNearby, RNFI' },
    { id: 'q4', text: 'Customer Satisfaction Rating', type: 'select', options: ['5 - Highly Satisfied', '4 - Satisfied', '3 - Neutral', '2 - Dissatisfied', '1 - Very Unhappy'] },
    { id: 'q5', text: 'Commitment for Next Txn', type: 'select', options: ['Will start today', 'Within 2-3 days', 'Next week', 'Not interested'] },
    { id: 'q6', text: 'Specific Remarks / Feedback', type: 'textarea', placeholder: 'Detailed call summary & merchant feedback...' }
  ],

  // System Rule Defaults
  DEFAULT_MAX_FOLLOWUPS: 5,
  DEFAULT_MIN_YEARLY_SALES: 50000,

  /**
   * Get Active Google Apps Script Web App URL
   */
  getApiUrl() {
    return localStorage.getItem(this.STORAGE_KEY_API_URL) || '';
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
   * Check if running in Standalone Demo Mode (when no API URL is configured)
   */
  isDemoMode() {
    const manualDemo = localStorage.getItem(this.STORAGE_KEY_DEMO_MODE) === 'true';
    const noUrl = !this.getApiUrl();
    return manualDemo || noUrl;
  },

  setDemoMode(enable) {
    localStorage.setItem(this.STORAGE_KEY_DEMO_MODE, enable ? 'true' : 'false');
  }
};
