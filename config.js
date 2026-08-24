const CONFIG = {
  GAS_URL: "https://script.google.com/macros/s/AKfycbyPol8QpXLKNpiMZ_xJoVlp4TThiQP9m4kD3Ffj8tz9mT7ScJNsUKD_ocmWdJOiv8JJqA/exec",

  HUB_MAP: {
    "부천3": "클러스터",
    "광주": "경기광주1"
  },

  FRESH_HUBS: new Set(['인천11', '인천15', '부천2', '인천12', '인천22', '곤지암1']),

  SYNC: {
    WORK_END_HOUR: 10,       // 자동 동기화 종료 시간 (오전 10시)
    CHECKLIST_MS: 10 * 1000, // 체크리스트 갱신 주기 (10초)
    DASHBOARD_MS: 30 * 1000  // 대시보드/아카이브 갱신 주기 (30초)
  },

  PERMISSIONS: {
    checklist: ["ADMIN", "helper", "signal", "guest"],
    archive: ["ADMIN", "helper", "SeniorHelperLeader", "field-admin", "X-mover"]
  },

  ICONS: {
    empty: '<svg class="icon-svg" viewBox="0 0 24 24" fill="none"><rect x="3.5" y="3.5" width="17" height="17" rx="4" stroke="#b0bec5" stroke-width="2" fill="none"/></svg>',
    checked: '<svg class="icon-svg" viewBox="0 0 24 24" fill="none"><path d="M5.5 13.5L9.5 17.5L18.5 8.5" stroke="#2e7d32" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    doubleChecked: '<svg class="icon-svg" viewBox="0 0 24 24" fill="none"><path d="M7 8.5L10.5 12L17.5 5" stroke="#2e7d32" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M4.5 15L9.5 20L19.5 10" stroke="#2e7d32" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  }
};

const UTILS = {
  escapeHtml: function(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  getAuthKey: function() {
    const urlParams = new URLSearchParams(window.location.search);
    const key = urlParams.get('key') || localStorage.getItem("APP_KEY");
    if (key) localStorage.setItem("APP_KEY", key);
    return key;
  },

  getUserType: function() {
    return localStorage.getItem("USER_TYPE") || "guest";
  },

  getHubDisplayName: function(hub) {
    return CONFIG.HUB_MAP[hub] || hub;
  }
};
