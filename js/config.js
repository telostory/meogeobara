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

// 섭취가 기준선의 이 비율보다 적으면 한마디를 '더 먹자' 문구로 바꾼다
export const LOW_INTAKE_RATIO = 0.7;

// 기준선 설정에서 한 번에 바꾸는 양(kcal)
export const BASELINE_STEP = 50;

// 출처: 2020 한국인 영양소 섭취기준 - 에너지와 다량영양소 (보건복지부, 2020)
// docs 폴더의 PDF. 숫자를 고칠 때는 이 문서를 보고 고친다.
// 각 줄: [이 나이부터(세), 남자, 여자]

// p.29 표 17 한국인의 1일 에너지 섭취기준 - 에너지 필요추정량(kcal/일)
export const EER_TABLE = [
  [1, 900, 900],
  [3, 1400, 1400],
  [6, 1700, 1500],
  [9, 2000, 1800],
  [12, 2500, 2000],
  [15, 2700, 2000],
  [19, 2600, 2000],
  [30, 2500, 1900],
  [50, 2200, 1700],
  [65, 2000, 1600],
  [75, 1900, 1500],
];

// p.xxv 표 3 체위기준 - 체중(kg). 체중을 적지 않았을 때 운동 소비 계산에 쓴다
export const REF_WEIGHT_TABLE = [
  [1, 11.7, 11.7],
  [3, 17.6, 17.6],
  [6, 25.6, 25.0],
  [9, 37.4, 36.6],
  [12, 52.7, 48.7],
  [15, 64.5, 53.8],
  [19, 68.9, 55.9],
  [30, 67.8, 54.7],
  [50, 64.5, 52.5],
  [65, 62.4, 50.0],
  [75, 60.1, 46.1],
];

// 식사를 기록한 주가 이만큼 모이기 전에는 주간 그래프 대신 '쌓이는 중' 안내를 보여준다
export const WEEKS_FOR_GRAPH = 3;

// 주간 그래프에 보여줄 주의 수
export const GRAPH_WEEKS = 8;

// 스트릭 프리즈: 처음에 가진 개수(최대 개수)와 다시 채워지는 연속 기록 일수
export const FREEZE_MAX = 1;
export const FREEZE_REFILL_DAYS = 7;
