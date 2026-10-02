import { CONFIG } from './config.js';
import { 
  apiFetch, showLoading, hideLoading, showToast, generateUniqueID,
  getUserType, 
  getCurrentTimeStr, 
  getHubDisplayName, 
  escapeHtml, 
} from './utils.js';


/* ============================================================
    1. [Private State] 내부 전용 변수 (외부에서 조작 불가)
============================================================ */
const USER_TYPE = getUserType();

let cardIdCounter = 0;
let currentChecklistData = [];
let pendingRequests = 0;
let syncInterval = null;

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
    3. [Modal & OCR] 수동 추가 모달 로직
============================================================ */
export function openManualAddModal() {
  document.getElementById('addCardModal').classList.add('active');
  document.getElementById('cardContainer').innerHTML = `<div class="btn-add-card" id="btnAddCard" onclick="Checklist.addNewCard()">+</div>`;
  addNewCard();
}

function hasEnteredData() {
  const cards = document.querySelectorAll('.add-card');
  for (let card of cards) {
    const img = card.querySelector('.photo-img');
    if (img && img.style.display === 'block') return true;

    const rows = card.querySelectorAll('.card-data-row');
    for (let row of rows) {
      const hub = row.querySelector('.row-hub-select').value;
      const carNum = row.querySelector('.row-carnum-input').value.trim();
      if ((hub !== "직접선택" && hub !== "") || carNum !== "") return true;
    }
  }
  return false;
}

export function closeCardModal() {
  if (hasEnteredData()) {
    if (!confirm("⚠️ 이미 분석되었거나 입력 중인 데이터가 있습니다.\n창을 닫으면 내용이 사라집니다. 정말 닫으시겠습니까?")) return;
  }
  document.getElementById('addCardModal').classList.remove('active');
}

export function closeCardModalOnOutside(event) {
  if (event.target.id === 'addCardModal') closeCardModal();
}

export function addNewCard() {
  cardIdCounter++;
  const cardId = `card_${cardIdCounter}`;
  const fileInputId = `file_${cardIdCounter}`;
  
  const cardHtml = `
    <div class="add-card" id="${cardId}">
      <div class="photo-box-wrap">
        <button type="button" class="btn-del-card" onclick="Checklist.removeCard(event, '${cardId}')">X</button>
        <label class="photo-box" for="${fileInputId}">
          <span class="photo-text">+ 사진</span>
          <img class="photo-img" src="" alt="미리보기">
          <div class="photo-loading-overlay" id="loading_${cardId}">
            <div class="spinner-mini"></div>
            <span>분석 중...</span>
          </div>
        </label>
        <input type="file" id="${fileInputId}" accept="image/*" style="display: none;" onchange="Checklist.handleCardCamera(event, '${cardId}')">
      </div>
      
      <select class="wave-select">
        <option value="2W">2W</option>
        <option value="1W">1W</option>
      </select>
      
      <div class="card-rows-container" id="rows_${cardId}"></div>
      <button type="button" class="btn-add-row" onclick="Checklist.addCardRow('${cardId}')">+ 행 추가</button>
    </div>
  `;

  const container = document.getElementById('cardContainer');
  const addBtn = document.getElementById('btnAddCard');
  addBtn.insertAdjacentHTML('beforebegin', cardHtml);
  
  addCardRow(cardId);
  setTimeout(() => {
    container.scrollTo({ left: container.scrollWidth, behavior: 'smooth' });
  }, 0);
}

export function removeCard(event, cardId) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }

  const targetCard = document.getElementById(cardId);
  if (!targetCard) return;

  const img = targetCard.querySelector('.photo-img');
  const hasPhoto = img && img.style.display === 'block';

  let hasData = false;
  const rows = targetCard.querySelectorAll('.card-data-row');
  for (let row of rows) {
    const hub = row.querySelector('.row-hub-select').value;
    const carNum = row.querySelector('.row-carnum-input').value.trim();
    if ((hub !== "직접선택" && hub !== "") || carNum !== "") {
      hasData = true;
      break;
    }
  }

  if (hasPhoto || hasData) {
    if (!confirm("⚠️ 이 카드에 이미 입력된 데이터가 있습니다.\n정말 삭제하시겠습니까?")) return;
  }

  targetCard.classList.add('is-deleting');
  targetCard.addEventListener('transitionend', () => targetCard.remove());
}

function generateHubOptions(selectedHub = "") {
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

export function addCardRow(cardId, hub = "", carNum = "") {
  const rowsContainer = document.getElementById(`rows_${cardId}`);
  if (!rowsContainer) return;

  const rowDiv = document.createElement('div');
  rowDiv.className = 'card-data-row';
  rowDiv.innerHTML = `
    <select class="row-hub-select">${generateHubOptions(hub)}</select>
    <input type="text" class="row-carnum-input" placeholder="차량번호" value="${carNum}" onpaste="Checklist.handleCardRowPaste(event, '${cardId}', this)">
    <button type="button" class="row-del-btn" onclick="this.parentElement.remove()">×</button>
  `;
  rowsContainer.appendChild(rowDiv);
  rowsContainer.scrollTop = rowsContainer.scrollHeight;
}

export function handleCardRowPaste(e, cardId, currentInput) {
  const pasteData = (e.clipboardData || window.clipboardData).getData('text');
  if (pasteData.includes('\t') || pasteData.includes('\n')) {
    e.preventDefault();
    const lines = pasteData.split('\n').filter(line => line.trim() !== '');
    const currentRow = currentInput.closest('.card-data-row');

    lines.forEach((line, index) => {
      const parts = line.trim().split(/[\t ]+/);
      const hub = parts[0] || "";
      const carNum = parts[1] || "";

      if (index === 0) {
        currentRow.querySelector('.row-hub-select').innerHTML = generateHubOptions(hub);
        currentRow.querySelector('.row-carnum-input').value = carNum;
      } else {
        addCardRow(cardId, hub, carNum);
      }
    });
  }
}

export function handleCardCamera(event, cardId) {
  const file = event.target.files[0];
  if (!file) return;

  const card = document.getElementById(cardId);
  const imgEl = card.querySelector('.photo-img');
  const textEl = card.querySelector('.photo-text');
  const loadingOverlay = document.getElementById(`loading_${cardId}`);
  const rowsContainer = document.getElementById(`rows_${cardId}`);

  loadingOverlay.style.display = 'flex';
  rowsContainer.innerHTML = `<div class="loading-row-placeholder">AI 텍스트 추출 중...<br>잠시만 기다려주세요.</div>`;

  const reader = new FileReader();
  reader.onload = function(e) {
    const img = new Image();
    img.onload = function() {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const MAX_SIZE = 1000;
      let w = img.width, h = img.height;
      if (w > h) { if (w > MAX_SIZE) { h *= MAX_SIZE / w; w = MAX_SIZE; } } 
      else { if (h > MAX_SIZE) { w *= MAX_SIZE / h; h = MAX_SIZE; } }
      canvas.width = w; canvas.height = h;
      ctx.drawImage(img, 0, 0, w, h);
      
      const compressedBase64 = canvas.toDataURL("image/jpeg", 0.7);
      imgEl.src = compressedBase64;
      imgEl.style.display = 'block';
      textEl.style.display = 'none';

      apiFetch(`${CONFIG.WORKER_URL}?action=extractOcrAI`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: compressedBase64.split(',')[1] })
      })
      .then(res => res.json())
      .then(result => {
        rowsContainer.innerHTML = '';
        if (result.status === "success") {
          if (result.imageId) card.dataset.imageId = result.imageId;
          if (result.data && result.data.length > 0) {
            result.data.forEach(item => {
              if (item.지역 || item.차량번호) addCardRow(cardId, item.지역 || "", item.차량번호 || "");
            });
          }
        } else {
          alert("AI 인식 실패: " + (result.message || "추출된 결과가 없습니다."));
          addCardRow(cardId);
        }
      })
      .catch(() => {
        rowsContainer.innerHTML = '';
        alert("통신 오류 발생");
        addCardRow(cardId);
      })
      .finally(() => {
        loadingOverlay.style.display = 'none';
      });
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

export function submitCardData() {
  const cards = document.querySelectorAll('.add-card');
  const cardPayloads = [];

  cards.forEach(card => {
    const serverImageId = card.dataset.imageId;
    const parentId = serverImageId || generateUniqueID();
    const wave = card.querySelector('.wave-select').value;
    const rows = card.querySelectorAll('.card-data-row');
    const vehicles = [];

    rows.forEach(row => {
      let hub = row.querySelector('.row-hub-select').value;
      const carNum = row.querySelector('.row-carnum-input').value.trim();
      if (hub === "직접선택") hub = "";
      if (hub !== "") vehicles.push({ hub, carNum });
    });

    if (vehicles.length > 0) {
      cardPayloads.push({ wave, parentId, hasPhoto: Boolean(serverImageId), vehicles });
    }
  });

  if (cardPayloads.length === 0) return alert("추가할 차량 데이터가 없습니다.");

  showLoading("🚚 차량 추가 중...", "서버에 차량을 등록 중입니다.");

  apiFetch(`${CONFIG.WORKER_URL}?action=addManualList`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cardPayloads })
  })
  .then(res => res.json())
  .then(result => {
    hideLoading();
    if (result.status === "success") {
      showToast(`✅ ${result.message}`);
      document.getElementById('cardContainer').innerHTML = '';
      document.getElementById('addCardModal').classList.remove('active');
      fetchData(false);
    } else {
      alert("추가 실패: " + result.message);
    }
  })
  .catch(() => {
    hideLoading();
    alert("통신 에러 발생");
  });
}

/* ============================================================
    4. [QR Modal] 모바일 접속 모달
============================================================ */
export function openQrModal() {
  const modal = document.getElementById('qrModal');
  const qrInfo = document.getElementById('qrInfo');
  const qrImage = document.getElementById('qrImage');
  const qrErrDetail = document.getElementById('qrErrDetail');

  qrImage.style.display = 'none';
  qrErrDetail.style.display = 'none';

  apiFetch(`${CONFIG.WORKER_URL}?action=generateGuestLink`)
    .then(res => res.json())
    .then(result => {
      if (result.status === "error") {
        qrInfo.innerText = "❌ 인증 오류";
        qrErrDetail.innerText = result.message;
        qrErrDetail.style.display = 'block';
        return;
      }
      qrImage.style.display = 'block';
      qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(result.data)}`;
    })
    .catch(err => {
      qrInfo.innerText = "❌ 서버 에러";
      qrErrDetail.innerText = err.message;
      qrErrDetail.style.display = 'block';
    });

  modal.classList.add('active');
}

export function closeQrModal() {
  document.getElementById('qrModal').classList.remove('active');
}

export function closeQrModalOnOutside(event) {
  if (event.target.id === 'qrModal') closeQrModal();
}

/* ============================================================
    5. [Edit / Delete] 차량 개별 수정 및 삭제
============================================================ */
export function openChecklistEditModal(event, btnElement) {
  event.stopPropagation();

  const cId = btnElement.getAttribute('data-cid');
  const wave = btnElement.getAttribute('data-wave');
  const hub = btnElement.getAttribute('data-hub');
  const carNum = btnElement.getAttribute('data-carnum');

  document.getElementById('chkEditCarId').value = cId;
  document.getElementById('chkEditWave').value = wave || "2W";
  document.getElementById('chkEditCarNum').value = carNum || "";

  document.getElementById('chkEditHub').innerHTML = generateHubOptions(hub);
  document.getElementById('checklistEditModal').classList.add('active');
}

export function closeChecklistEditModal() {
  document.getElementById('checklistEditModal').classList.remove('active');
}

export function closeChecklistEditModalOnOutside(event) {
  if (event.target.id === 'checklistEditModal') closeChecklistEditModal();
}

export function submitChecklistEdit() {
  const carId = document.getElementById('chkEditCarId').value;
  const wave = document.getElementById('chkEditWave').value;
  const hub = document.getElementById('chkEditHub').value;
  const carNumber = document.getElementById('chkEditCarNum').value.trim();

  if (hub === "직접선택" || hub === "") return alert("허브를 올바르게 선택해 주세요.");

  closeChecklistEditModal();
  showLoading("⏳ 차량 정보 수정 중...", "서버에 반영 중입니다.");

  apiFetch(`${CONFIG.WORKER_URL}?action=editVehicle`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ carId, wave, hub, carNumber })
  })
  .then(res => res.json())
  .then(result => {
    hideLoading();
    if (result.status === "success") {
      showToast("✅ 차량 정보가 수정되었습니다.");
      fetchData(false);
    } else {
      alert("수정 실패: " + result.message);
    }
  })
  .catch(() => {
    hideLoading();
    alert("통신 오류가 발생했습니다.");
  });
}

export function confirmDeleteChecklistCar(event, btnElement) {
  event.stopPropagation();
  const cId = btnElement.getAttribute('data-cid');
  const carInfo = btnElement.getAttribute('data-info');

  if (!confirm(`🚨 [${carInfo}] 차량을 삭제하시겠습니까?\n이 작업은 복구할 수 없습니다.`)) return;

  showLoading("⏳ 차량 삭제 중...", "서버에 반영 중입니다.");

  apiFetch(`${CONFIG.WORKER_URL}?action=deleteVehicle`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ carId: cId })
  })
  .then(res => res.json())
  .then(result => {
    hideLoading();
    if (result.status === "success") {
      showToast("🗑️ 차량이 성공적으로 삭제되었습니다.");
      fetchData(false);
    } else {
      alert("삭제 실패: " + result.message);
    }
  })
  .catch(() => {
    hideLoading();
    alert("통신 오류가 발생했습니다.");
  });
}

/* ============================================================
    6. [Search & Filter] 실시간 검색
============================================================ */
export function filterList() {
  const query = document.getElementById('searchInput').value.toLowerCase().trim();
  const listInner = document.getElementById('list-inner');
  if (!listInner) return;

  const items = listInner.querySelectorAll('.list-item:not(#noResultItem)');
  const listTitle = document.getElementById('list-title');
  listTitle.innerText = query === '' ? '📋 전체 차량 목록' : '🔎 검색 차량 목록';

  let visibleCount = 0;
  items.forEach(item => {
    const text = item.textContent.toLowerCase();
    if (text.includes(query)) {
      item.style.display = 'flex';
      visibleCount++;
    } else {
      item.style.display = 'none';
    }
  });

  let noResultEl = document.getElementById('noResultItem');
  if (visibleCount === 0) {
    if (!noResultEl) {
      noResultEl = document.createElement('div');
      noResultEl.id = 'noResultItem';
      noResultEl.className = 'list-item';
      noResultEl.style.justifyContent = 'center';
      noResultEl.innerHTML = '<span class="car-info" style="text-align: center; color: #888;"><small>🔍❓ 일치하는 검색 결과가 없습니다.</small></span>';
      listInner.appendChild(noResultEl);
    } else {
      noResultEl.style.display = 'flex';
    }
  } else if (noResultEl) {
    noResultEl.style.display = 'none';
  }
}

/* ============================================================
    7. [Sync & Optimistic Update] 서버 통신 및 낙관적 UI 갱신
============================================================ */
export function markAsArrived(cId, btnElement) {
  btnElement.disabled = true;

  const target = currentChecklistData.find(item => item.cId === cId);
  if (!target) {
    btnElement.disabled = false;
    return;
  }

  const prevArr = target.arr;
  const prevTime = target.aTime;

  target.arr = !prevArr;
  target.aTime = target.arr ? Date.now() : 0;

  localStorage.setItem("CACHED_DATA", JSON.stringify(currentChecklistData));
  updateUI(currentChecklistData);

  if (navigator.vibrate) navigator.vibrate(25);

  stopSyncInterval();
  pendingRequests++;

  apiFetch(`${CONFIG.WORKER_URL}?action=toggleCheck&cId=${cId}`, { redirect: "follow" })
    .then(res => res.json())
    .then(result => {
      pendingRequests--;
      const isError = (result.status === "error") || (result.result && !result.result.success);
      if (isError) {
        target.arr = prevArr;
        target.aTime = prevTime;
        localStorage.setItem("CACHED_DATA", JSON.stringify(currentChecklistData));
        updateUI(currentChecklistData);
        alert(result.message || "상태 변경 실패: 원래 상태로 복구합니다.");
      }
      if (pendingRequests === 0) checkWorkTimeAndSync();
    })
    .catch(() => {
      pendingRequests--;
      target.arr = prevArr;
      target.aTime = prevTime;
      localStorage.setItem("CACHED_DATA", JSON.stringify(currentChecklistData));
      updateUI(currentChecklistData);
      alert("네트워크 연결 오류로 상태를 복구합니다.");
      if (pendingRequests === 0) checkWorkTimeAndSync();
    });
}

function checkWorkTimeAndSync() {
  fetchData(true);
  stopSyncInterval();

  if (document.hidden) return;

  const searchInput = document.getElementById('searchInput');
  if (searchInput && searchInput.value.trim().length > 0) return;
  
  syncInterval = setInterval(() => {
    const currentHour = new Date().getHours();
    if (currentHour < CONFIG.SYNC.WORK_END_HOUR) {
      if (document.getElementById('searchInput').value.trim().length === 0) {
        fetchData();
      }
    } else {
      document.getElementById('status-msg').innerText = "⏹️ 2W 근무 종료.. 자동 동기화 중지";
      stopSyncInterval();
    }
  }, CONFIG.SYNC.CHECKLIST_MS);
}

function stopSyncInterval() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}

function fetchData(useCache = true) {

  if (pendingRequests > 0) return;

  document.getElementById('status-msg').innerText = "데이터 동기화 중...";

  if (useCache) {
    const cachedData = localStorage.getItem("CACHED_DATA");
    if (cachedData) {
      try {
        currentChecklistData = JSON.parse(cachedData);
        updateUI(currentChecklistData);
      } catch(e) {}
    }
  }

  apiFetch(`${CONFIG.WORKER_URL}?action=getChecklistData`)
    .then(res => res.json())
    .then(result => {
      if (result.status === "error") {
        document.getElementById('status-msg').innerText = "❌ 인증 오류: " + result.message;
        return;
      }
      if (pendingRequests > 0) return;
      currentChecklistData = result.data || [];
      localStorage.setItem("CACHED_DATA", JSON.stringify(currentChecklistData));
      updateUI(currentChecklistData);
    })
    .catch(err => {
      document.getElementById('status-msg').innerText = "❌ 서버 에러: " + err.message;
    });
}

export function updateUI(data) {

  document.getElementById('status-msg').innerText = "✅ 마지막 업데이트: " + getCurrentTimeStr();

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
  const dataSummary = (data || []).reduce((acc, item) => {
    const { hub, carN, arr, wave } = item;
    if (wave === "1W") {
      if (isPicoVehicle(wave, hub)) {
        acc.picoCarNumbers.push(carN);
      } else {
        // 1W 클러스터 등 예외 케이스는 일반 1W 남은 대수로 안전하게 집계
        acc.max1WLength++;
        if (arr) acc.arrival1WLength++;
      }
    } else if (wave === "2W") {
      if (isClusterVehicle(wave, hub)) {
        acc.clusterCarNumbers.push(carN);
      } else {
        // 2W SF부천3 등 예외 케이스는 클러스터/피코에 들어가지 않고 일반 2W 남은 대수로 집계
        acc.max2WLength++;
        if (arr) acc.arrival2WLength++;
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

  const listContainer = document.getElementById('full-list');
  listContainer.innerHTML = '<div class="list-inner" id="list-inner"></div>'; 
  const listInner = document.getElementById('list-inner'); 

  const activeCarMap = new Map();
  const filteredData = [];

  (data || []).forEach(item => {
    if (item.unl) {
      filteredData.push(item);
    } else {
      const safeCarNum = String(item.carN).replace(/\s+/g, '');
      const uniqueKey = `${item.hub}_${item.wave}_${safeCarNum}`;
      if (!activeCarMap.has(uniqueKey)) {
        activeCarMap.set(uniqueKey, item);
      } else {
        const existing = activeCarMap.get(uniqueKey);
        if (!existing.arr && item.arr) activeCarMap.set(uniqueKey, item);
      }
    }
  });

  activeCarMap.forEach(value => filteredData.push(value));

  const getPriority = item => {
    if (!item.arr) return 1;
    if (item.arr && !item.unl) return 2; 
    return 3;
  };

  const sortedData = filteredData.sort((a, b) => {
    const priorityA = getPriority(a);
    const priorityB = getPriority(b);
    if (priorityA !== priorityB) return priorityA - priorityB;
    
    if (priorityA === 1) {
      const waveA = a.wave;
      const waveB = b.wave;
      if (waveA !== waveB) return waveA.localeCompare(waveB);
      return (a.rIdx || 0) - (b.rIdx || 0);
    }
    if (priorityA === 2) {
      if (a.aTime && b.aTime && a.aTime !== b.aTime) return a.aTime - b.aTime;
      return (a.rIdx || 0) - (b.rIdx || 0);
    }
    return (a.rIdx || 0) - (b.rIdx || 0);
  });

  const listItemsHTML = [];
  sortedData.forEach(item => {
    const { cId, rIdx, hub, carN, arr, unl, isChanged, wave } = item;
    let badgeClass = "not-arrived";
    let checkIcon = CONFIG.ICONS.empty;

    if (unl) {
      badgeClass = "unloaded";
      checkIcon = CONFIG.ICONS.doubleChecked;
    } else if (arr) {
      badgeClass = "waiting";
      checkIcon = CONFIG.ICONS.checked;
    }

    const prefix = (wave === "1W") ? "★" : (CONFIG.FRESH_HUBS.has(hub) ? "◇" : "");
    const hubStr = getHubDisplayName(hub);
    const carInfo = escapeHtml(`${prefix}${hubStr} | ${carN}`);
    const isBucheon = String(hub).includes("부천3");

    listItemsHTML.push(`
      <div class="list-item ${badgeClass}" data-row-idx="${rIdx}" data-wave="${wave}" data-bucheon="${isBucheon}">
        <button onclick="Checklist.markAsArrived('${cId}', this)" class="checkBox" ${unl ? 'disabled' : ''}>
          ${checkIcon}
        </button>
        <span class="car-info ${unl ? 'text-unloaded' : ''}${isChanged ? ' changed' : ''}">${carInfo}</span>
        ${(!unl && USER_TYPE !== "guest") ? `
          <div class="item-actions">
            <button type="button" class="btn-item-action" title="수정"
              data-cid="${cId}" data-wave="${wave}" data-hub="${hub}" data-carnum="${carN}"
              onclick="Checklist.openChecklistEditModal(event, this)">✏️</button>
            <button type="button" class="btn-item-action" title="삭제"
              data-cid="${cId}" data-info="${carInfo}"
              onclick="Checklist.confirmDeleteChecklistCar(event, this)">🗑️</button>
          </div>
        ` : ''}
      </div>
    `);
  });
  
  listInner.innerHTML = listItemsHTML.join('');
  filterList();
}

/* ============================================================
    8. [Init] 초기화 및 가시성(Visibility) 감지
============================================================ */
export function init() {
  initTheme();

  if (USER_TYPE === "guest") {
    const qrBtn = document.getElementById('qrOpenBtn');
    if (qrBtn) qrBtn.style.display = 'none';
    const addBtn = document.getElementById('addOpenBtn');
    if (addBtn) addBtn.style.display = 'none';
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
