// ══════════════════════════════════════════════
//  ChatCity — Firebase Config & Shared Utils
//  v3.0 — FCM Push Notifications + All Features
// ══════════════════════════════════════════════

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js';
import {
  getAuth, GoogleAuthProvider, signInWithPopup,
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut, onAuthStateChanged, updateProfile, updatePassword,
  EmailAuthProvider, reauthenticateWithCredential, sendPasswordResetEmail
} from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js';
import {
  getDatabase, ref, set, get, push, onValue, off, remove,
  serverTimestamp, onDisconnect, query, orderByChild, equalTo, update
} from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-database.js';

// ══ CONFIG ══
const FB_CONFIG = {
  apiKey:            "AIzaSyAVKGyPWWQzEWfwkOwhwXabD3HbuLQz-qA",
  authDomain:        "chatcity-63c68.firebaseapp.com",
  databaseURL:       "https://chatcity-63c68-default-rtdb.firebaseio.com",
  projectId:         "chatcity-63c68",
  storageBucket:     "chatcity-63c68.firebasestorage.app",
  messagingSenderId: "1015529457316",
  appId:             "1:1015529457316:web:638f1d8e25539177844831"
};

const app  = initializeApp(FB_CONFIG);
const auth = getAuth(app);
const db   = getDatabase(app);
const gProvider = new GoogleAuthProvider();

// ══ CONSTANTS ══
const ADMIN_EMAIL  = 'admin@chatcity.com';
const ADMIN_PASS   = '9999';
const ADMIN_UID    = 'admin_system_001';
const VAPID_KEY    = 'BIzNCrJpsUisnOJqa6ETjkMUgt5LvXUKn6BtCrTgbzGfwtEXRPS1uO6T-1a4mn6djVlkZjLrio5lcsEpOfKKllo';
const VERIFIED_BADGE = 'https://i.ibb.co/W4fjDGmD/32539-removebg-preview.png';
const BASE_URL     = window.location.href.replace(/[^/]*$/, '');

// ══ COLORS ══
const COLORS = ['#7c6eff','#ff6b9d','#2dd4a0','#f7c94b','#60a5fa','#fb923c','#c084fc','#34d399'];
const colorFor   = uid => { let h=0; for(const c of uid) h=(h*31+c.charCodeAt(0))%COLORS.length; return COLORS[h]; };
const initialsOf = name => { if(!name) return '?'; const p=name.trim().split(/\s+/); return p.length>=2?(p[0][0]+p[p.length-1][0]).toUpperCase():name[0].toUpperCase(); };
const chatId     = (a,b) => [a,b].sort().join('__');

// ══ TIME ══
const fmtTime = ts => { const d=new Date(ts); return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; };
const fmtDate = ts => { const d=new Date(ts),now=new Date(); if(d.toDateString()===now.toDateString()) return 'Today'; const y=new Date(now); y.setDate(now.getDate()-1); if(d.toDateString()===y.toDateString()) return 'Yesterday'; return d.toLocaleDateString('en-GB',{day:'numeric',month:'short'}); };
const escHtml = s => s?.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>')??'';

// ══ TOAST ══
let _toastTimer;
const toast = (msg, type='') => {
  const el = document.getElementById('toast'); if(!el) return;
  el.textContent = type==='error'?'⚠ '+msg : type==='ok'?'✓ '+msg : msg;
  el.style.background = type==='error'?'#ff5370' : type==='ok'?'#2dd4a0' : '';
  el.style.color = '#fff';
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(()=>el.classList.remove('show'), 3000);
};

// ══ ERROR REPORTING ══
const reportError = async (err, ctx='') => {
  try { await push(ref(db,'admin/errors'),{error:String(err),context:ctx,ts:Date.now(),ua:navigator.userAgent}); } catch {}
  console.warn('[ChatCity]',err,ctx);
};
window.onerror = (m,s,l) => reportError(`${m} @ ${s}:${l}`,'window.onerror');
window.onunhandledrejection = e => reportError(e.reason,'unhandledRejection');

// ══ SESSION ══
const SESSION_KEY = 'cc_session';
const saveSession  = (uid,p) => localStorage.setItem(SESSION_KEY,JSON.stringify({uid,passcode:p,ts:Date.now()}));
const getSession   = ()      => { try{return JSON.parse(localStorage.getItem(SESSION_KEY));}catch{return null;} };
const clearSession = ()      => localStorage.removeItem(SESSION_KEY);

// ══ ROUTER ══
const go = (page,data={}) => { sessionStorage.setItem('cc_route',JSON.stringify({page,data})); window.location.href=page; };

// ══ ONLINE STATUS ══
const setOnline = async uid => {
  try {
    const r = ref(db,`users/${uid}/online`);
    await set(r,true);
    onDisconnect(r).set(false);
    onDisconnect(ref(db,`users/${uid}/lastSeen`)).set(Date.now());
    await set(ref(db,`users/${uid}/lastVisit`),Date.now());
  } catch(e){ console.error('setOnline:',e); }
};

// ══════════════════════════════════════════════
// FCM PUSH NOTIFICATIONS
// ══════════════════════════════════════════════

let _fcmMessaging = null;

const initFCM = async uid => {
  try {
    if(!('serviceWorker' in navigator)) return;
    // Register service worker
    const reg = await navigator.serviceWorker.register('/ChatCity/firebase-messaging-sw.js');
    const { getMessaging, getToken, onMessage } = await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging.js');
    _fcmMessaging = getMessaging(app);

    const perm = await Notification.requestPermission();
    if(perm !== 'granted') return;

    const token = await getToken(_fcmMessaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
    if(token) {
      await set(ref(db,`users/${uid}/fcmToken`), token);
      console.log('[FCM] ✅ Token registered');
    }

    // Foreground messages
    onMessage(_fcmMessaging, payload => {
      const { title, body } = payload.notification || {};
      if(Notification.permission === 'granted') {
        new Notification(title || 'ChatCity 💬', {
          body: body || 'New message',
          icon: 'https://cdn-icons-png.flaticon.com/512/3048/3048122.png',
          tag:  'cc-fg-msg'
        });
      }
    });
  } catch(e){ console.warn('[FCM]',e); }
};

const RENDER_URL = 'https://chatcity-backend.onrender.com';

const sendPushToUser = async (receiverUid, title, body, url='home.html') => {
  try {
    const snap = await get(ref(db,`users/${receiverUid}`));
    const u = snap.val();
    if(!u || u.online) return; // skip if online
    const token = u.fcmToken;
    if(!token) return;
    // Send via Render backend
    fetch(RENDER_URL + '/api/send-push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, title, body, url })
    }).catch(()=>{});
  } catch(e){ console.warn('[FCM sendPush]',e); }
};

// Email stub (removed)
const sendBrevoEmail = async () => true;
const notifyMessageByEmail = async () => {};
const checkAndSendDigestEmail = async () => {};
const checkMissYouEmail = async () => {};
const validateEmail = email => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());

// ══════════════════════════════════════════════
// USER CODE SYSTEM
// ══════════════════════════════════════════════
const generateUserCode = uid => {
  try {
    let hash=0;
    for(let i=0;i<uid.length;i++){const c=uid.charCodeAt(i);hash=((hash<<5)-hash)+c;hash=hash&hash;}
    const chars='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code='',num=Math.abs(hash);
    for(let i=0;i<6;i++){code+=chars[num%chars.length];num=Math.floor(num/chars.length);}
    let cs=0; for(let i=0;i<code.length;i++) cs+=code.charCodeAt(i);
    return code+(cs%10);
  } catch { return 'ERROR01'; }
};

const findUserByCode = async code => {
  try {
    if(!code||code.length!==7) return null;
    const snap=await get(ref(db,'search/users'));
    const users=snap.val()||{};
    for(const [uid,u] of Object.entries(users)){
      if(u&&u.code===code.toUpperCase()) return {uid,...u};
    }
    return null;
  } catch { return null; }
};

const addFriendByCode = async (myUid,code) => {
  const user=await findUserByCode(code);
  if(!user) throw new Error('User code not found');
  if(user.uid===myUid) throw new Error('Cannot add yourself');
  const ex=await get(ref(db,`users/${myUid}/contacts/${user.uid}`));
  if(ex.exists()) throw new Error('Already friends');
  await set(ref(db,`users/${myUid}/contacts/${user.uid}`),true);
  await set(ref(db,`users/${user.uid}/contacts/${myUid}`),true);
  return {success:true,user};
};

// ══ SEARCH ══
const createUserSearchIndex = async (uid,user) => {
  try {
    const code=generateUserCode(uid);
    const ni=(user.name||'').toLowerCase().trim();
    const ei=(user.email||'').toLowerCase().trim();
    const nt=ni.split(/\s+/).filter(t=>t.length>0);
    const et=ei.split('@')[0].split(/[\._\-]+/).filter(t=>t.length>0);
    await set(ref(db,`search/users/${uid}`),{uid,code,name:user.name||'',email:user.email||'',nameIndex:ni,emailIndex:ei,tokens:[...new Set([...nt,...et,ni,ei])],color:user.color,initials:user.initials,photo:user.photo||'',createdAt:Date.now()});
  } catch(e){console.error('Search index:',e);}
};

const searchUsers = async (query,excludeUid=null) => {
  try {
    if(!query||query.length<1) return [];
    const q=query.toLowerCase().trim();
    const snap=await get(ref(db,'search/users'));
    const users=snap.val()||{};
    return Object.values(users).filter(u=>{
      if(!u||typeof u!=='object') return false;
      if(excludeUid&&u.uid===excludeUid) return false;
      return (u.nameIndex&&(u.nameIndex.includes(q)||u.tokens?.some(t=>t.includes(q))))
          || (u.emailIndex&&u.emailIndex.includes(q))
          || (u.code&&u.code.toLowerCase()===q.toUpperCase());
    }).sort((a,b)=>(a.name||'').length-(b.name||'').length).slice(0,50);
  } catch { return []; }
};

const getAllUsers = async (useCache=true) => {
  try {
    const ck='users_cache', ct=ck+'_time';
    const cached=localStorage.getItem(ck), ctime=localStorage.getItem(ct);
    if(useCache&&cached&&ctime&&(Date.now()-parseInt(ctime))<300000) return JSON.parse(cached);
    const snap=await get(ref(db,'users'));
    const users=Object.entries(snap.val()||{}).map(([uid,u])=>({uid,...u})).sort((a,b)=>(a.name||'').localeCompare(b.name||''));
    localStorage.setItem(ck,JSON.stringify(users)); localStorage.setItem(ct,Date.now().toString());
    return users;
  } catch { return []; }
};

const deleteUserSearchIndex = async uid => { try{await remove(ref(db,`search/users/${uid}`));}catch{} };
const updateUserSearchIndex = async (uid,user) => { await deleteUserSearchIndex(uid); await createUserSearchIndex(uid,user); };

// ══ OFFLINE QUEUE ══
const QUEUE_KEY='cc_msg_queue';
const addToOfflineQueue  = (cid,msg) => { try{const q=JSON.parse(localStorage.getItem(QUEUE_KEY))||{};if(!q[cid])q[cid]=[];q[cid].push(msg);localStorage.setItem(QUEUE_KEY,JSON.stringify(q));}catch{} };
const getOfflineQueue    = cid       => { try{return(JSON.parse(localStorage.getItem(QUEUE_KEY))||{})[cid]||[];}catch{return[];} };
const clearOfflineQueue  = cid       => { try{const q=JSON.parse(localStorage.getItem(QUEUE_KEY))||{};delete q[cid];localStorage.setItem(QUEUE_KEY,JSON.stringify(q));}catch{} };

// ══ ONLINE DETECTION ══
let _online=navigator.onLine;
window.addEventListener('online', ()=>{_online=true; window.dispatchEvent(new CustomEvent('appOnline'));});
window.addEventListener('offline',()=>{_online=false;});
const isAppOnline=()=>_online;

const sendMessageOfflineAware = async (cid,uid,payload) => {
  if(!_online){addToOfflineQueue(cid,payload);return{offline:true,queued:true};}
  const r=push(ref(db,`chats/${cid}/messages`));
  await set(r,{id:r.key,senderId:uid,ts:Date.now(),seen:false,...payload});
  return{offline:false,sent:true};
};

// ══ BAN ══
const isUserBanned  = async uid => { try{const s=await get(ref(db,`admin/banned/${uid}`));return s.val()===true;}catch{return false;} };
const checkWarning  = async uid => { try{const s=await get(ref(db,`admin/warnings/${uid}`));return s.val()===true;}catch{return false;} };

// ══ EXPORT ══
export {
  app, auth, db, gProvider,
  ADMIN_EMAIL, ADMIN_PASS, ADMIN_UID, VAPID_KEY, VERIFIED_BADGE, BASE_URL, COLORS,
  colorFor, initialsOf, chatId, fmtTime, fmtDate, escHtml,
  toast, reportError,
  saveSession, getSession, clearSession, go,
  setOnline, isAppOnline,
  initFCM, sendPushToUser,
  sendBrevoEmail, validateEmail,
  notifyMessageByEmail, checkAndSendDigestEmail, checkMissYouEmail,
  generateUserCode, findUserByCode, addFriendByCode,
  createUserSearchIndex, searchUsers, getAllUsers,
  deleteUserSearchIndex, updateUserSearchIndex,
  addToOfflineQueue, getOfflineQueue, clearOfflineQueue, sendMessageOfflineAware,
  isUserBanned, checkWarning,
  ref, set, get, push, onValue, off, remove, update,
  serverTimestamp, onDisconnect, query, orderByChild, equalTo,
  signOut, onAuthStateChanged, updateProfile, updatePassword,
  EmailAuthProvider, reauthenticateWithCredential,
  GoogleAuthProvider, signInWithPopup,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail
};
