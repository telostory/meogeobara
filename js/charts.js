// 그래프는 외부 라이브러리 없이 SVG로 직접 그린다.
// 두 값(균형과 체중)은 단위가 달라서 축 하나에 겹치지 않고, 같은 주 칸에 맞춰 위아래로 붙여 그린다.

import { PCT_COLS } from './bmi.js';

const W = 358;
const PAD_L = 44;
const PAD_R = 12;
const COLORS = {
  bar: '#8a5a3c',
  line: '#5f7a33',
  grid: '#eee3cf',
  axis: '#a08a74',
  text: '#8a5a3c',
  ink: '#5b4536',
  surface: '#ffffff',
  bands: ['#f7f1e3', '#fdf3d6', '#fbe2ae', '#f5cd95'],
  median: '#d9c3a0',
};

const fmt = (n) => Math.round(n).toLocaleString('ko-KR');

function niceStep(range, target) {
  const raw = range / target;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  return (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
}

function ticks(min, max, target = 4) {
  const step = niceStep(max - min || 1, target);
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const out = [];
  for (let v = lo; v <= hi + step / 2; v += step) out.push(Math.round(v * 100) / 100);
  return out;
}

// 막대: 위쪽(또는 아래쪽) 끝만 4px 둥글게, 기준선 쪽은 각지게
function barPath(x, w, y0, y1) {
  const r = Math.min(4, Math.abs(y1 - y0), w / 2);
  if (y1 < y0) {
    return `M${x},${y0}V${y1 + r}Q${x},${y1} ${x + r},${y1}H${x + w - r}Q${x + w},${y1} ${x + w},${y1 + r}V${y0}Z`;
  }
  return `M${x},${y0}V${y1 - r}Q${x},${y1} ${x + r},${y1}H${x + w - r}Q${x + w},${y1} ${x + w},${y1 - r}V${y0}Z`;
}

export function weeklyCharts(weeks, selected) {
  const n = weeks.length;
  const plotW = W - PAD_L - PAD_R;
  const band = plotW / n;
  const cx = (i) => PAD_L + band * i + band / 2;
  const barW = Math.min(24, band * 0.6);

  // 위: 주간 평균 균형 막대
  const H1 = 150;
  const top1 = 12;
  const bot1 = H1 - 8;
  const vals = weeks.map((w) => w.balance).filter((v) => v !== null);
  const bt = ticks(Math.min(0, ...vals), Math.max(0, ...vals), 4);
  const y1 = (v) => bot1 - ((v - bt[0]) / (bt[bt.length - 1] - bt[0])) * (bot1 - top1);
  let svg1 = '';
  for (const t of bt) {
    svg1 += `<line x1="${PAD_L}" x2="${W - PAD_R}" y1="${y1(t)}" y2="${y1(t)}" stroke="${t === 0 ? COLORS.axis : COLORS.grid}" stroke-width="1"/>`;
    svg1 += `<text x="${PAD_L - 6}" y="${y1(t) + 4}" text-anchor="end" class="tick">${t > 0 ? '+' : ''}${fmt(t)}</text>`;
  }
  weeks.forEach((w, i) => {
    if (w.balance === null) return;
    svg1 += `<path d="${barPath(cx(i) - barW / 2, barW, y1(0), y1(w.balance))}" fill="${COLORS.bar}" opacity="${selected === null || selected === i ? 1 : 0.35}"/>`;
  });

  // 아래: 체중 선
  const H2 = 130;
  const top2 = 12;
  const bot2 = H2 - 28;
  const ws = weeks.map((w) => w.weight).filter((v) => v !== null);
  let svg2 = '';
  if (ws.length) {
    const wt = ticks(Math.min(...ws) - 0.5, Math.max(...ws) + 0.5, 3);
    const y2 = (v) => bot2 - ((v - wt[0]) / (wt[wt.length - 1] - wt[0])) * (bot2 - top2);
    for (const t of wt) {
      svg2 += `<line x1="${PAD_L}" x2="${W - PAD_R}" y1="${y2(t)}" y2="${y2(t)}" stroke="${COLORS.grid}" stroke-width="1"/>`;
      svg2 += `<text x="${PAD_L - 6}" y="${y2(t) + 4}" text-anchor="end" class="tick">${t}</text>`;
    }
    const pts = weeks.map((w, i) => (w.weight === null ? null : [cx(i), y2(w.weight)])).filter(Boolean);
    if (pts.length > 1) {
      svg2 += `<polyline points="${pts.map((p) => p.join(',')).join(' ')}" fill="none" stroke="${COLORS.line}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    }
    for (const [x, y] of pts) {
      svg2 += `<circle cx="${x}" cy="${y}" r="5" fill="${COLORS.line}" stroke="${COLORS.surface}" stroke-width="2"/>`;
    }
  } else {
    svg2 += `<text x="${W / 2}" y="${(top2 + bot2) / 2 + 5}" text-anchor="middle" class="tick">일요일에 체중을 적으면 여기에 선이 생겨요</text>`;
  }
  weeks.forEach((w, i) => {
    const [, m, d] = w.start.split('-').map(Number);
    svg2 += `<text x="${cx(i)}" y="${H2 - 8}" text-anchor="middle" class="tick ${selected === i ? 'on' : ''}">${m}/${d}</text>`;
  });

  // 주 칸을 누르면 그 주 값이 위에 보인다 (막대보다 넓은 누르는 자리)
  const hit = (H) => weeks.map((w, i) => `<rect x="${PAD_L + band * i}" y="0" width="${band}" height="${H}" fill="transparent" data-act="week" data-idx="${i}"/>`).join('');

  return `
    <div class="chart-label"><span class="key bar"></span>주간 평균 균형 (kcal)</div>
    <svg class="chart" viewBox="0 0 ${W} ${H1}" role="img" aria-label="주간 평균 균형 막대 그래프">${svg1}${hit(H1)}</svg>
    <div class="chart-label"><span class="key line"></span>체중 (kg)</div>
    <svg class="chart" viewBox="0 0 ${W} ${H2}" role="img" aria-label="주간 체중 선 그래프">${svg2}${hit(H2)}</svg>`;
}

// BMI 성장도표: 백분위 곡선 사이를 색 띠로 칠하고 내 기록을 점으로 찍는다.
// 띠에는 글자 딱지를 붙이지 않고 오른쪽 끝에 백분위 숫자만 둔다.
export function bmiChart(table, points, nowMonths) {
  const H = 240;
  const top = 12;
  const bot = H - 28;
  const ms = points.map((p) => p.months).concat(nowMonths);
  let lo = Math.max(24, Math.min(...ms) - 24);
  let hi = Math.min(227, Math.max(...ms) + 24);
  if (hi - lo < 48) {
    lo = Math.max(24, hi - 48);
    hi = Math.min(227, lo + 48);
  }
  const months = [];
  for (let m = lo; m <= hi; m += 1) if (table[m]) months.push(m);
  const col = (p) => PCT_COLS.indexOf(p);
  const bmis = points.map((p) => p.bmi);
  let yMin = Math.min(...months.map((m) => table[m][col(3)]), ...bmis) - 0.5;
  let yMax = Math.max(...months.map((m) => table[m][col(97)]), ...bmis) + 0.5;
  yMin = Math.floor(yMin);
  yMax = Math.ceil(yMax);
  const x = (m) => PAD_L + ((m - lo) / (hi - lo)) * (W - PAD_L - PAD_R - 18);
  const y = (v) => bot - ((Math.min(yMax, Math.max(yMin, v)) - yMin) / (yMax - yMin)) * (bot - top);
  const curve = (p) => months.map((m) => [x(m), y(table[m][col(p)])]);
  const area = (lower, upper) => {
    const up = upper === null ? months.map((m) => [x(m), top]) : curve(upper);
    const dn = lower === null ? months.map((m) => [x(m), bot]) : curve(lower);
    return `M${up.map((p) => p.join(',')).join('L')}L${dn.reverse().map((p) => p.join(',')).join('L')}Z`;
  };
  let svg = '';
  const bands = [[null, 5], [5, 85], [85, 95], [95, null]];
  bands.forEach(([a, b], i) => {
    svg += `<path d="${area(a, b)}" fill="${COLORS.bands[i]}"/>`;
  });
  svg += `<polyline points="${curve(50).map((p) => p.join(',')).join(' ')}" fill="none" stroke="${COLORS.median}" stroke-width="1.5"/>`;
  const last = months[months.length - 1];
  for (const p of [5, 50, 85, 95]) {
    svg += `<text x="${x(last) + 4}" y="${y(table[last][col(p)]) + 4}" class="tick">${p}</text>`;
  }
  for (const t of ticks(yMin, yMax, 4)) {
    if (t < yMin || t > yMax) continue;
    svg += `<text x="${PAD_L - 6}" y="${y(t) + 4}" text-anchor="end" class="tick">${t}</text>`;
  }
  for (let m = Math.ceil(lo / 12) * 12; m <= hi; m += 12) {
    svg += `<line x1="${x(m)}" x2="${x(m)}" y1="${bot}" y2="${bot + 4}" stroke="${COLORS.axis}"/>`;
    svg += `<text x="${x(m)}" y="${H - 8}" text-anchor="middle" class="tick">${m / 12}세</text>`;
  }
  svg += `<line x1="${PAD_L}" x2="${x(hi)}" y1="${bot}" y2="${bot}" stroke="${COLORS.axis}"/>`;
  const inRange = points.filter((p) => p.months >= lo && p.months <= hi);
  if (inRange.length > 1) {
    svg += `<polyline points="${inRange.map((p) => `${x(p.months)},${y(p.bmi)}`).join(' ')}" fill="none" stroke="${COLORS.ink}" stroke-width="2" stroke-linejoin="round"/>`;
  }
  inRange.forEach((p, i) => {
    const r = i === inRange.length - 1 ? 7 : 5;
    svg += `<circle cx="${x(p.months)}" cy="${y(p.bmi)}" r="${r}" fill="${COLORS.ink}" stroke="${COLORS.surface}" stroke-width="2"/>`;
  });
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="BMI 성장도표와 내 위치">${svg}</svg>`;
}

// 한 달 식사·운동: 같은 날짜 칸에 맞춘 선 그래프 두 개 (단위가 달라 축 하나에 겹치지 않는다)
// days: [{ day, intake: kcal | null, minutes: 분 | null }]  null은 기록 없음(또는 아직 오지 않은 날)
export function monthCharts(days, selected) {
  const n = days.length;
  const plotW = W - PAD_L - PAD_R;
  const band = plotW / n;
  const cx = (i) => PAD_L + band * i + band / 2;

  function panel({ H, values, color, unit, labelEvery, showX }) {
    const top = 10;
    const bot = H - (showX ? 26 : 8);
    const vals = values.filter((v) => v !== null);
    const t = ticks(0, Math.max(1, ...vals), 3);
    const y = (v) => bot - (v / t[t.length - 1]) * (bot - top);
    let svg = '';
    for (const v of t) {
      svg += `<line x1="${PAD_L}" x2="${W - PAD_R}" y1="${y(v)}" y2="${y(v)}" stroke="${COLORS.grid}" stroke-width="1"/>`;
      svg += `<text x="${PAD_L - 6}" y="${y(v) + 4}" text-anchor="end" class="tick">${fmt(v)}</text>`;
    }
    // 기록이 이어진 날끼리만 선으로 잇는다
    let seg = [];
    const flush = () => {
      if (seg.length > 1) svg += `<polyline points="${seg.join(' ')}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
      seg = [];
    };
    values.forEach((v, i) => {
      if (v === null) { flush(); return; }
      seg.push(`${cx(i)},${y(v)}`);
    });
    flush();
    values.forEach((v, i) => {
      if (v === null) return;
      const r = selected === i ? 5 : 3;
      svg += `<circle cx="${cx(i)}" cy="${y(v)}" r="${r}" fill="${color}" stroke="${COLORS.surface}" stroke-width="${selected === i ? 2 : 1}"/>`;
    });
    if (selected !== null && selected !== undefined) {
      svg = `<line x1="${cx(selected)}" x2="${cx(selected)}" y1="${top}" y2="${bot}" stroke="${COLORS.axis}" stroke-width="1"/>` + svg;
    }
    if (showX) {
      days.forEach((d, i) => {
        if (d.day === 1 || d.day % labelEvery === 0) svg += `<text x="${cx(i)}" y="${H - 8}" text-anchor="middle" class="tick">${d.day}</text>`;
      });
    }
    const hit = days.map((d, i) => `<rect x="${PAD_L + band * i}" y="0" width="${band}" height="${H}" fill="transparent" data-act="mday" data-idx="${i}"/>`).join('');
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${unit}">${svg}${hit}</svg>`;
  }

  return `
    <div class="chart-label"><span class="key line meal"></span>먹은 에너지 (kcal)</div>
    ${panel({ H: 120, values: days.map((d) => d.intake), color: COLORS.bar, unit: '날짜별 먹은 에너지 선 그래프', labelEvery: 5, showX: false })}
    <div class="chart-label"><span class="key line"></span>운동 (분)</div>
    ${panel({ H: 120, values: days.map((d) => d.minutes), color: COLORS.line, unit: '날짜별 운동 시간 선 그래프', labelEvery: 5, showX: true })}`;
}
