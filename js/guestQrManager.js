import { CONFIG } from './config.js';
import { apiFetch } from './utils.js';

export function setupEvents() {
    const modal = document.getElementById('qrModal');
    if (!modal) return;

    // [사이트 클릭 이벤트]
    document.addEventListener('click', (e) => {
        if (e.target.closest('[data-action="open-QR-modal"]')) {
            openQrModal();
        }
    });

    // [모달 내 클릭 이벤트]
    modal.addEventListener('click', (e) => {
        // [배경 클릭 감지] 모달 바깥 어두운 배경을 누르면 닫기
        if (e.target === modal) {
            closeQrModal();
            return;
        }

        const btn = e.target.closest('[data-action]');
        if (!btn) return;

        const action = btn.dataset.action;
        if (action === 'close-QR-modal') closeQrModal();
    });
}

export function openQrModal() {

    const modal = document.getElementById('qrModal');
    if (!modal) return;

    modal.innerHTML = `<div class="modal-content qr-modal-box"><p>QR 생성 중...</p></div>`;
    modal.classList.add('active');


    apiFetch(`${CONFIG.WORKER_URL}?action=generateGuestLink`)
        .then(res => res.json())
        .then(result => {
            if (result.status === "error") throw new Error(result.message);
            const qrUri = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(result.data)}`;
            modal.innerHTML = `
                <div class="modal-content qr-modal-box">
                    <h3>📱 모바일 접속 QR</h3>
                    <p id="qrInfo">스마트폰 카메라로 스캔하세요</p>
                    <img id="qrImage" class="qr-img" src=${qrUri} alt="접속 QR코드">
                    <button type="button" class="close-btn" data-action="close-QR-modal">&times;</button>
                </div>
            `;
        })
        .catch(err => {
            modal.innerHTML = `
                <div class="modal-content qr-modal-box">
                    <h3>📱 모바일 접속 QR</h3>
                    <p id="qrInfo">❌ QR 생성 실패</p>
                    <p id="qrErrDetail" style="color: #dc2626;">${err.message}</p>
                    <button type="button" class="close-btn" data-action="close-QR-modal">&times;</button>
                </div>
            `;
        });
}

export function closeQrModal() {
  document.getElementById('qrModal').classList.remove('active');
}

export function closeQrModalOnOutside(event) {
  if (event.target.id === 'qrModal') closeQrModal();
}
