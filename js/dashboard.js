import { CONFIG } from './config.js';
import { 
  apiFetch, getCurrentTimeStr, calculateSummary, setStatusMessage,
  getHubDisplayName, getTypeClassStr, escapeHtml, registerServiceWorker 
} from './utils.js';

/* ============================================================
   1. State (상태 관리 - SoC 적용)
   - 앱이 현재 가지고 있는 "순수 데이터"만 보관합니다.
============================================================ */
const state = {
  wakeLock: null, // 화면 꺼짐 방지 관리 변수
  syncInterval: null, // 폴링 타이머 저장 변수
  isListExpanded: false, // 목록 더보기 상태
  vehicles: []           // 서버에서 받아온 원본 차량 배열
};

/* ============================================================
   2. Network (데이터 통신 계층)
============================================================ */
function checkWorkTimeAndSync() {
  fetchData();
  stopSyncInterval();

  if (document.hidden) return;

  state.syncInterval = setInterval(() => {
    const currentHour = new Date().getHours();
    if (currentHour < CONFIG.SYNC.WORK_END_HOUR) {
      fetchData();
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
  
  const url = `${CONFIG.WORKER_URL}?action=getDashboard`;

  apiFetch(url)
    .then(response => response.json())
    .then(result => {
      if (result.status === "error") {
        setStatusMessage("❌ 인증 오류: " + result.message);
        return;
      }
      // 상태(State)만 갱신하고, 렌더링 함수 호출!
      state.vehicles = result.data || [];
      renderAll(); 
    })
    .catch(error => setStatusMessage("❌ 서버 에러: " + error.message));
}

/* ============================================================
   3. Render (UI 렌더링 계층 - 화면만 그립니다)
============================================================ */
function renderAll() {
  setStatusMessage(`✅ 마지막 업데이트: ${getCurrentTimeStr()}`);
  renderSummary();
  renderList();
}

function renderSummary() {
  const summary = calculateSummary(state.vehicles);
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
}

function updateProgressBar(idPrefix, unloaded, max) {
  document.getElementById(`${idPrefix}-text`).innerText = `${unloaded} / ${max}`;
  const fillEl = document.getElementById(`${idPrefix}-fill`);
  if (fillEl) fillEl.style.width = max === 0 ? "0%" : `${(unloaded / max) * 100}%`;
}

function renderList() {
  const listContainer = document.getElementById('full-list');

  if (state.vehicles.length === 0) {
    listContainer.innerHTML = `
      <div class="list-inner">
        <div class="list-item"><span class="car-info"><small>등록된 차량이 없습니다.</small></span></div>
      </div>`;
    return;
  }

  // TODO : 미하차 차량 표시여부 검토
  const pendingList = state.vehicles.filter(item => item.isArrival && !item.isUnloaded);

  if (pendingList.length === 0) {
    listContainer.innerHTML = `
      <div class="list-inner">
        <div class="list-item"><span class="car-info"><small>대기 중인 차량이 없습니다.</small></span></div>
      </div>`;
    return;
  }

  const isMobile = window.innerWidth <= 768;
  const displayLimit = 6;
  const shouldShowAll = isMobile || state.isListExpanded || pendingList.length <= displayLimit;
  const displayCars = shouldShowAll ? pendingList : pendingList.slice(0, displayLimit);

  // HTML 문자열 조립
  let html = `<div class="list-inner">`;
  
  displayCars.forEach(item => {
    const prefix1 = (item.hasFile === true || String(item.hasFile).toUpperCase() === "TRUE") ? "🖼️" : "";
    const prefix2 = (item.wave === "1W") ? "★" : (CONFIG.FRESH_HUBS.has(item.hub) ? "◇" : "");
    
    const carInfo = escapeHtml(`${prefix1}${prefix2}${getHubDisplayName(item.hub)} | ${item.carNumber}`);
    
    html += `
      <div class="list-item waiting">
        <span class="type ${getTypeClassStr(item.type)}"><small>${escapeHtml(item.type)}</small></span>
        <span class="car-info"><small>${carInfo}</small></span>
      </div>`;
  });

  if (!isMobile && pendingList.length > displayLimit) {
    const remainingCount = pendingList.length - displayLimit;
    // data-action 속성을 부여 (이벤트 위임용)
    html += `
      <div class="list-item ${state.isListExpanded ? 'close-extra-btn' : 'open-extra-btn'}" data-action="toggle-list">
        <span class="car-info">
          <small>${state.isListExpanded ? '▲ 목록 접기' : `+ ${remainingCount}대 대기 중...`}</small>
        </span>
      </div>`;
  }
  
  html += `</div>`;
  listContainer.innerHTML = html; // 한 번에 DOM 렌더링
}



/* ============================================================
   4. Event Delegation (이벤트 위임 설정)
============================================================ */
function setupEventListeners() {
  // 1. 리스트 부모 요소에 단 1개의 클릭 이벤트만 등록
  document.getElementById('full-list').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return; // 클릭된 요소가 우리가 지정한 action 버튼이 아니면 무시

    const action = btn.dataset.action;

    // 더보기/접기 액션
    if (action === 'toggle-list') {
      state.isListExpanded = !state.isListExpanded; // 상태 변경
      renderList(); // 네트워크 통신 없이 화면만 즉시 리렌더링!
    }
  });

  // 2. 화면 가시성 이벤트
  document.addEventListener('visibilitychange', async () => {
    if (document.hidden) stopSyncInterval();
    else {
      if (state.wakeLock !== null) await requestWakeLock();
      checkWorkTimeAndSync();
    }
  });
}

async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) state.wakeLock = await navigator.wakeLock.request('screen');
  } catch (err) { console.error(`Wake Lock 에러: ${err.message}`); }
}

/* ============================================================
   5. Init (앱 초기화)
============================================================ */
export function initDashboard() {

  // registerServiceWorker();
  setupEventListeners(); // 이벤트 위임 셋업
  requestWakeLock();
  
  setTimeout(checkWorkTimeAndSync, 500);
}