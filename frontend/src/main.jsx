import React, { useEffect, useRef, useState } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { createRoot } from 'react-dom/client';
import {
  Activity, ArrowRight, Bell, CheckCircle2, Compass, Eye, EyeOff, Flame,
  Heart, Home, LockKeyhole, LogOut, Mail, MessageCircle, Send, ShieldCheck,
  Sparkles, Trash2, TrendingUp, UserRound, Users, X, Zap, Plus, Image as ImageIcon, Video, Hash, Dumbbell, Weight, Clock3, Upload, FileVideo, FileImage,
  UserPlus, UserCheck, MessageSquare, ChevronLeft, ChevronRight, Settings, Bookmark, KeyRound, UserX, MailCheck, Search, Flag, Ban, VolumeX, ClipboardList, Footprints, RefreshCw, FileText
} from 'lucide-react';
import './style.css';
import WorkoutAnalysisPanel from './WorkoutAnalysisPanel.jsx';
import './workout-analysis.css';
import LegalPages from './LegalPages.jsx';

// Keep localhost as a development convenience only. Production builds should use
// an explicit API origin or a same-origin reverse proxy, never the developer's host.
const API = (import.meta.env.DEV ? (import.meta.env.VITE_API_URL || 'http://localhost:8000') : 'https://fitnova-api-yt9t.onrender.com').replace(/\/$/, '');
const TOKEN_KEY = 'fitnova_access_token';
const PushNotifications = registerPlugin('PushNotifications');
const LocalNotifications = registerPlugin('LocalNotifications');
const StepCounter = registerPlugin('StepCounter');
const apiGetCache = new Map();
const apiGetInFlight = new Map();
let apiCacheGeneration = 0;
const photoMediaCache = new Map();
const playbackUrlCache = new Map();
const HOME_POSTS_CACHE_PREFIX = 'fitnova_home_posts_v1:';

function readHomePostsCache(username) {
  try {
    const cached = JSON.parse(sessionStorage.getItem(HOME_POSTS_CACHE_PREFIX + username) || 'null');
    if (!cached || Date.now() - cached.savedAt > 15 * 60 * 1000 || !Array.isArray(cached.posts)) return [];
    return cached.posts;
  } catch { return []; }
}

function writeHomePostsCache(username, posts) {
  try {
    sessionStorage.setItem(HOME_POSTS_CACHE_PREFIX + username, JSON.stringify({ savedAt: Date.now(), posts: posts.slice(0, 30) }));
  } catch { /* The feed still works when browser storage is unavailable. */ }
}

function cacheGet(cache, key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) { cache.delete(key); return null; }
  cache.delete(key);
  cache.set(key, entry);
  return entry.value;
}
function cacheSet(cache, key, value, ttl, maxItems = 30) {
  cache.delete(key);
  cache.set(key, { value, expiresAt: Date.now() + ttl });
  while (cache.size > maxItems) cache.delete(cache.keys().next().value);
}
function invalidateApiCache() {
  apiCacheGeneration += 1;
  apiGetCache.clear();
  // Do not let an older GET hold up a fresh request after a write.
  apiGetInFlight.clear();
}

async function api(path, options = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const method = (options.method || 'GET').toUpperCase();
  const cacheKey = `${token || 'anonymous'}:${path}`;
  const cacheable = method === 'GET' && !path.startsWith('/api/messages') && !path.includes('/media') && !path.includes('/stream');
  if (cacheable) {
    const cached = cacheGet(apiGetCache, cacheKey);
    if (cached) return cached;
    if (apiGetInFlight.has(cacheKey)) return apiGetInFlight.get(cacheKey);
  }
  const requestGeneration = apiCacheGeneration;
  const run = async () => {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(API + path, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || 'Something went wrong. Please try again.');
    if (method !== 'GET') invalidateApiCache();
    if (cacheable && requestGeneration === apiCacheGeneration) {
      const ttl = path.startsWith('/api/messages/') ? 2500 :
        path === '/api/messages' ? 2500 :
        path.startsWith('/api/users/') ? 12000 :
        path.startsWith('/api/posts') ? 8000 : 10000;
      cacheSet(apiGetCache, cacheKey, data, ttl, 40);
    }
    return data;
  };
  if (!cacheable) return run();
  let promise;
  promise = run().finally(() => {
    // An invalidated request must not delete a newer request for the same key.
    if (apiGetInFlight.get(cacheKey) === promise) apiGetInFlight.delete(cacheKey);
  });
  apiGetInFlight.set(cacheKey, promise);
  return promise;
}

const MOTIVATION = [
  ['Show up today', 'One more set.'],
  ['Stronger than yesterday', 'A little better.'],
  ['Consistency', 'wins.'],
  ['Today's effort', 'Tomorrow's you.'],
  ['One more time,', 'That's what it takes.'],
  ['Move now', 'Feel the difference.'],
  ['Small steps', 'create big change.'],
];
function dailyMotivation() {
  const now = new Date();
  const day = Math.floor((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - Date.UTC(now.getFullYear(), 0, 0)) / 86400000);
  return MOTIVATION[day % MOTIVATION.length];
}

function App() {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);
  const [mode, setMode] = useState('register');
  const [step, setStep] = useState('form');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [code, setCode] = useState('');
  const [recoveryStep, setRecoveryStep] = useState('');
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [recoveryPassword, setRecoveryPassword] = useState('');
  const [tab, setTab] = useState('home');

  useEffect(() => {
    let active = true;
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) { setBooting(false); return () => { active = false; }; }
    api('/api/auth/me')
      .then(data => { if (active) setUser(data.user); setTab('home'); })
      .catch(() => { localStorage.removeItem(TOKEN_KEY); if (active) setUser(null); })
      .finally(() => { if (active) setBooting(false); });
    return () => { active = false; };
  }, []);

  const request = async (path, body) => {
    let res;
    try {
      res = await fetch(API + path, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      });
    } catch (err) {
      if (err instanceof TypeError && /fetch/i.test(err.message || '')) {
        throw new Error('Unable to connect to FITNOVA. Please try again shortly.');
      }
      throw err;
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || '요청에 실패했습니다. 서버 Settings을 확인해 주세요.');
    return data;
  };

  const acceptSession = (data) => {
    if (!data.access_token || !data.user) throw new Error('Invalid sign-in response. Please try again.');
    localStorage.setItem(TOKEN_KEY, data.access_token);
    setUser(data.user);
    setTab('home');
    setError('');
    setNotice('');
  };

  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setError(''); setNotice('');
    const startingStep = step;
    const startingMode = mode;
    try {
      if (mode === 'register' && step === 'form') {
        setStep('verify');
        setNotice('인증 코드를 보내고 있어요...');
        await request('/api/auth/register', { name: name.trim(), username: username.trim(), email: email.trim(), password, age_confirmed: ageConfirmed });
        setNotice('인증 코드를 Email로 발송했습니다. 10분 안에 입력해 주세요.');
      } else if (mode === 'register') {
        const data = await request('/api/auth/verify', { email, code });
        acceptSession(data);
      } else if (step === 'form') {
        setEmail(identifier.includes('@') ? identifier.trim() : '');
        setCode('');
        setStep('verify');
        setNotice('Log in 보안 코드를 요청하고 있어요...');
        const data = await request('/api/auth/login', { identifier: identifier.trim(), password });
        setEmail(data.email || (identifier.includes('@') ? identifier.trim() : ''));
        setNotice('Log in 보안 코드를 Email로 발송했습니다. 10분 안에 입력해 주세요.');
      } else {
        const data = await request('/api/auth/login/verify', { email, code });
        acceptSession(data);
      }
    } catch (err) {
      if (startingStep === 'form' && startingMode === mode) setStep('form');
      setError(err.message || '오류가 발생했습니다.');
      setNotice('');
    } finally { setBusy(false); }
  };

  const requestPasswordReset = async (e) => {
    e.preventDefault(); setBusy(true); setError(''); setNotice('');
    setRecoveryStep('verify'); setNotice('Reset Password 코드를 요청하고 있어요...');
    try {
      const data = await request('/api/auth/password/reset/request', {email:recoveryEmail.trim()});
      setNotice(data.message||'재Settings 코드를 Email로 발송했습니다.');
    } catch (err) {
      setRecoveryStep('request'); setNotice('');
      setError(err.message||'재Settings 코드를 요청하지 못했습니다.');
    } finally { setBusy(false); }
  };

  const confirmPasswordReset = async (e) => {
    e.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      const data = await request('/api/auth/password/reset/confirm', {email:recoveryEmail.trim(),code:recoveryCode,new_password:recoveryPassword});
      setRecoveryStep(''); setRecoveryCode(''); setRecoveryPassword(''); setPassword(''); setIdentifier(recoveryEmail.trim()); setMode('login'); setStep('form');
      setNotice((data.message||'Password를 변경했습니다.')+' New password로 Log in해 주세요.');
    } catch (err) { setError(err.message||'Password를 재Settings하지 못했습니다.'); }
    finally { setBusy(false); }
  };

  const switchMode = (nextMode) => {
    setMode(nextMode); setStep('form'); setRecoveryStep(''); setError(''); setNotice('');
    setAgeConfirmed(false);
  };
  const logout = async () => {
    if (!window.confirm('FITNOVA에서 Log out할까요? Save되지 않은 작성 내용은 사라질 수 있습니다.')) return;
    const pushToken = localStorage.getItem('fitnova_push_token');
    const sessionToken = localStorage.getItem(TOKEN_KEY);
    if (pushToken && sessionToken) {
      try { await fetch(API + '/api/push/devices/' + encodeURIComponent(pushToken), {method:'DELETE', headers:{Authorization:'Bearer '+sessionToken}}); } catch { /* The next login can re-associate the device token. */ }
      localStorage.removeItem('fitnova_push_token');
      localStorage.removeItem('fitnova_push_enabled');
    }
    localStorage.removeItem(TOKEN_KEY);
    setUser(null); setTab('feed'); setMode('login'); setStep('form');
    setPassword(''); setError(''); setNotice('안전하게 Log out했습니다.');
  };

  if (booting) return <main className="boot-screen"><div className="boot-logo boot-logo-f" aria-label="FITNOVA"><span>F</span></div><b>FIT<span>NOVA</span></b><div className="boot-track"><i/></div><small>Checking your session…</small></main>;
  if (user) return <DashboardErrorBoundary><Dashboard user={user} tab={tab} setTab={setTab} logout={logout} /></DashboardErrorBoundary>;

  return <main className="auth-screen">
    <div className="auth-glow auth-glow-one" aria-hidden="true" />
    <div className="auth-glow auth-glow-two" aria-hidden="true" />
    <header className="auth-app-header">
      <a className="auth-app-brand" href="#top" aria-label="FITNOVA Home">
        <span className="auth-app-mark"><Activity size={24} strokeWidth={2.5}/></span>
        <span>FIT<span>NOVA</span></span>
      </a>
    </header>
    <section className="auth-layout" id="top">
      <div className="auth-welcome">
        <h1>{mode==='register' ? <>Start today<br/><em>Let's move together.</em></> : <>It's great to have<br/><em>you back.</em></>}</h1>
        <p>{mode==='register' ? '운동을 기록하고, 친구와 연결하고\n매일의 변화를 쌓아 보세요.' : '당신의 Workout Log과 피트니스 커뮤니티가\n여기서 기다리고 있어요.'}</p>
        <div className="auth-benefits">
          <span><Activity size={16}/> Workout Log</span>
          <span><Users size={16}/> Grow Together</span>
          <span><Heart size={16}/> Stay Motivated</span>
        </div>
      </div>
      <section className="auth-card">
        <div className="card-head">
          <div className="mini-mark"><Activity size={20}/></div>
          <h2>{recoveryStep?'Reset Password':mode==='register'?(step==='verify'?'Verify Your Email':'Join FITNOVA'):'Welcome Back'}</h2>
          <p>{recoveryStep?(recoveryStep==='request'?'We'll send a password reset code to your email.':'Enter the code from your email and choose a new password.'):mode==='register'?(step==='verify'?'Enter the 6-digit code sent to your email.':'Create an account and start your fitness journey.'):'Sign in and pick up where you left off.'}</p>
        </div>
        {!recoveryStep&&<div className="tabs">
          <button type="button" className={mode==='login'?'active':''} onClick={()=>switchMode('login')}>Log in</button>
          <button type="button" className={mode==='register'?'active':''} onClick={()=>switchMode('register')}>Sign up</button>
        </div>}
        <form onSubmit={recoveryStep==='request'?requestPasswordReset:recoveryStep==='verify'?confirmPasswordReset:submit}>
          {recoveryStep&&<label>Email address<div className="input-wrap"><Mail size={17}/><input required type="email" value={recoveryEmail} onChange={e=>setRecoveryEmail(e.target.value)} placeholder="Email used for your account" autoComplete="email" readOnly={recoveryStep==='verify'}/></div></label>}
          {recoveryStep==='verify'&&<><label>6-digit reset code<div className="input-wrap code-wrap"><ShieldCheck size={17}/><input required inputMode="numeric" pattern="[0-9]{6}" maxLength="6" value={recoveryCode} onChange={e=>setRecoveryCode(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="Code from your email" className="code-input"/></div></label><label>New password<div className="input-wrap"><LockKeyhole size={17}/><input required minLength="10" maxLength="128" type="password" value={recoveryPassword} onChange={e=>setRecoveryPassword(e.target.value)} placeholder="New password 10자 이상" autoComplete="new-password"/></div></label></>}
          {!recoveryStep&&mode==='register'&&step==='form'&&<label>Name<div className="input-wrap"><UserRound size={17}/><input required minLength="1" maxLength="40" value={name} onChange={e=>setName(e.target.value)} placeholder="Name" autoComplete="name"/></div></label>}
          {!recoveryStep&&mode==='register'&&step==='form'&&<label>Username<div className="input-wrap"><UserRound size={17}/><input required minLength="3" maxLength="24" pattern="[A-Za-z0-9_]+" value={username} onChange={e=>setUsername(e.target.value)} placeholder="Username (영문·숫자·밑줄)" autoComplete="username"/></div></label>}
          {!recoveryStep&&mode==='register'&&step==='form'&&<label>Email<div className="input-wrap"><Mail size={17}/><input required type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email 주소" autoComplete="email"/></div></label>}
          {!recoveryStep&&mode==='login'&&step==='form'&&<label>Username 또는 Email<div className="input-wrap"><UserRound size={17}/><input required value={identifier} onChange={e=>setIdentifier(e.target.value)} placeholder="Username 또는 Email" autoComplete="username"/></div></label>}
          {!recoveryStep&&((mode==='register'||mode==='login')&&step==='verify')&&<><label>{mode==='register'?'인증 Email':'보안 코드 발송 Email'}<div className="input-wrap"><Mail size={17}/><input type="email" required value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email"/></div></label><label>6-digit verification code<div className="input-wrap code-wrap"><ShieldCheck size={17}/><input required inputMode="numeric" pattern="[0-9]{6}" maxLength="6" value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="Email 인증 코드" className="code-input"/></div></label></>}
          {!recoveryStep&&((mode==='register'&&step==='form')||(mode==='login'&&step==='form'))&&<label>Password<div className="input-wrap"><LockKeyhole size={17}/><input required minLength={mode==='register'?10:1} maxLength="128" type={show?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder={mode==='register'?'Password 10자 이상':'Password'} autoComplete={mode==='register'?'new-password':'current-password'}/><button type="button" className="icon-button" onClick={()=>setShow(!show)} aria-label="Password 표시">{show?<EyeOff size={17}/>:<Eye size={17}/>}</button></div>{mode==='register'&&<small className="hint">Use at least 10 characters, including letters and numbers.</small>}</label>}
          {!recoveryStep&&mode==='register'&&step==='form'&&<label className="age-confirmation"><input type="checkbox" required checked={ageConfirmed} onChange={e=>setAgeConfirmed(e.target.checked)} /><span><strong>I confirm that I am at least 14 years old.</strong><small>I meet FITNOVA's minimum age requirement.</small></span></label>}
          {error&&<div className="alert error">{error}</div>}
          {notice&&<div className="alert success"><CheckCircle2 size={16}/>{notice}</div>}
          <button className="primary" disabled={busy}>{busy?'Please wait…':recoveryStep==='request'?'Send reset code':recoveryStep==='verify'?'Password 변경':mode==='register'?(step==='verify'?'Verify and get started':'Send verification code'):(step==='verify'?'보안 코드 확인 후 Log in':'Log in하기')}<ArrowRight size={17}/></button>
          {!recoveryStep&&step==='verify'&&<button type="button" className="text-button" onClick={()=>{setStep('form');setCode('');setError('');setNotice('');}}>Edit details</button>}
          {!recoveryStep&&mode==='login'&&step==='form'&&<button type="button" className="text-button" onClick={()=>{setRecoveryEmail(identifier.includes('@')?identifier.trim():'');setRecoveryCode('');setRecoveryPassword('');setRecoveryStep('request');setError('');setNotice('');}}>Password를 잊으셨나요?</button>}
          {recoveryStep==='verify'&&<button type="button" className="text-button" onClick={()=>{setRecoveryStep('request');setRecoveryCode('');setError('');setNotice('');}}>Resend code</button>}
          {recoveryStep&&<button type="button" className="text-button" onClick={()=>{setRecoveryStep('');setRecoveryCode('');setRecoveryPassword('');setError('');setNotice('');}}>Log in으로 돌아가기</button>}
        </form>
        <div className="secure-note"><ShieldCheck size={15}/><span>안전한 인증 · Password 보호</span></div>
      </section>
    </section>
    <nav className="auth-legal-links" aria-label="서비스 정책"><a href="/privacy">Privacy Policy</a><a href="/terms">Terms of Service</a><a href="/community-guidelines">Community Guidelines</a></nav>
  </main>;
}

class DashboardErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { failed: false, message: '' }; }
  static getDerivedStateFromError(error) { return { failed: true, message: String(error?.message || error || '알 수 없는 렌더링 오류') }; }
  componentDidCatch(error, info) {
    console.error('FITNOVA dashboard render failed:', error, info);
  }
  render() {
    if (this.state.failed) return <main role="alert" style={{position:'fixed',inset:0,zIndex:99999,boxSizing:'border-box',width:'100vw',minHeight:'100dvh',overflowY:'auto',display:'flex',alignItems:'center',justifyContent:'center',padding:'24px',background:'#080a08',color:'#f4f7f2',fontFamily:'system-ui,sans-serif'}}>
      <section style={{boxSizing:'border-box',width:'min(100%,560px)',padding:'28px',border:'1px solid #303a2c',borderRadius:'20px',background:'#111610',textAlign:'center'}}>
        <div style={{width:'48px',height:'48px',margin:'0 auto 18px',display:'grid',placeItems:'center',borderRadius:'14px',background:'#25351b',color:'#b7f34a'}}><Activity size={25}/></div>
        <h2 style={{margin:'0 0 12px',fontSize:'22px',lineHeight:1.4}}>FITNOVA ran into a problem</h2>
        <p style={{margin:'0 0 16px',color:'#b8c0b2',lineHeight:1.7}}>We couldn't display this screen. Please review the error details.</p>
        <pre style={{boxSizing:'border-box',whiteSpace:'pre-wrap',overflowWrap:'anywhere',textAlign:'left',padding:'12px',borderRadius:'10px',background:'#090c08',color:'#d4e5c7',fontSize:'12px',lineHeight:1.5}}>{this.state.message}</pre>
        <button type="button" style={{width:'100%',minHeight:'46px',marginTop:'12px',border:0,borderRadius:'12px',background:'#b7f34a',color:'#11160b',fontWeight:700,cursor:'pointer'}} onClick={() => window.location.reload()}>Reload screen</button>
      </section>
    </main>;
    return this.props.children;
  }
}

function Dashboard({ user, tab, setTab, logout }) {
  const [posts, setPosts] = useState(() => readHomePostsCache(user.username));
  const [feedLoading, setFeedLoading] = useState(false);
  const [hasMorePosts, setHasMorePosts] = useState(false);
  const postsOffset = useRef(posts.length);
  const postsRequestId = useRef(0);
  const settingsRequestId = useRef(0);
  const pendingLikes = useRef(new Set());
  const pendingSaves = useRef(new Set());
  const pendingFollows = useRef(new Set());
  const pendingComments = useRef(new Set());
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [profileData, setProfileData] = useState(null);
  const [relationshipList, setRelationshipList] = useState({open:false,type:'followers',username:'',users:[],loading:false});
  const [ownPosts, setOwnPosts] = useState([]);
  const [workoutRecords, setWorkoutRecords] = useState([]);
  const [savedPosts, setSavedPosts] = useState([]);
  const [savedPostIds, setSavedPostIds] = useState(new Set());
  const [accountSettings, setAccountSettings] = useState({private_account:false,allow_messages_from:'everyone',show_activity:true,show_workout_details:true,notify_messages:true,notify_comments:true,notify_likes:true,notify_follows:true});
  const [safetyLists, setSafetyLists] = useState({blocked_users:[], muted_users:[]});
  const [safetyListsBusy, setSafetyListsBusy] = useState(false);
  const [accountEmail, setAccountEmail] = useState(user.email || '');
  const [settingsEmailInput, setSettingsEmailInput] = useState(user.email || '');
  const [settingsEmailCode, setSettingsEmailCode] = useState('');
  const [settingsPassword, setSettingsPassword] = useState('');
  const [settingsPasswordCode, setSettingsPasswordCode] = useState('');
  const [settingsEmailCodeSent, setSettingsEmailCodeSent] = useState(false);
  const [settingsPasswordCodeSent, setSettingsPasswordCodeSent] = useState(false);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [messageThreads, setMessageThreads] = useState(() => { try { const raw = localStorage.getItem('fitnova_message_threads:' + (user?.username || '')); const parsed = raw ? JSON.parse(raw) : []; return Array.isArray(parsed) ? parsed : []; } catch { return []; } });
  const [activeChat, setActiveChat] = useState('');
  const activeChatRef = useRef('');
  const [chatMessages, setChatMessages] = useState([]);
  const chatMessagesRef = useRef(null);
  const [messageDraft, setMessageDraft] = useState('');
  const [messageBusy, setMessageBusy] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(() => localStorage.getItem('fitnova_push_enabled') === 'true');
  const [draft, setDraft] = useState('');
  const [commentDrafts, setCommentDrafts] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState({users:[],posts:[],hashtags:[]});
  const [searchBusy, setSearchBusy] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const tabHistoryRef = useRef([]);
  const previousTabRef = useRef(tab);
  const ignoreNextTabHistoryRef = useRef(false);
  const [postFormOpen, setPostFormOpen] = useState(false);
  const [postTitle, setPostTitle] = useState('');
  const [postContent, setPostContent] = useState('');
  const [postHashtags, setPostHashtags] = useState('');
  const [postWeight, setPostWeight] = useState('');
  const [postSets, setPostSets] = useState('');
  const [postExercise, setPostExercise] = useState('');
  const [postReps, setPostReps] = useState('');
  const [postDuration, setPostDuration] = useState('');
  const [postNotes, setPostNotes] = useState('');
  const [postMedia, setPostMedia] = useState(null);
  const [postMediaFiles, setPostMediaFiles] = useState([]);
  const [postMediaName, setPostMediaName] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const nav = [
    { id: 'home', label: '홈', icon: Home },
    { id: 'analysis', label: '운동 분석', icon: TrendingUp },
    { id: 'steps', label: '만보기', icon: Footprints },
    { id: 'feed', label: '피드', icon: Compass },
    { id: 'create', label: '작성', icon: Plus },
    { id: 'messages', label: 'Messages', icon: MessageCircle },
    { id: 'profile', label: '프로필', icon: UserRound },
    ...(user.is_master ? [{ id: 'moderation', label: 'Report Center', icon: ClipboardList }] : [])
  ];
  // Keep the create action in the exact middle slot on mobile; moderation remains desktop-only.
  const mobileNav = ['home', 'feed', 'steps', 'create', 'messages', 'analysis', 'profile']
    .map(id => nav.find(item => item.id === id)).filter(Boolean);
  const openComposer = () => { setError(''); setNotice(''); setPostFormOpen(true); };
  const handleNav = (id) => {
    if (id === 'create') { openComposer(); return; }
    if (id === 'profile') setSelectedProfile(null);
    setTab(id);
  };
  const loadPosts = async (append = false) => {
    const requestId = ++postsRequestId.current;
    const offset = append ? postsOffset.current : 0;
    if (!append) {
      postsOffset.current = 0;
      setHasMorePosts(false);
    }
    setFeedLoading(true);
    try {
      const query = new URLSearchParams({ limit: '15', offset: String(offset) });
      const data = await api('/api/posts?' + query.toString());
      if (requestId === postsRequestId.current) {
        const incoming = Array.isArray(data.posts) ? data.posts : [];
        setPosts(items => {
          const next = append ? [...items, ...incoming] : incoming;
          writeHomePostsCache(user.username, next);
          return next;
        });
        postsOffset.current = offset + incoming.length;
        setHasMorePosts(incoming.length === 15);
        setError('');
      }
    } catch (e) {
      if (requestId === postsRequestId.current) setError(e.message || 'Post을 불러오지 못했습니다.');
    } finally {
      if (requestId === postsRequestId.current) setFeedLoading(false);
    }
  };
  const openProfile = (username) => { setRelationshipList(v=>({...v,open:false})); setSelectedProfile(username); setProfileData(null); setTab('profile'); setError(''); };
  const openRelationshipList = async (type, username) => {
    const cacheKey = 'fitnova_relationships:' + username + ':' + type;
    let cachedUsers = [];
    try { const raw = localStorage.getItem(cacheKey); const parsed = raw ? JSON.parse(raw) : []; if (Array.isArray(parsed)) cachedUsers = parsed; } catch {}
    setRelationshipList({open:true,type,username,users:cachedUsers,loading:cachedUsers.length===0});
    try {
      const data = await api('/api/users/' + encodeURIComponent(username) + '/relationships?type=' + type);
      const users = Array.isArray(data.users) ? data.users : [];
      try { localStorage.setItem(cacheKey, JSON.stringify(users)); } catch {}
      setRelationshipList({open:true,type,username,users,loading:false});
    } catch (e) {
      setRelationshipList({open:true,type,username,users:cachedUsers,loading:false,error:cachedUsers.length ? '' : (e.message||'목록을 불러오지 못했습니다.')});
    }
  };
  const loadProfile = async (username = selectedProfile || user.username) => {
    try { const data = await api('/api/users/' + encodeURIComponent(username)); setProfileData(data.profile); }
    catch (e) { setError(e.message || '프로필을 불러오지 못했습니다.'); }
  };
  const loadOwnPosts = async (username=user.username) => { try { const d=await api('/api/users/'+encodeURIComponent(username)+'/posts'); setOwnPosts(d.posts||[]); } catch(e){setError(e.message||'Post을 불러오지 못했습니다.');} };
  const loadWorkoutRecords = async () => { try { const d=await api('/api/workout-records'); setWorkoutRecords(d.records||[]); } catch(e) { setError(e.message||'Workout Log을 불러오지 못했습니다.'); } };
  const saveWorkoutRecord = async (payload) => { const d=await api('/api/workout-records',{method:'POST',body:JSON.stringify(payload)}); setWorkoutRecords(items=>[d.record,...items]); return d.record; };
  const loadSavedPosts = async () => { try { const d=await api('/api/saved-posts'); setSavedPosts(d.posts||[]); setSavedPostIds(new Set((d.posts||[]).map(p=>p.id))); } catch(e){setError(e.message||'Saved Posts을 불러오지 못했습니다.');} };
  const loadSettings = async () => { try { const d=await api('/api/account/settings'); setAccountSettings(d.settings); setAccountEmail(d.email||user.email); setSettingsEmailInput(d.email||user.email); } catch(e){setError(e.message||'Settings을 불러오지 못했습니다.');} };
  const loadSafetyLists = async () => { setSafetyListsBusy(true); try { const d=await api('/api/account/safety'); setSafetyLists({blocked_users:Array.isArray(d.blocked_users)?d.blocked_users:[],muted_users:Array.isArray(d.muted_users)?d.muted_users:[]}); } catch(e) { setError(e.message||'Block 및 숨김 목록을 불러오지 못했습니다.'); } finally { setSafetyListsBusy(false); } };
  const saveSettings = async (next=accountSettings) => {
    const requestId = ++settingsRequestId.current;
    const previous = accountSettings;
    setAccountSettings(next); setError(''); setNotice('Settings을 Save하는 중…');
    try {
      const d = await api('/api/account/settings', {method:'PATCH', body:JSON.stringify(next)});
      if (requestId === settingsRequestId.current) { setAccountSettings(d.settings); setNotice('Settings을 Save했습니다.'); }
    } catch(e) {
      if (requestId === settingsRequestId.current) { setAccountSettings(previous); setError((e.message||'Settings을 Save하지 못했습니다.')+' Settings 변경이 Save되지 않아 이전 값으로 되돌렸습니다.'); setNotice(''); }
    }
  };
  const toggleSavePost = async (id) => {
    if (pendingSaves.current.has(id)) return;
    pendingSaves.current.add(id);
    const wasSaved = savedPostIds.has(id), nextSaved = !wasSaved;
    const post = posts.find(x=>x.id===id)||ownPosts.find(x=>x.id===id)||savedPosts.find(x=>x.id===id);
    setSavedPostIds(prev=>{const n=new Set(prev);if(nextSaved)n.add(id);else n.delete(id);return n;});
    if(nextSaved && post) setSavedPosts(prev=>[post,...prev.filter(x=>x.id!==id)]);
    if(!nextSaved) setSavedPosts(prev=>prev.filter(x=>x.id!==id));
    try {
      const d=await api('/api/posts/'+id+'/save',{method:'POST'});
      setSavedPostIds(prev=>{const n=new Set(prev);if(d.saved)n.add(id);else n.delete(id);return n;});
      if(d.saved && post) setSavedPosts(prev=>[post,...prev.filter(x=>x.id!==id)]);
      if(!d.saved) setSavedPosts(prev=>prev.filter(x=>x.id!==id));
    } catch(e) {
      setSavedPostIds(prev=>{const n=new Set(prev);if(wasSaved)n.add(id);else n.delete(id);return n;});
      if(wasSaved && post) setSavedPosts(prev=>[post,...prev.filter(x=>x.id!==id)]);
      if(!wasSaved) setSavedPosts(prev=>prev.filter(x=>x.id!==id));
      setError(e.message||'Post을 Save하지 못했습니다.');
    } finally { pendingSaves.current.delete(id); }
  };
  const requestSettingsCode = async (kind) => {
    setSettingsBusy(true); setError(''); setNotice('');
    const wasSent = kind === 'password' ? settingsPasswordCodeSent : settingsEmailCodeSent;
    if (kind === 'password') setSettingsPasswordCodeSent(true); else setSettingsEmailCodeSent(true);
    setNotice('보안 코드를 요청하고 있어요...');
    try {
      if(kind==='password'){await api('/api/account/password/request-code',{method:'POST'});setNotice('현재 Email로 Password 변경 보안 코드를 보냈습니다.');}
      else {await api('/api/account/email/request-code',{method:'POST',body:JSON.stringify({email:settingsEmailInput})});setNotice('새 Email로 인증 코드를 보냈습니다.');}
    } catch(e){
      if (kind === 'password') setSettingsPasswordCodeSent(wasSent); else setSettingsEmailCodeSent(wasSent);
      setNotice(''); setError(e.message||'보안 코드를 보내지 못했습니다.');
    } finally {setSettingsBusy(false);}
  };
  const confirmSettingsPassword = async (e) => { e.preventDefault();setSettingsBusy(true);setError('');try{await api('/api/account/password/confirm',{method:'POST',body:JSON.stringify({code:settingsPasswordCode,new_password:settingsPassword})});setSettingsPassword('');setSettingsPasswordCode('');setSettingsPasswordCodeSent(false);setNotice('Password를 변경했습니다.');}catch(e){setError(e.message||'Password를 변경하지 못했습니다.');}finally{setSettingsBusy(false);} };
  const confirmSettingsEmail = async (e) => { e.preventDefault();setSettingsBusy(true);setError('');try{const d=await api('/api/account/email/confirm',{method:'POST',body:JSON.stringify({email:settingsEmailInput,code:settingsEmailCode})});setAccountEmail(d.email);setSettingsEmailCode('');setSettingsEmailCodeSent(false);setNotice('Email을 변경했습니다.');}catch(e){setError(e.message||'Email을 변경하지 못했습니다.');}finally{setSettingsBusy(false);} };
  const deleteAccount = async () => { if(!window.confirm('정말 회원탈퇴를 신청할까요? Account은 즉시 비활성화되고, 30일 후 영구 삭제됩니다.'))return;setSettingsBusy(true);setError('');setNotice('');try{const d=await api('/api/account',{method:'DELETE'});localStorage.removeItem(TOKEN_KEY);setUser(null);setTab('feed');setMode('login');setStep('form');setPassword('');setNotice(d.message||'회원탈퇴가 접수되었습니다. Account은 비활성화되었으며 30일 후 영구 삭제됩니다.');}catch(e){setError((e.message||'회원탈퇴를 처리하지 못했습니다.')+' Account 상태는 변경되지 않았습니다.');}finally{setSettingsBusy(false);} };
  const loadThreads = async () => { try { const data = await api('/api/messages'); const threads = Array.isArray(data.threads) ? data.threads : []; setMessageThreads(threads); try { localStorage.setItem('fitnova_message_threads:' + (user?.username || ''), JSON.stringify(threads)); } catch {} } catch (e) { setError(e.message || 'Messages를 불러오지 못했습니다.'); } };
  const enablePushNotifications = async ({ startup = false, requestPermission = true } = {}) => {
    if (!Capacitor.isNativePlatform()) { setError('푸시 Notifications은 FITNOVA 안드로이드 앱에서 Settings할 수 있습니다.'); return; }
    setPushBusy(true); setError('');
    try {
      let permission = await PushNotifications.checkPermissions();
      if (permission.receive !== 'granted' && requestPermission) {
        permission = await PushNotifications.requestPermissions();
        if (startup) localStorage.setItem('fitnova_notification_prompted', 'true');
      }
      if (permission.receive !== 'granted') {
        setPushEnabled(false);
        localStorage.removeItem('fitnova_push_enabled');
        if (!startup) setError('휴대폰 Notifications 권한을 허용해 주세요. Android Settings에서 FITNOVA Notifications을 켤 수 있습니다.');
        return;
      }
      if (startup) localStorage.setItem('fitnova_notification_prompted', 'true');
      await PushNotifications.createChannel({id:'fitnova_messages',name:'FITNOVA Messages',description:'새 다이렉트 Messages Notifications',importance:5,visibility:1});
      await PushNotifications.addListener('registration', async token => {
        try { await api('/api/push/devices', {method:'POST', body:JSON.stringify({token:token.value, platform:'android'})}); localStorage.setItem('fitnova_push_token', token.value); setPushEnabled(true); localStorage.setItem('fitnova_push_enabled','true'); }
        catch (err) { setError(err.message||'Notifications 기기를 등록하지 못했습니다.'); }
      });
      await PushNotifications.addListener('registrationError', err => {
        const message = err?.error || '푸시 Notifications 등록에 실패했습니다.';
        if (startup) setNotice('Notifications 등록에 실패했습니다. Settings에서 Try again할 수 있어요.');
        else setError(message);
      });
      await PushNotifications.addListener('pushNotificationReceived', notification => {
        loadThreads();
        const sender = notification?.data?.username;
        if (notification?.data?.kind === 'message' && accountSettings.notify_messages !== false && sender && activeChatRef.current !== sender) {
          LocalNotifications.schedule({notifications:[{id:Date.now()%2147483647,title:notification?.title||'새 Messages',body:notification?.body||'새 Messages가 도착했습니다.',channelId:'fitnova_messages',extra:notification?.data||{}}]}).catch(()=>{});
        }
      });
      await LocalNotifications.addListener('localNotificationActionPerformed', action => {
        const username = action?.notification?.extra?.username;
        if (username) { setActiveChat(username); setTab('messages'); }
      });
      await PushNotifications.addListener('pushNotificationActionPerformed', action => {
        const username = action?.notification?.data?.username;
        if (username) { setActiveChat(username); setTab('messages'); }
      });
      await PushNotifications.register();
      // Registration runs quietly; do not interrupt the user with a success toast.
    } catch (err) {
      if (startup) setNotice('Notifications을 Settings하지 못했습니다. Settings에서 Try again할 수 있어요.');
      else setError(err.message||'푸시 Notifications을 Settings하지 못했습니다.');
    }
    finally { setPushBusy(false); }
  };
  const runSearch = async (e) => {
    if (e) e.preventDefault();
    const q = searchQuery.trim();
    if (!q) { setSearchResults({users:[],posts:[],hashtags:[]}); return; }
    setSearchBusy(true); setError('');
    try { const data = await api('/api/search?q=' + encodeURIComponent(q)); setSearchResults({users:data.users||[],posts:data.posts||[],hashtags:data.hashtags||[]}); }
    catch (err) { setError(err.message||'Search에 실패했습니다.'); }
    finally { setSearchBusy(false); }
  };
  const loadNotifications = async (markRead = false) => {
    try {
      const data = await api('/api/notifications');
      const cutoff = Date.now() - 60 * 60 * 1000;
      const fresh = (data.notifications || []).filter(item => {
        const created = Date.parse(item.created_at || '');
        return Number.isFinite(created) && created >= cutoff;
      });
      setNotifications(fresh);
      setUnreadCount(fresh.filter(item => !item.read).length);
      if (markRead && fresh.some(item => !item.read)) {
        await api('/api/notifications/read',{method:'POST'});
        setNotifications(items=>items.map(item=>({...item,read:true}))); setUnreadCount(0);
      }
    } catch (err) { setError(err.message||'Notifications을 불러오지 못했습니다.'); }
  };
  const reportTarget = async (target_type, target_id) => {
    const reason = window.prompt('신고 사유를 입력해 주세요. (스팸, 괴롭힘, 부적절한 콘텐츠 등)');
    if (!reason || !reason.trim()) return;
    try { await api('/api/reports',{method:'POST',body:JSON.stringify({target_type,target_id:String(target_id),reason:reason.trim()})}); setNotice('신고가 접수되었습니다. 검토하겠습니다.'); setError(''); }
    catch (err) { setError(err.message||'신고를 접수하지 못했습니다.'); }
  };
  const toggleSafetyAction = async (username, action) => {
    try {
      const result = await api('/api/users/'+encodeURIComponent(username)+'/'+action,{method:'POST'});
      if (action==='block') setNotice(result.blocked ? '@'+username+' Account을 Block했습니다.' : '@'+username+' Account Block을 해제했습니다.');
      else setNotice(result.muted ? '@'+username+' Post을 숨겼습니다.' : '@'+username+' Post 숨김을 해제했습니다.');
      setError('');
      if (action==='block' && result.blocked && activeChat===username) { setActiveChat(''); setChatMessages([]); }
      if (tab==='feed'||tab==='home') loadPosts();
      if (tab==='settings') await loadSafetyLists();
    } catch(err) { setError(err.message||'Account Settings을 변경하지 못했습니다.'); }
  };
  const loadConversation = async (username) => { activeChatRef.current = username; setActiveChat(username); try { const data = await api('/api/messages/' + encodeURIComponent(username)); if (username === activeChatRef.current) setChatMessages(data.messages || []); } catch (e) { if (username === activeChatRef.current) setError(e.message || '대화 내용을 불러오지 못했습니다.'); } };
  const toggleFollow = async () => {
    if (!profileData || profileData.is_me) return;
    const target = profileData.username;
    if (pendingFollows.current.has(target)) return;
    pendingFollows.current.add(target);
    const before = profileData, nextFollowing = !profileData.following_by_me;
    setProfileData(prev=>prev?({...prev,following_by_me:nextFollowing,is_mutual:nextFollowing&&prev.followed_by_me,follower_count:Math.max(0,(prev.follower_count||0)+(nextFollowing?1:-1))}):prev);
    setNotice(nextFollowing?'팔로우했어요.':'팔로우를 취소했어요.'); setError('');
    try {
      const data = await api('/api/users/' + encodeURIComponent(target) + '/follow', { method: 'POST' });
      setProfileData(data.profile); setNotice(data.following ? '팔로우했습니다.' : '언팔로우했습니다.');
    } catch (e) { setProfileData(before); setNotice(''); setError(e.message || '팔로우를 변경하지 못했습니다.'); }
    finally { pendingFollows.current.delete(target); }
  };
  const sendMessage = async (e) => {
    e.preventDefault();
    const content = messageDraft.trim();
    const recipient = activeChat;
    if (!content || !recipient || messageBusy) return;
    setMessageBusy(true); setError(''); setMessageDraft('');
    const optimisticId = -Date.now();
    const optimisticMessage = {id:optimisticId,sender_username:user.username,recipient_username:recipient,content,created_at:new Date().toISOString(),pending:true};
    setChatMessages(items => [...items, optimisticMessage]);
    const previousThread = messageThreads.find(item=>item.username===recipient);
    setMessageThreads(items => {
      const thread = {username:recipient,...optimisticMessage};
      return [thread,...items.filter(item=>item.username!==recipient)];
    });
    try {
      const data = await api('/api/messages/' + encodeURIComponent(recipient), { method: 'POST', body: JSON.stringify({ content }) });
      setChatMessages(items => items.map(item=>item.id===optimisticId?data.message:item));
      setMessageThreads(items => {
        const thread = {...data.message,username:recipient};
        return [thread,...items.filter(item=>item.username!==recipient)];
      });
    } catch (e) {
      setChatMessages(items => items.filter(item=>item.id!==optimisticId));
      setMessageThreads(items => {
        const remaining = items.filter(item=>item.username!==recipient && item.id!==optimisticId);
        return previousThread ? [previousThread,...remaining] : remaining;
      });
      setMessageDraft(content);
      setError(e.message || 'Messages를 보내지 못했습니다.');
    } finally { setMessageBusy(false); }
  };
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !user?.username) return;
    const installKey = 'fitnova_install_notifications_cleared_v1';
    if (localStorage.getItem(installKey) === 'true') return;
    let active = true;
    (async () => {
      try {
        await api('/api/notifications', { method: 'DELETE' });
        if (!active) return;
        setNotifications([]);
        setUnreadCount(0);
        localStorage.setItem(installKey, 'true');
      } catch {}
    })();
    return () => { active = false; };
  }, [user?.username]);
  useEffect(() => {
    const timer = window.setInterval(() => {
      const cutoff = Date.now() - 60 * 60 * 1000;
      setNotifications(items => items.filter(item => {
        const created = Date.parse(item.created_at || '');
        return Number.isFinite(created) && created >= cutoff;
      }));
      setUnreadCount(count => Math.min(count, notifications.filter(item => !item.read && Date.parse(item.created_at || '') >= cutoff).length));
    }, 60000);
    return () => window.clearInterval(timer);
  }, [notifications]);
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const timer = window.setTimeout(() => {
      const alreadyPrompted = localStorage.getItem('fitnova_notification_prompted') === 'true';
      if (!alreadyPrompted) localStorage.setItem('fitnova_notification_prompted', 'true');
      enablePushNotifications({ startup: true, requestPermission: !alreadyPrompted });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [user.username]);
  useEffect(() => { if (tab === 'feed' || tab === 'home') loadPosts(); if (tab === 'profile') {loadProfile(); loadOwnPosts(selectedProfile || user.username);} if (tab === 'analysis') loadWorkoutRecords(); if (tab === 'messages') loadThreads(); if(tab==='saved')loadSavedPosts(); if(tab==='settings'){loadSettings();loadSafetyLists();} }, [tab, selectedProfile]);
  useEffect(() => {
    if (tab !== 'home' || !posts.length) return;
    const videos = posts.filter(post => post.media_type === 'video' && post.id).slice(0, 2);
    let active = true;
    const warmVideoStarts = async () => {
      const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      if (connection?.saveData || ['slow-2g', '2g'].includes(connection?.effectiveType)) return;
      await Promise.all(videos.map(async post => {
        try {
          const mediaCacheKey = `${user.username}:${post.id}`;
          let url = cacheGet(playbackUrlCache, mediaCacheKey);
          if (!url) {
            const playback = await api('/api/posts/' + post.id + '/media/playback');
            url = API + playback.url;
            cacheSet(playbackUrlCache, mediaCacheKey, url, 120000, 12);
          }
          if (!active) return;
          const response = await fetch(url, { headers: { Range: 'bytes=0-65535' }, cache: 'force-cache' });
          if (response.ok) await response.arrayBuffer();
        } catch { /* A later visit to the video feed will retry media loading. */ }
      }));
    };
    const timer = window.setTimeout(() => { if (active) warmVideoStarts(); }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [tab, posts]);
  useEffect(() => {
    if (previousTabRef.current !== tab) {
      if (ignoreNextTabHistoryRef.current) {
        ignoreNextTabHistoryRef.current = false;
      } else {
        tabHistoryRef.current.push(previousTabRef.current);
        if (tabHistoryRef.current.length > 30) tabHistoryRef.current.shift();
      }
      previousTabRef.current = tab;
    }
  }, [tab]);

  useEffect(() => {
    let listener = null;
    let cancelled = false;
    const registerBackButton = async () => {
      try {
        const registeredListener = await CapacitorApp.addListener('backButton', () => {
          // Close the top-most dialog/overlay before navigating between screens.
          if (relationshipList.open) { setRelationshipList(v => ({ ...v, open: false })); return; }
          if (searchOpen) { setSearchOpen(false); return; }
          if (notificationsOpen) { setNotificationsOpen(false); return; }
          if (profileOpen) { setProfileOpen(false); return; }
          if (postFormOpen) { setPostFormOpen(false); return; }
          if (tab === 'messages' && activeChat) {
            activeChatRef.current='';
            setActiveChat('');
            setChatMessages([]);
            setError('');
            return;
          }
          if (settingsPasswordCodeSent || settingsEmailCodeSent) {
            setSettingsPasswordCodeSent(false);
            setSettingsEmailCodeSent(false);
            setSettingsPasswordCode('');
            setSettingsEmailCode('');
            setError('');
            return;
          }
          if (tab === 'profile' && selectedProfile && selectedProfile !== user?.username) {
            const previousTab = tabHistoryRef.current[tabHistoryRef.current.length - 1];
            if (previousTab && previousTab !== 'profile') {
              tabHistoryRef.current.pop();
              ignoreNextTabHistoryRef.current = true;
              setSelectedProfile(null);
              setProfileData(null);
              setTab(previousTab);
            } else {
              setSelectedProfile(null);
              setProfileData(null);
            }
            return;
          }
          const previousTab = tabHistoryRef.current.pop();
          if (previousTab) {
            ignoreNextTabHistoryRef.current = true;
            if (previousTab !== 'profile') setSelectedProfile(null);
            setTab(previousTab);
            setError('');
            return;
          }
          // If history is empty but we're not on a root tab, return to the feed.
          // Only let Android exit when the user is already at the root screen.
          if (tab !== 'feed' && tab !== 'home') {
            setSelectedProfile(null);
            setProfileData(null);
            setTab('feed');
            setError('');
            return;
          }
          CapacitorApp.exitApp();
        });
        if (cancelled) {
          await registeredListener.remove();
        } else {
          listener = registeredListener;
        }
      } catch (err) {
        // The native App plugin is only available in the Android app; ignore on web.
      }
    };
    registerBackButton();
    return () => {
      cancelled = true;
      if (listener) listener.remove();
    };
  }, [relationshipList.open, searchOpen, notificationsOpen, profileOpen, postFormOpen, settingsPasswordCodeSent, settingsEmailCodeSent, tab, activeChat, selectedProfile, user?.username]);

  useEffect(() => { loadSavedPosts(); }, []);
  useEffect(() => { activeChatRef.current = activeChat; if (tab === 'messages' && activeChat) loadConversation(activeChat); }, [tab, activeChat]);
  useEffect(() => {
    if (tab !== 'messages') return;
    let cancelled = false;
    let timer;
    const refreshMessages = async () => {
      if (!document.hidden) {
        const refreshes = [loadThreads()];
        if (activeChat) refreshes.push(loadConversation(activeChat));
        await Promise.allSettled(refreshes);
      }
      if (!cancelled) timer = window.setTimeout(refreshMessages, 1500);
    };
    timer = window.setTimeout(refreshMessages, 1500);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [tab, activeChat]);
  useEffect(() => { const panel=chatMessagesRef.current; if(panel) panel.scrollTop=panel.scrollHeight; }, [chatMessages, activeChat]);
  const resetPostForm = () => { postMediaFiles.forEach(item=>{if(item.previewUrl)URL.revokeObjectURL(item.previewUrl);}); if(postMedia?.previewUrl&&!postMediaFiles.some(item=>item.previewUrl===postMedia.previewUrl)) URL.revokeObjectURL(postMedia.previewUrl); setPostTitle(''); setPostContent(''); setPostHashtags(''); setPostWeight(''); setPostSets(''); setPostExercise(''); setPostReps(''); setPostDuration(''); setPostNotes(''); setPostMedia(null); setPostMediaFiles([]); setPostMediaName(''); setUploadProgress(0); };
  const chooseMedia = async (file, selectedFiles = null) => {
    setError(''); const files = Array.from(selectedFiles || (file ? [file] : [])); if (!files.length) return;
    const isImage=files[0].type.startsWith('image/'), isVideo=files[0].type.startsWith('video/');
    if (!isImage&&!isVideo) { setError('사진 또는 영상 파일만 선택할 수 있습니다.'); return; }
    if (files.some(item=>item.type.startsWith('image/')!==isImage || item.type.startsWith('video/')!==isVideo)) { setError('사진과 영상은 한 Post에 함께 올릴 수 없습니다.'); return; }
    if (isImage && files.length > 10) { setError('사진은 한 Post에 최대 10장까지 올릴 수 있습니다.'); return; }
    if (isVideo && files.length > 1) { setError('영상은 한 Post에 1개만 올릴 수 있습니다.'); return; }
    const limit=(isImage?5:40)*1024*1024; if (files.some(item=>item.size>limit)) { setError(isImage?'사진은 각각 5MB 이하로 선택해 주세요.':'영상은 40MB 이하로 선택해 주세요.'); return; }
    postMediaFiles.forEach(item=>{if(item.previewUrl)URL.revokeObjectURL(item.previewUrl);}); if(postMedia?.previewUrl&&!postMediaFiles.some(item=>item.previewUrl===postMedia.previewUrl))URL.revokeObjectURL(postMedia.previewUrl);
    const selected = files.map(item=>({type:isImage?'image':'video',file:item,previewUrl:URL.createObjectURL(item),durationSeconds:null}));
    if (isVideo) { try { const durationSeconds = await new Promise((resolve, reject) => { const probe = document.createElement('video'); probe.preload='metadata'; probe.onloadedmetadata=()=>resolve(probe.duration); probe.onerror=()=>reject(new Error('영상 정보를 읽을 수 없습니다. 다른 파일을 선택해 주세요.')); probe.src=selected[0].previewUrl; }); if (!Number.isFinite(durationSeconds)||durationSeconds<=0) throw new Error('영상 길이를 확인할 수 없습니다.'); if (durationSeconds>60) throw new Error('영상은 최대 1분(60초)까지 업로드할 수 있습니다.'); selected[0].durationSeconds=Math.ceil(durationSeconds); } catch(err) { selected.forEach(item=>URL.revokeObjectURL(item.previewUrl)); setError(err.message||'영상 정보를 읽지 못했습니다.'); return; } }
    setPostMediaFiles(selected); setPostMedia(selected[0]); setPostMediaName(isImage?('사진 '+selected.length+'장 선택됨'):files[0].name);
  };
  const createPost = async (e) => {
    e.preventDefault(); if(!postTitle.trim()||!postContent.trim()||!postMediaFiles.length){setError('제목, 내용, 사진 또는 영상을 모두 입력해 주세요.');return;}
    setBusy(true);setUploadProgress(0);setError('');setNotice('');
    const hashtags=postHashtags.split(/[\\s,]+/).map(x=>x.trim().replace(/^#/,'')).filter(Boolean).map(x=>'#'+x).slice(0,20);
    const mediaType=postMedia.type;
    try {
      const form=new FormData();
      form.append('title',postTitle.trim()); form.append('content',postContent.trim()); form.append('media_type',mediaType); postMediaFiles.forEach(item=>form.append('media',item.file,item.file.name)); form.append('hashtags',JSON.stringify(hashtags));
      if(postMedia.durationSeconds!==null) form.append('media_duration_seconds',String(postMedia.durationSeconds));
      if(postWeight!=='') form.append('weight',postWeight); if(postSets!=='') form.append('sets_count',postSets); if(postDuration!=='') form.append('duration_minutes',postDuration);
      if(postExercise.trim()) form.append('exercise_name',postExercise.trim()); if(postReps.trim()) form.append('reps',postReps.trim()); if(postNotes.trim()) form.append('workout_notes',postNotes.trim());
      await new Promise((resolve,reject)=>{
        const xhr=new XMLHttpRequest(); xhr.open('POST',API+'/api/posts/upload');
        const token=localStorage.getItem(TOKEN_KEY); if(token) xhr.setRequestHeader('Authorization','Bearer '+token);
        xhr.upload.onprogress=(event)=>{if(event.lengthComputable)setUploadProgress(Math.min(99,Math.round(event.loaded/event.total*100)));};
        xhr.onload=()=>{let data={};try{data=JSON.parse(xhr.responseText||'{}');}catch{} if(xhr.status>=200&&xhr.status<300)resolve(data);else reject(new Error(data.detail||'Post을 올리지 못했습니다. 잠시 후 Try again해 주세요.'));};
        xhr.onerror=()=>reject(new Error('네트워크 연결을 확인한 뒤 Try again해 주세요.')); xhr.onabort=()=>reject(new Error('업로드가 취소되었습니다.')); xhr.send(form);
      });
      setUploadProgress(100); resetPostForm();setPostFormOpen(false);await loadPosts();setNotice(mediaType==='image'?'사진 Post을 홈에 올렸습니다.':'영상 Post을 피드에 올렸습니다.');setTab(mediaType==='image'?'home':'feed');
    } catch(e){setError(e.message||'Post을 올리지 못했습니다.');} finally{setBusy(false);}
  };
  const toggleLike = async (id) => {
    if (pendingLikes.current.has(id)) return;
    pendingLikes.current.add(id);
    let previousLiked = false;
    const update = (items, liked) => items.map(p => { if(p.id!==id)return p; previousLiked=!!p.liked_by_me; return {...p,liked_by_me:liked,like_count:Math.max(0,(p.like_count||0)+(liked?(p.liked_by_me?0:1):(p.liked_by_me?-1:0)))}; });
    const current = posts.find(p=>p.id===id); if(!current){pendingLikes.current.delete(id);return;}
    previousLiked=!!current.liked_by_me; const nextLiked=!previousLiked;
    setPosts(items=>items.map(p=>p.id===id?{...p,liked_by_me:nextLiked,like_count:Math.max(0,(p.like_count||0)+(nextLiked?1:-1))}:p));
    setOwnPosts(items=>items.map(p=>p.id===id?{...p,liked_by_me:nextLiked,like_count:Math.max(0,(p.like_count||0)+(nextLiked?1:-1))}:p));
    setSavedPosts(items=>items.map(p=>p.id===id?{...p,liked_by_me:nextLiked,like_count:Math.max(0,(p.like_count||0)+(nextLiked?1:-1))}:p));
    try {
      const result=await api('/api/posts/'+id+'/like',{method:'POST'});
      const apply=items=>items.map(p=>p.id===id?{...p,liked_by_me:result.liked,like_count:Math.max(0,(p.like_count||0)+(result.liked===nextLiked?0:(result.liked?1:-1)))}:p);
      setPosts(items=>items.map(p=>p.id===id?{...p,liked_by_me:result.liked}:p));
      setOwnPosts(items=>items.map(p=>p.id===id?{...p,liked_by_me:result.liked}:p));
      setSavedPosts(items=>items.map(p=>p.id===id?{...p,liked_by_me:result.liked}:p));
    } catch(e) {
      setPosts(items=>items.map(p=>p.id===id?{...p,liked_by_me:previousLiked,like_count:Math.max(0,(p.like_count||0)+(nextLiked?-1:1))}:p));
      setOwnPosts(items=>items.map(p=>p.id===id?{...p,liked_by_me:previousLiked,like_count:Math.max(0,(p.like_count||0)+(nextLiked?-1:1))}:p));
      setSavedPosts(items=>items.map(p=>p.id===id?{...p,liked_by_me:previousLiked,like_count:Math.max(0,(p.like_count||0)+(nextLiked?-1:1))}:p));
      setError(e.message||'Like를 처리하지 못했습니다.');
    } finally { pendingLikes.current.delete(id); }
  };
  const toggleCommentLike = async (postId, commentId) => {
    const update = (items, liked, count) => items.map(post => post.id!==postId?post:{...post,comments:(post.comments||[]).map(comment=>String(comment.id)!==String(commentId)?comment:{...comment,liked_by_me:liked,like_count:count})});
    const all=[...posts,...ownPosts,...savedPosts];
    const comment=all.find(post=>post.id===postId)?.comments?.find(item=>String(item.id)===String(commentId));
    if(!comment||comment.pending||String(commentId).startsWith('pending-')) return;
    const before=!!comment.liked_by_me;
    const optimisticCount=Math.max(0,(comment.like_count||0)+(before?-1:1));
    const optimistic=(items)=>items.map(post=>post.id!==postId?post:{...post,comments:(post.comments||[]).map(item=>String(item.id)!==String(commentId)?item:{...item,liked_by_me:!before,like_count:optimisticCount})});
    setPosts(optimistic); setOwnPosts(optimistic); setSavedPosts(optimistic);
    try {
      const result=await api('/api/posts/'+postId+'/comments/'+commentId+'/like',{method:'POST'});
      const apply=(items)=>items.map(post=>post.id!==postId?post:{...post,comments:(post.comments||[]).map(item=>String(item.id)!==String(commentId)?item:{...item,liked_by_me:result.liked,like_count:result.like_count})});
      setPosts(apply); setOwnPosts(apply); setSavedPosts(apply);
    } catch(err) {
      const rollback=(items)=>items.map(post=>post.id!==postId?post:{...post,comments:(post.comments||[]).map(item=>String(item.id)!==String(commentId)?item:{...item,liked_by_me:before,like_count:comment.like_count||0})});
      setPosts(rollback); setOwnPosts(rollback); setSavedPosts(rollback); setError(err.message||'Comment Like를 처리하지 못했습니다.');
    }
  };
  const addComment = async (id) => {
    const content = (commentDrafts[id] || '').trim();
    if (!content || pendingComments.current.has(id)) return;
    pendingComments.current.add(id);
    const tempId = 'pending-'+Date.now();
    const optimistic = {id:tempId,author_username:user.username,content,created_at:new Date().toISOString(),pending:true};
    setPosts(items=>items.map(p=>p.id===id?{...p,comments:[...(p.comments||[]),optimistic]}:p));
    setOwnPosts(items=>items.map(p=>p.id===id?{...p,comments:[...(p.comments||[]),optimistic]}:p));
    setSavedPosts(items=>items.map(p=>p.id===id?{...p,comments:[...(p.comments||[]),optimistic]}:p));
    setCommentDrafts(items=>({...items,[id]:''})); setError('');
    try {
      const result=await api('/api/posts/'+id+'/comments',{method:'POST',body:JSON.stringify({content})});
      const replace=items=>items.map(p=>p.id===id?{...p,comments:(p.comments||[]).map(comment=>comment.id===tempId?result.comment:comment)}:p);
      setPosts(replace); setOwnPosts(replace); setSavedPosts(replace);
    } catch(e) {
      const remove=items=>items.map(p=>p.id===id?{...p,comments:(p.comments||[]).filter(comment=>comment.id!==tempId)}:p);
      setPosts(remove); setOwnPosts(remove); setSavedPosts(remove); setCommentDrafts(items=>({...items,[id]:content}));
      setError(e.message||'Comment을 등록하지 못했습니다.');
    } finally { pendingComments.current.delete(id); }
  };
  const deleteComment = async (postId, commentId) => {
    if (!window.confirm('이 Comment을 삭제할까요?')) return;
    const remove = items => items.map(post => post.id === postId ? {...post, comments:(post.comments||[]).filter(comment => String(comment.id) !== String(commentId))} : post);
    const snapshots = {posts, ownPosts, savedPosts};
    setPosts(remove); setOwnPosts(remove); setSavedPosts(remove);
    setError(''); setNotice('');
    try {
      await api('/api/posts/' + postId + '/comments/' + commentId, {method:'DELETE'});
      setNotice('Comment을 삭제했습니다.');
    } catch (e) {
      setPosts(snapshots.posts); setOwnPosts(snapshots.ownPosts); setSavedPosts(snapshots.savedPosts);
      setError(e.message || 'Comment을 삭제하지 못했습니다.');
    }
  };
  const removePost = async (id) => {
    if (!window.confirm('이 Post을 삭제할까요?')) return;
    try { await api('/api/posts/' + id, { method: 'DELETE' }); setPosts(items => items.filter(p => p.id !== id)); setNotice('Post을 삭제했습니다.'); }
    catch (e) { setError(e.message || 'Post을 삭제하지 못했습니다.'); }
  };
  const togglePostPin = async (post) => {
    try { const result = await api('/api/posts/'+post.id+'/pin',{method:'POST'}); const update=items=>items.map(item=>item.id===post.id?{...item,pinned:result.pinned}:item); setPosts(update); setOwnPosts(update); setSavedPosts(update); setNotice(result.pinned?'Post을 피드 상단에 Pin했습니다.':'Post Pin을 해제했습니다.'); if(tab==='home'||tab==='feed') loadPosts(); }
    catch(e){setError(e.message||'Post Pin 상태를 변경하지 못했습니다.');}
  };
  const toggleSuspension = async (username) => {
    if (!window.confirm('@'+username+' Account의 이용을 정지하거나 해제할까요?')) return;
    try { const result=await api('/api/users/'+encodeURIComponent(username)+'/suspend',{method:'POST'}); setNotice(result.suspended?'Account을 정지했습니다.':'Account 정지를 해제했습니다.'); if(tab==='feed'||tab==='home')loadPosts(); }
    catch(e){setError(e.message||'Account 상태를 변경하지 못했습니다.');}
  };
  const prettyDate = (value) => { try { return new Date(value).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };
  return <main className={"app-shell "+(tab==="messages"&&activeChat?"chat-active":"")}>
    <div className="fitnova-entry-mark" aria-hidden="true"><span>F</span></div>
    <aside className="side-rail"><a className="brand" href="#feed"><span className="brand-icon"><Activity size={21}/></span><span className="rail-brand">FIT<span>NOVA</span></span></a><div className="rail-nav">{nav.map(item=><button key={item.id} className={item.id==='create'?'nav-create':tab===item.id?'selected':''} onClick={()=>handleNav(item.id)} aria-label={item.id==='create'?'Create a post':undefined}><item.icon size={20}/><span>{item.label}</span></button>)}</div><div className="rail-bottom"><div className="avatar">{user.username.slice(0,1).toUpperCase()}</div><button className="rail-logout" onClick={logout} aria-label="Log out"><LogOut size={18}/></button></div></aside>
    <section className="dashboard-main"><header className={"dash-top "+(tab==="messages"&&activeChat?"chat-top-hidden":"")}><div><div className="eyebrow"><Sparkles size={13}/> MOVE. CONNECT. EVOLVE.</div><h1>{tab==='feed'?'Grow Together하는 피드':tab==='home'?'Show up today 한 단계 성장해요':tab==='steps'?'This Week's Steps':tab==='analysis'?'Workout Analytics':tab==='messages'?'Messages':tab==='settings'?'Settings':tab==='saved'?'Saved Posts':tab==='moderation'?'Report Center':'My FITNOVA'}</h1><span className="top-tagline">Log your workout<br/>and grow together</span></div><a className="top-brand" href="#top" aria-label="FITNOVA Home" onClick={e=>{e.preventDefault();handleNav('home');window.scrollTo({top:0,behavior:'smooth'});}}>FITNOVA</a><div className="top-actions"><button className="icon-surface" aria-label="Search" title="Search" onClick={()=>{setSearchOpen(true);setNotificationsOpen(false);}}><Search size={19}/></button><button className="icon-surface notification-trigger" aria-label="Notifications" title="Notifications" onClick={()=>{setNotificationsOpen(!notificationsOpen);setSearchOpen(false);if(!notificationsOpen)loadNotifications(true);}}><Bell size={19}/>{unreadCount>0&&<i className="notification-dot">{unreadCount>9?'9+':unreadCount}</i>}</button><button className="user-chip" onClick={()=>setProfileOpen(!profileOpen)}><span className="avatar">{user.username.slice(0,1).toUpperCase()}</span><span><b>{user.username}</b><small>FITNOVA Member</small></span></button>{profileOpen&&<div className="profile-pop"><b>{user.username}</b><span>{user.email}</span><button onClick={logout}><LogOut size={15}/> Log out</button></div>}</div></header>
    <div className="page-transition" key={tab}>
    {error&&<div className="alert error feed-alert">{error}</div>}{notice&&<div className="alert success feed-alert">{notice}</div>}
    {tab==='moderation'&&user.is_master&&<ModerationPanel/>}
    {tab==='steps'&&<StepCounterPanel />}
    {tab==='analysis'&&<WorkoutAnalysisPanel records={workoutRecords} onSaveRecord={saveWorkoutRecord} onRefresh={loadWorkoutRecords} />}
    {tab==='feed'&&hasMorePosts&&<button className="load-more-posts" disabled={feedLoading} onClick={()=>loadPosts(true)}>{feedLoading?'Loading…':'Load more posts'}</button>}
    {tab==='feed'&&<section className="feed-layout"><div className="feed-heading"><div><span className="eyebrow">FITNOVA VIDEO FEED</span><h2>운동의 순간을 영상으로.</h2><p>영상 Post만 모아보는 피드입니다.</p></div><button className="refresh-button" onClick={()=>loadPosts()}><Activity size={16}/> 새로고침</button></div><div className="feed-list">{feedLoading&&posts.length===0?<div className="feed-loading"><span className="search-spinner"/><b>Post을 Loading…</b></div>:posts.filter(p=>p.media_type==='video').length===0?<div className="empty-feed"><div className="empty-art"><Video size={34}/></div><h3>아직 영상 Post이 없어요</h3><p>옆의 + 버튼으로 운동 영상을 공유해 보세요.</p><button className="primary compact" onClick={()=>setPostFormOpen(true)}><Plus size={16}/> 영상 Create a post</button></div>:posts.filter(p=>p.media_type==='video').map((post,index)=><PostCard key={post.id} post={post} user={user} prettyDate={prettyDate} savedPostIds={savedPostIds} toggleSavePost={toggleSavePost} removePost={removePost} toggleLike={toggleLike} commentDrafts={commentDrafts} setCommentDrafts={setCommentDrafts} addComment={addComment} deleteComment={deleteComment} toggleCommentLike={toggleCommentLike} togglePostPin={togglePostPin} toggleSuspension={toggleSuspension} toggleSafetyAction={toggleSafetyAction} openProfile={openProfile} reportPost={reportTarget} priority={index<2}/>)}</div></section>}
    {tab==='home'&&<section className="feed-layout home-feed-layout">
      <div className="home-left">
      <section className="home-hero" aria-label="오늘의 한마디">
        <h2>Today's effort<em>내일의 나를 만든다.</em></h2>
        <p>오늘의 운동, 기록으로 남겨요.</p>
      </section>
      <div className="home-quick" role="group" aria-label="바로가기">
        <button type="button" onClick={()=>setTab('analysis')}><span><TrendingUp size={20}/></span>Workout Log</button>
        <button type="button" onClick={openComposer}><span><Plus size={20}/></span>Post</button>
        <button type="button" onClick={()=>setTab('steps')}><span><Footprints size={20}/></span>만보기</button>
        <button type="button" onClick={()=>setTab('messages')}><span><MessageCircle size={20}/></span>Messages</button>
      </div>
      </div>
      <div className="home-section-head"><h3>최근 Post</h3><button className="refresh-button" onClick={()=>loadPosts()} aria-label="새로고침"><RefreshCw size={15}/> 새로고침</button></div>
      <div className="feed-list photo-feed">{feedLoading&&posts.length===0?<div className="feed-loading"><span className="search-spinner"/><b>Post을 Loading…</b></div>:posts.filter(p=>p.media_type==='image').length===0?<div className="empty-feed"><div className="empty-art"><ImageIcon size={34}/></div><h3>아직 사진 Post이 없어요</h3><p>Workout Log 사진이나 오늘의 변화를 공유해 보세요.</p><button className="primary compact" onClick={()=>setPostFormOpen(true)}><Plus size={16}/> 사진 Create a post</button></div>:posts.filter(p=>p.media_type==='image').map((post,index)=><PostCard key={post.id} post={post} user={user} prettyDate={prettyDate} savedPostIds={savedPostIds} toggleSavePost={toggleSavePost} removePost={removePost} toggleLike={toggleLike} commentDrafts={commentDrafts} setCommentDrafts={setCommentDrafts} addComment={addComment} deleteComment={deleteComment} toggleCommentLike={toggleCommentLike} togglePostPin={togglePostPin} toggleSuspension={toggleSuspension} toggleSafetyAction={toggleSafetyAction} openProfile={openProfile} priority={index<2}/>)}</div></section>}
    {tab==='home'&&hasMorePosts&&<button className="load-more-posts" disabled={feedLoading} onClick={()=>loadPosts(true)}>{feedLoading?'Loading…':'Load more posts'}</button>}
    {tab==='saved'&&<section className="feed-layout"><div className="feed-heading"><div><span className="eyebrow">YOUR COLLECTION</span><h2>Saved Posts</h2><p>나중에 다시 보고 싶은 Workout Log을 모아뒀어요.</p></div><button className="refresh-button" onClick={loadSavedPosts}><Activity size={16}/> 새로고침</button></div><div className="feed-list">{savedPosts.length===0?<div className="empty-feed"><Bookmark size={30}/><h3>아직 Saved Posts이 없어요</h3><p>Post의 책갈피 버튼을 눌러 Save해 보세요.</p></div>:savedPosts.map(post=><PostCard key={post.id} post={post} user={user} prettyDate={prettyDate} savedPostIds={savedPostIds} toggleSavePost={toggleSavePost} removePost={removePost} toggleLike={toggleLike} commentDrafts={commentDrafts} setCommentDrafts={setCommentDrafts} addComment={addComment} deleteComment={deleteComment} toggleCommentLike={toggleCommentLike} togglePostPin={togglePostPin} toggleSuspension={toggleSuspension} toggleSafetyAction={toggleSafetyAction} openProfile={openProfile}/>)}</div></section>}
    {tab==='settings'&&<section className="settings-page"><div className="settings-heading"><span className="eyebrow">YOUR SPACE · SETTINGS</span><h2>Settings 및 개인정보</h2><p>FITNOVA 경험과 Account 정보를 원하는 방식으로 관리하세요.</p></div><div className="settings-account-banner"><div className="settings-account-avatar">{(user.name||user.username).slice(0,1).toUpperCase()}</div><div className="settings-account-copy"><span>Log in한 Account</span><b>{user.name||user.username}</b><small>@{user.username} · {accountEmail||user.email}</small></div><span className="settings-account-status"><CheckCircle2 size={15}/> 인증된 Account</span></div><div className="settings-grid"><section className="settings-card"><div className="settings-card-title"><ShieldCheck size={20}/><div><h3>개인정보 및 소통</h3><p>다른 회원에게 보이는 범위와 연락 방법을 정하세요.</p></div></div>{[['private_account','비공개 Account','프로필 공개 범위를 제한하는 Settings'],['show_activity','활동 정보 표시','프로필에 운동 활동 관련 정보를 표시'],['show_workout_details','운동 세부 정보 표시','Post에 작성한 운동 세부 정보를 표시']].map(([key,label,desc])=><label className="setting-toggle" key={key}><span><b>{label}</b><small>{desc}</small></span><input type="checkbox" checked={!!accountSettings[key]} onChange={e=>saveSettings({...accountSettings,[key]:e.target.checked})}/></label>)}<label className="setting-select"><span><b>Messages 수신 범위</b><small>팔로우하지 않은 Account의 Messages를 Block할 수 있어요.</small></span><select value={accountSettings.allow_messages_from} onChange={e=>saveSettings({...accountSettings,allow_messages_from:e.target.value})}><option value="everyone">모든 Account</option><option value="following">내가 팔로우한 Account만</option></select></label></section><section className="settings-card"><div className="settings-card-title"><Bell size={20}/><div><h3>Notifications Settings</h3><p>받고 싶은 Notifications만 선택하세요. 변경 사항은 Account에 Save됩니다.</p></div></div>{[["notify_messages","DM Messages Notifications","새 다이렉트 Messages의 휴대폰 푸시 및 앱 Notifications"],["notify_comments","Comment Notifications","내 Post에 새 Comment이 달렸을 때"],["notify_likes","Like Notifications","내 Post에 Like가 눌렸을 때"],["notify_follows","팔로우 Notifications","새 Followers가 생겼을 때"]].map(([key,label,desc])=><label className="setting-toggle" key={key}><span><b>{label}</b><small>{desc}</small></span><input type="checkbox" checked={accountSettings[key] !== false} onChange={e=>saveSettings({...accountSettings,[key]:e.target.checked})}/></label>)}<div className="notification-push-actions"><button className="secondary-action" onClick={enablePushNotifications} disabled={pushBusy||pushEnabled}><Bell size={16}/>{pushBusy?"Notifications 등록 중…":pushEnabled?"휴대폰 푸시 연결됨":"휴대폰 푸시 켜기"}</button><small className="setting-help">푸시 Notifications은 Android Notifications 권한과 서버의 Firebase Settings이 필요합니다. 권한 허용 후 별도의 성공 팝업은 표시하지 않습니다.</small></div></section><section className="settings-card"><div className="settings-card-title"><KeyRound size={20}/><div><h3>Password 변경</h3><p>현재 Account Email로 보안 코드를 보내 인증합니다.</p></div></div>{!settingsPasswordCodeSent?<button className="secondary-action" onClick={()=>requestSettingsCode('password')} disabled={settingsBusy}><MailCheck size={16}/> 보안 코드 받기</button>:<form className="settings-form" onSubmit={confirmSettingsPassword}><label>Email 보안 코드<input required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={settingsPasswordCode} onChange={e=>setSettingsPasswordCode(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="6자리 코드"/></label><label>New password<input required type="password" minLength={10} maxLength={128} value={settingsPassword} onChange={e=>setSettingsPassword(e.target.value)} placeholder="10자 이상"/></label><button className="primary compact" disabled={settingsBusy}>Password 변경</button></form>}</section><section className="settings-card"><div className="settings-card-title"><MailCheck size={20}/><div><h3>Email 변경</h3><p>새 Email로 받은 보안 코드를 확인해야 변경됩니다.</p></div></div><label className="settings-form">현재 Email<input value={accountEmail} readOnly/></label>{!settingsEmailCodeSent?<form className="settings-form" onSubmit={e=>{e.preventDefault();requestSettingsCode('email');}}><label>새 Email<input type="email" required value={settingsEmailInput} onChange={e=>setSettingsEmailInput(e.target.value)} placeholder="new@example.com"/></label><button className="secondary-action" disabled={settingsBusy}>새 Email로 코드 받기</button></form>:<form className="settings-form" onSubmit={confirmSettingsEmail}><label>새 Email<input type="email" required value={settingsEmailInput} onChange={e=>setSettingsEmailInput(e.target.value)}/></label><label>인증 코드<input required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={settingsEmailCode} onChange={e=>setSettingsEmailCode(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="6자리 코드"/></label><button className="primary compact" disabled={settingsBusy}>Email 변경 확인</button></form>}</section><section className="settings-card settings-danger"><div className="settings-card-title"><UserX size={20}/><div><h3>Account 관리</h3><p>Log out하거나 Account을 비활성화할 수 있습니다.</p></div></div><button className="secondary-action" onClick={logout}><LogOut size={16}/> Log out</button><div className="deletion-note"><b>회원탈퇴 · 30일 유예</b><p>탈퇴 요청 시 Account은 비활성화됩니다. 30일이 지나면 Post, 팔로우, Messages 등 Account 데이터가 영구 삭제됩니다.</p><button className="danger-button" onClick={deleteAccount} disabled={settingsBusy}><Trash2 size={16}/> 회원탈퇴 예약</button></div></section><section className="settings-card"><div className="settings-card-title"><ShieldCheck size={20}/><div><h3>Block 및 Post 숨김 관리</h3><p>Block하거나 숨긴 Account을 확인하고 언제든 해제할 수 있어요.</p></div><button className="icon-surface" type="button" onClick={loadSafetyLists} disabled={safetyListsBusy} aria-label="Block 및 숨김 목록 새로고침"><RefreshCw size={15}/></button></div>{safetyListsBusy?<p className="safety-list-empty">목록을 Loading…</p>:<div className="safety-list-groups"><div className="safety-list-group"><b>Block한 Account <span>{safetyLists.blocked_users.length}</span></b>{safetyLists.blocked_users.length===0?<p className="safety-list-empty">Block한 Account이 없어요.</p>:safetyLists.blocked_users.map(username=><div className="safety-list-row" key={'block-'+username}><span>@{username}</span><button type="button" className="secondary-action" onClick={()=>toggleSafetyAction(username,'block')}>Block 해제</button></div>)}</div><div className="safety-list-group"><b>숨긴 Account <span>{safetyLists.muted_users.length}</span></b>{safetyLists.muted_users.length===0?<p className="safety-list-empty">숨긴 Account이 없어요.</p>:safetyLists.muted_users.map(username=><div className="safety-list-row" key={'mute-'+username}><span>@{username}</span><button type="button" className="secondary-action" onClick={()=>toggleSafetyAction(username,'mute')}>숨김 해제</button></div>)}</div></div>}</section><section className="settings-card legal-links-card"><div className="settings-card-title"><FileText size={20}/><div><h3>서비스 정책</h3><p>개인정보 처리, 서비스 이용 규칙과 커뮤니티 기준을 확인하세요.</p></div></div><nav className="settings-legal-links" aria-label="서비스 정책"><a href="/privacy">Privacy Policy <ChevronRight size={16}/></a><a href="/terms">Terms of Service <ChevronRight size={16}/></a><a href="/community-guidelines">Community Guidelines <ChevronRight size={16}/></a></nav></section></div></section>}
    {tab==='profile'&&<section className="module-view">{selectedProfile&&selectedProfile!==user.username?<><button className="back-link" onClick={()=>{setSelectedProfile(null);setProfileData(null);}}><ChevronLeft size={17}/> 내 프로필로</button><div className="profile-card public-profile"><div className="profile-avatar">{(profileData?.name||profileData?.username||selectedProfile).slice(0,1).toUpperCase()}</div><span className="eyebrow">FITNOVA 회원</span><h2>{profileData?.name||profileData?.username||selectedProfile}</h2><p>@{profileData?.username||selectedProfile}</p><div className="profile-stats"><div><b>{profileData?.post_count??'—'}</b><span>Post</span></div><button type="button" className="profile-stat-button" onClick={()=>openRelationshipList("followers",selectedProfile)}><b>{profileData?.follower_count??'—'}</b><span>Followers</span></button><button type="button" className="profile-stat-button" onClick={()=>openRelationshipList("following",selectedProfile)}><b>{profileData?.following_count??'—'}</b><span>Following</span></button></div><div className="profile-actions">{!profileData?.is_me&&<button className="primary compact" onClick={toggleFollow} disabled={!profileData}>{profileData?.is_mutual?<><UserCheck size={16}/> 맞팔 중 · 언팔로우</>:profileData?.following_by_me?<><UserCheck size={16}/> Following · 언팔로우</>:<><UserPlus size={16}/> 팔로우</>}</button>}<button className="secondary-action" onClick={()=>{setTab('messages');activeChatRef.current=selectedProfile;setChatMessages([]);setActiveChat(selectedProfile);}}><MessageSquare size={16}/> Messages 보내기</button><button className="secondary-action" onClick={()=>toggleSafetyAction(selectedProfile,'mute')}><VolumeX size={16}/> Post 숨기기</button><button className="secondary-action" onClick={()=>toggleSafetyAction(selectedProfile,'block')}><Ban size={16}/> Account Block</button><button className="secondary-action" onClick={()=>reportTarget('user',selectedProfile)}><Flag size={16}/> Account 신고</button></div></div><div className="profile-posts"><h3>{selectedProfile}님의 Post</h3>{ownPosts.filter(p=>p.author_username===(selectedProfile||user.username)).map(post=><PostCard key={post.id} post={post} user={user} prettyDate={prettyDate} savedPostIds={savedPostIds} toggleSavePost={toggleSavePost} removePost={removePost} toggleLike={toggleLike} commentDrafts={commentDrafts} setCommentDrafts={setCommentDrafts} addComment={addComment} deleteComment={deleteComment} toggleCommentLike={toggleCommentLike} togglePostPin={togglePostPin} toggleSuspension={toggleSuspension} toggleSafetyAction={toggleSafetyAction} openProfile={openProfile}/>)}{posts.filter(p=>p.author_username===selectedProfile).length===0&&<div className="empty-feed"><p>아직 표시할 Post이 없어요.</p></div>}</div></>:<> <div className="profile-card"><div className="profile-avatar">{(user.name||user.username).slice(0,1).toUpperCase()}</div><span className="eyebrow">내 Account</span><h2>{user.name||user.username}</h2><p>@{user.username} · {accountEmail||user.email}</p><span className="verified-pill"><CheckCircle2 size={14}/> Email 인증 완료</span><div className="profile-stats"><div><b>{profileData?.post_count??ownPosts.length}</b><span>Post</span></div><button type="button" className="profile-stat-button" onClick={()=>openRelationshipList("followers",user.username)}><b>{profileData?.follower_count??'—'}</b><span>Followers</span></button><button type="button" className="profile-stat-button" onClick={()=>openRelationshipList("following",user.username)}><b>{profileData?.following_count??'—'}</b><span>Following</span></button></div><div className="profile-details"><div><span>Account 상태</span><b>활성</b></div><div><span>회원 유형</span><b>FITNOVA Member</b></div><div><span>Log in 보안</span><b>Log in 유지</b></div></div><div className="profile-actions"><button className="secondary-action" onClick={()=>setTab('settings')}><Settings size={16}/> 프로필 Settings</button><button className="secondary-action" onClick={()=>setTab('saved')}><Bookmark size={16}/> Saved Posts</button></div></div><div className="profile-posts"><h3>내 Post</h3>{ownPosts.length===0?<div className="empty-feed"><p>아직 작성한 Post이 없어요.</p></div>:ownPosts.map(post=><PostCard key={post.id} post={post} user={user} prettyDate={prettyDate} savedPostIds={savedPostIds} toggleSavePost={toggleSavePost} removePost={removePost} toggleLike={toggleLike} commentDrafts={commentDrafts} setCommentDrafts={setCommentDrafts} addComment={addComment} deleteComment={deleteComment} toggleCommentLike={toggleCommentLike} togglePostPin={togglePostPin} toggleSuspension={toggleSuspension} toggleSafetyAction={toggleSafetyAction} openProfile={openProfile}/>)}</div></>}</section>}
    {tab==='messages'&&<section className={"messages-view "+(activeChat?"chat-open":"")}>{activeChat?<section className="conversation-screen"><div className="conversation-head"><button className="conversation-back" onClick={()=>{setActiveChat('');setChatMessages([]);setError('');}} aria-label="Back to conversations"><ChevronLeft size={24}/></button><button className="author-link conversation-person" onClick={()=>openProfile(activeChat)}><span className="chat-avatar-wrap"><span className="composer-avatar">{activeChat.slice(0,1).toUpperCase()}</span></span><span className="conversation-identity"><b>{activeChat}</b><small>@{activeChat} · FITNOVA 회원</small></span></button><span className="conversation-secure"><ShieldCheck size={14}/> 1:1 대화</span><button className="icon-surface conversation-refresh" onClick={()=>loadConversation(activeChat)} aria-label="대화 새로고침" title="대화 새로고침"><Activity size={16}/></button></div><div className="conversation-context"><span className="context-line"/><span>여기서부터 @{activeChat}님과의 대화입니다</span><span className="context-line"/></div><div className="conversation-messages" ref={chatMessagesRef}>{chatMessages.length===0?<div className="chat-empty-state"><div className="chat-empty-icon"><MessageCircle size={27}/></div><b>아직 주고받은 Messages가 없어요</b><p>가벼운 인사로 Start a conversation.</p></div>:chatMessages.map(msg=><div key={msg.id} className={'chat-message-row '+(msg.sender_username===user.username?'message-row-mine':'message-row-theirs')}>{msg.sender_username!==user.username&&<span className="message-mini-avatar">{activeChat.slice(0,1).toUpperCase()}</span>}<div className={'chat-bubble '+(msg.sender_username===user.username?'mine':'theirs')}><p>{msg.content}</p><small>{prettyDate(msg.created_at)}{msg.sender_username===user.username&&<span className="message-read-receipt"> · {msg.read_at?"Read":"Sent"}</span>}</small></div></div>)}</div>{error&&<div className="chat-inline-error" role="alert">{error}</div>}<form className="message-compose" onSubmit={sendMessage}><div className="message-compose-field"><input value={messageDraft} onChange={e=>setMessageDraft(e.target.value.slice(0,2000))} placeholder="Messages 입력..." maxLength={2000} aria-label="Messages 내용"/></div><button type="submit" className="message-send-button" disabled={messageBusy||!messageDraft.trim()} aria-label="Messages 보내기" title="Messages 보내기">{messageBusy?<span className="send-loading-dot"/>:<Send size={18}/>}</button></form></section>:<><div className="messages-heading"><span className="eyebrow">YOUR CONNECTIONS · DIRECT</span><h2>Messages <span className="message-count-pill">{messageThreads.length}</span></h2><p>운동 이야기를 나누고 서로의 성장을 응원해 보세요.</p></div><section className="thread-list"><div className="thread-list-head"><div><h3>대화 목록</h3><p>대화를 누르면 All 화면 채팅으로 열립니다.</p></div><span className="thread-list-mark"><MessageCircle size={18}/></span></div>{messageThreads.length===0?<div className="thread-empty"><div className="thread-empty-art"><Users size={27}/></div><b>Start a conversation</b><p>관심 있는 회원의 프로필에서 <strong>Messages 보내기</strong>를 누르면 여기에 대화가 표시됩니다.</p></div>:messageThreads.map(thread=><button className="thread-item" key={thread.username} onClick={()=>{activeChatRef.current=thread.username;setChatMessages([]);setActiveChat(thread.username);}}><span className="thread-avatar">{thread.username.slice(0,1).toUpperCase()}<i/></span><span className="thread-copy"><b>{thread.username}</b><small>{thread.content||'Start a conversation'}</small></span>{thread.unread_count>0&&<span className="thread-unread-badge">{thread.unread_count>99?'99+':thread.unread_count}</span>}<span className="thread-open"><ChevronLeft size={18}/></span></button>)}</section></>}</section>}
    {relationshipList.open&&<div className="modal-backdrop relationship-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setRelationshipList(v=>({...v,open:false}));}}><section className="relationship-modal" role="dialog" aria-modal="true" aria-labelledby="relationship-title"><header className="relationship-modal-head"><div><h2 id="relationship-title">{relationshipList.type==="followers"?"Followers":"Following"}</h2><p>@{relationshipList.username}</p></div><button className="icon-surface" type="button" aria-label="Close" onClick={()=>setRelationshipList(v=>({...v,open:false}))}><X size={19}/></button></header>{relationshipList.loading?<div className="relationship-state"><span className="search-spinner"/>목록을 Loading…</div>:relationshipList.error?<div className="relationship-state">{relationshipList.error}</div>:relationshipList.users.length===0?<div className="relationship-state">아직 {relationshipList.type==="followers"?"Followers":"Following"}이 없어요.</div>:<div className="relationship-users">{relationshipList.users.map(person=><button type="button" className="relationship-user" key={person.username} onClick={()=>{setRelationshipList(v=>({...v,open:false}));openProfile(person.username);}}><span className="relationship-avatar">{(person.name||person.username).slice(0,1).toUpperCase()}</span><span className="relationship-user-copy"><b>{person.name||person.username}</b><small>@{person.username}</small></span><ChevronRight size={17}/></button>)}</div>}</section></div>}
    {postFormOpen&&<div className="modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setPostFormOpen(false);}}><section className="post-modal" role="dialog" aria-modal="true" aria-labelledby="post-modal-title"><div className="post-modal-head"><div><span className="eyebrow">CREATE YOUR MOMENT</span><h2 id="post-modal-title">Create a post</h2><p>작성한 초안은 Publish 전까지 공개되지 않습니다.</p></div><button className="icon-surface" type="button" onClick={()=>setPostFormOpen(false)} aria-label="Close"><X size={19}/></button></div><form className="post-draft-form" onSubmit={createPost}><label>제목 *<input value={postTitle} onChange={e=>setPostTitle(e.target.value.slice(0,120))} maxLength={120} required placeholder="예: 하체 운동 4주차 기록"/></label><label>내용 *<textarea value={postContent} onChange={e=>setPostContent(e.target.value.slice(0,2000))} maxLength={2000} required rows={4} placeholder="운동하면서 느낀 점, 목표, 성취를 적어주세요."/></label><div className="draft-media-row"><label className="media-pick"><FileImage size={19}/> 사진 여러 장<input type="file" accept="image/*" multiple onChange={e=>chooseMedia(e.target.files?.[0],e.target.files)}/></label><label className="media-pick"><FileVideo size={19}/> 영상 첨부<input type="file" accept="video/*" onChange={e=>chooseMedia(e.target.files?.[0])}/></label><span className="media-hint">{postMediaName||'사진 최대 10장(각 5MB) / 영상 40MB · 최대 1분'}</span></div>{postMediaFiles.length>0&&<div className="media-preview">{postMedia.type==='image'?<div className="media-preview-grid">{postMediaFiles.map((item,index)=><img key={item.previewUrl} src={item.previewUrl} alt={"Post 사진 미리보기 "+(index+1)}/>)}</div>:<video src={postMedia.previewUrl} controls muted playsInline/>}<button type="button" className="text-button" onClick={()=>{postMediaFiles.forEach(item=>URL.revokeObjectURL(item.previewUrl));setPostMediaFiles([]);setPostMedia(null);setPostMediaName('');}}>첨부 삭제</button></div>}<label><span className="field-icon"><Hash size={15}/> 해시태그</span><input value={postHashtags} onChange={e=>setPostHashtags(e.target.value.slice(0,300))} placeholder="#헬스 #운동기록 #오늘의운동"/></label><div className="draft-grid"><label><span className="field-icon"><Weight size={15}/> 체중 (kg)</span><input type="number" min="1" max="500" step="0.1" value={postWeight} onChange={e=>setPostWeight(e.target.value)} placeholder="예: 68.5"/></label><label><span className="field-icon"><Dumbbell size={15}/> 운동 세트 수</span><input type="number" min="0" max="500" value={postSets} onChange={e=>setPostSets(e.target.value)} placeholder="예: 4"/></label><label><span className="field-icon"><Activity size={15}/> 운동 종류</span><input value={postExercise} onChange={e=>setPostExercise(e.target.value.slice(0,100))} placeholder="예: 벤치프레스"/></label><label><span className="field-icon"><TrendingUp size={15}/> 횟수 / 중량</span><input value={postReps} onChange={e=>setPostReps(e.target.value.slice(0,100))} placeholder="예: 10회 × 60kg"/></label><label><span className="field-icon"><Clock3 size={15}/> 운동 시간 (분)</span><input type="number" min="0" max="1440" value={postDuration} onChange={e=>setPostDuration(e.target.value)} placeholder="예: 45"/></label></div><label>추가 운동 정보<textarea value={postNotes} onChange={e=>setPostNotes(e.target.value.slice(0,1000))} maxLength={1000} rows={3} placeholder="휴식 시간, 루틴, 개인 기록, 운동 팁 등"/></label><div className="draft-privacy-note"><ShieldCheck size={15}/> 체중 등 입력한 정보는 Post에 함께 공개됩니다. 공개할 정보만 입력하세요.</div>{busy&&<div className="upload-progress-wrap"><div className="upload-progress-track"><span style={{width:uploadProgress+'%'}}/></div><small>{uploadProgress>=100?'업로드 완료 · Post을 Save하고 있어요':`${postMedia?.type==='video'?'영상':'사진'} 업로드 중 ${uploadProgress}%`}</small></div>}<div className="post-modal-actions"><button type="button" className="text-button" onClick={()=>{resetPostForm();setPostFormOpen(false);}}>초안 취소</button><button className="primary compact" disabled={busy||!postTitle.trim()||!postContent.trim()||!postMediaFiles.length}><Upload size={16}/>{busy?(uploadProgress>=100?'Save 중...':`업로드 ${uploadProgress}%`):'Publish'}</button></div></form></section></div>}

    {searchOpen&&<div className="social-overlay" role="dialog" aria-modal="true" aria-label="FITNOVA Search">
      <section className="social-overlay-panel search-overlay-panel">
        <header className="social-overlay-head"><div><span className="eyebrow">DISCOVER FITNOVA</span><h2>Search</h2><p>회원, 해시태그, 운동 Post을 찾아보세요.</p></div><button className="icon-surface" onClick={()=>setSearchOpen(false)} aria-label="Search Close"><X size={19}/></button></header>
        <form className="social-search-form" onSubmit={runSearch}><Search size={19}/><input autoFocus value={searchQuery} onChange={e=>setSearchQuery(e.target.value.slice(0,80))} placeholder="Username, Post, #해시태그 Search" aria-label="Search어"/><button className="primary compact" disabled={searchBusy||!searchQuery.trim()}>{searchBusy?'Search 중…':'Search'}</button></form>
        {searchBusy&&<div className="feed-loading"><span className="search-spinner"/><b>Search 중…</b></div>}
        {!searchBusy&&searchResults.hashtags.length>0&&<section className="search-result-section"><h3>해시태그</h3><div className="search-tag-results">{searchResults.hashtags.map(tag=><button key={tag} onClick={()=>{setSearchQuery(tag);}}><Hash size={15}/>{tag}</button>)}</div></section>}
        {!searchBusy&&searchResults.users.length>0&&<section className="search-result-section"><h3>회원</h3>{searchResults.users.map(item=><button className="search-user-result" key={item.username} onClick={()=>{setSearchOpen(false);openProfile(item.username);}}><span className="composer-avatar">{(item.name||item.username).slice(0,1).toUpperCase()}</span><span><b>{item.name||item.username}</b><small>@{item.username}</small></span><ChevronLeft size={16}/></button>)}</section>}
        {!searchBusy&&searchQuery.trim()&&searchResults.posts.length===0&&searchResults.users.length===0&&<div className="empty-feed"><div className="empty-art"><Search size={28}/></div><h3>Search 결과가 없어요</h3><p>다른 Search어나 해시태그를 입력해 보세요.</p></div>}
        {!searchBusy&&searchResults.posts.length>0&&<section className="search-result-section"><h3>Post {searchResults.posts.length}개</h3><div className="feed-list">{searchResults.posts.map((post,index)=><PostCard key={post.id} post={post} user={user} prettyDate={prettyDate} savedPostIds={savedPostIds} toggleSavePost={toggleSavePost} removePost={removePost} toggleLike={toggleLike} commentDrafts={commentDrafts} setCommentDrafts={setCommentDrafts} addComment={addComment} deleteComment={deleteComment} toggleCommentLike={toggleCommentLike} togglePostPin={togglePostPin} toggleSuspension={toggleSuspension} toggleSafetyAction={toggleSafetyAction} openProfile={openProfile} reportPost={reportTarget} priority={index<1}/>)}</div></section>}
      </section>
    </div>}
    {notificationsOpen&&<div className="social-overlay notification-overlay" role="dialog" aria-modal="true" aria-label="Notifications">
      <section className="social-overlay-panel notification-panel"><header className="social-overlay-head"><div><span className="eyebrow">YOUR ACTIVITY</span><h2>Notifications</h2><p>팔로우, Like, Comment, Messages Notifications을 확인하세요.</p></div><button className="icon-surface" onClick={()=>setNotificationsOpen(false)} aria-label="Notifications Close"><X size={19}/></button></header>
      {notifications.length===0?<div className="empty-feed"><div className="empty-art"><Bell size={28}/></div><h3>새로운 Notifications이 없어요</h3><p>다른 회원과 소통하면 이곳에 Notifications이 표시됩니다.</p></div>:<div className="notification-list">{notifications.map(item=><button key={item.id} className={'notification-item '+(!item.read?'unread':'')} onClick={()=>{setNotificationsOpen(false);if(item.kind==='report_threshold')setTab('moderation');else if(item.kind==='message')setTab('messages');else if(item.actor_username)openProfile(item.actor_username);}}><span className="notification-icon">{item.kind==='like'?<Heart size={17}/>:item.kind==='comment'?<MessageCircle size={17}/>:item.kind==='follow'?<UserPlus size={17}/>:<Send size={17}/>}</span><span><b>@{item.actor_username}</b><small>{item.message}</small></span><time>{prettyDate(item.created_at)}</time></button>)}</div>}
      <button className="secondary-action notification-refresh" onClick={()=>loadNotifications(true)}><Activity size={15}/> Notifications 새로고침</button>
      </section>
    </div>}

    </div>
    <footer className="dash-footer"><span>© 2026 FITNOVA</span><span>MOVE. CONNECT. EVOLVE.</span><span className="footer-dot"><i/> YOUR NEXT LEVEL</span></footer></section>
    <nav className={"mobile-nav "+(tab==="messages"&&activeChat?"chat-nav-hidden":"")} aria-label="주요 메뉴">{mobileNav.map(item=><button type="button" key={item.id} className={item.id==='create'?'mobile-create':tab===item.id?'selected':''} onClick={()=>handleNav(item.id)} aria-label={item.id==='create'?'Create a post':item.label} title={item.id==='create'?'Create a post':item.label}><item.icon size={20}/><span>{item.id==='create'?'Post +':item.label}</span></button>)}</nav>
  </main>;
}

function ModerationPanel() {
  const [status, setStatus] = useState('open');
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const loadReports = async () => {
    setLoading(true); setError('');
    try { const data=await api('/api/admin/reports?status='+status); setReports(data.reports||[]); }
    catch(e) { setError(e.message||'신고 목록을 불러오지 못했습니다.'); }
    finally { setLoading(false); }
  };
  useEffect(()=>{loadReports();},[status]);
  const review = async (report, nextStatus) => {
    setBusyId(report.id); setError(''); setNotice('');
    try {
      await api('/api/admin/reports/'+report.id,{method:'PATCH',body:JSON.stringify({status:nextStatus})});
      setNotice(nextStatus==='reviewed'?'신고를 Reviewed 처리했습니다.':'신고를 Dismissed 처리했습니다.');
      await loadReports();
    } catch(e) { setError(e.message||'신고 상태를 Save하지 못했습니다.'); }
    finally { setBusyId(null); }
  };
  const removePost = async report => {
    if (!window.confirm('신고된 Post을 삭제하고 신고를 Reviewed 처리할까요?')) return;
    setBusyId(report.id); setError(''); setNotice('');
    try {
      await api('/api/posts/'+encodeURIComponent(report.target_id),{method:'DELETE'});
      await api('/api/admin/reports/'+report.id,{method:'PATCH',body:JSON.stringify({status:'reviewed'})});
      setNotice('Post을 삭제하고 신고를 Reviewed 처리했습니다.');
      await loadReports();
    } catch(e) { setError(e.message||'Post을 삭제하지 못했습니다.'); }
    finally { setBusyId(null); }
  };
  const suspendUser = async report => {
    if (!window.confirm('@'+report.target_id+' Account의 이용을 정지할까요?')) return;
    setBusyId(report.id); setError(''); setNotice('');
    try {
      await api('/api/users/'+encodeURIComponent(report.target_id)+'/suspend',{method:'POST'});
      await api('/api/admin/reports/'+report.id,{method:'PATCH',body:JSON.stringify({status:'reviewed'})});
      setNotice('Account을 정지하고 신고를 Reviewed 처리했습니다.');
      await loadReports();
    } catch(e) { setError(e.message||'Account 상태를 변경하지 못했습니다.'); }
    finally { setBusyId(null); }
  };
  const labels={post:'Post',comment:'Comment',user:'Account',message:'Messages'};
  return <section className="moderation-page"><div className="settings-heading"><span className="eyebrow">FITNOVA · TRUST & SAFETY</span><h2>Report Center</h2><p>회원 신고를 확인하고 필요한 조치를 처리하세요.</p></div>
    <div className="moderation-toolbar"><div className="moderation-filters">{[['open','Open'],['reviewed','Reviewed'],['dismissed','Dismissed'],['all','All']].map(([key,label])=><button key={key} className={status===key?'selected':''} onClick={()=>setStatus(key)}>{label}</button>)}</div><button className="refresh-button" onClick={loadReports} disabled={loading}><Activity size={15}/> 새로고침</button></div>
    {error&&<div className="alert error" role="alert">{error}</div>}{notice&&<div className="alert success" role="status">{notice}</div>}
    {loading&&reports.length===0?<div className="feed-loading"><span className="search-spinner"/><b>신고를 Loading…</b></div>:reports.length===0?<div className="empty-feed"><div className="empty-art"><ClipboardList size={30}/></div><h3>표시할 신고가 없습니다</h3><p>선택한 상태의 신고가 없어요.</p></div>:<div className="moderation-report-list">{reports.map(report=><article className="settings-card moderation-report" key={report.id}><div className="moderation-report-head"><span className="report-type-pill">{labels[report.target_type]||report.target_type}</span><time>{report.created_at?new Date(report.created_at).toLocaleString('ko-KR'):''}</time><span className={'report-status '+report.status}>{report.status==='open'?'Open':report.status==='reviewed'?'Reviewed':'Dismissed'}</span></div><h3>{report.reason}</h3><p>대상: {report.target_id} · 신고자: @{report.reporter_username}</p>{report.details&&<p className="moderation-report-details">{report.details}</p>}<div className="moderation-report-actions">{report.target_type==='post'&&report.status==='open'&&<button className="danger-button" disabled={busyId===report.id} onClick={()=>removePost(report)}><Trash2 size={15}/> Post 삭제</button>}{report.target_type==='user'&&report.status==='open'&&<button className="danger-button" disabled={busyId===report.id} onClick={()=>suspendUser(report)}><Ban size={15}/> Account 정지</button>}{report.status==='open'&&<><button className="secondary-action" disabled={busyId===report.id} onClick={()=>review(report,'reviewed')}>Reviewed</button><button className="secondary-action" disabled={busyId===report.id} onClick={()=>review(report,'dismissed')}>Dismissed</button></>}</div></article>)}</div>}
  </section>;
}

function PostCard({post,user,prettyDate,removePost,toggleLike,commentDrafts,setCommentDrafts,addComment,deleteComment,toggleCommentLike=()=>{},openProfile,reportPost=()=>{},savedPostIds=new Set(),toggleSavePost=()=>{},priority=false,togglePostPin=()=>{},toggleSuspension=()=>{},toggleSafetyAction=()=>{}}) {
 const cardRef = useRef(null);
 const videoRef = useRef(null);
 const [mediaData, setMediaData] = useState(post.media_data || '');
 const [mediaGallery, setMediaGallery] = useState([]);
 const [galleryIndex, setGalleryIndex] = useState(0);
 const [mediaFailed, setMediaFailed] = useState(false);
 const [mediaRetry, setMediaRetry] = useState(0);
 useEffect(() => {
   if (mediaData || !post.id || !post.media_type || post.media_type === 'text') return;
   let active = true;
   let requested = false;
   const loadMedia = async () => {
     if (requested) return;
     requested = true;
     try {
       if(post.media_type==='video') {
         const mediaCacheKey = `${user.username}:${post.id}`;
         const cached = cacheGet(playbackUrlCache, mediaCacheKey);
         if (cached) { if(active) setMediaData(cached); return; }
         const data=await api('/api/posts/'+post.id+'/media/playback');
         if (!data.url) throw new Error('미디어 주소를 받지 못했습니다.');
         const url=API+data.url;
         cacheSet(playbackUrlCache,mediaCacheKey,url,120000,12);
         if(active) setMediaData(url);
       } else {
         const data = await api('/api/posts/' + post.id + '/media/gallery');
         const gallery = Array.isArray(data.media) ? data.media.filter(Boolean) : [];
         const value = gallery[0] || '';
         if (!value) throw new Error('미디어 파일이 비어 있습니다.');
         if (active) { setMediaGallery(gallery); setGalleryIndex(0); setMediaData(value); }
       }
     } catch { if (active) setMediaFailed(true); }
   };
   if (priority) loadMedia();
   const node = cardRef.current;
   if (!priority && node && 'IntersectionObserver' in window) {
     const observer = new IntersectionObserver(entries => {
       if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); loadMedia(); }
     }, { rootMargin: '1000px 0px' });
     observer.observe(node);
     return () => { active = false; observer.disconnect(); };
   }
   if (!node || !('IntersectionObserver' in window)) loadMedia();
   return () => { active = false; };
 }, [post.id, post.media_type, priority, mediaRetry]);
 useEffect(() => {
   const video = videoRef.current;
   if (!video || post.media_type !== 'video' || !mediaData) return;
   let visible = true;
   const tryPlay = () => { if (visible) video.play().catch(() => {}); };
   const observer = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
     visible = entries.some(entry=>entry.isIntersecting && entry.intersectionRatio >= 0.35);
     if (visible) tryPlay(); else video.pause();
   }, {threshold:[0,0.35,0.6]}) : null;
   if (observer) observer.observe(video);
   video.addEventListener('canplay',tryPlay);
   video.addEventListener('loadeddata',tryPlay);
   if (priority) tryPlay();
   return () => { if(observer) observer.disconnect(); video.removeEventListener('canplay',tryPlay); video.removeEventListener('loadeddata',tryPlay); };
 }, [mediaData, post.media_type, priority]);
 return <article className="post-card" id={"post-"+post.id} ref={cardRef}><div className="post-top"><button className="post-author author-link" onClick={()=>openProfile(post.author_username)} aria-label={post.author_username+' 프로필 보기'}><div className="composer-avatar">{(post.author_username||'?').slice(0,1).toUpperCase()}</div><div><b>{post.author_username}</b><small>{prettyDate(post.created_at)}</small></div></button><div className="post-owner-actions">{(post.author_username===user.username||user.is_master)&&<button className="delete-post" onClick={()=>removePost(post.id)} aria-label="Post 삭제"><Trash2 size={17}/></button>}{user.is_master&&<button className="delete-post" onClick={()=>togglePostPin(post)} aria-label={post.pinned?"Post Unpin":"Post 상단 Pin"} title={post.pinned?"Unpin":"상단 Pin"}><span>{post.pinned?"Pinned":"Pin"}</span></button>}{user.is_master&&post.author_username!==user.username&&<button className="delete-post" onClick={()=>toggleSuspension(post.author_username)} aria-label="Account 정지"><Ban size={16}/></button>}{post.author_username!==user.username&&<button className="delete-post report-post-button" onClick={()=>reportPost("post",post.id)} aria-label="Post 신고" title="Post 신고"><Flag size={16}/></button>}</div></div><h3 className="post-title">{post.title||'Workout Log'}</h3>{post.media_type!=='text'&&<div className={mediaData?'post-media':(mediaFailed?'post-media media-loading media-error':'post-media media-loading')}>{mediaData?(post.media_type==='image'?<><img className="post-gallery-image" src={mediaGallery[galleryIndex]||mediaData} alt={(post.title||'운동 사진')+' '+(galleryIndex+1)} loading={priority?'eager':'lazy'} fetchPriority={priority?'high':'auto'} decoding="async"/>{mediaGallery.length>1&&<><button type="button" className="gallery-arrow gallery-prev" onClick={()=>setGalleryIndex(index=>(index-1+mediaGallery.length)%mediaGallery.length)} aria-label="Previous photo"><ChevronLeft size={23}/></button><button type="button" className="gallery-arrow gallery-next" onClick={()=>setGalleryIndex(index=>(index+1)%mediaGallery.length)} aria-label="Next photo"><ChevronRight size={23}/></button><span className="gallery-counter">{galleryIndex+1} / {mediaGallery.length}</span><div className="gallery-dots">{mediaGallery.map((_,index)=><button key={index} type="button" className={index===galleryIndex?'active':''} onClick={()=>setGalleryIndex(index)} aria-label={'사진 '+(index+1)+' 보기'}/>)}</div></>}</>:<video ref={videoRef} src={mediaData} controls preload={priority?'auto':'metadata'} autoPlay muted loop playsInline webkit-playsinline="true" onCanPlay={e=>e.currentTarget.play().catch(()=>{})}/>):<span>{mediaFailed?<>Couldn't load media. <button type="button" onClick={()=>{setMediaFailed(false);setMediaRetry(value=>value+1);}}>Try again</button></>:<>미디어 Loading…</>}</span>}</div>}<p className="post-content">{post.content}</p>{post.hashtags?.length>0&&<div className="post-hashtags">{post.hashtags.map((tag,i)=><span key={i}>{tag.startsWith('#')?tag:'#'+tag}</span>)}</div>}{(post.weight!=null||post.sets_count!=null||post.exercise_name||post.reps||post.duration_minutes!=null||post.workout_notes)&&<div className="workout-details">{post.weight!=null&&<span><Weight size={14}/> 체중 {post.weight}kg</span>}{post.sets_count!=null&&<span><Dumbbell size={14}/> {post.sets_count}세트</span>}{post.exercise_name&&<span><Activity size={14}/> {post.exercise_name}</span>}{post.reps&&<span><TrendingUp size={14}/> {post.reps}</span>}{post.duration_minutes!=null&&<span><Clock3 size={14}/> {post.duration_minutes}분</span>}{post.workout_notes&&<p>{post.workout_notes}</p>}</div>}<div className="post-actions"><button type="button" className={'like-action '+(post.liked_by_me?'liked':'')} onClick={()=>toggleLike(post.id)} aria-label={post.liked_by_me?'Like 취소':'Like'}><Heart className="like-action-icon" size={17} fill={post.liked_by_me?'currentColor':'none'}/><span>Like {post.like_count||0}</span></button><button type="button" className={'saved-post-button save-action '+(savedPostIds.has(post.id)?'active':'')} onClick={()=>toggleSavePost(post.id)} aria-label={savedPostIds.has(post.id)?'Save 취소':'Post Save'}><Bookmark className="save-action-icon" size={17} fill={savedPostIds.has(post.id)?'currentColor':'none'}/><span>{savedPostIds.has(post.id)?'Save됨':'Save'}</span></button><span className="comment-count"><MessageCircle size={17}/>{(post.comments||[]).length}개 Comment</span></div>{(post.comments||[]).length>0&&<div className="comments-list">{post.comments.map(comment=><div className="comment" key={comment.id}><b>{comment.author_username}</b><span className="comment-content">{comment.content}</span><button type="button" className={'comment-heart-action '+(comment.liked_by_me?'liked':'')} onClick={()=>toggleCommentLike(post.id,comment.id)} disabled={!!comment.pending} aria-label={comment.liked_by_me?'Comment Like 취소':'Comment Like'} title={comment.liked_by_me?'Like 취소':'Like'}><Heart size={14} fill={comment.liked_by_me?'currentColor':'none'}/><span>{comment.like_count||0}</span></button>{(comment.author_username===user.username||post.author_username===user.username)&&!comment.pending&&<button type="button" className="delete-comment" onClick={()=>deleteComment(post.id,comment.id)} aria-label="Comment 삭제">삭제</button>}{comment.author_username!==user.username&&!comment.pending&&<button type="button" className="delete-comment" onClick={()=>toggleSafetyAction(comment.author_username,"block")} aria-label="Comment 작성자 Block">Block</button>}</div>)}</div>}<form className="comment-form" onSubmit={e=>{e.preventDefault();addComment(post.id);}}><input aria-label="Comment 입력" value={commentDrafts[post.id]||''} onChange={e=>setCommentDrafts(items=>({...items,[post.id]:e.target.value.slice(0,500)}))} placeholder="응원의 Comment을 남겨보세요..." maxLength={500}/><button className="comment-send-action" type="submit" disabled={!(commentDrafts[post.id]||'').trim()} aria-label="Comment 등록" title="Comment 등록"><Send size={17}/></button></form></article>;
}

function StepCounterPanel() {
  const emptySnapshot = () => ({ supported: false, permissionGranted: false, tracking: false, todaySteps: 0, weekSteps: 0, days: [] });
  const [snapshot, setSnapshot] = useState(emptySnapshot);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const refresh = async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    try {
      if (!Capacitor.isNativePlatform()) {
        setSnapshot(emptySnapshot());
        setError('걸음 수 측정은 FITNOVA Android 앱에서 사용할 수 있습니다.');
        return;
      }
      if (!StepCounter || typeof StepCounter.getWeeklySteps !== 'function') {
        setSnapshot(emptySnapshot());
        setError('만보기 기능이 이 앱에 포함되어 있지 않습니다. 최신 APK를 설치해 주세요.');
        return;
      }
      const raw = await StepCounter.getWeeklySteps();
      const days = Array.isArray(raw?.days) ? raw.days.filter(day => day && typeof day === 'object').slice(0, 7).map(day => ({
        date: String(day.date || ''),
        label: String(day.label || ''),
        steps: Number.isFinite(Number(day.steps)) ? Math.max(0, Number(day.steps)) : 0,
        isToday: day.isToday === true
      })) : [];
      setSnapshot({
        supported: raw?.supported === true,
        permissionGranted: raw?.permissionGranted === true,
        tracking: raw?.tracking === true,
        todaySteps: Number.isFinite(Number(raw?.todaySteps)) ? Math.max(0, Number(raw.todaySteps)) : 0,
        weekSteps: Number.isFinite(Number(raw?.weekSteps)) ? Math.max(0, Number(raw.weekSteps)) : 0,
        days
      });
      setError('');
    } catch (err) {
      setError(err?.message || '걸음 수를 불러오지 못했습니다. 권한과 기기 센서를 확인해 주세요.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    const safeRefresh = async () => {
      if (!active) return;
      await refresh({ quiet: true });
    };
    safeRefresh();
    const timer = window.setInterval(safeRefresh, 15000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  const enable = async () => {
    if (!Capacitor.isNativePlatform()) {
      setError('걸음 수 측정은 센서가 있는 Android 앱에서 사용할 수 있습니다.');
      return;
    }
    if (!StepCounter || typeof StepCounter.requestPermission !== 'function') {
      setError('만보기 모듈을 찾을 수 없습니다. 최신 APK를 다시 빌드해 설치해 주세요.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await StepCounter.requestPermission();
      await refresh({ quiet: true });
      if (result?.granted !== true) {
        setError('신체 활동 권한을 허용해야 걸음 수를 측정할 수 있습니다.');
      } else if (result?.notificationGranted !== true) {
        setError('상단 Notifications창에 걸음 수를 계속 표시하려면 FITNOVA Notifications 권한을 허용해야 합니다. 휴대폰 Settings에서 Notifications을 켜 주세요.');
      }
    } catch (err) {
      setError(err?.message || '걸음 수 권한을 Settings하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const stop = async () => {
    if (!StepCounter || typeof StepCounter.stopTracking !== 'function') {
      setError('만보기 모듈을 찾을 수 없습니다. 최신 APK를 설치해 주세요.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await StepCounter.stopTracking();
      await refresh({ quiet: true });
    } catch (err) {
      setError(err?.message || '만보기를 중지하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const days = snapshot.days;
  const maxSteps = Math.max(10000, ...days.map(day => day.steps));
  const progress = Math.min(100, Math.round(snapshot.todaySteps / 10000 * 100));

  return <section className="steps-page">
    <header className="steps-heading">
      <div><span className="eyebrow">FITNOVA · DAILY MOVEMENT</span><h2>Show up today 한 걸음씩</h2><p>오늘의 걸음 수와 이번 주 활동을 확인하세요.</p></div>
      <button type="button" className="refresh-button" onClick={() => refresh()} disabled={loading}><RefreshCw size={16}/> 새로고침</button>
    </header>
    {error && <div className="alert error" role="alert">{error}</div>}
    {loading && <div className="steps-permission-card"><div className="steps-icon"><Footprints size={25}/></div><h3>만보기 상태를 확인하고 있어요</h3><p>잠시만 기다려 주세요.</p></div>}
    {!loading && !snapshot.supported && <div className="steps-permission-card"><div className="steps-icon"><Footprints size={25}/></div><h3>이 기기에서 만보기를 사용할 수 없어요</h3><p>걸음 수 센서가 있는 Android 휴대폰의 FITNOVA 앱에서 이용해 주세요. 웹 미리보기에서는 걸음 수를 측정하지 않습니다.</p></div>}
    {!loading && snapshot.supported && !snapshot.permissionGranted && <div className="steps-permission-card"><div className="steps-icon"><Footprints size={25}/></div><h3>걸음 수 측정을 시작해 볼까요?</h3><p>신체 활동과 Notifications 권한을 허용하면 앱을 닫아도 상단 Notifications창에 오늘 걸음 수·거리·칼로리를 계속 표시합니다. Android Settings에서 Notifications을 끄면 표시되지 않을 수 있습니다.</p><button type="button" className="primary compact" onClick={enable} disabled={busy}>{busy?'권한 확인 중…':'걸음 수 측정 시작'}</button></div>}
    {!loading && snapshot.supported && snapshot.permissionGranted && <>
      <article className="steps-today-card"><div className="steps-today-copy"><span className="steps-today-label"><Footprints size={16}/> 오늘 걸음 수</span><div className="steps-today-count">{snapshot.todaySteps.toLocaleString('ko-KR')}<small>걸음</small></div><p>이번 주 <b>{snapshot.weekSteps.toLocaleString('ko-KR')}</b>걸음</p></div><div className="steps-goal-ring" style={{'--steps-progress':progress+'%'}}><div><b>{progress}%</b><small>목표 10,000</small></div></div></article>
      <article className="steps-week-card"><div className="steps-week-heading"><div><span className="eyebrow">THIS WEEK</span><h3>이번 주 요일별 걸음 수</h3></div><span>{snapshot.weekSteps.toLocaleString('ko-KR')} 걸음</span></div><div className="steps-chart" role="img" aria-label="이번 주 요일별 걸음 수 그래프">{days.map((day,index)=><div className={'steps-day '+(day.isToday?'today':'')} key={day.date||index}><span className="steps-day-count">{day.steps.toLocaleString('ko-KR')}</span><div className="steps-bar-track"><i style={{height:Math.max(day.steps?4:2,Math.round(day.steps/maxSteps*100))+'%'}}/></div><b>{day.label||'—'}</b></div>)}</div></article>
      <div className="steps-privacy-note"><span className={'steps-status-dot '+(snapshot.tracking?'':'paused')}/><span>{snapshot.tracking?'걸음 수를 측정하고 있어요':'측정이 중지되어 있어요'} · 기록은 이 기기에 Save됩니다.</span>{snapshot.tracking?<button type="button" onClick={stop} disabled={busy}>측정 중지</button>:<button type="button" onClick={enable} disabled={busy}>{busy?'시작 중…':'측정 다시 시작'}</button>}</div>
    </>}
  </section>;
}

function Stat({ icon: Icon, label, value, unit, note }) {
  return <section className="stat-card"><div className="stat-top"><span className="stat-icon"><Icon size={19}/></span><span className="stat-label">{label}</span></div><div className="stat-value">{value}<small>{unit}</small></div><p>{note}</p></section>;
}

function AccountDeletionPage() {
  return <main className="legal-shell">
    <header className="legal-topbar">
      <a className="legal-brand" href="/" aria-label="FITNOVA Home"><span className="legal-mark"><Activity size={21}/></span><span>FIT<span>NOVA</span></span></a>
      <a className="legal-back" href="/"><ArrowLeft size={16}/> 서비스로 돌아가기</a>
    </header>
    <article className="legal-content">
      <span className="legal-eyebrow">ACCOUNT & DATA</span>
      <h1>FITNOVA Account 삭제 요청</h1>
      <p className="legal-intro">앱에 Log in할 수 없는 경우에도 이 페이지에서 Account 삭제를 요청할 수 있습니다.</p>
      <section className="legal-section"><h2>삭제 요청 방법</h2><p>아래 버튼을 눌러 FITNOVA 운영자에게 요청해 주세요. Email에 FITNOVA 사용자 Name과 가입 Email 주소를 적어 주세요. Password나 인증 코드는 보내지 마세요.</p></section>
      <section className="legal-section"><h2>본인 확인 및 처리</h2><p>Account 보호를 위해 운영자가 등록된 Email 주소로 본인 확인을 요청할 수 있습니다. 요청 확인 후 관련 Account과 연결된 개인정보를 삭제 처리합니다. 법령 준수, 보안, 사기 방지 또는 분쟁 처리 등 정당한 사유로 보관이 필요한 정보는 법적 근거가 있는 범위에서만 보관될 수 있습니다. 앱 내 탈퇴 기능으로 요청한 경우 30일 유예 기간이 적용될 수 있습니다.</p></section>
      <section className="legal-section"><h2>운영자 및 문의</h2><p>FITNOVA 운영자: FitNova운영자(개인 운영)<br/>Email: fitnova@naver.com</p></section>
      <a className="legal-back" href="mailto:fitnova@naver.com?subject=FITNOVA%20Account%20삭제%20요청&body=FITNOVA%20사용자%20Name%3A%20%0A가입%20Email%3A%20%0AAccount%20삭제를%20요청합니다.">Email로 Account 삭제 요청하기</a>
      <p><a href="/privacy">Privacy Policy 보기</a></p>
    </article>
  </main>;
}

const legalPaths = ['/privacy', '/terms', '/community-guidelines'];
createRoot(document.getElementById('root')).render(window.location.pathname === '/delete-account' ? <AccountDeletionPage /> : legalPaths.includes(window.location.pathname) ? <LegalPages /> : <App/>);

