// 날짜와 글자 처리에 쓰는 작은 도구들

export function dateKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export function prettyDate(d = new Date()) {
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${WEEKDAYS[d.getDay()]}요일`;
}

// 이번 주의 첫날(weekStart 요일) 날짜 키
export function weekStartKey(d, weekStart) {
  const s = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  s.setDate(s.getDate() - ((s.getDay() - weekStart + 7) % 7));
  return dateKey(s);
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// 한글 초성 검색: "ㄱㅂ"로 "김밥"을 찾을 수 있게 한다
const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';

function toChosung(s) {
  let out = '';
  for (const ch of s) {
    const code = ch.charCodeAt(0) - 0xac00;
    out += code >= 0 && code < 11172 ? CHO[Math.floor(code / 588)] : ch;
  }
  return out;
}

function normalize(s) {
  return s.replace(/\s|\(|\)/g, '').toLowerCase();
}

export function matchesQuery(name, query) {
  const q = normalize(query);
  if (!q) return false;
  const n = normalize(name);
  if (n.includes(q)) return true;
  const onlyCho = [...q].every((c) => CHO.includes(c));
  return onlyCho && toChosung(n).includes(q);
}
