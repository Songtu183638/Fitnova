import React, { useMemo, useState } from 'react';
import { Activity, ArrowDownRight, ArrowUpRight, CalendarDays, ChevronDown, Clock3, Dumbbell, Flame, RefreshCw, Sparkles, Target, TrendingUp, Trophy, Waves } from 'lucide-react';

const number = value => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
};
const asDate = value => {
  const d = value ? new Date(value) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
};
const formatDate = value => {
  const d = asDate(value);
  return d ? d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }) : '날짜 미상';
};
const formatMinutes = value => {
  const mins = Math.round(number(value));
  return mins >= 60 ? `${Math.floor(mins / 60)}시간 ${mins % 60}분` : `${mins}분`;
};
const hasWorkoutData = post => Boolean(
  String(post?.exercise_name || '').trim() ||
  number(post?.duration_minutes) ||
  number(post?.sets_count) ||
  String(post?.reps || '').trim() ||
  String(post?.workout_notes || '').trim()
);
const muscleFor = value => {
  const name = String(value || '').toLowerCase();
  if (/하체|스쿼트|런지|레그|허벅지|종아리|squat|leg|lunge|calf/.test(name)) return '하체';
  if (/가슴|벤치|푸시업|푸쉬업|체스트|chest|bench|push.?up/.test(name)) return '가슴';
  if (/등|랫풀|풀업|로우|데드리프트|back|lat|pull.?up|row|deadlift/.test(name)) return '등';
  if (/어깨|숄더|레터럴|shoulder|lateral|overhead/.test(name)) return '어깨';
  if (/팔|이두|삼두|컬|tricep|bicep|curl|arm/.test(name)) return '팔';
  if (/달리기|러닝|걷기|사이클|수영|run|walk|cycle|swim|cardio/.test(name)) return '유산소';
  return '기타';
};

export default function WorkoutAnalysisPanel({ posts = [], onCreatePost, onRefresh }) {
  const [period, setPeriod] = useState('30');
  const [view, setView] = useState('overview');
  const [expanded, setExpanded] = useState(false);
  const records = useMemo(() => posts
    .filter(hasWorkoutData)
    .map(post => ({ ...post, _date: asDate(post.created_at), _exercise: String(post.exercise_name || post.title || '운동 기록').trim() || '운동 기록' }))
    .sort((a, b) => (b._date?.getTime() || 0) - (a._date?.getTime() || 0)), [posts]);
  const filtered = useMemo(() => {
    if (period === 'all') return records;
    const cutoff = Date.now() - Number(period) * 86400000;
    return records.filter(item => item._date && item._date.getTime() >= cutoff);
  }, [records, period]);
  const stats = useMemo(() => {
    const sessions = filtered.length;
    const minutes = filtered.reduce((sum, item) => sum + number(item.duration_minutes), 0);
    const sets = filtered.reduce((sum, item) => sum + number(item.sets_count), 0);
    const exerciseCounts = {};
    const muscleCounts = {};
    filtered.forEach(item => {
      exerciseCounts[item._exercise] = (exerciseCounts[item._exercise] || 0) + 1;
      const group = muscleFor(item._exercise);
      muscleCounts[group] = (muscleCounts[group] || 0) + 1;
    });
    const topExercise = Object.entries(exerciseCounts).sort((a, b) => b[1] - a[1])[0];
    const activeDays = new Set(filtered.map(item => item._date?.toLocaleDateString('en-CA')).filter(Boolean)).size;
    return { sessions, minutes, sets, activeDays, topExercise, muscleCounts };
  }, [filtered]);
  const week = useMemo(() => {
    const today = new Date();
    const start = new Date(today);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - 6);
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return { date, key: date.toLocaleDateString('en-CA'), label: date.toLocaleDateString('ko-KR', { weekday: 'short' }), count: 0, minutes: 0, today: index === 6 };
    });
    const byKey = new Map(days.map(day => [day.key, day]));
    records.forEach(item => {
      if (!item._date) return;
      const key = item._date.toLocaleDateString('en-CA');
      const day = byKey.get(key);
      if (day) { day.count += 1; day.minutes += number(item.duration_minutes); }
    });
    return days;
  }, [records]);
  const maxSessions = Math.max(1, ...week.map(day => day.count));
  const recent = filtered.slice(0, expanded ? filtered.length : 5);
  const bestMuscle = Object.entries(stats.muscleCounts).sort((a, b) => b[1] - a[1])[0];
  const previousCutoff = Date.now() - (period === 'all' ? 60 : Number(period) * 2) * 86400000;
  const previous = period === 'all' ? [] : records.filter(item => item._date && item._date.getTime() >= previousCutoff && item._date.getTime() < Date.now() - Number(period) * 86400000);
  const change = previous.length ? Math.round(((stats.sessions - previous.length) / previous.length) * 100) : null;

  return <section className="workout-analysis-page">
    <div className="wa-hero">
      <div className="wa-hero-copy">
        <span className="wa-kicker"><span className="wa-live-dot"/> FITNOVA PERFORMANCE LAB</span>
        <h2>숫자로 확인하고,<br/><em>더 강하게 성장하세요.</em></h2>
        <p>내 운동 기록을 한곳에 모아 흐름과 습관을 읽어보세요.</p>
        <div className="wa-hero-meta"><span><Activity size={14}/> 기록 기반 분석</span><i/><span><Target size={14}/> 개인 성장 리포트</span></div>
      </div>
      <div className="wa-orbit-art" aria-hidden="true"><div className="wa-orbit wa-orbit-a"/><div className="wa-orbit wa-orbit-b"/><div className="wa-orbit-core"><TrendingUp size={34}/></div><span className="wa-orbit-label">YOUR<br/>NEXT LEVEL</span></div>
    </div>

    <div className="wa-toolbar">
      <div className="wa-view-switch" role="tablist" aria-label="분석 보기">
        <button className={view === 'overview' ? 'active' : ''} onClick={() => setView('overview')} role="tab" aria-selected={view === 'overview'}>개요</button>
        <button className={view === 'records' ? 'active' : ''} onClick={() => setView('records')} role="tab" aria-selected={view === 'records'}>운동 기록</button>
      </div>
      <label className="wa-period-select"><CalendarDays size={15}/><select value={period} onChange={e => setPeriod(e.target.value)} aria-label="분석 기간"><option value="7">최근 7일</option><option value="30">최근 30일</option><option value="90">최근 90일</option><option value="all">전체 기간</option></select><ChevronDown size={14}/></label>
      <button className="wa-refresh" onClick={onRefresh} type="button"><RefreshCw size={15}/> 새로고침</button>
    </div>

    {records.length === 0 ? <div className="wa-empty">
      <div className="wa-empty-symbol"><Dumbbell size={28}/><span>+</span></div>
      <span className="wa-eyebrow">YOUR DATA STARTS HERE</span>
      <h3>첫 번째 운동 데이터를 만들어 볼까요?</h3>
      <p>게시물을 작성할 때 운동 종류, 세트 수, 운동 시간 또는 횟수 정보를 입력하면 이곳에서 분석할 수 있어요. 데이터가 없는 항목은 임의로 채우지 않습니다.</p>
      <button className="wa-primary" onClick={onCreatePost}><Dumbbell size={16}/> 운동 정보가 포함된 게시물 작성</button>
    </div> : <>
      <div className="wa-stats-grid">
        <article className="wa-stat-card wa-stat-featured"><div className="wa-stat-top"><span>운동 세션</span><span className="wa-stat-icon"><Activity size={17}/></span></div><strong>{stats.sessions}<small>회</small></strong><div className="wa-stat-foot"><span>{period === 'all' ? '전체 기록' : `최근 ${period}일 기준`}</span>{change !== null && <span className={change >= 0 ? 'wa-trend-up' : 'wa-trend-down'}>{change >= 0 ? <ArrowUpRight size={13}/> : <ArrowDownRight size={13}/>} {Math.abs(change)}%</span>}</div></article>
        <article className="wa-stat-card"><div className="wa-stat-top"><span>운동 시간</span><span className="wa-stat-icon"><Clock3 size={17}/></span></div><strong>{Math.floor(stats.minutes / 60) > 0 ? `${Math.floor(stats.minutes / 60)}<i>h</i> ` : ''}{stats.minutes % 60}<small>분</small></strong><div className="wa-stat-foot"><span>시간 정보가 입력된 기록 기준</span></div></article>
        <article className="wa-stat-card"><div className="wa-stat-top"><span>총 세트</span><span className="wa-stat-icon"><Dumbbell size={17}/></span></div><strong>{stats.sets.toLocaleString('ko-KR')}<small>세트</small></strong><div className="wa-stat-foot"><span>세트 수가 입력된 기록 기준</span></div></article>
        <article className="wa-stat-card"><div className="wa-stat-top"><span>활동한 날짜</span><span className="wa-stat-icon"><CalendarDays size={17}/></span></div><strong>{stats.activeDays}<small>일</small></strong><div className="wa-stat-foot"><span>중복 날짜는 한 번만 계산</span></div></article>
      </div>

      {view === 'overview' ? <>
        <div className="wa-main-grid">
          <article className="wa-panel wa-week-panel">
            <div className="wa-panel-head"><div><span className="wa-eyebrow">CONSISTENCY TRACKER</span><h3>최근 7일 활동 리듬</h3><p>운동 기록을 남긴 날을 기준으로 집계합니다.</p></div><span className="wa-panel-badge"><Waves size={14}/> 7 DAYS</span></div>
            <div className="wa-chart" role="img" aria-label="최근 7일 운동 기록 횟수 그래프">{week.map(day => <div className={'wa-chart-day ' + (day.today ? 'today' : '')} key={day.key}><span className="wa-chart-value">{day.count || '—'}</span><div className="wa-chart-track"><i style={{ height: day.count ? `${Math.max(12, day.count / maxSessions * 100)}%` : '3px' }}/></div><b>{day.label}</b><small>{day.date.getDate()}일</small></div>)}</div>
            <div className="wa-chart-summary"><span><i/> 운동 기록이 있는 날</span><strong>{week.reduce((sum, day) => sum + day.count, 0)}회 기록</strong></div>
          </article>
          <article className="wa-panel wa-insight-panel">
            <div className="wa-panel-head"><div><span className="wa-eyebrow">PERSONAL INSIGHT</span><h3>나의 운동 패턴</h3></div><span className="wa-insight-spark"><Sparkles size={17}/></span></div>
            {stats.topExercise ? <div className="wa-insight-main"><div className="wa-insight-icon"><Trophy size={20}/></div><div><small>가장 자주 기록한 운동</small><strong>{stats.topExercise[0]}</strong><span>{stats.topExercise[1]}회 기록됨</span></div></div> : <div className="wa-insight-main"><div className="wa-insight-icon"><Target size={20}/></div><div><small>다음 분석 목표</small><strong>운동 종류 입력하기</strong><span>운동 이름을 기록하면 패턴을 찾을 수 있어요.</span></div></div>}
            <div className="wa-insight-divider"/>
            <div className="wa-insight-row"><span>가장 많이 기록된 분류</span><b>{bestMuscle ? bestMuscle[0] : '데이터 수집 중'}</b></div>
            <div className="wa-insight-row"><span>기록당 평균 운동 시간</span><b>{filtered.filter(item => number(item.duration_minutes)).length ? `${Math.round(stats.minutes / filtered.filter(item => number(item.duration_minutes)).length)}분` : '미입력'}</b></div>
            <p className="wa-insight-note">분류는 운동 이름에 포함된 단어를 바탕으로 자동 추정하며, 의료적 평가나 운동 처방이 아닙니다.</p>
          </article>
        </div>
        <article className="wa-panel wa-record-panel">
          <div className="wa-panel-head"><div><span className="wa-eyebrow">LATEST SESSIONS</span><h3>최근 운동 기록</h3><p>입력한 실제 운동 정보만 표시합니다.</p></div><button className="wa-text-action" onClick={() => setView('records')}>전체 기록 보기 <ArrowUpRight size={15}/></button></div>
          <div className="wa-record-list">{recent.slice(0, 4).map(item => <RecordRow key={item.id} item={item}/>)}</div>
        </article>
      </> : <article className="wa-panel wa-record-panel wa-all-records">
        <div className="wa-panel-head"><div><span className="wa-eyebrow">WORKOUT HISTORY</span><h3>운동 기록 타임라인</h3><p>{filtered.length}개의 기록이 기간에 포함됩니다.</p></div></div>
        {recent.length ? <><div className="wa-record-list">{recent.map(item => <RecordRow key={item.id} item={item}/>)}</div>{filtered.length > 5 && <button className="wa-show-more" onClick={() => setExpanded(!expanded)}>{expanded ? '간단히 보기' : `기록 ${filtered.length - 5}개 더 보기`}</button>}</> : <div className="wa-no-results">선택한 기간에 운동 기록이 없어요. 기간을 바꾸면 이전 기록을 확인할 수 있습니다.</div>}
      </article>}
      <div className="wa-footnote"><span className="wa-footnote-dot"/> 분석 결과는 FITNOVA에 저장된 게시물의 운동 정보를 바탕으로 계산됩니다. 입력하지 않은 칼로리·심박수·중량은 추정하지 않습니다.</div>
    </>}
  </section>;
}

function RecordRow({ item }) {
  const exercise = item._exercise;
  const details = [
    number(item.duration_minutes) ? formatMinutes(item.duration_minutes) : null,
    number(item.sets_count) ? `${number(item.sets_count)}세트` : null,
    String(item.reps || '').trim() || null
  ].filter(Boolean);
  return <article className="wa-record-row">
    <div className="wa-record-date"><span>{item._date ? item._date.toLocaleDateString('ko-KR', { weekday: 'short' }) : '기록'}</span><b>{formatDate(item.created_at)}</b></div>
    <div className="wa-record-symbol"><Dumbbell size={18}/></div>
    <div className="wa-record-info"><strong>{exercise}</strong><span>{String(item.title || item.content || '운동 기록').slice(0, 84)}</span><div className="wa-record-tags">{details.length ? details.map((detail, index) => <small key={index}>{detail}</small>) : <small>세부 정보 없음</small>}</div></div>
    <span className="wa-record-arrow"><ArrowUpRight size={16}/></span>
  </article>;
}
