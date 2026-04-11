// ══════════════════════════════════════════════
//  ChatCity — Firebase Config & Shared Utils
// ══════════════════════════════════════════════

// ── Firebase SDK (loaded as module) ──
import { initializeApp }          from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword,
         createUserWithEmailAndPassword, signOut, onAuthStateChanged,
         updateProfile, updatePassword, EmailAuthProvider, reauthenticateWithCredential }
                                   from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js';
import { getDatabase, ref, set, get, push, onValue, off, remove,
         serverTimestamp, onDisconnect, query, orderByChild, equalTo }
                                   from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-database.js';

// ── Config ──
const FB_CONFIG = {
  apiKey:            "AIzaSyCxTZfdSIQKoQWP-UPQj6L7ZObATsL7314",
  authDomain:        "aviator-crash-dbf1b.firebaseapp.com",
  databaseURL:       "https://aviator-crash-dbf1b-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId:         "aviator-crash-dbf1b",
  storageBucket:     "aviator-crash-dbf1b.firebasestorage.app",
  messagingSenderId: "1016424043766",
  appId:             "1:1016424043766:web:2e90bfaacbd515a44208d7"
};

const app  = initializeApp(FB_CONFIG);
const auth = getAuth(app);
const db   = getDatabase(app);
const gProvider = new GoogleAuthProvider();

// ── Admin config ──
const ADMIN_EMAIL = 'admin@chatcity.com';
const ADMIN_WA    = '8801966061084'; // WhatsApp number

// ── Color palette ──
const COLORS = ['#7c6eff','#ff6b9d','#2dd4a0','#f7c94b','#60a5fa','#fb923c','#c084fc','#34d399'];
const colorFor  = uid => { let h=0; for(const c of uid) h=(h*31+c.charCodeAt(0))%COLORS.length; return COLORS[h]; };
const initialsOf = name => {
  if(!name) return '?';
  const p = name.trim().split(/\s+/);
  return p.length >= 2 ? (p[0][0]+p[p.length-1][0]).toUpperCase() : name[0].toUpperCase();
};

// ── Chat ID (deterministic for 2 users) ──
const chatId = (a, b) => [a,b].sort().join('__');

// ── Time format ──
const fmtTime = ts => {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
};
const fmtDate = ts => {
  const d = new Date(ts), now = new Date();
  if(d.toDateString()===now.toDateString()) return 'Today';
  const yesterday = new Date(now); yesterday.setDate(now.getDate()-1);
  if(d.toDateString()===yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-GB',{day:'numeric',month:'short'});
};

// ── Escape HTML ──
const escHtml = s => s?.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>') ?? '';

// ── Toast ──
let toastTimer;
const toast = (msg, type='') => {
  const el = document.getElementById('toast');
  if(!el) return;
  el.textContent = type==='error' ? '⚠ '+msg : type==='ok' ? '✓ '+msg : msg;
  el.style.background = type==='error' ? '#ff5370' : type==='ok' ? '#2dd4a0' : '';
  el.style.color = '#fff';
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>el.classList.remove('show'), 3000);
};

// ── Report error to admin ──
const reportError = async (err, context='') => {
  try {
    await push(ref(db,'admin/errors'), {
      error:   String(err),
      context,
      ts:      Date.now(),
      ua:      navigator.userAgent
    });
    // WhatsApp link (fallback)
    console.warn('[ChatCity Error]', err, context);
  } catch {}
};

// ── Global error handler ──
window.onerror = (msg, src, line) => reportError(`${msg} @ ${src}:${line}`, 'window.onerror');
window.onunhandledrejection = e => reportError(e.reason, 'unhandledRejection');

// ── Session / passcode ──
const SESSION_KEY = 'cc_session';
const saveSession = (uid, passcode) => {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ uid, passcode, ts: Date.now() }));
};
const getSession = () => {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch { return null; }
};
const clearSession = () => localStorage.removeItem(SESSION_KEY);

// ── Page router ──
const go = (page, data={}) => {
  sessionStorage.setItem('cc_route', JSON.stringify({ page, data }));
  window.location.href = page;
};
const getRoute = () => {
  try { return JSON.parse(sessionStorage.getItem('cc_route')); } catch { return null; }
};

// ── Set user online ──
const setOnline = async uid => {
  const r = ref(db, `users/${uid}/online`);
  await set(r, true);
  onDisconnect(r).set(false);
  onDisconnect(ref(db, `users/${uid}/lastSeen`)).set(Date.now());
};

// ── Export everything ──
export {
  app, auth, db, gProvider,
  ADMIN_EMAIL, ADMIN_WA,
  COLORS, colorFor, initialsOf, chatId, fmtTime, fmtDate, escHtml,
  toast, reportError,
  saveSession, getSession, clearSession,
  go, getRoute, setOnline,
  // Firebase functions re-exported
  ref, set, get, push, onValue, off, remove, serverTimestamp, onDisconnect,
  query, orderByChild, equalTo,
  signOut, onAuthStateChanged, updateProfile, updatePassword,
  EmailAuthProvider, reauthenticateWithCredential,
  GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword,
  createUserWithEmailAndPassword
};
