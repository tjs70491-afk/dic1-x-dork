let currentQuery = "";
let onSearchCallback = null;

/**
 * 검색 및 퀵 필터 이벤트 설정
 * @param {Function} callback - 검색어가 바뀔 때마다 실행할 함수 (예: (query) => renderList())
 */
export function setupSearchEvents(callback) {
  onSearchCallback = callback;

  const searchInput = document.getElementById('searchInput');
  if (!searchInput) return;

  // 1. 텍스트 직접 입력 시
  searchInput.addEventListener('input', (e) => {
    currentQuery = e.target.value.toLowerCase().trim();
    updateFilterButtonStates();
    if (onSearchCallback) onSearchCallback(currentQuery);
  });

  // 2. 퀵 필터 버튼 클릭 시 (이벤트 위임)
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action="quick-filter"]');
    if (!btn) return;

    const keyword = btn.dataset.keyword || "";

    // 같은 버튼을 또 누르면 검색어 초기화(토글)
    if (searchInput.value === keyword || keyword === "") {
      searchInput.value = "";
      currentQuery = "";
    } else {
      searchInput.value = keyword;
      currentQuery = keyword.toLowerCase().trim();
    }

    updateFilterButtonStates();
    if (onSearchCallback) onSearchCallback(currentQuery);
  });
}

// 퀵 필터 버튼 활성화(active 클래스) 스타일 동기화
function updateFilterButtonStates() {
  const buttons = document.querySelectorAll('[data-action="quick-filter"]');
  buttons.forEach(btn => {
    const kw = (btn.dataset.keyword || "").toLowerCase();
    btn.classList.toggle('active', currentQuery !== "" && kw === currentQuery);
  });
}

/**
 * 순수 데이터 필터링 헬퍼 함수
 * @param {Array} list - 차량 배열
 * @param {string} query - 검색어
 */
export function filterVehicleList(list, query) {
  if (!query) return list;
  return list.filter(item => {
    const carNum = item.carNumber || "";
    const hub = item.hub || "";
    const type = item.type || "";
    return carNum.toLowerCase().includes(query) || 
           hub.toLowerCase().includes(query) || 
           type.toLowerCase().includes(query);
  });
}