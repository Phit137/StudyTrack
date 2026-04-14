import {
  onAuthChange, login, register, logout,
  getAssignments, updateAssignment, deleteAssignment, toggleComplete as firestoreToggle
} from "./script.js";

// ── Auth UI toggle ────────────────────────────────────────────
const authSection = document.getElementById('authSection');
const dashSection = document.getElementById('dashSection');
const navLinks    = document.getElementById('navLinks');
const hamburger   = document.getElementById('hamburger');
const logoutBtn   = document.getElementById('logoutBtn');
const navUser     = document.getElementById('navUser');

function showAuth() {
  authSection.classList.remove('hidden');
  dashSection.classList.add('hidden');
  navLinks.classList.add('hidden');
  hamburger.classList.add('hidden');
  logoutBtn.classList.add('hidden');
  navUser.classList.add('hidden');
}

async function showDashboard(user) {
  authSection.classList.add('hidden');
  dashSection.classList.remove('hidden');
  navLinks.classList.remove('hidden');
  hamburger.classList.remove('hidden');
  logoutBtn.classList.remove('hidden');
  navUser.classList.remove('hidden');
  navUser.textContent = user.email;
  // Fetch from Firestore (requires confirmed auth) then render
  await loadDashboard();
}

onAuthChange(user => {
  if (user) {
    showDashboard(user);
  } else {
    showAuth();
  }
});

// ── Logout ────────────────────────────────────────────────────
logoutBtn.addEventListener('click', () => logout());

// ── Auth forms ────────────────────────────────────────────────
const authError  = document.getElementById('authError');
const signInForm = document.getElementById('signInForm');
const signUpForm = document.getElementById('signUpForm');
const tabSignIn  = document.getElementById('tabSignIn');
const tabSignUp  = document.getElementById('tabSignUp');

function showError(msg) {
  authError.textContent = msg;
  authError.classList.remove('hidden');
}

function clearError() {
  authError.textContent = '';
  authError.classList.add('hidden');
}

// Tab switching
tabSignIn.addEventListener('click', () => {
  tabSignIn.classList.add('active');
  tabSignUp.classList.remove('active');
  signInForm.classList.remove('hidden');
  signUpForm.classList.add('hidden');
  clearError();
});

tabSignUp.addEventListener('click', () => {
  tabSignUp.classList.add('active');
  tabSignIn.classList.remove('active');
  signUpForm.classList.remove('hidden');
  signInForm.classList.add('hidden');
  clearError();
});

// Sign In
signInForm.addEventListener('submit', async e => {
  e.preventDefault();
  clearError();
  const email    = document.getElementById('signInEmail').value.trim();
  const password = document.getElementById('signInPassword').value;
  const btn      = document.getElementById('signInBtn');
  btn.textContent = 'Signing in…';
  btn.disabled    = true;
  try {
    await login(email, password);
    // onAuthChange fires automatically — no redirect needed
  } catch (err) {
    showError(friendlyError(err.code));
    btn.textContent = 'Sign In';
    btn.disabled    = false;
  }
});

// Sign Up
signUpForm.addEventListener('submit', async e => {
  e.preventDefault();
  clearError();
  const email    = document.getElementById('signUpEmail').value.trim();
  const password = document.getElementById('signUpPassword').value;
  const confirm  = document.getElementById('signUpConfirm').value;
  if (password !== confirm) { showError('Passwords do not match.'); return; }
  if (password.length < 6)  { showError('Password must be at least 6 characters.'); return; }
  const btn = document.getElementById('signUpBtn');
  btn.textContent = 'Creating account…';
  btn.disabled    = true;
  try {
    await register(email, password);
    // onAuthChange fires automatically
  } catch (err) {
    showError(friendlyError(err.code));
    btn.textContent = 'Create Account';
    btn.disabled    = false;
  }
});

// Turn Firebase error codes into readable messages
function friendlyError(code) {
  switch (code) {
    case 'auth/invalid-email':           return 'Please enter a valid email address.';
    case 'auth/user-not-found':          return 'No account found with that email.';
    case 'auth/wrong-password':          return 'Incorrect password. Please try again.';
    case 'auth/invalid-credential':      return 'Email or password is incorrect.';
    case 'auth/email-already-in-use':    return 'An account with this email already exists.';
    case 'auth/weak-password':           return 'Password must be at least 6 characters.';
    case 'auth/too-many-requests':       return 'Too many attempts. Please try again later.';
    default:                             return 'Something went wrong. Please try again.';
  }
}

// ════════════════════════════════════════════════════════════
//  DASHBOARD LOGIC
// ════════════════════════════════════════════════════════════
let cachedAssignments = [];
let dashEditingId = null;

// Fetch from Firestore and re-render both dashboard sections
async function loadDashboard() {
  cachedAssignments = await getAssignments();
  renderUpcoming();
  renderCourseTable();
}

function getCardStyle(dueDate, completed) {
  if (completed) return { card: 'done-card', badge: 'done-badge', label: '&#10003; Complete' };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [y, m, d] = dueDate.split('-').map(Number);
  const diff = Math.ceil((new Date(y, m - 1, d) - today) / 86400000);
  if (diff < 0)   return { card: 'overdue', badge: 'overdue-badge', label: 'Overdue'      };
  if (diff === 0) return { card: 'urgent',  badge: 'urgent-badge',  label: 'Due Today'    };
  if (diff === 1) return { card: 'urgent',  badge: 'urgent-badge',  label: 'Due Tomorrow' };
  if (diff <= 7)  return { card: 'soon',    badge: 'soon-badge',    label: 'This Week'    };
  return               { card: 'ok',      badge: 'ok-badge',      label: 'Upcoming'     };
}

function formatShortDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatLongDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function renderUpcoming() {
  const grid = document.getElementById('upcomingGrid');
  const assignments = cachedAssignments;

  if (assignments.length === 0) {
    grid.innerHTML = `
      <div class="upcoming-empty">
        <p>No assignments yet. <a href="assignments.html">Add some to get started.</a></p>
      </div>`;
    return;
  }

  const top4 = [...assignments]
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 4);

  grid.innerHTML = top4.map(a => {
    const { card, badge, label } = getCardStyle(a.dueDate, a.completed);
    const dateDisplay = a.completed ? 'Turned in' : '&#128197; ' + formatShortDate(a.dueDate);
    return `
      <div class="upcoming-card ${card}">
        <div class="upcoming-card-top">
          <span class="uc-course">${a.course}</span>
          <span class="uc-badge ${badge}">${label}</span>
        </div>
        <div class="uc-title">${a.title}</div>
        <div class="uc-date">${dateDisplay}</div>
      </div>`;
  }).join('');
}

function renderCourseTable() {
  const container = document.getElementById('courseTable');
  const assignments = cachedAssignments;

  if (assignments.length === 0) {
    container.innerHTML = `
      <div class="ct-empty">
        <p>No assignments yet. <a href="assignments.html">Add some to get started.</a></p>
      </div>`;
    return;
  }

  const groups = {};
  assignments.forEach(a => {
    if (!groups[a.course]) groups[a.course] = [];
    groups[a.course].push(a);
  });

  Object.values(groups).forEach(list =>
    list.sort((a, b) => a.dueDate.localeCompare(b.dueDate)));

  container.innerHTML = Object.keys(groups).sort().map(course => {
    const items = groups[course];
    const rows = items.map(a => {
      const { badge, label } = getCardStyle(a.dueDate, a.completed);
      const isOverdue = label === 'Overdue';
      return `
        <button class="ct-assignment ${a.completed ? 'ct-done' : ''}" data-id="${a.id}">
          <span class="ct-title ${isOverdue ? 'ct-overdue-text' : ''}">${a.title}</span>
          <span class="ct-date">&#128197; ${formatShortDate(a.dueDate)}</span>
          <span class="uc-badge ${badge}">${label}</span>
        </button>`;
    }).join('');

    return `
      <div class="ct-row">
        <div class="ct-course-name">
          <span>${course}</span>
          <span class="ct-count">${items.length} assignment${items.length !== 1 ? 's' : ''}</span>
        </div>
        <div class="ct-assignments">${rows}</div>
      </div>`;
  }).join('');

  container.querySelectorAll('.ct-assignment').forEach(btn =>
    btn.addEventListener('click', () => openDashModal(btn.dataset.id)));
}

// ── Dashboard Modal ──────────────────────────────────────────
function openDashModal(id) {
  dashEditingId = id;
  refreshDashView();
  document.getElementById('dashViewMode').classList.remove('hidden');
  document.getElementById('dashEditMode').classList.add('hidden');
  document.getElementById('dashModalOverlay').classList.remove('hidden');
}

function closeDashModal() {
  document.getElementById('dashModalOverlay').classList.add('hidden');
  dashEditingId = null;
}

function refreshDashView() {
  const a = cachedAssignments.find(x => x.id === dashEditingId);
  if (!a) return;
  const { badge, label } = getCardStyle(a.dueDate, a.completed);

  document.getElementById('dashModalTitle').textContent = a.title;
  document.getElementById('dashModalCourse').textContent = a.course;
  document.getElementById('dashModalDate').innerHTML = '&#128197; ' + formatLongDate(a.dueDate);

  const notesEl = document.getElementById('dashModalNotes');
  if (a.notes) { notesEl.textContent = a.notes; notesEl.style.display = ''; }
  else         { notesEl.style.display = 'none'; }

  const badgeEl = document.getElementById('dashModalBadge');
  badgeEl.innerHTML  = label;
  badgeEl.className  = 'uc-badge ' + badge;

  const completeBtn = document.getElementById('dashCompleteBtn');
  if (a.completed) completeBtn.classList.add('completed');
  else             completeBtn.classList.remove('completed');
}

document.getElementById('dashCompleteBtn').addEventListener('click', async () => {
  const a = cachedAssignments.find(x => x.id === dashEditingId);
  if (!a) return;
  await firestoreToggle(a.id, a.completed);
  await loadDashboard();
  refreshDashView();
});

document.getElementById('dashDeleteBtn').addEventListener('click', async () => {
  if (!confirm('Delete this assignment?')) return;
  await deleteAssignment(dashEditingId);
  closeDashModal();
  await loadDashboard();
});

document.getElementById('dashEditBtn').addEventListener('click', () => {
  const a = cachedAssignments.find(x => x.id === dashEditingId);
  if (!a) return;
  document.getElementById('dashInputTitle').value  = a.title;
  document.getElementById('dashInputCourse').value = a.course;
  document.getElementById('dashInputDue').value    = a.dueDate;
  document.getElementById('dashInputNotes').value  = a.notes || '';
  document.getElementById('dashViewMode').classList.add('hidden');
  document.getElementById('dashEditMode').classList.remove('hidden');
});

document.getElementById('dashEditForm').addEventListener('submit', async e => {
  e.preventDefault();
  await updateAssignment(dashEditingId, {
    title:   document.getElementById('dashInputTitle').value.trim(),
    course:  document.getElementById('dashInputCourse').value.trim(),
    dueDate: document.getElementById('dashInputDue').value,
    notes:   document.getElementById('dashInputNotes').value.trim(),
  });
  await loadDashboard();
  document.getElementById('dashEditMode').classList.add('hidden');
  document.getElementById('dashViewMode').classList.remove('hidden');
  refreshDashView();
});

document.getElementById('cancelDashEdit').addEventListener('click', () => {
  document.getElementById('dashEditMode').classList.add('hidden');
  document.getElementById('dashViewMode').classList.remove('hidden');
});

document.getElementById('closeDashModal').addEventListener('click', closeDashModal);
document.getElementById('closeDashEdit').addEventListener('click', closeDashModal);
document.getElementById('dashModalOverlay').addEventListener('click', e => {
  if (e.target === document.getElementById('dashModalOverlay')) closeDashModal();
});

// ── Hamburger Menu ───────────────────────────────────────────
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
