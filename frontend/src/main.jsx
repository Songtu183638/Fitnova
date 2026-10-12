import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity, ArrowRight, Bell, CheckCircle2, Compass, Eye, EyeOff, Flame,
  Footprints, Heart, Home, LockKeyhole, LogOut, Mail, MessageCircle,
  Play, Plus, ShieldCheck, Sparkles, TrendingUp, UserRound, Users, Wallet,
  X, Zap
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
  const [tab, setTab] = useState('home');
  const [runActive, setRunActive] = useState(false);

  useEffect(() => {
    let active = true;
    const token = sessionStorage.getItem(TOKEN_KEY);
    if (!token) { setBooting(false); return () => { active = false; }; }
    api('/api/auth/me')
      .then(data => { if (active) setUser(data.user); })
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
    setTab('home');
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
      } else {
        const data = await request('/api/auth/login', { identifier: identifier.trim(), password });
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
    setUser(null); setTab('home'); setMode('login'); setStep('form');
    setPassword(''); setError(''); setNotice('안전하게 로그아웃했습니다.');
  };

  if (booting) return <main className="boot-screen"><div className="boot-logo"><Activity size={28}/></div><b>FIT<span>NOVA</span></b><div className="boot-track"><i/></div><small>세션을 확인하고 있어요</small></main>;
  if (user) return <Dashboard user={user} tab={tab} setTab={setTab} logout={logout} runActive={runActive} setRunActive={setRunActive} />;

  return <main className="shell"><nav className="topbar"><a className="brand" href="#top"><span className="brand-icon"><Activity size={20}/></span> FIT<span>NOVA</span></a><div className="status"><i/> YOUR FITNESS UNIVERSE</div></nav><section className="hero" id="top"><div className="hero-copy"><div className="eyebrow"><Sparkles size={14}/> YOUR NEXT LEVEL STARTS HERE</div><h1>움직임이 모여<br/><em>새로운 나</em>가 되다.</h1><p className="lead">기록하고, 연결하고, 함께 성장해.<br/>당신의 피트니스 라이프를 새롭게.</p><div className="feature-row"><div><span className="feature-icon"><Flame size={18}/></span><b>매일의 기록</b><small>작은 변화의 축적</small></div><div><span className="feature-icon"><UserRound size={18}/></span><b>함께하는 성장</b><small>운동으로 이어지는 연결</small></div></div><div className="quote"><div className="quote-line"/> <span>MOVE WITH PURPOSE. LIVE WITH ENERGY.</span></div></div><section className="auth-card"><div className="card-head"><div className="mini-mark"><Activity size={19}/></div><div className="card-kicker">WELCOME TO FITNOVA</div><h2>{mode==='register'?(step==='verify'?'이메일을 확인해 주세요':'계정 만들기'):'다시 만나 반가워요'}</h2><p>{mode==='register'?(step==='verify'?'이메일로 받은 6자리 코드를 입력하세요.':'새로운 피트니스 여정을 시작하세요.'):'계정에 로그인하고 여정을 이어가세요.'}</p></div><div className="tabs"><button className={mode==='register'?'active':''} onClick={()=>switchMode('register')}>회원가입</button><button className={mode==='login'?'active':''} onClick={()=>switchMode('login')}>로그인</button></div><form onSubmit={submit}>{mode==='register'&&step==='form'&&<label>아이디<div className="input-wrap"><UserRound size={17}/><input required minLength="3" maxLength="24" pattern="[A-Za-z0-9_]+" value={username} onChange={e=>setUsername(e.target.value)} placeholder="영문, 숫자, 밑줄 3~24자" autoComplete="username"/></div></label>}{mode==='register'&&step==='form'&&<label>이메일<div className="input-wrap"><Mail size={17}/><input required type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@example.com" autoComplete="email"/></div></label>}{mode==='login'&&<label>아이디 또는 이메일<div className="input-wrap"><UserRound size={17}/><input required value={identifier} onChange={e=>setIdentifier(e.target.value)} placeholder="아이디 또는 이메일" autoComplete="username"/></div></label>}{mode==='register'&&step==='verify'&&<><label>인증 이메일<div className="input-wrap"><Mail size={17}/><input type="email" required value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email"/></div></label><label>6자리 인증 코드<div className="input-wrap code-wrap"><ShieldCheck size={17}/><input required inputMode="numeric" pattern="[0-9]{6}" maxLength="6" value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="000000" className="code-input"/></div></label></>}{((mode==='register'&&step==='form')||mode==='login')&&<label>비밀번호<div className="input-wrap"><LockKeyhole size={17}/><input required minLength={mode==='register'?10:1} maxLength="128" type={show?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder={mode==='register'?'10자 이상 입력':'비밀번호 입력'} autoComplete={mode==='register'?'new-password':'current-password'}/><button type="button" className="icon-button" onClick={()=>setShow(!show)} aria-label="비밀번호 표시">{show?<EyeOff size={17}/>:<Eye size={17}/>}</button></div>{mode==='register'&&<small className="hint">안전한 계정을 위해 10자 이상 사용해 주세요.</small>}</label>}{error&&<div className="alert error">{error}</div>}{notice&&<div className="alert success"><CheckCircle2 size={16}/>{notice}</div>}<button className="primary" disabled={busy}>{busy?'처리 중...':mode==='register'?(step==='verify'?'인증하고 시작하기':'인증 코드 받기'):'로그인하고 시작하기'}<ArrowRight size={17}/></button>{step==='verify'&&mode==='register'&&<button type="button" className="text-button" onClick={()=>{setStep('form');setError('');setNotice('');}}>가입 정보 수정</button>}</form><div className="secure-note"><ShieldCheck size={15}/><span>안전한 인증 · 비밀번호 보호 · 개인정보 존중</span></div></section></section><footer><span>© 2026 FITNOVA</span><span>MOVE. CONNECT. EVOLVE.</span><span className="footer-dot"><i/> BUILT FOR YOUR NEXT LEVEL</span></footer></main>;
}

function Dashboard({ user, tab, setTab, logout, runActive, setRunActive }) {
  const [profileOpen, setProfileOpen] = useState(false);
  const nav = [
    { id: 'home', label: '홈', icon: Home }, { id: 'run', label: '러닝', icon: Footprints },
    { id: 'feed', label: '피드', icon: Compass }, { id: 'profile', label: '프로필', icon: UserRound }
  ];
  return <main className="app-shell">
    <aside className="side-rail"><a className="brand" href="#home"><span className="brand-icon"><Activity size={21}/></span><span className="rail-brand">FIT<span>NOVA</span></span></a><div className="rail-nav">{nav.map(item=><button key={item.id} className={tab===item.id?'selected':''} onClick={()=>setTab(item.id)}><item.icon size={20}/><span>{item.label}</span></button>)}</div><div className="rail-bottom"><div className="avatar">{user.username.slice(0,1).toUpperCase()}</div><button className="rail-logout" onClick={logout} aria-label="로그아웃"><LogOut size={18}/></button></div></aside>
    <section className="dashboard-main"><header className="dash-top"><div><div className="eyebrow"><Sparkles size={13}/> MOVE. CONNECT. EVOLVE.</div><h1>{tab==='home'?'오늘도 한 단계 성장해요':tab==='run'?'움직임을 기록해요':tab==='feed'?'함께 성장하는 피드':'나의 FITNOVA'}</h1></div><div className="top-actions"><button className="icon-surface" aria-label="알림"><Bell size={19}/></button><button className="user-chip" onClick={()=>setProfileOpen(!profileOpen)}><span className="avatar">{user.username.slice(0,1).toUpperCase()}</span><span><b>{user.username}</b><small>FITNOVA 멤버</small></span></button>{profileOpen&&<div className="profile-pop"><b>{user.username}</b><span>{user.email}</span><button onClick={logout}><LogOut size={15}/> 로그아웃</button></div>}</div></header>
    {tab==='home'&&<><section className="welcome-banner"><div className="welcome-copy"><span className="pill"><Zap size={13}/> YOUR DAILY MOMENTUM</span><h2>꾸준함이 만드는<br/><em>놀라운 변화.</em></h2><p>오늘의 작은 움직임이 내일의 새로운 기록이 됩니다.</p><button className="primary compact" onClick={()=>setTab('run')}>러닝 시작하기 <ArrowRight size={16}/></button></div><div className="banner-orbit"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="orbit-core"><Activity size={48}/></div><span className="orbit-tag">KEEP MOVING</span></div></section>
      <div className="section-title"><div><span className="eyebrow">YOUR OVERVIEW</span><h2>오늘의 대시보드</h2></div><span className="today-label">TODAY · {new Date().toLocaleDateString('ko-KR',{month:'long',day:'numeric',weekday:'short'})}</span></div>
      <div className="stat-grid"><Stat icon={Footprints} label="오늘의 거리" value="0.00" unit="km" note="첫 러닝을 시작해 보세요"/><Stat icon={Flame} label="소모 칼로리" value="0" unit="kcal" note="운동 후 기록돼요"/><Stat icon={TrendingUp} label="활동 시간" value="0" unit="분" note="움직임을 쌓아 보세요"/></div>
      <div className="lower-grid"><section className="panel activity-panel"><div className="panel-heading"><div><h3>주간 활동</h3><p>매일의 기록이 습관이 돼요</p></div><span className="panel-icon"><Activity size={18}/></span></div><div className="week-bars">{['월','화','수','목','금','토','일'].map((d,i)=><div className="week-day" key={d}><div className="bar-track"><i style={{height:i===6?'12%':'4%'}}/></div><small>{d}</small></div>)}</div><div className="empty-note">아직 기록이 없어요. 오늘 첫 활동을 남겨보세요.</div></section><section className="panel quick-panel"><div className="panel-heading"><div><h3>빠른 시작</h3><p>원하는 활동으로 바로 이동</p></div><span className="panel-icon"><Zap size={18}/></span></div><button className="quick-action" onClick={()=>setTab('run')}><span className="quick-icon"><Footprints size={20}/></span><span><b>러닝 기록</b><small>거리와 시간을 기록해요</small></span><ArrowRight size={17}/></button><button className="quick-action" onClick={()=>setTab('feed')}><span className="quick-icon"><Users size={20}/></span><span><b>커뮤니티 피드</b><small>운동 이야기를 둘러봐요</small></span><ArrowRight size={17}/></button></section></div>
    </>}
    {tab==='run'&&<section className="module-view"><div className="module-card run-card"><div className="run-symbol"><Footprints size={34}/></div><span className="eyebrow">RUN TRACKER</span><h2>{runActive?'러닝 세션이 준비됐어요':'오늘의 러닝을 시작해요'}</h2><p>지금은 러닝 화면의 기본 진입 단계입니다. GPS 거리·시간 기록은 위치 권한과 러닝 기록 API를 연결한 뒤 활성화됩니다.</p><div className="run-metrics"><div><small>거리</small><b>0.00 <i>km</i></b></div><div><small>시간</small><b>00:00</b></div><div><small>페이스</small><b>--:-- <i>/km</i></b></div></div><button className="primary compact" onClick={()=>setRunActive(!runActive)}>{runActive?'준비 상태로 돌아가기':'러닝 기능 준비하기'} {runActive?<X size={16}/>:<Play size={16}/>}</button></div></section>}
    {tab==='feed'&&<section className="module-view"><div className="module-heading"><div><span className="eyebrow">COMMUNITY</span><h2>함께 성장하는 피드</h2><p>운동 기록을 공유하고 서로의 도전을 응원해요.</p></div><span className="module-icon"><MessageCircle size={22}/></span></div><div className="empty-feed"><div className="empty-art"><Users size={34}/></div><h3>피드를 준비하고 있어요</h3><p>현재 서버는 인증 기능까지 연결되어 있습니다. 게시물·팔로우 API가 추가되면 이 공간에서 실제 피드를 보여줄 수 있어요.</p><button className="secondary-action" onClick={()=>setTab('home')}>홈으로 돌아가기 <ArrowRight size={15}/></button></div></section>}
    {tab==='profile'&&<section className="module-view"><div className="profile-card"><div className="profile-avatar">{user.username.slice(0,1).toUpperCase()}</div><span className="eyebrow">YOUR ACCOUNT</span><h2>{user.username}</h2><p>{user.email}</p><span className="verified-pill"><CheckCircle2 size={14}/> 이메일 인증 완료</span><div className="profile-details"><div><span>계정 상태</span><b>활성</b></div><div><span>회원 유형</span><b>FITNOVA 멤버</b></div><div><span>로그인 보안</span><b>토큰 인증</b></div></div><button className="logout-full" onClick={logout}><LogOut size={17}/> 로그아웃</button></div></section>}
    <footer className="dash-footer"><span>© 2026 FITNOVA</span><span>MOVE. CONNECT. EVOLVE.</span><span className="footer-dot"><i/> YOUR NEXT LEVEL</span></footer></section>
    <nav className="mobile-nav">{nav.map(item=><button key={item.id} className={tab===item.id?'selected':''} onClick={()=>setTab(item.id)}><item.icon size={20}/><span>{item.label}</span></button>)}</nav>
  </main>;
}

function Stat({ icon: Icon, label, value, unit, note }) {
  return <section className="stat-card"><div className="stat-top"><span className="stat-icon"><Icon size={19}/></span><span className="stat-label">{label}</span></div><div className="stat-value">{value}<small>{unit}</small></div><p>{note}</p></section>;
}

createRoot(document.getElementById('root')).render(<App/>);
