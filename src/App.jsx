import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from 'react';
import Matter from 'matter-js';

/* ===================== CONFIG ===================== */
const CONFIG = {
  originalPhoto:
    'https://i.ibb.co/Q7NYjYJq/Chat-GPT-Image-2026-6-28-01-53-52.png',
  handPhoto: 'https://i.ibb.co/M5B0H7D0/Chat-GPT-Image-2026-6-28-02-15-11.png',
  bgmUrl:
    'https://mp3tourl.com/audio/1783602160591-89ba6eb5-283c-4edf-80af-58919a566f76.mp3', // 평소 BGM
  bgmEndUrl:
    'https://mp3tourl.com/audio/1783603797656-2cbd2476-bf68-4321-8d5b-09faf4fdbe5e.mp3', // 조각 완성(엔딩)
  dollImgs: [
    { url: 'https://i.ibb.co/F40pd5Vd/MOF.webp', w: 150 },
    {
      url: 'https://i.ibb.co/LzwQPYy2/Chat-GPT-Image-2026-6-28-03-42-18-Photoroom.png',
      w: 1000,
    },
    {
      url: 'https://i.ibb.co/jPfXfdT5/b67b3c0d0273003a00ebc5f80fcc2bf2-Photoroom.png',
      w: 900,
    },
    {
      url: 'https://i.ibb.co/39cYR0rv/sleepy-kirby-v0-2ss0utjlzkn21-Photoroom.png',
      w: 350,
    },
    {
      url: 'https://i.ibb.co/YFvBKDzS/Chat-GPT-Image-2026-6-28-03-46-30-Photoroom.png',
      w: 1000,
    },
  ],
  dollRadius: 26,
  dollCount: 65,
  wallHeight: 225,
  VIEW_W: 460,
  MACHINE_W: 980,
  H: 530,
  chuteW: 90,
  dropOnWayChance: 0.3,
  fragmentChance: 0.5,
  charmBonus: 0.05,
  miniEvery: 5,
  miniDuration: 10,
  miniGoal: 15,
  dollDensity: 0.004,
  catchRange: 26,
  cols: 5,
  rows: 4,
  pieceSeed: 73219,

  intro: [
    '어라… 여기가 어디지?',
    '이상해. 기억이… 하나도 떠오르질 않아.',
    '분명 소중한 추억이었는데, 안개처럼 흩어져버렸어.',
    '저기 인형뽑기 기계 보여? 잃어버린 기억 조각이 그 안에 숨어있대.',
    '하나씩 뽑아서… 조각을 되찾아줄래?',
  ],
  monologues: {
    early: [
      '음… 아직 조각이 얼마 없어서 무슨 사진인지 모르겠다.',
      '이게 뭘까? 형체가 하나도 안 잡히네.',
      '겨우 한 조각인데도… 왠지 가슴이 두근거려.',
    ],
    mid: [
      '어렴풋이 뭔가 보이는 것 같기도 하고…',
      '이 색깔… 어디서 본 것 같은데.',
      '조금씩 모양이 잡혀간다. 뭐지 이거?',
    ],
    late: [
      '이제 알 것 같아… 설마 그날인가?',
      '거의 다 왔어. 분명히 기억나는 순간이야.',
      '한 조각만 더 모으면 전부 보일 텐데.',
    ],
  },
  fragments: [
    '어색하다.',
    '뻘쭘해..',
    '생각보다 재밌다.',
    '몰랐던 이야기들.',
    '더 긍금해지네!',
    '나는?.',
    '슬프다..',
    '멋지다!.',
    '어떻게 하지?.',
    '간절해졌어.',
    '차라리 잘됐나?',
    '기특하다.',
    '존경스러워!.',
    '아파.',
    '행복했으면.',
    '소홀했나봐.',
    '정말 잘 해왔구나.',
    '특별해!.',
    '내가 할수 있을까.',
    '같이 행복해지자.',
  ],
  finalMessage:
    '스무 조각의 기억이 전부 모였어.\n부서져서 흩어진 줄 알았던 순간들이 사실은\n이렇게 하나의 그림이었더라.\n다음 조각도 행복한 기억으로 채워줄게!.',
};

const STORAGE_KEY = 'memory-claw-cam-v6';
const TOTAL_PIECES = CONFIG.cols * CONFIG.rows; // 매직넘버 20 제거

/* ===================== 사운드 (파일 없이 Web Audio 신스) ===================== */
let MUTED = false;
let _audio = null;
function audioCtx() {
  if (_audio) return _audio;
  try {
    _audio = new (window.AudioContext || window.webkitAudioContext)();
  } catch (e) {
    _audio = null;
  }
  return _audio;
}
function ensureAudio() {
  const c = audioCtx();
  if (c && c.state === 'suspended') c.resume().catch(() => {});
}
function tone(freq, dur = 0.08, type = 'sine', vol = 0.12, delay = 0, slideTo = 0) {
  if (MUTED) return;
  const c = audioCtx();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g);
  g.connect(c.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}
const buzz = (pattern) => {
  try {
    if (navigator.vibrate) navigator.vibrate(pattern);
  } catch (e) {}
};
const SFX = {
  click: () => tone(760, 0.05, 'square', 0.06),
  clamp: () => {
    tone(190, 0.07, 'square', 0.13);
    tone(120, 0.1, 'square', 0.11, 0.06);
    buzz(30);
  },
  press: () => tone(90, 0.12, 'sine', 0.1),
  miss: () => {
    tone(340, 0.28, 'sine', 0.11, 0, 150);
    buzz([40, 40, 40]);
  },
  wobble: () => {
    tone(720, 0.08, 'square', 0.08);
    tone(600, 0.08, 'square', 0.08, 0.12);
    tone(720, 0.08, 'square', 0.08, 0.24);
    tone(600, 0.08, 'square', 0.08, 0.36);
  },
  dropOops: () => {
    tone(440, 0.32, 'sine', 0.13, 0, 140);
    tone(90, 0.1, 'square', 0.1, 0.34);
    buzz([60, 50, 80]);
  },
  chuteOpen: () => tone(500, 0.08, 'square', 0.07),
  chime: () => {
    [659, 880, 1109, 1319].forEach((f, i) => tone(f, 0.2, 'sine', 0.1, i * 0.09));
    tone(1568, 0.35, 'sine', 0.07, 0.4);
    buzz([50, 30, 50, 30, 100]);
  },
  pop: () => tone(950 + Math.random() * 350, 0.06, 'triangle', 0.08),
  coin: () => {
    tone(1250, 0.06, 'square', 0.09);
    tone(920, 0.08, 'square', 0.08, 0.07);
    tone(1480, 0.14, 'sine', 0.07, 0.16);
  },
  thud: () => {
    tone(72, 0.4, 'sine', 0.22, 0, 40);
    tone(50, 0.5, 'sine', 0.15, 0.05, 35);
  },
  fanfare: () => {
    [523, 659, 784, 1046, 1318].forEach((f, i) =>
      tone(f, 0.32, 'sine', 0.1, i * 0.12)
    );
    tone(2093, 0.55, 'sine', 0.06, 0.75);
    tone(1568, 0.55, 'sine', 0.06, 0.9);
    buzz([60, 40, 60, 40, 120]);
  },
};
let _motor = null;
function motorStart() {
  if (MUTED) return;
  const c = audioCtx();
  if (!c || _motor) return;
  const o = c.createOscillator();
  const g = c.createGain();
  const lfo = c.createOscillator();
  const lg = c.createGain();
  o.type = 'sawtooth';
  o.frequency.value = 55;
  g.gain.value = 0.03;
  lfo.frequency.value = 22;
  lg.gain.value = 7;
  lfo.connect(lg);
  lg.connect(o.frequency);
  o.connect(g);
  g.connect(c.destination);
  o.start();
  lfo.start();
  _motor = { o, g, lfo };
}
function motorStop() {
  if (!_motor) return;
  const c = audioCtx();
  try {
    _motor.g.gain.setTargetAtTime(0.0001, c.currentTime, 0.05);
    _motor.o.stop(c.currentTime + 0.25);
    _motor.lfo.stop(c.currentTime + 0.25);
  } catch (e) {}
  _motor = null;
}

/* ===================== BGM (오르골 제너레이티브 루프) ===================== */
const NOTE = {
  E3: 164.81, F3: 174.61, G3: 196.0, A3: 220.0, B3: 246.94,
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0, A4: 440.0, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.0, C6: 1046.5,
};
// [주파수, 16분음표 길이] — 0은 쉼표
const BGM_MELODY = [
  [NOTE.E5, 2], [NOTE.G5, 2], [NOTE.C6, 3], [NOTE.A5, 1], [NOTE.G5, 4], [NOTE.E5, 4],
  [NOTE.D5, 2], [NOTE.E5, 2], [NOTE.G5, 4], [NOTE.E5, 2], [NOTE.D5, 2], [NOTE.C5, 4],
  [NOTE.A4, 2], [NOTE.C5, 2], [NOTE.E5, 4], [NOTE.D5, 2], [NOTE.C5, 2], [NOTE.A4, 4],
  [NOTE.G4, 2], [NOTE.A4, 2], [NOTE.C5, 4], [NOTE.D5, 2], [NOTE.E5, 2], [NOTE.G5, 4],
];
const BGM_BASS = [NOTE.C4, NOTE.A3, NOTE.F3, NOTE.G3];
// 마지막 판: 단조, 느리고 성기게
const BGM_MELODY_DARK = [
  [NOTE.A4, 4], [NOTE.C5, 4], [NOTE.E5, 8],
  [NOTE.D5, 4], [NOTE.B4, 4], [NOTE.A4, 8],
  [NOTE.C5, 4], [NOTE.E5, 4], [NOTE.F5, 8],
  [NOTE.E5, 4], [NOTE.B4, 4], [NOTE.A4, 8],
];
const BGM_BASS_DARK = [NOTE.A3, NOTE.E3, NOTE.F3, NOTE.E3];
const BGM_VOL = 0.05; // 배경음 크기 (0.03~0.08 사이 취향껏)

let _bgm = null;
const _bgmFiles = {};

function bgmFileFor(mode) {
  if (mode === 'end' && CONFIG.bgmEndUrl) return CONFIG.bgmEndUrl;
  if (mode !== 'dark' && CONFIG.bgmUrl) return CONFIG.bgmUrl; // main, 또는 end인데 엔딩곡이 없을 때
  return null; // dark(마지막 판)는 항상 내장 어두운 오르골
}

function bgmStop(fade = 0.8) {
  if (!_bgm) return;
  if (_bgm.fileEl) {
    try {
      _bgm.fileEl.pause();
    } catch (e) {}
  }
  if (_bgm.timer) clearInterval(_bgm.timer);
  if (_bgm.master) {
    const c = audioCtx();
    try {
      _bgm.master.gain.setTargetAtTime(0.0001, c.currentTime, fade / 3);
      const m = _bgm.master;
      setTimeout(() => {
        try {
          m.disconnect();
        } catch (e) {}
      }, fade * 1000 + 300);
    } catch (e) {}
  }
  _bgm = null;
}

function bgmNote(c, dest, freq, when, vol = 1, decay = 1.5) {
  const o = c.createOscillator();
  const o2 = c.createOscillator();
  const g = c.createGain();
  const g2 = c.createGain();
  o.type = 'sine';
  o.frequency.value = freq;
  o2.type = 'sine';
  o2.frequency.value = freq * 2.003; // 오르골 특유의 배음
  g2.gain.value = 0.3;
  o2.connect(g2);
  g2.connect(g);
  o.connect(g);
  g.connect(dest);
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(vol, when + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, when + decay);
  o.start(when);
  o.stop(when + decay + 0.1);
  o2.start(when);
  o2.stop(when + decay + 0.1);
}

function bgmStart(mode = 'main') {
  if (MUTED) return;
  if (_bgm && _bgm.mode === mode) return;
  bgmStop(0.5);
  // 음원 파일이 지정된 모드는 파일 재생
  const url = bgmFileFor(mode);
  if (url) {
    let el = _bgmFiles[url];
    if (!el) {
      el = new Audio(url);
      el.loop = true;
      _bgmFiles[url] = el;
    }
    el.volume = mode === 'end' ? 0.5 : 0.38;
    el.play().catch(() => {});
    _bgm = { timer: 0, master: null, mode, fileEl: el };
    return;
  }
  // 내장 오르골 (main / end 폴백 / dark)
  const c = audioCtx();
  if (!c) return;
  const master = c.createGain();
  master.gain.value = 0.0001;
  master.connect(c.destination);
  master.gain.setTargetAtTime(BGM_VOL, c.currentTime, 1.2); // 페이드인
  const dark = mode === 'dark';
  const step = dark ? 0.34 : 0.215; // 16분음표 길이(초)
  const melody = dark ? BGM_MELODY_DARK : BGM_MELODY;
  const bass = dark ? BGM_BASS_DARK : BGM_BASS;
  const totalSteps = melody.reduce((a, n) => a + n[1], 0);
  const barSteps = totalSteps / bass.length;
  let nextLoopAt = c.currentTime + 0.15;
  const scheduleLoop = () => {
    let t = nextLoopAt;
    melody.forEach(([f, len]) => {
      if (f) bgmNote(c, master, f, t, 1, dark ? 2.4 : 1.5);
      t += len * step;
    });
    bass.forEach((f, i) => {
      bgmNote(c, master, f, nextLoopAt + i * barSteps * step, 0.45, dark ? 3 : 2.2);
    });
    nextLoopAt += totalSteps * step;
  };
  scheduleLoop();
  const timer = setInterval(() => {
    if (MUTED) return;
    if (c.currentTime > nextLoopAt - 1.6) scheduleLoop();
  }, 400);
  _bgm = { timer, master, mode };
}

/* ===================== 저장 ===================== */
function loadSave() {
  try {
    const r = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    return {
      collected: Array.isArray(r?.collected) ? r.collected : [],
      charms: Number.isFinite(r?.charms) ? r.charms : 0,
      caught: Number.isFinite(r?.caught) ? r.caught : 0,
      muted: !!r?.muted,
    };
  } catch {
    return { collected: [], charms: 0, caught: 0, muted: false };
  }
}

function defaultPhoto() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="750" viewBox="0 0 600 750"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FBE8C8"/><stop offset="0.55" stop-color="#F4D2B0"/><stop offset="1" stop-color="#C9B98A"/></linearGradient></defs><rect width="600" height="750" fill="url(#g)"/><circle cx="455" cy="150" r="70" fill="#FFF4DC" opacity="0.9"/><path d="M0 560 Q150 470 320 540 T600 510 L600 750 L0 750 Z" fill="#B3C079" opacity="0.85"/><text x="300" y="700" font-family="sans-serif" font-size="34" fill="#6B5A3C" text-anchor="middle" opacity="0.85">우리들의 기억</text></svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg.trim());
}

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function buildPieces() {
  const W = 600,
    H = 750,
    { cols, rows, pieceSeed } = CONFIG,
    rnd = mulberry32(pieceSeed),
    cellW = W / cols,
    cellH = H / rows;
  const V = [];
  for (let r = 0; r <= rows; r++) {
    V[r] = [];
    for (let c = 0; c <= cols; c++) {
      let x = c * cellW,
        y = r * cellH;
      if (c > 0 && c < cols) x += (rnd() - 0.5) * cellW * 0.42;
      if (r > 0 && r < rows) y += (rnd() - 0.5) * cellH * 0.42;
      V[r][c] = { x, y };
    }
  }
  const sub = 3,
    amp = 15;
  function jagged(A, B, straight) {
    const pts = [],
      dx = B.x - A.x,
      dy = B.y - A.y,
      len = Math.hypot(dx, dy) || 1,
      px = -dy / len,
      py = dx / len;
    for (let i = 1; i <= sub; i++) {
      const t = i / (sub + 1);
      let x = A.x + dx * t,
        y = A.y + dy * t;
      if (!straight) {
        const o = (rnd() - 0.5) * amp * 2;
        x += px * o;
        y += py * o;
      }
      pts.push({ x, y });
    }
    return pts;
  }
  const hE = {},
    vE = {};
  for (let r = 0; r <= rows; r++)
    for (let c = 0; c < cols; c++)
      hE[r + '_' + c] = jagged(V[r][c], V[r][c + 1], r === 0 || r === rows);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c <= cols; c++)
      vE[r + '_' + c] = jagged(V[r][c], V[r + 1][c], c === 0 || c === cols);
  const pieces = [];
  let id = 0;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const out = [];
      const push = (p) => out.push(p.x.toFixed(1) + ',' + p.y.toFixed(1));
      push(V[r][c]);
      hE[r + '_' + c].forEach(push);
      push(V[r][c + 1]);
      vE[r + '_' + (c + 1)].forEach(push);
      push(V[r + 1][c + 1]);
      [...hE[r + 1 + '_' + c]].reverse().forEach(push);
      push(V[r + 1][c]);
      [...vE[r + '_' + c]].reverse().forEach(push);
      pieces.push({ id, points: out.join(' ') });
      id++;
    }
  const cx0 = W / 2,
    cy0 = H / 2;
  pieces.forEach((p) => {
    const nums = p.points.split(' ').map((s) => s.split(',').map(Number));
    const mx = nums.reduce((a, n) => a + n[0], 0) / nums.length;
    const my = nums.reduce((a, n) => a + n[1], 0) / nums.length;
    p.cx = mx;
    p.cy = my;
    p.distFromCenter = Math.hypot(mx - cx0, my - cy0);
  });
  const order = [...pieces].sort((a, b) => b.distFromCenter - a.distFromCenter);
  order.forEach((p, i) => {
    p.revealOrder = i;
  });
  return { W, H, pieces };
}

/* ===================== 미니게임: 기억 반딧불이 잡기 ===================== */
function MiniGame({ onDone }) {
  const [items, setItems] = useState([]);
  const [score, setScore] = useState(0);
  const [time, setTime] = useState(CONFIG.miniDuration);
  const idRef = useRef(0);
  const doneRef = useRef(false); // onDone 중복 호출 방지

  useEffect(() => {
    const spawn = setInterval(() => {
      setItems((it) => [
        ...it,
        {
          id: idRef.current++,
          x: 10 + Math.random() * 74,
          y: -8,
          vy: 0.5 + Math.random() * 0.8,
          sway: 12 + Math.random() * 20, // 좌우 살랑임 폭(px)
          phase: Math.random() * Math.PI * 2,
          size: 34 + Math.random() * 16,
        },
      ]);
    }, 400);
    const fall = setInterval(() => {
      setItems((it) =>
        it.map((o) => ({ ...o, y: o.y + o.vy * 2.1 })).filter((o) => o.y < 110)
      );
    }, 16);
    const timer = setInterval(() => {
      setTime((t) => Math.max(0, t - 1)); // clearInterval을 업데이터 안에서 호출하지 않음
    }, 1000);
    return () => {
      clearInterval(spawn);
      clearInterval(fall);
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (time <= 0 && !doneRef.current) {
      doneRef.current = true;
      const cleared = score >= CONFIG.miniGoal;
      setTimeout(() => onDone(cleared), 800);
    }
  }, [time, score, onDone]);

  const pop = (id) => {
    if (time <= 0) return; // 종료 후 클릭 무효
    SFX.pop();
    buzz(12);
    setItems((it) => it.filter((o) => o.id !== id));
    setScore((s) => s + 1);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 95,
        background:
          'radial-gradient(120% 100% at 50% 15%, #6E5F8C 0%, #4C4468 55%, #2E2A44 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: 16,
        touchAction: 'manipulation',
      }}
    >
      <h2 style={{ color: '#FFEFC9', margin: '6px 0 2px', fontSize: 24 }}>
        ✨ 기억 반딧불이 잡기!
      </h2>
      <p style={{ color: '#D8CCF0', margin: '0 0 6px', fontWeight: 700 }}>
        흩어진 기억의 불빛, {CONFIG.miniGoal}개 모으면 부적 획득!
      </p>
      <div
        style={{
          display: 'flex',
          gap: 18,
          marginBottom: 8,
          fontWeight: 700,
          color: '#FFF6DE',
        }}
      >
        <span>
          🌟 {score}/{CONFIG.miniGoal}
        </span>
        <span>⏱ {time}s</span>
      </div>
      <div
        style={{
          position: 'relative',
          width: 'min(420px, 92vw)',
          flex: 1,
          maxHeight: 560,
          background:
            'radial-gradient(circle at 50% 110%, rgba(255,230,160,0.12), rgba(255,255,255,0.03) 60%)',
          borderRadius: 20,
          border: '3px solid #8A7BB0',
          overflow: 'hidden',
        }}
      >
        {items.map((o) => {
          const swayX = Math.sin(o.y * 0.09 + o.phase) * o.sway;
          return (
            <button
              key={o.id}
              onMouseDown={() => pop(o.id)}
              onTouchStart={(e) => {
                e.preventDefault();
                pop(o.id);
              }}
              style={{
                position: 'absolute',
                left: `calc(${o.x}% + ${swayX.toFixed(1)}px)`,
                top: `${o.y}%`,
                transform: 'translate(-50%,-50%)',
                width: o.size,
                height: o.size,
                border: 'none',
                cursor: 'pointer',
                borderRadius: '50%',
                background:
                  'radial-gradient(circle, #FFF9E0 0%, #FFE083 38%, rgba(255,214,110,0) 72%)',
                boxShadow: '0 0 16px 5px rgba(255,222,130,0.5)',
                color: '#B98A2E',
                fontSize: o.size * 0.4,
                lineHeight: 1,
                padding: 0,
              }}
            >
              ✦
            </button>
          );
        })}
      </div>
      <p style={{ color: '#C9BEE6', fontSize: 13, marginTop: 8 }}>
        떠다니는 반딧불이를 톡톡 터치해서 모아줘!
      </p>
    </div>
  );
}

/* ===================== 마지막 조각: 검은 기억 시퀀스 ===================== */
function FinalSequence({ geo, photo, collected, message, onAward, onClose }) {
  const [stage, setStage] = useState('fog'); // fog → q → reveal → msg
  const [qIdx, setQIdx] = useState(0);
  const [retry, setRetry] = useState(0); // 오답 횟수 (연속 오답도 매번 흔들리게 카운터로)
  const [typed, setTyped] = useState('');
  const canvasRef = useRef(null);
  const clearedRef = useRef(false);
  const strokeCount = useRef(0);
  const [ashes, setAshes] = useState([]);
  const ashId = useRef(0);

  // 마운트 시점의 남은 조각을 고정 (award 후 props가 바뀌어도 유지)
  const lastId = useMemo(() => {
    const rem = geo.pieces.filter((p) => !collected.includes(p.id));
    rem.sort((a, b) => a.revealOrder - b.revealOrder);
    return rem[0]?.id ?? null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 어두운 BGM으로 진입, 사진이 드러나는 순간 따뜻한 오르골로 복귀
  useEffect(() => {
    bgmStart('dark');
  }, []);
  useEffect(() => {
    if (stage === 'reveal') {
      bgmStart('end'); // 엔딩곡으로 전환 (파일 지정 시 그 곡, 아니면 오르골)
      setTimeout(() => SFX.fanfare(), 1200); // 마지막 조각이 맞춰지는 순간
    }
  }, [stage]);

  const QUESTIONS = useMemo(
    () =>
      [
        {
          q: '너는 어떤 사람이야?',
          good: '나는 예쁜 사람이야',
          bad: '나는 못난 사람이야',
        },
        { q: '너는 소중해?', good: '응', bad: '아니' },
        {
          q: '행복해지고 싶어?',
          good: '응, 행복해지고 싶어',
          bad: '아니… 어차피 안 될 텐데',
        },
      ].map((o) => ({ ...o, swap: Math.random() < 0.5 })),
    []
  );

  // 검은 안개 채우기
  useEffect(() => {
    if (stage !== 'fog') return;
    const cv = canvasRef.current;
    if (!cv) return;
    const rect = cv.getBoundingClientRect();
    cv.width = rect.width * 2;
    cv.height = rect.height * 2;
    const c2 = cv.getContext('2d');
    c2.scale(2, 2);
    const g = c2.createRadialGradient(
      rect.width / 2,
      rect.height / 2,
      20,
      rect.width / 2,
      rect.height / 2,
      rect.width * 0.72
    );
    g.addColorStop(0, '#241C13');
    g.addColorStop(1, '#0F0B07');
    c2.fillStyle = g;
    c2.fillRect(0, 0, rect.width, rect.height);
    for (let i = 0; i < 26; i++) {
      c2.fillStyle = `rgba(${(20 + Math.random() * 25) | 0},${
        (16 + Math.random() * 18) | 0
      },${(12 + Math.random() * 12) | 0},0.5)`;
      c2.beginPath();
      c2.arc(
        Math.random() * rect.width,
        Math.random() * rect.height,
        14 + Math.random() * 30,
        0,
        Math.PI * 2
      );
      c2.fill();
    }
  }, [stage]);

  const checkCleared = () => {
    const cv = canvasRef.current;
    if (!cv || clearedRef.current) return;
    const c2 = cv.getContext('2d');
    const data = c2.getImageData(0, 0, cv.width, cv.height).data;
    let cleared = 0,
      total = 0;
    for (let i = 3; i < data.length; i += 4 * 97) {
      total++;
      if (data[i] < 40) cleared++;
    }
    if (cleared / total > 0.55) {
      clearedRef.current = true;
      SFX.chime();
      buzz([40, 30, 60]);
      cv.style.transition = 'opacity 1.2s ease';
      cv.style.opacity = '0';
      setTimeout(() => setStage('q'), 1400);
    }
  };

  const scrub = (clientX, clientY) => {
    if (stage !== 'fog' || clearedRef.current) return;
    const cv = canvasRef.current;
    if (!cv) return;
    const rect = cv.getBoundingClientRect();
    const x = clientX - rect.left,
      y = clientY - rect.top;
    const c2 = cv.getContext('2d');
    c2.save();
    c2.globalCompositeOperation = 'destination-out';
    const brush = c2.createRadialGradient(x, y, 4, x, y, 34);
    brush.addColorStop(0, 'rgba(0,0,0,1)');
    brush.addColorStop(1, 'rgba(0,0,0,0)');
    c2.fillStyle = brush;
    c2.beginPath();
    c2.arc(x, y, 34, 0, Math.PI * 2);
    c2.fill();
    c2.restore();
    strokeCount.current++;
    if (strokeCount.current % 3 === 0) {
      buzz(6);
      setAshes((a) => [
        ...a.slice(-14),
        { id: ashId.current++, x, y, dx: (Math.random() - 0.5) * 70 },
      ]);
    }
    if (strokeCount.current % 14 === 0) checkCleared();
  };

  const answer = (isGood) => {
    if (isGood) {
      tone(880, 0.15, 'sine', 0.09);
      tone(1175, 0.2, 'sine', 0.08, 0.1);
      buzz(25);
      if (qIdx >= QUESTIONS.length - 1) {
        onAward(); // 마지막 조각 지급
        setStage('reveal');
        setTimeout(() => setStage('msg'), 4800);
      } else {
        setRetry(0);
        setQIdx(qIdx + 1);
      }
    } else {
      tone(240, 0.22, 'sine', 0.09);
      buzz(60);
      setRetry((n) => n + 1);
    }
  };

  useEffect(() => {
    if (stage !== 'msg') return;
    let i = 0;
    const iv = setInterval(() => {
      i++;
      setTyped(message.slice(0, i));
      if (i >= message.length) clearInterval(iv);
    }, 55);
    return () => clearInterval(iv);
  }, [stage, message]);

  const doneTyping = typed.length >= message.length;
  const today = new Date();
  const dateStr = `${today.getFullYear()}. ${today.getMonth() + 1}. ${today.getDate()}`;
  const cur = QUESTIONS[qIdx];
  const opts = cur
    ? cur.swap
      ? [
          { t: cur.bad, g: false },
          { t: cur.good, g: true },
        ]
      : [
          { t: cur.good, g: true },
          { t: cur.bad, g: false },
        ]
    : [];

  return (
    <div
      className="fadein"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 85,
        background:
          'radial-gradient(120% 100% at 50% 30%, #2B2317 0%, #14100A 70%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        overflow: 'hidden',
      }}
    >
      {stage === 'fog' && (
        <>
          <p
            className="rise"
            style={{
              color: '#D8C4A8',
              fontFamily: "'Gaegu', cursive",
              fontWeight: 700,
              fontSize: 17,
              lineHeight: 1.6,
              margin: '0 0 14px',
              textAlign: 'center',
            }}
          >
            검은 기억이 마지막 조각을 덮고 있어…
            <br />
            문질러서 걷어내 줘
          </p>
          <div
            style={{
              position: 'relative',
              width: 'min(320px, 84vw)',
              height: 'min(320px, 84vw)',
              borderRadius: 18,
              overflow: 'hidden',
              boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
            }}
          >
            {/* 안개 밑에서 새어나오는 빛 */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background:
                  'radial-gradient(circle at 50% 50%, #FFE9B0 0%, #E8C070 38%, #6B5430 100%)',
              }}
            />
            <canvas
              ref={canvasRef}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                touchAction: 'none',
                cursor: 'pointer',
              }}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture?.(e.pointerId);
                scrub(e.clientX, e.clientY);
              }}
              onPointerMove={(e) => {
                if (e.buttons || e.pressure > 0) scrub(e.clientX, e.clientY);
              }}
            />
            {ashes.map((a) => (
              <span
                key={a.id}
                className="ash"
                style={{ left: a.x, top: a.y, '--dx': `${a.dx}px` }}
              />
            ))}
          </div>
        </>
      )}

      {stage === 'q' && cur && (
        <div
          key={qIdx}
          className="fadein"
          style={{ width: 'min(330px, 86vw)', textAlign: 'center' }}
        >
          <p
            style={{
              color: '#F3E4CC',
              fontSize: 21,
              lineHeight: 1.6,
              margin: '0 0 18px',
              textShadow: '0 0 20px rgba(255,225,160,0.25)',
            }}
          >
            {cur.q}
          </p>
          <div className={retry > 0 ? 'shakex' : undefined} key={retry}>
            {opts.map((o, i) => (
              <button key={i} className="q-btn" onClick={() => answer(o.g)}>
                {o.t}
              </button>
            ))}
          </div>
          <p
            style={{
              color: '#C9A86E',
              fontFamily: "'Gaegu', cursive",
              fontWeight: 700,
              fontSize: 15,
              minHeight: 22,
              marginTop: 14,
            }}
          >
            {retry > 0 ? '…다시 생각해봐.' : ''}
          </p>
          <p style={{ color: '#8A785C', fontSize: 12, marginTop: 4 }}>
            {qIdx + 1} / {QUESTIONS.length}
          </p>
        </div>
      )}

      {(stage === 'reveal' || stage === 'msg') && (
        <>
          <div style={{ position: 'relative', width: 'min(300px, 74vw)' }}>
            <svg
              viewBox={`0 0 ${geo.W} ${geo.H}`}
              style={{
                width: '100%',
                display: 'block',
                filter: 'drop-shadow(0 18px 44px rgba(0,0,0,0.65))',
              }}
            >
              <defs>
                {geo.pieces.map((p) => (
                  <clipPath
                    key={p.id}
                    id={`fclip-${p.id}`}
                    clipPathUnits="userSpaceOnUse"
                  >
                    <polygon points={p.points} />
                  </clipPath>
                ))}
              </defs>
              {geo.pieces.map((p) => {
                const isLast = p.id === lastId;
                return (
                  <g
                    key={p.id}
                    className={isLast ? 'piece-in' : 'fadein'}
                    style={isLast ? { animationDelay: '0.9s' } : undefined}
                  >
                    <image
                      href={photo}
                      x="0"
                      y="0"
                      width={geo.W}
                      height={geo.H}
                      preserveAspectRatio="xMidYMid slice"
                      clipPath={`url(#fclip-${p.id})`}
                    />
                  </g>
                );
              })}
            </svg>
            {/* 완전체 사진이 아련하게 떠오름 */}
            <img
              src={photo}
              alt="완성된 기억"
              className="hazyin"
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                borderRadius: 6,
                opacity: 0,
                animationDelay: '2.1s',
              }}
            />
          </div>
          {stage === 'msg' && (
            <>
              <h2
                className="rise"
                style={{
                  color: '#FFE9A8',
                  margin: '22px 0 10px',
                  fontSize: 26,
                  textShadow: '0 0 18px rgba(255,220,140,0.4)',
                }}
              >
                기억 완성
              </h2>
              <p
                style={{
                  whiteSpace: 'pre-line',
                  textAlign: 'center',
                  color: '#F3E4CC',
                  fontSize: 16,
                  lineHeight: 1.8,
                  maxWidth: 340,
                  margin: 0,
                  minHeight: 112,
                }}
              >
                {typed}
                {!doneTyping && (
                  <span
                    className="cursor"
                    style={{ background: '#F3E4CC', height: 16, marginLeft: 2 }}
                  />
                )}
              </p>
              {doneTyping && (
                <>
                  <p
                    className="rise"
                    style={{
                      color: '#B9A484',
                      fontSize: 13,
                      margin: '14px 0 0',
                      fontFamily: "'Gaegu', cursive",
                      fontWeight: 700,
                    }}
                  >
                    {dateStr} 완성
                  </p>
                  <button
                    className="soft-btn rise"
                    style={{ marginTop: 18 }}
                    onClick={onClose}
                  >
                    간직하기
                  </button>
                </>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

/* ===================== 앱 ===================== */
export default function App() {
  const geo = useMemo(buildPieces, []);
  const photo = CONFIG.originalPhoto || defaultPhoto();
  const saved = useMemo(loadSave, []);

  const sceneRef = useRef(null);
  const refs = useRef({});
  const phaseRef = useRef('idle');
  const gapRef = useRef(CONFIG.dollRadius * 2 + 22);
  const moveRef = useRef(0);
  const collectedRef = useRef([]);
  const charmsRef = useRef(0);
  const caughtCountRef = useRef(saved.caught);

  // 집게/오버레이를 리렌더 없이 직접 갱신하기 위한 DOM refs (60fps setState 제거)
  const worldRef = useRef(null); // 배출구 벽/뚜껑 등 월드 좌표 오버레이
  const clawSvgRef = useRef(null);
  const ropeRef = useRef(null);
  const boxRef = useRef(null);
  const legARef = useRef(null);
  const legBRef = useRef(null);
  const legCRef = useRef(null);
  const legDRef = useRef(null);
  const clawShadowRef = useRef(null);
  const blackAuraRef = useRef(null);

  const [view, setView] = useState('game');
  const [busy, setBusy] = useState(false); // 뽑기 중 탭 전환 방지
  const [status, setStatus] = useState('동전을 넣고 시작해줘!');
  const [coinInserted, setCoinInserted] = useState(false);
  const [coinFly, setCoinFly] = useState(false);
  const coinRef = useRef(false);
  const [collected, setCollected] = useState(saved.collected);
  const [finalSeq, setFinalSeq] = useState(false); // 마지막 조각 시퀀스
  const [memoryScene, setMemoryScene] = useState(null);
  const [chuteOpen, setChuteOpen] = useState(false);
  const [scale, setScale] = useState(1);
  const [intro, setIntro] = useState(true);
  const [introStep, setIntroStep] = useState(0);
  const [typed, setTyped] = useState(''); // 인트로 타이핑 효과
  const [charms, setCharms] = useState(saved.charms);
  const [muted, setMuted] = useState(saved.muted);
  const [mini, setMini] = useState(false);
  const [miniResult, setMiniResult] = useState(null);
  const [flash, setFlash] = useState(false); // 조각 획득 플래시
  const [celebrate, setCelebrate] = useState(false); // 조각 획득 시 간판 전구 점멸
  const [lastPiece, setLastPiece] = useState(null); // 보관함 새 조각 fly-in
  const [readPiece, setReadPiece] = useState(null); // 보관함에서 탭한 조각 (말풍선)

  const GAP_OPEN = CONFIG.dollRadius * 2 + 22;
  const GAP_CLOSE = CONFIG.dollRadius * 2 - 6;

  useEffect(() => {
    charmsRef.current = charms;
  }, [charms]);

  useEffect(() => {
    const fit = () => {
      const need = CONFIG.VIEW_W + 24;
      const avail = window.innerWidth - 24;
      setScale(avail < need ? Math.max(0.5, avail / need) : 1);
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  // 앱 시작과 동시에 두 BGM 파일을 미리 다운로드 (첫 재생/엔딩 전환이 즉시 되도록)
  useEffect(() => {
    [CONFIG.bgmUrl, CONFIG.bgmEndUrl].forEach((u) => {
      if (!u || _bgmFiles[u]) return;
      const el = new Audio(u);
      el.loop = true;
      el.preload = 'auto';
      _bgmFiles[u] = el;
    });
  }, []);

  useEffect(() => {
    MUTED = muted;
    if (muted) {
      motorStop();
      bgmStop(0.3);
      return;
    }
    if (intro) return; // 첫 터치(제스처)에서 시작
    if (finalSeq) return; // FinalSequence가 자체적으로 관리
    bgmStart(
      collected.length >= TOTAL_PIECES
        ? 'end' // 완성 후엔 엔딩곡 유지
        : collected.length === TOTAL_PIECES - 1
        ? 'dark'
        : 'main'
    );
  }, [muted, intro, collected, finalSeq]);

  // 저장: collected + charms + caught + muted 전부 (새로고침해도 유지)
  useEffect(() => {
    collectedRef.current = collected;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          collected,
          charms,
          caught: caughtCountRef.current,
          muted,
        })
      );
    } catch (e) {}
  }, [collected, charms, muted]);

  // 인트로 타이핑 효과
  useEffect(() => {
    if (!intro) return;
    setTyped('');
    const full = CONFIG.intro[introStep];
    let i = 0;
    const iv = setInterval(() => {
      i++;
      setTyped(full.slice(0, i));
      if (i >= full.length) clearInterval(iv);
    }, 48);
    return () => clearInterval(iv);
  }, [intro, introStep]);

  useEffect(() => {
    if (view !== 'game' || intro || mini) return;
    const { Engine, Render, Runner, World, Bodies, Body } = Matter;
    CONFIG.dollImgs.forEach((d) => {
      const im = new Image();
      im.src = d.url;
    });
    if (CONFIG.originalPhoto) {
      const im = new Image();
      im.src = CONFIG.originalPhoto;
    }

    const engine = Engine.create();
    engine.gravity.y = 1.1;
    const render = Render.create({
      element: sceneRef.current,
      engine,
      options: {
        width: CONFIG.MACHINE_W,
        height: CONFIG.H,
        wireframes: false,
        background: 'transparent',
      },
    });
    const playLeft = CONFIG.chuteW + 12;
    const wallStyle = { fillStyle: 'rgba(0,0,0,0)' };

    World.add(engine.world, [
      Bodies.rectangle(
        (playLeft + CONFIG.MACHINE_W) / 2,
        CONFIG.H - 8,
        CONFIG.MACHINE_W - playLeft,
        30,
        { isStatic: true, render: wallStyle }
      ),
      Bodies.rectangle(CONFIG.MACHINE_W - 8, CONFIG.H / 2, 16, CONFIG.H, {
        isStatic: true,
        render: wallStyle,
      }),
      Bodies.rectangle(
        playLeft,
        CONFIG.H - CONFIG.wallHeight / 2,
        10,
        CONFIG.wallHeight,
        { isStatic: true, render: wallStyle }
      ),
      Bodies.rectangle(4, CONFIG.H / 2, 8, CONFIG.H, {
        isStatic: true,
        render: wallStyle,
      }),
      Bodies.rectangle(CONFIG.chuteW / 2, CONFIG.H - 8, CONFIG.chuteW, 16, {
        isStatic: true,
        render: wallStyle,
      }),
    ]);

    const dolls = [];
    const zL = playLeft + 30,
      zR = CONFIG.MACHINE_W - 40;
    for (let i = 0; i < CONFIG.dollCount; i++) {
      const pick =
        CONFIG.dollImgs[Math.floor(Math.random() * CONFIG.dollImgs.length)];
      const sc = (CONFIG.dollRadius * 2.6) / pick.w; // PNG 투명 여백 감안한 스프라이트 크기
      const b = Bodies.circle(
        zL + Math.random() * (zR - zL),
        40 + Math.random() * 230,
        CONFIG.dollRadius,
        {
          restitution: 0.02,
          friction: 0.6,
          frictionStatic: 0.8,
          frictionAir: 0.008,
          density: CONFIG.dollDensity,
          render: { sprite: { texture: pick.url, xScale: sc, yScale: sc } },
        }
      );
      // 관성을 4배로: 굴러서 틈은 메우되 뒤집히진 않게 (봉제인형 느낌)
      Body.setInertia(b, b.inertia * 4);
      dolls.push(b);
    }
    World.add(engine.world, dolls);

    // 뽑을 때마다 위에서 새 인형을 떨어뜨려 산이 고갈되지 않게
    const spawnDoll = () => {
      const pick =
        CONFIG.dollImgs[Math.floor(Math.random() * CONFIG.dollImgs.length)];
      const sc2 = (CONFIG.dollRadius * 2.6) / pick.w;
      const nb = Bodies.circle(
        zL + Math.random() * (zR - zL),
        -30,
        CONFIG.dollRadius,
        {
          restitution: 0.02,
          friction: 0.6,
          frictionStatic: 0.8,
          frictionAir: 0.008,
          density: CONFIG.dollDensity,
          render: { sprite: { texture: pick.url, xScale: sc2, yScale: sc2 } },
        }
      );
      Body.setInertia(nb, nb.inertia * 4);
      dolls.push(nb);
      World.add(engine.world, nb);
    };

    const startX = CONFIG.MACHINE_W / 2,
      startY = 50;
    const footStyle = {
      isStatic: true,
      friction: 1,
      render: { fillStyle: 'rgba(0,0,0,0)' },
    };
    const legL = Bodies.rectangle(
      startX - GAP_OPEN / 2,
      startY + 40,
      9,
      40,
      footStyle
    );
    const legR = Bodies.rectangle(
      startX + GAP_OPEN / 2,
      startY + 40,
      9,
      40,
      footStyle
    );
    World.add(engine.world, [legL, legR]);

    Render.run(render);
    const runner = Runner.create();
    Runner.run(runner, engine);
    refs.current = {
      engine,
      render,
      runner,
      dolls,
      legL,
      legR,
      World,
      Body,
      playLeft,
      startY,
      startX,
      carriageX: startX,
      carriageY: startY,
      prevX: startX,
      swayPx: 0, // 집게 진자 흔들림(px)
      swayVel: 0,
      wobbleAmp: 0, // 떨어뜨림 예고 흔들림
      wobbleT: 0,
    };
    refs.current.spawnDoll = spawnDoll;

    // 검은 기억 인형 (마지막 판 전용) — 어두운 덩어리, 조금 크고 무겁게
    const spawnBlackDoll = () => {
      if (refs.current.blackDoll && !refs.current.blackDoll._gone) return;
      const bb = Bodies.circle(
        zL + (zR - zL) * (0.35 + Math.random() * 0.3),
        -50,
        30,
        {
          restitution: 0.02,
          friction: 0.7,
          frictionStatic: 0.9,
          frictionAir: 0.01,
          density: CONFIG.dollDensity * 1.4,
          render: {
            fillStyle: '#2E2620',
            strokeStyle: '#171310',
            lineWidth: 4,
          },
        }
      );
      Body.setInertia(bb, bb.inertia * 4);
      World.add(engine.world, bb);
      refs.current.blackDoll = bb;
    };
    refs.current.spawnBlackDoll = spawnBlackDoll;
    if (
      collectedRef.current.length === TOTAL_PIECES - 1 // 19조각 상태로 재진입 시에도 등장
    )
      spawnBlackDoll();

    const swMin = playLeft + 50,
      swMax = CONFIG.MACHINE_W - 50;

    // SVG 속성 직접 갱신 헬퍼 (setState 없이 60fps 렌더링)
    const setAttrs = (elRef, attrs) => {
      const el = elRef.current;
      if (!el) return;
      for (const k in attrs) el.setAttribute(k, attrs[k]);
    };

    const beforeUpdate = () => {
      const r = refs.current;
      if (phaseRef.current === 'idle') {
        const m = moveRef.current;
        if (m) {
          r.carriageX += m * 3.2;
          if (r.carriageX < swMin) r.carriageX = swMin;
          if (r.carriageX > swMax) r.carriageX = swMax;
        }
      }

      // ── 진자 스프링: 이동하면 반대로 기울고, 멈추면 몇 번 흔들리다 잦아듦
      const dx = r.carriageX - r.prevX;
      r.prevX = r.carriageX;
      const swayTarget = Math.max(-9, Math.min(9, -dx * 3.5));
      r.swayVel += (swayTarget - r.swayPx) * 0.02 - r.swayVel * 0.06;
      r.swayPx += r.swayVel;

      // ── 떨어뜨림 예고 흔들림 (wobbleAmp > 0 일 때만)
      r.wobbleT += 0.42;
      const wob = Math.sin(r.wobbleT) * r.wobbleAmp;

      const gap = gapRef.current;
      const bx = r.carriageX + r.swayPx;
      const by = r.carriageY;
      Body.setPosition(legL, { x: bx - gap / 2, y: by + 40 });
      Body.setPosition(legR, { x: bx + gap / 2, y: by + 40 });

      if (r.heldDoll && !r.heldDoll._gone) {
        const d = r.heldDoll;
        // 집게가 아직 인형 산에 있는 동안 잡은 자리로 빠르게 안착 (자석처럼 끌려오지 않게)
        r.heldOffX += ((r.heldTX ?? 0) - (r.heldOffX || 0)) * 0.25;
        r.heldOffY += ((r.heldTY ?? 44) - (r.heldOffY || 44)) * 0.25;
        const dangle = r.swayPx * 0.4 + wob; // 인형이 집게 아래서 대롱대롱
        Body.setPosition(d, {
          x: bx + r.heldOffX + dangle * 0.6,
          y: by + r.heldOffY + Math.abs(wob) * 0.15,
        });
        Body.setVelocity(d, { x: 0, y: 0 });
        Body.setAngularVelocity(d, 0);
        Body.setAngle(d, (r.heldAngle || 0) + dangle * 0.012);
      }

      let cam = bx - CONFIG.VIEW_W / 2;
      cam = Math.max(0, Math.min(CONFIG.MACHINE_W - CONFIG.VIEW_W, cam));
      r.cam = cam;
      const tf = `translateX(${-cam}px)`;
      if (render.canvas) render.canvas.style.transform = tf;
      if (worldRef.current) worldRef.current.style.transform = tf;
      if (clawSvgRef.current) clawSvgRef.current.style.transform = tf;

      // ── 집게 SVG 직접 갱신 (월드 좌표)
      const footTopY = by + 6,
        legLen = 36;
      setAttrs(ropeRef, { x1: bx, y1: 0, x2: bx, y2: by });
      setAttrs(boxRef, { x: bx - 17, y: by - 9 });
      setAttrs(legARef, {
        x1: bx - 11,
        y1: footTopY,
        x2: bx - gap / 2,
        y2: footTopY + legLen,
      });
      setAttrs(legBRef, {
        x1: bx - gap / 2,
        y1: footTopY + legLen,
        x2: bx - gap / 2 + 8,
        y2: footTopY + legLen + 10,
      });
      setAttrs(legCRef, {
        x1: bx + 11,
        y1: footTopY,
        x2: bx + gap / 2,
        y2: footTopY + legLen,
      });
      setAttrs(legDRef, {
        x1: bx + gap / 2,
        y1: footTopY + legLen,
        x2: bx + gap / 2 - 8,
        y2: footTopY + legLen + 10,
      });
      // 바닥 그림자 — 집게가 내려올수록 작아지고 진해짐 (조준 보조)
      const tD = Math.max(
        0,
        Math.min(1, (by - r.startY) / (CONFIG.H - 120 - r.startY))
      );
      const shR = 46 - tD * 20;
      setAttrs(clawShadowRef, {
        cx: bx,
        cy: CONFIG.H - 16,
        rx: shR,
        ry: shR * 0.2,
        'fill-opacity': (0.1 + tD * 0.16).toFixed(3),
      });
      // 검은 기억 오라 — 덩어리 주변에 맥동하는 어둠
      const bdl = r.blackDoll;
      if (bdl && !bdl._gone) {
        setAttrs(blackAuraRef, {
          cx: bdl.position.x,
          cy: bdl.position.y,
          r: 38 + Math.sin(r.wobbleT * 0.5) * 6,
        });
      } else {
        setAttrs(blackAuraRef, { cx: -300, cy: -300 });
      }
    };
    Matter.Events.on(engine, 'beforeUpdate', beforeUpdate);

    return () => {
      Matter.Events.off(engine, 'beforeUpdate', beforeUpdate);
      Render.stop(render);
      Runner.stop(runner);
      World.clear(engine.world, false);
      Engine.clear(engine);
      render.canvas.remove();
      motorStop();
    };
  }, [view, intro, mini]); // eslint-disable-line react-hooks/exhaustive-deps

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const setCarriageY = (y) => {
    refs.current.carriageY = y;
  };

  const tryAwardFragment = useCallback(() => {
    const chance =
      CONFIG.fragmentChance + charmsRef.current * CONFIG.charmBonus;
    if (Math.random() >= chance) {
      setStatus('귀여운 인형을 뽑았어! 🧸');
      return;
    }
    const prev = collectedRef.current;
    const remaining = geo.pieces.filter((p) => !prev.includes(p.id));
    if (remaining.length === 0) {
      setStatus('인형을 뽑았어! 🧸');
      return;
    }
    remaining.sort((a, b) => a.revealOrder - b.revealOrder);
    const pick = remaining[0].id;
    const next = [...prev, pick];
    setCollected(next);
    setLastPiece(pick); // 보관함에서 이 조각만 fly-in 애니메이션
    if (charmsRef.current > 0) setCharms((c) => Math.max(0, c - 1));
    setStatus('✨ 기억의 조각을 찾았어!');

    // 획득 연출: 플래시 + 차임 + 전구 축하 점멸
    SFX.chime();
    setFlash(true);
    setTimeout(() => setFlash(false), 550);
    setCelebrate(true);
    setTimeout(() => setCelebrate(false), 1800);

    const cnt = next.length;
    const pool =
      cnt <= 5
        ? CONFIG.monologues.early
        : cnt <= 12
        ? CONFIG.monologues.mid
        : CONFIG.monologues.late;
    setTimeout(() => {
      setMemoryScene({
        text: pool[Math.floor(Math.random() * pool.length)],
        count: cnt,
      });
    }, 350);
    if (next.length === TOTAL_PIECES - 1) {
      // 19조각 → 마지막 판: 분위기 급전환 + 검은 기억 등장 연출
      setTimeout(() => setStatus('……'), 1400);
      setTimeout(() => {
        setStatus('…기계가 갑자기 어두워졌어.');
        buzz([60, 80, 60]);
      }, 2400);
      setTimeout(() => {
        if (refs.current.spawnBlackDoll) refs.current.spawnBlackDoll();
        SFX.thud();
        buzz(140);
      }, 3500);
      setTimeout(
        () => setStatus('저 검은 덩어리… 안 좋은 기억이야. 꺼내줘!'),
        4300
      );
    }
  }, [geo]);

  const insertCoin = () => {
    if (coinFly || coinRef.current) return;
    ensureAudio();
    SFX.coin();
    buzz(20);
    setCoinFly(true);
    setTimeout(() => {
      setCoinInserted(true);
      coinRef.current = true;
      setStatus('딸그락! ◀ ▶로 옮기고 잡기!');
    }, 620);
  };

  // 마지막 조각 지급 (질문을 모두 통과했을 때 FinalSequence가 호출)
  const finalizeLastPiece = useCallback(() => {
    const prev = collectedRef.current;
    const remaining = geo.pieces.filter((p) => !prev.includes(p.id));
    if (remaining.length === 0) return;
    remaining.sort((a, b) => a.revealOrder - b.revealOrder);
    const pick = remaining[0].id;
    setCollected([...prev, pick]);
    setLastPiece(pick);
  }, [geo]);

  const grab = useCallback(async () => {
    if (phaseRef.current !== 'idle') return;
    if (!coinRef.current) {
      ensureAudio();
      tone(220, 0.12, 'square', 0.08);
      setStatus('먼저 동전을 넣어줘!');
      return;
    }
    const r = refs.current;
    if (!r.engine) return;
    ensureAudio();
    SFX.click();
    const { World, engine } = r;
    moveRef.current = 0;
    phaseRef.current = 'busy';
    setBusy(true);
    const finalRound =
      !!(r.blackDoll && !r.blackDoll._gone) &&
      collectedRef.current.length >= TOTAL_PIECES - 1;

    try {
      setStatus(finalRound ? '검은 기억을 향해…' : '내려가는 중…');
      const startY = r.startY;
      gapRef.current = GAP_OPEN;

      // ── 하강: 가속 (처음 느리다가 빨라짐)
      motorStart();
      let sp = 1.6;
      let y = startY;
      let touched = false;
      while (y <= CONFIG.H - 120) {
        sp = Math.min(6, sp + 0.09);
        y += sp;
        setCarriageY(y);
        await sleep(16);
        const touch = finalRound
          ? Math.abs(r.blackDoll.position.x - r.carriageX) < 42 &&
            Math.abs(r.blackDoll.position.y - (y + 46)) < 40
            ? r.blackDoll
            : null
          : r.dolls.find(
              (d) =>
                !d._gone &&
                Math.abs(d.position.x - r.carriageX) < CONFIG.catchRange &&
                Math.abs(d.position.y - (y + 46)) < 24
            );
        if (touch) {
          touched = true;
          break;
        }
      }
      // 인형에 닿으면 살짝 더 파고들어 발이 인형을 감싸게 (검은 덩어리는 크니까 밀지 않게 제외)
      if (touched && !finalRound) {
        for (let i = 0; i < 6; i++) {
          setCarriageY(r.carriageY + 2);
          await sleep(22);
        }
      }
      motorStop();
      await sleep(140);

      setStatus(finalRound ? '붙잡는 중…' : '잡는 중…');
      const closeTo = finalRound ? 62 : GAP_CLOSE; // 검은 덩어리(지름 60)는 덜 오므려야 안 튕겨나감
      for (let g = GAP_OPEN; g >= closeTo; g -= 2) {
        gapRef.current = g;
        await sleep(18);
      }
      SFX.clamp();

      // ── 잡는 순간 꾹 눌렀다 올라오기 (힘줘서 잡는 느낌)
      SFX.press();
      const pressBase = r.carriageY;
      for (let i = 1; i <= 3; i++) {
        setCarriageY(pressBase + i * 2);
        await sleep(26);
      }
      for (let i = 2; i >= 0; i--) {
        setCarriageY(pressBase + i * 2);
        await sleep(26);
      }
      await sleep(160);

      const caught = finalRound
        ? Math.abs(r.blackDoll.position.x - r.carriageX) < 48 &&
          Math.abs(r.blackDoll.position.y - (r.carriageY + 46)) < 48
          ? r.blackDoll
          : null
        : r.dolls.find(
            (d) =>
              !d._gone &&
              Math.abs(d.position.x - r.carriageX) < CONFIG.catchRange &&
              Math.abs(d.position.y - (r.carriageY + 46)) < 26
          );
      if (caught) {
        const offset = Math.abs(caught.position.x - r.carriageX);
        // 마지막 판(검은 기억)은 조준만 맞으면 100% — 여기서 놓치면 감정이 식는다
        const chance = finalRound
          ? 1
          : offset < 10
          ? 0.9
          : offset < 20
          ? 0.6
          : 0.3;
        if (Math.random() < chance) {
          r.heldDoll = caught;
          r.heldOffX = caught.position.x - r.carriageX;
          r.heldOffY = caught.position.y - r.carriageY;
          // 잡힌 위치를 거의 유지하되 집게 발 밖으로 벗어난 만큼만 살짝 안으로
          r.heldTX = Math.max(-9, Math.min(9, r.heldOffX));
          r.heldTY = finalRound ? 40 : 44;
          r.heldAngle = caught.angle;
        }
      }

      // ── 상승: 출발 직전 멈칫 + 무거운 듯 천천히 가속
      setStatus('끌어올리는 중…');
      await sleep(230);
      motorStart();
      let up = 1.3;
      let yy = r.carriageY;
      while (yy > startY) {
        up = Math.min(3.2, up + 0.055);
        yy -= up;
        if (yy < startY) yy = startY;
        setCarriageY(yy);
        await sleep(16);
      }
      motorStop();
      await sleep(260);

      if (!r.heldDoll || r.heldDoll._gone) {
        SFX.miss();
        setStatus('놓쳤다… 다시! 🥲');
        gapRef.current = GAP_OPEN;
        await sleep(500);
        return;
      }

      setStatus(finalRound ? '검은 기억을 꺼내는 중…' : '배출구로!');
      const chuteX = CONFIG.chuteW / 2;
      const willDrop = !finalRound && Math.random() < CONFIG.dropOnWayChance;
      const dropAtX =
        chuteX + 60 + Math.random() * Math.max(10, r.carriageX - chuteX - 60);

      motorStart();
      let x = r.carriageX;
      while (x > chuteX) {
        x -= 4.6;
        if (x < chuteX) x = chuteX;
        r.carriageX = x;
        await sleep(14);

        // ── 떨어뜨리기 전 "예고 흔들림" — 조마조마하게 만든 뒤 떨어뜨림
        if (willDrop && x <= dropAtX) {
          motorStop();
          setStatus('앗, 흔들린다…!');
          SFX.wobble();
          buzz([30, 40, 30, 40, 30]);
          r.wobbleAmp = 11;
          await sleep(880);
          r.wobbleAmp = 0;
          gapRef.current = GAP_OPEN;
          r.heldDoll = null;
          SFX.dropOops();
          setStatus('아앗! 가다가 놓쳤어… 🥲');
          await sleep(900);
          return;
        }
      }
      motorStop();
      await sleep(150);

      setChuteOpen(true);
      SFX.chuteOpen();
      await sleep(200);
      gapRef.current = GAP_OPEN;
      const dropped = r.heldDoll;
      const wasBlack = finalRound && dropped === r.blackDoll;
      r.heldDoll = null;
      // 인형이 배출구 바닥까지 실제로 떨어져 구르는 걸 보여줌
      if (dropped && r.Body) r.Body.setVelocity(dropped, { x: 0, y: 2.5 });
      await sleep(820);
      if (dropped) {
        dropped._gone = true;
        World.remove(engine.world, dropped);
      }
      setChuteOpen(false);

      if (wasBlack) {
        // 검은 기억을 꺼냈다 → 마지막 시퀀스
        setStatus('…이게 그 기억이구나.');
        await sleep(700);
        setFinalSeq(true);
        return;
      }

      if (r.spawnDoll) setTimeout(r.spawnDoll, 500); // 위에서 새 인형 리필
      tryAwardFragment();

      caughtCountRef.current += 1;
      const showMini =
        caughtCountRef.current % CONFIG.miniEvery === 0 &&
        collectedRef.current.length < TOTAL_PIECES - 1; // 마지막 판 직전부턴 미니게임 없음
      await sleep(400);
      if (showMini) setTimeout(() => setMini(true), 600);
    } finally {
      // 어떤 경로로 끝나도 상태 확실히 복구
      motorStop();
      refs.current.wobbleAmp = 0;
      phaseRef.current = 'idle';
      setBusy(false);
    }
  }, [tryAwardFragment]); // eslint-disable-line react-hooks/exhaustive-deps

  const onMiniDone = useCallback((cleared) => {
    setMini(false);
    if (cleared) {
      SFX.chime();
      setCharms((c) => c + 1);
      setMiniResult('win');
    } else {
      SFX.miss();
      setMiniResult('lose');
    }
    setTimeout(() => setMiniResult(null), 2200);
  }, []);

  const resetAll = () => {
    if (busy) return;
    if (!window.confirm('모은 기억 조각을 모두 초기화할까?')) return;
    setCollected([]);
    setFinalSeq(false);
    setCharms(0);
    setLastPiece(null);
    setReadPiece(null);
    caughtCountRef.current = 0;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
  };
  const press = (dir) => {
    ensureAudio();
    if (phaseRef.current === 'idle') {
      SFX.click();
      moveRef.current = dir;
    }
  };
  const release = () => {
    moveRef.current = 0;
  };
  const progress = collected.length;
  const finalMood = progress === TOTAL_PIECES - 1; // 마지막 판: 어두운 분위기

  const introFull = CONFIG.intro[introStep];
  const introDone = typed.length >= introFull.length;

  // 조각 획득 오버레이용 반짝이 위치
  const SPARKS = [
    { left: '6%', top: '68%' },
    { left: '90%', top: '60%' },
    { left: '14%', top: '18%' },
    { left: '82%', top: '12%' },
    { left: '48%', top: '4%' },
    { left: '60%', top: '80%' },
  ];

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #C6CF9B 0%, #ABBC7E 55%, #92A56A 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '10px 12px 28px',
        color: '#5E4A38',
        fontFamily: "'Jua',system-ui,sans-serif",
        overflowX: 'hidden',
        touchAction: 'manipulation',
      }}
    >
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Jua&family=Gaegu:wght@400;700&display=swap');
        .soft-btn{border:none;cursor:pointer;border-radius:22px;padding:12px 30px;font-size:20px;font-family:inherit;color:#FFF6E8;background:linear-gradient(#DBAE75,#C9955C);box-shadow:0 5px 0 #A87848, inset 0 1px 0 rgba(255,255,255,0.45);touch-action:manipulation;}
        .soft-btn:active{transform:translateY(4px);box-shadow:0 1px 0 #A87848;}
        .soft-btn:disabled{opacity:.55;cursor:default;transform:none;box-shadow:0 5px 0 #A87848;}
        .arrow-btn{border:none;cursor:pointer;width:64px;height:56px;border-radius:16px;font-size:22px;color:#FFF3E0;background:linear-gradient(#CEA26C,#B78850);box-shadow:0 4px 0 #96703F, inset 0 1px 0 rgba(255,255,255,0.4);user-select:none;touch-action:manipulation;}
        .arrow-btn:active{transform:translateY(3px);box-shadow:0 1px 0 #96703F;}
        .tab{border:none;cursor:pointer;border-radius:12px 12px 5px 5px;padding:9px 20px 8px;font-size:15px;font-family:inherit;background:#E8D6AE;color:#8A6E48;box-shadow:0 3px 0 #C3A876, inset 0 1px 0 rgba(255,255,255,0.5);touch-action:manipulation;}
        .tab.on{background:#FFF9EA;color:#A0703F;box-shadow:0 3px 0 #C3A876, inset 0 -3px 0 #D2A36B;}
        .tab:disabled{opacity:.5;cursor:default;}
        .tag{font-family:'Gaegu',cursive;font-weight:700;font-size:15px;color:#5E4A38;background:#F5EBD1;border:1.5px dashed #C0A878;border-radius:10px;padding:6px 12px;box-shadow:inset 0 1px 0 rgba(255,255,255,0.6);}
        .screw{position:absolute;width:9px;height:9px;border-radius:50%;background:radial-gradient(circle at 35% 30%, #F0E2C4, #A0824F 70%);box-shadow:inset 0 -1px 1px rgba(0,0,0,0.35);}
        .screw::after{content:'';position:absolute;left:1px;right:1px;top:50%;height:1.5px;background:rgba(90,65,40,0.55);transform:rotate(38deg);}
        /* 유리 안 떠다니는 먼지 입자 */
        .mote{position:absolute;width:5px;height:5px;border-radius:50%;background:rgba(255,240,200,0.5);filter:blur(1px);pointer-events:none;animation:drift 9s ease-in-out infinite;}
        @keyframes drift{0%{transform:translate(0,0);opacity:0}20%{opacity:.65}55%{transform:translate(14px,-28px)}80%{opacity:.4}100%{transform:translate(-8px,-54px);opacity:0}}
        /* 조각 획득 시 전구 축하 점멸 */
        .bulb.party{animation-duration:.18s !important;animation-delay:0s !important;}
        /* 500원 동전 */
        .coin{width:44px;height:44px;border-radius:50%;border:3px solid #C9A14E;cursor:pointer;font-family:'Gaegu',cursive;font-weight:700;font-size:15px;color:#8A6A1E;background:radial-gradient(circle at 35% 30%, #FFE9A8, #E8C25E 65%, #C9A14E);box-shadow:0 3px 6px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.6);animation:coinbob 1.6s ease-in-out infinite;touch-action:manipulation;padding:0;}
        @keyframes coinbob{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
        .coin.fly{animation:coinfly .62s ease-in forwards;}
        @keyframes coinfly{55%{transform:translate(26px,-12px) rotate(210deg) scale(.9);opacity:1}100%{transform:translate(38px,-2px) rotate(380deg) scale(.35);opacity:0}}
        /* 인트로: 떨어지는 잎/꽃잎 */
        .fleaf{position:absolute;top:-8%;pointer-events:none;opacity:0;animation:floatdown linear infinite;}
        @keyframes floatdown{0%{transform:translate(0,-4vh) rotate(0);opacity:0}12%{opacity:.75}55%{transform:translate(24px,55vh) rotate(130deg)}100%{transform:translate(-16px,108vh) rotate(250deg);opacity:0}}
        .rise{animation:risein .8s cubic-bezier(.2,.8,.3,1) both;}
        @keyframes risein{0%{opacity:0;transform:translateY(18px)}100%{opacity:1;transform:none}}
        /* 마지막 판: 전구가 죽어가며 불규칙하게 깜빡임 */
        .bulb.dim{animation:dimflicker 2.6s ease-in-out infinite !important;box-shadow:none;}
        @keyframes dimflicker{0%,100%{opacity:.08}42%{opacity:.08}48%{opacity:.5}53%{opacity:.1}76%{opacity:.32}82%{opacity:.08}}
        /* 마지막 판: 화면 전체가 가라앉는 어둠 */
        .darkveil{position:absolute;inset:0;pointer-events:none;background:radial-gradient(120% 100% at 50% 30%, rgba(25,18,10,0.22) 0%, rgba(14,10,6,0.6) 100%);animation:veilin 1.8s ease both;}
        @keyframes veilin{0%{opacity:0}100%{opacity:1}}
        /* 안개 문지를 때 흩날리는 재 */
        .ash{position:absolute;width:7px;height:7px;border-radius:2px;background:#241C14;pointer-events:none;animation:ashfly 1s ease-out forwards;}
        @keyframes ashfly{0%{opacity:.9;transform:translate(0,0) rotate(0)}100%{opacity:0;transform:translate(var(--dx,20px),-72px) rotate(160deg)}}
        /* 질문 선택지 */
        .q-btn{display:block;width:100%;box-sizing:border-box;border:2px solid rgba(255,240,214,0.35);background:rgba(255,250,240,0.07);color:#F5E8D2;border-radius:14px;padding:13px 16px;font-size:16px;font-family:inherit;cursor:pointer;margin-top:10px;touch-action:manipulation;transition:background .2s;}
        .q-btn:active{background:rgba(255,250,240,0.22);}
        .shakex{animation:shakex .5s ease;}
        @keyframes shakex{0%,100%{transform:translateX(0)}25%{transform:translateX(-7px)}50%{transform:translateX(6px)}75%{transform:translateX(-4px)}}
        /* 완전체 사진 아련하게 */
        .hazyin{animation:hazyin 2.8s ease forwards;}
        @keyframes hazyin{0%{opacity:0;filter:blur(16px) brightness(1.7)}55%{opacity:1;filter:blur(6px) brightness(1.3)}100%{opacity:1;filter:blur(0) brightness(1)}}
        @keyframes pop{0%{transform:scale(0.7);opacity:0}100%{transform:scale(1);opacity:1}}
        @keyframes fadein{0%{opacity:0}100%{opacity:1}}
        @keyframes leaf{0%{transform:translateY(0) rotate(0)}50%{transform:translateY(-10px) rotate(12deg)}100%{transform:translateY(0) rotate(0)}}
        .pop{animation:pop .25s ease-out both;} .fadein{animation:fadein .6s ease-out both;} .leaf{animation:leaf 3s ease-in-out infinite;}
        .fadein-d1{animation:fadein .6s ease-out .45s both;}
        .fadein-d2{animation:fadein .6s ease-out .9s both;}
        /* 조각 획득 플래시 */
        .flash{position:fixed;inset:0;background:#FFF9E8;z-index:69;pointer-events:none;animation:flashout .55s ease-out both;}
        @keyframes flashout{0%{opacity:.8}100%{opacity:0}}
        /* 손 사진 등장 */
        .hand-in{animation:handin .55s cubic-bezier(.2,.9,.3,1.2) both;}
        @keyframes handin{0%{opacity:0;transform:translateY(28px) scale(.9)}100%{opacity:1;transform:none}}
        /* 반짝이 파티클 */
        .spark{position:absolute;font-size:22px;color:#FFE9A8;pointer-events:none;text-shadow:0 0 10px #FFDD7A;animation:sparkle 1.4s ease-out both;}
        @keyframes sparkle{0%{opacity:0;transform:translateY(12px) scale(.4) rotate(0)}25%{opacity:1}100%{opacity:0;transform:translateY(-56px) scale(1.25) rotate(40deg)}}
        /* 간판 전구 */
        .bulb{width:10px;height:10px;border-radius:50%;background:#FFF1C4;box-shadow:0 0 9px 2px #FFD86B;animation:blink 1.1s ease-in-out infinite;}
        .bulb:nth-child(even){animation-delay:.55s;}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:.25;box-shadow:none}}
        /* 타이핑 커서 */
        .cursor{display:inline-block;width:2px;animation:blinkc .8s steps(1) infinite;}
        @keyframes blinkc{50%{opacity:0}}
        /* 보관함 새 조각 fly-in */
        .piece-in{transform-box:fill-box;transform-origin:center;animation:piecein .8s cubic-bezier(.2,.85,.3,1) both;}
        @keyframes piecein{0%{opacity:0;transform:translate(60px,-90px) rotate(14deg) scale(1.12)}100%{opacity:1;transform:none}}
        /* 오락실 스타일 빨간 원형 버튼 */
        .claw-btn{width:80px;height:80px;border-radius:50%;border:none;cursor:pointer;color:#FFF6EE;font-size:20px;font-family:inherit;background:radial-gradient(circle at 35% 28%, #F09090 0%, #D9534F 55%, #B23B37 100%);box-shadow:0 7px 0 #8F2E2B, inset 0 -5px 10px rgba(0,0,0,0.18);touch-action:manipulation;}
        .claw-btn:active{transform:translateY(5px);box-shadow:0 2px 0 #8F2E2B, inset 0 -5px 10px rgba(0,0,0,0.18);}
        .claw-btn:disabled{opacity:.55;cursor:default;transform:none;}
        /* 전구 깜빡임이 너무 규칙적이지 않게 */
        .bulb:nth-child(3n){animation-delay:.35s;animation-duration:1.3s;}
        .bulb:nth-child(3n+1){animation-delay:.7s;animation-duration:.95s;}`}</style>

      {flash && <div className="flash" />}
      {finalMood && !finalSeq && (
        <div className="darkveil" style={{ position: 'fixed', zIndex: 40 }} />
      )}

      {/* 사운드 토글 */}
      <button
        onClick={() => {
          const next = !muted;
          setMuted(next);
          if (!next) {
            ensureAudio();
            tone(880, 0.08, 'sine', 0.07); // 켰을 때 확인음
          }
        }}
        aria-label="소리 켜기/끄기"
        style={{
          position: 'fixed',
          top: 10,
          right: 10,
          zIndex: 60,
          width: 42,
          height: 42,
          borderRadius: '50%',
          border: 'none',
          cursor: 'pointer',
          fontSize: 18,
          background: '#F5EBD1',
          color: '#6B543E',
          boxShadow: '0 3px 0 #C0A878, inset 0 1px 0 rgba(255,255,255,0.6)',
          touchAction: 'manipulation',
        }}
      >
        {muted ? '🔇' : '🔊'}
      </button>

      {intro && (
        <div
          onClick={() => {
            ensureAudio();
            bgmStart('main'); // 첫 터치에서 오르골 시작
            if (!introDone) {
              setTyped(introFull); // 타이핑 중 클릭 → 즉시 전체 표시
            } else if (introStep < CONFIG.intro.length - 1) {
              setIntroStep(introStep + 1);
            }
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 90,
            cursor: 'pointer',
            overflow: 'hidden',
            background:
              'radial-gradient(140% 120% at 50% 45%, rgba(0,0,0,0) 58%, rgba(95,75,40,0.16) 100%), radial-gradient(60% 30% at 50% 8%, rgba(255,244,210,0.85), rgba(255,244,210,0) 70%), radial-gradient(120% 100% at 50% 25%, #FBF0D8 0%, #E8DCC0 55%, #C2C98A 100%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 28,
          }}
        >
          {/* 떨어지는 잎과 꽃잎 */}
          {['🍃', '🌸', '🍃', '❀', '🌸', '🍃', '❀'].map((e, i) => (
            <span
              key={i}
              className="fleaf"
              style={{
                left: `${6 + i * 13}%`,
                animationDelay: `${i * 1.3}s`,
                animationDuration: `${7 + (i % 3) * 2.5}s`,
                fontSize: 16 + (i % 3) * 7,
              }}
            >
              {e}
            </span>
          ))}
          <div className="leaf" style={{ fontSize: 44, marginBottom: 6 }}>
            🍃
          </div>
          <h1
            className="rise"
            style={{
              color: '#7A5A3C',
              fontSize: 32,
              margin: '0 0 4px',
              textAlign: 'center',
              textShadow: '0 2px 0 rgba(255,252,240,0.8), 0 5px 10px rgba(120,90,50,0.18)',
            }}
          >
            기억의 인형뽑기
          </h1>
          <p
            className="rise"
            style={{
              animationDelay: '0.18s',
              fontFamily: "'Gaegu', cursive",
              fontWeight: 700,
              fontSize: 16,
              color: '#9A7B52',
              margin: '0 0 24px',
              letterSpacing: 2,
            }}
          >
            ─ 잃어버린 기억을 찾아서 ─
          </p>
          <div
            style={{
              background: '#FFFCF4',
              borderRadius: 22,
              padding: '24px 24px',
              maxWidth: 360,
              width: '100%',
              boxShadow: '0 12px 30px rgba(150,110,60,0.25)',
              border: '3px solid #E0C99A',
              minHeight: 120,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <p
              style={{
                color: '#5E4A38',
                fontSize: 18,
                lineHeight: 1.75,
                textAlign: 'center',
                margin: 0,
              }}
            >
              {typed}
              {!introDone && (
                <span
                  className="cursor"
                  style={{ background: '#B07F4E', height: 18, marginLeft: 2 }}
                />
              )}
            </p>
          </div>
          {introStep < CONFIG.intro.length - 1 || !introDone ? (
            <p style={{ color: '#A8884C', fontSize: 14, marginTop: 18 }}>
              화면을 누르면 계속 ▸
            </p>
          ) : (
            <button
              className="soft-btn"
              style={{ marginTop: 24 }}
              onClick={(e) => {
                e.stopPropagation();
                ensureAudio();
                SFX.click();
                setIntro(false);
              }}
            >
              🌱 기억 찾으러 가기
            </button>
          )}
        </div>
      )}

      {mini && <MiniGame onDone={onMiniDone} />}

      {miniResult && (
        <div
          className="pop"
          style={{
            position: 'fixed',
            top: '40%',
            left: '50%',
            transform: 'translate(-50%,-50%)',
            zIndex: 96,
            background: '#FFFCF4',
            borderRadius: 20,
            padding: '20px 28px',
            textAlign: 'center',
            boxShadow: '0 16px 40px rgba(0,0,0,0.3)',
            border: '3px solid #E0C99A',
          }}
        >
          {miniResult === 'win' ? (
            <>
              <div style={{ fontSize: 40 }}>🍀</div>
              <p
                style={{ color: '#5E4A38', fontWeight: 700, margin: '6px 0 0' }}
              >
                행운의 부적 획득!
                <br />
                <span style={{ fontSize: 14, color: '#8A6A52' }}>
                  다음 조각 확률 +5%
                </span>
              </p>
            </>
          ) : (
            <>
              <div style={{ fontSize: 40 }}>😢</div>
              <p
                style={{ color: '#5E4A38', fontWeight: 700, margin: '6px 0 0' }}
              >
                아쉽다! 다음 기회에…
              </p>
            </>
          )}
        </div>
      )}

      <h1
        style={{
          color: '#FFF8EC',
          textShadow:
            '2px 0 #7A5A3C, -2px 0 #7A5A3C, 0 2px #7A5A3C, 0 -2px #7A5A3C, 1.5px 1.5px #7A5A3C, -1.5px -1.5px #7A5A3C, 1.5px -1.5px #7A5A3C, -1.5px 1.5px #7A5A3C, 0 4px 6px rgba(80,60,30,0.25)',
          margin: '0 0 4px',
          fontSize: 26,
          textAlign: 'center',
        }}
      >
        기억의 인형뽑기
      </h1>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 8,
          marginBottom: 10,
        }}
      >
        <button
          className={`tab${view === 'game' ? ' on' : ''}`}
          disabled={busy}
          onClick={() => setView('game')}
        >
          뽑기
        </button>
        <button
          className={`tab${view === 'album' ? ' on' : ''}`}
          disabled={busy}
          onClick={() => setView('album')}
        >
          보관함
        </button>
        <div className="tag" style={{ marginLeft: 6 }}>
          조각 {progress}/{TOTAL_PIECES} · 부적 {charms}
        </div>
      </div>

      {view === 'game' && (
        <div
          style={{
            transform: `scale(${scale})`,
            transformOrigin: 'top center',
            width: CONFIG.VIEW_W,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            marginBottom: scale < 1 ? (50 + CONFIG.H + 165) * (scale - 1) : 0,
          }}
        >
          {/* ── 기계 간판 + 알전구 ── */}
          <div
            style={{
              width: CONFIG.VIEW_W,
              boxSizing: 'border-box',
              height: 56,
              background:
                'linear-gradient(#EEC48C 0%, #DBAA6E 45%, #C9955C 100%)',
              border: '10px solid #D2A36B',
              borderBottom: 'none',
              borderRadius: '24px 24px 0 0',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
              boxShadow:
                'inset 0 2px 0 rgba(255,255,255,0.5), inset 0 -3px 6px rgba(120,80,40,0.25), 0 -4px 14px rgba(150,110,60,0.2)',
              position: 'relative',
            }}
          >
            <div style={{ display: 'flex', gap: 17 }}>
              {Array.from({ length: 7 }).map((_, i) => (
                <span
                  key={i}
                  className={
                    celebrate ? 'bulb party' : finalMood ? 'bulb dim' : 'bulb'
                  }
                />
              ))}
            </div>
            <div
              style={{
                fontSize: 19,
                letterSpacing: 9,
                color: '#FFF6E4',
                textShadow:
                  '0 2px 0 #A87E4C, 0 3px 4px rgba(90,60,30,0.35)',
              }}
            >
              인 형 뽑 기
            </div>
            <span className="screw" style={{ left: 4, top: 4 }} />
            <span className="screw" style={{ right: 4, top: 4 }} />
          </div>

          <div
            style={{
              width: CONFIG.VIEW_W,
              boxSizing: 'border-box',
              height: CONFIG.H,
              border: '10px solid #D2A36B',
              borderTop: '4px solid #C9955C',
              borderRadius: '0 0 24px 24px',
              overflow: 'hidden',
              background:
                'radial-gradient(circle, rgba(122,90,60,0.055) 1.6px, transparent 2.2px) 0 0 / 26px 26px, linear-gradient(#FFFDF6,#FBF3E2)',
              boxShadow:
                '0 18px 36px rgba(110,75,40,0.35), 0 6px 12px rgba(110,75,40,0.18)',
              position: 'relative',
            }}
          >
            {/* 물리엔진 캔버스 */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                overflow: 'hidden',
                zIndex: 4,
              }}
            >
              <div
                ref={sceneRef}
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  transformOrigin: 'left top',
                }}
              />
            </div>

            {/* 유리 안 떠다니는 먼지 입자 */}
            {[
              { left: '18%', top: '30%', d: '0s', t: '9s' },
              { left: '55%', top: '22%', d: '2.5s', t: '11s' },
              { left: '74%', top: '44%', d: '5s', t: '8s' },
              { left: '36%', top: '56%', d: '7s', t: '10s' },
            ].map((m, i) => (
              <span
                key={i}
                className="mote"
                style={{
                  left: m.left,
                  top: m.top,
                  animationDelay: m.d,
                  animationDuration: m.t,
                  zIndex: 5,
                }}
              />
            ))}

            {/* 월드 좌표 오버레이 (배출구) — 카메라를 따라 ref로 직접 이동 */}
            <div
              ref={worldRef}
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: CONFIG.MACHINE_W,
                height: '100%',
                zIndex: 6,
                pointerEvents: 'none',
                transform: 'translateX(0px)',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  bottom: 0,
                  width: CONFIG.chuteW + 12,
                  height: CONFIG.wallHeight,
                  background: 'rgba(180,210,220,0.22)',
                  borderRight: '6px solid #C9A86E',
                  borderTop: '5px solid #C9A86E',
                  borderTopRightRadius: 14,
                  boxShadow: 'inset 0 0 20px rgba(255,255,255,0.4)',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  bottom: CONFIG.wallHeight - 24,
                  width: CONFIG.chuteW,
                  textAlign: 'center',
                  fontSize: 12,
                  color: '#7A5A3C',
                  fontWeight: 700,
                }}
              >
                배출구
              </div>
              <div
                style={{
                  position: 'absolute',
                  left: 6,
                  bottom: CONFIG.wallHeight - 14,
                  width: CONFIG.chuteW,
                  height: 14,
                  background: '#B07F4E',
                  border: '2px solid #8A6A52',
                  borderRadius: 4,
                  transformOrigin: 'left center',
                  transform: chuteOpen ? 'rotate(-75deg)' : 'rotate(0deg)',
                  transition: 'transform .3s ease',
                }}
              />
            </div>

            {/* 집게 SVG — 월드 좌표, beforeUpdate에서 속성 직접 갱신 (리렌더 0회) */}
            <svg
              ref={clawSvgRef}
              width={CONFIG.MACHINE_W}
              height={CONFIG.H}
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                zIndex: 9,
                pointerEvents: 'none',
                transform: 'translateX(0px)',
              }}
            >
              <ellipse
                ref={clawShadowRef}
                cx={CONFIG.MACHINE_W / 2}
                cy={CONFIG.H - 16}
                rx="46"
                ry="9"
                fill="#6B4A28"
                fillOpacity="0.1"
              />
              <circle
                ref={blackAuraRef}
                cx={-300}
                cy={-300}
                r="40"
                fill="rgba(38,24,48,0.3)"
                stroke="rgba(20,12,26,0.5)"
                strokeWidth="3"
              />
              <line
                ref={ropeRef}
                x1={CONFIG.MACHINE_W / 2}
                y1={0}
                x2={CONFIG.MACHINE_W / 2}
                y2={50}
                stroke="#C9A86E"
                strokeWidth="4"
              />
              <rect
                ref={boxRef}
                x={CONFIG.MACHINE_W / 2 - 17}
                y={41}
                width="34"
                height="18"
                rx="5"
                fill="#C49A66"
              />
              <line ref={legARef} stroke="#B07F4E" strokeWidth="6" strokeLinecap="round" />
              <line ref={legBRef} stroke="#B07F4E" strokeWidth="6" strokeLinecap="round" />
              <line ref={legCRef} stroke="#B07F4E" strokeWidth="6" strokeLinecap="round" />
              <line ref={legDRef} stroke="#B07F4E" strokeWidth="6" strokeLinecap="round" />
            </svg>

            {/* 유리 프레임 + 조명 + 반사 + 나사 — 화면 고정, 최상단 */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: 11,
                pointerEvents: 'none',
                border: '3px solid rgba(150,108,66,0.55)',
                borderRadius: '0 0 12px 12px',
                boxSizing: 'border-box',
                background:
                  'radial-gradient(60% 20% at 50% 0%, rgba(255,235,185,0.5), rgba(255,235,185,0) 75%), linear-gradient(105deg, transparent 34%, rgba(255,255,255,0.16) 40%, rgba(255,255,255,0.05) 46%, transparent 52%), linear-gradient(105deg, transparent 60%, rgba(255,255,255,0.09) 64%, transparent 70%), radial-gradient(130% 110% at 50% 45%, rgba(0,0,0,0) 62%, rgba(120,82,45,0.14) 100%)',
                boxShadow: 'inset 0 0 0 1.5px rgba(255,246,225,0.55)',
              }}
            >
              <span className="screw" style={{ left: 5, top: 5 }} />
              <span className="screw" style={{ right: 5, top: 5 }} />
              <span className="screw" style={{ left: 5, bottom: 5 }} />
              <span className="screw" style={{ right: 5, bottom: 5 }} />
            </div>

            {/* 유리에 붙은 가격 스티커 */}
            <div
              style={{
                position: 'absolute',
                right: 12,
                bottom: 16,
                zIndex: 12,
                pointerEvents: 'none',
                transform: 'rotate(-7deg)',
                width: 76,
                height: 76,
                borderRadius: '50%',
                background: 'radial-gradient(circle at 38% 32%, #D0765F, #BC5744 70%)',
                border: '3px dashed rgba(255,243,223,0.65)',
                color: '#FFF3DF',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: "'Gaegu', cursive",
                fontWeight: 700,
                lineHeight: 1.15,
                boxShadow: '0 3px 8px rgba(0,0,0,0.22)',
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  textDecoration: 'line-through',
                  opacity: 0.75,
                }}
              >
                1회 500원
              </span>
              <span style={{ fontSize: 17 }}>오늘 무료!</span>
            </div>

            {/* 유리에 테이프로 붙인 손글씨 쪽지 */}
            <div
              style={{
                position: 'absolute',
                right: 12,
                top: 10,
                zIndex: 12,
                pointerEvents: 'none',
                transform: 'rotate(2.5deg)',
                background: '#FFF9DE',
                padding: '10px 12px 8px',
                fontFamily: "'Gaegu', cursive",
                fontWeight: 700,
                fontSize: 14,
                lineHeight: 1.35,
                color: '#6B543E',
                boxShadow: '0 3px 8px rgba(0,0,0,0.18)',
                borderRadius: 2,
              }}
            >
              잘 안 잡혀도
              <br />
              삐지기 없기!
              <div
                style={{
                  position: 'absolute',
                  top: -7,
                  left: '50%',
                  width: 36,
                  height: 13,
                  transform: 'translateX(-50%) rotate(-4deg)',
                  background: 'rgba(255,255,255,0.6)',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                }}
              />
            </div>
          </div>

          {/* ── 기계에 붙어 있는 조작 패널 ── */}
          <div
            style={{
              width: CONFIG.VIEW_W - 36,
              boxSizing: 'border-box',
              position: 'relative',
              marginTop: -4,
              background: 'linear-gradient(#DDB27B 0%, #CDA067 50%, #BE8F58 100%)',
              border: '6px solid #B07F4E',
              borderTop: 'none',
              borderRadius: '0 0 26px 26px',
              padding: '14px 16px 12px',
              boxShadow:
                'inset 0 2px 0 rgba(255,255,255,0.35), inset 0 -4px 8px rgba(110,70,35,0.25), 0 12px 26px rgba(110,75,40,0.32)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 10,
            }}
          >
            {/* 상태 전광판 */}
            <div
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: '#4A3826',
                border: '2px solid #3A2C1E',
                borderRadius: 8,
                padding: '7px 10px',
                boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.5)',
                textAlign: 'center',
                minHeight: 34,
              }}
            >
              <span
                key={status}
                className="pop"
                style={{
                  display: 'inline-block',
                  color: finalMood ? '#FF9E78' : '#FFD98A',
                  fontWeight: 700,
                  fontSize: 15,
                  textShadow: finalMood
                    ? '0 0 8px rgba(255,120,80,0.5)'
                    : '0 0 8px rgba(255,200,110,0.45)',
                }}
              >
                {status}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
              <button
                className="arrow-btn"
                onMouseDown={() => press(-1)}
                onMouseUp={release}
                onMouseLeave={release}
                onTouchStart={(e) => {
                  e.preventDefault();
                  press(-1);
                }}
                onTouchEnd={release}
              >
                ◀
              </button>
              <button className="claw-btn" disabled={busy} onClick={grab}>
                잡기
              </button>
              <button
                className="arrow-btn"
                onMouseDown={() => press(1)}
                onMouseUp={release}
                onMouseLeave={release}
                onTouchStart={(e) => {
                  e.preventDefault();
                  press(1);
                }}
                onTouchEnd={release}
              >
                ▶
              </button>
              {/* 동전 투입구 */}
              <div
                style={{
                  position: 'absolute',
                  right: 16,
                  bottom: 44,
                  width: 26,
                  height: 40,
                  borderRadius: 6,
                  background: 'linear-gradient(#C79B63, #A87E4C)',
                  boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.4), 0 2px 3px rgba(0,0,0,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <div
                  style={{
                    width: 4,
                    height: 22,
                    borderRadius: 2,
                    background: '#3A2C1E',
                    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.8)',
                  }}
                />
              </div>
              {/* 500원 동전 — 눌러서 투입 */}
              {!coinInserted && (
                <button
                  onClick={insertCoin}
                  className={coinFly ? 'coin fly' : 'coin'}
                  style={{ position: 'absolute', right: 56, bottom: 40, zIndex: 3 }}
                >
                  500
                </button>
              )}
            </div>
            <div
              style={{
                fontFamily: "'Gaegu', cursive",
                fontWeight: 700,
                fontSize: 14,
                color: '#FFF3DC',
                textShadow: '0 1px 0 rgba(120,80,40,0.4)',
                opacity: 0.95,
              }}
            >
              한 번에 한 조각씩 · 사장님은 잠깐 자리 비움
            </div>
          </div>
        </div>
      )}

      {view === 'album' && (
        <div
          style={{
            width: 'min(460px, 92vw)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <div style={{ position: 'relative', width: 'min(340px, 80vw)' }}>
          <svg
            viewBox={`0 0 ${geo.W} ${geo.H}`}
            style={{
              width: '100%',
              display: 'block',
              borderRadius: 18,
              background: '#F3E7CC',
              boxShadow: '0 14px 34px rgba(150,110,60,0.25)',
            }}
          >
            <defs>
              {geo.pieces.map((p) => (
                <clipPath
                  key={p.id}
                  id={`clip-${p.id}`}
                  clipPathUnits="userSpaceOnUse"
                >
                  <polygon points={p.points} />
                </clipPath>
              ))}
            </defs>
            {geo.pieces.map((p) => {
              const has = collected.includes(p.id);
              const isNew = has && p.id === lastPiece;
              return (
                <g
                  key={p.id}
                  className={isNew ? 'piece-in' : undefined}
                  onAnimationEnd={
                    isNew ? () => setLastPiece(null) : undefined
                  }
                >
                  <image
                    href={photo}
                    x="0"
                    y="0"
                    width={geo.W}
                    height={geo.H}
                    preserveAspectRatio="xMidYMid slice"
                    clipPath={`url(#clip-${p.id})`}
                    style={{
                      opacity: has ? 1 : 0,
                      transition: 'opacity .6s ease',
                    }}
                  />
                  <polygon
                    points={p.points}
                    fill="none"
                    stroke={
                      readPiece === p.id
                        ? '#E8B84B'
                        : has
                        ? '#fffefa'
                        : '#C9B88E'
                    }
                    strokeWidth={readPiece === p.id ? 3.5 : has ? 2 : 1.2}
                    strokeDasharray={has ? '0' : '5 5'}
                    style={{ opacity: has ? 0.95 : 0.45 }}
                  />
                  {/* 투명 클릭 영역 — 조각을 누르면 그 기억이 말풍선으로 */}
                  <polygon
                    points={p.points}
                    fill="rgba(0,0,0,0)"
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      SFX.click();
                      setReadPiece(readPiece === p.id ? null : p.id);
                    }}
                  />
                </g>
              );
            })}
          </svg>
          {readPiece !== null &&
            (() => {
              const p = geo.pieces.find((q) => q.id === readPiece);
              if (!p) return null;
              const has = collected.includes(p.id);
              const lx = (p.cx / geo.W) * 100;
              const ly = (p.cy / geo.H) * 100;
              return (
                <div
                  className="pop"
                  onClick={() => setReadPiece(null)}
                  style={{
                    position: 'absolute',
                    left: `${Math.min(76, Math.max(24, lx))}%`,
                    top: `${ly}%`,
                    transform: 'translate(-50%, -125%)',
                    background: '#FFFDF4',
                    border: '2px solid #E0C99A',
                    borderRadius: 12,
                    padding: '9px 14px',
                    fontFamily: "'Gaegu', cursive",
                    fontSize: 17,
                    fontWeight: 700,
                    color: has ? '#5E4A38' : '#A89478',
                    boxShadow: '0 8px 20px rgba(90,65,35,0.3)',
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
                    zIndex: 5,
                  }}
                >
                  {has
                    ? `“${CONFIG.fragments[collected.indexOf(p.id)] ?? ''}”` // 획득 순서 = 이야기 순서
                    : '아직 찾지 못한 기억…'}
                  <div
                    style={{
                      position: 'absolute',
                      left: '50%',
                      bottom: -7,
                      width: 12,
                      height: 12,
                      background: '#FFFDF4',
                      borderRight: '2px solid #E0C99A',
                      borderBottom: '2px solid #E0C99A',
                      transform: 'translateX(-50%) rotate(45deg)',
                    }}
                  />
                </div>
              );
            })()}
          </div>
          <p
            style={{
              fontSize: 15,
              color: '#6B543E',
              margin: '12px 0 6px',
              fontWeight: 700,
            }}
          >
            {progress === TOTAL_PIECES
              ? '추억이 완성됐어! 🌷'
              : `${TOTAL_PIECES - progress}조각 더 모으면 완성돼`}
          </p>
          <p
            style={{
              fontFamily: "'Gaegu', cursive",
              fontWeight: 700,
              fontSize: 16,
              color: '#7A6448',
              margin: 0,
              textAlign: 'center',
            }}
          >
            {collected.length === 0
              ? '아직 모은 조각이 없어. 인형을 뽑아보자!'
              : '사진 속 조각을 누르면 그 순간의 기억을 읽을 수 있어'}
          </p>
        </div>
      )}

      {memoryScene && (
        <div
          className="fadein"
          onClick={() => setMemoryScene(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(60,45,35,0.82)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            zIndex: 70,
            cursor: 'pointer',
          }}
        >
          <div style={{ position: 'relative' }}>
            {CONFIG.handPhoto ? (
              <img
                className="hand-in"
                src={CONFIG.handPhoto}
                alt="조각을 든 손"
                style={{
                  width: 'min(340px,82vw)',
                  borderRadius: 16,
                  boxShadow: '0 16px 40px rgba(0,0,0,0.45)',
                  display: 'block',
                }}
              />
            ) : (
              <div
                className="hand-in"
                style={{
                  width: 'min(340px,82vw)',
                  height: 250,
                  borderRadius: 16,
                  background: 'linear-gradient(#E8D2B0,#C9A86E)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#7A5A3C',
                  fontSize: 15,
                }}
              >
                손 사진 자리 (handPhoto)
              </div>
            )}
            {SPARKS.map((s, i) => (
              <span
                key={i}
                className="spark"
                style={{
                  left: s.left,
                  top: s.top,
                  animationDelay: `${0.2 + i * 0.14}s`,
                }}
              >
                ✦
              </span>
            ))}
          </div>
          {/* 독백 → 조각 문구 순서로 시차 등장 (한꺼번에 뜨지 않게) */}
          <p
            className="fadein-d1"
            style={{
              color: '#FFF4E4',
              fontSize: 18,
              lineHeight: 1.7,
              marginTop: 22,
              textAlign: 'center',
              maxWidth: 340,
              textShadow: '0 2px 6px rgba(0,0,0,0.4)',
            }}
          >
            “{memoryScene.text}”
          </p>
          {/* 새 조각이 사진에 맞춰지는 걸 바로 보여줌 */}
          <div className="fadein-d2" style={{ marginTop: 14, textAlign: 'center' }}>
            <svg
              viewBox={`0 0 ${geo.W} ${geo.H}`}
              style={{
                width: 118,
                borderRadius: 10,
                background: 'rgba(255,250,238,0.1)',
                boxShadow: '0 8px 22px rgba(0,0,0,0.4)',
              }}
            >
              <defs>
                {geo.pieces.map((p) => (
                  <clipPath
                    key={p.id}
                    id={`mclip-${p.id}`}
                    clipPathUnits="userSpaceOnUse"
                  >
                    <polygon points={p.points} />
                  </clipPath>
                ))}
              </defs>
              {geo.pieces.map((p) => {
                const has = collected.includes(p.id);
                if (!has)
                  return (
                    <polygon
                      key={p.id}
                      points={p.points}
                      fill="none"
                      stroke="rgba(255,244,220,0.22)"
                      strokeWidth="2.5"
                      strokeDasharray="7 7"
                    />
                  );
                const isNew = p.id === lastPiece;
                return (
                  <g
                    key={p.id}
                    className={isNew ? 'piece-in' : undefined}
                    style={isNew ? { animationDelay: '1.1s' } : undefined}
                  >
                    <image
                      href={photo}
                      x="0"
                      y="0"
                      width={geo.W}
                      height={geo.H}
                      preserveAspectRatio="xMidYMid slice"
                      clipPath={`url(#mclip-${p.id})`}
                    />
                  </g>
                );
              })}
            </svg>
            <p
              style={{
                color: '#D8C4A8',
                fontSize: 12,
                margin: '6px 0 0',
                fontFamily: "'Gaegu', cursive",
                fontWeight: 700,
              }}
            >
              사진에 조각이 맞춰졌어
            </p>
          </div>
          <p className="fadein-d2" style={{ color: '#D8C4A8', fontSize: 13, marginTop: 16 }}>
            화면을 누르면 계속 · 조각의 기억은 📖 보관함에서 ({memoryScene.count}/{TOTAL_PIECES})
          </p>
        </div>
      )}

      {finalSeq && (
        <FinalSequence
          geo={geo}
          photo={photo}
          collected={collected}
          message={CONFIG.finalMessage}
          onAward={finalizeLastPiece}
          onClose={() => {
            setFinalSeq(false);
            setMemoryScene(null);
          }}
        />
      )}

      <button
        onClick={resetAll}
        disabled={busy}
        style={{
          marginTop: 20,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontFamily: "'Gaegu', cursive",
          fontWeight: 700,
          fontSize: 13,
          color: '#6E7A4C',
          textDecoration: 'underline',
          opacity: 0.8,
        }}
      >
        기억 전부 지우고 처음부터
      </button>
    </div>
  );
}
