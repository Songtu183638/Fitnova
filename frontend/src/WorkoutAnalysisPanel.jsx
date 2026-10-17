import React, { useMemo, useState } from 'react';
import { Activity, CalendarDays, Check, ChevronDown, Clock3, Dumbbell, Plus, Save, Target, Trash2, TrendingUp, Trophy, Weight, X } from 'lucide-react';

const CATEGORIES = {
  '가슴': ['벤치프레스', '인클라인 벤치프레스', '덤벨 프레스', '체스트 프레스', '케이블 플라이', '푸시업'],
  '등': ['데드리프트', '랫풀다운', '시티드 로우', '바벨 로우', '풀업', '원암 덤벨 로우'],
  '어깨': ['숄더 프레스', '사이드 레터럴 레이즈', '프론트 레이즈', '리어 델트 플라이', '페이스 풀'],
  '팔': ['바벨 컬', '덤벨 컬', '해머 컬', '트라이셉스 푸시다운', '오버헤드 익스텐션', '딥스'],
  '하체': ['스쿼트', '레그 프레스', '레그 익스텐션', '레그 컬', '루마니안 데드리프트', '런지', '카프 레이즈'],
  '복근': ['크런치', '레그 레이즈', '플랭크', '케이블 크런치', '행잉 니 레이즈'],
  '유산소': ['러닝머신', '실외 달리기', '사이클', '일립티컬', '줄넘기', '로잉머신'],
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
  return date ? date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' }) : '날짜 미상';
};
const createExercise = (category, id) => ({ id, category, exercise_name: CATEGORIES[category][0], weight_kg: '0', sets: '3', reps: '10' });

export default function WorkoutAnalysisPanel({ records = [], onSaveRecord, onRefresh }) {
  const [period, setPeriod] = useState('30');
  const [view, setView] = useState('record');
  const [exercises, setExercises] = useState([createExercise('가슴', 'ex-1')]);
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
      setError('각 운동의 중량(kg), 세트, 반복 횟수를 올바르게 입력해 주세요.');
      return;
    }
    setSaving(true);
    try {
      await onSaveRecord({ exercises: payloadExercises, note });
      setMessage('운동 기록을 저장했어요. 종합 분석에 합산했습니다.');
      setNote('');
      setExercises([createExercise('가슴', `ex-${nextId}`)]);
      setNextId(id => id + 1);
      setView('overview');
    } catch (e) {
      setError(e.message || '운동 기록을 저장하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return <section className="workout-analysis-page">
    <div className="wa-hero">
      <div className="wa-hero-copy">
        <span className="wa-kicker"><span className="wa-live-dot"/> FITNOVA PERFORMANCE LAB</span>
        <h2>오늘의 운동을 기록하고,<br/><em>전체 성과를 한눈에.</em></h2>
        <p>종목별 중량·세트·횟수를 기록하면 카테고리별 합계와 전체 운동량이 자동으로 계산됩니다.</p>
        <div className="wa-hero-meta"><span><Activity size={14}/> 종목별 기록</span><i/><span><Target size={14}/> 자동 종합 계산</span></div>
      </div>
      <div className="wa-orbit-art" aria-hidden="true"><div className="wa-orbit wa-orbit-a"/><div className="wa-orbit wa-orbit-b"/><div className="wa-orbit-core"><TrendingUp size={34}/></div><span className="wa-orbit-label">TRACK<br/>YOUR LIFTS</span></div>
    </div>

    <div className="wa-toolbar">
      <div className="wa-view-switch" role="tablist" aria-label="운동 분석 화면">
        <button className={view === 'record' ? 'active' : ''} onClick={() => setView('record')} role="tab" aria-selected={view === 'record'}>운동 기록</button>
        <button className={view === 'overview' ? 'active' : ''} onClick={() => setView('overview')} role="tab" aria-selected={view === 'overview'}>종합 분석</button>
      </div>
      <label className="wa-period-select"><CalendarDays size={15}/><select value={period} onChange={e => setPeriod(e.target.value)} aria-label="분석 기간"><option value="7">최근 7일</option><option value="30">최근 30일</option><option value="90">최근 90일</option><option value="all">전체 기간</option></select><ChevronDown size={14}/></label>
      <button className="wa-refresh" onClick={onRefresh} type="button"><Activity size={15}/> 새로고침</button>
    </div>

    {view === 'record' && <form className="wa-record-form" onSubmit={submit}>
      <div className="wa-section-heading"><div><span className="wa-eyebrow">BUILD YOUR SESSION</span><h3>오늘 어떤 운동을 했나요?</h3><p>카테고리를 눌러 여러 종목을 추가한 다음 실제 운동 수치를 입력하세요.</p></div><span className="wa-section-count">{exercises.length}개 종목</span></div>
      <div className="wa-category-grid">{CATEGORY_LIST.map(category => <button type="button" key={category} className={'wa-category-chip ' + (exercises.some(item => item.category === category) ? 'selected' : '')} onClick={() => addCategory(category)}><span className="wa-category-check">{exercises.some(item => item.category === category) ? <Check size={13}/> : <Plus size={13}/>}</span>{category}</button>)}</div>
      <div className="wa-exercise-list">{exercises.map((item, index) => <article className="wa-exercise-card" key={item.id}>
        <div className="wa-exercise-card-head"><span className="wa-exercise-index">{String(index + 1).padStart(2, '0')}</span><div><small>{item.category}</small><strong>운동 종목 {index + 1}</strong></div>{exercises.length > 1 && <button type="button" className="wa-remove-exercise" onClick={() => removeExercise(item.id)} aria-label="종목 삭제"><X size={16}/></button>}</div>
        <div className="wa-exercise-fields">
          <label className="wa-field wa-field-exercise"><span>운동 종목</span><span className="wa-select-wrap"><select value={item.exercise_name} onChange={e => updateExercise(item.id, 'exercise_name', e.target.value)}>{CATEGORIES[item.category].map(name => <option key={name} value={name}>{name}</option>)}</select><ChevronDown size={14}/></span></label>
          <label className="wa-field"><span>중량 <small>KG</small></span><span className="wa-number-wrap"><input type="number" min="0" max="1000" step="0.5" value={item.weight_kg} onChange={e => updateExercise(item.id, 'weight_kg', e.target.value)} required/><b>kg</b></span></label>
          <label className="wa-field"><span>세트</span><span className="wa-number-wrap"><input type="number" min="1" max="100" step="1" value={item.sets} onChange={e => updateExercise(item.id, 'sets', e.target.value)} required/><b>set</b></span></label>
          <label className="wa-field"><span>1세트 반복</span><span className="wa-number-wrap"><input type="number" min="1" max="1000" step="1" value={item.reps} onChange={e => updateExercise(item.id, 'reps', e.target.value)} required/><b>회</b></span></label>
        </div>
        <div className="wa-exercise-volume"><span>예상 운동량</span><strong>{formatNum(number(item.weight_kg) * number(item.sets) * number(item.reps))} <small>kg·회</small></strong></div>
      </article>)}</div>
      <button className="wa-add-exercise" type="button" onClick={() => addCategory(exercises[exercises.length - 1]?.category || '가슴')}><Plus size={16}/> 같은 카테고리 종목 추가</button>
      <label className="wa-note-field"><span>운동 메모 <small>선택</small></span><textarea value={note} onChange={e => setNote(e.target.value)} maxLength={500} placeholder="예: 마지막 세트가 힘들었음, 자세에 집중함…"/></label>
      <div className="wa-form-footer"><div><small>이번 세션 예상 운동량</small><strong>{formatNum(exercises.reduce((sum, item) => sum + number(item.weight_kg) * number(item.sets) * number(item.reps), 0))} <span>kg·회</span></strong></div><button className="wa-primary" type="submit" disabled={saving}><Save size={16}/>{saving ? '저장 중…' : '기록하기'}</button></div>
      {error && <p className="wa-error" role="alert">{error}</p>}{message && <p className="wa-success" role="status">{message}</p>}
    </form>}

    {view === 'overview' && <>
      <div className="wa-stats-grid">
        <article className="wa-stat-card wa-stat-featured"><div className="wa-stat-top"><span>총 운동량</span><span className="wa-stat-icon"><Weight size={17}/></span></div><strong>{formatNum(totals.volume)}<small>kg·회</small></strong><div className="wa-stat-foot"><span>{period === 'all' ? '전체 누적 기록' : `최근 ${period}일 합계`}</span></div></article>
        <article className="wa-stat-card"><div className="wa-stat-top"><span>총 세트</span><span className="wa-stat-icon"><Dumbbell size={17}/></span></div><strong>{formatNum(totals.sets)}<small>세트</small></strong><div className="wa-stat-foot"><span>기록된 세트 합계</span></div></article>
        <article className="wa-stat-card"><div className="wa-stat-top"><span>총 반복 횟수</span><span className="wa-stat-icon"><Activity size={17}/></span></div><strong>{formatNum(totals.reps)}<small>회</small></strong><div className="wa-stat-foot"><span>세트 × 1세트 반복</span></div></article>
        <article className="wa-stat-card"><div className="wa-stat-top"><span>운동 세션</span><span className="wa-stat-icon"><CalendarDays size={17}/></span></div><strong>{formatNum(totals.sessions)}<small>회</small></strong><div className="wa-stat-foot"><span>기록한 운동 날짜별 세션</span></div></article>
      </div>
      <div className="wa-main-grid">
        <article className="wa-panel wa-week-panel">
          <div className="wa-panel-head"><div><span className="wa-eyebrow">WEEKLY ACTIVITY</span><h3>최근 7일 기록</h3><p>운동 기록을 저장한 세션 수입니다.</p></div><span className="wa-panel-badge"><Activity size={14}/> 7 DAYS</span></div>
          <div className="wa-chart" role="img" aria-label="최근 7일 운동 세션 수">{weekly.map(day => <div className={'wa-chart-day ' + (day.today ? 'today' : '')} key={day.key}><span className="wa-chart-value">{day.count || '—'}</span><div className="wa-chart-track"><i style={{ height: day.count ? `${Math.max(12, day.count / maxWeekly * 100)}%` : '3px' }}/></div><b>{day.label}</b><small>{day.day}일</small></div>)}</div>
          <div className="wa-chart-summary"><span><i/> 기록한 세션</span><strong>{weekly.reduce((sum, day) => sum + day.count, 0)}회</strong></div>
        </article>
        <article className="wa-panel wa-insight-panel">
          <div className="wa-panel-head"><div><span className="wa-eyebrow">CATEGORY BREAKDOWN</span><h3>카테고리별 종합</h3><p>선택한 기간 내 모든 종목을 합산했습니다.</p></div><span className="wa-insight-spark"><Trophy size={17}/></span></div>
          {rankedCategories.length ? <div className="wa-category-totals">{rankedCategories.map(([category, value]) => <div className="wa-category-total" key={category}><div className="wa-category-total-top"><b>{category}</b><strong>{formatNum(value.volume)} <small>kg·회</small></strong></div><div className="wa-category-bar"><i style={{ width: `${Math.max(3, value.volume / Math.max(1, totals.volume) * 100)}%` }}/></div><span>{value.count}종목 · {value.sets}세트 · {formatNum(value.reps)}회</span></div>)}</div> : <div className="wa-no-results">아직 기록이 없습니다. 운동을 입력하고 ‘기록하기’를 눌러 보세요.</div>}
          {topCategory && <div className="wa-insight-note">운동량 기준으로 가장 높은 카테고리는 <b>{topCategory[0]}</b>입니다. 중량 × 세트 × 반복 횟수로 계산하며, 체중 운동은 중량을 0kg으로 기록할 수 있어요.</div>}
        </article>
      </div>
      <article className="wa-panel wa-record-panel">
        <div className="wa-panel-head"><div><span className="wa-eyebrow">SESSION HISTORY</span><h3>운동 기록 내역</h3><p>{filtered.length}개 세션 · 종목별 상세 수치</p></div></div>
        {filtered.length ? <div className="wa-session-list">{filtered.map(record => <article className="wa-session-card" key={record.id}><div className="wa-session-top"><div><span>{formatDate(record.created_at)}</span><strong>{(record.exercises || []).length}개 종목</strong></div><b>{formatNum(record.total_volume_kg)} <small>kg·회</small></b></div><div className="wa-session-exercises">{(record.exercises || []).map((exercise, index) => <div className="wa-session-exercise" key={index}><span className="wa-session-tag">{exercise.category}</span><div><strong>{exercise.exercise_name}</strong><small>{formatNum(exercise.weight_kg)}kg × {exercise.sets}세트 × {exercise.reps}회</small></div><b>{formatNum(exercise.volume_kg ?? number(exercise.weight_kg) * number(exercise.sets) * number(exercise.reps))}</b></div>)}</div>{record.note && <p className="wa-session-note">{record.note}</p>}</article>)}</div> : <div className="wa-no-results">선택한 기간에 기록이 없습니다.</div>}
      </article>
      <div className="wa-footnote"><span className="wa-footnote-dot"/> 총 운동량은 각 종목의 중량 × 세트 × 반복 횟수를 더한 값입니다. 실제 칼로리 소모량이나 의학적 평가는 포함하지 않습니다.</div>
    </>}
  </section>;
}
