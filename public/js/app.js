// Global State
let currentYear = 2026;
let currentMonth = 5; // June (0-indexed in JS)
let reservations = [];
let blockedDates = [];
let adminToken = localStorage.getItem('adminToken') || null;

// Time Slots list
const TIME_SLOTS = ['1교시', '2교시', '3교시', '4교시', '점심시간', '5교시', '6교시', '7교시', '방과후'];

// Date limits: 2026.06 ~ 2027.01
const MIN_DATE = new Date(2026, 5, 1);  // June 2026
const MAX_DATE = new Date(2027, 0, 31); // January 2027

// DOM Elements
const calendarGrid = document.getElementById('calendar-grid');
const currentMonthLabel = document.getElementById('current-month-label');
const prevMonthBtn = document.getElementById('prev-month-btn');
const nextMonthBtn = document.getElementById('next-month-btn');
const liveClock = document.getElementById('clock-text');
const adminBtn = document.getElementById('admin-btn');
const adminBtnText = document.getElementById('admin-btn-text');
const adminBadgeBar = document.getElementById('admin-badge-bar');
const adminLogoutBtn = document.getElementById('admin-logout-btn');
const totalReservationsCount = document.getElementById('total-reservations-count');
const monthlyReservationsCount = document.getElementById('monthly-reservations-count');

// Modals
const reservationModal = document.getElementById('reservation-modal');
const reservationForm = document.getElementById('reservation-form');
const detailModal = document.getElementById('detail-modal');
const adminLoginModal = document.getElementById('admin-login-modal');
const adminLoginForm = document.getElementById('admin-login-form');
const toastContainer = document.getElementById('toast-container');

// Detail modal sub-elements
const detailViewMode = document.getElementById('detail-view-mode');
const detailEditForm = document.getElementById('detail-edit-form');
const viewResDate = document.getElementById('view-res-date');
const viewResName = document.getElementById('view-res-name');
const viewResTime = document.getElementById('view-res-time');
const viewResPurpose = document.getElementById('view-res-purpose');
const passwordCheckBlock = document.getElementById('password-check-block');
const actionPasswordInput = document.getElementById('action-password');
const detailDeleteBtn = document.getElementById('detail-delete-btn');
const detailEditBtn = document.getElementById('detail-edit-btn');

// System base time initialization (from system info: 2026-06-23T13:40:05)
let systemTime = new Date('2026-06-23T13:40:05+09:00');
setInterval(() => {
  systemTime.setSeconds(systemTime.getSeconds() + 1);
  updateClock();
}, 1000);

function updateClock() {
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const yyyy = systemTime.getFullYear();
  const mm = String(systemTime.getMonth() + 1).padStart(2, '0');
  const dd = String(systemTime.getDate()).padStart(2, '0');
  const dayName = days[systemTime.getDay()];
  const hh = String(systemTime.getHours()).padStart(2, '0');
  const min = String(systemTime.getMinutes()).padStart(2, '0');
  const ss = String(systemTime.getSeconds()).padStart(2, '0');
  liveClock.textContent = `${yyyy}. ${mm}. ${dd}. (${dayName}) ${hh}:${min}:${ss}`;
}

// Toast Notifications Helper
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  const icon = document.createElement('span');
  icon.className = 'material-icons-round';
  if (type === 'success') icon.textContent = 'check_circle';
  else if (type === 'error') icon.textContent = 'error';
  else icon.textContent = 'info';
  
  const text = document.createElement('span');
  text.className = 'toast-message';
  text.textContent = message;
  
  toast.appendChild(icon);
  toast.appendChild(text);
  toastContainer.appendChild(toast);
  
  // Slide out after 3.5s and remove after 4s
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
  }, 3500);
  
  setTimeout(() => {
    toast.remove();
  }, 4000);
}

// Check Admin Status on load
async function checkAdminStatus() {
  if (!adminToken) {
    updateAdminUI(false);
    return;
  }
  try {
    const response = await fetch('/api/admin/status', {
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    });
    const data = await response.json();
    updateAdminUI(data.authenticated);
    if (!data.authenticated) {
      adminToken = null;
      localStorage.removeItem('adminToken');
    }
  } catch (e) {
    console.error("Admin status check failed", e);
    updateAdminUI(false);
  }
}

function updateAdminUI(isLoggedIn) {
  if (isLoggedIn) {
    adminBtn.classList.add('hidden');
    adminBadgeBar.classList.remove('hidden');
    document.querySelectorAll('.admin-only-field').forEach(el => el.classList.remove('hidden'));
  } else {
    adminBtn.classList.remove('hidden');
    adminBadgeBar.classList.add('hidden');
    document.querySelectorAll('.admin-only-field').forEach(el => el.classList.add('hidden'));
  }
  // Re-draw calendar to show admin actions (e.g. unblock date clicks, passwords requirements)
  renderCalendar();
}

// Fetch reservations
async function loadReservations() {
  try {
    const response = await fetch('/api/reservations');
    if (!response.ok) throw new Error("Failed to fetch reservations");
    const data = await response.json();
    reservations = data.reservations;
    blockedDates = data.blocked_dates;
    
    updateStats();
    renderCalendar();
  } catch (error) {
    console.error(error);
    showToast("예약 데이터를 불러오는 데 실패했습니다.", "error");
  }
}

function updateStats() {
  totalReservationsCount.textContent = reservations.length;
  
  // Filter for currently viewed month
  const monthlyRes = reservations.filter(res => {
    const resDate = new Date(res.date);
    return resDate.getFullYear() === currentYear && resDate.getMonth() === currentMonth;
  });
  monthlyReservationsCount.textContent = monthlyRes.length;
}

// Date Formatter Helper
function formatDateString(year, month, day) {
  const mm = String(month + 1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

// Render Calendar
function renderCalendar() {
  calendarGrid.innerHTML = '';
  
  // Set month label
  currentMonthLabel.textContent = `${currentYear}년 ${currentMonth + 1}월`;
  
  // Check boundary constraints for prev/next buttons
  const isAtMin = (currentYear === MIN_DATE.getFullYear() && currentMonth === MIN_DATE.getMonth());
  const isAtMax = (currentYear === MAX_DATE.getFullYear() && currentMonth === MAX_DATE.getMonth());
  
  prevMonthBtn.disabled = isAtMin;
  prevMonthBtn.style.visibility = isAtMin ? 'hidden' : 'visible';
  nextMonthBtn.disabled = isAtMax;
  nextMonthBtn.style.visibility = isAtMax ? 'hidden' : 'visible';
  
  // First day of current month
  const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
  // Total days in current month
  const totalDays = new Date(currentYear, currentMonth + 1, 0).getDate();
  
  // Render empty padding cells for previous month's days
  for (let i = 0; i < firstDayIndex; i++) {
    const emptyCell = document.createElement('div');
    emptyCell.className = 'calendar-day empty-day';
    calendarGrid.appendChild(emptyCell);
  }
  
  // Render active days
  for (let day = 1; day <= totalDays; day++) {
    const dateStr = formatDateString(currentYear, currentMonth, day);
    const isBlocked = blockedDates.includes(dateStr);
    
    // Day Cell container
    const dayCell = document.createElement('div');
    dayCell.className = 'calendar-day';
    dayCell.dataset.date = dateStr;
    
    // Check if it's today
    const checkDate = new Date(dateStr);
    const todayStr = formatDateString(systemTime.getFullYear(), systemTime.getMonth(), systemTime.getDate());
    if (dateStr === todayStr) {
      dayCell.classList.add('today');
    }
    
    // Add weekends coloring classes
    const dayOfWeek = checkDate.getDay();
    if (dayOfWeek === 0) dayCell.classList.add('sunday');
    if (dayOfWeek === 6) dayCell.classList.add('saturday');
    
    // Number wrapper
    const numWrapper = document.createElement('div');
    numWrapper.className = 'day-number-wrapper';
    
    const numSpan = document.createElement('span');
    numSpan.className = 'day-num';
    numSpan.textContent = day;
    numWrapper.appendChild(numSpan);
    dayCell.appendChild(numWrapper);
    
    // Day reservation content
    const resContainer = document.createElement('div');
    resContainer.className = 'cell-reservations';
    
    if (isBlocked) {
      dayCell.classList.add('day-status-blocked');
      const blockSpan = document.createElement('div');
      blockSpan.className = 'blocked-label';
      blockSpan.innerHTML = '<span class="material-icons-round">block</span>예약 불가';
      resContainer.appendChild(blockSpan);
    } else {
      // Find reservations for this day
      const dayRes = reservations.filter(r => r.date === dateStr);
      
      // Calculate how many periods are booked
      let bookedSlots = new Set();
      dayRes.forEach(r => {
        r.time_slots.forEach(slot => bookedSlots.add(slot));
      });
      
      if (bookedSlots.size === 0) {
        // Available
      } else if (bookedSlots.size >= TIME_SLOTS.length) {
        dayCell.classList.add('day-status-full');
      } else {
        dayCell.classList.add('day-status-partial');
      }
      
      // Render badges
      dayRes.forEach(res => {
        const badge = document.createElement('div');
        badge.className = 'res-badge';
        badge.dataset.id = res.id;
        badge.title = `${res.name}: ${res.time_slots.join(', ')} (${res.purpose})`;
        
        // Show condensed slots e.g. "1,2교시"
        const condensedSlots = res.time_slots.map(s => s.replace('교시', '')).join(',');
        
        badge.innerHTML = `
          <span class="res-badge-periods">${condensedSlots}</span>
          <span class="res-badge-name">${res.name.split(' ')[0]}</span>
        `;
        
        badge.addEventListener('click', (e) => {
          e.stopPropagation(); // Prevent opening new reservation modal
          openDetailModal(res);
        });
        
        resContainer.appendChild(badge);
      });
    }
    
    dayCell.appendChild(resContainer);
    
    // Click Handler for date cell
    dayCell.addEventListener('click', () => {
      if (isBlocked) {
        if (adminToken) {
          // If admin clicked a blocked day, prompt to unblock
          if (confirm(`${dateStr}의 예약 잠금을 해제하시겠습니까?`)) {
            unblockDate(dateStr);
          }
        } else {
          showToast("해당 날짜는 학교 행사 등으로 인해 예약할 수 없습니다.", "error");
        }
      } else {
        openReservationModal(dateStr);
      }
    });
    
    calendarGrid.appendChild(dayCell);
  }
  
  // Fill remaining cells for grid consistency (6 rows * 7 columns = 42 cells)
  const remainingCells = 42 - (firstDayIndex + totalDays);
  for (let i = 0; i < remainingCells; i++) {
    const emptyCell = document.createElement('div');
    emptyCell.className = 'calendar-day empty-day';
    calendarGrid.appendChild(emptyCell);
  }
}

// Modal open/close helpers
function openModal(modal) {
  modal.classList.remove('hidden');
}

function closeModal(modal) {
  modal.classList.add('hidden');
  // Reset forms inside if any
  const form = modal.querySelector('form');
  if (form) form.reset();
}

// Open Reservation Request Modal
function openReservationModal(dateStr) {
  openModal(reservationModal);
  document.getElementById('res-date').value = dateStr;
  
  // Check dynamic slot occupancy
  const dayRes = reservations.filter(r => r.date === dateStr);
  const occupiedSlots = new Set();
  dayRes.forEach(r => {
    r.time_slots.forEach(slot => occupiedSlots.add(slot));
  });
  
  // Render slots chips and disable already occupied ones
  const container = document.getElementById('time-slot-container');
  container.innerHTML = '';
  
  TIME_SLOTS.forEach(slot => {
    const isOccupied = occupiedSlots.has(slot);
    const label = document.createElement('label');
    label.className = 'time-slot-chip';
    
    label.innerHTML = `
      <input type="checkbox" name="time_slots" value="${slot}" ${isOccupied ? 'disabled' : ''}>
      <span class="chip-label">${slot} ${isOccupied ? '(예약됨)' : ''}</span>
    `;
    container.appendChild(label);
  });
  
  // If admin is logged in, show block date control
  const adminControlBlock = document.getElementById('admin-block-control');
  if (adminToken) {
    adminControlBlock.classList.remove('hidden');
    document.getElementById('admin-block-date-checkbox').checked = false;
  } else {
    adminControlBlock.classList.add('hidden');
  }
}

// Open Detail Modal
function openDetailModal(res) {
  openModal(detailModal);
  
  // Set View Mode values
  viewResDate.textContent = res.date;
  viewResName.textContent = res.name;
  viewResTime.textContent = res.time_slots.join(', ');
  viewResPurpose.textContent = res.purpose;
  
  // Stash reservation data on the buttons
  detailDeleteBtn.dataset.id = res.id;
  detailEditBtn.dataset.id = res.id;
  
  // Show/Hide password block depending on Admin status
  if (adminToken) {
    passwordCheckBlock.classList.add('hidden');
  } else {
    passwordCheckBlock.classList.remove('hidden');
    actionPasswordInput.value = '';
  }
  
  // Reset Modes
  detailViewMode.classList.remove('hidden');
  detailEditForm.classList.add('hidden');
}

// Open Reservation Edit form inside Detail Modal
function switchToEditMode(res) {
  detailViewMode.classList.add('hidden');
  detailEditForm.classList.remove('hidden');
  
  document.getElementById('edit-res-id').value = res.id;
  document.getElementById('edit-res-date').value = res.date;
  document.getElementById('edit-res-name').value = res.name;
  document.getElementById('edit-res-purpose').value = res.purpose;
  document.getElementById('edit-new-password').value = '';
  
  // Get occupied slots on that date, excluding current reservation slots
  const dayRes = reservations.filter(r => r.date === res.date && r.id !== res.id);
  const occupiedSlots = new Set();
  dayRes.forEach(r => {
    r.time_slots.forEach(slot => occupiedSlots.add(slot));
  });
  
  // Populate edit time slots
  const container = document.getElementById('edit-time-slot-container');
  container.innerHTML = '';
  
  TIME_SLOTS.forEach(slot => {
    const isOccupied = occupiedSlots.has(slot);
    const isChecked = res.time_slots.includes(slot);
    
    const label = document.createElement('label');
    label.className = 'time-slot-chip';
    
    label.innerHTML = `
      <input type="checkbox" name="edit_time_slots" value="${slot}" 
        ${isOccupied ? 'disabled' : ''} 
        ${isChecked ? 'checked' : ''}>
      <span class="chip-label">${slot} ${isOccupied ? '(예약됨)' : ''}</span>
    `;
    container.appendChild(label);
  });
}

// API: Block a Date (Admin only)
async function blockDate(dateStr) {
  try {
    const response = await fetch('/api/admin/block', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ date: dateStr })
    });
    
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "날짜 차단 실패");
    }
    
    showToast(`${dateStr}이 예약 불가로 차단되었습니다.`, "success");
    loadReservations();
  } catch (error) {
    showToast(error.message, "error");
  }
}

// API: Unblock a Date (Admin only)
async function unblockDate(dateStr) {
  try {
    const response = await fetch('/api/admin/block', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ date: dateStr })
    });
    
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "차단 해제 실패");
    }
    
    showToast(`${dateStr}의 예약 차단이 해제되었습니다.`, "success");
    loadReservations();
  } catch (error) {
    showToast(error.message, "error");
  }
}

// Event Listeners for switching months
prevMonthBtn.addEventListener('click', () => {
  currentMonth--;
  if (currentMonth < 0) {
    currentMonth = 11;
    currentYear--;
  }
  updateStats();
  renderCalendar();
});

nextMonthBtn.addEventListener('click', () => {
  currentMonth++;
  if (currentMonth > 11) {
    currentMonth = 0;
    currentYear++;
  }
  updateStats();
  renderCalendar();
});

// Theme Toggle
const themeToggleBtn = document.getElementById('theme-toggle');
themeToggleBtn.addEventListener('click', () => {
  const body = document.body;
  if (body.classList.contains('light-mode')) {
    body.classList.replace('light-mode', 'dark-mode');
    themeToggleBtn.querySelector('span').textContent = 'light_mode';
    localStorage.setItem('theme', 'dark');
  } else {
    body.classList.replace('dark-mode', 'light-mode');
    themeToggleBtn.querySelector('span').textContent = 'dark_mode';
    localStorage.setItem('theme', 'light');
  }
});

// Admin modal open trigger
adminBtn.addEventListener('click', () => openModal(adminLoginModal));

// Admin logout trigger
adminLogoutBtn.addEventListener('click', () => {
  adminToken = null;
  localStorage.removeItem('adminToken');
  updateAdminUI(false);
  showToast("로그아웃되었습니다.", "info");
});

// Handle Admin Login submission
adminLoginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('admin-username').value;
  const password = document.getElementById('admin-password').value;
  
  try {
    const response = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "로그인 실패");
    
    adminToken = data.token;
    localStorage.setItem('adminToken', adminToken);
    updateAdminUI(true);
    closeModal(adminLoginModal);
    showToast("관리자로 로그인하였습니다.", "success");
  } catch (error) {
    showToast(error.message, "error");
  }
});

// Handle Reservation Request submission
reservationForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const date = document.getElementById('res-date').value;
  const name = document.getElementById('res-name').value.trim();
  const password = document.getElementById('res-password').value;
  const purpose = document.getElementById('res-purpose').value.trim();
  
  // If admin selected to block the date instead
  const isBlockChecked = document.getElementById('admin-block-date-checkbox')?.checked;
  if (adminToken && isBlockChecked) {
    await blockDate(date);
    closeModal(reservationModal);
    return;
  }
  
  // Gather selected time slots
  const selectedCheckboxes = document.querySelectorAll('input[name="time_slots"]:checked');
  const time_slots = Array.from(selectedCheckboxes).map(cb => cb.value);
  
  if (time_slots.length === 0) {
    showToast("최소 하나의 예약 시간을 선택해야 합니다.", "error");
    return;
  }
  
  try {
    const response = await fetch('/api/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, name, password, purpose, time_slots })
    });
    
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "예약 신청 실패");
    
    showToast("원탁토의실 예약이 신청되었습니다.", "success");
    closeModal(reservationModal);
    loadReservations();
  } catch (error) {
    showToast(error.message, "error");
  }
});

// Handle Delete Reservation Action
detailDeleteBtn.addEventListener('click', async () => {
  const id = detailDeleteBtn.dataset.id;
  const password = actionPasswordInput.value;
  
  if (!adminToken && !password) {
    showToast("본인인증을 위해 비밀번호를 입력해주세요.", "error");
    return;
  }
  
  if (confirm("정말로 이 예약을 취소하시겠습니까?")) {
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (adminToken) {
        headers['Authorization'] = `Bearer ${adminToken}`;
      }
      
      const response = await fetch(`/api/reservations/${id}`, {
        method: 'DELETE',
        headers: headers,
        body: JSON.stringify({ password })
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "예약 삭제 실패");
      
      showToast("예약이 취소되었습니다.", "success");
      closeModal(detailModal);
      loadReservations();
    } catch (error) {
      showToast(error.message, "error");
    }
  }
});

// Handle Edit Button Click (Switch to Edit Mode)
detailEditBtn.addEventListener('click', () => {
  const id = detailEditBtn.dataset.id;
  const password = actionPasswordInput.value;
  
  if (!adminToken && !password) {
    showToast("본인인증을 위해 비밀번호를 입력해주세요.", "error");
    return;
  }
  
  const target = reservations.find(r => r.id === id);
  if (!target) return;
  
  // If not admin, we do a quick local password check to prevent switching modes if incorrect,
  // though the server will validate it again during submission.
  // Wait, since password isn't sent to frontend for security, we can't do local checks.
  // Instead, we switch to edit mode and validate on submit! That's correct.
  switchToEditMode(target);
});

// Cancel Edit mode inside modal
document.getElementById('edit-cancel-btn').addEventListener('click', () => {
  detailEditForm.classList.add('hidden');
  detailViewMode.classList.remove('hidden');
});

// Submit Edit Reservation Form
detailEditForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const id = document.getElementById('edit-res-id').value;
  const name = document.getElementById('edit-res-name').value.trim();
  const purpose = document.getElementById('edit-res-purpose').value.trim();
  const newPassword = document.getElementById('edit-new-password').value;
  
  // Current action password (inputted in view mode)
  const password = actionPasswordInput.value;
  
  // Gather selected time slots
  const selectedCheckboxes = document.querySelectorAll('input[name="edit_time_slots"]:checked');
  const time_slots = Array.from(selectedCheckboxes).map(cb => cb.value);
  
  if (time_slots.length === 0) {
    showToast("최소 하나의 예약 시간을 선택해야 합니다.", "error");
    return;
  }
  
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (adminToken) {
      headers['Authorization'] = `Bearer ${adminToken}`;
    }
    
    const bodyPayload = { name, purpose, time_slots, password };
    if (newPassword) {
      bodyPayload.new_password = newPassword;
    }
    
    const response = await fetch(`/api/reservations/${id}`, {
      method: 'PUT',
      headers: headers,
      body: JSON.stringify(bodyPayload)
    });
    
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "예약 수정 실패");
    
    showToast("예약 정보가 수정되었습니다.", "success");
    closeModal(detailModal);
    loadReservations();
  } catch (error) {
    showToast(error.message, "error");
  }
});

// Attach Close triggers to all modal close elements
document.querySelectorAll('.close-modal-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const modal = e.target.closest('.modal-overlay');
    if (modal) closeModal(modal);
  });
});

// Click outside modal to close it
window.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    closeModal(e.target);
  }
});

// Initial Setup on load
document.addEventListener('DOMContentLoaded', () => {
  // Theme check
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark') {
    document.body.classList.replace('light-mode', 'dark-mode');
    themeToggleBtn.querySelector('span').textContent = 'light_mode';
  }
  
  updateClock();
  checkAdminStatus();
  loadReservations();
});
