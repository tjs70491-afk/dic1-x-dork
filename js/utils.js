import { CONFIG } from './js/config.js';

// 내부 타이머 관리 변수
const toastTimers = {
  top: null,
  bottom: null
};

export const UTILS = {
  // 공통 fetch 래퍼
  async apiFetch(url, options = {}) {
    options.credentials = 'include';
    const response = await fetch(url, options);

    if (response.status === 401) {
      alert("로그인 세션이 만료되었습니다. 다시 접속해주세요.");
      localStorage.removeItem("USER_TYPE");
      window.location.replace("index.html");
      throw new Error("UNAUTHORIZED");
    }
    return response;
  },

  getUserType() {
    return localStorage.getItem("USER_TYPE") || "guest";
  },
  
  getParamFromUrl(name) {
    const url = window.location.href;
    const regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)');
    const results = regex.exec(url);
    if (!results || !results[2]) return null;
    return decodeURIComponent(results[2].replace(/\+/g, ' '));
  },
  
  escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  getAuthKey() {
    let key = this.getParamFromUrl('key');

    if (key) {
      this.setAuthKey(key);
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
      return key;
    }

    key = localStorage.getItem("APP_KEY");
    if (key) return key;

    const match = document.cookie.match(new RegExp('(^| )APP_KEY=([^;]+)'));
    if (match) {
      key = match[2];
      localStorage.setItem("APP_KEY", key);
      return key;
    }

    return null;
  },
  
  setAuthKey(key) {
    if (!key) return;
    localStorage.setItem("APP_KEY", key);
    document.cookie = `APP_KEY=${key}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
  },

  getHubDisplayName(hub) {
    return CONFIG.HUB_MAP[hub] || hub;
  },

  getTypeClassStr(type) {
    switch (true) {
      case /신선/.test(type): return "fresh";
      case /PB|PICO/.test(type): return "pb";
      case /이형/.test(type): return "irr";
      default: return "sioc";
    }
  },

  function showToast({ message, duration, position = 'bottom'}) {
    // 1. 타입 및 위치별 기본값 설정
    const defaultDuration = position === 'top' ? 2800 : 2000;
    const finalDuration = duration ?? defaultDuration;
    const elementId = `${position}-toast`;
  
    // 2. DOM 요소 생성 및 선택
    let toast = document.getElementById(elementId);
    if (!toast) {
      toast = document.createElement('div');
      toast.id = elementId;
      toast.className = `toast-base toast-${position}`;
      document.body.appendChild(toast);
    }
  
    // 3. 해당 위치의 기존 타이머 제거
    if (toastTimers[position]) clearTimeout(toastTimers[position]);
  
    // 4. 콘텐츠 반영 및 애니메이션 트리거
    toast.innerText = message;
    toast.classList.remove('show');
    void toast.offsetWidth; // Reflow 트리거
    toast.classList.add('show');
  
    // 5. 진동 피드백 (옵션)
    if (position === 'top' && navigator.vibrate) {
      navigator.vibrate(30);
    }
  
    // 6. 타이머 설정
    toastTimers[position] = setTimeout(() => {
      toast.classList.remove('show');
      toastTimers[position] = null;
    }, finalDuration);
  },

  showLoading(msg, subMsg = "잠시만 기다려주세요...") {
    const overlay = document.getElementById('uploadOverlay');
    if (!overlay) return;
    document.getElementById('uploadOverlayMsg').innerText = msg;
    document.getElementById('uploadOverlaySub').innerText = subMsg;
    overlay.style.display = 'flex';
  },
  
  hideLoading() {
    const overlay = document.getElementById('uploadOverlay');
    if (overlay) overlay.style.display = 'none';
  },

  calculateSummary(sheetData) {
    const isNotBucheon = (hub) => !String(hub).includes("부천3");
  
    return sheetData.reduce((acc, item) => {
      const { wave, hub, isUnloaded, type } = item;
  
      if (wave === "1W" && isNotBucheon(hub)) {
        acc.max1WLength++;
        if (isUnloaded) acc.unloaded1WLength++;
        else {
          if (/신선/.test(type)) acc.freshCount1W++;
          if (/PB|복합/.test(type)) acc.pbCount1W++;
          if (/SIOC|이형/.test(type)) acc.ectCount1W++;
        }
      }
  
      if (wave === "2W" && isNotBucheon(hub)) {
        acc.max2WLength++;
        if (isUnloaded) acc.unloaded2WLength++;
        else {
          if (/SIOC|복합|신선/.test(type)) acc.siocCount2W++;
          if (/PB/.test(type)) acc.pbCount2W++;
          if (/이형/.test(type)) acc.irrCount2W++;
        }
      }
  
      if (hub === "SF부천3") {
        acc.maxPicosLength++;
        if (isUnloaded) acc.unloadedPicosLength++;
      }
  
      if (hub === "부천3") {
        acc.maxClustersLength++;
        if (isUnloaded) acc.unloadedClustersLength++;
      }
  
      return acc;
    }, {
      max1WLength: 0, unloaded1WLength: 0, freshCount1W: 0, pbCount1W: 0, ectCount1W: 0,
      max2WLength: 0, unloaded2WLength: 0, siocCount2W: 0, pbCount2W: 0, irrCount2W: 0,
      maxPicosLength: 0, unloadedPicosLength: 0, maxClustersLength: 0, unloadedClustersLength: 0
    });
  },

  getCurrentTimeStr() {
    const now = new Date();
    return [
      String(now.getHours()).padStart(2, '0'),
      String(now.getMinutes()).padStart(2, '0'),
      String(now.getSeconds()).padStart(2, '0')
    ].join(':');
  },

  generateUniqueID() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  },

  // Service Worker 등록 헬퍼
  registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
          .then(reg => console.log('SW Registered', reg))
          .catch(err => console.error('SW Registration Failed', err));
      });
    }
  }
};

/*
const UTILS = {
  // 1. 공통 fetch 래퍼: credentials를 강제하고 401(만료) 시 자동 튕겨내기
  apiFetch: async function(url, options = {}) {
    options.credentials = 'include'; // 쿠키 자동 동봉
    
    const response = await fetch(url, options);

    // 세션 만료 시 처리
    if (response.status === 401) {
      alert("로그인 세션이 만료되었습니다. 다시 접속해주세요.");
      localStorage.removeItem("USER_TYPE");
      window.location.replace("index.html");
      throw new Error("UNAUTHORIZED");
    }
    return response;
  },

  getUserType: function() {
    return localStorage.getItem("USER_TYPE") || "guest";
  },
  
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

  showToast: function(message, duration = 2000) {
    
    let toast = document.getElementById('user-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'user-toast';
      toast.className = 'toast-base toast-bottom';
      document.body.appendChild(toast);
    }

    if (this._bottomToastTimer) {
      clearTimeout(this._bottomToastTimer);
      this._bottomToastTimer = null;
    }

    toast.innerText = message;
    
    toast.classList.remove('show');
    void toast.offsetWidth; 
    toast.classList.add('show');

    this._bottomToastTimer = setTimeout(() => {
      toast.classList.remove('show');
      this._bottomToastTimer = null; // 메모리 정리
    }, duration);
  },

  showRemoteToast: function(msg, duration = 2800) {
    let toast = document.getElementById('remote-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'remote-toast';
      toast.className = 'toast-base toast-top';
      document.body.appendChild(toast);
    }

    if (this._topToastTimer) {
      clearTimeout(this._topToastTimer);
      this._topToastTimer = null;
    }
    
    toast.innerText = message;

    toast.classList.remove('show');
    void toast.offsetWidth;
    toast.classList.add('show');

    // 기기 진동 지원 시 가벼운 햅틱 반응 (30ms)
    if (navigator.vibrate) navigator.vibrate(30);

    this._topToastTimer = setTimeout(() => {
      toast.classList.remove('show');
      this._topToastTimer = null;
    }, duration);
  },

  showLoading: function(msg, subMsg = "잠시만 기다려주세요...") {
    const overlay = document.getElementById('uploadOverlay');
    document.getElementById('uploadOverlayMsg').innerText = msg;
    document.getElementById('uploadOverlaySub').innerText = subMsg;
    overlay.style.display = 'flex';
  },
  
  hideLoading: function() {
    const overlay = document.getElementById('uploadOverlay');
    overlay.style.display = 'none';
  },

  calculateSummary: function(sheetData) {
    const isNotBucheon = (hub) => !String(hub).includes("부천3");
  
    return sheetData.reduce((acc, item) => {
      const { wave, hub, isUnloaded, type } = item;
  
      if (wave === "1W" && isNotBucheon(hub)) {
        acc.max1WLength++;
        if (isUnloaded) acc.unloaded1WLength++;
        else {
          if (/신선/.test(type)) acc.freshCount1W++;
          if (/PB|복합/.test(type)) acc.pbCount1W++;
          if (/SIOC|이형/.test(type)) acc.ectCount1W++;
        }
      }
  
      if (wave === "2W" && isNotBucheon(hub)) {
        acc.max2WLength++;
        if (isUnloaded) acc.unloaded2WLength++;
        else {
          if (/SIOC|복합|신선/.test(type)) acc.siocCount2W++;
          if (/PB/.test(type)) acc.pbCount2W++;
          if (/이형/.test(type)) acc.irrCount2W++;
        }
      }
  
      if (hub === "SF부천3") {
        acc.maxPicosLength++;
        if (isUnloaded) acc.unloadedPicosLength++;
      }
  
      if (hub === "부천3") {
        acc.maxClustersLength++;
        if (isUnloaded) acc.unloadedClustersLength++;
      }
  
      return acc;
    }, {
      max1WLength: 0, unloaded1WLength: 0, freshCount1W: 0, pbCount1W: 0, ectCount1W: 0,
      max2WLength: 0, unloaded2WLength: 0, siocCount2W: 0, pbCount2W: 0, irrCount2W: 0,
      maxPicosLength: 0, unloadedPicosLength: 0, maxClustersLength: 0, unloadedClustersLength: 0
    });
  },

  getCurrentTimeStr: function() {
    const now = new Date();
    return [
      String(now.getHours()).padStart(2, '0'),
      String(now.getMinutes()).padStart(2, '0'),
      String(now.getSeconds()).padStart(2, '0')
    ].join(':');
  },

  generateUniqueID: function() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
};
/* PWA Service Worker 등록 (아직 준비안되어 주석처리)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('SW Registered', reg))
      .catch(err => console.log('SW Registration Failed', err));
  });
}
*/
