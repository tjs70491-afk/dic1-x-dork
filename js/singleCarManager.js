import { CONFIG } from './config.js';
import { apiFetch, showLoading, hideLoading, showToast, generateUniqueID, generateHubOptions } from './utils.js';

let state = {
    onSuccessCallback: null, // 콜백 함수를 저장할 변수 (저장 완료 후 fetchData를 호출하기 위함)
    mode: 'edit', // 'add' 또는 'edit'
    isUnloaded: false,
    carInfo: {
        carId: null,
        wave: null,
        hub: null,
        carNumber: null,
        pt: 0,
        rt: 0
    }
};

// onSuccessCallback으로 실행할 함수 등록 (예: fetchData)
export function initSingleCarManager(callback) {
    state.onSuccessCallback = callback;
}

export function openWithDataset(dataset) {
    state.mode = dataset.mode || 'edit';
    state.isUnloaded = dataset.isUnloaded === true || String(dataset.isUnloaded).toUpperCase() === "TRUE"
    state.carInfo = {
        carId: dataset.carId || generateUniqueID(),
        wave: dataset.wave || "2W",
        hub: dataset.hub || "",
        carNumber: dataset.carNumber || "",
        pt: parseInt(dataset.pt, 10) || 0,
        rt: parseInt(dataset.rt, 10) || 0
    };
    openSingleCarManager();
}

export function setupEvents() {
    const modal = document.getElementById('singleCarManager');
    if (!modal) return;

    // [모달 내 클릭 이벤트]
    modal.addEventListener('click', (e) => {
        // [배경 클릭 감지] 모달 바깥 어두운 배경을 누르면 닫기
        if (e.target === modal) {
            closeSingleCarManager();
            return;
        }

        const btn = e.target.closest('[data-action]');
        if (!btn) return;

        const action = btn.dataset.action;

        if (action === 'close-SingleCarManager') { closeSingleCarManager(); return; }

        const wave = modal.querySelector('#inputWave')?.value || state.carInfo.wave;
        const hub = modal.querySelector('#inputHub')?.value || state.carInfo.hub;
        const carNumber = modal.querySelector('#inputCarNum')?.value.trim() || state.carInfo.carNumber;
        const pt = modal.querySelector('#edit-pt') ? parseInt(modal.querySelector('#edit-pt').value, 10) : state.carInfo.pt;
        const rt = modal.querySelector('#edit-rt') ? parseInt(modal.querySelector('#edit-rt').value, 10) : state.carInfo.rt;

        let endpoint = '';
        if (action === 'submit-add') {
            const inputData = encodeURIComponent(JSON.stringify([{
                wave: state.carInfo.wave,
                parentId: "directly",
                hasPhoto: false,
                vehicles: [{ id: state.carInfo.carId, hub: state.carInfo.hub, carNum: state.carInfo.carNumber }]
            }]));
            endpoint = `${CONFIG.WORKER_URL}?action=addManualList&carinfo=${inputData}`;
        }
        else if (action === 'submit-edit') {
            const payload = {
                carId: state.carInfo.carId,
                wave: wave,
                hub: hub,
                carNumber: carNumber,
                pt: pt,
                rt: rt
            };
            endpoint = `${CONFIG.WORKER_URL}?action=editVehicle&carinfo=${encodeURIComponent(JSON.stringify(payload))}`;
        }

        if (endpoint) {
            showLoading("⏳ 처리 중...", "서버에 반영 중입니다.");
            apiFetch(endpoint)
                .then(res => res.json())
                .then(result => {
                    hideLoading();
                    if (result.status === "success") {
                        showToast("✅ 처리가 완료되었습니다.");
                        closeSingleCarManager();
                        if (state.onSuccessCallback) state.onSuccessCallback();
                    } else {
                        alert("실패: " + result.message);
                    }
                })
                .catch(() => {
                    hideLoading();
                    alert("통신 오류가 발생했습니다.");
                });
        }
    });

    // [모달 내 변경 이벤트]
    modal.addEventListener('change', (e) => {
        if (e.target.matches('#inputWave')) state.carInfo.wave = e.target.value;
        if (e.target.matches('#inputHub')) state.carInfo.hub = e.target.value;
        if (e.target.matches('#inputCarNum')) state.carInfo.carNum = e.target.value.trim();
    });
}

export function openSingleCarManager() {
    const modal = document.getElementById('singleCarManager');
    if (!modal) return;

    let title = '';
    let submitBtn = '';

    if (state.mode === "add") {
        title = '➕ 차량 추가';
        submitBtn = `<button type="button" class="btn-submit" data-action="submit-add">추가하기</button>`;
    } else if (state.mode === "edit") {
        title = '✏️ 차량 수정';
        submitBtn = `<button type="button" class="btn-submit" data-action="submit-edit">수정하기</button>`;
    }

    modal.innerHTML = `
        <div class="modal-content" style="max-width: 320px;">
            <h3 style="margin-top: 0;">${title}</h3>
            <input type="hidden" id="inputCarId" value="${state.carInfo.carId}">

            <div class="form-group">
                <label>Wave</label>
                <select id="inputWave" ${state.mode === "delete" ? 'disabled' : ''}>
                    <option value="1W"${state.carInfo.wave === "1W" ? ' selected' : ''}>1W</option>
                    <option value="2W"${state.carInfo.wave === "2W" ? ' selected' : ''}>2W</option>
                </select>
            </div>

            <div class="form-group">
                <label>허브</label>
                <select id="inputHub" ${state.mode === "delete" ? 'disabled' : ''}>${generateHubOptions(state.carInfo.hub)}</select>
            </div>

            <div class="form-group">
                <label>차량번호</label>
                <input type="text" id="inputCarNum" placeholder="차량번호 (예: 경기80바6311)" ${state.mode === "delete" ? 'readonly' : ''} value="${state.carInfo.carNumber || ""}">
            </div>

            ${(state.isUnloaded) 
                ? `
                <div class="form-group">
                    <label>PT</label>
                    <input type="number" id="edit-pt" name="PT수" min="0" max="20" value="${state.carInfo.pt}">
                </div>
                <div class="form-group">
                    <label>RT</label>
                    <input type="number" id="edit-rt" name="RT수" min="0" max="20" value="${state.carInfo.rt}">
                </div>
                ` : ''}

            <div class="edit-modal-btns">
                ${submitBtn}
                <button type="button" class="btn-edit-cancel" data-action="close-SingleCarManager">취소</button>
            </div>
        </div>
    `;

    modal.classList.add('active');
}

export function closeSingleCarManager() {
  document.getElementById('singleCarManager').classList.remove('active');
}
