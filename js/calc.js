// 칼로리 계산은 모두 여기서 코드로 한다. Claude에게 맡기지 않는다.
// 같은 기록이면 언제나 같은 숫자가 나와야 한다.

import { PORTIONS, INTENSITIES, EER_TABLE, REF_WEIGHT_TABLE, MEALS } from './config.js';
import { dateKey, parseKey } from './util.js';

// 그 날짜 기준 만 나이와 월령 (태어난 날은 모르므로 그 달 1일로 본다)
export function ageMonths(profile, date) {
  return (date.getFullYear() - profile.birthYear) * 12 + (date.getMonth() + 1 - profile.birthMonth);
}

export function ageYears(profile, date) {
  return Math.floor(ageMonths(profile, date) / 12);
}

function lookup(table, profile, date) {
  const age = ageYears(profile, date);
  let row = table[0];
  for (const r of table) if (age >= r[0]) row = r;
  return profile.sex === 'M' ? row[1] : row[2];
}

// 나이와 성별로 추천하는 하루 기준선 (에너지 필요추정량)
export function recommendedBaseline(profile, date = new Date()) {
  return lookup(EER_TABLE, profile, date);
}

// 설정에서 고친 값이 있으면 그 값, 없으면 추천값
export function baseline(profile, date = new Date()) {
  return profile.baseline || recommendedBaseline(profile, date);
}

// 그 날짜까지 적은 마지막 체중. 없으면 연령대 표준 체중
export function weightOn(data, key) {
  const rec = data.body.filter((b) => b.date <= key && b.weight).pop();
  if (rec) return { kg: rec.weight, measured: true };
  return { kg: lookup(REF_WEIGHT_TABLE, data.profile, parseKey(key)), measured: false };
}

export function itemKcal(item) {
  const factor = PORTIONS.find((p) => p.id === item.portion)?.factor ?? 1;
  return item.kcal * factor;
}

export function intakeKcal(day) {
  let sum = 0;
  for (const items of Object.values(day?.meals || {})) for (const it of items) sum += itemKcal(it);
  return Math.round(sum);
}

export function exerciseKcal(day, weightKg) {
  let sum = 0;
  for (const x of day?.exercises || []) {
    const met = INTENSITIES.find((i) => i.id === x.intensity)?.met ?? 0;
    sum += met * weightKg * (x.minutes / 60);
  }
  return Math.round(sum);
}

export function exerciseMinutes(day) {
  return (day?.exercises || []).reduce((a, x) => a + x.minutes, 0);
}

// 채소, 과일, 단백질, 유제품을 먹었는지
export function foodGroupsEaten(day) {
  const eaten = new Set();
  for (const items of Object.values(day?.meals || {})) {
    for (const it of items) for (const g of it.groups || '') eaten.add(g);
  }
  return eaten;
}

export function hasMeal(day) {
  return Object.values(day?.meals || {}).some((items) => items.length);
}

export function mealsRecorded(day) {
  return MEALS.filter((m) => (day?.meals?.[m.id] || []).length).map((m) => m.id);
}

// 오늘까지 식사 기록이 이어진 날 수 (프리즈는 4단계에서 더한다)
export function streakDays(data, key) {
  let n = 0;
  const d = parseKey(key);
  while (hasMeal(data.days[dateKey(d)])) {
    n += 1;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

// 하루 결과 한 번에 계산
export function dayResult(data, key) {
  const day = data.days[key];
  const date = parseKey(key);
  const weight = weightOn(data, key);
  const base = baseline(data.profile, date);
  const intake = intakeKcal(day);
  const burned = exerciseKcal(day, weight.kg);
  return {
    intake,
    burned,
    base,
    balance: intake - (base + burned),
    minutes: exerciseMinutes(day),
    groups: foodGroupsEaten(day),
    meals: mealsRecorded(day),
    streak: streakDays(data, key),
    weightMeasured: weight.measured,
  };
}
