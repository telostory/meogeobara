import {
  PORTIONS, LEGACY_PORTIONS, DEFAULT_PORTION, INTENSITIES, EXERCISE_MINUTES, NEW_MENU_SIZES, MEALS,
  BODY_DAY, WEEK_START, RECENT_TAG_COUNT, FREQUENT_TAG_COUNT,
  SEARCH_RESULT_COUNT, CELEBRATE_MS, BASELINE_STEP, FOOD_GROUPS, STREAK_MILESTONES,
} from './config.js';
import { dayResult, hasMeal, recommendedBaseline, baseline, ageYears, ageMonths, itemKcal } from './calc.js';
import { weeklySeries, recordedWeekCount, bodyPoints, monthSummary, lastWeekStart, weekDigest, monthDaily } from './progress.js';
import { hasApiKey, setApiKey, estimateMenu, writeReview, testConnection } from './claude.js';
import { loadTable, bmiValue, percentile, inChildRange } from './bmi.js';
import { weeklyCharts, bmiChart, monthCharts } from './charts.js';
import { pickPhrase, nextGreeting } from './phrases.js';
import { streakInfo } from './streak.js';
import { BADGES, awardBadges } from './badges.js';
import { playCheer } from './sound.js';
import { APP_VERSION, refreshApp } from './version.js';
import { WEEKS_FOR_GRAPH, GRAPH_WEEKS, REVIEW_MIN_DAYS } from './config.js';
import { BASE_MENUS, STARTER_TAGS } from './menus.js';
import { getData, getDay, save, exportJson, importJson, resetData, askPersist } from './storage.js';
import { dateKey, parseKey, prettyDate, escapeHtml as h, matchesQuery, weekStartKey } from './util.js';

const weekStartKeyOf = (d) => weekStartKey(d, WEEK_START);

const app = document.getElementById('app');
let screen = null; // 지금 보고 있는 화면 { name, ...상태 }
let celebrateTimer = null;

// ---------- 화면 이동 ----------

// 홈이 아닌 화면은 브라우저 기록에 한 칸만 쌓아서, 휴대폰 뒤로 가기를 누르면 홈으로 온다
function go(next) {
  clearTimeout(celebrateTimer);
  screen = next;
  if (next.name !== 'home' && next.name !== 'onboarding') {
    if (history.state && history.state.inner) history.replaceState({ inner: true }, '');
    else history.pushState({ inner: true }, '');
  }
  render();
}

function goHome() {
  if (history.state && history.state.inner) {
    history.back(); // popstate에서 홈을 그린다
  } else {
    go({ name: 'home' });
  }
}

window.addEventListener('popstate', () => {
  if (screen && screen.name !== 'home' && screen.name !== 'onboarding') {
    clearTimeout(celebrateTimer);
    screen = { name: 'home' };
    render();
  }
});

let lastRendered = null;

// 같은 화면을 다시 그릴 때(버튼으로 값만 바뀔 때)는 스크롤 위치를 그대로 둔다
function render() {
  const view = VIEWS[screen.name];
  const same = lastRendered === screen;
  const y = same ? app.querySelector('.screen')?.scrollTop || 0 : 0;
  app.innerHTML = view.html(screen);
  app.dataset.screen = screen.name;
  lastRendered = screen;
  if (same) {
    const el = app.querySelector('.screen');
    if (el) el.scrollTop = y;
  }
  if (view.mount) view.mount(screen);
}

// 휴대폰 키보드가 올라와도 위쪽 막대가 화면에 붙어 있도록, 앱 크기를 실제 보이는 영역에 맞춘다
function syncViewport() {
  const vv = window.visualViewport;
  if (!vv) return;
  document.documentElement.style.setProperty('--vv-h', `${vv.height}px`);
  document.documentElement.style.setProperty('--vv-top', `${vv.offsetTop}px`);
}
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', syncViewport);
  window.visualViewport.addEventListener('scroll', syncViewport);
  syncViewport();
}
// 화면 끝에서 더 당겨도 페이지 전체가 끌려가지 않게 한다 (위쪽 막대가 움직이지 않도록)
let touchY = 0;
document.addEventListener('touchstart', (e) => { touchY = e.touches[0].clientY; }, { passive: true });
document.addEventListener('touchmove', (e) => {
  if (e.touches.length > 1) return; // 두 손가락 확대는 그대로 둔다
  const sc = e.target.closest('.screen');
  if (!sc || e.target.closest('input[type="range"]')) { if (!e.target.closest('input')) e.preventDefault(); return; }
  const dy = e.touches[0].clientY - touchY;
  const atTop = sc.scrollTop <= 0;
  const atBottom = sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 1;
  if ((dy > 0 && atTop) || (dy < 0 && atBottom)) e.preventDefault();
}, { passive: false });

// 입력하는 동안에는 아래쪽 저장 버튼을 숨겨 키보드 위로 따라 올라오지 않게 한다
app.addEventListener('focusin', (e) => {
  if (e.target.matches('input')) app.classList.add('typing');
});
app.addEventListener('focusout', () => {
  setTimeout(() => {
    if (!app.contains(document.activeElement) || !document.activeElement.matches('input')) app.classList.remove('typing');
  }, 50);
});

// 입력칸을 누르면 그 칸이 보이는 곳으로 스크롤한다
app.addEventListener('focusin', (e) => {
  if (e.target.matches('input')) setTimeout(() => e.target.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300);
});

// 버튼 클릭은 data-act 하나로 모아서 처리한다
app.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const view = VIEWS[screen.name];
  const fn = view.acts && view.acts[el.dataset.act];
  if (fn) fn(screen, el.dataset, el);
  else if (el.dataset.act === 'home') goHome();
});

// ---------- 공통 조각 ----------

function topBar({ back = true, step = null, total = null, title = '' } = {}) {
  const progress = step
    ? `<div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${step}">
         <div class="progress-fill" style="width:${(step / total) * 100}%"></div></div>`
    : '';
  return `<header class="topbar">
    ${back ? '<button class="icon-btn" data-act="back" aria-label="뒤로">←</button>' : '<span class="icon-btn-space"></span>'}
    ${progress || `<div class="topbar-title">${h(title)}</div>`}
    <span class="icon-btn-space"></span>
  </header>`;
}

function brand() {
  return `<div class="brand"><img src="icons/face-128.png" alt="" width="40" height="40"><span>머거바라</span></div>`;
}

// ---------- 메뉴 도구 ----------

function allMenus() {
  return [...getData().customMenus, ...BASE_MENUS];
}

function findMenu(id) {
  return allMenus().find((m) => m.id === id);
}

function portionLabel(id) {
  return [...PORTIONS, ...LEGACY_PORTIONS].find((p) => p.id === id)?.label || '';
}

function todayKey() {
  return dateKey(new Date());
}

// ---------- 첫 실행 ----------

const thisYear = new Date().getFullYear();

function numberField(id, value, unit, { decimal = false, placeholder = '' } = {}) {
  return `<label class="num-field">
    <input id="${id}" class="text-input num" type="number" ${decimal ? 'inputmode="decimal" step="0.1"' : 'inputmode="numeric" pattern="[0-9]*"'}
      placeholder="${placeholder}" value="${value ?? ''}">
    <span>${unit}</span>
  </label>`;
}

function readNumber(id) {
  const v = parseFloat(String(document.getElementById(id)?.value || '').replace(',', '.'));
  return Number.isFinite(v) ? v : null;
}

const onboarding = {
  html(s) {
    const total = 3;
    const top = `<header class="topbar">
      ${s.step > 1 ? '<button class="icon-btn" data-act="prev" aria-label="뒤로">←</button>' : '<span class="icon-btn-space"></span>'}
      <div class="progress"><div class="progress-fill" style="width:${(s.step / total) * 100}%"></div></div>
      <span class="icon-btn-space"></span></header>`;
    let body = '';
    if (s.step === 1) {
      body = `<div class="hero"><img src="icons/face-128.png" alt="" width="96" height="96"></div>
        <h1 class="q">반가워! 이름이 뭐야?</h1>
        <input id="name" class="text-input" maxlength="10" autocomplete="off" placeholder="이름" value="${h(s.userName || '')}">
        <button class="btn primary big" data-act="nameNext">다음</button>`;
    } else if (s.step === 2) {
      body = `<h1 class="q">언제 태어났어?</h1>
        <div class="num-row">
          ${numberField('birthYear', s.birthYear, '년', { placeholder: String(thisYear - 10) })}
          ${numberField('birthMonth', s.birthMonth, '월', { placeholder: '3' })}
        </div>
        ${s.err ? `<p class="hint err">${s.err}</p>` : ''}
        <button class="btn primary big" data-act="birthNext">다음</button>`;
    } else {
      body = `<h1 class="q">성별을 골라 줘</h1>
        <div class="stack">
          <button class="btn choice big" data-act="sex" data-v="F">👧 여자</button>
          <button class="btn choice big" data-act="sex" data-v="M">👦 남자</button>
        </div>
        <p class="hint">하루에 먹으면 좋은 양을 계산할 때만 써요.</p>`;
    }
    return `${top}<main class="screen">${body}</main>`;
  },
  mount(s) {
    const enter = (id, fn) => document.getElementById(id)?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') fn(s);
    });
    enter('name', onboarding.acts.nameNext);
    enter('birthMonth', onboarding.acts.birthNext);
  },
  acts: {
    prev(s) { s.step -= 1; s.err = ''; render(); },
    nameNext(s) {
      const v = document.getElementById('name').value.trim();
      if (!v) { document.getElementById('name').focus(); return; }
      s.userName = v; s.step = 2; render();
    },
    birthNext(s) {
      const y = readNumber('birthYear');
      const m = readNumber('birthMonth');
      s.birthYear = y;
      s.birthMonth = m;
      if (!y || y < 1930 || y > thisYear) { s.err = '태어난 해를 4자리 숫자로 적어 줘. 예: 2016'; render(); return; }
      if (!m || m < 1 || m > 12 || !Number.isInteger(m)) { s.err = '태어난 달을 1~12 사이 숫자로 적어 줘.'; render(); return; }
      s.err = '';
      s.step = 3;
      render();
    },
    sex(s, d) {
      const data = getData();
      data.profile = { name: s.userName, birthYear: s.birthYear, birthMonth: s.birthMonth, sex: d.v, baseline: null };
      save();
      go({ name: 'home' });
      toast(`반가워, ${s.userName}!`, '오늘 먹은 것부터 기록해 볼까?');
    },
  },
};

// ---------- 홈 ----------

function bodyCardDue() {
  const data = getData();
  const today = todayKey();
  if (new Date().getDay() !== BODY_DAY) return false;
  if (data.bodySkip === today) return false;
  return !data.body.some((b) => b.date === today);
}

// 연속 기록 진척: 오늘까지 최근 7일 칸과 다음 목표까지의 막대
function streakCard(data, st, act) {
  const today = todayKey();
  const names = ['일', '월', '화', '수', '목', '금', '토'];
  const cells = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 6 + i);
    const k = dateKey(d);
    const done = hasMeal(data.days[k]);
    const cls = [done ? 'done' : '', k === today ? 'today' : ''].join(' ');
    return `<span class="wk-cell ${cls}"><small>${names[d.getDay()]}</small><i>${done ? '🔥' : ''}</i></span>`;
  }).join('');
  const next = STREAK_MILESTONES.find((m) => m > st.streak) || st.streak + 10;
  const prev = [...STREAK_MILESTONES].reverse().find((m) => m <= st.streak) || 0;
  const pct = ((st.streak - prev) / (next - prev)) * 100;
  const tag = act ? 'button' : 'div';
  return `<${tag} class="card streak-home" ${act ? `data-act="${act}" aria-label="연속 기록과 뱃지 보기"` : ''}>
      <div class="streak-top">
        <span class="streak-num ${st.todayDone ? 'lit' : ''}">🔥 <b>${st.streak}</b>일 연속</span>
        <span class="pill">🏅 <b>${Object.keys(data.badges || {}).length}</b></span>
      </div>
      <div class="wk-strip">${cells}</div>
      <div class="milestone">
        <div class="progress soft"><div class="progress-fill" style="width:${pct}%"></div></div>
        <span>${next}일 연속까지 ${next - st.streak}일</span>
      </div>
    </${tag}>`;
}

const home = {
  html(s) {
    const data = getData();
    // 홈에 새로 들어올 때만 인사말을 바꾸고, 같은 홈을 다시 그릴 때는 그대로 둔다
    if (!s.greeting) s.greeting = nextGreeting(data.profile.name);
    const day = getDay(todayKey());
    const mealCards = MEALS.map((m) => {
      const items = day.meals[m.id] || [];
      const names = items.map((i) => i.name.replace(/\s*\(.*\)/, '')).join(', ');
      return `<button class="card meal-card ${items.length ? 'done' : ''}" data-act="meal" data-id="${m.id}">
        <span class="card-emoji">${m.emoji}</span>
        <span class="card-title">${m.label}</span>
        <span class="card-sub">${items.length ? h(names) : '기록하기'}</span>
        ${items.length ? '<span class="check">✓</span>' : ''}
      </button>`;
    }).join('');
    const minutes = day.exercises.reduce((a, x) => a + x.minutes, 0);
    const st = streakInfo(data, todayKey());
    const y = new Date();
    y.setDate(y.getDate() - 1);
    const yDay = data.days[dateKey(y)];
    const yesterdayCard = (hasMeal(yDay) || (yDay?.exercises || []).length) && !yDay.closed
      ? `<button class="card yesterday-card" data-act="closeYesterday">
          <span class="card-emoji">🌙</span>
          <span class="card-title">어제 결과를 아직 안 봤어요</span>
          <span class="card-sub">어제 하루를 마감하고 결과 보기</span>
        </button>`
      : '';
    const tasks = ['breakfast', 'lunch', 'dinner'].map((m) => (day.meals[m] || []).length > 0).concat(minutes > 0);
    const doneCount = tasks.filter(Boolean).length;
    const statusRow = `${streakCard(data, st, 'badges')}
      <div class="today-progress">
        <div class="progress soft"><div class="progress-fill" style="width:${(doneCount / tasks.length) * 100}%"></div></div>
        <span>오늘 ${doneCount}/${tasks.length}</span>
      </div>`;
    const bodyCard = bodyCardDue()
      ? `<div class="card body-card">
          <div><span class="card-emoji">📏</span> <b>오늘은 몸 기록하는 날</b></div>
          <p class="card-sub">체중과 키를 적어 줘. 일주일에 한 번이면 충분해요.</p>
          <div class="row">
            <button class="btn primary" data-act="body">적기</button>
            <button class="btn ghost" data-act="bodySkip">다음에</button>
          </div>
        </div>`
      : '';
    const canClose = hasMeal(day) || day.exercises.length;
    const closeBtn = canClose
      ? `<button class="btn primary big" data-act="close">${day.closed ? '📊 오늘 결과 보기' : '🌟 오늘 마감'}</button>`
      : '';
    return `<header class="home-head"><button class="icon-btn" data-act="calendar" aria-label="캘린더">📅</button>${brand()}
        <button class="icon-btn" data-act="settings" aria-label="설정">⚙️</button></header>
      <main class="screen home">
        <p class="date">${prettyDate()}</p>
        <h1 class="hello">${h(s.greeting)}</h1>
        ${yesterdayCard}
        ${statusRow}
        ${bodyCard}
        <div class="meal-grid">${mealCards}</div>
        <button class="card exercise-card ${minutes ? 'done' : ''}" data-act="exercise">
          <span class="card-emoji">🏃</span>
          <span class="card-title">운동</span>
          <span class="card-sub">${minutes ? `오늘 ${minutes}분 움직였어요` : '기록하기'}</span>
          ${minutes ? '<span class="check">✓</span>' : ''}
        </button>
        ${closeBtn}
      </main>`;
  },
  acts: {
    meal(s, d) {
      const existing = getDay(todayKey()).meals[d.id] || [];
      go({ name: 'meal', mealId: d.id, items: existing.map((x) => ({ ...x })), query: '', original: existing.length });
    },
    exercise() { go({ name: 'exercise', step: 1 }); },
    close() {
      const day = getDay(todayKey());
      if (day.closed) go({ name: 'result', key: todayKey() });
      else closeDay(todayKey());
    },
    closeYesterday() {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      closeDay(dateKey(y));
    },
    settings() { go({ name: 'settings' }); },
    badges() { go({ name: 'badges' }); },
    calendar() {
      const now = new Date();
      go({ name: 'calendar', year: now.getFullYear(), month: now.getMonth(), week: null });
    },
    body() {
      const last = [...getData().body].reverse();
      go({ name: 'body', weight: last.find((b) => b.weight)?.weight ?? null, height: last.find((b) => b.height)?.height ?? null });
    },
    bodySkip() {
      getData().bodySkip = todayKey();
      save();
      render();
    },
  },
};

// ---------- 식사 기록 ----------

function tagsFor(mealId, items) {
  const use = getData().menuUse;
  const ids = Object.keys(use).filter((id) => findMenu(id));
  const recent = [...ids].sort((a, b) => use[b].last - use[a].last).slice(0, RECENT_TAG_COUNT);
  const frequent = [...ids]
    .filter((id) => !recent.includes(id))
    .sort((a, b) => use[b].count - use[a].count)
    .slice(0, FREQUENT_TAG_COUNT);
  const starter = STARTER_TAGS[mealId].filter((id) => findMenu(id) && !recent.includes(id) && !frequent.includes(id));
  return { recent, frequent, starter };
}

function tagButton(id, items) {
  const m = findMenu(id);
  const on = items.some((i) => i.menuId === id);
  return `<button class="tag ${on ? 'on' : ''}" data-act="toggle" data-id="${h(id)}">${on ? '✓ ' : '+ '}${h(m.name)}</button>`;
}

function searchResultsHtml(s) {
  const q = s.query.trim();
  if (!q) return '';
  const found = allMenus().filter((m) => matchesQuery(m.name, q)).slice(0, SEARCH_RESULT_COUNT);
  const exact = allMenus().some((m) => m.name.replace(/\s/g, '') === q.replace(/\s/g, ''));
  const list = found.map((m) => tagButton(m.id, s.items)).join('');
  const onlyJamo = /^[ㄱ-ㅎㅏ-ㅣ\s]+$/.test(q);
  const add = exact || onlyJamo ? '' : `<button class="tag new" data-act="newMenu">＋ '${h(q)}' 새 메뉴로 추가</button>`;
  return `<div class="tags">${list}${add}</div>`;
}

function cartHtml(s) {
  if (!s.items.length) return '<p class="hint center">위에서 먹은 메뉴를 눌러 담아 줘</p>';
  return s.items.map((it, idx) => `
    <div class="cart-row ${idx === 0 && s.justAdded === it.menuId ? 'pop-in' : ''}">
      <div class="cart-name">${h(it.name)} <small class="portion-now">${portionLabel(it.portion)}</small></div>
      <div class="portion-scale" role="radiogroup" aria-label="${h(it.name)} 양">
        <span class="ps-end">조금</span>
        ${PORTIONS.map((p, i) => `<button class="ps-dot ${it.portion === p.id ? 'on' : ''}" style="--d:${20 + i * 6}px" role="radio"
          aria-checked="${it.portion === p.id}" aria-label="${p.label}" data-act="portion" data-idx="${idx}" data-p="${p.id}"><i></i></button>`).join('')}
        <span class="ps-end">많이</span>
      </div>
      <button class="icon-btn small" data-act="remove" data-idx="${idx}" aria-label="${h(it.name)} 빼기">✕</button>
    </div>`).join('');
}

function addItem(s, menu) {
  if (s.items.some((i) => i.menuId === menu.id)) return;
  // 새로 담은 메뉴를 맨 위에 두어 바로 보이게 하고, 한 번만 등장 애니메이션을 준다
  s.items.unshift({ menuId: menu.id, name: menu.name, kcal: menu.kcal, groups: menu.groups, portion: DEFAULT_PORTION });
  s.justAdded = menu.id;
}

const meal = {
  html(s) {
    const m = MEALS.find((x) => x.id === s.mealId);
    const { recent, frequent, starter } = tagsFor(s.mealId, s.items);
    const section = (title, ids) => (ids.length
      ? `<h2 class="sub">${title}</h2><div class="tags">${ids.map((id) => tagButton(id, s.items)).join('')}</div>`
      : '');
    const canSave = s.items.length || s.original;
    return `${topBar({ title: `${m.emoji} ${m.label}` })}
      <main class="screen meal">
        <h1 class="q">${m.label}에 뭐 먹었어?</h1>
        ${section('최근에 먹은 메뉴', recent)}
        ${section('자주 먹은 메뉴', frequent)}
        ${section('추천 메뉴', starter)}
        <div class="search">
          <input id="search" class="text-input" type="search" autocomplete="off" placeholder="🔍 메뉴 찾기" value="${h(s.query)}">
          <div id="results">${searchResultsHtml(s)}</div>
        </div>
        <h2 class="sub">담은 메뉴</h2>
        <div class="cart">${cartHtml(s)}</div>
      </main>
      <footer class="bottom-bar">
        <button class="btn primary big" data-act="save" ${canSave ? '' : 'disabled'}>저장하기</button>
      </footer>`;
  },
  mount(s) {
    const input = document.getElementById('search');
    input.addEventListener('input', () => {
      s.query = input.value;
      document.getElementById('results').innerHTML = searchResultsHtml(s);
    });
    if (s.justAdded) {
      app.querySelector('.cart-row.pop-in')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      s.justAdded = null;
    }
    if (s.focusSearch) {
      s.focusSearch = false;
      input.focus();
    }
  },
  acts: {
    back: () => goHome(),
    toggle(s, d) {
      const idx = s.items.findIndex((i) => i.menuId === d.id);
      if (idx >= 0) s.items.splice(idx, 1);
      else addItem(s, findMenu(d.id));
      if (s.query) s.query = '';
      render();
    },
    portion(s, d) { s.items[Number(d.idx)].portion = d.p; render(); },
    remove(s, d) { s.items.splice(Number(d.idx), 1); render(); },
    newMenu(s) {
      const menuName = s.query.trim();
      if (!hasApiKey()) {
        go({ name: 'newMenu', menuName, mealState: s });
        return;
      }
      go({ name: 'newMenu', menuName, mealState: s, asking: true });
      estimateMenu(menuName).then((est) => {
        if (screen.name !== 'newMenu' || screen.menuName !== menuName) return;
        if (est) saveNewMenu(screen, { kcal: est.kcal, groups: est.groups, source: 'claude' });
        else {
          screen.asking = false;
          screen.failed = true;
          render();
        }
      });
    },
    save(s) {
      const data = getData();
      const day = getDay(todayKey());
      const before = new Set((day.meals[s.mealId] || []).map((i) => i.menuId));
      const firstMealToday = !hasMeal(day);
      const now = Date.now();
      for (const it of s.items) {
        if (before.has(it.menuId)) continue;
        const u = data.menuUse[it.menuId] || { count: 0, last: 0 };
        data.menuUse[it.menuId] = { count: u.count + 1, last: now };
      }
      if (s.items.length) day.meals[s.mealId] = s.items;
      else delete day.meals[s.mealId];
      save();
      const label = MEALS.find((x) => x.id === s.mealId).label;
      if (!s.items.length) { goHome(); return; }
      let sub = '잘했어! 오늘도 한 칸 채웠어요.';
      if (firstMealToday) {
        const st = streakInfo(data, todayKey()).streak;
        sub = st >= 2 ? `🔥 ${st}일 연속 기록! 계속 이어 가 보자.` : '🔥 오늘 기록 시작! 내일도 이어 가 보자.';
      }
      saved(`${label} 기록 완료!`, sub);
    },
  },
};

// ---------- 새 메뉴 ----------

function saveNewMenu(s, { kcal, groups, source }) {
  const menu = { id: `c:${s.menuName}`, name: s.menuName, kcal, groups, source };
  const data = getData();
  data.customMenus = data.customMenus.filter((m) => m.id !== menu.id);
  data.customMenus.unshift(menu);
  save();
  const ms = s.mealState;
  ms.query = '';
  addItem(ms, menu);
  go(ms);
}

const newMenu = {
  html(s) {
    if (s.asking) {
      return `${topBar({ title: '새 메뉴' })}
        <main class="screen center-screen">
          <div class="thinking" aria-hidden="true"><i></i><i></i><i></i></div>
          <h1 class="q">'${h(s.menuName)}'<br>알아보는 중이야</h1>
          <p class="hint">잠깐만 기다려 줘</p>
        </main>`;
    }
    return `${topBar({ title: '새 메뉴' })}
      <main class="screen">
        ${s.failed ? '<p class="hint">이번엔 알아보지 못했어. 크기를 골라 줘!</p>' : ''}
        <h1 class="q">'${h(s.menuName)}'<br>얼마나 큰 메뉴야?</h1>
        <div class="stack">
          ${NEW_MENU_SIZES.map((z) => `<button class="btn choice big" data-act="size" data-id="${z.id}">${z.emoji} ${z.label}</button>`).join('')}
        </div>
        <p class="hint">한 번 고르면 다음부터는 바로 찾을 수 있어요.</p>
      </main>`;
  },
  acts: {
    back(s) { go(s.mealState); },
    size(s, d) {
      const z = NEW_MENU_SIZES.find((x) => x.id === d.id);
      saveNewMenu(s, { kcal: z.kcal, groups: '', source: 'size' });
    },
  },
};

// ---------- 운동 ----------

const exercise = {
  html(s) {
    const day = getDay(todayKey());
    if (s.step === 1) {
      const list = day.exercises.length
        ? `<h2 class="sub">오늘 한 운동</h2>${day.exercises.map((x, idx) => {
          const it = INTENSITIES.find((i) => i.id === x.intensity);
          return `<div class="cart-row"><div class="cart-name">${it.emoji} ${it.label} · ${x.minutes}분</div>
            <button class="icon-btn small" data-act="remove" data-idx="${idx}" aria-label="지우기">✕</button></div>`;
        }).join('')}`
        : '';
      return `${topBar({ step: 1, total: 2 })}
        <main class="screen">
          <h1 class="q">얼마나 힘들었어?</h1>
          <div class="stack">
            ${INTENSITIES.map((i) => `<button class="btn choice big two-line" data-act="intensity" data-id="${i.id}">
              <span>${i.emoji} ${i.label}</span><small>${i.desc}</small></button>`).join('')}
          </div>
          ${list}
        </main>`;
    }
    const it = INTENSITIES.find((i) => i.id === s.intensity);
    return `${topBar({ step: 2, total: 2 })}
      <main class="screen">
        <h1 class="q">${it.emoji} ${it.label}<br>몇 분 했어?</h1>
        <div class="grid-2">
          ${EXERCISE_MINUTES.map((m) => `<button class="btn choice big" data-act="minutes" data-m="${m}">${m}분</button>`).join('')}
        </div>
      </main>`;
  },
  acts: {
    back(s) {
      if (s.step === 2) { s.step = 1; render(); } else goHome();
    },
    intensity(s, d) { s.intensity = d.id; s.step = 2; render(); },
    remove(s, d) {
      getDay(todayKey()).exercises.splice(Number(d.idx), 1);
      save();
      render();
    },
    minutes(s, d) {
      getDay(todayKey()).exercises.push({ intensity: s.intensity, minutes: Number(d.m), at: Date.now() });
      save();
      saved('운동 기록 완료!', `${d.m}분 동안 움직였어요. 멋져!`);
    },
  },
};

// ---------- 체중과 키 ----------

const body = {
  html(s) {
    return `${topBar({ title: '📏 몸 기록' })}
      <main class="screen">
        <h1 class="q">체중과 키를 적어 줘</h1>
        <div class="num-stack">
          <p class="num-label">체중</p>
          ${numberField('weight', s.weight, 'kg', { decimal: true, placeholder: '예: 36.5' })}
          <p class="num-label">키 <small>(모르면 비워 둬도 돼요)</small></p>
          ${numberField('height', s.height, 'cm', { decimal: true, placeholder: '예: 141.2' })}
        </div>
        ${s.err ? `<p class="hint err">${s.err}</p>` : ''}
        <button class="btn primary big" data-act="save">저장하기</button>
      </main>`;
  },
  acts: {
    back: () => goHome(),
    save(s) {
      const w = readNumber('weight');
      const ht = readNumber('height');
      s.weight = w;
      s.height = ht;
      if (!w || w < 10 || w > 200) { s.err = '체중을 kg 숫자로 적어 줘. 예: 36.5'; render(); return; }
      if (ht !== null && (ht < 50 || ht > 230)) { s.err = '키를 cm 숫자로 적어 줘. 예: 141.2'; render(); return; }
      saveBody(Math.round(w * 10) / 10, ht === null ? null : Math.round(ht * 10) / 10);
    },
  },
};

function saveBody(weight, height) {
  const data = getData();
  const today = todayKey();
  data.body = data.body.filter((b) => b.date !== today);
  data.body.push({ date: today, weight, height });
  data.body.sort((a, b) => a.date.localeCompare(b.date));
  save();
  saved('몸 기록 완료!', '다음 주 일요일에 또 만나요.');
}

// ---------- 저장 알림과 마감 축하 ----------

function soundOn() {
  return getData().settings?.sound !== false;
}

// 기록을 저장할 때: 새 뱃지를 확인하고, 홈으로 돌아가 아래쪽에 짧은 알림을 띄운다
function saved(title, sub) {
  const data = getData();
  const badges = data.profile ? awardBadges(data, todayKey()) : [];
  save();
  if (soundOn()) playCheer(badges.length > 0);
  goHome();
  toast(title, sub, badges);
}

let toastTimer = null;

function toast(title, sub, badges = []) {
  const el = document.getElementById('toast');
  if (!el) return;
  clearTimeout(toastTimer);
  el.innerHTML = `<b>✓ ${h(title)}</b>${sub ? `<span>${h(sub)}</span>` : ''}
    ${badges.map((b) => `<span class="toast-badge">${b.emoji} 새 뱃지: <b>${h(b.name)}</b></span>`).join('')}`;
  el.classList.add('show');
  toastTimer = setTimeout(() => el.classList.remove('show'), badges.length ? 4500 : 2600);
}

document.getElementById('toast')?.addEventListener('click', (e) => e.currentTarget.classList.remove('show'));

// 하루를 마감할 때만 색종이 축하를 보여 주고, 이어서 결과 카드로 간다
function closeDay(key) {
  const data = getData();
  getDay(key).closed = true;
  const badges = awardBadges(data, todayKey());
  save();
  if (soundOn()) playCheer(true);
  go({ name: 'celebrate', key, badges: badges.map((b) => b.id) });
}

const celebrateView = {
  html(s) {
    const colors = ['var(--yellow)', 'var(--grass)', 'var(--fur)', 'var(--fur-dark)'];
    const bits = Array.from({ length: 24 }, (_, i) => {
      const left = (i * 37) % 100;
      const delay = (i % 6) * 0.08;
      const rot = (i * 53) % 360;
      return `<i style="left:${left}%;animation-delay:${delay}s;background:${colors[i % 4]};transform:rotate(${rot}deg)"></i>`;
    }).join('');
    const word = s.key === todayKey() ? '오늘' : prettyDate(parseKey(s.key)).replace(/ \S+요일$/, '');
    return `<main class="screen celebrate" data-act="done">
        <div class="confetti" aria-hidden="true">${bits}</div>
        <div class="badge-pop">🎉</div>
        <h1 class="q">${h(word)} 하루 마감!</h1>
        <p class="celebrate-sub">하루 동안 기록하느라 수고했어. 결과를 보러 가자!</p>
        ${s.badges.length ? `<div class="new-badges">
          <p class="new-badges-title">새 뱃지를 받았어!</p>
          ${s.badges.map((id) => BADGES.find((b) => b.id === id)).map((b) => `<div class="badge-chip"><span>${b.emoji}</span><b>${b.name}</b></div>`).join('')}
        </div>` : ''}
        <button class="btn primary big" data-act="done">결과 보기</button>
      </main>`;
  },
  mount(s) {
    // 뱃지를 받은 날은 천천히 볼 수 있게 저절로 넘어가지 않는다
    if (!s.badges.length) celebrateTimer = setTimeout(() => celebrateView.acts.done(s), CELEBRATE_MS + 600);
  },
  acts: {
    done(s) {
      clearTimeout(celebrateTimer);
      go({ name: 'result', key: s.key });
    },
  },
};

// ---------- 하루 결과 ----------

const fmt = (n) => Math.round(n).toLocaleString('ko-KR');
const signed = (n) => (n > 0 ? `+${fmt(n)}` : n < 0 ? `−${fmt(-n)}` : '0');

function dayRecordsHtml(day) {
  const meals = MEALS.filter((m) => (day?.meals?.[m.id] || []).length).map((m) => `
    <div class="rec-row"><b>${m.emoji} ${m.label}</b>
      <span>${day.meals[m.id].map((it) => `${h(it.name)}${it.portion !== DEFAULT_PORTION && it.portion !== 'normal' ? ` (${portionLabel(it.portion)})` : ''}`).join(', ')}</span></div>`).join('');
  const ex = (day?.exercises || []).map((x) => {
    const it = INTENSITIES.find((i) => i.id === x.intensity);
    return `<div class="rec-row"><b>${it.emoji} 운동</b><span>${it.label} · ${x.minutes}분</span></div>`;
  }).join('');
  return meals + ex;
}

const result = {
  html(s) {
    const data = getData();
    const day = data.days[s.key];
    const isToday = s.key === todayKey();
    const title = isToday ? '오늘 결과' : prettyDate(parseKey(s.key));
    const backLabel = s.from ? '돌아가기' : '홈으로';
    if (!hasMeal(day) && !(day?.exercises || []).length) {
      return `${topBar({ title })}
        <main class="screen result">
          <div class="bubble">이 날은 기록이 없어요.</div>
          <button class="btn primary big" data-act="back">${backLabel}</button>
        </main>`;
    }
    const r = dayResult(data, s.key);
    const groups = ['v', 'f', 'p', 'd'].map((g) => {
      const on = r.groups.has(g);
      return `<div class="group ${on ? 'on' : ''}"><span class="group-emoji">${FOOD_GROUPS[g].emoji}</span>
        <span>${FOOD_GROUPS[g].label}</span><span class="group-mark">${on ? '✓' : ''}</span></div>`;
    }).join('');
    const dayWord = isToday ? '오늘' : '이 날';
    return `${topBar({ title })}
      <main class="screen result">
        <div class="bubble">${h(isToday ? pickPhrase(r, s.key) : pickPhrase(r, s.key).replace(/오늘/g, '이 날'))}</div>
        <section class="card result-card">
          <div class="r-row"><span>🍽️ 먹은 에너지</span><b>${fmt(r.intake)} kcal</b></div>
          <div class="r-row"><span>🏃 움직여서 쓴 에너지</span><b>${fmt(r.burned)} kcal</b></div>
          <div class="r-row"><span>🔋 기본으로 쓰는 에너지</span><b>${fmt(r.base)} kcal</b></div>
          <div class="r-row total"><span>⚖️ ${dayWord}의 균형</span><b>${signed(r.balance)} kcal</b></div>
          <p class="r-note">먹은 에너지에서 쓴 에너지(기본 + 운동)를 뺀 값이에요. 모두 대략이라서 하루 숫자보다 한 주 흐름을 보는 데 써요.</p>
          ${r.burned && !r.weightMeasured ? '<p class="r-note">체중 기록 전이라 같은 나이 평균 체중으로 계산했어요.</p>' : ''}
        </section>
        <h2 class="sub">${dayWord} 먹은 식품군</h2>
        <div class="groups">${groups}</div>
        <h2 class="sub">${dayWord} 기록</h2>
        <section class="card records">${dayRecordsHtml(day)}</section>
        <button class="btn primary big" data-act="back">${backLabel}</button>
      </main>`;
  },
  acts: {
    back(s) {
      if (s.from) go(s.from);
      else goHome();
    },
  },
};

// ---------- 캘린더 ----------

function calendarGrid(s) {
  const data = getData();
  const first = new Date(s.year, s.month, 1);
  const daysIn = new Date(s.year, s.month + 1, 0).getDate();
  const lead = (first.getDay() - WEEK_START + 7) % 7;
  const today = todayKey();
  const bodyDates = new Set(data.body.map((b) => b.date));
  const names = ['일', '월', '화', '수', '목', '금', '토'];
  let cells = '';
  for (let i = 0; i < 7; i += 1) cells += `<div class="cal-head">${names[(WEEK_START + i) % 7]}</div>`;
  for (let i = 0; i < lead; i += 1) cells += '<div></div>';
  for (let d = 1; d <= daysIn; d += 1) {
    const key = dateKey(new Date(s.year, s.month, d));
    const day = data.days[key];
    const meal = hasMeal(day);
    const ex = (day?.exercises || []).length > 0;
    const future = key > today;
    cells += `<button class="cal-day ${key === today ? 'today' : ''}" data-act="day" data-key="${key}" ${future ? 'disabled' : ''}
        aria-label="${s.month + 1}월 ${d}일${meal ? ', 식사 기록' : ''}${ex ? ', 운동 기록' : ''}${bodyDates.has(key) ? ', 체중 기록' : ''}">
      <span class="cal-num">${d}${bodyDates.has(key) ? '<i class="cal-dot"></i>' : ''}</span>
      <span class="cal-icons">${meal ? '🍚' : ''}${ex ? '🏃' : ''}</span>
    </button>`;
  }
  return cells;
}

function monthSection(s) {
  const days = monthDaily(getData(), s.year, s.month);
  if (!days.some((d) => d.intake !== null || d.minutes)) return '';
  let detail = '날짜를 누르면 그날 값이 보여요.';
  const d = s.mday !== null && s.mday !== undefined ? days[s.mday] : null;
  if (d) {
    detail = `<b>${s.month + 1}/${d.day}</b> · 먹은 에너지 ${d.intake === null ? '기록 없음' : `${fmt(d.intake)} kcal`}
      · 운동 ${d.minutes ? `${d.minutes}분` : '없음'}`;
  }
  return `<section class="card chart-card">
    <div class="card-title">${s.month + 1}월 식사·운동</div>
    <p class="week-detail">${detail}</p>
    ${monthCharts(days, s.mday ?? null)}
  </section>`;
}

function weeklySection(s) {
  const data = getData();
  const count = recordedWeekCount(data);
  if (count < WEEKS_FOR_GRAPH) {
    return `<section class="card chart-card">
      <div class="card-title">한 주 흐름</div>
      <p class="card-sub wrap">기록이 쌓이는 중이에요. ${WEEKS_FOR_GRAPH}주쯤 모이면 먹고 움직인 것과 체중이 함께 움직이는 그래프가 여기에 생겨요.</p>
      <div class="progress soft"><div class="progress-fill" style="width:${(count / WEEKS_FOR_GRAPH) * 100}%"></div></div>
      <p class="hint">${count} / ${WEEKS_FOR_GRAPH}주</p>
    </section>`;
  }
  const weeks = weeklySeries(data, GRAPH_WEEKS);
  const sel = s.week;
  let detail = '주 칸을 누르면 그 주의 값이 보여요.';
  if (sel !== null && weeks[sel]) {
    const w = weeks[sel];
    const [, m1, d1] = w.start.split('-').map(Number);
    const [, m2, d2] = w.end.split('-').map(Number);
    detail = `<b>${m1}/${d1}~${m2}/${d2}</b> · 평균 균형 ${w.balance === null ? '기록 없음' : `${signed(w.balance)} kcal`}
      · 체중 ${w.weight === null ? '기록 없음' : `${w.weight} kg`}`;
  }
  return `<section class="card chart-card">
    <div class="card-title">한 주 흐름</div>
    <p class="week-detail">${detail}</p>
    ${weeklyCharts(weeks, sel)}
  </section>`;
}

function weekRange(start) {
  const [, m1, d1] = start.split('-').map(Number);
  const e = parseKey(start);
  e.setDate(e.getDate() + 6);
  return `${m1}/${d1}~${e.getMonth() + 1}/${e.getDate()}`;
}

function reviewSection(s) {
  const data = getData();
  const lw = lastWeekStart();
  let target = lw;
  if (s.week !== null) {
    const w = weeklySeries(data, GRAPH_WEEKS)[s.week];
    if (w && w.start <= lw) target = w.start;
  }
  const stored = data.reviews?.[target];
  const past = Object.keys(data.reviews || {}).filter((k) => k !== target).sort().reverse();
  const body = stored
    ? `<p class="review-text">${h(stored.text)}</p>`
    : `<p class="card-sub wrap">이 주의 리뷰는 아직 없어요.</p>
       <button class="btn" data-act="review" data-key="${target}">📝 ${weekRange(target)} 돌아보기</button>`;
  return `<section class="card chart-card">
    <div class="card-title">주간 리뷰 <small class="muted">${weekRange(target)}</small></div>
    ${body}
    ${past.length ? `<details class="past-reviews"><summary>지난 리뷰 ${past.length}개</summary>
      ${past.map((k) => `<div class="past-review"><b>${weekRange(k)}</b><p>${h(data.reviews[k].text)}</p></div>`).join('')}
    </details>` : ''}
  </section>`;
}

async function fillBmi() {
  const box = document.getElementById('bmi');
  if (!box) return;
  const data = getData();
  const p = data.profile;
  const nowMonths = ageMonths(p, new Date());
  const pts = bodyPoints(data);
  if (!inChildRange(nowMonths)) {
    const last = pts[pts.length - 1];
    box.innerHTML = `<div class="card-title">BMI</div>
      <p class="card-sub wrap">${last ? `마지막 기록 BMI는 <b>${bmiValue(last.weight, last.height).toFixed(1)}</b>이에요.` : '체중과 키를 적으면 BMI가 보여요.'}</p>`;
    return;
  }
  try {
    const table = await loadTable(p.sex);
    if (!document.getElementById('bmi')) return;
    const points = pts.filter((x) => inChildRange(x.months)).map((x) => ({ ...x, bmi: bmiValue(x.weight, x.height) }));
    const last = points[points.length - 1];
    const pct = last ? percentile(table, last.months, last.bmi) : null;
    box.innerHTML = `<div class="card-title">BMI 성장도표</div>
      <p class="card-sub wrap">${last
        ? `마지막 기록: BMI ${last.bmi.toFixed(1)} · 백분위 ${pct.label}`
        : '일요일에 체중과 키를 적으면 내 위치가 점으로 찍혀요.'}</p>
      ${bmiChart(table, points, nowMonths)}
      <p class="r-note">질병관리청 2017 소아청소년 성장도표 기준이에요. 오른쪽 숫자는 백분위 곡선이에요.</p>`;
  } catch (e) {
    box.innerHTML = '<div class="card-title">BMI 성장도표</div><p class="card-sub wrap">성장도표를 불러오지 못했어요. 인터넷 연결을 확인해 주세요.</p>';
  }
}

const calendar = {
  html(s) {
    const isCurrent = s.year === new Date().getFullYear() && s.month === new Date().getMonth();
    return `${topBar({ title: '내 기록' })}
      <main class="screen calendar">
        <div class="cal-nav">
          <button class="icon-btn" data-act="month" data-d="-1" aria-label="이전 달">‹</button>
          <b>${s.year}년 ${s.month + 1}월</b>
          <button class="icon-btn" data-act="month" data-d="1" aria-label="다음 달" ${isCurrent ? 'disabled' : ''}>›</button>
        </div>
        <section class="card cal-card"><div class="cal-grid">${calendarGrid(s)}</div>
          <p class="cal-legend">🍚 식사 · 🏃 운동 · <i class="cal-dot"></i> 체중</p></section>
        ${monthSection(s)}
        <div class="cal-actions">
          <button class="btn big" data-act="summary">📋 ${s.month + 1}월 요약</button>
          <button class="btn big ${getData().reviews?.[lastWeekStart()] ? '' : 'fresh'}" data-act="review" data-key="${lastWeekStart()}">📝 지난주 돌아보기</button>
        </div>
        ${weeklySection(s)}
        ${reviewSection(s)}
        <section class="card chart-card" id="bmi"><div class="card-title">BMI</div><p class="card-sub">불러오는 중…</p></section>
      </main>`;
  },
  mount() { fillBmi(); },
  acts: {
    back: () => goHome(),
    mday(s, d) {
      const i = Number(d.idx);
      s.mday = s.mday === i ? null : i;
      render();
    },
    month(s, d) {
      s.mday = null;
      const dt = new Date(s.year, s.month + Number(d.d), 1);
      s.year = dt.getFullYear();
      s.month = dt.getMonth();
      render();
    },
    day(s, d) { go({ name: 'result', key: d.key, from: s }); },
    week(s, d) {
      const i = Number(d.idx);
      s.week = s.week === i ? null : i;
      render();
    },
    summary(s) { go({ name: 'summary', year: s.year, month: s.month, from: s }); },
    review(s, d) { go({ name: 'review', key: d.key, from: s }); },
  },
};

// ---------- 주간 리뷰 ----------

const SHORT_WEEK_TEXT = `이 주는 기록한 날이 ${REVIEW_MIN_DAYS}일보다 적어서 리뷰를 쉬어 가요. 이번 주에 ${REVIEW_MIN_DAYS}일 넘게 기록하면 다음 일요일에 리뷰가 찾아와요!`;

const review = {
  html(s) {
    const data = getData();
    const dg = weekDigest(data, s.key);
    const stored = data.reviews?.[s.key];
    const stats = `<div class="week-stats">
      <div><b>${dg.recordedDays}일</b><span>기록한 날</span></div>
      <div><b>${dg.vegDays}일</b><span>🥦 채소</span></div>
      <div><b>${dg.fruitDays}일</b><span>🍎 과일</span></div>
      <div><b>${dg.exMinutes}분</b><span>🏃 운동</span></div>
    </div>`;
    let body;
    if (stored) {
      body = `<div class="bubble review-bubble">${h(stored.text)}</div>`;
    } else if (dg.recordedDays < REVIEW_MIN_DAYS) {
      body = `<div class="bubble review-bubble">${SHORT_WEEK_TEXT}</div>`;
    } else if (s.asking) {
      body = `<div class="card center-card"><div class="thinking" aria-hidden="true"><i></i><i></i><i></i></div>
        <p class="hint">지난주 기록을 읽는 중이야…</p></div>`;
    } else {
      const why = hasApiKey() ? '이번엔 리뷰를 받아 오지 못했어요. 다음에 다시 열어 보세요.' : '리뷰는 설정에서 Claude 키를 넣으면 만들어져요.';
      body = `<p class="hint">${why}</p>
        <section class="card chart-card"><div class="card-title">한 주 흐름</div>
          ${weeklyCharts(weeklySeries(data, GRAPH_WEEKS), null)}</section>
        ${hasApiKey() ? '<button class="btn big" data-act="retry">다시 해 보기</button>' : ''}`;
    }
    return `${topBar({ title: `${weekRange(s.key)} 돌아보기` })}
      <main class="screen">
        ${stats}
        ${body}
        <button class="btn primary big" data-act="back">${s.from ? '돌아가기' : '홈으로'}</button>
      </main>`;
  },
  mount(s) {
    const data = getData();
    if (s.tried || data.reviews?.[s.key] || !hasApiKey()) return;
    const dg = weekDigest(data, s.key);
    if (dg.recordedDays < REVIEW_MIN_DAYS) return;
    s.tried = true;
    s.asking = true;
    render();
    writeReview(dg.text).then((text) => {
      if (text) {
        if (!data.reviews) data.reviews = {};
        data.reviews[s.key] = { text, at: Date.now() };
        save();
      }
      s.asking = false;
      if (screen === s) render();
    });
  },
  acts: {
    back(s) { if (s.from) go(s.from); else goHome(); },
    retry(s) { s.tried = false; render(); },
  },
};

// ---------- 월간 요약 ----------

const summary = {
  html(s) {
    const data = getData();
    const sum = monthSummary(data, s.year, s.month);
    const p = data.profile;
    const change = (c, unit) => {
      if (!c) return '기록 없음';
      if (c.firstDate === c.lastDate) return `${c.last} ${unit}`;
      return `${c.first} → ${c.last} ${unit}`;
    };
    return `${topBar({ title: `${s.month + 1}월 요약` })}
      <main class="screen">
        <section class="card summary-card">
          <div class="card-title">${s.year}년 ${s.month + 1}월</div>
          <p class="card-sub">${h(p.name)} · 만 ${ageYears(p, new Date(s.year, s.month + 1, 0))}세 · ${p.sex === 'M' ? '남자' : '여자'}</p>
          <div class="r-row"><span>기록한 날</span><b>${sum.recordedDays}일</b></div>
          <div class="r-row"><span>하루 평균 섭취</span><b>${sum.avgIntake === null ? '기록 없음' : `${fmt(sum.avgIntake)} kcal`}</b></div>
          <div class="r-row"><span>운동</span><b>${sum.exCount}번 · ${fmt(sum.exMinutes)}분</b></div>
          <div class="r-row"><span>체중</span><b>${change(sum.weight, 'kg')}</b></div>
          <div class="r-row last"><span>키</span><b>${change(sum.height, 'cm')}</b></div>
          <p class="r-note">평균 섭취는 식사를 기록한 날만 셌어요. 칼로리는 모두 대략이에요.</p>
        </section>
        <button class="btn primary big" data-act="back">돌아가기</button>
      </main>`;
  },
  acts: { back(s) { go(s.from); } },
};

// ---------- 연속 기록과 뱃지 ----------

const GRID_WEEKS = 5;

// 최근 몇 주를 한 줄에 한 주씩 칸으로 보여준다
function recordGrid(data) {
  const today = todayKey();
  const start = parseKey(weekStartKeyOf(new Date()));
  start.setDate(start.getDate() - 7 * (GRID_WEEKS - 1));
  const names = ['일', '월', '화', '수', '목', '금', '토'];
  let cells = names.map((n, i) => `<span class="rg-head">${names[(WEEK_START + i) % 7]}</span>`).join('');
  for (let i = 0; i < GRID_WEEKS * 7; i += 1) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const k = dateKey(d);
    const cls = k > today ? 'future' : hasMeal(data.days[k]) ? 'done' : '';
    cells += `<span class="rg-cell ${cls} ${k === today ? 'today' : ''}" title="${d.getMonth() + 1}/${d.getDate()}">${d.getDate()}</span>`;
  }
  return `<div class="record-grid">${cells}</div>`;
}

const badgesView = {
  html() {
    const data = getData();
    const st = streakInfo(data, todayKey());
    const got = data.badges || {};
    const cards = BADGES.map((b) => {
      const when = got[b.id];
      const [, m, d] = when ? when.split('-').map(Number) : [];
      return `<div class="badge-card ${when ? 'got' : ''}">
        <span class="badge-emoji">${b.emoji}</span>
        <b>${b.name}</b>
        <small>${when ? `${m}월 ${d}일에 받았어요` : b.desc}</small>
      </div>`;
    }).join('');
    return `${topBar({ title: '연속 기록과 뱃지' })}
      <main class="screen">
        ${streakCard(data, st, null)}
        <p class="hint">하루에 식사를 한 번이라도 기록하면 이어져요. 가장 길게 이어 간 기록은 ${st.best}일이에요.</p>
        <section class="card chart-card">
          <div class="card-title">최근 ${GRID_WEEKS}주 기록</div>
          ${recordGrid(data)}
          <p class="r-note">초록 칸은 식사를 기록한 날이에요.</p>
        </section>
        <h2 class="sub">뱃지 ${Object.keys(got).length} / ${BADGES.length}</h2>
        <div class="badge-grid">${cards}</div>
      </main>`;
  },
  acts: { back: () => goHome() },
};

// ---------- 설정 ----------

const settings = {
  html(s) {
    const p = getData().profile;
    const rec = recommendedBaseline(p);
    const cur = baseline(p);
    return `${topBar({ title: '설정' })}
      <main class="screen">
        <section class="card settings-card">
          <div class="card-title">${h(p.name)}</div>
          <p class="card-sub">${p.birthYear}년 ${p.birthMonth}월생 · 만 ${ageYears(p, new Date())}세 · ${p.sex === 'M' ? '남자' : '여자'}</p>
        </section>
        <section class="card settings-card">
          <div class="card-title">하루 기본 에너지</div>
          <p class="card-sub wrap">나이와 성별로 추천한 값은 ${fmt(rec)} kcal예요. 필요하면 바꿀 수 있어요.</p>
          <div class="stepper three">
            <button class="btn step-btn" data-act="base" data-d="-1">−${BASELINE_STEP}</button>
            <div class="step-value">${fmt(cur)}<small>kcal</small></div>
            <button class="btn step-btn" data-act="base" data-d="1">+${BASELINE_STEP}</button>
          </div>
          ${p.baseline ? '<button class="btn ghost" data-act="baseReset">추천값으로 되돌리기</button>' : ''}
        </section>
        <section class="card settings-card">
          <div class="card-title">Claude 연결</div>
          ${hasApiKey()
            ? `<p class="card-sub wrap">✅ API 키가 저장되어 있어요. 키는 다시 보여주지 않아요.</p>
               <div class="row">
                 <button class="btn" data-act="testKey">연결 확인</button>
                 <button class="btn ghost" data-act="removeKey">키 지우기</button>
               </div>`
            : `<p class="card-sub wrap">부모님이 이 앱 전용 키를 한 번 넣어 주세요. 키가 없어도 기록은 모두 돼요.</p>
               <input id="apikey" class="text-input" type="password" autocomplete="off" placeholder="sk-ant-...">
               <button class="btn primary" data-act="saveKey">저장</button>`}
          ${s.keyMsg ? `<p class="hint left">${h(s.keyMsg)}</p>` : ''}
        </section>
        <section class="card settings-card">
          <div class="card-title">효과음</div>
          <div class="seg full">
            <button class="seg-btn ${soundOn() ? 'on' : ''}" data-act="sound" data-v="1">🔔 켜기</button>
            <button class="seg-btn ${soundOn() ? '' : 'on'}" data-act="sound" data-v="0">🔕 끄기</button>
          </div>
        </section>
        ${isStandalone() ? '' : `<section class="card settings-card">
          <div class="card-title">홈 화면에 추가하기</div>
          <p class="card-sub wrap">사파리 아래쪽(아이패드는 위쪽)의 공유 버튼 <b>⬆︎</b> → <b>홈 화면에 추가</b>를 누르면 앱처럼 쓸 수 있어요. 홈 화면에 추가해서 쓰면 기록이 더 안전하게 보관돼요.</p>
        </section>`}
        <section class="card settings-card">
          <div class="card-title">기록 보관</div>
          <p class="card-sub wrap">기록은 이 기기에만 저장돼요. 가끔 파일로 내보내 두면 기기를 바꿔도 가져올 수 있어요. 파일에 API 키는 들어가지 않아요.</p>
          <div class="row">
            <button class="btn" data-act="exportData">📤 내보내기</button>
            <button class="btn" data-act="importData">📥 가져오기</button>
          </div>
          <input id="importFile" type="file" accept="application/json,.json" hidden>
          ${s.dataMsg ? `<p class="hint left">${h(s.dataMsg)}</p>` : ''}
          <button class="btn ghost danger" data-act="resetData">기록 모두 지우기</button>
        </section>
        <section class="card settings-card">
          <div class="card-title">앱 버전</div>
          <p class="card-sub wrap">지금 버전: ${APP_VERSION}. 홈 화면 아이콘으로 쓸 때는 이 버튼으로 새 버전을 받아요. 기록은 그대로 남아요.</p>
          <button class="btn primary" data-act="update" ${s.updating ? 'disabled' : ''}>${s.updating ? '받아 오는 중…' : '🔄 최신 버전 가져오기'}</button>
          ${s.updateMsg ? `<p class="hint left">${h(s.updateMsg)}</p>` : ''}
        </section>
      </main>`;
  },
  acts: {
    back: () => goHome(),
    base(s, d) {
      const p = getData().profile;
      const next = Math.min(4000, Math.max(800, baseline(p) + Number(d.d) * BASELINE_STEP));
      p.baseline = next === recommendedBaseline(p) ? null : next;
      save();
      render();
    },
    exportData(s) {
      const blob = new Blob([exportJson()], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `meogeobara-${todayKey()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      s.dataMsg = '파일을 저장했어요. 파일 앱이나 다운로드 폴더에서 찾을 수 있어요.';
      render();
    },
    importData(s) {
      const input = document.getElementById('importFile');
      input.onchange = async () => {
        const file = input.files[0];
        if (!file) return;
        if (!window.confirm('지금 이 기기의 기록을 파일의 기록으로 바꿀까요? 지금 기록은 사라져요.')) return;
        try {
          importJson(await file.text());
          s.dataMsg = '';
          go({ name: 'home' });
          toast('기록을 가져왔어요!', `${getData().profile.name}의 기록이에요.`);
        } catch (e) {
          s.dataMsg = `가져오지 못했어요. ${e.message || ''}`;
          render();
        }
      };
      input.click();
    },
    resetData() {
      if (!window.confirm('이 기기의 기록을 모두 지울까요? 되돌릴 수 없어요.')) return;
      if (!window.confirm('정말 지울까요? 먼저 내보내기를 해 두면 나중에 가져올 수 있어요.')) return;
      resetData();
      go({ name: 'onboarding', step: 1, userName: '', birthYear: null, birthMonth: null });
    },
    async update(s) {
      s.updating = true;
      s.updateMsg = '';
      render();
      const r = await refreshApp();
      if (!r.ok) {
        s.updating = false;
        s.updateMsg = '인터넷에 연결되어 있는지 확인하고 다시 눌러 주세요.';
        if (screen === s) render();
      }
    },
    saveKey(s) {
      const v = document.getElementById('apikey').value.trim();
      if (!v) return;
      setApiKey(v);
      s.keyMsg = '저장했어요. 연결 확인을 눌러 보세요.';
      render();
    },
    removeKey(s) {
      setApiKey(null);
      s.keyMsg = '키를 지웠어요.';
      render();
    },
    async testKey(s) {
      s.keyMsg = '확인하는 중…';
      render();
      const r = await testConnection();
      s.keyMsg = r.ok ? '✅ Claude와 연결됐어요!' : (r.kind === 'auth' ? '키가 맞지 않아요. 지우고 다시 넣어 주세요.' : `연결하지 못했어요. (${r.message})`);
      if (screen === s) render();
    },
    sound(s, d) {
      const data = getData();
      data.settings = { ...(data.settings || {}), sound: d.v === '1' };
      save();
      if (d.v === '1') playCheer();
      render();
    },
    baseReset() {
      getData().profile.baseline = null;
      save();
      render();
    },
  },
};

const VIEWS = { onboarding, home, meal, newMenu, exercise, body, result, settings, calendar, summary, review, badges: badgesView, celebrate: celebrateView };

// ---------- 시작 ----------

function isStandalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
}

askPersist();
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

try {
  const up = JSON.parse(sessionStorage.getItem('meogeobara.updated') || 'null');
  if (up) {
    sessionStorage.removeItem('meogeobara.updated');
    setTimeout(() => toast(
      up.to && up.to !== up.from ? '새 버전으로 바꿨어요!' : '이미 최신 버전이에요',
      `지금 버전: ${APP_VERSION}`,
    ), 300);
  }
} catch (e) {
  // 알림을 못 띄워도 앱은 그대로 동작한다
}

if (getData().profile) {
  go({ name: 'home' });
} else {
  go({ name: 'onboarding', step: 1, userName: '', birthYear: null, birthMonth: null });
}
