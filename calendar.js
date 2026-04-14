import {
  onAuthChange, logout,
  getAssignments, updateAssignment, deleteAssignment, toggleComplete as firestoreToggle
} from "./script.js";

// ── Local cache ───────────────────────────────────────────────
let cachedAssignments = [];

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];

// ── Auth guard ────────────────────────────────────────────────
onAuthChange(user => {
  if (!user) {
    window.location.href = "index.html";
  } else {
    document.getElementById('navUser').textContent = user.email;
    renderCalendar(); // first load from Firestore
  }
});

document.getElementById('logoutBtn').addEventListener('click', () => logout());

// ── Helpers ───────────────────────────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateLong(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function getStatusBadge(dateStr, completed) {
  if (completed) return { label: '&#10003; Complete', cls: 'done-badge' };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [y, m, d] = dateStr.split('-').map(Number);
  const diff = Math.ceil((new Date(y, m - 1, d) - today) / 86400000);
  if (diff < 0)   return { label: 'Overdue',   cls: 'urgent-badge' };
  if (diff === 0) return { label: 'Due Today', cls: 'urgent-badge' };
  if (diff <= 3)  return { label: 'Due Soon',  cls: 'urgent-badge' };
  if (diff <= 7)  return { label: 'This Week', cls: 'soon-badge'   };
  return               { label: 'Upcoming',    cls: 'ok-badge'     };
}

function getChipClass(dueDate, completed) {
  if (completed) return 'chip-done';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [y, m, d] = dueDate.split('-').map(Number);
  const diff = Math.ceil((new Date(y, m - 1, d) - today) / 86400000);
  if (diff < 0)  return 'chip-overdue';
  if (diff <= 3) return 'chip-urgent';
  if (diff <= 7) return 'chip-soon';
  return 'chip-ok';
}

let viewYear        = new Date().getFullYear();
let viewMonth       = new Date().getMonth();
let selectedDayDate = null;
let editingId       = null;

// ── Calendar Render (async — fetches from Firestore) ──────────
async function renderCalendar() {
  // Fetch this user's assignments from Firestore and update the cache
  cachedAssignments = await getAssignments();

  document.getElementById('monthLabel').textContent = `${MONTHS[viewMonth]} ${viewYear}`;

  const grid     = document.getElementById('calGrid');
  grid.innerHTML = '';

  const firstDay    = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const today       = new Date();

  // Build a date → assignments map from the cache
  const assignMap = {};
  cachedAssignments.forEach(a => {
    if (!a || !a.dueDate) return;
    if (!assignMap[a.dueDate]) assignMap[a.dueDate] = [];
    assignMap[a.dueDate].push(a);
  });

  for (let i = 0; i < firstDay; i++) {
    const empty = document.createElement('div');
    empty.className = 'cal-day empty';
    grid.appendChild(empty);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const cell = document.createElement('div');
    cell.className = 'cal-day';

    const mm      = String(viewMonth + 1).padStart(2, '0');
    const dd      = String(day).padStart(2, '0');
    const dateStr = `${viewYear}-${mm}-${dd}`;

    const isToday = today.getFullYear() === viewYear &&
                    today.getMonth()    === viewMonth &&
                    today.getDate()     === day;
    if (isToday) cell.classList.add('today');

    const dayItems = assignMap[dateStr] || [];

    const numEl = document.createElement('div');
    numEl.className = 'cal-day-num' + (isToday ? ' today-num' : '');
    numEl.textContent = day;
    cell.appendChild(numEl);

    const MAX_SHOWN = 3;
    dayItems.slice(0, MAX_SHOWN).forEach(a => {
      const chip = document.createElement('div');
      chip.className   = `cal-chip ${getChipClass(a.dueDate, a.completed)}`;
      chip.textContent = `${a.course} · ${a.title}`;
      chip.title       = `${a.course}: ${a.title}`;
      cell.appendChild(chip);
    });

    const extra = dayItems.length - MAX_SHOWN;
    if (extra > 0) {
      const more = document.createElement('div');
      more.className   = 'cal-more';
      more.textContent = `+${extra} more`;
      cell.appendChild(more);
    }

    if (dayItems.length > 0) {
      cell.classList.add('cal-day-has-items');
      cell.addEventListener('click', () => openDayModal(dateStr));
    }

    grid.appendChild(cell);
  }
}

// ── Day Modal (reads from cache — synchronous) ────────────────
function openDayModal(dateStr) {
  selectedDayDate = dateStr;
  renderDayModal();
  document.getElementById('calDayOverlay').classList.remove('hidden');
}

function closeDayModal() {
  document.getElementById('calDayOverlay').classList.add('hidden');
  selectedDayDate = null;
}

function renderDayModal() {
  // Filter from cache — no Firestore call needed
  const dayAssignments = cachedAssignments.filter(a => a.dueDate === selectedDayDate);

  document.getElementById('calDayTitle').textContent =
    `Assignments — ${formatDateLong(selectedDayDate)}`;

  const list = document.getElementById('calDayList');

  if (dayAssignments.length === 0) {
    list.innerHTML = `
      <div class="empty-state" style="padding:2rem 1rem;">
        <div class="empty-icon">&#128203;</div>
        <h3>No assignments</h3>
        <p>Nothing due on this day.</p>
      </div>`;
    return;
  }

  list.innerHTML = dayAssignments.map(a => {
    const badge = getStatusBadge(a.dueDate, a.completed);
    return `
      <div class="day-modal-row ${a.completed ? 'row-done' : ''}">
        <div class="day-modal-info">
          <div class="day-modal-title-row">
            <span class="row-title">${a.title}</span>
            <span class="uc-badge ${badge.cls}">${badge.label}</span>
          </div>
          <div class="day-modal-meta">
            <span class="row-course">${a.course}</span>
            <span class="row-date">&#128197; ${formatDate(a.dueDate)}</span>
            ${a.notes ? `<span class="row-notes">${a.notes}</span>` : ''}
          </div>
        </div>
        <div class="row-actions">
          <button class="btn-icon btn-complete ${a.completed ? 'completed' : ''}"
                  data-id="${a.id}" title="${a.completed ? 'Mark incomplete' : 'Mark complete'}">&#10003;</button>
          <button class="btn-icon btn-day-edit"   data-id="${a.id}" title="Edit">&#9998;</button>
          <button class="btn-icon btn-day-delete" data-id="${a.id}" title="Delete">&#128465;</button>
        </div>
      </div>`;
  }).join('');

  list.querySelectorAll('.btn-complete').forEach(btn =>
    btn.addEventListener('click', async () => {
      const a = cachedAssignments.find(x => x.id === btn.dataset.id);
      if (!a) return;
      await firestoreToggle(a.id, a.completed);
      await renderCalendar();
      renderDayModal();
    }));

  list.querySelectorAll('.btn-day-edit').forEach(btn =>
    btn.addEventListener('click', () => openEditModal(btn.dataset.id)));

  list.querySelectorAll('.btn-day-delete').forEach(btn =>
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this assignment?')) return;
      await deleteAssignment(btn.dataset.id);
      await renderCalendar(); // refreshes cache
      const remaining = cachedAssignments.filter(a => a.dueDate === selectedDayDate);
      if (remaining.length === 0) {
        closeDayModal();
      } else {
        renderDayModal();
      }
    }));
}

// ── Edit Modal ────────────────────────────────────────────────
function openEditModal(id) {
  editingId = id;
  const a = cachedAssignments.find(x => x.id === id);
  if (!a) return;
  document.getElementById('editInputTitle').value  = a.title;
  document.getElementById('editInputCourse').value = a.course;
  document.getElementById('editInputDue').value    = a.dueDate;
  document.getElementById('editInputNotes').value  = a.notes || '';
  document.getElementById('calDayOverlay').classList.add('hidden');
  document.getElementById('calEditOverlay').classList.remove('hidden');
}

function closeEditModal(returnToDay) {
  document.getElementById('calEditOverlay').classList.add('hidden');
  editingId = null;
  if (returnToDay && selectedDayDate) {
    renderDayModal();
    document.getElementById('calDayOverlay').classList.remove('hidden');
  }
}

document.getElementById('calEditForm').addEventListener('submit', async e => {
  e.preventDefault();
  await updateAssignment(editingId, {
    title:   document.getElementById('editInputTitle').value.trim(),
    course:  document.getElementById('editInputCourse').value.trim(),
    dueDate: document.getElementById('editInputDue').value,
    notes:   document.getElementById('editInputNotes').value.trim(),
  });
  await renderCalendar(); // refreshes cache then redraws grid
  closeEditModal(true);
});

document.getElementById('cancelCalEdit').addEventListener('click',       () => closeEditModal(true));
document.getElementById('closeCalEditOverlay').addEventListener('click', () => closeEditModal(true));
document.getElementById('calEditOverlay').addEventListener('click', e => {
  if (e.target === document.getElementById('calEditOverlay')) closeEditModal(true);
});

// ── Day Modal close ───────────────────────────────────────────
document.getElementById('closeCalDayModal').addEventListener('click', closeDayModal);
document.getElementById('calDayOverlay').addEventListener('click', e => {
  if (e.target === document.getElementById('calDayOverlay')) closeDayModal();
});

// ── Month navigation ──────────────────────────────────────────
document.getElementById('prevMonth').addEventListener('click', () => {
  viewMonth--;
  if (viewMonth < 0) { viewMonth = 11; viewYear--; }
  renderCalendar();
});

document.getElementById('nextMonth').addEventListener('click', () => {
  viewMonth++;
  if (viewMonth > 11) { viewMonth = 0; viewYear++; }
  renderCalendar();
});

// ── Hamburger Menu ────────────────────────────────────────────
const hamburger = document.getElementById('hamburger');
const navLinks  = document.getElementById('navLinks');
hamburger.addEventListener('click', () => {
  hamburger.classList.toggle('open');
  navLinks.classList.toggle('open');
});
document.addEventListener('click', e => {
  if (!hamburger.contains(e.target) && !navLinks.contains(e.target)) {
    hamburger.classList.remove('open');
    navLinks.classList.remove('open');
  }
});
