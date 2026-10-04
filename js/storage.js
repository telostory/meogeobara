// 모든 기록은 이 기기의 브라우저 로컬 스토리지에만 저장한다.

const KEY = 'meogeobara.v1';

function emptyData() {
  return {
    version: 1,
    profile: null, // { name, birthYear, birthMonth, sex: 'F' | 'M', baseline: null | number }
    days: {}, // 'YYYY-MM-DD': { meals: { breakfast: [...] }, exercises: [...] }
    body: [], // { date, weight, height }
    customMenus: [], // { id, name, kcal, groups, source }
    menuUse: {}, // menuId: { count, last }
    bodySkip: null, // 체중 카드를 '다음에'로 넘긴 날짜
    badges: {}, // 뱃지 id: 받은 날짜
    settings: { sound: true },
    reviews: {}, // 주 시작 날짜: { text, at } (Claude 주간 리뷰)
  };
}

let data = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...emptyData(), ...JSON.parse(raw) };
  } catch (e) {
    console.warn('기록을 읽지 못했어요', e);
  }
  return emptyData();
}

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('기록을 저장하지 못했어요', e);
  }
}

export function getData() {
  return data;
}

export function getDay(dateKey) {
  if (!data.days[dateKey]) data.days[dateKey] = { meals: {}, exercises: [] };
  const day = data.days[dateKey];
  if (!day.meals) day.meals = {};
  if (!day.exercises) day.exercises = [];
  return day;
}

export function peekDay(dateKey) {
  return data.days[dateKey] || null;
}

// ---------- 내보내기·가져오기·지우기 ----------
// API 키는 기록과 따로 저장되므로 내보내기 파일에 들어가지 않는다.

export function exportJson() {
  return JSON.stringify({ app: 'meogeobara', exportedAt: new Date().toISOString(), data }, null, 2);
}

// 가져온 파일이 이 앱의 기록인지 확인하고 지금 기록을 바꾼다
export function importJson(text) {
  const parsed = JSON.parse(text);
  const incoming = parsed && parsed.app === 'meogeobara' ? parsed.data : parsed;
  if (!incoming || typeof incoming !== 'object' || !incoming.profile || typeof incoming.days !== 'object') {
    throw new Error('머거바라 기록 파일이 아니에요');
  }
  data = { ...emptyData(), ...incoming };
  save();
  return data;
}

export function resetData() {
  data = emptyData();
  try {
    localStorage.removeItem(KEY);
  } catch (e) {
    // 지우지 못해도 화면은 빈 상태로 시작한다
  }
}

// 사파리가 오래 쓰지 않은 사이트의 저장 데이터를 지우지 않도록 '계속 보관'을 요청한다
export function askPersist() {
  try {
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist();
  } catch (e) {
    // 지원하지 않는 브라우저면 넘어간다
  }
}
