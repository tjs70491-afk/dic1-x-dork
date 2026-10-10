import { CONFIG } from './config.js';
import { apiFetch, showToast, showLoading, hideLoading } from './utils.js';

/**
 * 1. 도착 체크 토글 (낙관적 UI 반영 + 진동 + 에러 롤백)
 * @param {string} carId - 대상 차량 ID
 * @param {Array} vehiclesList - 현재 화면의 차량 배열 (state.vehicles)
 * @param {Function} onRender - 상태 변경 후 화면을 다시 그릴 렌더 함수
 */
export async function toggleArrival(carId, vehiclesList, onRender) {
  const target = vehiclesList.find(item => item.carId === carId);
  if (!target || target.isUnloaded) return; // 하차완료 차량은 무시

  // 1. 기존 상태 백업, 다음 상태 기록
  const prevArr = target.isArrival;
  const nextArr = !prevArr;

  // 2. 낙관적 UI: 메모리(State) 즉시 변경 & 진동
  if (target.isArrival !== undefined) target.isArrival = nextArr;
  
  if (navigator.vibrate) navigator.vibrate(25);
  onRender(); // 즉시 화면 갱신!

  // 3. 서버 전송
  try {
    const res = await apiFetch(`${CONFIG.WORKER_URL}?action=toggleCheck&cId=${carId}`);
    const result = await res.json();
    
    if (result.status === "error" || (result.result && !result.result.success)) {
      throw new Error(result.message);
    }
    
  } catch (err) {
    // 4. 에러 발생 시 원래 상태로 롤백!
    if (target.isArrival !== undefined) target.isArrival = prevArr;
    onRender();
    alert("상태 변경 실패: 원래대로 복구합니다.");
  }
}

/**
 * 2. 모달 없는 빠른 차량 삭제 (확인창 -> 즉시 삭제)
 */
export async function quickDelete(carId, carInfo, onSuccess) {
  if (!confirm(`🚨 [${carInfo}] 차량을 삭제하시겠습니까?\n이 작업은 복구할 수 없습니다.`)) return;

  showLoading("⏳ 차량 삭제 중...", "목록에서 제거 중입니다.");

  try {
    const res = await apiFetch(`${CONFIG.WORKER_URL}?action=deleteVehicle&carId=${encodeURIComponent(carId)}`);
    const result = await res.json();
    hideLoading();

    if (result.status === "success") {
      showToast("🗑️ 차량이 성공적으로 삭제되었습니다.");
      if (onSuccess) onSuccess(); // 화면 새로고침(fetchData) 실행
    } else {
      alert("삭제 실패: " + result.message);
    }
  } catch (err) {
    hideLoading();
    alert("통신 오류가 발생했습니다.");
  }
}