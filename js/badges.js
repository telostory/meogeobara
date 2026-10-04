// 뱃지는 본인이 할 수 있는 행동(기록, 움직이기, 채소·과일)에만 준다.
// 적게 먹은 것과 체중에는 주지 않는다.

import { recordStats } from './streak.js';

export const BADGES = [
  { id: 'first', emoji: '🌱', name: '첫 기록', desc: '처음으로 식사를 기록해요', done: (s) => s.mealDays >= 1 },
  { id: 'threeMeals', emoji: '🍱', name: '세 끼 기록', desc: '하루 세 끼를 모두 기록해요', done: (s) => s.threeMealDays >= 1 },
  { id: 'streak7', emoji: '🔥', name: '7일 연속', desc: '7일 연속으로 기록해요', done: (s) => s.bestStreak >= 7 },
  { id: 'streak30', emoji: '🏆', name: '30일 연속', desc: '30일 연속으로 기록해요', done: (s) => s.bestStreak >= 30 },
  { id: 'streak100', emoji: '👑', name: '100일 연속', desc: '100일 연속으로 기록해요', done: (s) => s.bestStreak >= 100 },
  { id: 'veg5', emoji: '🥦', name: '채소 5일', desc: '채소 먹은 날이 5일 모여요', done: (s) => s.vegDays >= 5 },
  { id: 'veg20', emoji: '🥕', name: '채소 20일', desc: '채소 먹은 날이 20일 모여요', done: (s) => s.vegDays >= 20 },
  { id: 'fruit5', emoji: '🍓', name: '과일 5일', desc: '과일 먹은 날이 5일 모여요', done: (s) => s.fruitDays >= 5 },
  { id: 'active60', emoji: '⚡', name: '60분 움직이기', desc: '하루에 60분 넘게 움직여요', done: (s) => s.active60Days >= 1 },
  { id: 'move10', emoji: '👟', name: '운동 10번', desc: '운동 기록이 10번 모여요', done: (s) => s.exerciseCount >= 10 },
];

// 새로 받은 뱃지를 data.badges에 날짜와 함께 남기고 목록으로 돌려준다.
// 한 번 받은 뱃지는 기록을 지워도 남는다.
export function awardBadges(data, key) {
  if (!data.badges) data.badges = {};
  const stats = recordStats(data, key);
  const fresh = [];
  for (const b of BADGES) {
    if (!data.badges[b.id] && b.done(stats)) {
      data.badges[b.id] = key;
      fresh.push(b);
    }
  }
  return fresh;
}
