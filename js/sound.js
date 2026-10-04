// 저장할 때 나는 짧은 효과음. 소리 파일 없이 브라우저에서 바로 만든다.

let ctx = null;

function note(freq, start, length, gain = 0.18) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(gain, start + 0.02);
  g.gain.exponentialRampToValueAtTime(0.001, start + length);
  osc.connect(g).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + length + 0.05);
}

// big이면 뱃지를 받았을 때처럼 조금 더 길게 울린다
export function playCheer(big = false) {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!ctx) ctx = new AC();
    if (ctx.state === 'suspended') ctx.resume();
    const t = ctx.currentTime + 0.02;
    const notes = big ? [523, 659, 784, 1047, 1319] : [659, 784, 1047];
    notes.forEach((f, i) => note(f, t + i * 0.09, 0.35));
  } catch (e) {
    // 소리가 안 나도 기록에는 영향이 없다
  }
}
