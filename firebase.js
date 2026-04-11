// ══════════════════════════════════════════════
//  ChatCity — Firebase Config & Shared Utils
// ══════════════════════════════════════════════

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
const ADMIN_PASS = '9999';
const ADMIN_UID = 'admin_system_001';
const ADMIN_WA = '8801966061084';

// ── Color palette ──
const COLORS = ['#7c6eff','#ff6b9d','#2dd4a0','#f7c94b','#60a5fa','#fb923c','#c084fc','#34d399'];
const colorFor  = uid => { let h=0; for(const c of uid) h=(h*31+c.charCodeAt(0))%COLORS.length; return COLORS[h]; };
const initialsOf = name => {
  if(!name) return '?';
  const p = name.trim().split(/\s+/);
  return p.length >= 2 ? (p[0][0]+p[p.length-1][0]).toUpperCase() : name[0].toUpperCase();
};

// ── Chat ID ──
const chatId = (a, b) => [a,b].sort().join('__');

// ─��� Time format ──
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

// ── Report error ──
const reportError = async (err, context='') => {
  try {
    await push(ref(db,'admin/errors'), {
      error: String(err),
      context,
      ts: Date.now(),
      ua: navigator.userAgent
    });
    console.warn('[ChatCity Error]', err, context);
  } catch {}
};

window.onerror = (msg, src, line) => reportError(`${msg} @ ${src}:${line}`, 'window.onerror');
window.onunhandledrejection = e => reportError(e.reason, 'unhandledRejection');

// ── Session ──
const SESSION_KEY = 'cc_session';
const saveSession = (uid, passcode) => {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ uid, passcode, ts: Date.now() }));
};
const getSession = () => {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch { return null; }
};
const clearSession = () => localStorage.removeItem(SESSION_KEY);

// ── Router ──
const go = (page, data={}) => {
  sessionStorage.setItem('cc_route', JSON.stringify({ page, data }));
  window.location.href = page;
};
const getRoute = () => {
  try { return JSON.parse(sessionStorage.getItem('cc_route')); } catch { return null; }
};

// ── Online status ──
const setOnline = async uid => {
  const r = ref(db, `users/${uid}/online`);
  await set(r, true);
  onDisconnect(r).set(false);
  onDisconnect(ref(db, `users/${uid}/lastSeen`)).set(Date.now());
};

// ── SEARCH INDEXING ──
const createUserSearchIndex = async (uid, user) => {
  try {
    const nameIndex = (user.name || '').toLowerCase().trim();
    const emailIndex = (user.email || '').toLowerCase().trim();
    const nameTokens = nameIndex.split(/\s+/).filter(t => t.length > 0);
    const emailTokens = emailIndex.split('@')[0].split(/[\._\-]+/).filter(t => t.length > 0);
    const allTokens = [...new Set([...nameTokens, ...emailTokens, nameIndex, emailIndex])];
    
    await set(ref(db, `search/users/${uid}`), {
      uid,
      name: user.name || '',
      email: user.email || '',
      nameIndex,
      emailIndex,
      tokens: allTokens,
      color: user.color,
      initials: user.initials,
      photo: user.photo,
      createdAt: Date.now()
    });
  } catch(e) {
    console.error('Search index error:', e);
  }
};

const searchUsers = async (query, excludeUid = null) => {
  try {
    if(!query || query.length < 1) return [];
    const q = query.toLowerCase().trim();
    const snap = await get(ref(db, 'search/users'));
    const users = snap.val() || {};
    
    const results = Object.values(users)
      .filter(u => {
        if(excludeUid && u.uid === excludeUid) return false;
        const matchName = u.nameIndex.includes(q) || u.tokens.some(t => t.includes(q));
        const matchEmail = u.emailIndex.includes(q);
        return matchName || matchEmail;
      })
      .sort((a, b) => {
        if(a.nameIndex === q && b.nameIndex !== q) return -1;
        if(a.nameIndex !== q && b.nameIndex === q) return 1;
        return a.name.length - b.name.length;
      })
      .slice(0, 50);
    
    return results;
  } catch(e) {
    console.error('Search error:', e);
    return [];
  }
};

const getAllUsers = async (useCache = true) => {
  try {
    const cacheKey = 'users_cache';
    const cached = localStorage.getItem(cacheKey);
    const cacheTime = localStorage.getItem(cacheKey + '_time');
    const now = Date.now();
    
    if(useCache && cached && cacheTime && (now - parseInt(cacheTime)) < 300000) {
      return JSON.parse(cached);
    }
    
    const snap = await get(ref(db, 'users'));
    const users = Object.entries(snap.val() || {})
      .map(([uid, user]) => ({ uid, ...user }))
      .sort((a, b) => a.name?.localeCompare(b.name || ''));
    
    localStorage.setItem(cacheKey, JSON.stringify(users));
    localStorage.setItem(cacheKey + '_time', now.toString());
    
    return users;
  } catch(e) {
    console.error('Error fetching users:', e);
    return [];
  }
};

const deleteUserSearchIndex = async (uid) => {
  try {
    await remove(ref(db, `search/users/${uid}`));
  } catch(e) {
    console.error('Error deleting search index:', e);
  }
};

const updateUserSearchIndex = async (uid, user) => {
  try {
    await deleteUserSearchIndex(uid);
    await createUserSearchIndex(uid, user);
  } catch(e) {
    console.error('Error updating search index:', e);
  }
};

// ── OFFLINE MESSAGE QUEUE ──
const QUEUE_KEY = 'cc_msg_queue';

const addToOfflineQueue = (chatId, msg) => {
  try {
    const queue = JSON.parse(localStorage.getItem(QUEUE_KEY)) || {};
    if(!queue[chatId]) queue[chatId] = [];
    queue[chatId].push(msg);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch(e) {
    console.error('Queue error:', e);
  }
};

const getOfflineQueue = (chatId) => {
  try {
    const queue = JSON.parse(localStorage.getItem(QUEUE_KEY)) || {};
    return queue[chatId] || [];
  } catch {
    return [];
  }
};

const sendOfflineQueue = async (chatId, uid) => {
  try {
    const queue = getOfflineQueue(chatId);
    if(!queue.length) return;

    for(const msg of queue) {
      const r = push(ref(db, `chats/${chatId}/messages`));
      await set(r, {
        id: r.key,
        senderId: uid,
        ts: msg.ts || Date.now(),
        text: msg.text,
        type: msg.type || 'text',
        seen: false,
        queued: true
      });
    }

    const allQueue = JSON.parse(localStorage.getItem(QUEUE_KEY)) || {};
    delete allQueue[chatId];
    localStorage.setItem(QUEUE_KEY, JSON.stringify(allQueue));
  } catch(e) {
    console.error('Error sending offline queue:', e);
  }
};

const clearOfflineQueue = (chatId) => {
  try {
    const queue = JSON.parse(localStorage.getItem(QUEUE_KEY)) || {};
    delete queue[chatId];
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {}
};

// ── ONLINE DETECTION ──
let isOnline = navigator.onLine;

window.addEventListener('online', () => {
  isOnline = true;
  window.dispatchEvent(new CustomEvent('appOnline'));
});

window.addEventListener('offline', () => {
  isOnline = false;
  toast('You are offline', 'ok');
});

const isAppOnline = () => isOnline;

const sendMessageOfflineAware = async (chatId, uid, payload) => {
  if(!isOnline) {
    addToOfflineQueue(chatId, payload);
    return { offline: true, queued: true };
  } else {
    const r = push(ref(db, `chats/${chatId}/messages`));
    await set(r, { 
      id: r.key, 
      senderId: uid, 
      ts: Date.now(), 
      seen: false, 
      ...payload 
    });
    return { offline: false, sent: true };
  }
};

// ── Export ──
export {
  app, auth, db, gProvider,
  ADMIN_EMAIL, ADMIN_PASS, ADMIN_UID, ADMIN_WA,
  COLORS, colorFor, initialsOf, chatId, fmtTime, fmtDate, escHtml,
  toast, reportError,
  saveSession, getSession, clearSession,
  go, getRoute, setOnline,
  createUserSearchIndex, searchUsers, getAllUsers, deleteUserSearchIndex, updateUserSearchIndex,
  addToOfflineQueue, getOfflineQueue, sendOfflineQueue, clearOfflineQueue,
  isAppOnline, sendMessageOfflineAware,
  ref, set, get, push, onValue, off, remove, serverTimestamp, onDisconnect,
  query, orderByChild, equalTo,
  signOut, onAuthStateChanged, updateProfile, updatePassword,
  EmailAuthProvider, reauthenticateWithCredential,
  GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword,
  createUserWithEmailAndPassword
};
