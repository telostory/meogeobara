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
