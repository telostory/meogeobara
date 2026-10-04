// 나중에 바꿀 수 있는 초기값을 모두 여기 모아 둔다.
// 숫자를 바꾸고 싶으면 이 파일만 고치면 된다.

// 양 계수: 메뉴 1인분 kcal에 곱한다
export const PORTIONS = [
  { id: 'small', label: '조금', factor: 0.7 },
  { id: 'normal', label: '보통', factor: 1.0 },
  { id: 'large', label: '많이', factor: 1.3 },
];
export const DEFAULT_PORTION = 'normal';

// 운동 강도별 MET 값과 한 줄 설명
export const INTENSITIES = [
  { id: 'light', label: '가벼움', met: 3, desc: '산책처럼 숨이 편해요', emoji: '🚶' },
  { id: 'moderate', label: '적당함', met: 4.5, desc: '숨이 조금 차요', emoji: '🚴' },
  { id: 'hard', label: '조금 지침', met: 6, desc: '땀이 나고 말이 끊겨요', emoji: '🏃' },
  { id: 'veryhard', label: '힘듦', met: 8, desc: '숨이 차서 말하기 어려워요', emoji: '🔥' },
];

// 운동 시간 버튼(분)
export const EXERCISE_MINUTES = [10, 20, 30, 60];

// 새 메뉴의 칼로리를 추정하지 못했을 때 고르는 크기
export const NEW_MENU_SIZES = [
  { id: 'snack', label: '간식 정도', kcal: 150, emoji: '🍪' },
  { id: 'light', label: '가벼운 한 끼', kcal: 300, emoji: '🥪' },
  { id: 'normal', label: '보통 한 끼', kcal: 500, emoji: '🍱' },
  { id: 'big', label: '든든한 한 끼', kcal: 700, emoji: '🍲' },
];

// 끼니
export const MEALS = [
  { id: 'breakfast', label: '아침', emoji: '🌅' },
  { id: 'lunch', label: '점심', emoji: '☀️' },
  { id: 'dinner', label: '저녁', emoji: '🌙' },
  { id: 'snack', label: '간식', emoji: '🍎' },
];

// 식품군
export const FOOD_GROUPS = {
  g: { label: '곡류', emoji: '🍚' },
  v: { label: '채소', emoji: '🥦' },
  f: { label: '과일', emoji: '🍎' },
  p: { label: '단백질', emoji: '🥚' },
  d: { label: '유제품', emoji: '🥛' },
};

// 일주일의 시작 요일 (0 = 일요일)
export const WEEK_START = 0;

// 체중과 키를 적는 요일 (0 = 일요일)
export const BODY_DAY = 0;

// 메뉴 화면에 보여줄 태그 개수
export const RECENT_TAG_COUNT = 6;
export const FREQUENT_TAG_COUNT = 6;
export const SEARCH_RESULT_COUNT = 8;

// 축하 화면이 떠 있는 시간(밀리초)
export const CELEBRATE_MS = 1800;

// 체중·키 입력의 처음 값 (기록이 하나도 없을 때 버튼으로 맞추기 시작하는 값)
export const BODY_START = { weight: 30.0, height: 130.0 };
