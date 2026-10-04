// 스트릭과 프리즈, 뱃지 판정에 쓰는 기록 통계.
// 저장된 기록에서 매번 다시 계산하므로, 지난 기록을 고쳐도 숫자가 어긋나지 않는다.

import { FREEZE_MAX, FREEZE_REFILL_DAYS } from './config.js';
import { hasMeal, foodGroupsEaten, exerciseMinutes, mealsRecorded } from './calc.js';
import { dateKey, parseKey } from './util.js';

function nextKey(key) {
  const d = parseKey(key);
  d.setDate(d.getDate() + 1);
  return dateKey(d);
}

// key 날짜까지의 스트릭.
// - 하루에 식사를 한 건이라도 기록하면 이어진다.
// - 빠진 날에는 프리즈가 있으면 자동으로 쓰이고(스트릭은 그대로), 없으면 0으로 돌아간다.
// - 프리즈를 다 쓴 뒤 7일 연속 기록하면 다시 채워진다.
// - key 날짜가 아직 기록 전이면 빠진 날로 치지 않는다(오늘은 아직 남았으니까).
export function streakInfo(data, key) {
  const recorded = Object.keys(data.days).filter((k) => hasMeal(data.days[k])).sort();
  const result = { streak: 0, best: 0, freeze: FREEZE_MAX, frozenDays: new Set(), todayDone: hasMeal(data.days[key]) };
  if (!recorded.length || recorded[0] > key) return result;
  let run = 0;
  for (let k = recorded[0]; k <= key; k = nextKey(k)) {
    if (hasMeal(data.days[k])) {
      result.streak += 1;
      run += 1;
      if (result.freeze < FREEZE_MAX && run >= FREEZE_REFILL_DAYS) {
        result.freeze += 1;
        run = 0;
      }
    } else if (k === key) {
      break;
    } else if (result.streak > 0 && result.freeze > 0) {
      result.freeze -= 1;
      result.frozenDays.add(k);
      run = 0;
    } else {
      result.streak = 0;
      run = 0;
    }
    result.best = Math.max(result.best, result.streak);
  }
  return result;
}

// 뱃지 판정용 통계. 모두 '한 행동'만 센다.
export function recordStats(data, key) {
  const s = { mealDays: 0, vegDays: 0, fruitDays: 0, active60Days: 0, threeMealDays: 0, exerciseCount: 0, bestStreak: 0 };
  for (const [k, day] of Object.entries(data.days)) {
    if (k > key) continue;
    if (hasMeal(day)) s.mealDays += 1;
    const g = foodGroupsEaten(day);
    if (g.has('v')) s.vegDays += 1;
    if (g.has('f')) s.fruitDays += 1;
    if (exerciseMinutes(day) >= 60) s.active60Days += 1;
    if (['breakfast', 'lunch', 'dinner'].every((m) => mealsRecorded(day).includes(m))) s.threeMealDays += 1;
    s.exerciseCount += (day.exercises || []).length;
  }
  s.bestStreak = streakInfo(data, key).best;
  return s;
}
