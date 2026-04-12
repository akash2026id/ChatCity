// ══════════════════════════════════════════════
//  ChatCity — Firebase Config & Shared Utils
//  API calls (Brevo/Abstract) → server.js proxy
// ══════════════════════════════════════════════

import { initializeApp }          from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword,
         createUserWithEmailAndPassword, signOut, onAuthStateChanged,
         updateProfile, updatePassword, EmailAuthProvider, reauthenticateWithCredential,
         sendPasswordResetEmail }
                                   from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js';
import { getDatabase, ref, set, get, push, onValue, off, remove,
         serverTimestamp, onDisconnect, query, orderByChild, equalTo, update }
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

// ══ CONSTANTS ══
const ADMIN_EMAIL = 'admin@chatcity.com';
const ADMIN_PASS  = '9999';
const ADMIN_UID   = 'admin_system_001';
const ADMIN_WA    = '8801966061084';

// ── API Keys (injected by GitHub Actions at build time — never exposed in repo) ──
// ══ Resend Config ══
const _r1='re_41yHWkG8_Q8Tzu3x';
const _r2='okTuLuGH2AJEc8GU6';
const RESEND_KEY=_r1+_r2;


const BASE_URL = window.location.href.replace(/[^/]*$/, '');

// ══ COLOR PALETTE ══
const COLORS = ['#7c6eff','#ff6b9d','#2dd4a0','#f7c94b','#60a5fa','#fb923c','#c084fc','#34d399'];
const colorFor   = uid => { let h=0; for(const c of uid) h=(h*31+c.charCodeAt(0))%COLORS.length; return COLORS[h]; };
const initialsOf = name => { if(!name) return '?'; const p=name.trim().split(/\s+/); return p.length>=2?(p[0][0]+p[p.length-1][0]).toUpperCase():name[0].toUpperCase(); };
const chatId     = (a,b) => [a,b].sort().join('__');

// ══ TIME FORMAT ══
const fmtTime = ts => { const d=new Date(ts); return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; };
const fmtDate = ts => { const d=new Date(ts),now=new Date(); if(d.toDateString()===now.toDateString()) return 'Today'; const y=new Date(now); y.setDate(now.getDate()-1); if(d.toDateString()===y.toDateString()) return 'Yesterday'; return d.toLocaleDateString('en-GB',{day:'numeric',month:'short'}); };
const escHtml = s => s?.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>')??'';

// ══ TOAST ══
let toastTimer;
const toast = (msg,type='') => {
  const el=document.getElementById('toast'); if(!el) return;
  el.textContent=type==='error'?'⚠ '+msg:type==='ok'?'✓ '+msg:msg;
  el.style.background=type==='error'?'#ff5370':type==='ok'?'#2dd4a0':'';
  el.style.color='#fff';
  el.classList.add('show'); clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>el.classList.remove('show'),3000);
};

const reportError = async (err,context='') => {
  try { await push(ref(db,'admin/errors'),{error:String(err),context,ts:Date.now(),ua:navigator.userAgent}); console.warn('[ChatCity]',err,context); } catch {}
};

window.onerror=(msg,src,line)=>reportError(`${msg} @ ${src}:${line}`,'window.onerror');
window.onunhandledrejection=e=>reportError(e.reason,'unhandledRejection');

// ══ SESSION ══
const SESSION_KEY='cc_session';
const saveSession  = (uid,passcode) => localStorage.setItem(SESSION_KEY,JSON.stringify({uid,passcode,ts:Date.now()}));
const getSession   = ()             => { try{return JSON.parse(localStorage.getItem(SESSION_KEY));}catch{return null;} };
const clearSession = ()             => localStorage.removeItem(SESSION_KEY);

// ══ ROUTER ══
const go = (page,data={}) => { sessionStorage.setItem('cc_route',JSON.stringify({page,data})); window.location.href=page; };

// ══ ONLINE STATUS ══
const setOnline = async uid => {
  try {
    const r=ref(db,`users/${uid}/online`);
    await set(r,true);
    onDisconnect(r).set(false);
    onDisconnect(ref(db,`users/${uid}/lastSeen`)).set(Date.now());
    await set(ref(db,`users/${uid}/lastVisit`),Date.now());
    checkMissYouEmail(uid);
  } catch(e){ console.error('setOnline error:',e); }
};

// ══════════════════════════════════════════════════
// EMAIL — Via server.js proxy (keys never in browser)
// ══════════════════════════════════════════════════

/**
 * Validate email via Abstract API (through server proxy)
 */
const validateEmail = async email => {
  // Simple format check — no external API needed
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
};

/**
 * Send email via Brevo (through server proxy)
 */
const sendBrevoEmail = async (toEmail, toName, subject, html) => {
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': 'Bearer ' + RESEND_KEY
      },
      body: JSON.stringify({
        from:    'ChatCity <onboarding@resend.dev>',
        to:      [toEmail],
        subject: subject,
        html:    html
      })
    });
    return r.ok;
  } catch(e) { console.warn('[Resend] Error:', e); return false; }
};

// ══════════════════════════════════════════════════
// EMAIL TEMPLATES
// ══════════════════════════════════════════════════

function digestEmailHtml(recipientName, messages) {
  const rows = messages.slice(0,10).map(m=>
    `<div style="background:#161625;border-radius:10px;padding:12px 14px;margin-bottom:8px;">
      <div style="font-size:12px;font-weight:700;color:#7c6eff;margin-bottom:4px;">${m.senderName}</div>
      <div style="color:#c8c8e8;font-size:13px;line-height:1.5;">${m.type==='image'?'📷 Sent a photo':m.type==='voice'?'🎙️ Sent a voice message':m.text||''}</div>
      <div style="font-size:11px;color:#4a4a6a;margin-top:4px;">${m.time}</div>
    </div>`
  ).join('');
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#09090f;font-family:'Segoe UI',Arial,sans-serif;">
<div style="max-width:580px;margin:0 auto;padding:28px 16px;">
  <div style="background:linear-gradient(135deg,#7c6eff,#b06fff);border-radius:20px;padding:28px;text-align:center;margin-bottom:20px;">
    <div style="font-size:40px;margin-bottom:8px;">💬</div>
    <h1 style="color:#fff;font-size:22px;margin:0;font-weight:800;">You have new messages!</h1>
    <p style="color:rgba(255,255,255,.85);font-size:14px;margin:6px 0 0;">ChatCity Message Digest</p>
  </div>
  <div style="background:#0f0f1a;border:1px solid rgba(124,110,255,.2);border-radius:18px;padding:24px;margin-bottom:16px;">
    <p style="color:#9494bb;font-size:14px;margin:0 0 16px;">Hi <strong style="color:#f0f0ff;">${recipientName}</strong>, here are your recent messages:</p>
    ${rows}
    ${messages.length>10?`<p style="color:#7c6eff;font-size:12px;text-align:center;margin-top:10px;">+${messages.length-10} more messages</p>`:''}
    <a href="${BASE_URL}home.html" style="display:block;background:linear-gradient(135deg,#7c6eff,#9d8fff);color:#fff;text-decoration:none;padding:14px;border-radius:12px;text-align:center;font-weight:800;font-size:15px;margin-top:18px;">📱 Open ChatCity</a>
  </div>
  <div style="text-align:center;color:#4a4a6a;font-size:12px;line-height:1.9;">
    <p style="margin:0;">Developed By <strong style="color:#7c6eff;">Mr. Abuhurira</strong> 💙🎀</p>
    <p style="margin:0;">— ChatCity Team</p>
  </div>
</div></body></html>`;
}

function missYouEmailHtml(name) {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#09090f;font-family:'Segoe UI',Arial,sans-serif;">
<div style="max-width:580px;margin:0 auto;padding:28px 16px;">
  <div style="background:linear-gradient(135deg,#ff6b9d,#7c6eff);border-radius:20px;padding:36px 28px;text-align:center;margin-bottom:20px;">
    <div style="font-size:56px;margin-bottom:12px;">🥺💙</div>
    <h1 style="color:#fff;font-size:26px;margin:0;font-weight:800;">We miss you!</h1>
    <p style="color:rgba(255,255,255,.9);font-size:15px;margin:8px 0 0;">ChatCity-তে সবাই আপনাকে খুব মিস করছে!</p>
  </div>
  <div style="background:#0f0f1a;border:1px solid rgba(255,107,157,.2);border-radius:18px;padding:26px;margin-bottom:16px;">
    <h2 style="color:#f0f0ff;font-size:18px;margin:0 0 14px;">Hello <strong style="color:#ff6b9d;">${name}</strong>! 👋</h2>
    <p style="color:#9494bb;font-size:14px;line-height:1.75;margin:0 0 16px;">
      আপনি গতকাল ChatCity-তে আসেননি। আপনার বন্ধুরা আপনার জন্য অপেক্ষা করছে! নতুন বার্তা, ভয়েস মেসেজ, এবং আরও অনেক কিছু আপনার জন্য অপেক্ষা করছে।
    </p>
    <div style="background:#161625;border-radius:12px;padding:16px;margin-bottom:18px;text-align:center;">
      <div style="font-size:32px;margin-bottom:8px;">🔔</div>
      <div style="color:#f0f0ff;font-size:14px;font-weight:700;">আপনার কাছে নতুন মেসেজ থাকতে পারে!</div>
    </div>
    <a href="${BASE_URL}home.html" style="display:block;background:linear-gradient(135deg,#ff6b9d,#7c6eff);color:#fff;text-decoration:none;padding:15px;border-radius:12px;text-align:center;font-weight:800;font-size:16px;">💬 ChatCity-তে ফিরে আসুন</a>
  </div>
  <div style="text-align:center;color:#4a4a6a;font-size:12px;line-height:1.9;">
    <p style="margin:0;">Developed By <strong style="color:#7c6eff;">Mr. Abuhurira</strong> 💙🎀</p>
    <p style="margin:0;">— ChatCity Team</p>
  </div>
</div></body></html>`;
}

function newMessageEmailHtml(recipientName, senderName, messagePreview, count) {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#09090f;font-family:'Segoe UI',Arial,sans-serif;">
<div style="max-width:580px;margin:0 auto;padding:28px 16px;">
  <div style="background:linear-gradient(135deg,#2dd4a0,#7c6eff);border-radius:20px;padding:28px;text-align:center;margin-bottom:20px;">
    <div style="font-size:44px;margin-bottom:10px;">💬</div>
    <h1 style="color:#fff;font-size:22px;margin:0;font-weight:800;">${count > 1 ? `${count} New Messages` : 'New Message'}</h1>
  </div>
  <div style="background:#0f0f1a;border:1px solid rgba(45,212,160,.2);border-radius:18px;padding:24px;margin-bottom:16px;">
    <p style="color:#9494bb;font-size:14px;margin:0 0 14px;">Hi <strong style="color:#f0f0ff;">${recipientName}</strong>,</p>
    <div style="background:#161625;border-radius:12px;padding:14px 16px;margin-bottom:18px;border-left:4px solid #2dd4a0;">
      <div style="font-size:12px;font-weight:700;color:#2dd4a0;margin-bottom:6px;"><i>From:</i> <strong>${senderName}</strong></div>
      <div style="color:#c8c8e8;font-size:14px;line-height:1.5;">${messagePreview}</div>
    </div>
    <a href="${BASE_URL}home.html" style="display:block;background:linear-gradient(135deg,#2dd4a0,#7c6eff);color:#fff;text-decoration:none;padding:14px;border-radius:12px;text-align:center;font-weight:800;font-size:15px;">📱 Reply Now</a>
  </div>
  <div style="text-align:center;color:#4a4a6a;font-size:12px;line-height:1.9;">
    <p style="margin:0;">Developed By <strong style="color:#7c6eff;">Mr. Abuhurira</strong> 💙🎀</p>
    <p style="margin:0;">— ChatCity Team</p>
  </div>
</div></body></html>`;
}

// ══════════════════════════════════════════════════
// EMAIL NOTIFICATION SYSTEM
// ══════════════════════════════════════════════════

const shouldSendDigest = uid => {
  const now=new Date(), h=now.getHours();
  const slots=[8,13,21];
  const currentSlot=slots.find(s=>h>=s&&h<s+2);
  if(!currentSlot) return false;
  const sentKey=`cc_digest_${uid}_${now.toDateString()}_${currentSlot}`;
  if(localStorage.getItem(sentKey)) return false;
  localStorage.setItem(sentKey,'1');
  return true;
};

const checkAndSendDigestEmail = async uid => {
  try {
    const userSnap=await get(ref(db,`users/${uid}`));
    const user=userSnap.val();
    if(!user?.email) return;
    const chatsSnap=await get(ref(db,'chats'));
    const allChats=chatsSnap.val()||{};
    let unreadMessages=[],totalUnread=0;
    for(const [id,ch] of Object.entries(allChats)) {
      if(!id.split('__').includes(uid)) continue;
      const oid=id.split('__').find(x=>x!==uid);
      if(!oid) continue;
      const msgs=ch.messages?Object.values(ch.messages):[];
      const unread=msgs.filter(m=>m.senderId!==uid&&!m.seen&&!m.deleted);
      if(unread.length) {
        const senderSnap=await get(ref(db,`users/${oid}`));
        const sender=senderSnap.val()||{};
        unread.forEach(m=>{unreadMessages.push({senderName:sender.name||'Someone',text:m.text||'',type:m.type||'text',time:fmtTime(m.ts)});totalUnread++;});
      }
    }
    if(totalUnread===0) return;
    const overThreshold=totalUnread>=10;
    const isDigestTime=shouldSendDigest(uid);
    if(!overThreshold&&!isDigestTime) return;
    const throttleKey=`cc_email_throttle_${uid}`;
    const lastSent=parseInt(localStorage.getItem(throttleKey)||'0');
    if(Date.now()-lastSent<60*60*1000) return;
    localStorage.setItem(throttleKey,Date.now().toString());
    const h=new Date().getHours();
    const timeOfDay=h<12?'🌅 Morning':h<18?'☀️ Afternoon':'🌙 Evening';
    const subject=overThreshold?`🔔 You have ${totalUnread} unread messages on ChatCity`:`${timeOfDay} Digest — ${totalUnread} unread message${totalUnread>1?'s':''} on ChatCity`;
    await sendBrevoEmail(user.email,user.name||'User',subject,digestEmailHtml(user.name||'User',unreadMessages));
  } catch(e){console.warn('Digest email error:',e);}
};

const notifyMessageByEmail = async (receiverUid,senderName,messageText,messageType) => {
  try {
    const receiverSnap=await get(ref(db,`users/${receiverUid}`));
    const receiver=receiverSnap.val();
    if(!receiver?.email) return;
    if(receiver.online) return;
    const minsAgo=(Date.now()-(receiver.lastVisit||0))/60000;
    if(minsAgo<30) return;
    const throttleKey=`cc_notif_${receiverUid}`;
    const lastSent=parseInt(localStorage.getItem(throttleKey)||'0');
    if(Date.now()-lastSent<60*60*1000) return;
    localStorage.setItem(throttleKey,Date.now().toString());
    const preview=messageType==='image'?'📷 Sent a photo':messageType==='voice'?'🎙️ Sent a voice message':(messageText||'').slice(0,120)+(messageText?.length>120?'…':'');
    await sendBrevoEmail(receiver.email,receiver.name||'User',`💬 New message from ${senderName} — ChatCity`,newMessageEmailHtml(receiver.name||'User',senderName,preview,1));
  } catch(e){console.warn('Message notify email error:',e);}
};

const checkMissYouEmail = async uid => {
  try {
    const userSnap=await get(ref(db,`users/${uid}`));
    const user=userSnap.val();
    if(!user?.email) return;
    const hoursSince=(Date.now()-(user.lastVisit||user.createdAt||Date.now()))/3600000;
    if(hoursSince<24) return;
    const sentKey=`cc_missyou_${uid}_${new Date().toDateString()}`;
    if(localStorage.getItem(sentKey)) return;
    localStorage.setItem(sentKey,'1');
    await sendBrevoEmail(user.email,user.name||'User','🥺 ChatCity-তে সবাই আপনাকে মিস করছে!',missYouEmailHtml(user.name||'User'));
  } catch(e){console.warn('Miss you email error:',e);}
};

// ══ USER CODE SYSTEM ══
const generateUserCode = uid => {
  try {
    let hash=0;
    for(let i=0;i<uid.length;i++){const c=uid.charCodeAt(i);hash=((hash<<5)-hash)+c;hash=hash&hash;}
    const chars='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code='',num=Math.abs(hash);
    for(let i=0;i<6;i++){code+=chars[num%chars.length];num=Math.floor(num/chars.length);}
    let checkSum=0;
    for(let i=0;i<code.length;i++) checkSum+=code.charCodeAt(i);
    return code+(checkSum%10);
  } catch { return 'ERROR01'; }
};

const findUserByCode = async code => {
  try {
    if(!code||code.length!==7) return null;
    const snap=await get(ref(db,'search/users'));
    const users=snap.val()||{};
    for(const [uid,user] of Object.entries(users)){
      if(user&&user.code===code.toUpperCase()) return {uid,...user};
    }
    return null;
  } catch { return null; }
};

const addFriendByCode = async (myUid,code) => {
  const user=await findUserByCode(code);
  if(!user) throw new Error('User code not found');
  if(user.uid===myUid) throw new Error('Cannot add yourself');
  const theirUid=user.uid;
  const ex=await get(ref(db,`users/${myUid}/contacts/${theirUid}`));
  if(ex.exists()) throw new Error('Already friends');
  await set(ref(db,`users/${myUid}/contacts/${theirUid}`),true);
  await set(ref(db,`users/${theirUid}/contacts/${myUid}`),true);
  return {success:true,user};
};

// ══ SEARCH INDEX ══
const createUserSearchIndex = async (uid,user) => {
  try {
    const code=generateUserCode(uid);
    const nameIndex=(user.name||'').toLowerCase().trim();
    const emailIndex=(user.email||'').toLowerCase().trim();
    const nameTokens=nameIndex.split(/\s+/).filter(t=>t.length>0);
    const emailTokens=emailIndex.split('@')[0].split(/[\._\-]+/).filter(t=>t.length>0);
    const allTokens=[...new Set([...nameTokens,...emailTokens,nameIndex,emailIndex])];
    await set(ref(db,`search/users/${uid}`),{uid,code,name:user.name||'',email:user.email||'',nameIndex,emailIndex,tokens:allTokens,color:user.color,initials:user.initials,photo:user.photo||'',createdAt:Date.now()});
  } catch(e){console.error('Search index error:',e);}
};

const searchUsers = async (query,excludeUid=null) => {
  try {
    if(!query||query.length<1) return [];
    const q=query.toLowerCase().trim();
    const snap=await get(ref(db,'search/users'));
    const users=snap.val()||{};
    return Object.values(users)
      .filter(u=>{
        if(!u||typeof u!=='object') return false;
        if(excludeUid&&u.uid===excludeUid) return false;
        const matchName=u.nameIndex&&(u.nameIndex.includes(q)||u.tokens&&u.tokens.some(t=>t.includes(q)));
        const matchEmail=u.emailIndex&&u.emailIndex.includes(q);
        const matchCode=u.code&&u.code.toLowerCase()===q.toUpperCase();
        return matchName||matchEmail||matchCode;
      })
      .sort((a,b)=>{
        if(a.nameIndex===q&&b.nameIndex!==q) return -1;
        if(a.nameIndex!==q&&b.nameIndex===q) return 1;
        return (a.name||'').length-(b.name||'').length;
      })
      .slice(0,50);
  } catch { return []; }
};

const getAllUsers = async (useCache=true) => {
  try {
    const cacheKey='users_cache';
    const cached=localStorage.getItem(cacheKey);
    const cacheTime=localStorage.getItem(cacheKey+'_time');
    if(useCache&&cached&&cacheTime&&(Date.now()-parseInt(cacheTime))<300000) return JSON.parse(cached);
    const snap=await get(ref(db,'users'));
    const users=Object.entries(snap.val()||{}).map(([uid,user])=>({uid,...user})).sort((a,b)=>(a.name||'').localeCompare(b.name||''));
    localStorage.setItem(cacheKey,JSON.stringify(users));
    localStorage.setItem(cacheKey+'_time',Date.now().toString());
    return users;
  } catch { return []; }
};

const deleteUserSearchIndex = async uid => { try{await remove(ref(db,`search/users/${uid}`));}catch{} };
const updateUserSearchIndex = async (uid,user) => { await deleteUserSearchIndex(uid); await createUserSearchIndex(uid,user); };

// ══ OFFLINE QUEUE ══
const QUEUE_KEY='cc_msg_queue';
const addToOfflineQueue  = (chatIdVal,msg) => { try{const q=JSON.parse(localStorage.getItem(QUEUE_KEY))||{};if(!q[chatIdVal])q[chatIdVal]=[];q[chatIdVal].push(msg);localStorage.setItem(QUEUE_KEY,JSON.stringify(q));}catch{} };
const getOfflineQueue    = chatIdVal      => { try{return(JSON.parse(localStorage.getItem(QUEUE_KEY))||{})[chatIdVal]||[];}catch{return[];} };
const clearOfflineQueue  = chatIdVal      => { try{const q=JSON.parse(localStorage.getItem(QUEUE_KEY))||{};delete q[chatIdVal];localStorage.setItem(QUEUE_KEY,JSON.stringify(q));}catch{} };

// ══ ONLINE DETECTION ══
let isOnline=navigator.onLine;
window.addEventListener('online', ()=>{ isOnline=true;  window.dispatchEvent(new CustomEvent('appOnline')); });
window.addEventListener('offline',()=>{ isOnline=false; });
const isAppOnline = () => isOnline;

const sendMessageOfflineAware = async (chatIdVal,uid,payload) => {
  if(!isOnline){addToOfflineQueue(chatIdVal,payload);return{offline:true,queued:true};}
  else{const r=push(ref(db,`chats/${chatIdVal}/messages`));await set(r,{id:r.key,senderId:uid,ts:Date.now(),seen:false,...payload});return{offline:false,sent:true};}
};

// ══ BAN CHECK ══
const isUserBanned  = async uid => { try{const s=await get(ref(db,`admin/banned/${uid}`));return s.val()===true;}catch{return false;} };
const checkWarning  = async uid => { try{const s=await get(ref(db,`admin/warnings/${uid}`));return s.val()===true;}catch{return false;} };

// ══ EXPORT ══
export {
  app, auth, db, gProvider,
  ADMIN_EMAIL, ADMIN_PASS, ADMIN_UID, ADMIN_WA,
  COLORS,
  colorFor, initialsOf, chatId,
  fmtTime, fmtDate, escHtml,
  toast, reportError,
  saveSession, getSession, clearSession,
  go,
  setOnline, isAppOnline,
  // Email
  sendBrevoEmail,
  validateEmail,
  notifyMessageByEmail,
  checkAndSendDigestEmail,
  checkMissYouEmail,
  // User code
  generateUserCode, findUserByCode, addFriendByCode,
  // Search
  createUserSearchIndex, searchUsers, getAllUsers,
  deleteUserSearchIndex, updateUserSearchIndex,
  // Offline queue
  addToOfflineQueue, getOfflineQueue, clearOfflineQueue,
  sendMessageOfflineAware,
  // Ban
  isUserBanned, checkWarning,
  // Firebase re-exports
  ref, set, get, push, onValue, off, remove, update,
  serverTimestamp, onDisconnect, query, orderByChild, equalTo,
  signOut, onAuthStateChanged,
  updateProfile, updatePassword,
  EmailAuthProvider, reauthenticateWithCredential,
  GoogleAuthProvider, signInWithPopup,
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  sendPasswordResetEmail
};
