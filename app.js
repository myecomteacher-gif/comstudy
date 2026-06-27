// 원탁토의실 예약 시스템 애플리케이션 로직 (app.js)

// 1. Apps Script 소스코드 템플릿
const APPS_SCRIPT_TEMPLATE = `function doGet(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = sheet.getDataRange().getValues();
  var reservations = {};
  
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var dateStr = row[0];
    var periodId = row[1];
    if (!dateStr || !periodId) continue;
    
    // 날짜 객체 포맷 변환
    if (dateStr instanceof Date) {
      var y = dateStr.getFullYear();
      var m = String(dateStr.getMonth() + 1).padStart(2, '0');
      var d = String(dateStr.getDate()).padStart(2, '0');
      dateStr = y + '-' + m + '-' + d;
    } else {
      dateStr = String(dateStr).trim();
    }
    
    periodId = String(periodId).trim();
    
    if (!reservations[dateStr]) {
      reservations[dateStr] = {};
    }
    reservations[dateStr][periodId] = {
      teacher: String(row[2]).trim(),
      purpose: String(row[3]).trim(),
      targetClass: String(row[4]).trim(),
      size: String(row[5]).trim(),
      timestamp: row[6] ? new Date(row[6]).getTime() : Date.now()
    };
  }
  
  return ContentService.createTextOutput(JSON.stringify(reservations))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var params;
  try {
    params = JSON.parse(e.postData.contents);
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  var action = params.action;
  var dateStr = params.date;
  var periodId = String(params.period).trim();
  
  var data = sheet.getDataRange().getValues();
  var rowIndex = -1;
  
  // 기존 예약이 있는지 탐색
  for (var i = 1; i < data.length; i++) {
    var rowDate = data[i][0];
    if (rowDate instanceof Date) {
      var y = rowDate.getFullYear();
      var m = String(rowDate.getMonth() + 1).padStart(2, '0');
      var d = String(rowDate.getDate()).padStart(2, '0');
      rowDate = y + '-' + m + '-' + d;
    } else {
      rowDate = String(rowDate).trim();
    }
    if (rowDate === dateStr && String(data[i][1]).trim() === periodId) {
      rowIndex = i + 1; // 1-based index
      break;
    }
  }
  
  if (action === 'save') {
    var booking = params.booking;
    if (rowIndex !== -1) {
      // 기존행 업데이트
      sheet.getRange(rowIndex, 3).setValue(booking.teacher);
      sheet.getRange(rowIndex, 4).setValue(booking.purpose);
      sheet.getRange(rowIndex, 5).setValue(booking.targetClass);
      sheet.getRange(rowIndex, 6).setValue(booking.size);
      sheet.getRange(rowIndex, 7).setValue(new Date(booking.timestamp));
    } else {
      // 신규행 추가
      sheet.appendRow([dateStr, periodId, booking.teacher, booking.purpose, booking.targetClass, booking.size, new Date(booking.timestamp)]);
    }
  } else if (action === 'delete') {
    if (rowIndex !== -1) {
      sheet.deleteRow(rowIndex);
    }
  }
  
  return ContentService.createTextOutput(JSON.stringify({ status: 'success' }))
    .setMimeType(ContentService.MimeType.JSON);
}`;

// 2. 애플리케이션 상태 관리
const state = {
  currentYear: 2026,
  currentMonth: 6, // 0-indexed (6 = 7월)
  reservations: {},
  selectedDate: null,
  selectedPeriod: null,
  
  // 클라우드 동기화 관련 상태
  isSyncMode: false,
  syncUrl: null,
  pollingIntervalId: null
};

// 3. 예약 가능 기간 제한 상수
const LIMITS = {
  startYear: 2026,
  startMonth: 6, // 7월
  endYear: 2027,
  endMonth: 0  // 1월
};

// 4. 차시 정보 설정
const PERIODS_CONFIG = {
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

// 5. 초기화 함수
document.addEventListener('DOMContentLoaded', () => {
  // 스크립트 복사용 텍스트 기본 셋팅
  document.getElementById('appsScriptCode').value = APPS_SCRIPT_TEMPLATE;

  // 동기화 설정 로드
  loadSyncConfiguration();
  
  // 데이터 로드 (클라우드 vs 로컬)
  if (state.isSyncMode) {
    fetchReservationsFromServer();
    startPolling();
  } else {
    loadLocalReservations();
    renderCalendar();
    updateDashboardStats();
    renderUpcomingBookings();
  }
  
  initCalendarHeader();
  setupEventListeners();
});

// 6. 데이터 로드 및 저장 (로컬 모드)
function loadLocalReservations() {
  const data = localStorage.getItem('roundtable_reservations');
  if (data) {
    try {
      state.reservations = JSON.parse(data);
    } catch (e) {
      console.error('데이터 파싱 오류:', e);
      state.reservations = {};
    }
  } else {
    // 샘플 데이터 삽입
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
    saveLocalReservations();
  }
}

function saveLocalReservations() {
  localStorage.setItem('roundtable_reservations', JSON.stringify(state.reservations));
}

// 7. 클라우드 동기화 제어 로직 (Google Apps Script API)
function loadSyncConfiguration() {
  const savedUrl = localStorage.getItem('roundtable_sync_url');
  if (savedUrl && savedUrl.trim() !== '') {
    state.syncUrl = savedUrl;
    state.isSyncMode = true;
    updateSyncUI(true);
  } else {
    state.syncUrl = null;
    state.isSyncMode = false;
    updateSyncUI(false);
  }
}

function updateSyncUI(isActive) {
  const badge = document.getElementById('syncStatusBadge');
  const banner = document.getElementById('localWarningBanner');
  const btnDisconnect = document.getElementById('btnDisconnectCloud');

  if (isActive) {
    badge.className = 'status-badge badge-cloud';
    badge.innerText = '클라우드 동기화 중';
    banner.style.display = 'none';
    btnDisconnect.style.display = 'block';
  } else {
    badge.className = 'status-badge badge-local';
    badge.innerText = '로컬 모드';
    banner.style.display = 'block';
    btnDisconnect.style.display = 'none';
  }
}

// 서버에서 최신 예약 내역 전체 긁어오기 (GET)
async function fetchReservationsFromServer() {
  if (!state.isSyncMode || !state.syncUrl) return;
  
  try {
    const response = await fetch(state.syncUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    if (!response.ok) throw new Error('서버 응답 비정상');
    
    const data = await response.json();
    state.reservations = data || {};
    
    // 달력 및 스탯 갱신
    renderCalendar();
    updateDashboardStats();
    renderUpcomingBookings();
  } catch (error) {
    console.error('서버 데이터 동기화 실패:', error);
    // 동기화 실패하더라도 UI에 큰 에러 모달을 띄우진 않고 작은 콘솔 경고 및 알림 처리
  }
}

// 서버에 예약 추가/삭제 동기화 전송 (POST)
// Google Apps Script CORS 제약을 회피하기 위해 text/plain 헤더 사용
async function syncBookingToServer(action, date, period, booking = null) {
  if (!state.isSyncMode || !state.syncUrl) return true; // 로컬 모드일 때는 무조건 성공 처리
  
  try {
    const response = await fetch(state.syncUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8' // OPTIONS 프리플라이트를 피하기 위한 헤더 세팅
      },
      body: JSON.stringify({ action, date, period, booking })
    });
    
    // 구글 웹앱 리디렉션 응답으로 인해 응답 본문을 읽기 힘들 수 있으나 성공 응답은 떨어짐
    return true;
  } catch (error) {
    console.error('서버 동기화 중 에러:', error);
    showToast('클라우드 서버 동기화에 실패했습니다. 인터넷을 연결 상태를 확인하세요.', 'error');
    return false;
  }
}

// 자동 폴링 시작/종료
function startPolling() {
  stopPolling();
  // 10초마다 자동 백그라운드 동기화 실행
  state.pollingIntervalId = setInterval(() => {
    fetchReservationsFromServer();
  }, 10000);
}

function stopPolling() {
  if (state.pollingIntervalId) {
    clearInterval(state.pollingIntervalId);
    state.pollingIntervalId = null;
  }
}

// 8. 달력 헤더 제어
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

  if (state.currentYear === LIMITS.startYear && state.currentMonth === LIMITS.startMonth) {
    prevBtn.disabled = true;
  } else {
    prevBtn.disabled = false;
  }

  if (state.currentYear === LIMITS.endYear && state.currentMonth === LIMITS.endMonth) {
    nextBtn.disabled = true;
  } else {
    nextBtn.disabled = false;
  }
}

// 9. 달력 렌더링 로직
function renderCalendar() {
  const daysGrid = document.getElementById('daysGrid');
  daysGrid.innerHTML = '';

  const firstDay = new Date(state.currentYear, state.currentMonth, 1);
  const firstDayIndex = firstDay.getDay();

  const lastDay = new Date(state.currentYear, state.currentMonth + 1, 0);
  const totalDays = lastDay.getDate();

  const prevLastDay = new Date(state.currentYear, state.currentMonth, 0).getDate();

  // 1. 이전 달 날짜 패딩
  for (let i = firstDayIndex; i > 0; i--) {
    const dayCell = document.createElement('div');
    dayCell.className = 'day-cell other-month';
    const dayNum = prevLastDay - i + 1;
    dayCell.innerHTML = `<span class="day-number">${dayNum}</span>`;
    daysGrid.appendChild(dayCell);
  }

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  // 2. 해당 월 날짜 렌더링
  for (let day = 1; day <= totalDays; day++) {
    const dayCell = document.createElement('div');
    
    const formattedMonth = String(state.currentMonth + 1).padStart(2, '0');
    const formattedDay = String(day).padStart(2, '0');
    const dateStr = `${state.currentYear}-${formattedMonth}-${formattedDay}`;

    const cellDate = new Date(state.currentYear, state.currentMonth, day);
    const dayOfWeek = cellDate.getDay();
    
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

    let contentHtml = `<span class="day-number">${day}</span>`;

    // 예약 뱃지 표시
    const dayReservations = state.reservations[dateStr];
    if (dayReservations && !isWeekend) {
      const bookedCount = Object.keys(dayReservations).length;
      if (bookedCount > 0) {
        contentHtml += `<span class="booking-count-badge">${bookedCount}개 예약</span>`;
        contentHtml += `<div class="booking-dots">`;
        for (let k = 0; k < bookedCount; k++) {
          contentHtml += `<span class="booking-dot"></span>`;
        }
        contentHtml += `</div>`;
      }
    }

    dayCell.innerHTML = contentHtml;

    if (!isWeekend) {
      dayCell.addEventListener('click', () => openReservationModal(dateStr));
    } else {
      dayCell.addEventListener('click', () => showToast('주말에는 원탁토의실을 운영하지 않습니다.', 'error'));
    }

    daysGrid.appendChild(dayCell);
  }

  // 3. 다음 달 날짜 패딩
  const totalCells = firstDayIndex + totalDays;
  const nextMonthPadding = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  for (let i = 1; i <= nextMonthPadding; i++) {
    const dayCell = document.createElement('div');
    dayCell.className = 'day-cell other-month';
    dayCell.innerHTML = `<span class="day-number">${i}</span>`;
    daysGrid.appendChild(dayCell);
  }
}

// 10. 모달 창 제어 로직
function openReservationModal(dateStr) {
  state.selectedDate = dateStr;
  state.selectedPeriod = null;

  const dateObj = new Date(dateStr);
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  const formattedHeaderDate = dateObj.toLocaleDateString('ko-KR', options);

  document.getElementById('modalDateTitle').innerText = formattedHeaderDate;
  renderPeriodSelector(dateObj);

  document.getElementById('bookingFormBox').classList.remove('active');
  document.getElementById('reservedViewBox').classList.remove('active');
  
  document.getElementById('btnSubmitBooking').style.display = 'none';
  document.getElementById('btnCancelBooking').style.display = 'none';

  document.getElementById('modalOverlay').classList.add('active');
}

function closeReservationModal() {
  document.getElementById('modalOverlay').classList.remove('active');
  state.selectedDate = null;
  state.selectedPeriod = null;
}

function renderPeriodSelector(dateObj) {
  const periodGrid = document.getElementById('periodSelectorGrid');
  periodGrid.innerHTML = '';

  const dayOfWeek = dateObj.getDay();
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

    slot.addEventListener('click', () => selectPeriodSlot(p.id, isReserved, slot));
    periodGrid.appendChild(slot);
  });
}

function selectPeriodSlot(periodId, isReserved, slotElement) {
  state.selectedPeriod = periodId;

  document.querySelectorAll('.period-slot').forEach(el => {
    el.classList.remove('selected');
  });

  slotElement.classList.add('selected');

  const formBox = document.getElementById('bookingFormBox');
  const viewBox = document.getElementById('reservedViewBox');
  const btnSubmit = document.getElementById('btnSubmitBooking');
  const btnCancel = document.getElementById('btnCancelBooking');

  if (isReserved) {
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
    viewBox.classList.remove('active');
    formBox.classList.add('active');
    
    btnSubmit.style.display = 'block';
    btnCancel.style.display = 'none';

    document.getElementById('inputTeacher').value = '';
    document.getElementById('inputPurpose').value = '';
    document.getElementById('inputClass').value = '';
    document.getElementById('inputSize').value = '20';
  }
}

// 11. 예약 신규 등록 및 취소 비즈니스 로직
async function submitReservation() {
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

  const bookingData = {
    teacher,
    purpose,
    targetClass,
    size,
    timestamp: Date.now()
  };

  // 모달을 닫고 비동기 처리 돌림
  closeReservationModal();
  showToast('예약을 처리하는 중입니다...', 'info');

  // 서버 동기화 시도
  const success = await syncBookingToServer('save', state.selectedDate, state.selectedPeriod, bookingData);
  
  if (success) {
    // 성공 시 클라이언트 캐시 업데이트
    if (!state.reservations[state.selectedDate]) {
      state.reservations[state.selectedDate] = {};
    }
    state.reservations[state.selectedDate][state.selectedPeriod] = bookingData;
    
    if (!state.isSyncMode) {
      saveLocalReservations(); // 로컬 모드일 때만 로컬 저장소 동기화
    }

    renderCalendar();
    updateDashboardStats();
    renderUpcomingBookings();
    showToast('예약이 정상적으로 등록되었습니다!', 'success');
  } else {
    showToast('예약 등록을 실패했습니다. 인터넷 상태를 확인해 주세요.', 'error');
  }
}

async function cancelReservation() {
  if (!state.selectedDate || !state.selectedPeriod) return;

  if (confirm('선택하신 차시의 대관 예약을 취소하시겠습니까?')) {
    const targetDate = state.selectedDate;
    const targetPeriod = state.selectedPeriod;
    
    closeReservationModal();
    showToast('예약 취소를 요청하는 중입니다...', 'info');

    // 서버 동기화 시도
    const success = await syncBookingToServer('delete', targetDate, targetPeriod);

    if (success) {
      // 성공 시 클라이언트 캐시 업데이트
      if (state.reservations[targetDate] && state.reservations[targetDate][targetPeriod]) {
        delete state.reservations[targetDate][targetPeriod];
        if (Object.keys(state.reservations[targetDate]).length === 0) {
          delete state.reservations[targetDate];
        }
      }

      if (!state.isSyncMode) {
        saveLocalReservations();
      }

      renderCalendar();
      updateDashboardStats();
      renderUpcomingBookings();
      showToast('예약이 성공적으로 취소되었습니다.', 'success');
    } else {
      showToast('예약 취소 처리에 실패했습니다. 인터넷 상태를 확인해 주세요.', 'error');
    }
  }
}

// 12. 통계 및 사이드바 제어
function updateDashboardStats() {
  let totalCount = 0;
  Object.keys(state.reservations).forEach(date => {
    totalCount += Object.keys(state.reservations[date]).length;
  });
  document.getElementById('statTotalBookings').innerText = totalCount;

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  
  const todayBookings = state.reservations[todayStr];
  const todayBookedCount = todayBookings ? Object.keys(todayBookings).length : 0;
  
  const dayOfWeek = today.getDay();
  let totalSlotsToday = 0;
  if (dayOfWeek >= 1 && dayOfWeek <= 2) {
    totalSlotsToday = PERIODS_CONFIG.monTue.length;
  } else if (dayOfWeek >= 3 && dayOfWeek <= 5) {
    totalSlotsToday = PERIODS_CONFIG.wedThuFri.length;
  }

  const availableSlotsToday = Math.max(0, totalSlotsToday - todayBookedCount);
  document.getElementById('statTodayAvailable').innerText = dayOfWeek === 0 || dayOfWeek === 6 ? '휴무' : `${availableSlotsToday}개`;
  
  // 최다 대관 교사 통계
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

function renderUpcomingBookings() {
  const container = document.getElementById('upcomingBookingList');
  container.innerHTML = '';

  const list = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  Object.keys(state.reservations).forEach(dateStr => {
    const dateObj = new Date(dateStr);
    if (dateObj >= today) {
      const dayRes = state.reservations[dateStr];
      Object.keys(dayRes).forEach(pId => {
        const item = dayRes[pId];
        const dayOfWeek = dateObj.getDay();
        let pName = pId;
        
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

  list.sort((a, b) => {
    if (a.dateStr !== b.dateStr) return a.dateObj - b.dateObj;
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

  const displayItems = list.slice(0, 6);
  displayItems.forEach(item => {
    const el = document.createElement('div');
    el.className = 'booking-item';
    
    const formattedDate = item.dateObj.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', weekday: 'short' });
    
    el.innerHTML = `
      <span class="booking-item-date">${formattedDate} • ${item.periodName}</span>
      <span class="booking-item-detail">${item.teacher} 선생님</span>
      <span class="booking-item-info">${item.targetClass || '전체 대관'} | ${item.purpose || '수업'}</span>
    `;

    el.addEventListener('click', () => {
      openReservationModal(item.dateStr);
      setTimeout(() => {
        const slotEl = document.querySelector(`.period-slot[data-period-id="${item.periodId}"]`);
        if (slotEl) slotEl.click();
      }, 150);
    });

    container.appendChild(el);
  });
}

// 13. 동기화 설정 인터페이스 제어
function openSettingsModal() {
  const modal = document.getElementById('settingsModalOverlay');
  const inputUrl = document.getElementById('inputWebappUrl');
  
  if (state.syncUrl) {
    inputUrl.value = state.syncUrl;
  } else {
    inputUrl.value = '';
  }

  updateSyncUI(state.isSyncMode);
  modal.classList.add('active');
}

function closeSettingsModal() {
  document.getElementById('settingsModalOverlay').classList.remove('active');
}

// 구글 시트 연동 설정 완료 저장
async function saveSettings() {
  const urlInput = document.getElementById('inputWebappUrl').value.trim();
  
  if (urlInput === '') {
    showToast('구글 웹 앱 URL 주소를 입력해 주세요.', 'error');
    return;
  }
  
  if (!urlInput.startsWith('https://script.google.com/')) {
    showToast('올바른 구글 Apps Script 웹앱 URL이 아닙니다.', 'error');
    return;
  }

  showToast('연동 테스트 진행 중...', 'info');
  
  try {
    // 1단계: 연결 가능 여부 확인 테스트 (GET 요청)
    const response = await fetch(urlInput);
    if (!response.ok) throw new Error();
    
    // 정상적인 응답이 올 경우 연동 성공 처리
    localStorage.setItem('roundtable_sync_url', urlInput);
    state.syncUrl = urlInput;
    state.isSyncMode = true;
    
    // UI 업데이트
    updateSyncUI(true);
    closeSettingsModal();
    
    // 즉시 최신 데이터 긁어오기 및 백그라운드 주기 타이머 작동
    showToast('구글 스프레드시트 연동 성공!', 'success');
    fetchReservationsFromServer();
    startPolling();
  } catch (error) {
    showToast('연동에 실패했습니다. 웹앱 URL 및 배포 설정(모든 사용자 권한)을 확인하세요.', 'error');
  }
}

// 연동 해제 및 로컬 모드로 회귀
function disconnectCloud() {
  if (confirm('클라우드 동기화를 해제하고 로컬 모드로 돌아가시겠습니까? (로컬 PC 브라우저에 임시 저장된 데이터가 복원됩니다.)')) {
    stopPolling();
    localStorage.removeItem('roundtable_sync_url');
    state.syncUrl = null;
    state.isSyncMode = false;
    
    updateSyncUI(false);
    closeSettingsModal();
    
    // 기존 로컬 예약 데이터 리셋 및 재랜더링
    loadLocalReservations();
    renderCalendar();
    updateDashboardStats();
    renderUpcomingBookings();
    
    showToast('클라우드 동기화 해제 완료 (로컬 모드 회귀)', 'success');
  }
}

// 클립보드에 스크립트 복사 기능
function copyAppsScriptCode() {
  const textarea = document.getElementById('appsScriptCode');
  textarea.select();
  textarea.setSelectionRange(0, 99999); // 모바일 기기 호환성

  try {
    navigator.clipboard.writeText(textarea.value);
    showToast('Apps Script 코드가 클립보드에 복사되었습니다!', 'success');
  } catch (err) {
    // 클립보드 API 미지원 환경 대비 fallback
    document.execCommand('copy');
    showToast('코드가 복사되었습니다.', 'success');
  }
}

// 14. 이벤트 리스너 설정
function setupEventListeners() {
  // 이전달/다음달
  document.getElementById('prevMonthBtn').addEventListener('click', () => {
    if (state.currentMonth === 0) {
      state.currentMonth = 11;
      state.currentYear--;
    } else {
      state.currentMonth--;
    }
    updateCalendarTitle();
    checkNavigationLimits();
    if (state.isSyncMode) {
      fetchReservationsFromServer();
    } else {
      renderCalendar();
    }
  });

  document.getElementById('nextMonthBtn').addEventListener('click', () => {
    if (state.currentMonth === 11) {
      state.currentMonth = 0;
      state.currentYear++;
    } else {
      state.currentMonth++;
    }
    updateCalendarTitle();
    checkNavigationLimits();
    if (state.isSyncMode) {
      fetchReservationsFromServer();
    } else {
      renderCalendar();
    }
  });

  // 예약 모달 닫기
  document.getElementById('modalCloseBtn').addEventListener('click', closeReservationModal);
  document.getElementById('btnCancelModal').addEventListener('click', closeReservationModal);
  document.getElementById('modalOverlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('modalOverlay')) closeReservationModal();
  });

  // 예약 등록/삭제 동작
  document.getElementById('btnSubmitBooking').addEventListener('click', submitReservation);
  document.getElementById('btnCancelBooking').addEventListener('click', cancelReservation);

  // 설정 모달 트리거
  document.getElementById('btnOpenSettings').addEventListener('click', openSettingsModal);
  document.getElementById('localWarningBanner').addEventListener('click', openSettingsModal);
  document.getElementById('settingsModalCloseBtn').addEventListener('click', closeSettingsModal);
  document.getElementById('btnCancelSettings').addEventListener('click', closeSettingsModal);
  document.getElementById('settingsModalOverlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('settingsModalOverlay')) closeSettingsModal();
  });

  // 설정 저장 및 해제
  document.getElementById('btnSaveSettings').addEventListener('click', saveSettings);
  document.getElementById('btnDisconnectCloud').addEventListener('click', disconnectCloud);
  document.getElementById('btnCopyScript').addEventListener('click', copyAppsScriptCode);
}

// Toast 알림 팝업 유틸
function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  const icon = type === 'success' ? '✓' : (type === 'error' ? '⚠' : 'ℹ');
  toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
  
  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);
}
