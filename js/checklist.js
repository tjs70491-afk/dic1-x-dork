import { CONFIG } from './config.js';
import { 
    apiFetch,
    getUserType, 
    getCurrentTimeStr, 
    getHubDisplayName, 
    escapeHtml,
    setStatusMessage
} from './utils.js';
import * as BatchCarManager from './batchCarManager.js';
import * as GuestQrManager from './guestQrManager.js';
import * as SingleCarManager from './singleCarManager.js';
import * as CarActions from './carActions.js';
import * as SearchManager from './searchManager.js';

/* ============================================================
   State
============================================================ */
const savedCache = localStorage.getItem("CACHED_DATA");

const state = {
    userType: getUserType(),
    vehicles: savedCache ? JSON.parse(savedCache) : [],          // 전체 차량 데이터: 캐시데이터를 기본값으로
    syncInterval: null,   // 폴링 가동용 함수(setInterval)를 넣을 변수
    searchQuery: ""       // 현재 검색어
};

/* ============================================================
   Event Delegation
============================================================ */
export function setupEvents() {

    // [고대비 모드 버튼 클릭 이벤트]
    document.querySelector('.header-area')?.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action="theme-change"]');
        if (btn) toggleHighContrastMode();
    });

    // [#full-list 내 클릭 이벤트]
    document.querySelector('#car-list').addEventListener('click', (event) => {

        const btn = event.target.closest('[data-action]');
        if (!btn) return; 

        const listItem = btn.closest('.list-item');
        const carId = listItem ? listItem.dataset.carId : null;
        const carInfo = listItem ? listItem.dataset.carInfo : null;
        const action = btn.dataset.action;

        if (action === 'toggle-arrival') CarActions.toggleArrival(carId, state.vehicles, () => renderAll());
        else if (action === 'quick-delete') CarActions.quickDelete(carId, carInfo, () => fetchData());
        else if (action === 'open-SingleCarManager') SingleCarManager.openWithDataset({ ...(listItem ? listItem.dataset : {}), ...btn.dataset });
          
    });
};

/* ============================================================
    2. [Theme] 고대비 / 번인 방지 모드
============================================================ */
export function toggleHighContrastMode() {
  const isContrast = document.body.classList.toggle('high-contrast');
  const btn = document.getElementById('themeToggleBtn');
  
  if (isContrast) {
    localStorage.setItem("THEME_MODE", "high-contrast");
    if (btn) btn.innerHTML = "☀️";
  } else {
    localStorage.setItem("THEME_MODE", "default");
    if (btn) btn.innerHTML = "🌓";
  }
}

function initTheme() {
  const savedTheme = localStorage.getItem("THEME_MODE");
  if (savedTheme === "high-contrast") {
    document.body.classList.add('high-contrast');
    const updateBtn = () => {
      const btn = document.getElementById('themeToggleBtn');
      if (btn) btn.innerHTML = "☀️";
    };
    if (document.readyState === 'loading') {
      window.addEventListener('DOMContentLoaded', updateBtn);
    } else {
      updateBtn();
    }
  }
}

/* ============================================================
    7. [Sync & Optimistic Update] 서버 통신 및 낙관적 UI 갱신
============================================================ */

function checkWorkTimeAndSync() {
  
  // 최초 1회 실행
  fetchData();
  // 돌아가고 있던 갱신 타이머가 있다면 일단 날리기
  stopSyncInterval();

  // document가 비활성화시 아무것도 안함 (갱신 타이머는 이미 증발)
  if (document.hidden) return;

  // 검색어가 남아있는 경우, 아무것도 안함
  if (state.searchQuery.trim().length > 0) return;
  
  // 갱신 타이머 가동 (근무시간 여부 판정 로직이 있음)
  state.syncInterval = setInterval(() => {
    const currentHour = new Date().getHours();
    if (currentHour < CONFIG.SYNC.WORK_END_HOUR) {
      if (state.searchQuery.trim().length === 0) {
        fetchData();
      }
    } else {
      document.getElementById('status-msg').innerText = "⏹️ 2W 근무 종료.. 자동 동기화 중지";
      stopSyncInterval();
    }
  }, CONFIG.SYNC.CHECKLIST_MS);
}

function stopSyncInterval() {
  if (state.syncInterval) {
    clearInterval(state.syncInterval);
    state.syncInterval = null;
  }
}

function fetchData() {

    setStatusMessage("데이터 동기화 중...");

    apiFetch(`${CONFIG.WORKER_URL}?action=getVehicles&view=checklist`)
    .then(res => res.json())
    .then(result => {
        if (result.status === "error") {
          setStatusMessage("❌ 인증 오류: " + result.message);
          return;
        }
        state.vehicles = result.data || [];
        localStorage.setItem("CACHED_DATA", JSON.stringify(state.vehicles));
        renderAll();
    })
    .catch(err => {
      setStatusMessage("❌ 서버 에러: " + err.message);
    });
}


function renderAll() {
  setStatusMessage(`✅ 마지막 업데이트: ${getCurrentTimeStr()}`);
  renderSummary();
  renderList();
}


// [부분 렌더러 1] 상단 요약 전용 (남은 차량 수 계산 등)
function renderSummary() {
  // 1) 피코: 오직 1W이면서 SF부천3(또는 피코)인 경우
  var isPicoVehicle = function(wave, hub) {
    return wave === "1W" && (hub === "SF부천3" || hub === "피코");
  };

  // 2) 클러스터: 오직 2W이면서 부천3(또는 클러스터)인 경우 (SF부천3 제외)
  var isClusterVehicle = function(wave, hub) {
    return wave === "2W" && (hub === "부천3" || hub === "클러스터");
  };

  // todo: 가동시간 확장 시 1W클러스터나 2W피코 등 예외 케이스가 생기면 수정 필요
  // 1W (16:00~익일01:00) : 1W 피코(, 1W클러스터) (확장 예정)
  // 2W (01:00~09:00) : 1W 피코, 2W 클러스터 (현행)
  // 3W (09:00~16:00) : 2W 피코, 2W 클러스터 (확장 예정)
  const dataSummary = (state.vehicles || []).reduce((acc, item) => {
    const { hub, carNumber, isArrival, wave } = item;
    if (wave === "1W") {
      if (isPicoVehicle(wave, hub)) {
        acc.picoCarNumbers.push(carNumber);
      } else {
        // 1W 클러스터 등 예외 케이스는 일반 1W 남은 대수로 안전하게 집계
        acc.max1WLength++;
        if (isArrival) acc.arrival1WLength++;
      }
    } else if (wave === "2W") {
      if (isClusterVehicle(wave, hub)) {
        acc.clusterCarNumbers.push(carNumber);
      } else {
        // 2W SF부천3 등 예외 케이스는 클러스터/피코에 들어가지 않고 일반 2W 남은 대수로 집계
        acc.max2WLength++;
        if (isArrival) acc.arrival2WLength++;
      }
    }
    return acc;
  }, {
    max1WLength: 0, arrival1WLength: 0,
    max2WLength: 0, arrival2WLength: 0,
    picoCarNumbers: [], clusterCarNumbers: []
  });

  document.getElementById('pico-list').innerText = Array.from(new Set(dataSummary.picoCarNumbers)).join('\n');
  document.getElementById('cluster-list').innerText = Array.from(new Set(dataSummary.clusterCarNumbers)).join('\n');
  document.getElementById('remain1W-count').innerText = dataSummary.max1WLength - dataSummary.arrival1WLength;
  document.getElementById('remain2W-count').innerText = dataSummary.max2WLength - dataSummary.arrival2WLength;
}

// [부분 렌더러 2] 리스트 전용 (검색 필터 적용)
export function renderList() {
      
    const listContainer = document.getElementById('full-list');

    // 그냥 데이터가 아예 없을 때 처리
    if (!state.vehicles || state.vehicles.length === 0) {
        listContainer.innerHTML = `
            <div class="list-inner" id="list-inner">
                <div class="list-item"><span class="car-info"><small>등록된 차량이 없습니다.</small></span></div>
            </div>
        `;
        return;
    }

    // 검색어로 필터링된 데이터만 리스트에 렌더링
    const searchingResult = SearchManager.filterVehicleList(state.vehicles, state.searchQuery);

    // 검색결과가 없을 때 처리
    if (!searchingResult || searchingResult.length === 0) {
        listContainer.innerHTML = `
            <div class="list-inner" id="list-inner">
                <div class="list-item"><span class="car-info"><small>🔍❓ 검색 결과가 없습니다.</small></span></div>
            </div>
        `;
        return;
    }

        const seenActiveCars = new Map();
        const uniqueData = [];
  
        searchingResult.forEach(item => {
          if (item.isUnloaded) {
            // 하차 완료된 차량은 중복 여부 상관없이 모두 추가
            uniqueData.push(item);
          } else {
            // 대기중 / 미도착 차량 중복 제거
            const safeCarNum = String(item.carNumber).replace(/\s+/g, '');
            const uniqueKey = `${item.hub}_${item.wave}_${safeCarNum}`;
  
            if (!seenActiveCars.has(uniqueKey)) {
              seenActiveCars.set(uniqueKey, item); // 처음 본 차량이면 저장
            } else {
              const existing = seenActiveCars.get(uniqueKey);
              // 기존 저장된 차가 '미도착'인데, 지금 검사하는 차가 '대기중'이면 덮어씌움 (대기중 우선)
              if (!existing.isArrival && item.isArrival) {
                seenActiveCars.set(uniqueKey, item);
              }
            }
          }
        });
  
        // Map에 걸러진 1개의 고유 대기/미도착 차량들을 배열에 합침
        seenActiveCars.forEach(value => {
          uniqueData.push(value);
        });
/*
    // 한 웨이브동안 동일허브에서 오는 동일차량 처리 로직: 하차완료 차량은 전부 표시, 미하차 차량은 항목 1개로 축약
    const seenActiveCars = new Set();
    const uniqueData = [];

    searchingResult.forEach(item => {
        if (item.isUnloaded) {
            uniqueData.push(item);
        } else {
            const safeCarNum = String(item.carNumber).replace(/\s+/g, '');
            const uniqueKey = `${item.hub}_${item.wave}_${safeCarNum}`;
            if (!seenActiveCars.has(uniqueKey)) {
                seenActiveCars.add(uniqueKey);
                uniqueData.push(item);
            }
        }
    });
*/
    // 서버데이터 가져오기 전 임시용 정렬
    const getPriority = item => {
        if (item.isUnloaded) return 3;
        if (item.isArrival) return 2;
        return 1;
    };
    uniqueData.sort((a, b) => {
        const pA = getPriority(a);
        const pB = getPriority(b);
        if (pA !== pB) return pA - pB;
        // 동일 상태 내에서는 1W 우선
        if (a.wave !== b.wave) return a.wave.localeCompare(b.wave);
        return 0;
    });

    const listItemsHTML = [];
    uniqueData.forEach(item => {
        const { carId, hub, carNumber, isArrival, isUnloaded, isChanged, wave } = item;
        let badgeClass = "not-arrived";
        let checkIcon = CONFIG.ICONS.empty;

        if (isUnloaded) {
            badgeClass = "unloaded";
            checkIcon = CONFIG.ICONS.doubleChecked;
        } else if (isArrival) {
            badgeClass = "waiting";
            checkIcon = CONFIG.ICONS.checked;
        }

        const prefix = (wave === "1W") ? "★" : (CONFIG.FRESH_HUBS.has(hub) ? "◇" : "");
        const hubStr = getHubDisplayName(hub);
        const carInfo = escapeHtml(`${prefix}${hubStr} | ${carNumber}`);
        const isBucheon = String(hub).includes("부천3");

        listItemsHTML.push(`
            <div class="list-item ${badgeClass}"
                data-wave="${wave}"
                data-bucheon="${isBucheon}"
                data-car-id="${carId}"
                data-hub="${hub}"
                data-car-number="${carNumber}"
                data-car-info="${carInfo}"
                data-pt="0"
                data-rt="0"
                data-is-unloaded="${isUnloaded}"
            >
                <button
                    class="checkBox"
                    data-action="toggle-arrival"
                    ${isUnloaded ? 'disabled' : ''}
                >${checkIcon}</button>
                <span class="car-info ${isUnloaded ? 'text-unloaded' : ''}${isChanged ? ' changed' : ''}">${carInfo}</span>
                ${(!isUnloaded && state.userType !== "guest") ? `
                    <div class="item-actions">
                        <button type="button" title="수정"
                            class="btn-item-action edit-item"
                            data-mode="edit"
                            data-action="open-SingleCarManager"
                        >✏️</button>
                        <button type="button" title="삭제"
                            class="btn-item-action del-item"
                            data-action="quick-delete"
                        >🗑️</button>
                    </div>
                ` : ''}
            </div>
        `);
    });
    
    listContainer.innerHTML = `
        <div class="list-inner" id="list-inner">
            ${listItemsHTML.join('')}
        </div>
    `;
}

/* ============================================================
    8. [Init] 초기화 및 가시성(Visibility) 감지
============================================================ */
export function init() {

  initTheme();

  setupEvents()
  BatchCarManager.setupEvents();
  SingleCarManager.setupEvents();
  GuestQrManager.setupEvents();
  SearchManager.setupSearchEvents((query) => {
    state.searchQuery = query;
    renderList(); // 화면 즉시 다시 그림
  });

  BatchCarManager.initBatchCarManager(() => fetchData()); 
  SingleCarManager.initSingleCarManager(() => fetchData()); 

  if (state.userType === "guest") {
    const qrBtn = document.getElementById('qrOpenBtn');
    if (qrBtn) qrBtn.style.display = 'none';
    const addBtn = document.getElementById('addOpenBtn');
    if (addBtn) addBtn.style.display = 'none';
    const singleAddBtn = document.querySelector('.btn-single-add');
    if (singleAddBtn) singleAddBtn.style.display = 'none';
  }

  setTimeout(checkWorkTimeAndSync, 500);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopSyncInterval();
      const searchInput = document.getElementById('searchInput');
      if (searchInput) searchInput.value = "";
    } else {
      checkWorkTimeAndSync(); 
    }
  });
}
