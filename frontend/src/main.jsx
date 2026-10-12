import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity, ArrowRight, Bell, CheckCircle2, Compass, Eye, EyeOff, Flame,
  Heart, Home, LockKeyhole, LogOut, Mail, MessageCircle, Send, ShieldCheck,
  Sparkles, Trash2, TrendingUp, UserRound, Users, X, Zap, Plus, Image as ImageIcon, Video, Hash, Dumbbell, Weight, Clock3, Upload, FileVideo, FileImage,
  Search, UserPlus, UserCheck, MessageSquare, ChevronLeft, Settings, Bookmark, KeyRound, UserX, MailCheck
} from 'lucide-react';
import './style.css';

const API = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');
const TOKEN_KEY = 'fitnova_access_token';

async function api(path, options = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(API + path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || '요청에 실패했습니다. 잠시 후 다시 시도해 주세요.');
  return data;
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
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [code, setCode] = useState('');
  const [tab, setTab] = useState('feed');

  useEffect(() => {
    let active = true;
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) { setBooting(false); return () => { active = false; }; }
    api('/api/auth/me')
      .then(data => { if (active) setUser(data.user); setTab('feed'); })
      .catch(() => { localStorage.removeItem(TOKEN_KEY); if (active) setUser(null); })
      .finally(() => { if (active) setBooting(false); });
    return () => { active = false; };
  }, []);

  const request = async (path, body) => {
    const res = await fetch(API + path, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || '요청에 실패했습니다. 서버 설정을 확인해 주세요.');
    return data;
  };

  const acceptSession = (data) => {
    if (!data.access_token || !data.user) throw new Error('로그인 응답이 올바르지 않습니다. 서버 배포 상태를 확인해 주세요.');
    localStorage.setItem(TOKEN_KEY, data.access_token);
    setUser(data.user);
    setTab('feed');
    setError('');
    setNotice('');
  };

  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      if (mode === 'register' && step === 'form') {
        await request('/api/auth/register', { username, email, password });
        setStep('verify');
        setNotice('인증 코드를 이메일로 발송했습니다. 10분 안에 입력해 주세요.');
      } else if (mode === 'register') {
        const data = await request('/api/auth/verify', { email, code });
        acceptSession(data);
      } else if (step === 'form') {
        const data = await request('/api/auth/login', { identifier: identifier.trim(), password });
        setEmail(data.email || '');
        setCode('');
        setStep('verify');
        setNotice('로그인 보안 코드를 이메일로 발송했습니다. 10분 안에 입력해 주세요.');
      } else {
        const data = await request('/api/auth/login/verify', { email, code });
        acceptSession(data);
      }
    } catch (err) { setError(err.message || '오류가 발생했습니다.'); }
    finally { setBusy(false); }
  };

  const switchMode = (nextMode) => {
    setMode(nextMode); setStep('form'); setError(''); setNotice('');
  };
  const logout = () => {
    if (!window.confirm('FITNOVA에서 로그아웃할까요? 저장되지 않은 작성 내용은 사라질 수 있습니다.')) return;
    localStorage.removeItem(TOKEN_KEY);
    setUser(null); setTab('feed'); setMode('login'); setStep('form');
    setPassword(''); setError(''); setNotice('안전하게 로그아웃했습니다.');
  };

  if (booting) return <main className="boot-screen"><div className="boot-logo"><Activity size={28}/></div><b>FIT<span>NOVA</span></b><div className="boot-track"><i/></div><small>세션을 확인하고 있어요</small></main>;
  if (user) return <Dashboard user={user} tab={tab} setTab={setTab} logout={logout} />;

  return <main className="shell"><nav className="topbar"><a className="brand" href="#top"><span className="brand-icon"><Activity size={20}/></span> FIT<span>NOVA</span></a><div className="status"><i/> YOUR FITNESS UNIVERSE</div></nav><section className="hero" id="top"><div className="hero-copy"><div className="eyebrow"><Sparkles size={14}/> YOUR NEXT LEVEL STARTS HERE</div><h1>움직임이 모여<br/><em>새로운 나</em>가 되다.</h1><p className="lead">기록하고, 연결하고, 함께 성장해.<br/>당신의 피트니스 라이프를 새롭게.</p><div className="feature-row"><div><span className="feature-icon"><Flame size={18}/></span><b>매일의 기록</b><small>작은 변화의 축적</small></div><div><span className="feature-icon"><UserRound size={18}/></span><b>함께하는 성장</b><small>운동으로 이어지는 연결</small></div></div><div className="quote"><div className="quote-line"/> <span>MOVE WITH PURPOSE. LIVE WITH ENERGY.</span></div></div><section className="auth-card"><div className="card-head"><div className="mini-mark"><Activity size={19}/></div><div className="card-kicker">WELCOME TO FITNOVA</div><h2>{mode==='register'?(step==='verify'?'이메일을 확인해 주세요':'계정 만들기'):'다시 만나 반가워요'}</h2><p>{mode==='register'?(step==='verify'?'이메일로 받은 6자리 코드를 입력하세요.':'새로운 피트니스 여정을 시작하세요.'):'계정에 로그인하고 여정을 이어가세요.'}</p></div><div className="tabs"><button className={mode==='register'?'active':''} onClick={()=>switchMode('register')}>회원가입</button><button className={mode==='login'?'active':''} onClick={()=>switchMode('login')}>로그인</button></div><form onSubmit={submit}>{mode==='register'&&step==='form'&&<label>아이디<div className="input-wrap"><UserRound size={17}/><input required minLength="3" maxLength="24" pattern="[A-Za-z0-9_]+" value={username} onChange={e=>setUsername(e.target.value)} placeholder="영문, 숫자, 밑줄 3~24자" autoComplete="username"/></div></label>}{mode==='register'&&step==='form'&&<label>이메일<div className="input-wrap"><Mail size={17}/><input required type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@example.com" autoComplete="email"/></div></label>}{mode==='login'&&step==='form'&&<label>아이디 또는 이메일<div className="input-wrap"><UserRound size={17}/><input required value={identifier} onChange={e=>setIdentifier(e.target.value)} placeholder="아이디 또는 이메일" autoComplete="username"/></div></label>}{((mode==='register'||mode==='login')&&step==='verify')&&<><label>{mode==='register'?'인증 이메일':'보안 코드 발송 이메일'}<div className="input-wrap"><Mail size={17}/><input type="email" required value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email"/></div></label><label>6자리 인증 코드<div className="input-wrap code-wrap"><ShieldCheck size={17}/><input required inputMode="numeric" pattern="[0-9]{6}" maxLength="6" value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="000000" className="code-input"/></div></label></>}{((mode==='register'&&step==='form')||(mode==='login'&&step==='form'))&&<label>비밀번호<div className="input-wrap"><LockKeyhole size={17}/><input required minLength={mode==='register'?10:1} maxLength="128" type={show?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder={mode==='register'?'10자 이상 입력':'비밀번호 입력'} autoComplete={mode==='register'?'new-password':'current-password'}/><button type="button" className="icon-button" onClick={()=>setShow(!show)} aria-label="비밀번호 표시">{show?<EyeOff size={17}/>:<Eye size={17}/>}</button></div>{mode==='register'&&<small className="hint">안전한 계정을 위해 10자 이상 사용해 주세요.</small>}</label>}{error&&<div className="alert error">{error}</div>}{notice&&<div className="alert success"><CheckCircle2 size={16}/>{notice}</div>}<button className="primary" disabled={busy}>{busy?'처리 중...':mode==='register'?(step==='verify'?'인증하고 시작하기':'인증 코드 받기'):(step==='verify'?'보안 코드 확인 후 로그인':'보안 코드 받기')}<ArrowRight size={17}/></button>{step==='verify'&&<button type="button" className="text-button" onClick={()=>{setStep('form');setCode('');setError('');setNotice('');}}>정보 다시 입력</button>}</form><div className="secure-note"><ShieldCheck size={15}/><span>안전한 인증 · 비밀번호 보호 · 개인정보 존중</span></div></section></section><footer><span>© 2026 FITNOVA</span><span>MOVE. CONNECT. EVOLVE.</span><span className="footer-dot"><i/> BUILT FOR YOUR NEXT LEVEL</span></footer></main>;
}

function Dashboard({ user, tab, setTab, logout }) {
  const [posts, setPosts] = useState([]);
  const [searchInput, setSearchInput] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [hashtagSearch, setHashtagSearch] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [hasMorePosts, setHasMorePosts] = useState(false);
  const postsOffset = useRef(0);
  const postsRequestId = useRef(0);
  const settingsRequestId = useRef(0);
  const pendingLikes = useRef(new Set());
  const pendingSaves = useRef(new Set());
  const pendingFollows = useRef(new Set());
  const pendingComments = useRef(new Set());
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [profileData, setProfileData] = useState(null);
  const [ownPosts, setOwnPosts] = useState([]);
  const [savedPosts, setSavedPosts] = useState([]);
  const [savedPostIds, setSavedPostIds] = useState(new Set());
  const [accountSettings, setAccountSettings] = useState({private_account:false,allow_messages_from:'everyone',show_activity:true,show_workout_details:true});
  const [accountEmail, setAccountEmail] = useState(user.email || '');
  const [settingsEmailInput, setSettingsEmailInput] = useState(user.email || '');
  const [settingsEmailCode, setSettingsEmailCode] = useState('');
  const [settingsPassword, setSettingsPassword] = useState('');
  const [settingsPasswordCode, setSettingsPasswordCode] = useState('');
  const [settingsEmailCodeSent, setSettingsEmailCodeSent] = useState(false);
  const [settingsPasswordCodeSent, setSettingsPasswordCodeSent] = useState(false);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [messageThreads, setMessageThreads] = useState([]);
  const [activeChat, setActiveChat] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [messageDraft, setMessageDraft] = useState('');
  const [messageBusy, setMessageBusy] = useState(false);
  const [draft, setDraft] = useState('');
  const [commentDrafts, setCommentDrafts] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);
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
  const [postMediaName, setPostMediaName] = useState('');
  const nav = [
    { id: 'home', label: '홈', icon: Home },
    { id: 'feed', label: '피드', icon: Compass },
    { id: 'messages', label: '메시지', icon: MessageCircle },
    { id: 'profile', label: '프로필', icon: UserRound },
    { id: 'saved', label: '저장한 게시물', icon: Bookmark },
    { id: 'settings', label: '설정', icon: Settings }
  ];
  const loadPosts = async (tag = hashtagSearch, append = false) => {
    const requestId = ++postsRequestId.current;
    const normalizedTag = String(tag || '').trim().replace(/^#+/, '').trim().toLocaleLowerCase('ko-KR');
    const offset = append ? postsOffset.current : 0;
    if (!append) {
      postsOffset.current = 0;
      setHasMorePosts(false);
      setSearchError('');
    }
    setSearchLoading(true);
    try {
      const query = new URLSearchParams({ limit: '15', offset: String(offset) });
      if (normalizedTag) query.set('hashtag', normalizedTag);
      const data = await api('/api/posts?' + query.toString());
      if (requestId === postsRequestId.current) {
        const incoming = Array.isArray(data.posts) ? data.posts : [];
        setPosts(items => append ? [...items, ...incoming] : incoming);
        postsOffset.current = offset + incoming.length;
        setHasMorePosts(incoming.length === 15);
        setError('');
        setSearchError('');
      }
    } catch (e) {
      if (requestId === postsRequestId.current) {
        const message = e.message || '게시물을 불러오지 못했습니다.';
        if (normalizedTag) setSearchError(message);
        else setError(message);
      }
    } finally {
      if (requestId === postsRequestId.current) setSearchLoading(false);
    }
  };
  const openProfile = (username) => { setSelectedProfile(username); setProfileData(null); setTab('profile'); setError(''); };
  const loadProfile = async (username = selectedProfile || user.username) => {
    try { const data = await api('/api/users/' + encodeURIComponent(username)); setProfileData(data.profile); }
    catch (e) { setError(e.message || '프로필을 불러오지 못했습니다.'); }
  };
  const loadOwnPosts = async () => { try { const d=await api('/api/users/'+encodeURIComponent(user.username)+'/posts'); setOwnPosts(d.posts||[]); } catch(e){setError(e.message||'내 게시물을 불러오지 못했습니다.');} };
  const loadSavedPosts = async () => { try { const d=await api('/api/saved-posts'); setSavedPosts(d.posts||[]); setSavedPostIds(new Set((d.posts||[]).map(p=>p.id))); } catch(e){setError(e.message||'저장한 게시물을 불러오지 못했습니다.');} };
  const loadSettings = async () => { try { const d=await api('/api/account/settings'); setAccountSettings(d.settings); setAccountEmail(d.email||user.email); setSettingsEmailInput(d.email||user.email); } catch(e){setError(e.message||'설정을 불러오지 못했습니다.');} };
  const saveSettings = async (next=accountSettings) => {
    const requestId = ++settingsRequestId.current;
    const previous = accountSettings;
    setAccountSettings(next); setError(''); setNotice('설정을 저장하는 중…');
    try {
      const d = await api('/api/account/settings', {method:'PATCH', body:JSON.stringify(next)});
      if (requestId === settingsRequestId.current) { setAccountSettings(d.settings); setNotice('설정을 저장했습니다.'); }
    } catch(e) {
      if (requestId === settingsRequestId.current) { setAccountSettings(previous); setError((e.message||'설정을 저장하지 못했습니다.')+' 설정 변경이 저장되지 않아 이전 값으로 되돌렸습니다.'); setNotice(''); }
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
      setError(e.message||'게시물을 저장하지 못했습니다.');
    } finally { pendingSaves.current.delete(id); }
  };
  const requestSettingsCode = async (kind) => { setSettingsBusy(true); setError(''); try { if(kind==='password'){await api('/api/account/password/request-code',{method:'POST'});setSettingsPasswordCodeSent(true);setNotice('현재 이메일로 비밀번호 변경 보안 코드를 보냈습니다.');} else {await api('/api/account/email/request-code',{method:'POST',body:JSON.stringify({email:settingsEmailInput})});setSettingsEmailCodeSent(true);setNotice('새 이메일로 인증 코드를 보냈습니다.');} } catch(e){setError(e.message||'보안 코드를 보내지 못했습니다.');} finally{setSettingsBusy(false);} };
  const confirmSettingsPassword = async (e) => { e.preventDefault();setSettingsBusy(true);setError('');try{await api('/api/account/password/confirm',{method:'POST',body:JSON.stringify({code:settingsPasswordCode,new_password:settingsPassword})});setSettingsPassword('');setSettingsPasswordCode('');setSettingsPasswordCodeSent(false);setNotice('비밀번호를 변경했습니다.');}catch(e){setError(e.message||'비밀번호를 변경하지 못했습니다.');}finally{setSettingsBusy(false);} };
  const confirmSettingsEmail = async (e) => { e.preventDefault();setSettingsBusy(true);setError('');try{const d=await api('/api/account/email/confirm',{method:'POST',body:JSON.stringify({email:settingsEmailInput,code:settingsEmailCode})});setAccountEmail(d.email);setSettingsEmailCode('');setSettingsEmailCodeSent(false);setNotice('이메일을 변경했습니다.');}catch(e){setError(e.message||'이메일을 변경하지 못했습니다.');}finally{setSettingsBusy(false);} };
  const deleteAccount = async () => { if(!window.confirm('정말 회원탈퇴를 신청할까요? 계정은 즉시 비활성화되고, 30일 후 영구 삭제됩니다.'))return;setSettingsBusy(true);setError('');setNotice('');try{const d=await api('/api/account',{method:'DELETE'});localStorage.removeItem(TOKEN_KEY);setUser(null);setTab('feed');setMode('login');setStep('form');setPassword('');setNotice(d.message||'회원탈퇴가 접수되었습니다. 계정은 비활성화되었으며 30일 후 영구 삭제됩니다.');}catch(e){setError((e.message||'회원탈퇴를 처리하지 못했습니다.')+' 계정 상태는 변경되지 않았습니다.');}finally{setSettingsBusy(false);} };
  const loadThreads = async () => { try { const data = await api('/api/messages'); setMessageThreads(data.threads || []); } catch (e) { setError(e.message || '메시지를 불러오지 못했습니다.'); } };
  const loadConversation = async (username) => { setActiveChat(username); try { const data = await api('/api/messages/' + encodeURIComponent(username)); setChatMessages(data.messages || []); } catch (e) { setError(e.message || '대화 내용을 불러오지 못했습니다.'); } };
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
    e.preventDefault(); const content = messageDraft.trim(); if (!content || !activeChat) return;
    setMessageBusy(true); setError('');
    try { const data = await api('/api/messages/' + encodeURIComponent(activeChat), { method: 'POST', body: JSON.stringify({ content }) }); setChatMessages(items => [...items, data.message]); setMessageDraft(''); await loadThreads(); }
    catch (e) { setError(e.message || '메시지를 보내지 못했습니다.'); }
    finally { setMessageBusy(false); }
  };
  const searchHashtag = (e) => {
    e.preventDefault();
    const tag = searchInput.trim().replace(/^#+/, '').trim();
    setError('');
    setSearchError('');
    setTab('search');
    setSearchOpen(true);
    setHashtagSearch(tag);
    if (!tag) {
      ++postsRequestId.current;
      postsOffset.current = 0;
      setPosts([]);
      setHasMorePosts(false);
      setSearchLoading(false);
      setSearchError('검색할 해시태그를 입력해 주세요.');
      return;
    }
    loadPosts(tag);
  };
  const openSearch = () => { setSearchOpen(true); setTab('search'); setError(''); setNotice(''); setSearchError(''); };
  useEffect(() => { if (tab === 'feed' || tab === 'home') loadPosts(''); if (tab === 'profile') {loadProfile(); if(!selectedProfile || selectedProfile===user.username) loadOwnPosts();} if (tab === 'messages') loadThreads(); if(tab==='saved')loadSavedPosts(); if(tab==='settings')loadSettings(); }, [tab, selectedProfile]);
  useEffect(() => { loadSavedPosts(); }, []);
  useEffect(() => { if (tab === 'messages' && activeChat) loadConversation(activeChat); }, [tab, activeChat]);
  const resetPostForm = () => { setPostTitle(''); setPostContent(''); setPostHashtags(''); setPostWeight(''); setPostSets(''); setPostExercise(''); setPostReps(''); setPostDuration(''); setPostNotes(''); setPostMedia(null); setPostMediaName(''); };
  const chooseMedia = async (file) => {
    setError(''); if (!file) { setPostMedia(null); setPostMediaName(''); return; }
    const isImage=file.type.startsWith('image/'), isVideo=file.type.startsWith('video/');
    if (!isImage&&!isVideo) { setError('사진 또는 영상 파일만 선택할 수 있습니다.'); return; }
    if (file.size>(isImage?5:40)*1024*1024) { setError(isImage?'사진은 5MB 이하로 선택해 주세요.':'영상은 40MB 이하로 선택해 주세요.'); return; }
    let durationSeconds = null;
    if (isVideo) {
      try {
        durationSeconds = await new Promise((resolve, reject) => {
          const url = URL.createObjectURL(file);
          const probe = document.createElement('video');
          probe.preload = 'metadata';
          probe.onloadedmetadata = () => { const duration = probe.duration; URL.revokeObjectURL(url); resolve(duration); };
          probe.onerror = () => { URL.revokeObjectURL(url); reject(new Error('영상 정보를 읽을 수 없습니다. 다른 파일을 선택해 주세요.')); };
          probe.src = url;
        });
        if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) { setError('영상 길이를 확인할 수 없습니다.'); return; }
        if (durationSeconds > 60) { setError('영상은 최대 1분(60초)까지 업로드할 수 있습니다.'); return; }
      } catch (e) { setError(e.message || '영상 정보를 읽지 못했습니다.'); return; }
    }
    const reader=new FileReader();
    reader.onload=()=>{setPostMedia({type:isImage?'image':'video',data:String(reader.result),durationSeconds:durationSeconds===null?null:Math.ceil(durationSeconds)});setPostMediaName(file.name);};
    reader.onerror=()=>setError('파일을 읽지 못했습니다.');
    reader.readAsDataURL(file);
  };
  const createPost = async (e) => {
    e.preventDefault(); if(!postTitle.trim()||!postContent.trim()||!postMedia){setError('제목, 내용, 사진 또는 영상을 모두 입력해 주세요.');return;}
    setBusy(true);setError('');setNotice('');
    const hashtags=postHashtags.split(/[\\s,]+/).map(x=>x.trim().replace(/^#/,'')).filter(Boolean).map(x=>'#'+x).slice(0,20);
    const mediaType=postMedia.type;
    try {
      await api('/api/posts',{method:'POST',body:JSON.stringify({title:postTitle.trim(),content:postContent.trim(),media_type:mediaType,media_data:postMedia.data,media_duration_seconds:postMedia.durationSeconds,hashtags,weight:postWeight===''?null:Number(postWeight),sets_count:postSets===''?null:Number(postSets),exercise_name:postExercise.trim(),reps:postReps.trim(),duration_minutes:postDuration===''?null:Number(postDuration),workout_notes:postNotes.trim()})});
      resetPostForm();setPostFormOpen(false);await loadPosts();setNotice(mediaType==='image'?'사진 게시물을 홈에 올렸습니다.':'영상 게시물을 피드에 올렸습니다.');setTab(mediaType==='image'?'home':'feed');
    } catch(e){setError(e.message||'게시물을 올리지 못했습니다.');} finally{setBusy(false);}
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
      setError(e.message||'좋아요를 처리하지 못했습니다.');
    } finally { pendingLikes.current.delete(id); }
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
      setError(e.message||'댓글을 등록하지 못했습니다.');
    } finally { pendingComments.current.delete(id); }
  };
  const deleteComment = async (postId, commentId) => {
    if (!window.confirm('이 댓글을 삭제할까요?')) return;
    const remove = items => items.map(post => post.id === postId ? {...post, comments:(post.comments||[]).filter(comment => String(comment.id) !== String(commentId))} : post);
    const snapshots = {posts, ownPosts, savedPosts};
    setPosts(remove); setOwnPosts(remove); setSavedPosts(remove);
    setError(''); setNotice('');
    try {
      await api('/api/posts/' + postId + '/comments/' + commentId, {method:'DELETE'});
      setNotice('댓글을 삭제했습니다.');
    } catch (e) {
      setPosts(snapshots.posts); setOwnPosts(snapshots.ownPosts); setSavedPosts(snapshots.savedPosts);
      setError(e.message || '댓글을 삭제하지 못했습니다.');
    }
  };
  const removePost = async (id) => {
    if (!window.confirm('이 게시물을 삭제할까요?')) return;
    try { await api('/api/posts/' + id, { method: 'DELETE' }); setPosts(items => items.filter(p => p.id !== id)); setNotice('게시물을 삭제했습니다.'); }
    catch (e) { setError(e.message || '게시물을 삭제하지 못했습니다.'); }
  };
  const prettyDate = (value) => { try { return new Date(value).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };
  return <main className="app-shell">
    <aside className="side-rail"><a className="brand" href="#feed"><span className="brand-icon"><Activity size={21}/></span><span className="rail-brand">FIT<span>NOVA</span></span></a><div className="rail-nav">{nav.map(item=><button key={item.id} className={tab===item.id?'selected':''} onClick={()=>{if(item.id==='profile')setSelectedProfile(null);setTab(item.id);}}><item.icon size={20}/><span>{item.label}</span></button>)}<button className="nav-create" onClick={()=>{setError('');setNotice('');setPostFormOpen(true);}} aria-label="게시물 작성"><Plus size={20}/><span>게시물 작성</span></button></div><div className="rail-bottom"><div className="avatar">{user.username.slice(0,1).toUpperCase()}</div><button className="rail-logout" onClick={logout} aria-label="로그아웃"><LogOut size={18}/></button></div></aside>
    <section className="dashboard-main"><header className="dash-top"><div><div className="eyebrow"><Sparkles size={13}/> MOVE. CONNECT. EVOLVE.</div><h1>{tab==='feed'?'함께 성장하는 피드':tab==='home'?'오늘도 한 단계 성장해요':tab==='search'?'해시태그 검색 결과':tab==='messages'?'메시지':tab==='settings'?'설정':tab==='saved'?'저장한 게시물':'나의 FITNOVA'}</h1></div><div className="top-actions"><button className="icon-surface" aria-label="알림" title="알림"><Bell size={19}/></button><button className="icon-surface" aria-label="해시태그 검색 열기" title="해시태그 검색" onClick={openSearch}><Search size={19}/></button><button className="user-chip" onClick={()=>setProfileOpen(!profileOpen)}><span className="avatar">{user.username.slice(0,1).toUpperCase()}</span><span><b>{user.username}</b><small>FITNOVA 멤버</small></span></button>{profileOpen&&<div className="profile-pop"><b>{user.username}</b><span>{user.email}</span><button onClick={logout}><LogOut size={15}/> 로그아웃</button></div>}</div></header>
    {searchOpen&&<div className="full-search-screen"><header className="full-search-header"><button type="button" className="search-back-button" aria-label="검색 닫기" onClick={()=>{setSearchOpen(false);setTab('feed');}}><ChevronLeft size={23}/></button><a className="brand" href="#feed"><span className="brand-icon"><Activity size={20}/></span> FIT<span>NOVA</span></a><button type="button" className="search-modal-close" aria-label="검색 닫기" onClick={()=>{setSearchOpen(false);setTab('feed');}}><X size={20}/></button></header><section className="full-search-content"><div className="full-search-intro"><span className="eyebrow">FITNOVA DISCOVER</span><h2>운동의 순간을 찾아보세요.</h2><p>해시태그를 검색하면 관련 게시물과 영상이 함께 표시됩니다.</p></div><form className="hashtag-search full-search-form" onSubmit={searchHashtag}><Search size={21}/><input autoFocus value={searchInput} onChange={e=>setSearchInput(e.target.value)} placeholder="#러닝, #헬스, #운동기록" aria-label="해시태그 검색"/>{searchInput&&<button type="button" className="search-clear" onClick={()=>setSearchInput('')} aria-label="검색어 지우기"><X size={17}/></button>}<button type="submit">검색</button></form><div className="full-search-results"><div className="full-search-results-heading hashtag-results-banner"><div className="hashtag-results-title"><span className="hashtag-results-icon"><Hash size={23}/></span><div><span className="eyebrow">HASHTAG</span><h3>{hashtagSearch?'#'+hashtagSearch:'해시태그 검색'}</h3><p>{hashtagSearch?'이 해시태그가 포함된 게시물':'검색어를 입력하면 관련 게시물이 여기에 표시됩니다.'}</p></div></div>{hashtagSearch&&<span className="result-count">{searchError?'오류':searchLoading?'검색 중…':posts.length+'개 게시물'}</span>}</div>{searchError?<div className="search-error-state"><div className="empty-art"><X size={27}/></div><h3>검색을 완료하지 못했어요</h3><p>{searchError}</p><button type="button" className="search-retry-button" onClick={()=>loadPosts(hashtagSearch)}>다시 검색</button></div>:hashtagSearch?(searchLoading?<div className="search-loading"><span className="search-spinner"/><b>게시물과 영상을 찾고 있어요...</b><p>해시태그가 포함된 내용을 확인하고 있습니다.</p></div>:posts.length===0?<div className="empty-feed"><div className="empty-art"><Hash size={30}/></div><h3>아직 검색 결과가 없어요</h3><p>게시물 본문이나 해시태그 목록에 포함된 태그를 검색해요.</p></div>:<div className="search-result-stack"><div className="feed-list">{posts.map(post=><PostCard key={post.id} post={post} user={user} prettyDate={prettyDate} savedPostIds={savedPostIds} toggleSavePost={toggleSavePost} removePost={removePost} toggleLike={toggleLike} commentDrafts={commentDrafts} setCommentDrafts={setCommentDrafts} addComment={addComment} deleteComment={deleteComment} openProfile={openProfile}/>)}</div>{hasMorePosts&&<button className="load-more-posts" disabled={searchLoading} onClick={()=>loadPosts(hashtagSearch,true)}>{searchLoading?'불러오는 중…':'게시물 더 불러오기'}</button>}</div>):<div className="search-empty-prompt"><Search size={27}/><p>예를 들어 <button type="button" onClick={()=>{setSearchInput('#러닝');setHashtagSearch('러닝');loadPosts('러닝');}}>#러닝</button>을 검색해 보세요.</p></div>}</div></section></div>}
    {error&&<div className="alert error feed-alert">{error}</div>}{notice&&<div className="alert success feed-alert">{notice}</div>}
    {tab==='search'&&!searchOpen&&<section className="feed-layout"><div className="feed-heading"><div><span className="eyebrow">HASHTAG SEARCH</span><h2>{hashtagSearch?'#'+hashtagSearch+' 검색 결과':'게시물 검색'}</h2><p>사진과 영상 게시물을 함께 보여줍니다.</p></div><button className="refresh-button" onClick={()=>loadPosts(hashtagSearch)}><Activity size={16}/> 새로고침</button></div><div className="feed-list">{posts.length===0?<div className="empty-feed"><div className="empty-art"><Hash size={32}/></div><h3>검색 결과가 없어요</h3><p>다른 해시태그로 검색해 보세요.</p></div>:posts.map(post=><PostCard key={post.id} post={post} user={user} prettyDate={prettyDate} savedPostIds={savedPostIds} toggleSavePost={toggleSavePost} removePost={removePost} toggleLike={toggleLike} commentDrafts={commentDrafts} setCommentDrafts={setCommentDrafts} addComment={addComment} openProfile={openProfile}/>)}</div>{hasMorePosts&&<button className="load-more-posts" disabled={searchLoading} onClick={()=>loadPosts(hashtagSearch,true)}>{searchLoading?'불러오는 중…':'게시물 더 불러오기'}</button>}</section>}
    {tab==='feed'&&<section className="feed-layout"><div className="feed-heading"><div><span className="eyebrow">FITNOVA VIDEO FEED</span><h2>운동의 순간을 영상으로.</h2><p>영상 게시물만 모아보는 피드입니다.</p></div><button className="refresh-button" onClick={()=>loadPosts('')}><Activity size={16}/> 새로고침</button></div><div className="feed-list">{searchLoading&&posts.length===0?<div className="feed-loading"><span className="search-spinner"/><b>게시물을 불러오는 중…</b></div>:posts.filter(p=>p.media_type==='video').length===0?<div className="empty-feed"><div className="empty-art"><Video size={34}/></div><h3>아직 영상 게시물이 없어요</h3><p>옆의 + 버튼으로 운동 영상을 공유해 보세요.</p><button className="primary compact" onClick={()=>setPostFormOpen(true)}><Plus size={16}/> 영상 게시물 작성</button></div>:posts.filter(p=>p.media_type==='video').map(post=><PostCard key={post.id} post={post} user={user} prettyDate={prettyDate} savedPostIds={savedPostIds} toggleSavePost={toggleSavePost} removePost={removePost} toggleLike={toggleLike} commentDrafts={commentDrafts} setCommentDrafts={setCommentDrafts} addComment={addComment} openProfile={openProfile}/>)}</div></section>}
    {tab==='feed'&&hasMorePosts&&<button className="load-more-posts" disabled={searchLoading} onClick={()=>loadPosts('',true)}>{searchLoading?'불러오는 중…':'게시물 더 불러오기'}</button>}
    {tab==='home'&&<section className="feed-layout"><div className="feed-heading"><div><span className="eyebrow">FITNOVA PHOTO HOME</span><h2>오늘의 기록을 사진으로.</h2><p>홈에는 사진 게시물만 표시됩니다.</p></div><button className="refresh-button" onClick={loadPosts}><Activity size={16}/> 새로고침</button></div><div className="feed-list photo-feed">{searchLoading&&posts.length===0?<div className="feed-loading"><span className="search-spinner"/><b>게시물을 불러오는 중…</b></div>:posts.filter(p=>p.media_type==='image').length===0?<div className="empty-feed"><div className="empty-art"><ImageIcon size={34}/></div><h3>아직 사진 게시물이 없어요</h3><p>운동 기록 사진이나 오늘의 변화를 공유해 보세요.</p><button className="primary compact" onClick={()=>setPostFormOpen(true)}><Plus size={16}/> 사진 게시물 작성</button></div>:posts.filter(p=>p.media_type==='image').map(post=><PostCard key={post.id} post={post} user={user} prettyDate={prettyDate} savedPostIds={savedPostIds} toggleSavePost={toggleSavePost} removePost={removePost} toggleLike={toggleLike} commentDrafts={commentDrafts} setCommentDrafts={setCommentDrafts} addComment={addComment} deleteComment={deleteComment}/>)}</div></section>}
    {tab==='home'&&hasMorePosts&&<button className="load-more-posts" disabled={searchLoading} onClick={()=>loadPosts('',true)}>{searchLoading?'불러오는 중…':'게시물 더 불러오기'}</button>}
    {tab==='saved'&&<section className="feed-layout"><div className="feed-heading"><div><span className="eyebrow">YOUR COLLECTION</span><h2>저장한 게시물</h2><p>나중에 다시 보고 싶은 운동 기록을 모아뒀어요.</p></div><button className="refresh-button" onClick={loadSavedPosts}><Activity size={16}/> 새로고침</button></div><div className="feed-list">{savedPosts.length===0?<div className="empty-feed"><Bookmark size={30}/><h3>아직 저장한 게시물이 없어요</h3><p>게시물의 책갈피 버튼을 눌러 저장해 보세요.</p></div>:savedPosts.map(post=><PostCard key={post.id} post={post} user={user} prettyDate={prettyDate} savedPostIds={savedPostIds} toggleSavePost={toggleSavePost} removePost={removePost} toggleLike={toggleLike} commentDrafts={commentDrafts} setCommentDrafts={setCommentDrafts} addComment={addComment} openProfile={openProfile}/>)}</div></section>}
    {tab==='settings'&&<section className="settings-page"><div className="settings-heading"><span className="eyebrow">YOUR SPACE · SETTINGS</span><h2>설정 및 개인정보</h2><p>FITNOVA 경험과 계정 정보를 원하는 방식으로 관리하세요.</p></div><div className="settings-account-banner"><div className="settings-account-avatar">{user.username.slice(0,1).toUpperCase()}</div><div className="settings-account-copy"><span>로그인한 계정</span><b>{user.username}</b><small>{accountEmail||user.email}</small></div><span className="settings-account-status"><CheckCircle2 size={15}/> 인증된 계정</span></div><div className="settings-grid"><section className="settings-card"><div className="settings-card-title"><ShieldCheck size={20}/><div><h3>개인정보 및 소통</h3><p>다른 회원에게 보이는 범위와 연락 방법을 정하세요.</p></div></div>{[['private_account','비공개 계정','프로필 공개 범위를 제한하는 설정'],['show_activity','활동 정보 표시','프로필에 운동 활동 관련 정보를 표시'],['show_workout_details','운동 세부 정보 표시','게시물에 작성한 운동 세부 정보를 표시']].map(([key,label,desc])=><label className="setting-toggle" key={key}><span><b>{label}</b><small>{desc}</small></span><input type="checkbox" checked={!!accountSettings[key]} onChange={e=>saveSettings({...accountSettings,[key]:e.target.checked})}/></label>)}<label className="setting-select"><span><b>메시지 수신 범위</b><small>팔로우하지 않은 계정의 메시지를 차단할 수 있어요.</small></span><select value={accountSettings.allow_messages_from} onChange={e=>saveSettings({...accountSettings,allow_messages_from:e.target.value})}><option value="everyone">모든 계정</option><option value="following">내가 팔로우한 계정만</option></select></label></section><section className="settings-card"><div className="settings-card-title"><KeyRound size={20}/><div><h3>비밀번호 변경</h3><p>현재 계정 이메일로 보안 코드를 보내 인증합니다.</p></div></div>{!settingsPasswordCodeSent?<button className="secondary-action" onClick={()=>requestSettingsCode('password')} disabled={settingsBusy}><MailCheck size={16}/> 보안 코드 받기</button>:<form className="settings-form" onSubmit={confirmSettingsPassword}><label>이메일 보안 코드<input required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={settingsPasswordCode} onChange={e=>setSettingsPasswordCode(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="6자리 코드"/></label><label>새 비밀번호<input required type="password" minLength={10} maxLength={128} value={settingsPassword} onChange={e=>setSettingsPassword(e.target.value)} placeholder="10자 이상"/></label><button className="primary compact" disabled={settingsBusy}>비밀번호 변경</button></form>}</section><section className="settings-card"><div className="settings-card-title"><MailCheck size={20}/><div><h3>이메일 변경</h3><p>새 이메일로 받은 보안 코드를 확인해야 변경됩니다.</p></div></div><label className="settings-form">현재 이메일<input value={accountEmail} readOnly/></label>{!settingsEmailCodeSent?<form className="settings-form" onSubmit={e=>{e.preventDefault();requestSettingsCode('email');}}><label>새 이메일<input type="email" required value={settingsEmailInput} onChange={e=>setSettingsEmailInput(e.target.value)} placeholder="new@example.com"/></label><button className="secondary-action" disabled={settingsBusy}>새 이메일로 코드 받기</button></form>:<form className="settings-form" onSubmit={confirmSettingsEmail}><label>새 이메일<input type="email" required value={settingsEmailInput} onChange={e=>setSettingsEmailInput(e.target.value)}/></label><label>인증 코드<input required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={settingsEmailCode} onChange={e=>setSettingsEmailCode(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="6자리 코드"/></label><button className="primary compact" disabled={settingsBusy}>이메일 변경 확인</button></form>}</section><section className="settings-card settings-danger"><div className="settings-card-title"><UserX size={20}/><div><h3>계정 관리</h3><p>로그아웃하거나 계정을 비활성화할 수 있습니다.</p></div></div><button className="secondary-action" onClick={logout}><LogOut size={16}/> 로그아웃</button><div className="deletion-note"><b>회원탈퇴 · 30일 유예</b><p>탈퇴 요청 시 계정은 비활성화됩니다. 30일이 지나면 게시물, 팔로우, 메시지 등 계정 데이터가 영구 삭제됩니다.</p><button className="danger-button" onClick={deleteAccount} disabled={settingsBusy}><Trash2 size={16}/> 회원탈퇴 예약</button></div></section></div></section>}
    {tab==='profile'&&<section className="module-view">{selectedProfile&&selectedProfile!==user.username?<><button className="back-link" onClick={()=>{setSelectedProfile(null);setProfileData(null);}}><ChevronLeft size={17}/> 내 프로필로</button><div className="profile-card public-profile"><div className="profile-avatar">{(profileData?.username||selectedProfile).slice(0,1).toUpperCase()}</div><span className="eyebrow">FITNOVA MEMBER</span><h2>{profileData?.username||selectedProfile}</h2><p>운동 기록을 함께 나누는 멤버</p><div className="profile-stats"><div><b>{profileData?.post_count??'—'}</b><span>게시물</span></div><div><b>{profileData?.follower_count??'—'}</b><span>팔로워</span></div><div><b>{profileData?.following_count??'—'}</b><span>팔로잉</span></div></div><div className="profile-actions">{!profileData?.is_me&&<button className="primary compact" onClick={toggleFollow} disabled={!profileData}>{profileData?.is_mutual?<><UserCheck size={16}/> 맞팔 중 · 언팔로우</>:profileData?.following_by_me?<><UserCheck size={16}/> 팔로잉 · 언팔로우</>:<><UserPlus size={16}/> 팔로우</>}</button>}<button className="secondary-action" onClick={()=>{setTab('messages');setActiveChat(selectedProfile);}}><MessageSquare size={16}/> 메시지 보내기</button></div></div><div className="profile-posts"><h3>{selectedProfile}님의 게시물</h3>{posts.filter(p=>p.author_username===selectedProfile).map(post=><PostCard key={post.id} post={post} user={user} prettyDate={prettyDate} savedPostIds={savedPostIds} toggleSavePost={toggleSavePost} removePost={removePost} toggleLike={toggleLike} commentDrafts={commentDrafts} setCommentDrafts={setCommentDrafts} addComment={addComment} openProfile={openProfile}/>)}{posts.filter(p=>p.author_username===selectedProfile).length===0&&<div className="empty-feed"><p>아직 표시할 게시물이 없어요.</p></div>}</div></>:<> <div className="profile-card"><div className="profile-avatar">{user.username.slice(0,1).toUpperCase()}</div><span className="eyebrow">YOUR ACCOUNT</span><h2>{user.username}</h2><p>{accountEmail||user.email}</p><span className="verified-pill"><CheckCircle2 size={14}/> 이메일 인증 완료</span><div className="profile-stats"><div><b>{profileData?.post_count??ownPosts.length}</b><span>게시물</span></div><div><b>{profileData?.follower_count??'—'}</b><span>팔로워</span></div><div><b>{profileData?.following_count??'—'}</b><span>팔로잉</span></div></div><div className="profile-details"><div><span>계정 상태</span><b>활성</b></div><div><span>회원 유형</span><b>FITNOVA 멤버</b></div><div><span>로그인 보안</span><b>로그인 유지</b></div></div><div className="profile-actions"><button className="secondary-action" onClick={()=>setTab('settings')}><Settings size={16}/> 프로필 설정</button><button className="secondary-action" onClick={()=>setTab('saved')}><Bookmark size={16}/> 저장한 게시물</button></div></div><div className="profile-posts"><h3>내 게시물</h3>{ownPosts.length===0?<div className="empty-feed"><p>아직 작성한 게시물이 없어요.</p></div>:ownPosts.map(post=><PostCard key={post.id} post={post} user={user} prettyDate={prettyDate} savedPostIds={savedPostIds} toggleSavePost={toggleSavePost} removePost={removePost} toggleLike={toggleLike} commentDrafts={commentDrafts} setCommentDrafts={setCommentDrafts} addComment={addComment} openProfile={openProfile}/>)}</div></>}</section>}
    {tab==='messages'&&<section className="messages-view"><div className="messages-heading"><span className="eyebrow">PRIVATE CONVERSATIONS</span><h2>메시지</h2><p>다른 멤버와 운동 이야기를 나눠보세요.</p></div><div className="messages-layout"><aside className="thread-list"><h3>대화 목록</h3>{messageThreads.length===0?<p className="muted-copy">아직 대화가 없어요. 프로필에서 먼저 메시지를 보내보세요.</p>:messageThreads.map(thread=><button key={thread.username} className={activeChat===thread.username?'active':''} onClick={()=>loadConversation(thread.username)}><span className="composer-avatar">{thread.username.slice(0,1).toUpperCase()}</span><span><b>{thread.username}</b><small>{thread.content}</small></span></button>)}</aside><section className="conversation-panel">{activeChat?<><div className="conversation-head"><button className="author-link" onClick={()=>openProfile(activeChat)}><span className="composer-avatar">{activeChat.slice(0,1).toUpperCase()}</span><b>{activeChat}</b></button><button className="icon-surface" onClick={()=>loadConversation(activeChat)} aria-label="대화 새로고침"><Activity size={16}/></button></div><div className="conversation-messages">{chatMessages.map(msg=><div key={msg.id} className={'chat-bubble '+(msg.sender_username===user.username?'mine':'theirs')}><p>{msg.content}</p><small>{prettyDate(msg.created_at)}</small></div>)}</div><form className="message-compose" onSubmit={sendMessage}><input value={messageDraft} onChange={e=>setMessageDraft(e.target.value.slice(0,2000))} placeholder="메시지를 입력하세요..." maxLength={2000}/><button className="primary compact" disabled={messageBusy||!messageDraft.trim()}><Send size={16}/></button></form></>:<div className="conversation-empty"><MessageCircle size={30}/><p>대화를 선택하거나 프로필에서 메시지를 보내세요.</p></div>}</section></div></section>}
    {postFormOpen&&<div className="modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setPostFormOpen(false);}}><section className="post-modal" role="dialog" aria-modal="true" aria-labelledby="post-modal-title"><div className="post-modal-head"><div><span className="eyebrow">CREATE YOUR MOMENT</span><h2 id="post-modal-title">게시물 작성</h2><p>작성한 초안은 게시하기 전까지 공개되지 않습니다.</p></div><button className="icon-surface" type="button" onClick={()=>setPostFormOpen(false)} aria-label="닫기"><X size={19}/></button></div><form className="post-draft-form" onSubmit={createPost}><label>제목 *<input value={postTitle} onChange={e=>setPostTitle(e.target.value.slice(0,120))} maxLength={120} required placeholder="예: 하체 운동 4주차 기록"/></label><label>내용 *<textarea value={postContent} onChange={e=>setPostContent(e.target.value.slice(0,2000))} maxLength={2000} required rows={4} placeholder="운동하면서 느낀 점, 목표, 성취를 적어주세요."/></label><div className="draft-media-row"><label className="media-pick"><FileImage size={19}/> 사진 첨부<input type="file" accept="image/*" onChange={e=>chooseMedia(e.target.files?.[0])}/></label><label className="media-pick"><FileVideo size={19}/> 영상 첨부<input type="file" accept="video/*" onChange={e=>chooseMedia(e.target.files?.[0])}/></label><span className="media-hint">{postMediaName||'사진 5MB / 영상 40MB · 최대 1분'}</span></div>{postMedia&&<div className="media-preview">{postMedia.type==='image'?<img src={postMedia.data} alt="게시물 미리보기"/>:<video src={postMedia.data} controls/>}<button type="button" className="text-button" onClick={()=>{setPostMedia(null);setPostMediaName('');}}>첨부 삭제</button></div>}<label><span className="field-icon"><Hash size={15}/> 해시태그</span><input value={postHashtags} onChange={e=>setPostHashtags(e.target.value.slice(0,300))} placeholder="#헬스 #운동기록 #오늘의운동"/></label><div className="draft-grid"><label><span className="field-icon"><Weight size={15}/> 체중 (kg)</span><input type="number" min="1" max="500" step="0.1" value={postWeight} onChange={e=>setPostWeight(e.target.value)} placeholder="예: 68.5"/></label><label><span className="field-icon"><Dumbbell size={15}/> 운동 세트 수</span><input type="number" min="0" max="500" value={postSets} onChange={e=>setPostSets(e.target.value)} placeholder="예: 4"/></label><label><span className="field-icon"><Activity size={15}/> 운동 종류</span><input value={postExercise} onChange={e=>setPostExercise(e.target.value.slice(0,100))} placeholder="예: 벤치프레스"/></label><label><span className="field-icon"><TrendingUp size={15}/> 횟수 / 중량</span><input value={postReps} onChange={e=>setPostReps(e.target.value.slice(0,100))} placeholder="예: 10회 × 60kg"/></label><label><span className="field-icon"><Clock3 size={15}/> 운동 시간 (분)</span><input type="number" min="0" max="1440" value={postDuration} onChange={e=>setPostDuration(e.target.value)} placeholder="예: 45"/></label></div><label>추가 운동 정보<textarea value={postNotes} onChange={e=>setPostNotes(e.target.value.slice(0,1000))} maxLength={1000} rows={3} placeholder="휴식 시간, 루틴, 개인 기록, 운동 팁 등"/></label><div className="draft-privacy-note"><ShieldCheck size={15}/> 체중 등 입력한 정보는 게시물에 함께 공개됩니다. 공개할 정보만 입력하세요.</div><div className="post-modal-actions"><button type="button" className="text-button" onClick={()=>{resetPostForm();setPostFormOpen(false);}}>초안 취소</button><button className="primary compact" disabled={busy||!postTitle.trim()||!postContent.trim()||!postMedia}><Upload size={16}/>{busy?'게시 중...':'게시하기'}</button></div></form></section></div>}
    <footer className="dash-footer"><span>© 2026 FITNOVA</span><span>MOVE. CONNECT. EVOLVE.</span><span className="footer-dot"><i/> YOUR NEXT LEVEL</span></footer></section>
    <nav className="mobile-nav">{nav.map(item=><button key={item.id} className={tab===item.id?'selected':''} onClick={()=>setTab(item.id)}><item.icon size={20}/><span>{item.label}</span></button>)}<button className="mobile-create" onClick={()=>{setError('');setNotice('');setPostFormOpen(true);}} aria-label="게시물 작성"><Plus size={22}/><span>작성</span></button></nav>
  </main>;
}

function PostCard({post,user,prettyDate,removePost,toggleLike,commentDrafts,setCommentDrafts,addComment,deleteComment,openProfile,savedPostIds=new Set(),toggleSavePost=()=>{}}) {
 const cardRef = useRef(null);
 const [mediaData, setMediaData] = useState(post.media_data || '');
 const [mediaFailed, setMediaFailed] = useState(false);
 useEffect(() => {
   if (mediaData || !post.id || !post.media_type || post.media_type === 'text') return;
   let active = true;
   let requested = false;
   const loadMedia = async () => {
     if (requested) return;
     requested = true;
     try {
       const data = await api('/api/posts/' + post.id + '/media');
       if (active) setMediaData(data.media_data || '');
     } catch { if (active) setMediaFailed(true); }
   };
   const node = cardRef.current;
   if (node && 'IntersectionObserver' in window) {
     const observer = new IntersectionObserver(entries => {
       if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); loadMedia(); }
     }, { rootMargin: '300px 0px' });
     observer.observe(node);
     return () => { active = false; observer.disconnect(); };
   }
   loadMedia();
   return () => { active = false; };
 }, [post.id, post.media_type, mediaData]);
 return <article className="post-card" ref={cardRef}><div className="post-top"><button className="post-author author-link" onClick={()=>openProfile(post.author_username)} aria-label={post.author_username+' 프로필 보기'}><div className="composer-avatar">{(post.author_username||'?').slice(0,1).toUpperCase()}</div><div><b>{post.author_username}</b><small>{prettyDate(post.created_at)}</small></div></button>{post.author_username===user.username&&<button className="delete-post" onClick={()=>removePost(post.id)} aria-label="게시물 삭제"><Trash2 size={17}/></button>}</div><h3 className="post-title">{post.title||'운동 기록'}</h3>{(mediaData||(!mediaFailed&&post.media_type!=='text'))&&<div className={mediaData?'post-media':'post-media media-loading'}>{mediaData?(post.media_type==='image'?<img src={mediaData} alt={post.title||'운동 사진'} loading="lazy" decoding="async"/>:<video src={mediaData} controls preload="none"/>):<span>미디어 불러오는 중…</span>}</div>}<p className="post-content">{post.content}</p>{post.hashtags?.length>0&&<div className="post-hashtags">{post.hashtags.map((tag,i)=><span key={i}>{tag.startsWith('#')?tag:'#'+tag}</span>)}</div>}{(post.weight!=null||post.sets_count!=null||post.exercise_name||post.reps||post.duration_minutes!=null||post.workout_notes)&&<div className="workout-details">{post.weight!=null&&<span><Weight size={14}/> 체중 {post.weight}kg</span>}{post.sets_count!=null&&<span><Dumbbell size={14}/> {post.sets_count}세트</span>}{post.exercise_name&&<span><Activity size={14}/> {post.exercise_name}</span>}{post.reps&&<span><TrendingUp size={14}/> {post.reps}</span>}{post.duration_minutes!=null&&<span><Clock3 size={14}/> {post.duration_minutes}분</span>}{post.workout_notes&&<p>{post.workout_notes}</p>}</div>}<div className="post-actions"><button className={post.liked_by_me?'liked':''} onClick={()=>toggleLike(post.id)}><Heart size={17} fill={post.liked_by_me?'currentColor':'none'}/><span>좋아요 {post.like_count||0}</span></button><button className={savedPostIds.has(post.id)?'saved-post-button active':'saved-post-button'} onClick={()=>toggleSavePost(post.id)} aria-label={savedPostIds.has(post.id)?'저장 취소':'게시물 저장'}><Bookmark size={17} fill={savedPostIds.has(post.id)?'currentColor':'none'}/><span>{savedPostIds.has(post.id)?'저장됨':'저장'}</span></button><span className="comment-count"><MessageCircle size={17}/>{(post.comments||[]).length}개 댓글</span></div>{(post.comments||[]).length>0&&<div className="comments-list">{post.comments.map(comment=><div className="comment" key={comment.id}><b>{comment.author_username}</b><span>{comment.content}</span>{comment.author_username===user.username&&!comment.pending&&<button type="button" className="delete-comment" onClick={()=>deleteComment(post.id,comment.id)} aria-label="내 댓글 삭제">삭제</button>}</div>)}</div>}<form className="comment-form" onSubmit={e=>{e.preventDefault();addComment(post.id);}}><input aria-label="댓글 입력" value={commentDrafts[post.id]||''} onChange={e=>setCommentDrafts(items=>({...items,[post.id]:e.target.value.slice(0,500)}))} placeholder="응원의 댓글을 남겨보세요..." maxLength={500}/><button type="submit" disabled={!(commentDrafts[post.id]||'').trim()} aria-label="댓글 등록"><Send size={16}/></button></form></article>;
}

function Stat({ icon: Icon, label, value, unit, note }) {
  return <section className="stat-card"><div className="stat-top"><span className="stat-icon"><Icon size={19}/></span><span className="stat-label">{label}</span></div><div className="stat-value">{value}<small>{unit}</small></div><p>{note}</p></section>;
}

createRoot(document.getElementById('root')).render(<App/>);
