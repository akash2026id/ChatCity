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

// ══ CONFIG ══
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

// ═��� CONSTANTS ══
const ADMIN_EMAIL = 'admin@chatcity.com';
const ADMIN_PASS = '9999';
const ADMIN_UID = 'admin_system_001';
const ADMIN_WA = '8801966061084';

// ══ COLOR PALETTE ══
const COLORS = ['#7c6eff','#ff6b9d','#2dd4a0','#f7c94b','#60a5fa','#fb923c','#c084fc','#34d399'];

const colorFor = uid => { 
  let h=0; 
  for(const c of uid) h=(h*31+c.charCodeAt(0))%COLORS.length; 
  return COLORS[h]; 
};

const initialsOf = name => {
  if(!name) return '?';
  const p = name.trim().split(/\s+/);
  return p.length >= 2 ? (p[0][0]+p[p.length-1][0]).toUpperCase() : name[0].toUpperCase();
};

// ══ CHAT ID ══
const chatId = (a, b) => [a,b].sort().join('__');

// ══ TIME FORMAT ══
const fmtTime = ts => {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
};

const fmtDate = ts => {
  const d = new Date(ts), now = new Date();
  if(d.toDateString()===now.toDateString()) return 'Today';
  const yesterday = new Date(now); 
  yesterday.setDate(now.getDate()-1);
  if(d.toDateString()===yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-GB',{day:'numeric',month:'short'});
};

// ══ ESCAPE HTML ══
const escHtml = s => s?.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>') ?? '';

// ══ TOAST ══
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

// ══ REPORT ERROR ══
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

// ══ SESSION ══
const SESSION_KEY = 'cc_session';

const saveSession = (uid, passcode) => {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ uid, passcode, ts: Date.now() }));
};

const getSession = () => {
  try { 
    return JSON.parse(localStorage.getItem(SESSION_KEY)); 
  } catch { 
    return null; 
  }
};

const clearSession = () => localStorage.removeItem(SESSION_KEY);

// ══ ROUTER ══
const go = (page, data={}) => {
  sessionStorage.setItem('cc_route', JSON.stringify({ page, data }));
  window.location.href = page;
};

const getRoute = () => {
  try { 
    return JSON.parse(sessionStorage.getItem('cc_route')); 
  } catch { 
    return null; 
  }
};

// ══ ONLINE STATUS ══
const setOnline = async uid => {
  try {
    const r = ref(db, `users/${uid}/online`);
    await set(r, true);
    onDisconnect(r).set(false);
    onDisconnect(ref(db, `users/${uid}/lastSeen`)).set(Date.now());
  } catch(e) {
    console.error('Set online error:', e);
  }
};

// ══ UNIQUE USER CODE SYSTEM ══
/**
 * Generate unique 7-character code for user
 * Format: XXXXXX9 (6 chars + 1 check digit)
 */
const generateUserCode = (uid) => {
  try {
    let hash = 0;
    for (let i = 0; i < uid.length; i++) {
      const char = uid.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    let num = Math.abs(hash);
    
    for (let i = 0; i < 6; i++) {
      code += chars[num % chars.length];
      num = Math.floor(num / chars.length);
    }
    
    let checkSum = 0;
    for (let i = 0; i < code.length; i++) {
      checkSum += code.charCodeAt(i);
    }
    const checkDigit = (checkSum % 10);
    
    return code + checkDigit;
  } catch(e) {
    console.error('Generate code error:', e);
    return 'ERROR01';
  }
};

/**
 * Find user by unique code
 */
const findUserByCode = async (code) => {
  try {
    if (!code || code.length !== 7) return null;
    
    const snap = await get(ref(db, 'search/users'));
    const users = snap.val() || {};
    
    for (const [uid, user] of Object.entries(users)) {
      if (user && user.code === code.toUpperCase()) {
        return { uid, ...user };
      }
    }
    
    return null;
  } catch(e) {
    console.error('Find user by code error:', e);
    return null;
  }
};

/**
 * Add friend using code
 */
const addFriendByCode = async (myUid, code) => {
  try {
    const user = await findUserByCode(code);
    if (!user) throw new Error('User code not found');
    if (user.uid === myUid) throw new Error('Cannot add yourself');
    
    const theirUid = user.uid;
    
    // Check if already friends
    const existingSnap = await get(ref(db, `users/${myUid}/contacts/${theirUid}`));
    if(existingSnap.exists()) throw new Error('Already friends');
    
    // Add to my contacts
    await set(ref(db, `users/${myUid}/contacts/${theirUid}`), true);
    
    // Add to their contacts
    await set(ref(db, `users/${theirUid}/contacts/${myUid}`), true);
    
    return { success: true, user };
  } catch(e) {
    console.error('Add friend error:', e);
    throw e;
  }
};

// ══ SEARCH INDEXING ══
/**
 * Create searchable index for user
 */
const createUserSearchIndex = async (uid, user) => {
  try {
    const code = generateUserCode(uid);
    const nameIndex = (user.name || '').toLowerCase().trim();
    const emailIndex = (user.email || '').toLowerCase().trim();
    const nameTokens = nameIndex.split(/\s+/).filter(t => t.length > 0);
    const emailTokens = emailIndex.split('@')[0].split(/[\._\-]+/).filter(t => t.length > 0);
    const allTokens = [...new Set([...nameTokens, ...emailTokens, nameIndex, emailIndex])];
    
    await set(ref(db, `search/users/${uid}`), {
      uid,
      code,
      name: user.name || '',
      email: user.email || '',
      nameIndex,
      emailIndex,
      tokens: allTokens,
      color: user.color,
      initials: user.initials,
      photo: user.photo || '',
      createdAt: Date.now()
    });
  } catch(e) {
    console.error('Search index error:', e);
  }
};

/**
 * Search users by name or email
 */
const searchUsers = async (query, excludeUid = null) => {
  try {
    if(!query || query.length < 1) return [];
    
    const q = query.toLowerCase().trim();
    const snap = await get(ref(db, 'search/users'));
    const users = snap.val() || {};
    
    const results = Object.values(users)
      .filter(u => {
        if(!u || typeof u !== 'object') return false;
        if(excludeUid && u.uid === excludeUid) return false;
        
        const matchName = u.nameIndex && (u.nameIndex.includes(q) || 
                         u.tokens && u.tokens.some(t => t.includes(q)));
        const matchEmail = u.emailIndex && u.emailIndex.includes(q);
        
        return matchName || matchEmail;
      })
      .sort((a, b) => {
        if(a.nameIndex === q && b.nameIndex !== q) return -1;
        if(a.nameIndex !== q && b.nameIndex === q) return 1;
        return (a.name || '').length - (b.name || '').length;
      })
      .slice(0, 50);
    
    return results;
  } catch(e) {
    console.error('Search error:', e);
    return [];
  }
};

/**
 * Get all users with caching
 */
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
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    
    localStorage.setItem(cacheKey, JSON.stringify(users));
    localStorage.setItem(cacheKey + '_time', now.toString());
    
    return users;
  } catch(e) {
    console.error('Get users error:', e);
    return [];
  }
};

/**
 * Delete user search index
 */
const deleteUserSearchIndex = async (uid) => {
  try {
    await remove(ref(db, `search/users/${uid}`));
  } catch(e) {
    console.error('Delete search index error:', e);
  }
};

/**
 * Update user search index
 */
const updateUserSearchIndex = async (uid, user) => {
  try {
    await deleteUserSearchIndex(uid);
    await createUserSearchIndex(uid, user);
  } catch(e) {
    console.error('Update search index error:', e);
  }
};

// ══ OFFLINE MESSAGE QUEUE ══
const QUEUE_KEY = 'cc_msg_queue';

const addToOfflineQueue = (chatIdVal, msg) => {
  try {
    const queue = JSON.parse(localStorage.getItem(QUEUE_KEY)) || {};
    if(!queue[chatIdVal]) queue[chatIdVal] = [];
    queue[chatIdVal].push(msg);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch(e) {
    console.error('Queue error:', e);
  }
};

const getOfflineQueue = (chatIdVal) => {
  try {
    const queue = JSON.parse(localStorage.getItem(QUEUE_KEY)) || {};
    return queue[chatIdVal] || [];
  } catch {
    return [];
  }
};

const sendOfflineQueue = async (chatIdVal, uid) => {
  try {
    const queue = getOfflineQueue(chatIdVal);
    if(!queue.length) return;

    for(const msg of queue) {
      const r = push(ref(db, `chats/${chatIdVal}/messages`));
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
    delete allQueue[chatIdVal];
    localStorage.setItem(QUEUE_KEY, JSON.stringify(allQueue));
    
    console.log(`Sent ${queue.length} queued messages`);
  } catch(e) {
    console.error('Send queue error:', e);
  }
};

const clearOfflineQueue = (chatIdVal) => {
  try {
    const queue = JSON.parse(localStorage.getItem(QUEUE_KEY)) || {};
    delete queue[chatIdVal];
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {}
};

// ══ ONLINE DETECTION ══
let isOnline = navigator.onLine;

window.addEventListener('online', () => {
  isOnline = true;
  window.dispatchEvent(new CustomEvent('appOnline'));
  console.log('✅ Back online');
});

window.addEventListener('offline', () => {
  isOnline = false;
  console.log('📡 Offline mode');
});

const isAppOnline = () => isOnline;

const sendMessageOfflineAware = async (chatIdVal, uid, payload) => {
  if(!isOnline) {
    addToOfflineQueue(chatIdVal, payload);
    return { offline: true, queued: true };
  } else {
    const r = push(ref(db, `chats/${chatIdVal}/messages`));
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

// ══ NOTIFICATION HELPERS ══
const getUnreadCount = async (uid) => {
  try {
    const snap = await get(ref(db, `users/${uid}/unreadCount`));
    return snap.val() || 0;
  } catch {
    return 0;
  }
};

const setUnreadCount = async (uid, count) => {
  try {
    await set(ref(db, `users/${uid}/unreadCount`), Math.max(0, count));
  } catch(e) {
    console.error('Set unread count error:', e);
  }
};

// ══ BAN CHECK ══
const isUserBanned = async (uid) => {
  try {
    const snap = await get(ref(db, `admin/banned/${uid}`));
    return snap.val() === true;
  } catch {
    return false;
  }
};

const checkWarning = async (uid) => {
  try {
    const snap = await get(ref(db, `admin/warnings/${uid}`));
    return snap.val() === true;
  } catch {
    return false;
  }
};

// ══ EXPORT ══
export {
  // Firebase instances
  app, auth, db, gProvider,
  
  // Constants
  ADMIN_EMAIL, ADMIN_PASS, ADMIN_UID, ADMIN_WA,
  COLORS,
  
  // Utilities
  colorFor, initialsOf, chatId, 
  fmtTime, fmtDate, escHtml,
  
  // Toast & Errors
  toast, reportError,
  
  // Session & Auth
  saveSession, getSession, clearSession,
  
  // Router
  go, getRoute,
  
  // Online
  setOnline, isAppOnline,
  
  // User Code System
  generateUserCode,
  findUserByCode,
  addFriendByCode,
  
  // Search & Indexing
  createUserSearchIndex,
  searchUsers,
  getAllUsers,
  deleteUserSearchIndex,
  updateUserSearchIndex,
  
  // Offline Queue
  addToOfflineQueue,
  getOfflineQueue,
  sendOfflineQueue,
  clearOfflineQueue,
  sendMessageOfflineAware,
  
  // Notifications
  getUnreadCount,
  setUnreadCount,
  
  // Ban & Warning
  isUserBanned,
  checkWarning,
  
  // Firebase functions re-exported
  ref, set, get, push, onValue, off, remove,
  serverTimestamp, onDisconnect,
  query, orderByChild, equalTo,
  
  // Auth functions
  signOut, onAuthStateChanged, 
  updateProfile, updatePassword,
  EmailAuthProvider, reauthenticateWithCredential,
  GoogleAuthProvider, signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
};
