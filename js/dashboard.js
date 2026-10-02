import { CONFIG } from './config.js';
import { 
  getAuthKey, 
  getUserType, 
  getCurrentTimeStr, 
  calculateSummary, 
  getHubDisplayName, 
  getTypeClassStr, 
  escapeHtml, 
  registerServiceWorker 
} from './utils.js';

const state = {
  appKey: null,
  userType: 'guest',
  wakeLock: null,
  syncInterval: null,
  isListExpanded: false,
  lastSheetData: []
};

function setStatusMessage(msg, isHtml = false) {
  const el = document.getElementById('status-msg');
  if (!el) return;
  if (isHtml) el.innerHTML = msg;
  else el.innerText = msg;
}

async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      state.wakeLock = await navigator.wakeLock.request('screen');
      state.wakeLock.addEventListener('release', () => {
        state.wakeLock = null;
        console.log('👁️ 화면 꺼짐 방지(Wake Lock)가 해제되었습니다.');
      });
      console.log('👁️ 화면 꺼짐 방지(Wake Lock)가 활성화되었습니다.');
    }
  } catch (err) {
    console.error(`Wake Lock 에러: ${err.name}, ${err.message}`);
  }
}

function checkWorkTimeAndSync() {
  fetchData();
  stopSyncInterval();

  if (document.hidden) {
    console.log("⏸️ 화면이 숨겨져 있어 자동 동기화 예약을 대기합니다.");
    return;
  }

  state.syncInterval = setInterval(() => {
    const currentHour = new Date().getHours();
    if (currentHour < CONFIG.SYNC.WORK_END_HOUR) {
      fetchData();
      console.log("🔄 [동기화 완료] 현재 시간: " + new Date().toLocaleTimeString());
    } else {
      setStatusMessage("⏹️ 2W 근무 종료.. 자동 동기화 중지 (마지막 데이터)");
      stopSyncInterval();
    }
  }, CONFIG.SYNC.DASHBOARD_MS);
}

function stopSyncInterval() {
  if (state.syncInterval) {
    clearInterval(state.syncInterval);
    state.syncInterval = null;
  }
}

function fetchData() {
  setStatusMessage("데이터 동기화 중...");
  
  const targetUrl = CONFIG.BACKEND === "WORKER" ? CONFIG.WORKER_URL : CONFIG.GAS_URL;
  const url = `${targetUrl}?action=getDashboard&key=${encodeURIComponent(state.appKey)}`;

  fetch(url)
    .then(response => response.json())
    .then(result => {
      if (result.status === "error") {
        setStatusMessage("❌ 인증 오류: " + result.message);
        return;
      }
      updateUI(result.data);
    })
    .catch(error => {
      setStatusMessage("❌ 서버 에러: " + error.message);
    });
}

export function updateUI(sheetData) {
  state.lastSheetData = sheetData || [];
  setStatusMessage(`✅ 마지막 업데이트: ${getCurrentTimeStr()}`);

  const summary = calculateSummary(state.lastSheetData);
  const remaining1W = summary.max1WLength - summary.unloaded1WLength;
  const remaining2W = summary.max2WLength - summary.unloaded2WLength;
  const currentHour = new Date().getHours();

  if (remaining1W > 0 && currentHour < 3) {
    document.getElementById('total-title').innerText = "남은 1W 차량 수";
    document.getElementById('total-remaining').innerText = remaining1W;
    document.getElementById('type-text1').textContent = `신선 : ${summary.freshCount1W}`;
    document.getElementById('type-text2').textContent = `PB : ${summary.pbCount1W}`;
    document.getElementById('type-text3').textContent = `기타 : ${summary.ectCount1W}`;
  } else {
    document.getElementById('total-title').innerText = "남은 2W 차량 수";
    document.getElementById('total-remaining').innerText = remaining2W;
    document.getElementById('type-text1').textContent = `SIOC : ${summary.siocCount2W}`;
    document.getElementById('type-text2').textContent = `PB : ${summary.pbCount2W}`;
    document.getElementById('type-text3').textContent = `이형 : ${summary.irrCount2W}`;
  }

  updateProgressBar('1w', summary.unloaded1WLength, summary.max1WLength);
  updateProgressBar('2w', summary.unloaded2WLength, summary.max2WLength);

  document.getElementById('pico-text').innerText = `${summary.unloadedPicosLength} / ${summary.maxPicosLength}`;
  document.getElementById('cluster-text').innerText = `${summary.unloadedClustersLength} / ${summary.maxClustersLength}`;

  renderVehicleList(state.lastSheetData);
}

function updateProgressBar(idPrefix, unloaded, max) {
  document.getElementById(`${idPrefix}-text`).innerText = `${unloaded} / ${max}`;
  const fillEl = document.getElementById(`${idPrefix}-fill`);
  if (fillEl) {
    const percentage = max === 0 ? 0 : (unloaded / max) * 100;
    fillEl.style.width = `${percentage}%`;
  }
}

function toggleListExpand() {
  state.isListExpanded = !state.isListExpanded;
  renderVehicleList(state.lastSheetData);
}

function renderVehicleList(sheetData) {
  const listContainer = document.getElementById('full-list');
  listContainer.innerHTML = '<div class="list-inner" id="list-inner"></div>';
  const listInner = document.getElementById('list-inner');

  const pendingList = sheetData.filter(item => item.isArrival && !item.isUnloaded);

  if (pendingList.length === 0) {
    listInner.innerHTML = `
      <div class="list-item">
        <span class="car-info"><small>대기 중인 차량이 없습니다.</small></span>
      </div>
    `;
    return;
  }

  const isMobile = window.innerWidth <= 768;
  const displayLimit = 6;
  const shouldShowAll = isMobile || state.isListExpanded || pendingList.length <= displayLimit;
  const displayCars = shouldShowAll ? pendingList : pendingList.slice(0, displayLimit);

  displayCars.forEach(item => {
    const { hub, wave, carNumber, type } = item;
    const prefix = (wave === "1W") ? "★" : (CONFIG.FRESH_HUBS.has(hub) ? "◇" : "");
    const hubStr = getHubDisplayName(hub);
    const carInfo = escapeHtml(`${prefix}${hubStr} | ${carNumber}`);
    const typeClass = getTypeClassStr(type);

    const listItemHTML = `
      <div class="list-item waiting">
        <span class="type ${typeClass}"><small>${escapeHtml(type)}</small></span>
        <span class="car-info"><small>${carInfo}</small></span>
      </div>
    `;
    listInner.insertAdjacentHTML('beforeend', listItemHTML);
  });

  if (!isMobile && pendingList.length > displayLimit) {
    const remainingCount = pendingList.length - displayLimit;
    const btn = document.createElement('div');
    btn.className = `list-item ${state.isListExpanded ? 'close-extra-btn' : 'open-extra-btn'}`;
    btn.innerHTML = `
      <span class="car-info">
        <small>${state.isListExpanded ? '▲ 목록 접기' : `+ ${remainingCount}대 대기 중...`}</small>
      </span>
    `;
    btn.addEventListener('click', toggleListExpand);
    listInner.appendChild(btn);
  }
}

export function initDashboard() {
  state.appKey = getAuthKey();
  state.userType = getUserType();

  if (!state.appKey) {
    alert("인증 정보가 없습니다. 다시 로그인해주세요.");
    window.location.replace("index.html");
    return;
  }

  registerServiceWorker();

  document.addEventListener('visibilitychange', async () => {
    if (document.hidden) {
      stopSyncInterval();
    } else {
      if (state.wakeLock !== null && document.visibilityState === 'visible') {
        await requestWakeLock();
      }
      checkWorkTimeAndSync();
    }
  });

  window.onerror = (msg, url, line) => {
    setStatusMessage(`<strong style="color:red;">에러: ${msg} (${line}줄)</strong>`, true);
  };

  requestWakeLock();
  setTimeout(checkWorkTimeAndSync, 500);
}