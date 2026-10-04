// 앱 버전. 바뀐 내용을 올릴 때마다 숫자를 올린다. 설정 화면 맨 아래에 보인다.
export const APP_VERSION = '2026.10.04-9';

// '최신 버전 가져오기'에서 새로 받아 올 파일들. 파일을 더하면 여기에도 적는다.
export const APP_FILES = [
  './',
  'index.html',
  'manifest.json',
  'sw.js',
  'css/style.css',
  'js/app.js',
  'js/badges.js',
  'js/bmi.js',
  'js/calc.js',
  'js/charts.js',
  'js/claude.js',
  'js/config.js',
  'js/menus.js',
  'js/phrases.js',
  'js/progress.js',
  'js/sound.js',
  'js/storage.js',
  'js/streak.js',
  'js/util.js',
  'js/version.js',
  'data/bmi_male.csv',
  'data/bmi_female.csv',
  'icons/face-128.png',
];

// 브라우저에 저장된 옛 파일을 버리고 서버에서 새로 받아 온 뒤 다시 연다
export async function refreshApp() {
  let latest = null;
  try {
    const text = await (await fetch('js/version.js', { cache: 'reload' })).text();
    latest = (text.match(/APP_VERSION = '([^']+)'/) || [])[1] || null;
  } catch (e) {
    return { ok: false };
  }
  await Promise.all(APP_FILES.map((f) => fetch(f, { cache: 'reload' }).catch(() => null)));
  try {
    if (window.caches) for (const k of await caches.keys()) await caches.delete(k);
    const regs = navigator.serviceWorker ? await navigator.serviceWorker.getRegistrations() : [];
    await Promise.all(regs.map((r) => r.update().catch(() => null)));
  } catch (e) {
    // 지울 것이 없으면 그냥 넘어간다
  }
  try {
    sessionStorage.setItem('meogeobara.updated', JSON.stringify({ from: APP_VERSION, to: latest }));
  } catch (e) {
    // 알림만 못 띄울 뿐 갱신에는 영향이 없다
  }
  location.reload();
  return { ok: true };
}
