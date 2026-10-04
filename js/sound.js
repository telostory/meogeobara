// 효과음. 소리 파일 없이 브라우저에서 바로 만든다.
// 아이폰·아이패드의 무음 모드에서도 들리도록, 음악 재생과 같은 방식(<audio>)으로 튼다.
//
// 소리 종류
// - tap: 무언가를 고를 때 '톡'
// - add: 메뉴를 담을 때 올라가는 '뽁'
// - remove: 메뉴를 뺄 때 내려가는 '뽀옥'
// - save: 기록을 저장할 때 '띠리링'
// - big: 하루 마감이나 새 뱃지 때 길게 '띠리리링'

const RATE = 22050;
const cache = {};

const SOUNDS = {
  tap: { notes: [880], step: 0, length: 0.07, decay: 40, volume: 0.16, wave: 'sine' },
  add: { notes: [660, 990], step: 0.05, length: 0.12, decay: 22, volume: 0.2, wave: 'sine' },
  remove: { notes: [620, 420], step: 0.05, length: 0.12, decay: 22, volume: 0.16, wave: 'sine' },
  save: { notes: [659, 784, 1047], step: 0.09, length: 0.35, decay: 9, volume: 0.25, wave: 'triangle' },
  big: { notes: [523, 659, 784, 1047, 1319], step: 0.09, length: 0.35, decay: 9, volume: 0.25, wave: 'triangle' },
};

// 음을 이어 붙여 WAV 파일 하나로 만든다
function makeWav({ notes, step, length, decay, volume, wave }) {
  const total = Math.ceil((step * (notes.length - 1) + length + 0.03) * RATE);
  const samples = new Float32Array(total);
  notes.forEach((freq, n) => {
    const start = Math.floor(n * step * RATE);
    const len = Math.floor(length * RATE);
    for (let i = 0; i < len && start + i < total; i += 1) {
      const t = i / RATE;
      const env = Math.min(1, t / 0.008) * Math.exp(-t * decay);
      const phase = (t * freq) % 1;
      const v = wave === 'sine' ? Math.sin(2 * Math.PI * phase) : 4 * Math.abs(phase - 0.5) - 1;
      samples[start + i] += volume * env * v;
    }
  });
  const buf = new ArrayBuffer(44 + total * 2);
  const dv = new DataView(buf);
  const str = (o, s) => [...s].forEach((c, i) => dv.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF'); dv.setUint32(4, 36 + total * 2, true); str(8, 'WAVE');
  str(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, RATE, true); dv.setUint32(28, RATE * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
  str(36, 'data'); dv.setUint32(40, total * 2, true);
  for (let i = 0; i < total; i += 1) dv.setInt16(44 + i * 2, Math.max(-1, Math.min(1, samples[i])) * 32767, true);
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}

export function playSound(name) {
  try {
    const spec = SOUNDS[name];
    if (!spec) return;
    // 사파리 16.4 이상: 무음 스위치와 상관없이 소리를 내는 '재생' 모드로 둔다
    if (navigator.audioSession) navigator.audioSession.type = 'playback';
    if (!cache[name]) cache[name] = makeWav(spec);
    const audio = new Audio(cache[name]);
    audio.play().catch(() => {});
  } catch (e) {
    // 소리가 안 나도 기록에는 영향이 없다
  }
}

// 예전 이름: 저장할 때(save)와 크게 축하할 때(big)
export function playCheer(big = false) {
  playSound(big ? 'big' : 'save');
}
