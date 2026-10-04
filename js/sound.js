// 저장할 때 나는 짧은 효과음. 소리 파일 없이 브라우저에서 바로 만든다.
// 아이폰·아이패드의 무음 모드에서도 들리도록, 음악 재생과 같은 방식(<audio>)으로 튼다.

const RATE = 22050;
const cache = {};

// 음을 이어 붙여 WAV 파일 하나로 만든다
function makeWav(notes) {
  const step = 0.09;
  const length = 0.35;
  const total = Math.ceil((step * (notes.length - 1) + length + 0.05) * RATE);
  const samples = new Float32Array(total);
  notes.forEach((freq, n) => {
    const start = Math.floor(n * step * RATE);
    const len = Math.floor(length * RATE);
    for (let i = 0; i < len && start + i < total; i += 1) {
      const t = i / RATE;
      const attack = Math.min(1, t / 0.02);
      const env = attack * Math.exp(-t * 9);
      // 삼각파
      const phase = (t * freq) % 1;
      const tri = 4 * Math.abs(phase - 0.5) - 1;
      samples[start + i] += 0.25 * env * tri;
    }
  });
  const buf = new ArrayBuffer(44 + total * 2);
  const v = new DataView(buf);
  const str = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF'); v.setUint32(4, 36 + total * 2, true); str(8, 'WAVE');
  str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, RATE, true); v.setUint32(28, RATE * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, total * 2, true);
  for (let i = 0; i < total; i += 1) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, samples[i])) * 32767, true);
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}

// big이면 하루 마감이나 뱃지처럼 조금 더 길게 울린다
export function playCheer(big = false) {
  try {
    // 사파리 16.4 이상: 무음 스위치와 상관없이 소리를 내는 '재생' 모드로 둔다
    if (navigator.audioSession) navigator.audioSession.type = 'playback';
    const key = big ? 'big' : 'small';
    if (!cache[key]) cache[key] = makeWav(big ? [523, 659, 784, 1047, 1319] : [659, 784, 1047]);
    const audio = new Audio(cache[key]);
    audio.play().catch(() => {});
  } catch (e) {
    // 소리가 안 나도 기록에는 영향이 없다
  }
}
