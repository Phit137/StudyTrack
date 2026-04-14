import {
  onAuthChange, logout,
  getAssignments, addAssignment, updateAssignment, deleteAssignment, toggleComplete as firestoreToggle
} from "./script.js";

// ── Local cache ───────────────────────────────────────────────
// Keeps a copy of the last Firestore fetch so modal/sort/filter
// operations can look up assignments synchronously.
let cachedAssignments = [];

// ── Auth guard ────────────────────────────────────────────────
onAuthChange(user => {
  if (!user) {
    window.location.href = "index.html";
  } else {
    document.getElementById('navUser').textContent = user.email;
    render(); // first load from Firestore
  }
});

document.getElementById('logoutBtn').addEventListener('click', () => logout());

// ── Helpers ───────────────────────────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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

let currentFilter = 'all';
let sortCol = 'dueDate';
let sortDir = 'asc';
let editingId = null;

function applySortAndFilter(assignments) {
  let result = [...assignments];

  if (currentFilter === 'active')    result = result.filter(a => !a.completed);
  if (currentFilter === 'completed') result = result.filter(a =>  a.completed);

  if (sortCol === 'completed') {
    result.sort((a, b) => {
      const cmp = (a.completed ? 1 : 0) - (b.completed ? 1 : 0);
      if (cmp !== 0) return sortDir === 'asc' ? cmp : -cmp;
      return a.dueDate.localeCompare(b.dueDate);
    });
  } else {
    const incomplete = result.filter(a => !a.completed);
    const completed  = result.filter(a =>  a.completed);
    const cmp = (a, b) => {
      let c = 0;
      if (sortCol === 'course')  c = a.course.localeCompare(b.course);
      if (sortCol === 'dueDate') c = a.dueDate.localeCompare(b.dueDate);
      return sortDir === 'desc' ? -c : c;
    };
    result = [...incomplete.sort(cmp), ...completed.sort(cmp)];
  }

  return result;
}

function updateSortIcons() {
  const map = {
    course:    { icon: 'iconCourse',  hdr: 'hdrCourse'  },
    dueDate:   { icon: 'iconDueDate', hdr: 'hdrDueDate' },
    completed: { icon: 'iconStatus',  hdr: 'hdrStatus'  },
  };
  Object.entries(map).forEach(([col, { icon, hdr }]) => {
    const iconEl = document.getElementById(icon);
    const hdrEl  = document.getElementById(hdr);
    if (col === sortCol) {
      iconEl.textContent = sortDir === 'asc' ? '↑' : '↓';
      hdrEl.classList.add('sort-active');
    } else {
      iconEl.textContent = '↕';
      hdrEl.classList.remove('sort-active');
    }
  });
}

// ── Render (async — fetches from Firestore) ───────────────────
async function render() {
  // Fetch this user's assignments from Firestore and update the cache
  cachedAssignments = await getAssignments();

  const list   = document.getElementById('assignmentsList');
  const sorted = applySortAndFilter(cachedAssignments);

  if (sorted.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">&#128203;</div>
        <h3>No assignments here</h3>
        <p>Click <strong>+ Add Assignment</strong> to get started.</p>
      </div>`;
    updateSortIcons();
    return;
  }

  list.innerHTML = sorted.map(a => {
    const badge = getStatusBadge(a.dueDate, a.completed);
    return `
      <div class="assignment-row ${a.completed ? 'row-done' : ''}" data-id="${a.id}">
        <div class="row-title-area">
          <div class="row-title-stack">
            <span class="row-title">${a.title}</span>
            ${a.notes ? `<span class="row-notes">${a.notes}</span>` : ''}
          </div>
        </div>
        <div class="row-course">${a.course}</div>
        <div class="row-date">&#128197; ${formatDate(a.dueDate)}</div>
        <div class="row-status"><span class="uc-badge ${badge.cls}">${badge.label}</span></div>
        <div class="row-actions">
          <button class="btn-icon btn-complete ${a.completed ? 'completed' : ''}" data-id="${a.id}" title="${a.completed ? 'Mark incomplete' : 'Mark complete'}">&#10003;</button>
          <button class="btn-icon btn-edit"   data-id="${a.id}" title="Edit">&#9998;</button>
          <button class="btn-icon btn-delete" data-id="${a.id}" title="Delete">&#128465;</button>
        </div>
      </div>`;
  }).join('');

  list.querySelectorAll('.btn-complete').forEach(btn =>
    btn.addEventListener('click', () => {
      const a = cachedAssignments.find(x => x.id === btn.dataset.id);
      if (a) handleToggle(a.id, a.completed);
    }));
  list.querySelectorAll('.btn-edit').forEach(btn =>
    btn.addEventListener('click', () => openEdit(btn.dataset.id)));
  list.querySelectorAll('.btn-delete').forEach(btn =>
    btn.addEventListener('click', () => handleDelete(btn.dataset.id)));

  if (window.matchMedia('(max-width: 768px)').matches) {
    list.querySelectorAll('.assignment-row').forEach(row =>
      row.addEventListener('click', () => openMobileModal(row.dataset.id)));
  }

  updateSortIcons();
}

// ── Mutations (async — write to Firestore, then re-render) ────
async function handleToggle(id, currentCompleted) {
  await firestoreToggle(id, currentCompleted);
  await render();
  if (mobileViewId === id) refreshMobileModal();
}

async function handleDelete(id) {
  if (!confirm('Delete this assignment?')) return;
  await deleteAssignment(id);
  if (mobileViewId === id) closeMobileModal();
  await render();
}

// ── Inline Form ───────────────────────────────────────────────
function openForm(assignment = null) {
  editingId = assignment ? assignment.id : null;
  document.getElementById('formTitle').textContent = assignment ? 'Edit Assignment' : 'Add Assignment';
  document.getElementById('submitBtn').textContent = assignment ? 'Save Changes'    : 'Add Assignment';
  document.getElementById('inputTitle').value  = assignment ? assignment.title         : '';
  document.getElementById('inputCourse').value = assignment ? assignment.course        : '';
  document.getElementById('inputDue').value    = assignment ? assignment.dueDate       : '';
  document.getElementById('inputNotes').value  = assignment ? (assignment.notes || '') : '';
  document.getElementById('inlineFormWrap').classList.remove('hidden');
  document.getElementById('inputTitle').focus();
}

function closeForm() {
  document.getElementById('inlineFormWrap').classList.add('hidden');
  document.getElementById('assignmentForm').reset();
  editingId = null;
}

function openEdit(id) {
  const a = cachedAssignments.find(x => x.id === id);
  if (a) openForm(a);
}

document.getElementById('toggleFormBtn').addEventListener('click', () => openForm());
document.getElementById('closeForm').addEventListener('click', closeForm);
document.getElementById('cancelForm').addEventListener('click', closeForm);

document.getElementById('assignmentForm').addEventListener('submit', async e => {
  e.preventDefault();
  const title   = document.getElementById('inputTitle').value.trim();
  const course  = document.getElementById('inputCourse').value.trim();
  const dueDate = document.getElementById('inputDue').value;
  const notes   = document.getElementById('inputNotes').value.trim();

  if (editingId) {
    await updateAssignment(editingId, { title, course, dueDate, notes });
  } else {
    await addAssignment({ title, course, dueDate, notes, completed: false });
  }

  closeForm();
  await render();
});

// ── Filter Tabs ───────────────────────────────────────────────
document.querySelectorAll('.filter-tab').forEach(tab =>
  tab.addEventListener('click', () => {
    document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentFilter = tab.dataset.filter;
    render(); // re-sort/filter from cache — no new Firestore fetch needed
  }));

// ── Column Sort ───────────────────────────────────────────────
document.querySelectorAll('.col-header.sortable').forEach(hdr =>
  hdr.addEventListener('click', () => {
    const col = hdr.dataset.col;
    sortCol = col === sortCol ? sortCol : col;
    sortDir = col === sortCol && sortDir === 'asc' ? 'desc' : 'asc';
    if (col !== sortCol) sortDir = 'asc';
    sortCol = col;
    render(); // re-sort from cache — no new Firestore fetch needed
  }));

// ── Mobile Assignment Modal ───────────────────────────────────
let mobileViewId = null;

function openMobileModal(id) {
  mobileViewId = id;
  refreshMobileModal();
  document.getElementById('mobileAssignOverlay').classList.remove('hidden');
}

function closeMobileModal() {
  document.getElementById('mobileAssignOverlay').classList.add('hidden');
  mobileViewId = null;
}

function refreshMobileModal() {
  // Reads from cache — synchronous
  const a = cachedAssignments.find(x => x.id === mobileViewId);
  if (!a) return;
  const badge = getStatusBadge(a.dueDate, a.completed);

  document.getElementById('mobileAssignTitle').textContent   = a.title;
  document.getElementById('mobileAssignCourse').textContent  = a.course;
  document.getElementById('mobileAssignDate').innerHTML      = '&#128197; ' + formatDate(a.dueDate);

  const notesEl = document.getElementById('mobileAssignNotes');
  if (a.notes) { notesEl.textContent = a.notes; notesEl.style.display = ''; }
  else         { notesEl.style.display = 'none'; }

  const badgeEl = document.getElementById('mobileAssignBadge');
  badgeEl.innerHTML = badge.label;
  badgeEl.className = 'uc-badge ' + badge.cls;

  const completeBtn = document.getElementById('mobileCompleteBtn');
  if (a.completed) completeBtn.classList.add('completed');
  else             completeBtn.classList.remove('completed');
}

document.getElementById('closeMobileAssign').addEventListener('click', closeMobileModal);
document.getElementById('mobileAssignOverlay').addEventListener('click', e => {
  if (e.target === document.getElementById('mobileAssignOverlay')) closeMobileModal();
});

document.getElementById('mobileCompleteBtn').addEventListener('click', async () => {
  const a = cachedAssignments.find(x => x.id === mobileViewId);
  if (!a) return;
  await firestoreToggle(a.id, a.completed);
  await render();
  refreshMobileModal();
});

document.getElementById('mobileEditBtn').addEventListener('click', () => {
  const id = mobileViewId;
  closeMobileModal();
  openEdit(id);
});

document.getElementById('mobileDeleteBtn').addEventListener('click', async () => {
  if (!confirm('Delete this assignment?')) return;
  const id = mobileViewId;
  closeMobileModal();
  await deleteAssignment(id);
  await render();
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
