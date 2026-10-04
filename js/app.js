import {
  PORTIONS, DEFAULT_PORTION, INTENSITIES, EXERCISE_MINUTES, NEW_MENU_SIZES, MEALS,
  BODY_DAY, RECENT_TAG_COUNT, FREQUENT_TAG_COUNT,
  SEARCH_RESULT_COUNT, CELEBRATE_MS, BODY_START, BASELINE_STEP, FOOD_GROUPS,
} from './config.js';
import { dayResult, hasMeal, recommendedBaseline, baseline, ageYears } from './calc.js';
import { pickPhrase } from './phrases.js';
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
    return `<header class="home-head"><span class="icon-btn-space"></span>${brand()}
        <button class="icon-btn" data-act="settings" aria-label="설정">⚙️</button></header>
      <main class="screen home">
        <p class="date">${prettyDate()}</p>
        <h1 class="hello">${h(data.profile.name)}, 오늘 뭐 먹었어?</h1>
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
      day.closed = true;
      save();
      go({ name: 'result', key: todayKey() });
    },
    settings() { go({ name: 'settings' }); },
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
      go({ name: 'newMenu', menuName: s.query.trim(), mealState: s });
    },
    save(s) {
      const data = getData();
      const day = getDay(todayKey());
      const before = new Set((day.meals[s.mealId] || []).map((i) => i.menuId));
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
      if (s.items.length) celebrate(`${label} 기록 완료!`, '잘했어! 오늘도 한 칸 채웠어요.');
      else goHome();
    },
  },
};

// ---------- 새 메뉴 ----------

const newMenu = {
  html(s) {
    return `${topBar({ title: '새 메뉴' })}
      <main class="screen">
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
      const menu = { id: `c:${s.menuName}`, name: s.menuName, kcal: z.kcal, groups: '', source: 'size' };
      const data = getData();
      data.customMenus = data.customMenus.filter((m) => m.id !== menu.id);
      data.customMenus.unshift(menu);
      save();
      const ms = s.mealState;
      ms.query = '';
      addItem(ms, menu);
      go(ms);
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

function celebrate(title, sub) {
  go({ name: 'celebrate', title, sub });
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
        <button class="btn primary big" data-act="done">확인</button>
      </main>`;
  },
  mount() {
    celebrateTimer = setTimeout(() => celebrateView.acts.done(), CELEBRATE_MS);
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

const result = {
  html(s) {
    const r = dayResult(getData(), s.key);
    const groups = ['v', 'f', 'p', 'd'].map((g) => {
      const on = r.groups.has(g);
      return `<div class="group ${on ? 'on' : ''}"><span class="group-emoji">${FOOD_GROUPS[g].emoji}</span>
        <span>${FOOD_GROUPS[g].label}</span><span class="group-mark">${on ? '✓' : ''}</span></div>`;
    }).join('');
    const isToday = s.key === todayKey();
    return `${topBar({ title: isToday ? '오늘 결과' : prettyDate(parseKey(s.key)) })}
      <main class="screen result">
        <div class="bubble">${h(pickPhrase(r, s.key))}</div>
        <section class="card result-card">
          <div class="r-row"><span>🍽️ 먹은 에너지</span><b>${fmt(r.intake)} kcal</b></div>
          <div class="r-row"><span>🏃 움직여서 쓴 에너지</span><b>${fmt(r.burned)} kcal</b></div>
          <div class="r-row"><span>🔋 기본으로 쓰는 에너지</span><b>${fmt(r.base)} kcal</b></div>
          <div class="r-row total"><span>⚖️ 오늘의 균형</span><b>${signed(r.balance)} kcal</b></div>
          <p class="r-note">먹은 에너지에서 쓴 에너지(기본 + 운동)를 뺀 값이에요. 모두 대략이라서 하루 숫자보다 한 주 흐름을 보는 데 써요.</p>
          ${r.burned && !r.weightMeasured ? '<p class="r-note">체중 기록 전이라 같은 나이 평균 체중으로 계산했어요.</p>' : ''}
        </section>
        <h2 class="sub">오늘 먹은 식품군</h2>
        <div class="groups">${groups}</div>
        <button class="btn primary big" data-act="back">${isToday ? '홈으로' : '돌아가기'}</button>
      </main>`;
  },
  acts: { back: () => goHome() },
};

// ---------- 설정 ----------

const settings = {
  html() {
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
    baseReset() {
      getData().profile.baseline = null;
      save();
      render();
    },
  },
};

const VIEWS = { onboarding, home, meal, newMenu, exercise, body, result, settings, celebrate: celebrateView };

// ---------- 시작 ----------

if (getData().profile) {
  go({ name: 'home' });
} else {
  go({ name: 'onboarding', step: 1, userName: '', birthYear: thisYear - 10, birthMonth: null });
}
