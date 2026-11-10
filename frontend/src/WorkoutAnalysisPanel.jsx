import React, { useMemo, useState } from 'react';
import { Activity, CalendarDays, Check, ChevronDown, Clock3, Dumbbell, Plus, Save, Target, Trash2, TrendingUp, Trophy, Weight, X } from 'lucide-react';

const CATEGORIES = {
  'Chest': [
    '바벨 벤치프레스', '덤벨 벤치프레스', '스미스머신 벤치프레스', '머신 체스트 프레스', '인클라인 바벨 벤치프레스', '인클라인 덤벨 프레스', '인클라인 스미스머신 프레스', '인클라인 체스트 프레스',
    '디클라인 벤치프레스', '디클라인 덤벨 프레스', '덤벨 플라이', '인클라인 덤벨 플라이', '케이블 플라이', '하이 케이블 플라이', '로우 케이블 플라이', '펙덱 플라이', '머신 플라이',
    '푸시업', '와이드 푸시업', '인클라인 푸시업', '디클라인 푸시업', '무릎 푸시업', '아처 푸시업', '딥스(Chest)', '풀오버', '덤벨 풀오버', '케이블 풀오버', '랜드마인 프레스'
  ],
  'Back': [
    '컨벤셔널 데드리프트', '스모 데드리프트', '랙 풀', '루마니안 데드리프트', '바벨 벤트오버 로우', '펜들레이 로우', '언더그립 바벨 로우', '티바 로우', '체스트 서포티드 로우', '덤벨 원암 로우',
    '시티드 케이블 로우', '와이드 그립 시티드 로우', '클로즈 그립 시티드 로우', '머신 로우', '플레이트 로드 로우', '랜드마인 로우', '랫풀다운', '와이드 그립 랫풀다운', '언더그립 랫풀다운', '뉴트럴 그립 랫풀다운',
    '스트레이트 암 풀다운', '케이블 풀오버', '풀업', '친업', '어시스트 풀업', '중립 그립 풀업', '머신 풀업', '덤벨 슈러그', '바벨 슈러그', '머신 슈러그', '백 익스텐션', '리버스 하이퍼'
  ],
  'Shoulders': [
    '스탠딩 바벨 오버헤드 프레스', '시티드 바벨 숄더 프레스', '덤벨 숄더 프레스', '아놀드 프레스', '머신 숄더 프레스', '스미스머신 숄더 프레스', '랜드마인 숄더 프레스', '덤벨 레터럴 레이즈',
    '케이블 레터럴 레이즈', '머신 레터럴 레이즈', '인클라인 레터럴 레이즈', '원암 레터럴 레이즈', '덤벨 프론트 레이즈', '바벨 프론트 레이즈', '케이블 프론트 레이즈', '플레이트 프론트 레이즈',
    '리어 델트 플라이', '리버스 펙덱', '벤트오버 덤벨 레이즈', '케이블 리어 델트 플라이', '페이스 풀', '업라이트 로우', '바벨 업라이트 로우', '덤벨 슈러그', '바벨 슈러그', '케이블 슈러그', 'Y 레이즈', '터키시 겟업'
  ],
  'Biceps': [
    '바벨 컬', '이지바 컬', '덤벨 컬', '교대 덤벨 컬', '시티드 덤벨 컬', '인클라인 덤벨 컬', '프리처 컬', '머신 프리처 컬', '케이블 컬', '로우 케이블 컬', '하이 케이블 컬',
    '해머 컬', '크로스바디 해머 컬', '로프 해머 컬', '컨센트레이션 컬', '스파이더 컬', '드래그 컬', '리버스 컬', '치팅 컬', '원암 케이블 컬', '친업(Biceps 중심)'
  ],
  'Triceps': [
    '케이블 푸시다운', '로프 푸시다운', '바 푸시다운', '리버스 그립 푸시다운', '오버헤드 케이블 익스텐션', '로프 오버헤드 익스텐션', '덤벨 오버헤드 익스텐션', '원암 덤벨 익스텐션',
    '라잉 트라이셉스 익스텐션', '스컬크러셔', '이지바 스컬크러셔', '클로즈 그립 벤치프레스', '덤벨 킥백', '케이블 킥백', '머신 트라이셉스 익스텐션', '벤치 딥스', '평행봉 딥스(Triceps)', 'JM 프레스', '다이아몬드 푸시업'
  ],
  'Forearms': [
    '바벨 리스트 컬', '덤벨 리스트 컬', '리버스 리스트 컬', '리버스 바벨 컬', '리버스 덤벨 컬', '해머 컬(Forearms)', '파머스 워크', '수트케이스 캐리', '데드행', '플레이트 핀치 홀드', '그립 트레이너', '손목 롤러', '바벨 홀드'
  ],
  'Quads': [
    '백 스쿼트', '프론트 스쿼트', '하이바 스쿼트', '로우바 스쿼트', '박스 스쿼트', '고블릿 스쿼트', '덤벨 스쿼트', '스미스머신 스쿼트', '핵 스쿼트', '브이 스쿼트', '레그 프레스', '수평 레그 프레스',
    '싱글 레그 프레스', '레그 익스텐션', '원레그 익스텐션', '불가리안 스플릿 스쿼트', '워킹 런지', '리버스 런지', '포워드 런지', '덤벨 런지', '바벨 런지', '스텝업', '시시 스쿼트', '스페니시 스쿼트', '월 싯'
  ],
  'Hamstrings': [
    '루마니안 데드리프트', '스티프 레그 데드리프트', '싱글 레그 루마니안 데드리프트', '굿모닝', '라이잉 레그 컬', '시티드 레그 컬', '스탠딩 레그 컬', '원레그 레그 컬', '글루트 햄 레이즈', '노르딕 햄스트링 컬', '케이블 풀스루', '45도 백 익스텐션(햄스트링)', '슬라이딩 레그 컬'
  ],
  '둔근': [
    '바벨 힙 쓰러스트', '스미스머신 힙 쓰러스트', '머신 힙 쓰러스트', '덤벨 힙 쓰러스트', '글루트 브리지', '싱글 레그 글루트 브리지', '글루트 킥백 머신', '케이블 킥백', '밴드 킥백', '케이블 풀스루',
    '케이블 힙 어브덕션', '힙 어브덕션 머신', '힙 어덕션 머신', '밴드 몬스터 워크', '클램셸', '불가리안 스플릿 스쿼트(둔근)', '스텝업(둔근)', '리버스 하이퍼'
  ],
  'Calves': [
    '스탠딩 카프 레이즈', '시티드 카프 레이즈', '레그 프레스 카프 레이즈', '싱글 레그 카프 레이즈', '덤벨 카프 레이즈', '스미스머신 카프 레이즈', '도넥 카프 레이즈', '티비얼리스 레이즈', '시티드 티비얼리스 레이즈'
  ],
  'Abs': [
    '크런치', '싯업', '디클라인 싯업', '케이블 크런치', '머신 크런치', '리버스 크런치', '행잉 레그 레이즈', '행잉 니 레이즈', '캡틴스 체어 니 레이즈', '벤치 레그 레이즈', '리닝 레그 레이즈',
    '플랭크', '사이드 플랭크', 'RKC 플랭크', '앱 휠 롤아웃', '바벨 롤아웃', '데드버그', '버드독', '러시안 트위스트', '메디신볼 트위스트', '우드찹 케이블', '팔로프 프레스', '바이시클 크런치', 'V업', '토즈 투 바', '윈드실드 와이퍼', '할로우 홀드', '마운틴 클라이머'
  ],
  '유산소': [
    '러닝머신 걷기', '러닝머신 조깅', '러닝머신 달리기', '경사 걷기', '실외 달리기', '실내 사이클', '스핀 바이크', '일립티컬', '스텝밀(천국의 계단)', '스테어 클라이머', '로잉머신', '에어 바이크', '리컴번트 바이크',
    '줄넘기', '복싱 샌드백', '섀도 복싱', '수영', '계단 오르기', '빠르게 걷기', '하이킹', '스키 에르그', '배틀로프 인터벌'
  ],
  '전신-기능성': [
    '버피', '점핑 잭', '케틀벨 스윙', '케틀벨 클린', '케틀벨 스내치', '케틀벨 고블릿 스쿼트', '케틀벨 터키시 겟업', '클린 앤 저크', '파워 클린', '행 파워 클린', '스내치', '파워 스내치',
    '쓰러스터', '월볼 샷', '슬레드 푸시', '슬레드 풀', '배틀로프', '메디신볼 슬램', '박스 점프', '점프 스쿼트', '점프 런지', 'TRX 로우', 'TRX 푸시업', 'TRX 스쿼트', '베어 크롤', '파머스 워크', '샌드백 캐리', '로프 클라임'
  ],
  '스트레칭-가동성': [
    '전신 동적 스트레칭', '고관절 가동성 루틴', '발목 가동성 운동', '흉추 reps전 스트레칭', 'Shoulders 가동성 운동', '밴드 풀어파트', '밴드 외reps전', '밴드 내reps전', '폼롤러 Back 상부', '폼롤러 대퇴사두', '폼롤러 햄스트링', '폼롤러 Calves', '햄스트링 스트레칭', '고관절 굴곡근 스트레칭', '둔근 스트레칭', '흉근 스트레칭', '광배근 스트레칭', 'Calves 스트레칭', '손목 가동성 운동'
  ],
};
const CATEGORY_LIST = Object.keys(CATEGORIES);
const asDate = value => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
};
const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const formatNum = value => number(value).toLocaleString('ko-KR', { maximumFractionDigits: 2 });
const formatDate = value => {
  const date = asDate(value);
  return date ? date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Date 미상';
};
const createExercise = (category, id) => ({ id, category, exercise_name: CATEGORIES[category][0], weight_kg: '0', sets: '3', reps: '10' });

export default function WorkoutAnalysisPanel({ records = [], onSaveRecord, onRefresh }) {
  const [period, setPeriod] = useState('30');
  const [view, setView] = useState('record');
  const [exercises, setExercises] = useState([createExercise('Chest', 'ex-1')]);
  const [nextId, setNextId] = useState(2);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const filtered = useMemo(() => {
    if (period === 'all') return records;
    const cutoff = Date.now() - Number(period) * 86400000;
    return records.filter(record => {
      const date = asDate(record.created_at);
      return date && date.getTime() >= cutoff;
    });
  }, [records, period]);
  const totals = useMemo(() => {
    const result = { sessions: filtered.length, volume: 0, sets: 0, reps: 0, exerciseCount: 0, categories: {} };
    filtered.forEach(record => {
      result.volume += number(record.total_volume_kg);
      result.sets += number(record.total_sets);
      result.reps += number(record.total_reps);
      (record.exercises || []).forEach(exercise => {
        result.exerciseCount += 1;
        const key = exercise.category || '기타';
        if (!result.categories[key]) result.categories[key] = { volume: 0, sets: 0, reps: 0, count: 0 };
        const item = result.categories[key];
        item.volume += number(exercise.volume_kg ?? (number(exercise.weight_kg) * number(exercise.sets) * number(exercise.reps)));
        item.sets += number(exercise.sets);
        item.reps += number(exercise.sets) * number(exercise.reps);
        item.count += 1;
      });
    });
    result.volume = Math.round(result.volume * 100) / 100;
    return result;
  }, [filtered]);
  const weekly = useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - 6);
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      const key = date.toLocaleDateString('en-CA');
      const count = records.filter(record => {
        const d = asDate(record.created_at);
        return d && d.toLocaleDateString('en-CA') === key;
      }).length;
      return { key, label: date.toLocaleDateString('ko-KR', { weekday: 'short' }), day: date.getDate(), count, today: i === 6 };
    });
  }, [records]);
  const maxWeekly = Math.max(1, ...weekly.map(day => day.count));
  const rankedCategories = Object.entries(totals.categories).sort((a, b) => b[1].volume - a[1].volume);
  const topCategory = rankedCategories[0];

  const addCategory = category => {
    setExercises(items => [...items, createExercise(category, `ex-${nextId}`)]);
    setNextId(id => id + 1);
    setView('record');
    setMessage('');
    setError('');
  };
  const updateExercise = (id, key, value) => setExercises(items => items.map(item => {
    if (item.id !== id) return item;
    const updated = { ...item, [key]: value };
    if (key === 'category') updated.exercise_name = CATEGORIES[value][0];
    return updated;
  }));
  const removeExercise = id => setExercises(items => items.length > 1 ? items.filter(item => item.id !== id) : items);
  const submit = async event => {
    event.preventDefault();
    setError('');
    setMessage('');
    const payloadExercises = exercises.map(item => ({
      category: item.category,
      exercise_name: item.exercise_name,
      weight_kg: Number(item.weight_kg),
      sets: Number(item.sets),
      reps: Number(item.reps),
    }));
    if (payloadExercises.some(item => !item.exercise_name || !Number.isFinite(item.weight_kg) || item.weight_kg < 0 || item.weight_kg > 1000 || !Number.isInteger(item.sets) || item.sets < 1 || !Number.isInteger(item.reps) || item.reps < 1)) {
      setError('각 운동의 Weight(kg), sets, Reps를 올바르게 입력해 주세요.');
      return;
    }
    setSaving(true);
    try {
      await onSaveRecord({ exercises: payloadExercises, note });
      setMessage('Workout Log을 Save했어요. 종합 Analytics에 합산했습니다.');
      setNote('');
      setExercises([createExercise('Chest', `ex-${nextId}`)]);
      setNextId(id => id + 1);
      setView('overview');
    } catch (e) {
      setError(e.message || 'Workout Log을 Save하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return <section className="workout-analysis-page">
    <div className="wa-hero">
      <div className="wa-hero-copy">
        <span className="wa-kicker"><span className="wa-live-dot"/> FITNOVA PERFORMANCE LAB</span>
        <h2>Today의 운동을 기록하고,<br/><em>All 성과를 한눈에.</em></h2>
        <p>By Exercise Weight·sets·횟수를 기록하면 카테고리별 합계와 All 운동량이 자동으로 계산됩니다.</p>
        <div className="wa-hero-meta"><span><Activity size={14}/> By Exercise 기록</span><i/><span><Target size={14}/> 자동 종합 계산</span></div>
      </div>
      <div className="wa-orbit-art" aria-hidden="true"><div className="wa-orbit wa-orbit-a"/><div className="wa-orbit wa-orbit-b"/><div className="wa-orbit-core"><TrendingUp size={34}/></div><span className="wa-orbit-label">TRACK<br/>YOUR LIFTS</span></div>
    </div>

    <div className="wa-toolbar">
      <div className="wa-view-switch" role="tablist" aria-label="Workout Analytics 화면">
        <button className={view === 'record' ? 'active' : ''} onClick={() => setView('record')} role="tab" aria-selected={view === 'record'}>Workout Log</button>
        <button className={view === 'overview' ? 'active' : ''} onClick={() => setView('overview')} role="tab" aria-selected={view === 'overview'}>종합 Analytics</button>
      </div>
      <label className="wa-period-select"><CalendarDays size={15}/><select value={period} onChange={e => setPeriod(e.target.value)} aria-label="Analytics Date Range"><option value="7">Last 7 Days</option><option value="30">Last 30 Days</option><option value="90">Last 90 Days</option><option value="all">All Date Range</option></select><ChevronDown size={14}/></label>
      <button className="wa-refresh" onClick={onRefresh} type="button"><Activity size={15}/> 새로고침</button>
    </div>

    {view === 'record' && <form className="wa-record-form" onSubmit={submit}>
      <div className="wa-section-heading"><div><span className="wa-eyebrow">BUILD YOUR SESSION</span><h3>Today 어떤 운동을 했나요?</h3><p>카테고리를 눌러 여러 종목을 추가한 다음 실제 운동 수치를 입력하세요.</p></div><span className="wa-section-count">{exercises.length} exercises</span></div>
      <div className="wa-category-grid">{CATEGORY_LIST.map(category => <button type="button" key={category} className={'wa-category-chip ' + (exercises.some(item => item.category === category) ? 'selected' : '')} onClick={() => addCategory(category)}><span className="wa-category-check">{exercises.some(item => item.category === category) ? <Check size={13}/> : <Plus size={13}/>}</span>{category}</button>)}</div>
      <div className="wa-exercise-list">{exercises.map((item, index) => <article className="wa-exercise-card" key={item.id}>
        <div className="wa-exercise-card-head"><span className="wa-exercise-index">{String(index + 1).padStart(2, '0')}</span><div><small>{item.category}</small><strong>Exercise {index + 1}</strong></div>{exercises.length > 1 && <button type="button" className="wa-remove-exercise" onClick={() => removeExercise(item.id)} aria-label="종목 Delete"><X size={16}/></button>}</div>
        <div className="wa-exercise-fields">
          <label className="wa-field wa-field-exercise"><span>Exercise</span><span className="wa-select-wrap"><select value={item.exercise_name} onChange={e => updateExercise(item.id, 'exercise_name', e.target.value)}>{CATEGORIES[item.category].map(name => <option key={name} value={name}>{name}</option>)}</select><ChevronDown size={14}/></span></label>
          <label className="wa-field"><span>Weight <small>KG</small></span><span className="wa-number-wrap"><input type="number" min="0" max="1000" step="0.5" value={item.weight_kg} onChange={e => updateExercise(item.id, 'weight_kg', e.target.value)} required/><b>kg</b></span></label>
          <label className="wa-field"><span>sets</span><span className="wa-number-wrap"><input type="number" min="1" max="100" step="1" value={item.sets} onChange={e => updateExercise(item.id, 'sets', e.target.value)} required/><b>set</b></span></label>
          <label className="wa-field"><span>1sets 반복</span><span className="wa-number-wrap"><input type="number" min="1" max="1000" step="1" value={item.reps} onChange={e => updateExercise(item.id, 'reps', e.target.value)} required/><b>reps</b></span></label>
        </div>
        <div className="wa-exercise-volume"><span>예상 운동량</span><strong>{formatNum(number(item.weight_kg) * number(item.sets) * number(item.reps))} <small>kg·reps</small></strong></div>
      </article>)}</div>
      <button className="wa-add-exercise" type="button" onClick={() => addCategory(exercises[exercises.length - 1]?.category || 'Chest')}><Plus size={16}/> 같은 카테고리 종목 추가</button>
      <label className="wa-note-field"><span>운동 Notes <small>선택</small></span><textarea value={note} onChange={e => setNote(e.target.value)} maxLength={500} placeholder="예: 마지막 sets가 힘들었음, 자세에 집중함…"/></label>
      <div className="wa-form-footer"><div><small>이번 세션 예상 운동량</small><strong>{formatNum(exercises.reduce((sum, item) => sum + number(item.weight_kg) * number(item.sets) * number(item.reps), 0))} <span>kg·reps</span></strong></div><button className="wa-primary" type="submit" disabled={saving}><Save size={16}/>{saving ? 'Save 중…' : '기록하기'}</button></div>
      {error && <p className="wa-error" role="alert">{error}</p>}{message && <p className="wa-success" role="status">{message}</p>}
    </form>}

    {view === 'overview' && <>
      <div className="wa-stats-grid">
        <article className="wa-stat-card wa-stat-featured"><div className="wa-stat-top"><span>Total Volume</span><span className="wa-stat-icon"><Weight size={17}/></span></div><strong>{formatNum(totals.volume)}<small>kg·reps</small></strong><div className="wa-stat-foot"><span>{period === 'all' ? 'All 누적 기록' : `최근 ${period}일 합계`}</span></div></article>
        <article className="wa-stat-card"><div className="wa-stat-top"><span>총 sets</span><span className="wa-stat-icon"><Dumbbell size={17}/></span></div><strong>{formatNum(totals.sets)}<small>sets</small></strong><div className="wa-stat-foot"><span>기록된 sets 합계</span></div></article>
        <article className="wa-stat-card"><div className="wa-stat-top"><span>Total Reps 횟수</span><span className="wa-stat-icon"><Activity size={17}/></span></div><strong>{formatNum(totals.reps)}<small>reps</small></strong><div className="wa-stat-foot"><span>sets × 1sets 반복</span></div></article>
        <article className="wa-stat-card"><div className="wa-stat-top"><span>운동 세션</span><span className="wa-stat-icon"><CalendarDays size={17}/></span></div><strong>{formatNum(totals.sessions)}<small>reps</small></strong><div className="wa-stat-foot"><span>기록한 운동 Date별 세션</span></div></article>
      </div>
      <div className="wa-main-grid">
        <article className="wa-panel wa-week-panel">
          <div className="wa-panel-head"><div><span className="wa-eyebrow">WEEKLY ACTIVITY</span><h3>Last 7 Days 기록</h3><p>Workout Log을 Save한 세션 수입니다.</p></div><span className="wa-panel-badge"><Activity size={14}/> 7 DAYS</span></div>
          <div className="wa-chart" role="img" aria-label="Last 7 Days 운동 세션 수">{weekly.map(day => <div className={'wa-chart-day ' + (day.today ? 'today' : '')} key={day.key}><span className="wa-chart-value">{day.count || '—'}</span><div className="wa-chart-track"><i style={{ height: day.count ? `${Math.max(12, day.count / maxWeekly * 100)}%` : '3px' }}/></div><b>{day.label}</b><small>{day.day}일</small></div>)}</div>
          <div className="wa-chart-summary"><span><i/> 기록한 세션</span><strong>{weekly.reduce((sum, day) => sum + day.count, 0)}reps</strong></div>
        </article>
        <article className="wa-panel wa-insight-panel">
          <div className="wa-panel-head"><div><span className="wa-eyebrow">CATEGORY BREAKDOWN</span><h3>카테고리별 종합</h3><p>선택한 Date Range 내 모든 종목을 합산했습니다.</p></div><span className="wa-insight-spark"><Trophy size={17}/></span></div>
          {rankedCategories.length ? <div className="wa-category-totals">{rankedCategories.map(([category, value]) => <div className="wa-category-total" key={category}><div className="wa-category-total-top"><b>{category}</b><strong>{formatNum(value.volume)} <small>kg·reps</small></strong></div><div className="wa-category-bar"><i style={{ width: `${Math.max(3, value.volume / Math.max(1, totals.volume) * 100)}%` }}/></div><span>{value.count}종목 · {value.sets}sets · {formatNum(value.reps)}reps</span></div>)}</div> : <div className="wa-no-results">아직 No records yet. 운동을 입력하고 ‘기록하기’를 눌러 보세요.</div>}
          {topCategory && <div className="wa-insight-note">운동량 기준으로 가장 높은 카테고리는 <b>{topCategory[0]}</b>입니다. Weight × sets × Reps로 계산하며, 체중 운동은 Weight을 0kg으로 기록할 수 있어요.</div>}
        </article>
      </div>
      <article className="wa-panel wa-record-panel">
        <div className="wa-panel-head"><div><span className="wa-eyebrow">SESSION HISTORY</span><h3>Workout History</h3><p>{filtered.length} sessions · exercise details</p></div></div>
        {filtered.length ? <div className="wa-session-list">{filtered.map(record => <article className="wa-session-card" key={record.id}><div className="wa-session-top"><div><span>{formatDate(record.created_at)}</span><strong>{(record.exercises || []).length} exercises</strong></div><b>{formatNum(record.total_volume_kg)} <small>kg·reps</small></b></div><div className="wa-session-exercises">{(record.exercises || []).map((exercise, index) => <div className="wa-session-exercise" key={index}><span className="wa-session-tag">{exercise.category}</span><div><strong>{exercise.exercise_name}</strong><small>{formatNum(exercise.weight_kg)}kg × {exercise.sets}sets × {exercise.reps}reps</small></div><b>{formatNum(exercise.volume_kg ?? number(exercise.weight_kg) * number(exercise.sets) * number(exercise.reps))}</b></div>)}</div>{record.note && <p className="wa-session-note">{record.note}</p>}</article>)}</div> : <div className="wa-no-results">No workout records found for this period.</div>}
      </article>
      <div className="wa-footnote"><span className="wa-footnote-dot"/> Total Volume은 각 종목의 Weight × sets × Reps를 더한 값입니다. 실제 칼로리 소모량이나 의학적 평가는 포함하지 않습니다.</div>
    </>}
  </section>;
}
