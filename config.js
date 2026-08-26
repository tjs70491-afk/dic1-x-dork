const CONFIG = {
  // 1. 구글 앱스 스크립트 배포 URL (이곳 1개만 수정하면 전체 반영)
  GAS_URL: "https://script.google.com/macros/s/AKfycbx2XhmbMmbn3GazWjFUYMBgqd2UUBaXT5I-3biOMdaHh5NnV6kPYEZ55hT0pD8bop9UvA/exec",

  // 2. 허브 이름 치환 규칙
  HUB_MAP: {
    "부천3": "클러스터",
    "광주": "경기광주1"
  },

  // 3. 신선 허브 목록 (다이아몬드 ◇ 표시 대상)
  FRESH_HUBS: new Set(['인천11', '인천15', '부천2', '인천12', '인천22', '곤지암1']),

  // 4. 근무 및 동기화 주기 설정
  SYNC: {
    WORK_END_HOUR: 10,       // 자동 동기화 종료 시간 (오전 10시)
    CHECKLIST_MS: 10 * 1000, // 체크리스트 갱신 주기 (10초)
    DASHBOARD_MS: 30 * 1000  // 대시보드/아카이브 갱신 주기 (30초)
  },

  // 5. 권한별 접근 허용 페이지
  PERMISSIONS: {
    checklist: ["ADMIN", "helper", "signal", "guest"],
    archive: ["ADMIN", "helper", "SeniorHelperLeader", "field-admin", "X-mover"]
  },

  // 6. SVG 아이콘 리소스
  ICONS: {
    empty: '<svg class="icon-svg" viewBox="0 0 24 24" fill="none"><rect x="3.5" y="3.5" width="17" height="17" rx="4" stroke="#b0bec5" stroke-width="2" fill="none"/></svg>',
    checked: '<svg class="icon-svg" viewBox="0 0 24 24" fill="none"><path d="M5.5 13.5L9.5 17.5L18.5 8.5" stroke="#2e7d32" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    doubleChecked: '<svg class="icon-svg" viewBox="0 0 24 24" fill="none"><path d="M7 8.5L10.5 12L17.5 5" stroke="#2e7d32" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M4.5 15L9.5 20L19.5 10" stroke="#2e7d32" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  }
};

// 7. 모든 페이지에서 공통으로 쓰는 유틸리티 헬퍼
const UTILS = {
  // XSS 방지 HTML escape
  escapeHtml: function(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  // 인증 키 로드 및 갱신 (URL 파라미터 우선 -> localStorage 확인)
  getAuthKey: function() {
    const urlParams = new URLSearchParams(window.location.search);
    const key = urlParams.get('key') || localStorage.getItem("APP_KEY");
    if (key) localStorage.setItem("APP_KEY", key);
    return key;
  },

  // 사용자 권한 로드
  getUserType: function() {
    return localStorage.getItem("USER_TYPE") || "guest";
  },

  // 허브 이름 포맷 변환 (부천3 -> 클러스터 등)
  getHubDisplayName: function(hub) {
    return CONFIG.HUB_MAP[hub] || hub;
  },

  getTypeClassStr: function(type) {
    switch (true) {
            case /신선/.test(type):
              return "fresh";
            case /PB|PICO/.test(type):
              return "pb";
            case /이형/.test(type):
              return "irr";
            default:
              return "sioc";
          }
  },
  
  getUnloadingStatus: function(PT = 0, RT = 0, type = 1) {
    let unloadingStatus = [];
    if (PT > 0) unloadingStatus.push({ type: 'PT', num: PT });
    if (RT > 0) unloadingStatus.push({ type: 'RT', num: RT });

    if (type === 1) {
      return unloadingStatus.map(item => `${item.type} ${item.num}`).join(" + ");
    } else {
      return unloadingStatus.map(item => `${item.type} : ${item.num}개`).join(", ");
    }
  }
};
