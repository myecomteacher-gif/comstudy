/**
 * 원탁토론실 사용 예약 시스템 - Core Application Logic
 */

// 1. 설정 및 상수
const CONFIG = {
    START_DATE: '2026-06-01',
    END_DATE: '2027-02-28',
    STORAGE_KEY: 'round_table_reservations',
    PERIODS: [
        { id: '1', name: '1교시', time: '09:00 - 09:50' },
        { id: '2', name: '2교시', time: '10:00 - 10:50' },
        { id: '3', name: '3교시', time: '11:00 - 11:50' },
        { id: 'lunch', name: '점심시간', time: '11:50 - 13:00' },
        { id: '4', name: '4교시', time: '13:00 - 13:50' },
        { id: '5', name: '5교시', time: '14:00 - 14:50' },
        { id: '6', name: '6교시', time: '15:00 - 15:50' },
        { id: '7', name: '7교시', time: '16:00 - 16:50' }, // 수목금 제외
        { id: 'afterschool', name: '방과후', time: '17:00 ~ (월화) / 16:00 ~ (수목금)' }
    ],
    WEEKDAYS_KOREAN: ['월', '화', '수', '목', '금']
};

// 2. 상태 관리
let state = {
    currentDate: null, // 현재 표시 중인 주차의 기준일 (Date 객체, 보통 월요일)
    reservations: [],  // 예약 목록 배열
    activeSearchQuery: '',
    isAdmin: false     // 관리자 모드 여부
};

// 3. 앱 초기화
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    // 3.1. 관리자 상태 로드
    if (sessionStorage.getItem('round_table_admin') === 'true') {
        state.isAdmin = true;
    }
    updateAdminUI();

    // 3.2. 현재 날짜 설정 (유효 기간 내인지 검사 후 바인딩)
    const today = new Date();
    const minDate = new Date(CONFIG.START_DATE);
    const maxDate = new Date(CONFIG.END_DATE);

    if (today >= minDate && today <= maxDate) {
        state.currentDate = today;
    } else {
        // 기본값: 운영 시작일
        state.currentDate = new Date(CONFIG.START_DATE);
    }

    // 3.3. 데이터 로드
    loadReservations();

    // 3.4. 이벤트 리스너 등록
    setupEventListeners();

    // 3.5. 시간표 렌더링 및 통계 업데이트
    renderTimetable();
    updateStats();
    
    // 3.6. 데이트 피커 최소/최대 설정
    const picker = document.getElementById('date-select-picker');
    picker.min = CONFIG.START_DATE;
    picker.max = CONFIG.END_DATE;
    picker.value = formatDate(state.currentDate);
}

// 3.7. 관리자 UI 업데이트
function updateAdminUI() {
    const loginBox = document.getElementById('admin-login-box');
    const infoBox = document.getElementById('admin-info-box');
    if (state.isAdmin) {
        if (loginBox) loginBox.style.display = 'none';
        if (infoBox) infoBox.style.display = 'block';
    } else {
        if (loginBox) loginBox.style.display = 'block';
        if (infoBox) infoBox.style.display = 'none';
    }
}

// 4. 데이터 저장 및 로드
function loadReservations() {
    const data = localStorage.getItem(CONFIG.STORAGE_KEY);
    if (data) {
        try {
            state.reservations = JSON.parse(data);
        } catch (e) {
            console.error('데이터 파싱 오류:', e);
            state.reservations = [];
        }
    } else {
        // 기본 샘플 데이터 추가 (사용자의 이해를 돕기 위함)
        state.reservations = [
            {
                id: 'sample-1',
                date: '2026-06-22',
                period: '2',
                name: '김태희 (교사)',
                purpose: '국어 수행평가 모둠 모의 토의 수업 진행',
                password: '0000'
            },
            {
                id: 'sample-2',
                date: '2026-06-23',
                period: 'lunch',
                name: '이수민 (학생)',
                purpose: '학생 자치회 대토론회 사전 기획 회의',
                password: '0000'
            },
            {
                id: 'sample-3',
                date: '2026-06-24',
                period: 'afterschool',
                name: '박성진 (교사)',
                purpose: '방과후 디베이트 토론 동아리 정기 학습',
                password: '0000'
            }
        ];
        saveReservations();
    }
}

function saveReservations() {
    localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(state.reservations));
}

// 5. 날짜 도우미 함수
function getMonday(date) {
    const d = new Date(date);
    const day = d.getDay();
    // 일요일(0)은 이전 주 월요일로, 그 외는 해당 주 월요일 계산
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
}

function formatDate(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatDateKorean(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const day = d.getDate();
    return `${year}년 ${String(month).padStart(2, '0')}월 ${String(day).padStart(2, '0')}일`;
}

// 6. 예약 유효성 검사
function validateReservation(dateStr, period, id = null) {
    const date = new Date(dateStr);
    const day = date.getDay(); // 0: 일, 6: 토

    // 1) 범위 제한
    const minDate = new Date(CONFIG.START_DATE);
    const maxDate = new Date(CONFIG.END_DATE);
    if (date < minDate || date > maxDate) {
        return { valid: false, message: '예약은 2026년 6월부터 2027년 2월까지만 가능합니다.' };
    }

    // 2) 평일 일과중 검증 (토, 일 불가능)
    if (day === 0 || day === 6) {
        return { valid: false, message: '주말에는 예약을 신청할 수 없습니다. 평일만 가능합니다.' };
    }

    // 3) 수, 목, 금요일 7교시 제외 검증
    // 수(3), 목(4), 금(5)
    if ((day === 3 || day === 4 || day === 5) && period === '7') {
        return { valid: false, message: '수요일, 목요일, 금요일에는 7교시 일과가 없어 예약이 불가능합니다.' };
    }

    // 4) 중복 검증
    const overlap = state.reservations.find(res => res.date === dateStr && res.period === period && res.id !== id);
    if (overlap) {
        return { valid: false, message: `해당 일시(${dateStr}, ${CONFIG.PERIODS.find(p=>p.id===period).name})에는 이미 [${overlap.name}] 님의 예약이 존재합니다.` };
    }

    return { valid: true };
}

// 7. 시간표 렌더링
function renderTimetable() {
    const grid = document.getElementById('timetable-grid');
    grid.innerHTML = '';

    const monday = getMonday(state.currentDate);
    
    // 주간 범위 텍스트 업데이트
    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);
    document.getElementById('current-week-label').innerText = `${formatDateKorean(monday)} ~ ${formatDateKorean(friday)}`;

    // 7.1. 첫 번째 행: 요일 헤더 렌더링
    // (1,1) 빈 코너 셀
    const cornerCell = document.createElement('div');
    cornerCell.className = 'grid-header-cell time-header-cell';
    cornerCell.innerHTML = `<div>교시 / 요일</div>`;
    grid.appendChild(cornerCell);

    // 월 ~ 금 헤더
    const weekdaysDates = [];
    const todayStr = formatDate(new Date());
    
    for (let i = 0; i < 5; i++) {
        const dayDate = new Date(monday);
        dayDate.setDate(monday.getDate() + i);
        const dayDateStr = formatDate(dayDate);
        weekdaysDates.push(dayDateStr);

        const headerCell = document.createElement('div');
        headerCell.className = 'grid-header-cell';
        if (dayDateStr === todayStr) {
            headerCell.classList.add('header-day-today');
        }

        const dateFormatted = `${dayDate.getMonth() + 1}/${dayDate.getDate()}`;
        headerCell.innerHTML = `
            <span class="header-day-name">${CONFIG.WEEKDAYS_KOREAN[i]}요일</span>
            <span class="header-day-date">${dateFormatted}</span>
        `;
        grid.appendChild(headerCell);
    }

    // 7.2. 각 교시별 행 렌더링
    CONFIG.PERIODS.forEach(period => {
        // 첫 번째 열: 교시 안내 셀
        const periodCell = document.createElement('div');
        periodCell.className = 'period-cell';
        
        let timeLabel = period.time;
        // 방과후의 경우, 수목금과 월화 시간 설명 다르게 조정
        if (period.id === 'afterschool') {
            timeLabel = '방과후 활동';
        }

        periodCell.innerHTML = `
            <span class="period-name">${period.name}</span>
            <span class="period-time">${timeLabel}</span>
        `;
        grid.appendChild(periodCell);

        // 월 ~ 금 데이터 슬롯 셀
        for (let i = 0; i < 5; i++) {
            const dateStr = weekdaysDates[i];
            const dayOfWeek = i + 1; // 1:월, 2:화, 3:수, 4:목, 5:금
            
            const slotCell = document.createElement('div');
            
            // 수(3), 목(4), 금(5) 7교시 블로킹 처리
            if ((dayOfWeek >= 3 && dayOfWeek <= 5) && period.id === '7') {
                slotCell.className = 'slot-cell slot-blocked';
                slotCell.innerHTML = `
                    <i class="fa-solid fa-ban"></i>
                    <span>7교시 없음</span>
                `;
            } else {
                // 일반 예약 가능 영역
                slotCell.className = 'slot-cell';
                if (period.id === 'lunch') {
                    slotCell.classList.add('slot-lunch');
                }
                
                // 해당 셀의 예약 찾기
                const reservation = state.reservations.find(res => res.date === dateStr && res.period === period.id);
                
                if (reservation) {
                    slotCell.classList.add('slot-reserved');
                    slotCell.id = `slot-${reservation.id}`;
                    
                    // 방과후 시간 동적 표시
                    let subText = '';
                    if (period.id === 'afterschool') {
                        subText = (dayOfWeek <= 2) ? '17:00 ~' : '16:00 ~';
                    } else {
                        subText = period.time.split(' ')[0]; // 시작 시간만 표시
                    }

                    slotCell.innerHTML = `
                        <div class="reserved-name">
                            <i class="fa-solid fa-user-check"></i> ${escapeHTML(reservation.name)}
                        </div>
                        <div class="reserved-purpose" title="${escapeHTML(reservation.purpose)}">
                            ${escapeHTML(reservation.purpose)}
                        </div>
                        <div class="reserved-tag">${subText}</div>
                    `;
                    
                    // 클릭 이벤트: 상세 보기 / 수정
                    slotCell.addEventListener('click', () => {
                        openBookingModal(dateStr, period.id, reservation.id);
                    });
                } else {
                    // 빈 슬롯 클릭 이벤트: 신규 예약 등록
                    slotCell.addEventListener('click', () => {
                        openBookingModal(dateStr, period.id);
                    });
                }
            }
            grid.appendChild(slotCell);
        }
    });
}

// 8. 모달 관리
function openBookingModal(date, period, bookingId = null) {
    const modal = document.getElementById('booking-modal');
    const form = document.getElementById('booking-form');
    const deleteBtn = document.getElementById('delete-booking-btn');
    const modalTitle = document.getElementById('modal-title');
    
    // 초기화
    form.reset();
    document.getElementById('booking-id').value = bookingId || '';
    
    const dateInput = document.getElementById('booking-date');
    const periodSelect = document.getElementById('booking-period');
    
    dateInput.value = date;
    periodSelect.value = period;

    // 만약 슬롯에서 다이렉트로 들어온 경우, 오조작 방지를 위해 날짜/교시 변경을 비활성화할 수도 있으나
    // 유연한 입력을 위해 여기서는 활성화해 두되 기본값을 잡아 줍니다.
    
    const passwordHelp = document.getElementById('password-help-text');
    const pwdGroup = document.getElementById('booking-password-group');
    const adminBypass = document.getElementById('admin-bypass-banner');
    const pwdInput = document.getElementById('booking-password');
    
    // 관리자 모드인 경우 비밀번호 입력 불필요 처리
    if (state.isAdmin) {
        if (pwdGroup) pwdGroup.style.display = 'none';
        if (adminBypass) adminBypass.style.display = 'block';
        if (pwdInput) pwdInput.removeAttribute('required');
    } else {
        if (pwdGroup) pwdGroup.style.display = 'block';
        if (adminBypass) adminBypass.style.display = 'none';
        if (pwdInput) pwdInput.setAttribute('required', 'required');
    }
    
    if (bookingId) {
        // 수정/삭제 모드
        modalTitle.innerText = '원탁토론실 예약 정보 및 취소';
        const reservation = state.reservations.find(res => res.id === bookingId);
        if (reservation) {
            document.getElementById('booking-name').value = reservation.name;
            document.getElementById('booking-purpose').value = reservation.purpose;
            // 비밀번호는 비워두어 입력을 유도
            document.getElementById('booking-password').value = '';
            document.getElementById('booking-password').placeholder = '기존 비밀번호 4자리 입력';
            if (passwordHelp) {
                passwordHelp.innerText = '예약을 수정하거나 취소하려면 기존 설정했던 비밀번호 4자리를 입력해주세요.';
                passwordHelp.style.color = '#f87171'; // 경고 느낌의 연한 빨간색
            }
        }
        deleteBtn.style.display = 'inline-flex';
        document.getElementById('save-booking-btn').innerText = '수정 완료';
    } else {
        // 신규 예약 모드
        modalTitle.innerText = '원탁토론실 예약 신청';
        deleteBtn.style.display = 'none';
        document.getElementById('booking-password').placeholder = '비밀번호 4자리 숫자';
        if (passwordHelp) {
            passwordHelp.innerText = '예약을 수정하거나 삭제할 때 본인 확인용으로 사용됩니다.';
            passwordHelp.style.color = ''; // 기본 스타일
        }
        document.getElementById('save-booking-btn').innerText = '예약 완료';
    }

    modal.classList.add('active');
}

function closeBookingModal() {
    const modal = document.getElementById('booking-modal');
    modal.classList.remove('active');
}

// 9. 예약 추가 / 수정 / 삭제 비즈니스 로직
function handleBookingSubmit(e) {
    e.preventDefault();

    const id = document.getElementById('booking-id').value;
    const dateStr = document.getElementById('booking-date').value;
    const period = document.getElementById('booking-period').value;
    const name = document.getElementById('booking-name').value.trim();
    const purpose = document.getElementById('booking-purpose').value.trim();
    let password = document.getElementById('booking-password').value;

    // 관리자 모드인 경우 비밀번호 임시 할당
    if (state.isAdmin && !password) {
        password = '1111';
    }

    // 9.1. 입력 검증
    if (!name || !purpose || !password) {
        showToast('모든 필수 항목을 입력해주세요.', 'danger');
        return;
    }

    if (!state.isAdmin && !/^[0-9]{4}$/.test(password)) {
        showToast('비밀번호는 숫자 4자리여야 합니다.', 'danger');
        return;
    }

    const validation = validateReservation(dateStr, period, id);
    if (!validation.valid) {
        showToast(validation.message, 'danger');
        return;
    }

    // 9.2. 수정 시 비밀번호 검증
    if (id) {
        const original = state.reservations.find(res => res.id === id);
        if (original && !state.isAdmin && original.password !== password) {
            showToast('비밀번호가 일치하지 않아 수정할 수 없습니다.', 'danger');
            return;
        }

        // 수정 완료 처리
        original.date = dateStr;
        original.period = period;
        original.name = name;
        original.purpose = purpose;
        // 관리자가 수정할 때 비밀번호를 유지하거나 admin 비번으로 설정하지 않고 원래 비번 그대로 둡니다.
        
        showToast('예약이 정상적으로 수정되었습니다.', 'success');
    } else {
        // 신규 예약 등록
        const newBooking = {
            id: 'book-' + Date.now(),
            date: dateStr,
            period: period,
            name: name,
            purpose: purpose,
            password: password
        };
        state.reservations.push(newBooking);
        showToast('예약이 정상적으로 신청되었습니다.', 'success');
    }

    // 9.3. 저장 및 렌더링 갱신
    saveReservations();
    closeBookingModal();
    
    // 수정한 주차로 뷰 이동 처리
    state.currentDate = new Date(dateStr);
    document.getElementById('date-select-picker').value = dateStr;
    
    renderTimetable();
    updateStats();
    searchBookings(); // 검색 목록 갱신
}

function handleBookingDelete() {
    const id = document.getElementById('booking-id').value;
    const password = document.getElementById('booking-password').value;

    if (!state.isAdmin && !password) {
        showToast('예약을 취소하려면 비밀번호 4자리를 입력해주세요.', 'danger');
        return;
    }

    const original = state.reservations.find(res => res.id === id);
    if (!original) {
        showToast('예약 정보를 찾을 수 없습니다.', 'danger');
        return;
    }

    if (!state.isAdmin && original.password !== password) {
        showToast('비밀번호가 일치하지 않아 예약을 취소할 수 없습니다.', 'danger');
        return;
    }

    // 예약 삭제 진행
    state.reservations = state.reservations.filter(res => res.id !== id);
    saveReservations();
    closeBookingModal();
    
    showToast('예약이 정상적으로 취소되었습니다.', 'success');
    renderTimetable();
    updateStats();
    searchBookings();
}

// 10. 통계 관리
function updateStats() {
    const totalCountEl = document.getElementById('stat-total-count');
    const weekCountEl = document.getElementById('stat-week-count');

    // 누적 예약 수
    totalCountEl.innerText = `${state.reservations.length}건`;

    // 이번주 예약 수 계산
    const monday = getMonday(state.currentDate);
    const datesOfWeek = [];
    for (let i = 0; i < 5; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        datesOfWeek.push(formatDate(d));
    }

    const weekBookings = state.reservations.filter(res => datesOfWeek.includes(res.date));
    weekCountEl.innerText = `${weekBookings.length}건`;
}

// 11. 예약 검색 기능
function searchBookings() {
    const query = document.getElementById('search-input').value.trim().toLowerCase();
    const resultsContainer = document.getElementById('search-results');
    resultsContainer.innerHTML = '';

    if (!query) {
        resultsContainer.innerHTML = `<div class="search-result-empty">이름 또는 용도로 예약을 빠르게 찾아보세요.</div>`;
        return;
    }

    const filtered = state.reservations.filter(res => 
        res.name.toLowerCase().includes(query) || 
        res.purpose.toLowerCase().includes(query)
    );

    // 날짜 오름차순 정렬
    filtered.sort((a, b) => new Date(a.date) - new Date(b.date));

    if (filtered.length === 0) {
        resultsContainer.innerHTML = `<div class="search-result-empty">검색 결과가 없습니다.</div>`;
        return;
    }

    filtered.forEach(res => {
        const item = document.createElement('div');
        item.className = 'search-result-item';
        
        const periodObj = CONFIG.PERIODS.find(p => p.id === res.period);
        const periodName = periodObj ? periodObj.name : res.period;
        
        item.innerHTML = `
            <div class="search-result-item-header">
                <span class="search-result-name">${escapeHTML(res.name)}</span>
                <span class="search-result-date">${res.date.substring(5)} (${periodName})</span>
            </div>
            <div class="search-result-purpose">${escapeHTML(res.purpose)}</div>
        `;

        // 검색 아이템 클릭 시 -> 해당 주차로 뷰를 이동하고, 셀을 일시적으로 하이라이트함
        item.addEventListener('click', () => {
            state.currentDate = new Date(res.date);
            document.getElementById('date-select-picker').value = res.date;
            renderTimetable();
            updateStats();
            
            // 하이라이트 애니메이션 추가
            setTimeout(() => {
                const targetSlot = document.getElementById(`slot-${res.id}`);
                if (targetSlot) {
                    targetSlot.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    targetSlot.style.boxShadow = '0 0 25px #fbbf24';
                    targetSlot.style.borderColor = '#fbbf24';
                    
                    setTimeout(() => {
                        targetSlot.style.boxShadow = '';
                        targetSlot.style.borderColor = '';
                    }, 2000);
                }
            }, 100);
        });

        resultsContainer.appendChild(item);
    });
}

// 12. 백업 (내보내기 / 가져오기)
function exportData() {
    if (state.reservations.length === 0) {
        showToast('내보낼 예약 데이터가 없습니다.', 'warning');
        return;
    }

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state.reservations, null, 2));
    const downloadAnchor = document.createElement('a');
    
    const todayStr = formatDate(new Date());
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `원탁토론실_예약백업_${todayStr}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    
    showToast('백업 파일이 내보내기 되었습니다.', 'success');
}

function importData(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(event) {
        try {
            const imported = JSON.parse(event.target.result);
            
            // 데이터 검증
            if (Array.isArray(imported)) {
                // 필수 필드 존재 여부 확인
                const isValid = imported.every(item => 
                    item.id && item.date && item.period && item.name && item.purpose && item.password
                );
                
                if (isValid) {
                    // 기존 데이터와 병합 또는 덮어쓰기 여부 선택
                    // 여기서는 유실 방지를 위해 중복되지 않는 것은 병합하고 덮어씌웁니다.
                    let mergedCount = 0;
                    let addedCount = 0;
                    
                    imported.forEach(imp => {
                        const idx = state.reservations.findIndex(r => r.id === imp.id || (r.date === imp.date && r.period === imp.period));
                        if (idx > -1) {
                            state.reservations[idx] = imp; // 덮어쓰기
                            mergedCount++;
                        } else {
                            state.reservations.push(imp);
                            addedCount++;
                        }
                    });
                    
                    saveReservations();
                    renderTimetable();
                    updateStats();
                    searchBookings();
                    
                    showToast(`백업 데이터를 성공적으로 가져왔습니다 (추가 ${addedCount}건, 갱신 ${mergedCount}건)`, 'success');
                } else {
                    showToast('백업 파일의 데이터 형식이 올바르지 않습니다.', 'danger');
                }
            } else {
                showToast('올바른 JSON 배열 파일 형식이 아닙니다.', 'danger');
            }
        } catch (err) {
            showToast('파일을 파싱하는 도중 오류가 발생했습니다.', 'danger');
        }
        // 파일 리셋
        e.target.value = '';
    };
    reader.readAsText(file);
}

// 13. UI 알림 (Toast) 시스템
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let iconClass = 'fa-circle-check';
    if (type === 'danger') iconClass = 'fa-circle-exclamation';
    if (type === 'warning') iconClass = 'fa-triangle-exclamation';

    toast.innerHTML = `
        <i class="fa-solid ${iconClass}"></i>
        <span>${message}</span>
    `;

    container.appendChild(toast);

    // 3초 후 삭제 애니메이션 및 엘리먼트 소멸
    setTimeout(() => {
        toast.classList.add('toast-out');
        toast.addEventListener('animationend', () => {
            toast.remove();
        });
    }, 3200);
}

// 14. 공통 이벤트 리스너 바인딩
function setupEventListeners() {
    // 14.1. 주차 이동 네비게이션
    document.getElementById('prev-week-btn').addEventListener('click', () => {
        const prevMon = new Date(getMonday(state.currentDate));
        prevMon.setDate(prevMon.getDate() - 7);
        
        const minLimit = new Date(CONFIG.START_DATE);
        // 만약 이전 주 금요일 혹은 그 주간에 속한 날이 운영 범위보다 이전인 경우 체크
        const prevFri = new Date(prevMon);
        prevFri.setDate(prevMon.getDate() + 4);
        
        if (prevFri < minLimit) {
            showToast('2026년 6월 이전으로는 이동할 수 없습니다.', 'warning');
            return;
        }
        
        state.currentDate = prevMon;
        document.getElementById('date-select-picker').value = formatDate(state.currentDate);
        renderTimetable();
        updateStats();
    });

    document.getElementById('next-week-btn').addEventListener('click', () => {
        const nextMon = new Date(getMonday(state.currentDate));
        nextMon.setDate(nextMon.getDate() + 7);
        
        const maxLimit = new Date(CONFIG.END_DATE);
        
        if (nextMon > maxLimit) {
            showToast('2027년 2월 이후로는 이동할 수 없습니다.', 'warning');
            return;
        }
        
        state.currentDate = nextMon;
        document.getElementById('date-select-picker').value = formatDate(state.currentDate);
        renderTimetable();
        updateStats();
    });

    // 14.2. 헤더 액션
    document.getElementById('today-btn').addEventListener('click', () => {
        const today = new Date();
        const minLimit = new Date(CONFIG.START_DATE);
        const maxLimit = new Date(CONFIG.END_DATE);
        
        if (today < minLimit || today > maxLimit) {
            showToast('오늘 날짜는 원탁토론실 예약 기간(2026.06~2027.02)에 해당하지 않습니다.', 'warning');
            return;
        }
        
        state.currentDate = today;
        document.getElementById('date-select-picker').value = formatDate(today);
        renderTimetable();
        updateStats();
    });

    // 데이트 피커 수동 변경
    document.getElementById('date-select-picker').addEventListener('change', (e) => {
        const chosenDate = new Date(e.target.value);
        const minLimit = new Date(CONFIG.START_DATE);
        const maxLimit = new Date(CONFIG.END_DATE);
        
        if (chosenDate < minLimit || chosenDate > maxLimit) {
            showToast('선택한 날짜는 예약 운영 기간이 아닙니다.', 'danger');
            e.target.value = formatDate(state.currentDate);
            return;
        }

        state.currentDate = chosenDate;
        renderTimetable();
        updateStats();
    });

    // 신규 예약 버튼 클릭 (빈 폼 오픈)
    document.getElementById('new-booking-btn').addEventListener('click', () => {
        const defaultDate = formatDate(state.currentDate);
        // 평일이면 그 날짜 그대로 사용, 주말이면 이번 주 월요일로 바인딩
        const checkDay = new Date(defaultDate).getDay();
        let targetDate = defaultDate;
        if (checkDay === 0 || checkDay === 6) {
            targetDate = formatDate(getMonday(state.currentDate));
        }
        openBookingModal(targetDate, '1');
    });

    // 14.3. 모달 닫기
    document.getElementById('close-modal-btn').addEventListener('click', closeBookingModal);
    document.getElementById('cancel-booking-btn').addEventListener('click', closeBookingModal);
    
    // 모달 바깥 영역 클릭 시 닫기
    window.addEventListener('click', (e) => {
        const modal = document.getElementById('booking-modal');
        if (e.target === modal) {
            closeBookingModal();
        }
    });

    // 14.4. 폼 및 데이터 관련
    document.getElementById('booking-form').addEventListener('submit', handleBookingSubmit);
    document.getElementById('delete-booking-btn').addEventListener('click', handleBookingDelete);

    // 검색 박스 입력 이벤트
    document.getElementById('search-input').addEventListener('input', () => {
        searchBookings();
    });

    // 백업 관리 버튼 바인딩
    document.getElementById('export-btn').addEventListener('click', exportData);
    document.getElementById('import-btn-trigger').addEventListener('click', () => {
        document.getElementById('import-file').click();
    });
    document.getElementById('import-file').addEventListener('change', importData);

    // 14.5. 관리자 로그인/로그아웃 관련
    const adminLoginBtn = document.getElementById('admin-login-btn');
    if (adminLoginBtn) {
        adminLoginBtn.addEventListener('click', () => {
            const adminId = document.getElementById('admin-id').value.trim();
            const adminPw = document.getElementById('admin-pw').value;
            if (adminId === 'admin' && adminPw === '1111') {
                state.isAdmin = true;
                sessionStorage.setItem('round_table_admin', 'true');
                updateAdminUI();
                showToast('관리자 모드로 로그인되었습니다.', 'success');
                // 만약 현재 모달창이 열려있다면 갱신
                const bookingId = document.getElementById('booking-id').value;
                if (bookingId) {
                    const date = document.getElementById('booking-date').value;
                    const period = document.getElementById('booking-period').value;
                    openBookingModal(date, period, bookingId);
                }
            } else {
                showToast('관리자 ID 또는 비밀번호가 올바르지 않습니다.', 'danger');
            }
        });
    }

    const adminLogoutBtn = document.getElementById('admin-logout-btn');
    if (adminLogoutBtn) {
        adminLogoutBtn.addEventListener('click', () => {
            state.isAdmin = false;
            sessionStorage.removeItem('round_table_admin');
            document.getElementById('admin-id').value = '';
            document.getElementById('admin-pw').value = '';
            updateAdminUI();
            showToast('관리자 로그아웃 되었습니다.', 'success');
            // 만약 현재 모달창이 열려있다면 갱신
            const bookingId = document.getElementById('booking-id').value;
            if (bookingId) {
                const date = document.getElementById('booking-date').value;
                const period = document.getElementById('booking-period').value;
                openBookingModal(date, period, bookingId);
            }
        });
    }
}

// 15. 유틸리티 함수
function escapeHTML(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
