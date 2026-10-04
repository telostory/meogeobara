// 하루 한마디. Claude를 쓰지 않고, 그날 기록에 맞는 문구를 규칙으로 고른다.
// 규칙: 체중·몸매·외모 언급 없음, 음식에 좋다·나쁘다 딱지 없음, 끼니를 거르라는 말 없음.
// {n}은 연속 기록 일수로 바뀐다.

import { LOW_INTAKE_RATIO } from './config.js';

export const PHRASES = {
  vegFruit: [
    '채소나 과일을 챙겨 먹었네. 멋진 선택이야!',
    '오늘 식탁이 알록달록했어!',
    '알록달록 챙겨 먹다니, 오늘 정말 꼼꼼했어.',
    '접시에 여러 가지 색이 있었네. 근사해!',
    '알록달록 먹은 날! 몸이 여러 가지 영양을 받았어.',
  ],
  active60: [
    '60분이나 움직였어! 몸이 신났겠다.',
    '오늘 정말 많이 움직였네. 대단해!',
    '한 시간 넘게 움직인 날! 푹 쉬는 것도 잊지 마.',
    '땀 흘린 만큼 오늘 밤 꿀잠 자자!',
    '60분 운동 성공! 내일도 즐겁게 움직여 보자.',
  ],
  threeMeals: [
    '아침, 점심, 저녁 모두 기록했어! 완벽한 하루야.',
    '세 끼를 다 적었네. 기록 대장이야!',
    '하루 세 끼 기록 성공! 꾸준함이 최고야.',
    '세 끼 모두 챙겨 먹고 기록까지 했네. 멋져!',
  ],
  streak: [
    '{n}일째 기록 중! 계속 이어 가 보자.',
    '벌써 {n}일 연속이야. 대단한 끈기야!',
    '{n}일 연속 기록! 정말 꾸준하다.',
    '기록이 {n}일째 이어지고 있어. 최고야!',
  ],
  eatMore: [
    '오늘은 먹은 게 조금 적었네. 내일은 든든하게 챙겨 먹자!',
    '몸이 힘을 내려면 에너지가 필요해. 간식이나 한 끼 더 챙겨 볼까?',
    '오늘은 에너지가 조금 모자랐어. 맛있는 거 더 먹자!',
    '빠뜨린 메뉴가 있으면 더 적어 줘. 먹은 건 다 소중해!',
  ],
  basic: [
    '오늘도 기록해 줘서 고마워!',
    '기록한 것만으로도 멋진 하루야.',
    '하나씩 적다 보면 내 하루가 보여. 잘하고 있어!',
    '오늘 하루도 수고했어!',
  ],
};

// 같은 날에는 같은 문구가 나오도록 날짜로 정한 무작위 수를 쓴다
function seeded(key) {
  let h = 2166136261;
  for (const c of key) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

export function pickPhrase(result, key) {
  const rand = seeded(key);
  let pool;
  if (result.intake < result.base * LOW_INTAKE_RATIO) {
    pool = PHRASES.eatMore;
  } else {
    const groups = [];
    if (result.groups.has('v') || result.groups.has('f')) groups.push('vegFruit');
    if (result.minutes >= 60) groups.push('active60');
    if (['breakfast', 'lunch', 'dinner'].every((m) => result.meals.includes(m))) groups.push('threeMeals');
    if (result.streak >= 2) groups.push('streak');
    const group = groups.length ? groups[Math.floor(rand() * groups.length)] : 'basic';
    pool = PHRASES[group];
  }
  return pool[Math.floor(rand() * pool.length)].replace('{n}', result.streak);
}

// 홈 맨 위 인사말. 홈에 들어올 때마다 하나를 골라 보여준다. {name}은 이름으로 바뀐다.
// 규칙은 위와 같다: 체중·몸매·외모 언급 없음, 음식 딱지 없음, 끼니 거르기 권유 없음.
export const GREETINGS = [
  '{name}, 오늘도 맛있게 먹고 기록해 보자!',
  '오늘 한 끼도 소중해. 천천히 맛있게 먹자!',
  '{name}, 오늘은 어떤 맛을 만났어?',
  '기록은 한 번 누르면 끝! 가볍게 시작해 보자.',
  '몸을 움직이면 기분도 좋아져. 오늘은 뭐 하고 놀까?',
  '{name}, 오늘의 기록 여행을 떠나 볼까?',
  '오늘은 채소 한 가지 더 골라 보는 건 어때?',
  '물 한 잔 마시고 시작해 볼까?',
  '오늘도 기록하는 {name}, 정말 멋져!',
  '꾸준함이 최고의 힘이야. 오늘도 한 칸 채워 보자!',
  '맛있게 먹은 것도 소중한 기록이야.',
  '{name}, 오늘 아침은 뭐였어?',
  '산책 10분도 멋진 운동이야!',
  '알록달록 먹으면 몸이 신나!',
  '오늘은 어떤 과일이 기다리고 있을까?',
  '작은 기록이 모여서 큰 그림이 돼!',
  '{name}, 오늘도 같이 해 보자!',
  '신나게 뛰어놀았다면 그것도 기록해 줘!',
  '천천히 꼭꼭 씹어 먹으면 더 맛있어.',
  '오늘의 나를 기록하는 시간이야!',
  '{name}, 어제보다 한 걸음 더!',
  '먹고, 움직이고, 기록하고! 오늘도 좋은 하루!',
  '친구랑 놀았던 것도 운동이야. 적어 볼까?',
  '먹은 걸 잊기 전에 바로 적어 두자!',
  '{name}, 오늘 가장 맛있었던 건 뭐야?',
  '기록하는 습관이 멋지게 자라고 있어!',
  '한 끼 한 끼가 몸에 힘을 줘.',
  '오늘도 힘차게! 에너지 충전 완료?',
  '줄넘기, 자전거, 춤도 다 운동이야!',
  '{name}, 오늘 하루도 응원해!',
];

// 같은 문구가 연달아 나오지 않게 섞은 순서대로 하나씩 꺼낸다
let deck = [];
export function nextGreeting(name) {
  if (!deck.length) {
    deck = GREETINGS.map((_, i) => i);
    for (let i = deck.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
  }
  return GREETINGS[deck.pop()].replace('{name}', name);
}
