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

export function showToast({ message, duration, position = 'bottom'}) {
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
  const overlay = document.getElementById('uploadOverlay');
  if (!overlay) return;
  document.getElementById('uploadOverlayMsg').innerText = msg;
  document.getElementById('uploadOverlaySub').innerText = subMsg;
  overlay.style.display = 'flex';
}

export function hideLoading() {
  const overlay = document.getElementById('uploadOverlay');
  if (overlay) overlay.style.display = 'none';
}

export function calculateSummary(sheetData) {
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