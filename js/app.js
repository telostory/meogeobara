import {
  PORTIONS, DEFAULT_PORTION, INTENSITIES, EXERCISE_MINUTES, NEW_MENU_SIZES, MEALS,
  BODY_DAY, WEEK_START, RECENT_TAG_COUNT, FREQUENT_TAG_COUNT,
  SEARCH_RESULT_COUNT, CELEBRATE_MS, BODY_START, BASELINE_STEP, FOOD_GROUPS, FREEZE_REFILL_DAYS,
} from './config.js';
import { dayResult, hasMeal, recommendedBaseline, baseline, ageYears, ageMonths, itemKcal } from './calc.js';
import { weeklySeries, recordedWeekCount, bodyPoints, monthSummary, lastWeekStart, weekDigest } from './progress.js';
import { hasApiKey, setApiKey, estimateMenu, writeReview, testConnection } from './claude.js';
import { loadTable, bmiValue, percentile, inChildRange } from './bmi.js';
import { weeklyCharts, bmiChart } from './charts.js';
import { pickPhrase } from './phrases.js';
import { streakInfo } from './streak.js';
import { BADGES, awardBadges } from './badges.js';
import { playCheer } from './sound.js';
import { WEEKS_FOR_GRAPH, GRAPH_WEEKS, REVIEW_MIN_DAYS } from './config.js';
import { BASE_MENUS, STARTER_TAGS } from './menus.js';
import { getData, getDay, save } from './storage.js';
import { dateKey, parseKey, prettyDate, escapeHtml as h, matchesQuery } from './util.js';

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
  window.scrollTo(0, 0);
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

function render() {
  const view = VIEWS[screen.name];
  app.innerHTML = view.html(screen);
  app.dataset.screen = screen.name;
  if (view.mount) view.mount(screen);
}

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
  return PORTIONS.find((p) => p.id === id)?.label || '';
}

function todayKey() {
  return dateKey(new Date());
}

// ---------- 첫 실행 ----------

const thisYear = new Date().getFullYear();

const onboarding = {
  html(s) {
    const total = 4;
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
      body = `<h1 class="q">몇 년에 태어났어?</h1>
        <div class="stepper">
          <button class="btn step-btn" data-act="year" data-d="-10">−10</button>
          <button class="btn step-btn" data-act="year" data-d="-1">−1</button>
          <div class="step-value">${s.birthYear}<small>년</small></div>
          <button class="btn step-btn" data-act="year" data-d="1">+1</button>
          <button class="btn step-btn" data-act="year" data-d="10">+10</button>
        </div>
        <button class="btn primary big" data-act="next">다음</button>`;
    } else if (s.step === 3) {
      const months = Array.from({ length: 12 }, (_, i) => i + 1)
        .map((m) => `<button class="btn choice ${s.birthMonth === m ? 'on' : ''}" data-act="month" data-m="${m}">${m}월</button>`)
        .join('');
      body = `<h1 class="q">몇 월에 태어났어?</h1><div class="grid-3">${months}</div>`;
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
    const input = document.getElementById('name');
    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') onboarding.acts.nameNext(s);
      });
    }
  },
  acts: {
    prev(s) { s.step -= 1; render(); },
    next(s) { s.step += 1; render(); },
    nameNext(s) {
      const v = document.getElementById('name').value.trim();
      if (!v) { document.getElementById('name').focus(); return; }
      s.userName = v; s.step = 2; render();
    },
    year(s, d) {
      s.birthYear = Math.min(thisYear, Math.max(1930, s.birthYear + Number(d.d)));
      render();
    },
    month(s, d) { s.birthMonth = Number(d.m); s.step = 4; render(); },
    sex(s, d) {
      const data = getData();
      data.profile = { name: s.userName, birthYear: s.birthYear, birthMonth: s.birthMonth, sex: d.v, baseline: null };
      save();
      celebrate(`반가워, ${s.userName}!`, '오늘 먹은 것부터 기록해 볼까?');
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

const home = {
  html() {
    const data = getData();
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
    const frozeYesterday = st.frozenDays.has(dateKey(y));
    const tasks = ['breakfast', 'lunch', 'dinner'].map((m) => (day.meals[m] || []).length > 0).concat(minutes > 0);
    const doneCount = tasks.filter(Boolean).length;
    const statusRow = `<button class="streak-row" data-act="badges" aria-label="스트릭과 뱃지 보기">
        <span class="pill ${st.todayDone ? 'lit' : ''}">🔥 <b>${st.streak}</b>일 연속</span>
        <span class="pill">🧊 프리즈 <b>${st.freeze}</b></span>
        <span class="pill">🏅 <b>${Object.keys(data.badges || {}).length}</b></span>
      </button>
      ${frozeYesterday ? '<p class="freeze-note">어제는 🧊 프리즈가 스트릭을 지켜 줬어요!</p>' : ''}
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
    const isReviewDay = new Date().getDay() === WEEK_START;
    const reviewCard = isReviewDay
      ? `<button class="card review-card" data-act="review">
          <span class="card-emoji">📝</span>
          <span class="card-title">지난주 돌아보기</span>
          <span class="card-sub">${data.reviews?.[lastWeekStart()] ? '리뷰 다시 보기' : '지난 한 주는 어땠을까?'}</span>
        </button>`
      : '';
    const canClose = hasMeal(day) || day.exercises.length;
    const closeBtn = canClose
      ? `<button class="btn primary big" data-act="close">${day.closed ? '📊 오늘 결과 보기' : '🌟 오늘 마감'}</button>`
      : '';
    return `<header class="home-head"><button class="icon-btn" data-act="calendar" aria-label="캘린더">📅</button>${brand()}
        <button class="icon-btn" data-act="settings" aria-label="설정">⚙️</button></header>
      <main class="screen home">
        <p class="date">${prettyDate()}</p>
        <h1 class="hello">${h(data.profile.name)}, 오늘 뭐 먹었어?</h1>
        ${statusRow}
        ${bodyCard}
        ${reviewCard}
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
      day.closed = true;
      save();
      go({ name: 'result', key: todayKey() });
    },
    settings() { go({ name: 'settings' }); },
    badges() { go({ name: 'badges' }); },
    review() { go({ name: 'review', key: lastWeekStart() }); },
    calendar() {
      const now = new Date();
      go({ name: 'calendar', year: now.getFullYear(), month: now.getMonth(), week: null });
    },
    body() {
      const last = [...getData().body].reverse();
      const w = last.find((b) => b.weight)?.weight ?? BODY_START.weight;
      const ht = last.find((b) => b.height)?.height ?? BODY_START.height;
      go({ name: 'body', step: 1, weight: w, height: ht });
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
  const starter = recent.length ? [] : STARTER_TAGS[mealId].filter((id) => findMenu(id));
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
    <div class="cart-row">
      <div class="cart-name">${h(it.name)}</div>
      <div class="seg" role="group" aria-label="${h(it.name)} 양">
        ${PORTIONS.map((p) => `<button class="seg-btn ${it.portion === p.id ? 'on' : ''}" data-act="portion" data-idx="${idx}" data-p="${p.id}">${p.label}</button>`).join('')}
      </div>
      <button class="icon-btn small" data-act="remove" data-idx="${idx}" aria-label="${h(it.name)} 빼기">✕</button>
    </div>`).join('');
}

function addItem(s, menu) {
  if (s.items.some((i) => i.menuId === menu.id)) return;
  s.items.push({ menuId: menu.id, name: menu.name, kcal: menu.kcal, groups: menu.groups, portion: DEFAULT_PORTION });
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
        ${section('이런 메뉴 있어요', starter)}
        <div class="search">
          <input id="search" class="text-input" type="search" autocomplete="off" placeholder="🔍 메뉴 찾기" value="${h(s.query)}">
          <div id="results">${searchResultsHtml(s)}</div>
        </div>
        <h2 class="sub">담은 메뉴</h2>
        <div class="cart">${cartHtml(s)}</div>
        <div class="bottom-space"></div>
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
      celebrate(`${label} 기록 완료!`, sub);
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
      celebrate('운동 기록 완료!', `${d.m}분 동안 움직였어요. 멋져!`);
    },
  },
};

// ---------- 체중과 키 ----------

function bodyStepper(value, unit) {
  return `<div class="stepper">
    <button class="btn step-btn" data-act="adj" data-d="-1">−1</button>
    <button class="btn step-btn" data-act="adj" data-d="-0.1">−0.1</button>
    <div class="step-value">${value.toFixed(1)}<small>${unit}</small></div>
    <button class="btn step-btn" data-act="adj" data-d="0.1">+0.1</button>
    <button class="btn step-btn" data-act="adj" data-d="1">+1</button>
  </div>`;
}

const body = {
  html(s) {
    if (s.step === 1) {
      return `${topBar({ step: 1, total: 2 })}
        <main class="screen">
          <h1 class="q">체중을 맞춰 줘</h1>
          ${bodyStepper(s.weight, 'kg')}
          <button class="btn primary big" data-act="next">다음</button>
        </main>`;
    }
    return `${topBar({ step: 2, total: 2 })}
      <main class="screen">
        <h1 class="q">키를 맞춰 줘</h1>
        ${bodyStepper(s.height, 'cm')}
        <button class="btn primary big" data-act="save">저장하기</button>
        <button class="btn ghost big" data-act="saveNoHeight">키는 이번엔 건너뛰기</button>
      </main>`;
  },
  acts: {
    back(s) {
      if (s.step === 2) { s.step = 1; render(); } else goHome();
    },
    adj(s, d) {
      const key = s.step === 1 ? 'weight' : 'height';
      const [min, max] = s.step === 1 ? [10, 200] : [80, 220];
      s[key] = Math.min(max, Math.max(min, Math.round((s[key] + Number(d.d)) * 10) / 10));
      render();
    },
    next(s) { s.step = 2; render(); },
    save(s) { saveBody(s.weight, s.height); },
    saveNoHeight(s) { saveBody(s.weight, null); },
  },
};

function saveBody(weight, height) {
  const data = getData();
  const today = todayKey();
  data.body = data.body.filter((b) => b.date !== today);
  data.body.push({ date: today, weight, height });
  data.body.sort((a, b) => a.date.localeCompare(b.date));
  save();
  celebrate('몸 기록 완료!', '다음 주 일요일에 또 만나요.');
}

// ---------- 축하 ----------

// 저장할 때마다 부른다: 새 뱃지를 확인하고, 효과음을 내고, 축하 화면을 띄운다
function celebrate(title, sub) {
  const data = getData();
  const badges = data.profile ? awardBadges(data, todayKey()) : [];
  save();
  if (soundOn()) playCheer(badges.length > 0);
  go({ name: 'celebrate', title, sub, badges: badges.map((b) => b.id) });
}

function soundOn() {
  return getData().settings?.sound !== false;
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
    return `<main class="screen celebrate" data-act="done">
        <div class="confetti" aria-hidden="true">${bits}</div>
        <div class="badge-pop">✓</div>
        <h1 class="q">${h(s.title)}</h1>
        <p class="celebrate-sub">${h(s.sub)}</p>
        ${s.badges.length ? `<div class="new-badges">
          <p class="new-badges-title">새 뱃지를 받았어!</p>
          ${s.badges.map((id) => BADGES.find((b) => b.id === id)).map((b) => `<div class="badge-chip"><span>${b.emoji}</span><b>${b.name}</b></div>`).join('')}
        </div>` : ''}
        <button class="btn primary big" data-act="done">확인</button>
      </main>`;
  },
  mount(s) {
    // 뱃지를 받은 날은 천천히 볼 수 있게 저절로 닫지 않는다
    if (!s.badges.length) celebrateTimer = setTimeout(() => celebrateView.acts.done(), CELEBRATE_MS);
  },
  acts: {
    done() {
      clearTimeout(celebrateTimer);
      if (history.state && history.state.inner) history.back();
      else go({ name: 'home' });
    },
  },
};

// ---------- 하루 결과 ----------

const fmt = (n) => Math.round(n).toLocaleString('ko-KR');
const signed = (n) => (n > 0 ? `+${fmt(n)}` : n < 0 ? `−${fmt(-n)}` : '0');

function dayRecordsHtml(day) {
  const meals = MEALS.filter((m) => (day?.meals?.[m.id] || []).length).map((m) => `
    <div class="rec-row"><b>${m.emoji} ${m.label}</b>
      <span>${day.meals[m.id].map((it) => `${h(it.name)}${it.portion !== DEFAULT_PORTION ? ` (${portionLabel(it.portion)})` : ''}`).join(', ')}</span></div>`).join('');
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
        <div class="bubble">${h(pickPhrase(r, s.key))}</div>
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
  const frozen = streakInfo(data, today).frozenDays;
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
      <span class="cal-icons">${meal ? '🍚' : ''}${ex ? '🏃' : ''}${frozen.has(key) ? '🧊' : ''}</span>
    </button>`;
  }
  return cells;
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
          <p class="cal-legend">🍚 식사 · 🏃 운동 · 🧊 프리즈 · <i class="cal-dot"></i> 체중</p></section>
        <button class="btn big" data-act="summary">📋 ${s.month + 1}월 요약 보기</button>
        ${weeklySection(s)}
        ${reviewSection(s)}
        <section class="card chart-card" id="bmi"><div class="card-title">BMI</div><p class="card-sub">불러오는 중…</p></section>
      </main>`;
  },
  mount() { fillBmi(); },
  acts: {
    back: () => goHome(),
    month(s, d) {
      const dt = new Date(s.year, s.month + Number(d.d), 1);
      s.year = dt.getFullYear();
      s.month = dt.getMonth();
      render();
    },
    day(s, d) { go({ name: 'result', key: d.key, from: s }); },
    week(s, d) {
      const i = Number(d.idx);
      s.week = s.week === i ? null : i;
      const y = window.scrollY;
      render();
      window.scrollTo(0, y);
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

// ---------- 스트릭과 뱃지 ----------

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
    return `${topBar({ title: '스트릭과 뱃지' })}
      <main class="screen">
        <section class="card streak-card">
          <div class="streak-big">🔥 ${st.streak}<small>일 연속</small></div>
          <p class="card-sub wrap">하루에 식사를 한 번이라도 기록하면 이어져요. 가장 길게 이어 간 기록은 ${st.best}일이에요.</p>
          <div class="freeze-box">
            <span class="badge-emoji">🧊</span>
            <p>프리즈 <b>${st.freeze}개</b>. 기록을 하루 빠뜨리면 저절로 쓰여서 스트릭을 지켜 줘요. 다 쓰면 ${FREEZE_REFILL_DAYS}일 연속 기록할 때 다시 채워져요.</p>
          </div>
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

if (getData().profile) {
  go({ name: 'home' });
} else {
  go({ name: 'onboarding', step: 1, userName: '', birthYear: thisYear - 10, birthMonth: null });
}
