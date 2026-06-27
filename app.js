// 원탁토의실 예약 시스템 애플리케이션 로직 (app.js)

// 1. 애플리케이션 상태 관리
const state = {
  currentYear: 2026,
  currentMonth: 6, // 0-indexed (6 = 7월)
  reservations: {},
  selectedDate: null,
  selectedPeriod: null
};

// 2. 예약 가능 기간 제한 상수
const LIMITS = {
  startYear: 2026,
  startMonth: 6, // 7월
  endYear: 2027,
  endMonth: 0  // 1월
};

// 3. 차시 정보 설정
// 월, 화 : 1~7교시, 점심시간, 방과후
// 수, 목, 금 : 1~6교시, 점심시간, 방과후
const PERIODS_CONFIG = {
  // 월요일(1), 화요일(2)
  monTue: [
    { id: '1', name: '1교시', time: '09:00 - 09:45' },
    { id: '2', name: '2교시', time: '09:55 - 10:40' },
    { id: '3', name: '3교시', time: '10:50 - 11:35' },
    { id: 'lunch', name: '점심시간', time: '11:35 - 12:35' },
    { id: '4', name: '4교시', time: '12:35 - 13:20' },
    { id: '5', name: '5교시', time: '13:30 - 14:15' },
    { id: '6', name: '6교시', time: '14:25 - 15:10' },
    { id: '7', name: '7교시', time: '15:20 - 16:05' },
    { id: 'afterschool', name: '방과후시간', time: '16:15 - 17:30' }
  ],
  // 수요일(3), 목요일(4), 금요일(5)
  wedThuFri: [
    { id: '1', name: '1교시', time: '09:00 - 09:45' },
    { id: '2', name: '2교시', time: '09:55 - 10:40' },
    { id: '3', name: '3교시', time: '10:50 - 11:35' },
    { id: 'lunch', name: '점심시간', time: '11:35 - 12:35' },
    { id: '4', name: '4교시', time: '12:35 - 13:20' },
    { id: '5', name: '5교시', time: '13:30 - 14:15' },
    { id: '6', name: '6교시', time: '14:25 - 15:10' },
    { id: 'afterschool', name: '방과후시간', time: '15:20 - 17:00' }
  ]
};

// 4. 초기화 함수
document.addEventListener('DOMContentLoaded', () => {
  loadReservations();
  initCalendarHeader();
  renderCalendar();
  updateDashboardStats();
  renderUpcomingBookings();
  setupEventListeners();
});

// 5. 로컬 스토리지 데이터 로드 및 저장
function loadReservations() {
  const data = localStorage.getItem('roundtable_reservations');
  if (data) {
    try {
      state.reservations = JSON.parse(data);
    } catch (e) {
      console.error('데이터 파싱 오류:', e);
      state.reservations = {};
    }
  } else {
    // 데모용 샘플 데이터 삽입 (사용자가 처음 접속했을 때 썰렁하지 않게 일부 가상 예약 세팅)
    state.reservations = {
      '2026-07-06': {
        '1': { teacher: '김수현', purpose: '국어 모의 법정 토론 수업', targetClass: '3학년 1반', size: '28', timestamp: Date.now() },
        'lunch': { teacher: '이민호', purpose: '전교 학생자치회 정기 회의', targetClass: '학생회', size: '15', timestamp: Date.now() }
      },
      '2026-07-07': {
        '5': { teacher: '박신혜', purpose: '창의적 체험활동 동아리 발표회', targetClass: '토론동아리', size: '20', timestamp: Date.now() }
      },
      '2026-07-08': {
        '3': { teacher: '최민수', purpose: '역사 역사인물 모의 청문회', targetClass: '2학년 3반', size: '30', timestamp: Date.now() }
      }
    };
    saveReservations();
  }
}

function saveReservations() {
  localStorage.setItem('roundtable_reservations', JSON.stringify(state.reservations));
}

// 6. 달력 헤더 제어 (연도, 월 표시 및 이전/다음 버튼 비활성화 처리)
function initCalendarHeader() {
  updateCalendarTitle();
  checkNavigationLimits();
}

function updateCalendarTitle() {
  const titleEl = document.getElementById('calendarTitle');
  titleEl.innerText = `${state.currentYear}년 ${state.currentMonth + 1}월`;
}

function checkNavigationLimits() {
  const prevBtn = document.getElementById('prevMonthBtn');
  const nextBtn = document.getElementById('nextMonthBtn');

  // 이전 버튼 비활성화 조건: 2026년 7월(6) 이하일 때
  if (state.currentYear === LIMITS.startYear && state.currentMonth === LIMITS.startMonth) {
    prevBtn.disabled = true;
  } else {
    prevBtn.disabled = false;
  }

  // 다음 버튼 비활성화 조건: 2027년 1월(0) 이상일 때
  if (state.currentYear === LIMITS.endYear && state.currentMonth === LIMITS.endMonth) {
    nextBtn.disabled = true;
  } else {
    nextBtn.disabled = false;
  }
}

// 7. 달력 렌더링 로직
function renderCalendar() {
  const daysGrid = document.getElementById('daysGrid');
  daysGrid.innerHTML = '';

  // 해당 월의 첫 번째 날 구하기
  const firstDay = new Date(state.currentYear, state.currentMonth, 1);
  // 첫 번째 날의 요일 (0: 일, 1: 월, ..., 6: 토)
  const firstDayIndex = firstDay.getDay();

  // 해당 월의 마지막 날 구하기
  const lastDay = new Date(state.currentYear, state.currentMonth + 1, 0);
  const totalDays = lastDay.getDate();

  // 이전 달의 마지막 날짜 구하기 (padding용)
  const prevLastDay = new Date(state.currentYear, state.currentMonth, 0).getDate();

  // 1. 이전 달 날짜 패딩 채우기
  for (let i = firstDayIndex; i > 0; i--) {
    const dayCell = document.createElement('div');
    dayCell.className = 'day-cell other-month';
    const dayNum = prevLastDay - i + 1;
    dayCell.innerHTML = `<span class="day-number">${dayNum}</span>`;
    daysGrid.appendChild(dayCell);
  }

  // 오늘 날짜 객체
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  // 2. 해당 월 날짜 채우기
  for (let day = 1; day <= totalDays; day++) {
    const dayCell = document.createElement('div');
    
    // YYYY-MM-DD 날짜 문자열 포맷
    const formattedMonth = String(state.currentMonth + 1).padStart(2, '0');
    const formattedDay = String(day).padStart(2, '0');
    const dateStr = `${state.currentYear}-${formattedMonth}-${formattedDay}`;

    const cellDate = new Date(state.currentYear, state.currentMonth, day);
    const dayOfWeek = cellDate.getDay(); // 0: 일, 6: 토
    
    let isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
    let classList = ['day-cell'];
    
    if (isWeekend) {
      classList.push('disabled-day');
      if (dayOfWeek === 0) classList.push('sunday');
      if (dayOfWeek === 6) classList.push('saturday');
    } else {
      if (dayOfWeek === 0) classList.push('sunday');
      if (dayOfWeek === 6) classList.push('saturday');
    }

    if (dateStr === todayStr) {
      classList.push('today');
    }

    dayCell.className = classList.join(' ');
    dayCell.dataset.date = dateStr;

    // 날짜 번호 레이블
    let contentHtml = `<span class="day-number">${day}</span>`;

    // 예약 현황 점 및 뱃지 표시
    const dayReservations = state.reservations[dateStr];
    if (dayReservations && !isWeekend) {
      const bookedCount = Object.keys(dayReservations).length;
      if (bookedCount > 0) {
        // 예약 개수 뱃지
        contentHtml += `<span class="booking-count-badge">${bookedCount}개 예약</span>`;
        
        // 작은 도트 표시기
        contentHtml += `<div class="booking-dots">`;
        for (let k = 0; k < bookedCount; k++) {
          contentHtml += `<span class="booking-dot"></span>`;
        }
        contentHtml += `</div>`;
      }
    }

    dayCell.innerHTML = contentHtml;

    // 클릭 이벤트 추가 (주말이 아닐 때만 작동)
    if (!isWeekend) {
      dayCell.addEventListener('click', () => openReservationModal(dateStr));
    } else {
      dayCell.addEventListener('click', () => showToast('주말에는 원탁토의실을 운영하지 않습니다.', 'error'));
    }

    daysGrid.appendChild(dayCell);
  }

  // 3. 다음 달 날짜 패딩 채우기 (총 42칸 기준 남은 칸 채우기)
  const totalCells = firstDayIndex + totalDays;
  const nextMonthPadding = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  for (let i = 1; i <= nextMonthPadding; i++) {
    const dayCell = document.createElement('div');
    dayCell.className = 'day-cell other-month';
    dayCell.innerHTML = `<span class="day-number">${i}</span>`;
    daysGrid.appendChild(dayCell);
  }
}

// 8. 모달 제어 로직
function openReservationModal(dateStr) {
  state.selectedDate = dateStr;
  state.selectedPeriod = null;

  const dateObj = new Date(dateStr);
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  const formattedHeaderDate = dateObj.toLocaleDateString('ko-KR', options);

  // 모달 헤더 세팅
  document.getElementById('modalDateTitle').innerText = formattedHeaderDate;

  // 요일별 차시 템플릿 로드
  renderPeriodSelector(dateObj);

  // 폼 및 정보 뷰 숨기기
  document.getElementById('bookingFormBox').classList.remove('active');
  document.getElementById('reservedViewBox').classList.remove('active');
  
  // 예약 등록/취소 버튼 숨김 및 활성화 초기화
  document.getElementById('btnSubmitBooking').style.display = 'none';
  document.getElementById('btnCancelBooking').style.display = 'none';

  // 모달 보이기
  document.getElementById('modalOverlay').classList.add('active');
}

function closeReservationModal() {
  document.getElementById('modalOverlay').classList.remove('active');
  state.selectedDate = null;
  state.selectedPeriod = null;
}

// 요일별 차시 렌더링
function renderPeriodSelector(dateObj) {
  const periodGrid = document.getElementById('periodSelectorGrid');
  periodGrid.innerHTML = '';

  const dayOfWeek = dateObj.getDay(); // 1=월, 2=화, 3=수, 4=목, 5=금
  let periods = [];

  if (dayOfWeek === 1 || dayOfWeek === 2) {
    periods = PERIODS_CONFIG.monTue;
  } else if (dayOfWeek === 3 || dayOfWeek === 4 || dayOfWeek === 5) {
    periods = PERIODS_CONFIG.wedThuFri;
  }

  const dayReservations = state.reservations[state.selectedDate] || {};

  periods.forEach(p => {
    const slot = document.createElement('div');
    const isReserved = !!dayReservations[p.id];
    
    slot.className = `period-slot ${isReserved ? 'reserved' : ''}`;
    slot.dataset.periodId = p.id;

    const statusText = isReserved ? '예약 완료' : '예약 가능';
    const statusClass = isReserved ? 'status-reserved' : 'status-available';

    slot.innerHTML = `
      <div class="period-info">
        <span class="period-name">${p.name}</span>
        <span class="period-time-label">${p.time}</span>
      </div>
      <span class="period-status ${statusClass}">${statusText}</span>
    `;

    // 차시 클릭 이벤트
    slot.addEventListener('click', () => selectPeriodSlot(p.id, isReserved, slot));

    periodGrid.appendChild(slot);
  });
}

// 특정 차시 선택 시 처리
function selectPeriodSlot(periodId, isReserved, slotElement) {
  state.selectedPeriod = periodId;

  // 이전 선택 상태 초기화
  document.querySelectorAll('.period-slot').forEach(el => {
    el.classList.remove('selected');
  });

  slotElement.classList.add('selected');

  const formBox = document.getElementById('bookingFormBox');
  const viewBox = document.getElementById('reservedViewBox');
  const btnSubmit = document.getElementById('btnSubmitBooking');
  const btnCancel = document.getElementById('btnCancelBooking');

  if (isReserved) {
    // 예약 상세 정보 표시
    formBox.classList.remove('active');
    viewBox.classList.add('active');
    
    btnSubmit.style.display = 'none';
    btnCancel.style.display = 'block';

    const info = state.reservations[state.selectedDate][periodId];
    document.getElementById('viewTeacher').innerText = info.teacher;
    document.getElementById('viewPurpose').innerText = info.purpose || '(미입력)';
    document.getElementById('viewClass').innerText = info.targetClass || '(미입력)';
    document.getElementById('viewSize').innerText = info.size ? `${info.size}명` : '(미입력)';
  } else {
    // 예약 폼 표시
    viewBox.classList.remove('active');
    formBox.classList.add('active');
    
    btnSubmit.style.display = 'block';
    btnCancel.style.display = 'none';

    // 폼 인풋값 초기화
    document.getElementById('inputTeacher').value = '';
    document.getElementById('inputPurpose').value = '';
    document.getElementById('inputClass').value = '';
    document.getElementById('inputSize').value = '20';
  }
}

// 9. 예약 추가 및 삭제 비즈니스 로직
function submitReservation() {
  if (!state.selectedDate || !state.selectedPeriod) {
    showToast('날짜와 차시를 선택해주세요.', 'error');
    return;
  }

  const teacher = document.getElementById('inputTeacher').value.trim();
  const purpose = document.getElementById('inputPurpose').value.trim();
  const targetClass = document.getElementById('inputClass').value.trim();
  const size = document.getElementById('inputSize').value;

  if (!teacher) {
    showToast('교사명을 입력해주세요 (필수)', 'error');
    document.getElementById('inputTeacher').focus();
    return;
  }

  // 예약 객체 생성 및 상태 저장
  if (!state.reservations[state.selectedDate]) {
    state.reservations[state.selectedDate] = {};
  }

  state.reservations[state.selectedDate][state.selectedPeriod] = {
    teacher,
    purpose,
    targetClass,
    size,
    timestamp: Date.now()
  };

  saveReservations();
  closeReservationModal();
  renderCalendar();
  updateDashboardStats();
  renderUpcomingBookings();
  showToast('예약이 성공적으로 완료되었습니다!', 'success');
}

function cancelReservation() {
  if (!state.selectedDate || !state.selectedPeriod) return;

  if (confirm('선택하신 차시의 전체 대관 예약을 취소하시겠습니까?')) {
    if (state.reservations[state.selectedDate] && state.reservations[state.selectedDate][state.selectedPeriod]) {
      delete state.reservations[state.selectedDate][state.selectedPeriod];
      
      // 해당 날짜에 예약이 더 이상 없으면 빈 객체 삭제
      if (Object.keys(state.reservations[state.selectedDate]).length === 0) {
        delete state.reservations[state.selectedDate];
      }

      saveReservations();
      closeReservationModal();
      renderCalendar();
      updateDashboardStats();
      renderUpcomingBookings();
      showToast('예약이 정상적으로 취소되었습니다.', 'success');
    }
  }
}

// 10. 통계 및 사이드바 제어
function updateDashboardStats() {
  // 전체 예약 건수 계산
  let totalCount = 0;
  Object.keys(state.reservations).forEach(date => {
    totalCount += Object.keys(state.reservations[date]).length;
  });
  document.getElementById('statTotalBookings').innerText = totalCount;

  // 오늘 날짜 기준 현황 계산
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  
  const todayBookings = state.reservations[todayStr];
  const todayBookedCount = todayBookings ? Object.keys(todayBookings).length : 0;
  
  // 오늘 요일에 맞춰 사용 가능한 전체 차시 수 알아내기
  const dayOfWeek = today.getDay();
  let totalSlotsToday = 0;
  if (dayOfWeek >= 1 && dayOfWeek <= 2) {
    totalSlotsToday = PERIODS_CONFIG.monTue.length;
  } else if (dayOfWeek >= 3 && dayOfWeek <= 5) {
    totalSlotsToday = PERIODS_CONFIG.wedThuFri.length;
  }

  const availableSlotsToday = Math.max(0, totalSlotsToday - todayBookedCount);
  document.getElementById('statTodayAvailable').innerText = dayOfWeek === 0 || dayOfWeek === 6 ? '휴무' : `${availableSlotsToday}개`;
  
  // 가장 많이 예약된 교사 찾기
  const teacherStats = {};
  Object.keys(state.reservations).forEach(date => {
    const dayRes = state.reservations[date];
    Object.keys(dayRes).forEach(pId => {
      const teacher = dayRes[pId].teacher;
      teacherStats[teacher] = (teacherStats[teacher] || 0) + 1;
    });
  });

  let topTeacher = '없음';
  let maxBookings = 0;
  Object.keys(teacherStats).forEach(teacher => {
    if (teacherStats[teacher] > maxBookings) {
      maxBookings = teacherStats[teacher];
      topTeacher = `${teacher} (${maxBookings}회)`;
    }
  });

  document.getElementById('statTopTeacher').innerText = topTeacher;
}

// 사이드바 - 최근/다가올 예약 렌더링
function renderUpcomingBookings() {
  const container = document.getElementById('upcomingBookingList');
  container.innerHTML = '';

  const list = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 예약 평탄화 및 날짜 필터링
  Object.keys(state.reservations).forEach(dateStr => {
    const dateObj = new Date(dateStr);
    // 다가올 날짜 또는 오늘 날짜만 필터링
    if (dateObj >= today) {
      const dayRes = state.reservations[dateStr];
      Object.keys(dayRes).forEach(pId => {
        const item = dayRes[pId];
        
        // 해당 날짜의 요일 구하기
        const dayOfWeek = dateObj.getDay();
        let pName = pId;
        
        // 차시 번호에 매칭되는 한글 이름 찾기
        const pList = (dayOfWeek === 1 || dayOfWeek === 2) ? PERIODS_CONFIG.monTue : PERIODS_CONFIG.wedThuFri;
        const matched = pList.find(x => x.id === pId);
        if (matched) pName = matched.name;

        list.push({
          dateStr,
          dateObj,
          periodId: pId,
          periodName: pName,
          ...item
        });
      });
    }
  });

  // 날짜 및 차시 순으로 정렬
  list.sort((a, b) => {
    if (a.dateStr !== b.dateStr) {
      return a.dateObj - b.dateObj;
    }
    // 차시 정렬 (숫자로 변환 시도, 'lunch' 및 'afterschool' 정렬 순위 설정)
    const getOrder = (id) => {
      if (id === 'lunch') return 3.5;
      if (id === 'afterschool') return 99;
      return parseFloat(id) || 0;
    };
    return getOrder(a.periodId) - getOrder(b.periodId);
  });

  if (list.length === 0) {
    container.innerHTML = `<div class="no-bookings">다가오는 대관 일정이 없습니다.</div>`;
    return;
  }

  // 상위 5개만 목록에 렌더링
  const displayItems = list.slice(0, 6);
  displayItems.forEach(item => {
    const el = document.createElement('div');
    el.className = 'booking-item';
    
    // 날짜 포맷 (M월 D일 요일)
    const formattedDate = item.dateObj.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', weekday: 'short' });
    
    el.innerHTML = `
      <span class="booking-item-date">${formattedDate} • ${item.periodName}</span>
      <span class="booking-item-detail">${item.teacher} 선생님</span>
      <span class="booking-item-info">${item.targetClass || '전체 대관'} | ${item.purpose || '수업'}</span>
    `;

    // 클릭 시 바로 해당 날짜 예약 모달을 열어주는 편의기능 제공
    el.addEventListener('click', () => {
      openReservationModal(item.dateStr);
      // 모달이 열린 후 바로 해당 차시를 자동 선택해줌
      setTimeout(() => {
        const slotEl = document.querySelector(`.period-slot[data-period-id="${item.periodId}"]`);
        if (slotEl) slotEl.click();
      }, 100);
    });

    container.appendChild(el);
  });
}

// 11. 이벤트 리스너 세팅 및 기타 유틸
function setupEventListeners() {
  // 이전달 버튼 클릭
  document.getElementById('prevMonthBtn').addEventListener('click', () => {
    if (state.currentMonth === 0) {
      state.currentMonth = 11;
      state.currentYear--;
    } else {
      state.currentMonth--;
    }
    updateCalendarTitle();
    checkNavigationLimits();
    renderCalendar();
  });

  // 다음달 버튼 클릭
  document.getElementById('nextMonthBtn').addEventListener('click', () => {
    if (state.currentMonth === 11) {
      state.currentMonth = 0;
      state.currentYear++;
    } else {
      state.currentMonth++;
    }
    updateCalendarTitle();
    checkNavigationLimits();
    renderCalendar();
  });

  // 모달 닫기
  document.getElementById('modalCloseBtn').addEventListener('click', closeReservationModal);
  document.getElementById('btnCancelModal').addEventListener('click', closeReservationModal);
  
  // 모달 바깥 백드롭 영역 클릭 시 닫기
  document.getElementById('modalOverlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('modalOverlay')) {
      closeReservationModal();
    }
  });

  // 예약 등록 및 예약 취소 액션
  document.getElementById('btnSubmitBooking').addEventListener('click', submitReservation);
  document.getElementById('btnCancelBooking').addEventListener('click', cancelReservation);
}

// 알림 메시지 팝업 기능
function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  const icon = type === 'success' ? '✓' : '⚠';
  toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
  
  container.appendChild(toast);

  // 3초 후 자동 소멸
  setTimeout(() => {
    toast.remove();
  }, 3000);
}
