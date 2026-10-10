import { CONFIG } from './config.js';
import { apiFetch, showLoading, hideLoading, showToast, generateUniqueID, parseCarNumber, generateHubOptions } from './utils.js';

/* ============================================================
   State 
============================================================ */
let state = {
    onSuccessCallback: null, // 콜백 함수를 저장할 변수 (저장 완료 후 fetchData를 호출하기 위함)
    isModalOpen: false,
    mode: 'add', // 'add' 또는 'edit'
    sourceId: null,
    cards: [] // 여기에 모든 데이터가 들어갑니다.
};

// onSuccessCallback으로 실행할 함수 등록 (예: fetchData)
export function initBatchCarManager(callback) {
    state.onSuccessCallback = callback;
}

/* ============================================================
   Event Delegation
============================================================ */
export function setupEvents() {
    const modal = document.getElementById('batchCarManager');
    if (!modal) return;

    // [사이트 클릭 이벤트]
    document.addEventListener('click', (e) => {
        if (e.target.closest('[data-action="open-BatchCarManager"]')) {
            openBatchCarManager();
        }
    });

    // [모달 내 클릭 이벤트]
    modal.addEventListener('click', (e) => {
        // [배경 클릭 감지] 모달 바깥 어두운 배경을 누르면 닫기
        if (e.target === modal) {
            closeBatchCarManager();
            return;
        }

        const btn = e.target.closest('[data-action]');
        if (!btn) return;

        const action = btn.dataset.action;
        const cardId = btn.closest('.add-card')?.dataset.cardId;
        const rowId = btn.closest('.card-data-row')?.dataset.rowId;

        if (action === 'close-BatchCarManager') closeBatchCarManager();
        if (action === 'add-card') addNewCard();
        if (action === 'remove-card') removeCard(cardId);
        if (action === 'add-row') addCardRow(cardId);
        if (action === 'remove-row') removeCardRow(cardId, rowId);
        if (action === 'submit-cards') submitData();
    });

    // [모달 내 입력/변경 이벤트]
    modal.addEventListener('change', (e) => {
        // 파일 업로드(카메라) 처리
        if (e.target.matches('input[type="file"]')) {
            const cardId = e.target.closest('.add-card').dataset.cardId;
            handleCardCamera(e, cardId);
            return;
        }

        // 텍스트/셀렉트 박스 입력 시 State 즉시 갱신 (화면 렌더링은 안 함)
        const cardEl = e.target.closest('.add-card');
        const rowEl = e.target.closest('.card-data-row');
        if (!cardEl) return;

        const cardId = cardEl.dataset.cardId;
        const card = state.cards.find(c => c.id === cardId);

        if (e.target.matches('.wave-select')) {
            card.wave = e.target.value;
        } 
        else if (rowEl) {
            const rowId = rowEl.dataset.rowId;
            const row = card.rows.find(r => r.id === rowId);
            
            if (e.target.matches('.row-hub-select')) row.hub = e.target.value;
            if (e.target.matches('.row-carnum-input')) row.carNum = e.target.value.trim();
        }
    });

    // [모달 내 붙여넣기 이벤트]
    modal.addEventListener('paste', (e) => {
        // 붙여넣기 한 곳이 차량번호 입력칸이 아니면 무시
        if (!e.target.matches('.row-carnum-input')) return;

        // 클립보드 데이터 가져오기
        const pasteData = (e.clipboardData || window.clipboardData).getData('text');
        
        // 엑셀처럼 탭(\t)이나 줄바꿈(\n)이 포함된 경우에만 우리가 가로채서 처리
        if (pasteData.includes('\t') || pasteData.includes('\n')) {
            e.preventDefault(); // 기본 붙여넣기 방지

            const cardEl = e.target.closest('.add-card'); // 현재 카드 요소
            const rowEl = e.target.closest('.card-data-row'); // 현재 행 요소 (붙여넣기 한 행)
            const card = state.cards.find(c => c.id === cardEl.dataset.cardId);
            
            // 현재 행이 배열에서 몇 번째인지 인덱스 찾기
            const rowIndex = card.rows.findIndex(r => r.id === rowEl.dataset.rowId);

            // 붙여넣기 된 데이터 파싱
            const lines = pasteData.split(/\r?\n/).filter(line => line.trim() !== '');
            
            lines.forEach((line, i) => {
                const parts = line.split('\t');
                const hub = parts[0] ? parts[0].replace(/\s+/g, "") : "";
                let carNum = parts[1] ? parts[1].replace(/\s+/g, "") : "";
                if (!hub) return; // 허브 없으면 무시 (차량번호 필터링 로직도 여기에 추가)
                carNum = parseCarNumber(carNum);

                // 첫 번째 줄은 현재 행(Row)의 데이터를 덮어쓰기
                if (i === 0) {
                    card.rows[rowIndex].hub = hub;
                    card.rows[rowIndex].carNum = carNum;
                } else { // 두 번째 줄부터는 State에 새로운 행(Row) 객체를 추가
                    card.rows.push({
                        id: generateUniqueID(),
                        hub: hub,
                        carNum: carNum
                    });
                }
            });

            renderCards(); 
        }
    });
}

// LS테이블은 기본적으로 다른 테이블처럼 탭과 줄바꿈으로 행렬 구분을 하지만 데이터 내에 줄바꿈이 있어 수시로 줄이 바뀐다.
// 기본 로직
// 1. 허브 분할 : 허브는 D-7 소계와 당일 소계가 나온 뒤 각 호차의 정보가 나열된다
// 2. 차량 분할 : 차량 행에는 반드시 8자리 숫자의 요청ID와 "사진보기"가 등장한다.
// 3. 웨이브 분할 : 차량마다 배송유형이 입력되며, 여기 들어간 걸로 1W ~ 3W 분리가 가능하다.
// 4. 미배차 처리 : 미배차된 차량은 차량번호가 아닌 "미배차"가 뜨며, 직후에 "******"가 뜨지 않는다.
// 5. 취소건 : 취소건은 배차 차량과 구분이 되지 않는다, UI상으로 취소선 처리나 셀의 배경색을 회색으로 두는게 전부
/* 6. 배송유형은 아래와 같이 묶인다.
* WAVE3
14:00 - SAMEDAY_WAVE2, FRESH_SAMEDAY,
* WAVE1
20:30 - DAWN_WAVE1, FRESH_WAVE1,
00:00 - DAWN_WAVE2,
01:10 - DAWN_WAVE3,
03:00 - DAWN_WAVE4,
* WAVE2
08:00 - WAVE2, WAVE3, SAMEDAY_WAVE2, NORMAL,
*/ // 배송유형은 서로 다른 MAT라도 묶일 수 있으며, 이때는 가장 빠른 MAT를 가진 배송유형이 우선된다.
function lsTableParser() {

}

// 카드 추가 모달 열기
export function openBatchCarManager() {

    document.getElementById('batchCarManager').classList.add('active');
    
    // 이전에 남은 게 없으면 기본 빈 카드 1개 생성 후 렌더링
    if (state.cards.length === 0) {
        addNewCard();
    } else {
        renderCards();
    }

}

// 입력 데이터 유실 경고창 적용된 닫기
export function closeBatchCarManager() {
    const card = state.cards.find(c => {
        // 유효한 데이터가 있는지 확인
        const activeRows = c.rows.filter(r => (r.hub !== "" && r.hub !== "직접선택") || r.carNum !== "");
        return activeRows.length > 0 || c.imageId;
    });

    if (card) {
        if (!confirm("⚠️ 분석되었거나 작성 중인 데이터가 있습니다.\n창을 닫으면 내용이 사라집니다. 정말 닫으시겠습니까?")) return;
    }
    document.getElementById('batchCarManager').classList.remove('active');
    state.cards = []; // 모달 닫을 때 State 초기화
}

// 모달 외부 클릭 시 닫기
export function closeCardModalOnOutside(e) {
    if (e.target.id === 'batchCarManager') closeBatchCarManager();
}

// 카드 추가
// 상태에서 기본행 하나를 가진 카드 추가하고, 화면을 갱신합니다.
export function addNewCard() {
  // 1. State 변경
  const newCard = {
    id: generateUniqueID(),
    wave: '2W',
    imageId: null,
    imageBase64: null,
    isLoading: false,
    rows: [{ id: generateUniqueID(), hub: '', carNum: '' }]
  };
  state.cards.push(newCard);
  
  // 2. 화면 갱신
  renderCards();
}

// 카드 추가 시 스크롤을 맨 오른쪽으로 이동시키는 기능. SoC에 맞는지 확인 필요
//  const container = document.getElementById('cardContainer');
//  setTimeout(() => container.scrollTo({ left: container.scrollWidth, behavior: 'smooth' }), 0);

// 카드 삭제 시 데이터 유실 경고 확인
// State에서 해당 카드를 제거하고, 화면을 갱신합니다.
export function removeCard(cardId) {
    const card = state.cards.find(c => c.id === cardId);
    if (!card) return;

    if (card.rows.length > 0 || card.imageId) {
        if (!confirm("⚠️ 이 카드에 이미 입력된 데이터가 있습니다.\n정말 삭제하시겠습니까?")) return;
    }

    state.cards = state.cards.filter(c => c.id !== cardId);
    renderCards();
}

// 카드 내 행 삭제
// State에서 선택한 행이 포함된 card를 찾아 해당 행을 제거하고, 화면을 갱신합니다.
export function removeCardRow(cardId, rowId) {
    const card = state.cards.find(c => c.id === cardId);
    if (!card) return;

    card.rows = card.rows.filter(row => row.id !== rowId);
    renderCards();
}

// 카드 내 행 추가
// 상태에서 행 추가한 카드를 찾아 row를 추가하고, 화면을 갱신합니다.
export function addCardRow(cardId) {
  const card = state.cards.find(c => c.id === cardId);
  card.rows.push({ id: generateUniqueID(), hub: '', carNum: '' });
  renderCards();
}

// state.cards를 바탕으로 HTML 문자열을 만들어 찍어냅니다.
function renderCards() {
  const container = document.getElementById('cardContainer');
  let html = '';

  state.cards.forEach(card => {
    const hasImage = card.imageBase64 && card.imageBase64 !== '';
    const fileInputId = `file_${card.id}`;

    html += `
      <div class="add-card" data-card-id="${card.id}">

        <div class="photo-box-wrap">
          <button type="button" class="btn-del-card" data-action="remove-card">&times;</button>
          
          <label class="photo-box" for="${fileInputId}">
            ${hasImage 
              ? `<img class="photo-img" src="${card.imageBase64}" style="display: block;" alt="미리보기">`
              : `<span class="photo-text">+ 사진</span><img class="photo-img" src="" style="display: none;">`
            }
            
            <div class="photo-loading-overlay" style="display: ${card.isLoading ? 'flex' : 'none'};">
              <div class="spinner-mini"></div>
              <span>분석 중...</span>
            </div>
          </label>
          
          <input type="file" id="${fileInputId}" accept="image/*" style="display: none;">
        </div>
        
        <select class="wave-select">
          <option value="2W" ${card.wave === '2W' ? 'selected' : ''}>2W</option>
          <option value="1W" ${card.wave === '1W' ? 'selected' : ''}>1W</option>
        </select>
        
        <div class="card-rows-container">
          ${card.rows.length === 0 && card.isLoading ? 
            `<div class="loading-row-placeholder">AI 텍스트 추출 중...</div>` : ''
          }
          ${card.rows.map(row => `
            <div class="card-data-row" data-row-id="${row.id}">
              <select class="row-hub-select">${generateHubOptions(row.hub)}</select>
              <input type="text" class="row-carnum-input" value="${row.carNum}" placeholder="차량번호">
              <button type="button" class="row-del-btn" data-action="remove-row">&times;</button>
            </div>
          `).join('')}
        </div>
        
        <button type="button" class="btn-add-row" data-action="add-row">+ 행 추가</button>
      </div>
    `;
  });

  html += `<div class="btn-add-card" data-action="add-card">+</div>`;
  container.innerHTML = html;
}



// 모바일에서만 작동할 코드.
// 작업장 PC에선 웹캠이 없어서 실행되지 않고 파일 업로드만 가능.
// 애초에 작업장 PC면 그냥 handleCardRowPaste를 쓰는게 나음
export function handleCardCamera(event, cardId) {
    const file = event.target.files[0];
    if (!file) return;

    const card = state.cards.find(c => c.id === cardId);
    if (!card) return;

    card.isLoading = true;
    card.rows = [];

    renderCards();

    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const MAX_SIZE = 2000;
            let w = img.width, h = img.height;
            if (w > h && w > MAX_SIZE) { h *= MAX_SIZE / w; w = MAX_SIZE; }
            else if (h > MAX_SIZE) { w *= MAX_SIZE / h; h = MAX_SIZE; }
            canvas.width = w; canvas.height = h;
            ctx.drawImage(img, 0, 0, w, h);

            const compressedBase64 = canvas.toDataURL("image/jpeg", 0.7);
            card.imageBase64 = compressedBase64;

            apiFetch(`${CONFIG.WORKER_URL}?action=extractOcrAI`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ imageBase64: compressedBase64.split(',')[1] })
            })
            .then(res => res.json())
            .then(result => {
                card.isLoading = false;
                card.imageId = result.imageId;
                if (result.status === "success" && result.data) {
                    card.rows = result.data.map(item => ({
                        id: generateUniqueID(), hub: item.지역 || "", carNum: item.차량번호 || ""
                    }));
                } else {
                    card.rows = [{ id: generateUniqueID(), hub: "", carNum: "" }];
                }
                renderCards();
            })
            .catch(() => { card.rows = [{ id: generateUniqueID(), hub: "", carNum: "" }]; renderCards(); })
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

export async function submitData() {
  // 1. 빈 데이터 걸러내기 (순수 자바스크립트 배열 필터링)
  const payload = state.cards.map(card => {
    const validRows = card.rows.filter(row => row.hub !== "" && row.hub !== "직접선택");
    return {
      wave: card.wave,
      parentId: card.imageId || generateUniqueID(), // 사진 분석으로 이미지 ID가 있으면 그걸 쓰고, 없으면 새로 생성
      hasPhoto: !!card.imageId, // 이미지가 있으면 true, 없으면 false
      vehicles: validRows
    };
  }).filter(card => card.vehicles.length > 0);  // 넣을 행이 없는 카드는 제거

    if (payload.length === 0) return alert("추가할 데이터가 없습니다.");

    // 2. 서버로 전송
    showLoading("전송 중...");

    const CHUNK_SIZE = 20;
    const chunkBatches = [];

    payload.forEach(card => {
        for (let i = 0; i < card.vehicles.length; i += CHUNK_SIZE) {
            chunkBatches.push({
                wave: card.wave,
                parentId: card.parentId,
                hasPhoto: (i === 0) ? card.hasPhoto : false,
                vehicles: card.vehicles.slice(i, i + CHUNK_SIZE)
            });
        }
    });

    const totalBatches = chunkBatches.length;

    try {
        for (let i = 0; i < totalBatches; i++) {
            const batch = chunkBatches[i];
            showLoading(`🚚 차량 추가 중... (${i + 1}/${totalBatches})`, `서버에 데이터 전송 중입니다.`);

            const encodedPayload = encodeURIComponent(JSON.stringify([batch]));
            const response = await apiFetch(`${CONFIG.WORKER_URL}?action=addManualList&carinfo=${encodedPayload}`);
            const result = await response.json();

            if (result.status !== "success") throw new Error(result.message || "서버 저장 실패");

            // 0.3초 대기 텀
            if (i < totalBatches - 1) {
            await new Promise(resolve => setTimeout(resolve, 300));
            }
        }

        hideLoading();
        showToast("✅ 모든 차량이 성공적으로 추가되었습니다!");

        state.cards = [];
        document.getElementById('batchCarManager').classList.remove('active');
        
        if (state.onSuccessCallback) state.onSuccessCallback();

    } catch (err) {
        hideLoading();
        alert(`전송 중 오류 발생: ${err.message}`);
    }
}