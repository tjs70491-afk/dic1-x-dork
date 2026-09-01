const CONFIG = {
  // 1. 구글 앱스 스크립트 배포 URL
  GAS_URL: "https://script.google.com/macros/s/AKfycbxysjwDijC1mJOZ4-w5jtrF9eydg0xxzS9CwPAOK8eyT_gDVxJQB70QH1ohXzx07Eqp8w/exec",

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
  getParamFromUrl: function(name) {
    const url = window.location.href;
    const regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)');
    const results = regex.exec(url);
    if (!results || !results[2]) return null;
    return decodeURIComponent(results[2].replace(/\+/g, ' '));
  },
  
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

  // 인증 키 로드 및 갱신
  getAuthKey: function() {
    let key = this.getParamFromUrl('key');

    // 1) URL에 key가 있다면 최우선 적용 및 스토리지/쿠키에 동기화
    if (key) {
      this.setAuthKey(key);
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
      return key;
    }

    // 2) URL에 없다면 localStorage 확인
    key = localStorage.getItem("APP_KEY");
    if (key) return key;

    // 3) localStorage에도 없다면 Cookie 확인 (사파리/인앱브라우저 대비)
    const match = document.cookie.match(new RegExp('(^| )APP_KEY=([^;]+)'));
    if (match) {
      key = match[2];
      localStorage.setItem("APP_KEY", key); // localStorage 복구
      return key;
    }

    return null;
  },
  
  // 키를 다중 스토리지에 저장하는 함수, 쿠키는 30일
  setAuthKey: function(key) {
    if (!key) return;
    localStorage.setItem("APP_KEY", key);
    document.cookie = `APP_KEY=${key}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
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
