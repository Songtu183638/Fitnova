import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity, ArrowRight, Bell, CheckCircle2, Compass, Eye, EyeOff, Flame,
  Heart, Home, LockKeyhole, LogOut, Mail, MessageCircle, Send, ShieldCheck,
  Sparkles, Trash2, TrendingUp, UserRound, Users, X, Zap
} from 'lucide-react';
import './style.css';

const API = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');
const TOKEN_KEY = 'fitnova_access_token';

async function api(path, options = {}) {
  const token = sessionStorage.getItem(TOKEN_KEY);
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
    const token = sessionStorage.getItem(TOKEN_KEY);
    if (!token) { setBooting(false); return () => { active = false; }; }
    api('/api/auth/me')
      .then(data => { if (active) setUser(data.user); setTab('feed'); })
      .catch(() => { sessionStorage.removeItem(TOKEN_KEY); if (active) setUser(null); })
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
    sessionStorage.setItem(TOKEN_KEY, data.access_token);
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
    sessionStorage.removeItem(TOKEN_KEY);
    setUser(null); setTab('feed'); setMode('login'); setStep('form');
    setPassword(''); setError(''); setNotice('안전하게 로그아웃했습니다.');
  };

  if (booting) return <main className="boot-screen"><div className="boot-logo"><Activity size={28}/></div><b>FIT<span>NOVA</span></b><div className="boot-track"><i/></div><small>세션을 확인하고 있어요</small></main>;
  if (user) return <Dashboard user={user} tab={tab} setTab={setTab} logout={logout} />;

  return <main className="shell"><nav className="topbar"><a className="brand" href="#top"><span className="brand-icon"><Activity size={20}/></span> FIT<span>NOVA</span></a><div className="status"><i/> YOUR FITNESS UNIVERSE</div></nav><section className="hero" id="top"><div className="hero-copy"><div className="eyebrow"><Sparkles size={14}/> YOUR NEXT LEVEL STARTS HERE</div><h1>움직임이 모여<br/><em>새로운 나</em>가 되다.</h1><p className="lead">기록하고, 연결하고, 함께 성장해.<br/>당신의 피트니스 라이프를 새롭게.</p><div className="feature-row"><div><span className="feature-icon"><Flame size={18}/></span><b>매일의 기록</b><small>작은 변화의 축적</small></div><div><span className="feature-icon"><UserRound size={18}/></span><b>함께하는 성장</b><small>운동으로 이어지는 연결</small></div></div><div className="quote"><div className="quote-line"/> <span>MOVE WITH PURPOSE. LIVE WITH ENERGY.</span></div></div><section className="auth-card"><div className="card-head"><div className="mini-mark"><Activity size={19}/></div><div className="card-kicker">WELCOME TO FITNOVA</div><h2>{mode==='register'?(step==='verify'?'이메일을 확인해 주세요':'계정 만들기'):'다시 만나 반가워요'}</h2><p>{mode==='register'?(step==='verify'?'이메일로 받은 6자리 코드를 입력하세요.':'새로운 피트니스 여정을 시작하세요.'):'계정에 로그인하고 여정을 이어가세요.'}</p></div><div className="tabs"><button className={mode==='register'?'active':''} onClick={()=>switchMode('register')}>회원가입</button><button className={mode==='login'?'active':''} onClick={()=>switchMode('login')}>로그인</button></div><form onSubmit={submit}>{mode==='register'&&step==='form'&&<label>아이디<div className="input-wrap"><UserRound size={17}/><input required minLength="3" maxLength="24" pattern="[A-Za-z0-9_]+" value={username} onChange={e=>setUsername(e.target.value)} placeholder="영문, 숫자, 밑줄 3~24자" autoComplete="username"/></div></label>}{mode==='register'&&step==='form'&&<label>이메일<div className="input-wrap"><Mail size={17}/><input required type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@example.com" autoComplete="email"/></div></label>}{mode==='login'&&step==='form'&&<label>아이디 또는 이메일<div className="input-wrap"><UserRound size={17}/><input required value={identifier} onChange={e=>setIdentifier(e.target.value)} placeholder="아이디 또는 이메일" autoComplete="username"/></div></label>}{((mode==='register'||mode==='login')&&step==='verify')&&<><label>{mode==='register'?'인증 이메일':'보안 코드 발송 이메일'}<div className="input-wrap"><Mail size={17}/><input type="email" required value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email"/></div></label><label>6자리 인증 코드<div className="input-wrap code-wrap"><ShieldCheck size={17}/><input required inputMode="numeric" pattern="[0-9]{6}" maxLength="6" value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="000000" className="code-input"/></div></label></>}{((mode==='register'&&step==='form')||(mode==='login'&&step==='form'))&&<label>비밀번호<div className="input-wrap"><LockKeyhole size={17}/><input required minLength={mode==='register'?10:1} maxLength="128" type={show?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder={mode==='register'?'10자 이상 입력':'비밀번호 입력'} autoComplete={mode==='register'?'new-password':'current-password'}/><button type="button" className="icon-button" onClick={()=>setShow(!show)} aria-label="비밀번호 표시">{show?<EyeOff size={17}/>:<Eye size={17}/>}</button></div>{mode==='register'&&<small className="hint">안전한 계정을 위해 10자 이상 사용해 주세요.</small>}</label>}{error&&<div className="alert error">{error}</div>}{notice&&<div className="alert success"><CheckCircle2 size={16}/>{notice}</div>}<button className="primary" disabled={busy}>{busy?'처리 중...':mode==='register'?(step==='verify'?'인증하고 시작하기':'인증 코드 받기'):(step==='verify'?'보안 코드 확인 후 로그인':'보안 코드 받기')}<ArrowRight size={17}/></button>{step==='verify'&&<button type="button" className="text-button" onClick={()=>{setStep('form');setCode('');setError('');setNotice('');}}>정보 다시 입력</button>}</form><div className="secure-note"><ShieldCheck size={15}/><span>안전한 인증 · 비밀번호 보호 · 개인정보 존중</span></div></section></section><footer><span>© 2026 FITNOVA</span><span>MOVE. CONNECT. EVOLVE.</span><span className="footer-dot"><i/> BUILT FOR YOUR NEXT LEVEL</span></footer></main>;
}

function Dashboard({ user, tab, setTab, logout }) {
  const [posts, setPosts] = useState([]);
  const [draft, setDraft] = useState('');
  const [commentDrafts, setCommentDrafts] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);
  const nav = [
    { id: 'feed', label: '피드', icon: Compass },
    { id: 'home', label: '홈', icon: Home },
    { id: 'profile', label: '프로필', icon: UserRound }
  ];
  const loadPosts = async () => {
    try { const data = await api('/api/posts'); setPosts(data.posts || []); setError(''); }
    catch (e) { setError(e.message || '피드를 불러오지 못했습니다.'); }
  };
  useEffect(() => { if (tab === 'feed') loadPosts(); }, [tab]);
  const createPost = async (e) => {
    e.preventDefault();
    if (!draft.trim()) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await api('/api/posts', { method: 'POST', body: JSON.stringify({ content: draft.trim() }) });
      setDraft(''); await loadPosts(); setNotice('게시물을 올렸습니다.');
    } catch (e) { setError(e.message || '게시물을 올리지 못했습니다.'); }
    finally { setBusy(false); }
  };
  const toggleLike = async (id) => {
    try { const result = await api('/api/posts/' + id + '/like', { method: 'POST' }); setPosts(items => items.map(p => p.id === id ? { ...p, liked_by_me: result.liked, like_count: Math.max(0, p.like_count + (result.liked ? 1 : -1)) } : p)); }
    catch (e) { setError(e.message || '좋아요를 처리하지 못했습니다.'); }
  };
  const addComment = async (id) => {
    const content = (commentDrafts[id] || '').trim();
    if (!content) return;
    try {
      const result = await api('/api/posts/' + id + '/comments', { method: 'POST', body: JSON.stringify({ content }) });
      setPosts(items => items.map(p => p.id === id ? { ...p, comments: [...(p.comments || []), result.comment] } : p));
      setCommentDrafts(items => ({ ...items, [id]: '' }));
    } catch (e) { setError(e.message || '댓글을 등록하지 못했습니다.'); }
  };
  const removePost = async (id) => {
    if (!window.confirm('이 게시물을 삭제할까요?')) return;
    try { await api('/api/posts/' + id, { method: 'DELETE' }); setPosts(items => items.filter(p => p.id !== id)); setNotice('게시물을 삭제했습니다.'); }
    catch (e) { setError(e.message || '게시물을 삭제하지 못했습니다.'); }
  };
  const prettyDate = (value) => { try { return new Date(value).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };
  return <main className="app-shell">
    <aside className="side-rail"><a className="brand" href="#feed"><span className="brand-icon"><Activity size={21}/></span><span className="rail-brand">FIT<span>NOVA</span></span></a><div className="rail-nav">{nav.map(item=><button key={item.id} className={tab===item.id?'selected':''} onClick={()=>setTab(item.id)}><item.icon size={20}/><span>{item.label}</span></button>)}</div><div className="rail-bottom"><div className="avatar">{user.username.slice(0,1).toUpperCase()}</div><button className="rail-logout" onClick={logout} aria-label="로그아웃"><LogOut size={18}/></button></div></aside>
    <section className="dashboard-main"><header className="dash-top"><div><div className="eyebrow"><Sparkles size={13}/> MOVE. CONNECT. EVOLVE.</div><h1>{tab==='feed'?'함께 성장하는 피드':tab==='home'?'오늘도 한 단계 성장해요':'나의 FITNOVA'}</h1></div><div className="top-actions"><button className="icon-surface" aria-label="피드 새로고침" onClick={loadPosts}><Bell size={19}/></button><button className="user-chip" onClick={()=>setProfileOpen(!profileOpen)}><span className="avatar">{user.username.slice(0,1).toUpperCase()}</span><span><b>{user.username}</b><small>FITNOVA 멤버</small></span></button>{profileOpen&&<div className="profile-pop"><b>{user.username}</b><span>{user.email}</span><button onClick={logout}><LogOut size={15}/> 로그아웃</button></div>}</div></header>
    {error&&<div className="alert error feed-alert">{error}</div>}{notice&&<div className="alert success feed-alert">{notice}</div>}
    {tab==='feed'&&<section className="feed-layout"><div className="feed-heading"><div><span className="eyebrow">FITNOVA COMMUNITY</span><h2>오늘의 움직임을 공유해요.</h2><p>기록을 나누고 서로의 도전을 응원하세요.</p></div><button className="refresh-button" onClick={loadPosts}><Activity size={16}/> 새로고침</button></div>
      <form className="composer" onSubmit={createPost}><div className="composer-avatar">{user.username.slice(0,1).toUpperCase()}</div><div className="composer-main"><label htmlFor="post-content">새 게시물 작성</label><textarea id="post-content" value={draft} onChange={e=>setDraft(e.target.value.slice(0,2000))} placeholder="오늘의 운동, 목표, 성취를 공유해 보세요..." rows={3} maxLength={2000}/><div className="composer-bottom"><span>{draft.length}/2000</span><button className="primary compact" disabled={busy||!draft.trim()}><Send size={15}/>{busy?'게시 중...':'게시하기'}</button></div></div></form>
      <div className="feed-list">{posts.length===0?<div className="empty-feed"><div className="empty-art"><Users size={34}/></div><h3>첫 번째 게시물을 기다리고 있어요</h3><p>오늘의 운동이나 작은 목표를 공유해 FITNOVA 커뮤니티를 시작해 보세요.</p></div>:posts.map(post=><article className="post-card" key={post.id}><div className="post-top"><div className="post-author"><div className="composer-avatar">{(post.author_username||'?').slice(0,1).toUpperCase()}</div><div><b>{post.author_username}</b><small>{prettyDate(post.created_at)}</small></div></div>{post.author_username===user.username&&<button className="delete-post" onClick={()=>removePost(post.id)} aria-label="게시물 삭제"><Trash2 size={17}/></button>}</div><p className="post-content">{post.content}</p><div className="post-actions"><button className={post.liked_by_me?'liked':''} onClick={()=>toggleLike(post.id)}><Heart size={17} fill={post.liked_by_me?'currentColor':'none'}/><span>좋아요 {post.like_count||0}</span></button><span className="comment-count"><MessageCircle size={17}/>{(post.comments||[]).length}개 댓글</span></div>{(post.comments||[]).length>0&&<div className="comments-list">{post.comments.map(comment=><div className="comment" key={comment.id}><b>{comment.author_username}</b><span>{comment.content}</span></div>)}</div>}<form className="comment-form" onSubmit={e=>{e.preventDefault();addComment(post.id);}}><input aria-label="댓글 입력" value={commentDrafts[post.id]||''} onChange={e=>setCommentDrafts(items=>({...items,[post.id]:e.target.value.slice(0,500)}))} placeholder="응원의 댓글을 남겨보세요..." maxLength={500}/><button type="submit" disabled={!(commentDrafts[post.id]||'').trim()} aria-label="댓글 등록"><Send size={16}/></button></form></article>)}</div>
    </section>}
    {tab==='home'&&<><section className="welcome-banner"><div className="welcome-copy"><span className="pill"><Zap size={13}/> YOUR DAILY MOMENTUM</span><h2>꾸준함이 만드는<br/><em>놀라운 변화.</em></h2><p>오늘의 작은 움직임이 내일의 새로운 기록이 됩니다.</p><button className="primary compact" onClick={()=>setTab('feed')}>피드 둘러보기 <ArrowRight size={16}/></button></div><div className="banner-orbit"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="orbit-core"><Activity size={48}/></div><span className="orbit-tag">KEEP MOVING</span></div></section><section className="panel home-community"><div className="panel-heading"><div><h3>커뮤니티가 메인입니다</h3><p>게시물 작성과 좋아요, 댓글을 피드에서 사용할 수 있어요.</p></div><span className="panel-icon"><Users size={18}/></span></div><button className="primary compact" onClick={()=>setTab('feed')}>피드로 이동 <ArrowRight size={16}/></button></section></>}
    {tab==='profile'&&<section className="module-view"><div className="profile-card"><div className="profile-avatar">{user.username.slice(0,1).toUpperCase()}</div><span className="eyebrow">YOUR ACCOUNT</span><h2>{user.username}</h2><p>{user.email}</p><span className="verified-pill"><CheckCircle2 size={14}/> 이메일 인증 완료</span><div className="profile-details"><div><span>계정 상태</span><b>활성</b></div><div><span>회원 유형</span><b>FITNOVA 멤버</b></div><div><span>로그인 보안</span><b>이메일 코드 인증</b></div></div><button className="logout-full" onClick={logout}><LogOut size={17}/> 로그아웃</button></div></section>}
    <footer className="dash-footer"><span>© 2026 FITNOVA</span><span>MOVE. CONNECT. EVOLVE.</span><span className="footer-dot"><i/> YOUR NEXT LEVEL</span></footer></section>
    <nav className="mobile-nav">{nav.map(item=><button key={item.id} className={tab===item.id?'selected':''} onClick={()=>setTab(item.id)}><item.icon size={20}/><span>{item.label}</span></button>)}</nav>
  </main>;
}

function Stat({ icon: Icon, label, value, unit, note }) {
  return <section className="stat-card"><div className="stat-top"><span className="stat-icon"><Icon size={19}/></span><span className="stat-label">{label}</span></div><div className="stat-value">{value}<small>{unit}</small></div><p>{note}</p></section>;
}

createRoot(document.getElementById('root')).render(<App/>);
