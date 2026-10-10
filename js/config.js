export const CONFIG = {
  WORKER_URL: "https://dic1-x-dock.tjs70491.workers.dev/",
  GAS_URL: "",       // GAS 백업용 URL
  // 추후 Cloudflare Durable Objects 연동 시 활용할 WebSocket URL 규격
  DO_WS_URL: "wss://dic1-x-dock.tjs70491.workers.dev/ws",
  
  BACKEND: "WORKER", // "WORKER" 또는 "GAS"
  
  HUB_MAP: { 
    "부천3": "클러스터", 
    "광주": "경기광주1" 
  },

  HUB_LIST: [
    "직접선택", "클러스터", "SF부천3", "경기광주1", "고양1", "곤지암1", "동탄1", "마장1",
    "목천1", "부천1", "부천2", "서울1", "시흥2", "안산2", "안성4", "안성5",
    "안성8", "이천2", "이천3", "이천4", "인천4", "인천5", "인천11", "인천12",
    "인천14", "인천14CFC", "인천15", "인천16", "인천22", "인천28", "인천30", "인천45",
    "전라광주2", "창원1", "천안2", "천안6", "평택1"
  ],
  
  FRESH_HUBS: new Set(['인천11', '인천15', '부천2', '인천12', '인천22', '곤지암1']),
  
  SYNC: { 
    WORK_END_HOUR: 10, // 24시간 가동으로 전환시 폐지
    CHECKLIST_MS: 10000, // DO 연동 시 폐지
    DASHBOARD_MS: 5000  // DO 연동 않고 5초 폴링 vs. DO 연동 하고 폐지
  },
  
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
