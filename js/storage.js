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
