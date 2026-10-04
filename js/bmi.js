// BMI 성장도표: 질병관리청 2017 소아청소년 성장도표 체질량지수 백분위수 표
// data/bmi_male.csv, data/bmi_female.csv 에서 읽기만 한다. 숫자는 고치지 않는다.

export const PCT_COLS = [1, 3, 5, 10, 15, 25, 50, 75, 85, 90, 95, 97, 99];
export const MIN_MONTHS = 24;
export const MAX_MONTHS = 227;

const cache = {};

export async function loadTable(sex) {
  const file = sex === 'M' ? 'data/bmi_male.csv' : 'data/bmi_female.csv';
  if (!cache[file]) {
    cache[file] = fetch(file)
      .then((r) => {
        if (!r.ok) throw new Error(`${file} ${r.status}`);
        return r.text();
      })
      .then((text) => {
        const rows = {};
        for (const line of text.trim().split('\n').slice(1)) {
          const nums = line.split(',').map(Number);
          rows[nums[0]] = nums.slice(1);
        }
        return rows;
      })
      .catch((e) => {
        delete cache[file];
        throw e;
      });
  }
  return cache[file];
}

export function bmiValue(weightKg, heightCm) {
  const m = heightCm / 100;
  return weightKg / (m * m);
}

// 내 BMI가 놓인 두 백분위 열 사이를 직선으로 보간한다
// 돌려주는 값: { value: 숫자 | null, label: '63' | '1 미만' | '99 초과' }
export function percentile(table, months, bmi) {
  const row = table[months];
  if (!row) return null;
  if (bmi < row[0]) return { value: null, label: '1 미만' };
  if (bmi > row[row.length - 1]) return { value: null, label: '99 초과' };
  for (let i = 0; i < row.length - 1; i += 1) {
    const lo = row[i];
    const hi = row[i + 1];
    if (bmi >= lo && bmi <= hi) {
      const t = hi === lo ? 0 : (bmi - lo) / (hi - lo);
      const v = PCT_COLS[i] + t * (PCT_COLS[i + 1] - PCT_COLS[i]);
      return { value: v, label: String(Math.round(v)) };
    }
  }
  return null;
}

export function inChildRange(months) {
  return months >= MIN_MONTHS && months <= MAX_MONTHS;
}
