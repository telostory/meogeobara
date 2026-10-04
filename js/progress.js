// 캘린더, 주간 그래프, 월간 요약에 쓰는 묶음 계산

import { WEEK_START } from './config.js';
import { dayResult, hasMeal, intakeKcal, ageMonths } from './calc.js';
import { dateKey, parseKey, weekStartKey } from './util.js';

function addDays(key, n) {
  const d = parseKey(key);
  d.setDate(d.getDate() + n);
  return dateKey(d);
}

// 최근 count주(이번 주 포함). 주마다 기록한 날의 평균 균형과 그 주 마지막 체중
export function weeklySeries(data, count, today = new Date()) {
  const thisWeek = weekStartKey(today, WEEK_START);
  const weeks = [];
  for (let w = count - 1; w >= 0; w -= 1) {
    const start = addDays(thisWeek, -7 * w);
    const end = addDays(start, 6);
    const balances = [];
    for (let i = 0; i < 7; i += 1) {
      const key = addDays(start, i);
      if (hasMeal(data.days[key])) balances.push(dayResult(data, key).balance);
    }
    const bodyRec = data.body.filter((b) => b.date >= start && b.date <= end && b.weight).pop();
    weeks.push({
      start,
      end,
      days: balances.length,
      balance: balances.length ? Math.round(balances.reduce((a, b) => a + b, 0) / balances.length) : null,
      weight: bodyRec ? bodyRec.weight : null,
    });
  }
  return weeks;
}

// 식사를 한 번이라도 기록한 주의 수
export function recordedWeekCount(data) {
  const weeks = new Set();
  for (const key of Object.keys(data.days)) {
    if (hasMeal(data.days[key])) weeks.add(weekStartKey(parseKey(key), WEEK_START));
  }
  return weeks.size;
}

// 체중을 잰 기록마다, 그때까지 적은 마지막 키로 BMI를 계산할 수 있는 점
export function bodyPoints(data) {
  let height = null;
  const points = [];
  for (const b of data.body) {
    if (b.height) height = b.height;
    if (b.weight && height) {
      points.push({ date: b.date, weight: b.weight, height, months: ageMonths(data.profile, parseKey(b.date)) });
    }
  }
  return points;
}

// 월간 요약 (month는 0~11)
export function monthSummary(data, year, month) {
  const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
  const keys = Object.keys(data.days).filter((k) => k.startsWith(prefix)).sort();
  const mealKeys = keys.filter((k) => hasMeal(data.days[k]));
  const intakes = mealKeys.map((k) => intakeKcal(data.days[k]));
  let exCount = 0;
  let exMinutes = 0;
  for (const k of keys) {
    for (const x of data.days[k].exercises || []) {
      exCount += 1;
      exMinutes += x.minutes;
    }
  }
  const body = data.body.filter((b) => b.date.startsWith(prefix));
  const weights = body.filter((b) => b.weight);
  const heights = body.filter((b) => b.height);
  const change = (list, field) => (list.length
    ? { first: list[0][field], last: list[list.length - 1][field], firstDate: list[0].date, lastDate: list[list.length - 1].date }
    : null);
  return {
    recordedDays: mealKeys.length,
    avgIntake: intakes.length ? Math.round(intakes.reduce((a, b) => a + b, 0) / intakes.length) : null,
    exCount,
    exMinutes,
    weight: change(weights, 'weight'),
    height: change(heights, 'height'),
  };
}
