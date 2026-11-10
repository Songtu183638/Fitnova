// Lightweight runtime i18n. Korean source strings are the dictionary keys, so
// Korean devices render the original text and every other locale uses English.
import en from './i18n/en.js';

const STORAGE_KEY = 'fitnova_lang';

function detect() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'ko' || saved === 'en') return saved;
  } catch { /* storage unavailable */ }
  const nav = (typeof navigator !== 'undefined' && (navigator.language || '')) || '';
  return nav.toLowerCase().startsWith('ko') ? 'ko' : 'en';
}

export const LOCALE = detect();
export const LOCALE_TAG = LOCALE === 'ko' ? 'ko-KR' : 'en-US';

if (typeof document !== 'undefined') document.documentElement.lang = LOCALE;

export function setLocale(next) {
  try { localStorage.setItem(STORAGE_KEY, next === 'ko' ? 'ko' : 'en'); } catch { /* ignore */ }
  if (typeof window !== 'undefined') window.location.reload();
}

// Server-built messages that contain variable parts (stored notifications).
const PATTERNS = [
  [/^@(\S+) 계정에 신고가 (\d+)건 접수되었습니다\. 신고 관리에서 확인해 주세요\.$/, (m) => `@${m[1]} has received ${m[2]} ${Number(m[2]) === 1 ? 'report' : 'reports'}. Please check Report management.`],
];

export function tr(key) {
  if (LOCALE === 'ko' || typeof key !== 'string') return key;
  if (en[key] !== undefined) return en[key];
  for (const [re, fn] of PATTERNS) {
    const m = re.exec(key);
    if (m) return fn(m);
  }
  return key;
}

// Matches the closing brace of the group that starts at `start` (a '{').
function closeIndex(s, start) {
  let depth = 0;
  for (let i = start; i < s.length; i++) {
    if (s[i] === '{') depth++;
    else if (s[i] === '}' && --depth === 0) return i;
  }
  return -1;
}

function format(s, args) {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    if (s[i] !== '{') { out += s[i]; continue; }
    const end = closeIndex(s, i);
    if (end < 0) { out += s.slice(i); break; }
    const inner = s.slice(i + 1, end);
    let m;
    if ((m = /^(\d+)$/.exec(inner))) out += args[+m[1]] ?? '';
    else if ((m = /^(\d+):l$/.exec(inner))) out += String(args[+m[1]] ?? '').toLowerCase();
    else if ((m = /^(\d+)\?([\s\S]*)$/.exec(inner))) {
      const bar = m[2].indexOf('|');
      const one = bar < 0 ? m[2] : m[2].slice(0, bar);
      const many = bar < 0 ? m[2] : m[2].slice(bar + 1);
      out += format(Number(args[+m[1]]) === 1 ? one : many, args);
    } else out += '{' + inner + '}';
    i = end;
  }
  return out;
}

export function trf(key, args = []) {
  return format(tr(key), args);
}
