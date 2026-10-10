import { CONFIG } from './config.js';

// 내부 타이머 관리 변수
const toastTimers = {
  top: null,
  bottom: null
};

// 공통 fetch 래퍼
export async function apiFetch(url, options = {}) {
  options.credentials = 'include';
  const response = await fetch(url, options);

  if (response.status === 401) {
    alert("로그인 세션이 만료되었습니다. 다시 접속해주세요.");
    localStorage.removeItem("USER_TYPE");
    window.location.replace("index.html");
    throw new Error("UNAUTHORIZED");
  }
  return response;
}

export function getUserType() {
  return localStorage.getItem("USER_TYPE") || "guest";
}

export function getParamFromUrl(name) {
  const url = window.location.href;
  const regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)');
  const results = regex.exec(url);
  if (!results || !results[2]) return null;
  return decodeURIComponent(results[2].replace(/\+/g, ' '));
}

export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function getAuthKey() {
  let key = getParamFromUrl('key');

  if (key) {
    setAuthKey(key);
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
}

export function setAuthKey(key) {
  if (!key) return;
  localStorage.setItem("APP_KEY", key);
  document.cookie = `APP_KEY=${key}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
}

export function getHubDisplayName(hub) {
  return CONFIG.HUB_MAP[hub] || hub;
}

export function getTypeClassStr(type) {
  switch (true) {
    case /신선/.test(type): return "fresh";
    case /PB|PICO/.test(type): return "pb";
    case /이형/.test(type): return "irr";
    default: return "sioc";
  }
}

export function showToast(message, { duration, position = 'bottom' } = {}) {
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
}

export function showLoading(msg, subMsg = "잠시만 기다려주세요...") {
  let overlay = document.querySelector('#uploadOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'uploadOverlay';
    overlay.className = 'modal-overlay';
    // HTML 예시 구조와 동일하게 기본 스타일 및 스피너를 세팅합니다.
    overlay.style.cssText = 'z-index: 10001; flex-direction: column; background: rgba(0,0,0,0.75); display: flex;';
    
    overlay.innerHTML = `
      <div class="spinner-mini" style="width: 40px; height: 40px; border-width: 4px; margin-bottom: 16px;"></div>
      <div id="uploadOverlayMsg" style="font-size: 20px; font-weight: bold; margin-bottom: 8px; color: white;"></div>
      <div id="uploadOverlaySub" style="font-size: 14px; color: #cbd5e1;"></div>
    `;
    document.body.appendChild(overlay);
  }
  overlay.querySelector('#uploadOverlayMsg').innerText = msg;
  overlay.querySelector('#uploadOverlaySub').innerText = subMsg;
  overlay.classList.add('active');
}

export function hideLoading() {
  const overlay = document.getElementById('uploadOverlay');
  if (overlay) overlay.classList.remove('active');
}

// todo: 1W 클러스터와 2W SF부천3을 구분하는 로직이 필요함. 현재는 1W SF부천3와 2W 클러스터만 구분하고 있음
export function calculateSummary(sheetData) {

  return sheetData.reduce((acc, item) => {
    const { wave, hub, isUnloaded, type } = item;

    if (wave === "1W") {
      if (hub !== "SF부천3") {
        acc.max1WLength++;
        if (isUnloaded) acc.unloaded1WLength++;
        else {
          if (/신선/.test(type)) acc.freshCount1W++;
          if (/PB|복합/.test(type)) acc.pbCount1W++;
          if (/SIOC|이형/.test(type)) acc.ectCount1W++;
        } 
      } else if (hub === "SF부천3") {
        acc.maxPicosLength++;
        if (isUnloaded) acc.unloadedPicosLength++;
      }
    } else if (wave === "2W") {
      if (hub !== "부천3") {
        acc.max2WLength++;
        if (isUnloaded) acc.unloaded2WLength++;
        else {
          if (/SIOC|복합|신선/.test(type)) acc.siocCount2W++;
          if (/PB/.test(type)) acc.pbCount2W++;
          if (/이형/.test(type)) acc.irrCount2W++;
        }
      } else if (hub === "부천3") {
        acc.maxClustersLength++;
        if (isUnloaded) acc.unloadedClustersLength++;
      }
    }

    return acc;
  }, {
    max1WLength: 0, unloaded1WLength: 0, freshCount1W: 0, pbCount1W: 0, ectCount1W: 0,
    max2WLength: 0, unloaded2WLength: 0, siocCount2W: 0, pbCount2W: 0, irrCount2W: 0,
    maxPicosLength: 0, unloadedPicosLength: 0, maxClustersLength: 0, unloadedClustersLength: 0
  });
}

export function getCurrentTimeStr() {
  const now = new Date();
  return [
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0')
  ].join(':');
}

export function generateUniqueID() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Service Worker 등록 헬퍼
export function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then(reg => console.log('SW Registered', reg))
        .catch(err => console.error('SW Registration Failed', err));
    });
  }
}

export function parseCarNumber(rawCarNum) {
  if (!rawCarNum) return "";
  const cleaned = String(rawCarNum).replace(/\s+/g, "");

  // 1. 표준 완성형 번호판 (예: 12가3456, 123가3456, 경기80바6311)
  const fullCarNumRegex = /^(?:\d{2,3}|[가-힣]{1,2}\d{2})[가-힣]\d{4}$/;
  // 2. 뒷 4자리 숫자
  const lastFourRegex = /^\d{4}$/;

  if (fullCarNumRegex.test(cleaned)) return cleaned;
  if (lastFourRegex.test(cleaned)) return cleaned;
  if (cleaned.length > 4 && /\d{4}$/.test(cleaned)) return cleaned.slice(-4);
  
  // 미배차, 배차예정 등 유효하지 않은 문자열은 공백 반환
  return "";
}

// 차량 추가/수정 모달에서 허브 선택 옵션 생성
export function generateHubOptions(selectedHub = "") {
    let isMatched = false;
    let optionsHtml = CONFIG.HUB_LIST.map(hub => {
        const isSelected = (hub === selectedHub);
        if (isSelected) isMatched = true;
        return `<option value="${hub}" ${isSelected ? 'selected' : ''}>${hub}</option>`;
    }).join('');

    if (selectedHub && !isMatched && selectedHub !== "직접선택") {
        optionsHtml = `<option value="${selectedHub}" selected>${selectedHub}</option>` + optionsHtml;
    }
    return optionsHtml;
}

export function setStatusMessage(msg) {
  const el = document.getElementById('status-msg');
  if (!el) return;
  el.innerText = msg;
}