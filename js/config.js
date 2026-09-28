const CONFIG = {
  WORKER_URL: "https://dic1-x-dock.tjs70491.workers.dev/",
  HUB_MAP: { "부천3": "클러스터", "광주": "경기광주1" },
  FRESH_HUBS: new Set(['인천11', '인천15', '부천2', '인천12', '인천22', '곤지암1']),
  SYNC: { WORK_END_HOUR: 10, CHECKLIST_MS: 10000, DASHBOARD_MS: 30000 },
  PERMISSIONS: {
    checklist: ["ADMIN", "signal", "guest"],
    archive: ["ADMIN", "SeniorHelperLeader", "HelperLeader", "field-admin", "X-mover"]
  },
  ICONS: {
    empty: '<svg viewBox="0 0 24 24" fill="none"><rect x="3.5" y="3.5" width="17" height="17" rx="4" stroke="#b0bec5" stroke-width="2"/></svg>',
    checked: '<svg viewBox="0 0 24 24" fill="none"><path d="M5.5 13.5L9.5 17.5L18.5 8.5" stroke="#2e7d32" stroke-width="3.2"/></svg>',
    doubleChecked: '<svg viewBox="0 0 24 24" fill="none"><path d="M7 8.5L10.5 12L17.5 5" stroke="#2e7d32" stroke-width="2.8"/><path d="M4.5 15L9.5 20L19.5 10" stroke="#2e7d32" stroke-width="3.2"/></svg>'
  }
};
