// ─────────────────────────────────────────────────────────────
//  StudyTrack — Firebase Module (script.js)
//  Import this file with <script type="module" src="script.js">
//  in any page that needs Firebase Auth or Firestore.
// ─────────────────────────────────────────────────────────────

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── Firebase Config ──────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyAfIGyB2W-oUS_oC2l3BgMHYkZibBCJerY",
  authDomain: "studytrack-3bd7b.firebaseapp.com",
  projectId: "studytrack-3bd7b",
  storageBucket: "studytrack-3bd7b.firebasestorage.app",
  messagingSenderId: "27166578653",
  appId: "1:27166578653:web:e7e29ddab48a0ba87e0834"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);


// ════════════════════════════════════════════════════════════
//  AUTH HELPERS
// ════════════════════════════════════════════════════════════

/**
 * Register a new user with email + password.
 * Returns a Promise<UserCredential>.
 *
 * Usage:
 *   register("student@example.com", "password123")
 *     .then(cred => console.log("Signed up:", cred.user.uid))
 *     .catch(err => console.error(err.message));
 */
export function register(email, password) {
  return createUserWithEmailAndPassword(auth, email, password);
}

/**
 * Sign in an existing user.
 * Returns a Promise<UserCredential>.
 *
 * Usage:
 *   login("student@example.com", "password123")
 *     .then(cred => console.log("Logged in:", cred.user.uid))
 *     .catch(err => console.error(err.message));
 */
export function login(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

/**
 * Sign the current user out.
 * Returns a Promise<void>.
 */
export function logout() {
  return signOut(auth);
}

/**
 * Watch for auth state changes (login / logout).
 * Fires immediately with the current user (null if not logged in).
 * Returns an unsubscribe function.
 *
 * Usage:
 *   onAuthChange(user => {
 *     if (user) { console.log("Logged in as", user.email); }
 *     else      { window.location.href = "login.html"; }
 *   });
 */
export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

/**
 * Get the currently signed-in user, or null.
 */
export function currentUser() {
  return auth.currentUser;
}


// ════════════════════════════════════════════════════════════
//  ASSIGNMENT HELPERS
//
//  Assignments are stored per-user in Firestore:
//    users/{uid}/assignments/{assignmentId}
//
//  Document fields: { title, course, dueDate, notes, completed }
// ════════════════════════════════════════════════════════════

/** Returns the assignments sub-collection for the current user. */
function assignmentsCol() {
  const user = auth.currentUser;
  if (!user) throw new Error("Not signed in.");
  return collection(db, "users", user.uid, "assignments");
}

/**
 * Load all assignments for the current user from Firestore.
 * Returns a Promise<Assignment[]>, sorted by dueDate ascending.
 *
 * Usage:
 *   const assignments = await getAssignments();
 */
export async function getAssignments() {
  const q        = query(assignmentsCol(), orderBy("dueDate", "asc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Add a new assignment for the current user.
 * Firestore auto-generates the document ID.
 * Returns a Promise<Assignment> with the generated id included.
 *
 * Usage:
 *   const saved = await addAssignment({
 *     title: "Lab Report",
 *     course: "CS101",
 *     dueDate: "2026-04-20",
 *     notes: "",
 *     completed: false
 *   });
 *   console.log("Created with id:", saved.id);
 */
export async function addAssignment({ title, course, dueDate, notes = "", completed = false }) {
  const docRef = await addDoc(assignmentsCol(), { title, course, dueDate, notes, completed });
  return { id: docRef.id, title, course, dueDate, notes, completed };
}

/**
 * Update specific fields on an existing assignment.
 * Returns a Promise<void>.
 *
 * Usage:
 *   await updateAssignment("abc123", { completed: true });
 *   await updateAssignment("abc123", { title: "New Title", dueDate: "2026-05-01" });
 */
export function updateAssignment(id, changes) {
  const ref = doc(db, "users", auth.currentUser.uid, "assignments", id);
  return updateDoc(ref, changes);
}

/**
 * Delete an assignment by id.
 * Returns a Promise<void>.
 *
 * Usage:
 *   await deleteAssignment("abc123");
 */
export function deleteAssignment(id) {
  const ref = doc(db, "users", auth.currentUser.uid, "assignments", id);
  return deleteDoc(ref);
}

/**
 * Toggle the completed status of an assignment.
 * Returns a Promise<void>.
 *
 * Usage:
 *   await toggleComplete("abc123", false); // was incomplete → marks complete
 */
export function toggleComplete(id, currentCompleted) {
  return updateAssignment(id, { completed: !currentCompleted });
}


// ════════════════════════════════════════════════════════════
//  USER PROFILE HELPERS  (optional — store display name, etc.)
// ════════════════════════════════════════════════════════════

/**
 * Save or merge extra profile data for the current user.
 * Stored at: users/{uid}
 *
 * Usage:
 *   await saveProfile({ displayName: "Alex" });
 */
export function saveProfile(data) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not signed in.");
  return setDoc(doc(db, "users", user.uid), data, { merge: true });
}

/**
 * Load profile data for the current user.
 * Returns a Promise<object|null>.
 */
export async function getProfile() {
  const user = auth.currentUser;
  if (!user) throw new Error("Not signed in.");
  const snap = await getDoc(doc(db, "users", user.uid));
  return snap.exists() ? snap.data() : null;
}


