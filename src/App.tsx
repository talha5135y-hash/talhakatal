import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Flame,
  Home,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Trophy,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';

type GameState = 'MENU' | 'READY' | 'PLAYING' | 'PAUSED' | 'PENALTY' | 'GAME_OVER';

interface Pipe {
  x: number;
  gapY: number;
  gapHeight: number;
  passed: boolean;
  smashed: boolean;
  smashOffsetX: number;
  smashOffsetY: number;
  smashVx: number;
  smashVy: number;
  smashRot: number;
  smashVRot: number;
}

interface BonusItem {
  x: number;
  y: number;
  baseY: number;
  radius: number;
  collected: boolean;
  phase: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  decay: number;
  color: string;
  rotation: number;
  vRot: number;
  kind: 'feather' | 'spark' | 'debris';
}

interface FloatingBanner {
  text: string;
  color: string;
  alpha: number;
  yOffset: number;
}

const BEST_SCORE_KEY = 'kara_kartal_best_score_v1';
const BASE_SPEED = 210;
const GRAVITY = 1580;
const FLAP_VELOCITY = -495;
const MAX_FALL_SPEED = 660;
const PIPE_WIDTH = 66;
const PIPE_GAP = 162;
const PIPE_SPACING = 276;
const GROUND_HEIGHT = 86;
const EAGLE_RADIUS = 16;

const FLIP_DURATION = 0.42;
const FLIP_COOLDOWN = 1.15;
const ULTI_DURATION = 4.2;
const ULTI_SPEED_BOOST = 2.45;

function createAudioEngine() {
  let ctx: AudioContext | null = null;

  const ensureContext = (): AudioContext | null => {
    if (typeof window === 'undefined') return null;
    if (!ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        ctx = new AudioCtx();
      }
    }
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    return ctx;
  };

  const playFlap = (muted: boolean) => {
    if (muted) return;
    const ac = ensureContext();
    if (!ac) return;
    const now = ac.currentTime;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.085);
    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.095);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  };

  const playScore = (muted: boolean) => {
    if (muted) return;
    const ac = ensureContext();
    if (!ac) return;
    const now = ac.currentTime;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, now);
    osc.frequency.setValueAtTime(880, now + 0.06);
    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(now);
    osc.stop(now + 0.23);
  };

  const playFlip = (muted: boolean) => {
    if (muted) return;
    const ac = ensureContext();
    if (!ac) return;
    const now = ac.currentTime;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(340, now);
    osc.frequency.exponentialRampToValueAtTime(920, now + 0.18);
    gain.gain.setValueAtTime(0.13, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(now);
    osc.stop(now + 0.23);
  };

  const playUltiStart = (muted: boolean) => {
    if (muted) return;
    const ac = ensureContext();
    if (!ac) return;
    const now = ac.currentTime;
    [330, 440, 660, 880].forEach((freq, i) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = 'sawtooth';
      const t = now + i * 0.05;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.08, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start(t);
      osc.stop(t + 0.25);
    });
  };

  const playSmash = (muted: boolean) => {
    if (muted) return;
    const ac = ensureContext();
    if (!ac) return;
    const now = ac.currentTime;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(48, now + 0.16);
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(now);
    osc.stop(now + 0.19);
  };

  const playSpeedUp = (muted: boolean) => {
    if (muted) return;
    const ac = ensureContext();
    if (!ac) return;
    const now = ac.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = 'triangle';
      const t = now + i * 0.055;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.11, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start(t);
      osc.stop(t + 0.19);
    });
  };

  const playWhistle = (muted: boolean) => {
    if (muted) return;
    const ac = ensureContext();
    if (!ac) return;
    const now = ac.currentTime;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(2200, now);
    osc.frequency.setValueAtTime(2450, now + 0.06);
    osc.frequency.setValueAtTime(2150, now + 0.12);
    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(now);
    osc.stop(now + 0.25);
  };

  const playKick = (muted: boolean) => {
    if (muted) return;
    const ac = ensureContext();
    if (!ac) return;
    const now = ac.currentTime;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + 0.12);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  };

  const playGoal = (muted: boolean) => {
    if (muted) return;
    const ac = ensureContext();
    if (!ac) return;
    const now = ac.currentTime;
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((freq, i) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = 'triangle';
      const t = now + i * 0.07;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.13, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start(t);
      osc.stop(t + 0.29);
    });
  };

  const playCrash = (muted: boolean) => {
    if (muted) return;
    const ac = ensureContext();
    if (!ac) return;
    const now = ac.currentTime;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(190, now);
    osc.frequency.exponentialRampToValueAtTime(52, now + 0.28);
    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(now);
    osc.stop(now + 0.31);
  };

  return {
    playFlap,
    playScore,
    playFlip,
    playUltiStart,
    playSmash,
    playSpeedUp,
    playWhistle,
    playKick,
    playGoal,
    playCrash,
  };
}

interface PenaltyShootoutModalProps {
  muted: boolean;
  audio: ReturnType<typeof createAudioEngine>;
  onComplete: (deltaScore: number, scored: boolean) => void;
}

function PenaltyShootoutModal({ muted, audio, onComplete }: PenaltyShootoutModalProps) {
  const penaltyCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [phase, setPhase] = useState<'AIM' | 'SHOOTING' | 'RESULT'>('AIM');
  const [scored, setScored] = useState<boolean | null>(null);

  const simRef = useRef({
    time: 0,
    phase: 'AIM' as 'AIM' | 'SHOOTING' | 'RESULT',
    aimX: 180,
    aimY: 92,
    keeperX: 180,
    keeperTargetX: 180,
    keeperDiveRot: 0,
    ballX: 180,
    ballY: 222,
    ballTargetX: 180,
    ballTargetY: 92,
    shotProgress: 0,
    ballScale: 1,
    ballRot: 0,
    resultTime: 0,
    scored: false,
    completed: false,
  });

  const fireShot = useCallback(
    (customX?: number, customY?: number) => {
      const s = simRef.current;
      if (s.phase !== 'AIM') return;

      const goalLeft = 46;
      const goalRight = 314;
      const goalTop = 36;
      const goalBottom = 136;

      const tx = Math.max(goalLeft + 14, Math.min(goalRight - 14, customX ?? s.aimX));
      const ty = Math.max(goalTop + 14, Math.min(goalBottom - 12, customY ?? s.aimY));

      s.ballTargetX = tx;
      s.ballTargetY = ty;
      s.phase = 'SHOOTING';
      s.shotProgress = 0;

      // Keeper guesses left, center, or right (gives skillful corner shots high odds while remaining exciting)
      const zones = [78, 180, 282];
      const chosenZone = zones[Math.floor(Math.random() * zones.length)];
      // Slight bias toward center if keeper is near center, else random dive
      s.keeperTargetX = chosenZone + (Math.random() - 0.5) * 26;

      setPhase('SHOOTING');
      audio.playKick(muted);
    },
    [audio, muted]
  );

  // Spacebar shoots during penalty AIM phase
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        e.stopPropagation();
        if (simRef.current.phase === 'AIM') {
          fireShot();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [fireShot]);

  useEffect(() => {
    let rafId = 0;
    let last = performance.now();

    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const s = simRef.current;
      s.time += dt;

      const W = 360;
      const H = 250;
      const goalLeft = 40;
      const goalRight = 320;
      const goalTop = 34;
      const goalBottom = 140;

      if (s.phase === 'AIM') {
        // Sweeping crosshair across the goal
        s.aimX = 180 + Math.sin(s.time * 3.1) * 114;
        s.aimY = 88 + Math.cos(s.time * 4.4) * 32;
        // Keeper patrols lightly
        s.keeperX = 180 + Math.sin(s.time * 2.1 + 1.2) * 38;
      } else if (s.phase === 'SHOOTING') {
        s.shotProgress = Math.min(1, s.shotProgress + dt * 2.45);
        const ease = 1 - Math.pow(1 - s.shotProgress, 2);

        s.ballX = 180 + (s.ballTargetX - 180) * ease;
        // Slight arc
        const arc = Math.sin(s.shotProgress * Math.PI) * 24;
        s.ballY = 222 + (s.ballTargetY - 222) * ease - arc;
        s.ballScale = 1 - ease * 0.42;
        s.ballRot += dt * 18;

        // Keeper dives toward chosen target
        s.keeperX += (s.keeperTargetX - s.keeperX) * Math.min(1, dt * 8.5);
        const dir = Math.sign(s.keeperTargetX - 180);
        s.keeperDiveRot = dir * Math.min(0.65, ease * 0.65);

        if (s.shotProgress >= 1) {
          // Check save: keeper covers ~36px horizontal reach around keeperX & vertical reach
          const dx = Math.abs(s.ballTargetX - s.keeperX);
          const dy = Math.abs(s.ballTargetY - 96);
          const saved = dx < 36 && dy < 44;

          s.scored = !saved;
          s.phase = 'RESULT';
          s.resultTime = 0;
          setScored(!saved);
          setPhase('RESULT');

          if (!saved) {
            audio.playGoal(muted);
          } else {
            audio.playCrash(muted);
          }
        }
      } else if (s.phase === 'RESULT') {
        s.resultTime += dt;
        if (s.resultTime >= 1.25 && !s.completed) {
          s.completed = true;
          onComplete(s.scored ? 30 : -10, s.scored);
        }
      }

      // Draw penalty mini-game canvas
      const canvas = penaltyCanvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, W, H);

          // Night stadium stands backdrop behind goal
          ctx.fillStyle = '#090D18';
          ctx.fillRect(0, 0, W, goalBottom);

          // Crowd dots
          for (let i = 0; i < 42; i++) {
            const cx = (i * 29 + 11) % W;
            const cy = 12 + ((i * 17) % 88);
            ctx.fillStyle = i % 2 === 0 ? 'rgba(248,250,252,0.22)' : 'rgba(148,163,184,0.16)';
            ctx.fillRect(cx, cy, 4, 4);
          }

          // Pitch turf
          const turfGrad = ctx.createLinearGradient(0, goalBottom, 0, H);
          turfGrad.addColorStop(0, '#166534');
          turfGrad.addColorStop(1, '#14532D');
          ctx.fillStyle = turfGrad;
          ctx.fillRect(0, goalBottom, W, H - goalBottom);

          // Penalty box lines & spot
          ctx.strokeStyle = 'rgba(255,255,255,0.6)';
          ctx.lineWidth = 2;
          ctx.strokeRect(24, goalBottom, W - 48, 86);
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, goalBottom - 2, W, 3);
          ctx.beginPath();
          ctx.arc(180, 222, 4, 0, Math.PI * 2);
          ctx.fill();

          // Goal Net Mesh
          ctx.fillStyle = 'rgba(248, 250, 252, 0.08)';
          ctx.fillRect(goalLeft, goalTop, goalRight - goalLeft, goalBottom - goalTop);
          ctx.strokeStyle = 'rgba(248, 250, 252, 0.22)';
          ctx.lineWidth = 1;
          for (let nx = goalLeft; nx <= goalRight; nx += 14) {
            ctx.beginPath();
            ctx.moveTo(nx, goalTop);
            ctx.lineTo(nx, goalBottom);
            ctx.stroke();
          }
          for (let ny = goalTop; ny <= goalBottom; ny += 14) {
            ctx.beginPath();
            ctx.moveTo(goalLeft, ny);
            ctx.lineTo(goalRight, ny);
            ctx.stroke();
          }

          // Goalposts (crisp white frame)
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 6;
          ctx.beginPath();
          ctx.moveTo(goalLeft, goalBottom);
          ctx.lineTo(goalLeft, goalTop);
          ctx.lineTo(goalRight, goalTop);
          ctx.lineTo(goalRight, goalBottom);
          ctx.stroke();

          // Goalkeeper
          ctx.save();
          ctx.translate(s.keeperX, 102);
          ctx.rotate(s.keeperDiveRot);
          // Torso (Red/Gold keeper jersey so it contrasts cleanly against black/white net)
          ctx.fillStyle = '#DC2626';
          ctx.beginPath();
          ctx.roundRect(-14, -18, 28, 34, 6);
          ctx.fill();
          // Arms & Gloves
          ctx.strokeStyle = '#DC2626';
          ctx.lineWidth = 7;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(-12, -10);
          ctx.lineTo(-27, -20);
          ctx.moveTo(12, -10);
          ctx.lineTo(27, -20);
          ctx.stroke();
          ctx.fillStyle = '#F8FAFC';
          ctx.beginPath();
          ctx.arc(-28, -21, 6, 0, Math.PI * 2);
          ctx.arc(28, -21, 6, 0, Math.PI * 2);
          ctx.fill();
          // Legs
          ctx.fillStyle = '#18181B';
          ctx.fillRect(-10, 16, 8, 20);
          ctx.fillRect(2, 16, 8, 20);
          // Head
          ctx.fillStyle = '#FDE68A';
          ctx.beginPath();
          ctx.arc(0, -27, 9, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();

          // Aiming Crosshair in AIM mode
          if (s.phase === 'AIM') {
            ctx.save();
            ctx.translate(s.aimX, s.aimY);
            ctx.strokeStyle = '#F59E0B';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(0, 0, 14, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(-20, 0);
            ctx.lineTo(-8, 0);
            ctx.moveTo(8, 0);
            ctx.lineTo(20, 0);
            ctx.moveTo(0, -20);
            ctx.lineTo(0, -8);
            ctx.moveTo(0, 8);
            ctx.lineTo(0, 20);
            ctx.stroke();
            ctx.restore();
          }

          // Football
          ctx.save();
          ctx.translate(s.ballX, s.ballY);
          ctx.scale(s.ballScale, s.ballScale);
          ctx.rotate(s.ballRot);
          // Shadow
          ctx.fillStyle = 'rgba(0,0,0,0.35)';
          ctx.beginPath();
          ctx.ellipse(0, 13, 12, 4, 0, 0, Math.PI * 2);
          ctx.fill();
          // Ball body
          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.arc(0, 0, 13, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#09090B';
          ctx.lineWidth = 1.6;
          ctx.stroke();
          // Classic pentagon patches
          ctx.fillStyle = '#18181B';
          ctx.beginPath();
          ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(-8, -5, 2.5, 0, Math.PI * 2);
          ctx.arc(8, -5, 2.5, 0, Math.PI * 2);
          ctx.arc(-6, 8, 2.5, 0, Math.PI * 2);
          ctx.arc(6, 8, 2.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [audio, muted, onComplete]);

  const handleGoalPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (simRef.current.phase !== 'AIM') return;
    const canvas = penaltyCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = 360 / rect.width;
    const scaleY = 250 / rect.height;
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;
    fireShot(clickX, clickY);
  };

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-zinc-950/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-white/15 bg-zinc-950/95 p-5 sm:p-6 text-center shadow-2xl">
        <p className="text-xs font-semibold tracking-widest text-amber-400">
          BONUS ÖDÜL · PENALTI ATIŞI
        </p>
        <h2 className="font-display mt-1 text-3xl sm:text-4xl font-extrabold text-white">
          KALEYİ GÖZÜNE KESTİR
        </h2>
        <p className="mt-1 text-xs sm:text-sm text-zinc-300">
          Gol atarsan <span className="font-bold text-emerald-400">+30 puan</span>, kaçırırsan{' '}
          <span className="font-bold text-rose-400">-10 puan</span>!
        </p>

        <div className="relative mt-4 overflow-hidden rounded-lg border border-white/15 bg-zinc-900">
          <canvas
            ref={penaltyCanvasRef}
            width={360}
            height={250}
            onPointerDown={handleGoalPointerDown}
            className="block w-full aspect-[360/250] cursor-crosshair touch-none"
          />

          {phase === 'RESULT' && scored !== null && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-zinc-950/45">
              <div
                className={`font-display rounded-lg border px-6 py-2.5 text-4xl font-extrabold tracking-wide shadow-xl ${
                  scored
                    ? 'border-emerald-400 bg-emerald-950/90 text-emerald-300'
                    : 'border-rose-400 bg-rose-950/90 text-rose-300'
                }`}
              >
                {scored ? 'GOOOOL! +30' : 'KURTARILDI! -10'}
              </div>
            </div>
          )}
        </div>

        <div className="mt-4">
          <button
            type="button"
            disabled={phase !== 'AIM'}
            onClick={() => fireShot()}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-amber-400 px-5 text-base font-extrabold text-zinc-950 transition-colors hover:bg-amber-300 disabled:opacity-50 whitespace-nowrap"
          >
            <span>{phase === 'AIM' ? 'Şut Çek (Boşluk veya Kaleye Dokun)' : 'Top Havada...'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioRef = useRef(createAudioEngine());

  const [gameState, setGameState] = useState<GameState>('MENU');
  const [score, setScore] = useState(0);
  const [pipesCleared, setPipesCleared] = useState(0);
  const [flipCharges, setFlipCharges] = useState(0);
  const [flipOnCooldown, setFlipOnCooldown] = useState(false);
  const [ultiActive, setUltiActive] = useState(false);
  const flipCooldownBarRef = useRef<HTMLSpanElement | null>(null);
  const ultiProgressBarRef = useRef<HTMLSpanElement | null>(null);
  const [bestScore, setBestScore] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(BEST_SCORE_KEY);
      return saved ? Math.max(0, parseInt(saved, 10) || 0) : 0;
    } catch {
      return 0;
    }
  });
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [muted, setMuted] = useState(false);

  const gameStateRef = useRef<GameState>('MENU');
  const mutedRef = useRef(false);
  const bestScoreRef = useRef(bestScore);
  const gameOverTimestampRef = useRef(0);

  const worldRef = useRef({
    width: 480,
    height: 680,
    groundY: 680 - GROUND_HEIGHT,
    birdX: 118,
    birdY: 280,
    birdVel: 0,
    birdRot: 0,
    wingPhase: 0,
    flapBoost: 0,
    flipTimer: 0,
    flipCooldown: 0,
    flipCharges: 0,
    ultiTimer: 0,
    graceTimer: 0,
    pipesSpawnedCount: 0,
    pipes: [] as Pipe[],
    bonuses: [] as BonusItem[],
    particles: [] as Particle[],
    banner: null as FloatingBanner | null,
    score: 0,
    pipesCleared: 0,
    speedTier: 0,
    speedMultiplier: 1,
    scrollFar: 0,
    scrollMid: 0,
    scrollGround: 0,
    shakeTime: 0,
    flashAlpha: 0,
    time: 0,
  });

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  useEffect(() => {
    bestScoreRef.current = bestScore;
  }, [bestScore]);

  const computeLogicalDimensions = useCallback((cssW: number, cssH: number) => {
    const safeW = Math.max(320, cssW);
    const safeH = Math.max(460, cssH);
    const aspect = safeW / safeH;

    let logicalW: number;
    let logicalH: number;

    if (aspect < 0.56) {
      logicalW = 380;
      logicalH = Math.round(380 / aspect);
    } else {
      logicalH = 680;
      logicalW = Math.min(1140, Math.round(680 * aspect));
    }

    return {
      width: logicalW,
      height: logicalH,
      groundY: logicalH - GROUND_HEIGHT,
      birdX: Math.round(Math.min(Math.max(logicalW * 0.24, 92), 210)),
    };
  }, []);

  const spawnPipeWithOptionalBonus = useCallback((xPos: number, groundY: number) => {
    const w = worldRef.current;
    w.pipesSpawnedCount += 1;

    const margin = 72;
    const minCenter = margin + PIPE_GAP / 2;
    const maxCenter = groundY - margin - PIPE_GAP / 2;
    const gapY = minCenter + Math.random() * Math.max(40, maxCenter - minCenter);

    // Spawn a Bonus Pickup between every 3rd pipe (starting at pipe #2)
    if (w.pipesSpawnedCount % 3 === 2) {
      const bonusX = xPos + PIPE_SPACING * 0.5;
      const bonusMinY = 95;
      const bonusMaxY = groundY - 95;
      const baseY = bonusMinY + Math.random() * Math.max(40, bonusMaxY - bonusMinY);
      w.bonuses.push({
        x: bonusX,
        y: baseY,
        baseY,
        radius: 17,
        collected: false,
        phase: Math.random() * Math.PI * 2,
      });
    }

    return {
      x: xPos,
      gapY,
      gapHeight: PIPE_GAP,
      passed: false,
      smashed: false,
      smashOffsetX: 0,
      smashOffsetY: 0,
      smashVx: 0,
      smashVy: 0,
      smashRot: 0,
      smashVRot: 0,
    };
  }, []);

  const applyScoreDelta = useCallback((delta: number, customBanner?: { text: string; color: string }) => {
    const w = worldRef.current;
    w.score = Math.max(0, w.score + delta);
    setScore(w.score);

    const newTier = Math.floor(w.score / 50);
    if (newTier > w.speedTier) {
      w.speedTier = newTier;
      w.speedMultiplier = Math.pow(1.1, newTier);
      w.banner = {
        text: `HIZ +%10 ARTTI (${w.speedMultiplier.toFixed(2)}x)`,
        color: '#F59E0B',
        alpha: 1.5,
        yOffset: 0,
      };
      audioRef.current.playSpeedUp(mutedRef.current);
    } else {
      w.speedTier = newTier;
      w.speedMultiplier = Math.pow(1.1, newTier);
      if (customBanner) {
        w.banner = {
          text: customBanner.text,
          color: customBanner.color,
          alpha: 1.35,
          yOffset: 0,
        };
      }
    }
  }, []);

  const resetWorld = useCallback((nextState: GameState) => {
    const w = worldRef.current;
    w.birdY = Math.round(w.groundY * 0.45);
    w.birdVel = 0;
    w.birdRot = 0;
    w.flapBoost = 0;
    w.flipTimer = 0;
    w.flipCooldown = 0;
    w.flipCharges = 0;
    w.ultiTimer = 0;
    w.graceTimer = 0;
    w.pipesSpawnedCount = 0;
    w.pipes = [];
    w.bonuses = [];
    w.particles = [];
    w.banner = null;
    w.score = 0;
    w.pipesCleared = 0;
    w.speedTier = 0;
    w.speedMultiplier = 1;
    w.shakeTime = 0;
    w.flashAlpha = 0;

    gameStateRef.current = nextState;
    setGameState(nextState);
    setScore(0);
    setPipesCleared(0);
    setFlipCharges(0);
    setFlipOnCooldown(false);
    setUltiActive(false);
    setIsNewRecord(false);
  }, []);

  const emitParticles = useCallback(
    (
      x: number,
      y: number,
      count: number,
      kind: Particle['kind'],
      colors: string[],
      speedScale = 1
    ) => {
      const w = worldRef.current;
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const spd = (55 + Math.random() * 140) * speedScale;
        w.particles.push({
          x: x + (Math.random() - 0.5) * 14,
          y: y + (Math.random() - 0.5) * 14,
          vx: kind === 'feather' ? -55 - Math.random() * 90 : Math.cos(angle) * spd,
          vy: kind === 'feather' ? 20 + (Math.random() - 0.35) * 110 : Math.sin(angle) * spd - 40,
          size: kind === 'debris' ? 6 + Math.random() * 7 : 3.5 + Math.random() * 4,
          alpha: 1,
          decay: kind === 'debris' ? 1.15 + Math.random() * 0.6 : 1.45 + Math.random() * 0.85,
          color: colors[Math.floor(Math.random() * colors.length)],
          rotation: Math.random() * Math.PI * 2,
          vRot: (Math.random() - 0.5) * 11,
          kind,
        });
      }
    },
    []
  );

  const triggerFlap = useCallback(() => {
    const state = gameStateRef.current;
    const w = worldRef.current;

    if (state === 'READY') {
      gameStateRef.current = 'PLAYING';
      setGameState('PLAYING');
      w.birdVel = FLAP_VELOCITY;
      w.flapBoost = 1;

      const firstX = Math.max(w.width + 80, w.birdX + 320);
      const seededPipes: Pipe[] = [];
      let nextX = firstX;
      while (nextX < w.width + PIPE_SPACING * 2) {
        seededPipes.push(spawnPipeWithOptionalBonus(nextX, w.groundY));
        nextX += PIPE_SPACING;
      }
      w.pipes = seededPipes;
      emitParticles(w.birdX, w.birdY, 5, 'feather', ['#F8FAFC', '#27272A']);
      audioRef.current.playFlap(mutedRef.current);
      return;
    }

    if (state === 'PLAYING') {
      w.birdVel = FLAP_VELOCITY;
      w.flapBoost = 1;
      emitParticles(w.birdX, w.birdY, 4, 'feather', ['#F8FAFC', '#27272A']);
      audioRef.current.playFlap(mutedRef.current);
    }
  }, [emitParticles, spawnPipeWithOptionalBonus]);

  const triggerFlip = useCallback(() => {
    const w = worldRef.current;
    if (gameStateRef.current !== 'PLAYING') return;
    if (w.flipTimer > 0 || w.flipCooldown > 0) return;

    w.flipTimer = FLIP_DURATION;
    w.flipCooldown = FLIP_COOLDOWN;
    // Slight aerial stall/hop so flipping feels crisp and controllable
    w.birdVel = Math.min(w.birdVel, -245);
    w.flapBoost = 1;
    w.flipCharges = Math.min(2, w.flipCharges + 1);
    setFlipCharges(w.flipCharges);
    setFlipOnCooldown(true);
    if (flipCooldownBarRef.current) {
      flipCooldownBarRef.current.style.transform = 'scaleX(1)';
    }

    emitParticles(w.birdX, w.birdY, 10, 'spark', ['#F59E0B', '#F8FAFC', '#FDE68A'], 1.15);
    audioRef.current.playFlip(mutedRef.current);

    applyScoreDelta(20, {
      text: w.flipCharges >= 2 ? 'TAKLA +20 · ULTİ HAZIR!' : 'TAKLA +20 PUAN!',
      color: '#FDE047',
    });
  }, [applyScoreDelta, emitParticles]);

  const triggerUlti = useCallback(() => {
    const w = worldRef.current;
    if (gameStateRef.current !== 'PLAYING') return;
    if (w.flipCharges < 2 || w.ultiTimer > 0) return;

    w.flipCharges = 0;
    w.ultiTimer = ULTI_DURATION;
    w.shakeTime = 0.25;
    w.flashAlpha = 0.35;
    w.banner = {
      text: 'KARTAL ULTİSİ AKTİF!',
      color: '#F59E0B',
      alpha: 1.6,
      yOffset: 0,
    };

    setFlipCharges(0);
    setUltiActive(true);
    if (ultiProgressBarRef.current) {
      ultiProgressBarRef.current.style.transform = 'scaleX(1)';
    }
    emitParticles(w.birdX, w.birdY, 18, 'spark', ['#F59E0B', '#FFFFFF', '#FDE047'], 1.7);
    audioRef.current.playUltiStart(mutedRef.current);
  }, [emitParticles]);

  const startGame = useCallback(() => {
    resetWorld('READY');
  }, [resetWorld]);

  const goToMenu = useCallback(() => {
    resetWorld('MENU');
  }, [resetWorld]);

  const togglePause = useCallback(() => {
    const current = gameStateRef.current;
    if (current === 'PLAYING') {
      gameStateRef.current = 'PAUSED';
      setGameState('PAUSED');
    } else if (current === 'PAUSED') {
      gameStateRef.current = 'PLAYING';
      setGameState('PLAYING');
    }
  }, []);

  const die = useCallback(() => {
    const w = worldRef.current;
    if (gameStateRef.current === 'GAME_OVER') return;

    gameStateRef.current = 'GAME_OVER';
    gameOverTimestampRef.current = performance.now();
    w.shakeTime = 0.28;
    w.flashAlpha = 0.55;
    emitParticles(w.birdX, w.birdY, 16, 'feather', ['#F8FAFC', '#27272A', '#F59E0B']);
    audioRef.current.playCrash(mutedRef.current);

    if (w.score > bestScoreRef.current) {
      bestScoreRef.current = w.score;
      setBestScore(w.score);
      setIsNewRecord(true);
      try {
        localStorage.setItem(BEST_SCORE_KEY, String(w.score));
      } catch {
        // Ignore storage errors
      }
    }
    setGameState('GAME_OVER');
  }, [emitParticles]);

  const handlePenaltyComplete = useCallback(
    (deltaScore: number, scored: boolean) => {
      const w = worldRef.current;
      applyScoreDelta(deltaScore, {
        text: scored ? 'PENALTI GOLÜ! +30' : 'PENALTI KAÇTI! -10',
        color: scored ? '#34D399' : '#FB7185',
      });
      // Safe resume grace shield & gentle hover
      w.graceTimer = 1.2;
      w.birdVel = -190;
      gameStateRef.current = 'PLAYING';
      setGameState('PLAYING');
    },
    [applyScoreDelta]
  );

  // Keyboard controls: Space/Up/W jump, E/F/T flip, R/U ulti, P/Esc pause
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (gameStateRef.current === 'PENALTY') return;

      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault();
        if (e.repeat) return;

        const state = gameStateRef.current;
        if (state === 'READY' || state === 'PLAYING') {
          triggerFlap();
        } else if (state === 'MENU') {
          startGame();
        } else if (state === 'GAME_OVER') {
          if (performance.now() - gameOverTimestampRef.current > 380) {
            startGame();
          }
        }
      } else if (e.code === 'KeyE' || e.code === 'KeyF' || e.code === 'KeyT') {
        if (e.repeat) return;
        e.preventDefault();
        triggerFlip();
      } else if (e.code === 'KeyR' || e.code === 'KeyU' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        if (e.repeat) return;
        e.preventDefault();
        triggerUlti();
      } else if (e.code === 'Escape' || e.code === 'KeyP') {
        if (gameStateRef.current === 'PLAYING' || gameStateRef.current === 'PAUSED') {
          e.preventDefault();
          togglePause();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown, { passive: false });
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [startGame, togglePause, triggerFlap, triggerFlip, triggerUlti]);

  // Canvas resize observer
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));

      const dims = computeLogicalDimensions(rect.width, rect.height);
      const prevGroundY = worldRef.current.groundY;
      worldRef.current.width = dims.width;
      worldRef.current.height = dims.height;
      worldRef.current.groundY = dims.groundY;
      worldRef.current.birdX = dims.birdX;

      if (gameStateRef.current === 'MENU' || gameStateRef.current === 'READY') {
        worldRef.current.birdY = Math.round(dims.groundY * 0.45);
      } else if (prevGroundY > 0 && worldRef.current.birdY > dims.groundY - EAGLE_RADIUS) {
        worldRef.current.birdY = dims.groundY - EAGLE_RADIUS;
      }
    };

    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(container);
    window.addEventListener('orientationchange', updateSize);
    return () => {
      ro.disconnect();
      window.removeEventListener('orientationchange', updateSize);
    };
  }, [computeLogicalDimensions]);

  // High-FPS Main Loop with Offscreen Sprite Caching
  useEffect(() => {
    let rafId = 0;
    let lastTime = performance.now();
    let prevFlipCooldownActive = false;
    let prevUltiActive = false;

    const mainCanvas = canvasRef.current;
    const mainCtx = mainCanvas
      ? mainCanvas.getContext('2d', { alpha: false, desynchronized: true }) ||
        mainCanvas.getContext('2d')
      : null;

    // Offscreen cached layer canvases to eliminate per-frame gradient/path overhead
    const cache = {
      skyW: 0,
      skyH: 0,
      skyCanvas: document.createElement('canvas'),
      farCanvas: document.createElement('canvas'),
      stadiumCanvas: document.createElement('canvas'),
      groundCanvas: document.createElement('canvas'),
      pipeBodyCanvas: document.createElement('canvas'),
      pipeCapCanvas: document.createElement('canvas'),
      staticBuilt: false,
    };

    const buildStaticSprites = () => {
      if (cache.staticBuilt) return;
      cache.staticBuilt = true;

      // 1. Far Dolmabahce & Bosphorus Tile (360 x 185)
      const farW = 360;
      const farH = 185;
      cache.farCanvas.width = farW;
      cache.farCanvas.height = farH;
      const fctx = cache.farCanvas.getContext('2d');
      if (fctx) {
        const hY = farH - 125;
        fctx.fillStyle = '#0B1220';
        fctx.beginPath();
        fctx.moveTo(0, farH);
        fctx.lineTo(0, hY + 12);
        fctx.quadraticCurveTo(90, hY - 16, 180, hY + 8);
        fctx.quadraticCurveTo(270, hY + 26, 360, hY + 12);
        fctx.lineTo(360, farH);
        fctx.closePath();
        fctx.fill();

        fctx.fillRect(56, hY - 34, 14, 52);
        fctx.beginPath();
        fctx.moveTo(54, hY - 34);
        fctx.lineTo(63, hY - 48);
        fctx.lineTo(72, hY - 34);
        fctx.closePath();
        fctx.fill();
        fctx.fillStyle = 'rgba(245, 158, 11, 0.5)';
        fctx.beginPath();
        fctx.arc(63, hY - 22, 2.5, 0, Math.PI * 2);
        fctx.fill();
      }

      // 2. Besiktas Stadium Module Tile (420 x 235)
      const stadW = 420;
      const stadH = 235;
      cache.stadiumCanvas.width = stadW;
      cache.stadiumCanvas.height = stadH;
      const sctx = cache.stadiumCanvas.getContext('2d');
      if (sctx) {
        const standTopY = stadH - 118;
        const roofPeakY = stadH - 152;

        // Floodlight cones
        const towerX = 84;
        const towerTopY = roofPeakY - 46;
        const beamGrad = sctx.createLinearGradient(towerX, towerTopY, towerX + 120, stadH - 40);
        beamGrad.addColorStop(0, 'rgba(248, 250, 252, 0.16)');
        beamGrad.addColorStop(1, 'rgba(248, 250, 252, 0)');
        sctx.fillStyle = beamGrad;
        sctx.beginPath();
        sctx.moveTo(towerX - 10, towerTopY);
        sctx.lineTo(towerX + 12, towerTopY);
        sctx.lineTo(towerX + 185, stadH);
        sctx.lineTo(towerX - 65, stadH);
        sctx.closePath();
        sctx.fill();

        const tower2X = 294;
        const beamGrad2 = sctx.createLinearGradient(tower2X, towerTopY, tower2X - 90, stadH - 40);
        beamGrad2.addColorStop(0, 'rgba(248, 250, 252, 0.14)');
        beamGrad2.addColorStop(1, 'rgba(248, 250, 252, 0)');
        sctx.fillStyle = beamGrad2;
        sctx.beginPath();
        sctx.moveTo(tower2X - 10, towerTopY);
        sctx.lineTo(tower2X + 12, towerTopY);
        sctx.lineTo(tower2X + 70, stadH);
        sctx.lineTo(tower2X - 165, stadH);
        sctx.closePath();
        sctx.fill();

        // Pylons
        [84, 294].forEach((tx) => {
          const ty = roofPeakY - 46;
          sctx.fillStyle = '#334155';
          sctx.fillRect(tx - 4, ty, 8, stadH - ty);
          sctx.fillStyle = '#0F172A';
          sctx.fillRect(tx - 18, ty - 10, 36, 16);
          sctx.fillStyle = '#FFFFFF';
          for (let row = 0; row < 2; row++) {
            for (let col = 0; col < 5; col++) {
              sctx.fillRect(tx - 14 + col * 6, ty - 7 + row * 6, 4, 4);
            }
          }
        });

        // Lower Bowl & Black-White Tribunes
        sctx.fillStyle = '#09090B';
        sctx.fillRect(0, standTopY, stadW, stadH - standTopY);

        for (let s = 0; s < 14; s++) {
          const sx = s * 30;
          sctx.fillStyle = s % 2 === 0 ? '#18181B' : '#E2E8F0';
          sctx.globalAlpha = s % 2 === 0 ? 0.95 : 0.22;
          sctx.fillRect(sx, standTopY + 18, 30, 56);
        }
        sctx.globalAlpha = 1;

        for (let c = 0; c < 18; c++) {
          const cx = 12 + c * 23;
          const cy = standTopY + 28 + (c % 3) * 14;
          sctx.fillStyle = c % 2 === 0 ? '#F8FAFC' : '#94A3B8';
          sctx.globalAlpha = 0.35;
          sctx.fillRect(cx, cy, 3, 3);
        }
        sctx.globalAlpha = 1;

        // Fascia LED Strip
        sctx.fillStyle = '#0F172A';
        sctx.fillRect(0, stadH - 34, stadW, 16);
        sctx.fillStyle = '#F8FAFC';
        sctx.fillRect(0, stadH - 34, stadW, 2);
        for (let b = 0; b < 7; b++) {
          sctx.fillStyle = b % 2 === 0 ? '#F8FAFC' : '#3F3F46';
          sctx.fillRect(b * 60 + 8, stadH - 28, 42, 4);
        }

        // White Undulating Roof Canopy
        sctx.beginPath();
        sctx.moveTo(0, standTopY + 8);
        sctx.bezierCurveTo(
          stadW * 0.25,
          roofPeakY - 12,
          stadW * 0.5,
          standTopY + 14,
          stadW * 0.75,
          roofPeakY - 8
        );
        sctx.bezierCurveTo(
          stadW * 0.9,
          roofPeakY - 2,
          stadW,
          standTopY + 4,
          stadW,
          standTopY + 8
        );
        sctx.lineTo(stadW, standTopY + 24);
        sctx.lineTo(0, standTopY + 24);
        sctx.closePath();

        const roofGrad = sctx.createLinearGradient(0, roofPeakY - 10, 0, standTopY + 24);
        roofGrad.addColorStop(0, '#FFFFFF');
        roofGrad.addColorStop(0.55, '#E2E8F0');
        roofGrad.addColorStop(1, '#94A3B8');
        sctx.fillStyle = roofGrad;
        sctx.fill();

        sctx.strokeStyle = 'rgba(15, 23, 42, 0.35)';
        sctx.lineWidth = 1.5;
        for (let r = 20; r < stadW; r += 35) {
          sctx.beginPath();
          sctx.moveTo(r, standTopY + 22);
          sctx.lineTo(r + 8, standTopY - 8);
          sctx.stroke();
        }
      }

      // 3. Football Pitch Ground Tile (384 x GROUND_HEIGHT)
      const gW = 384;
      const gH = GROUND_HEIGHT;
      cache.groundCanvas.width = gW;
      cache.groundCanvas.height = gH;
      const gctx = cache.groundCanvas.getContext('2d');
      if (gctx) {
        const stripeW = 48;
        for (let gx = 0; gx < gW; gx += stripeW * 2) {
          gctx.fillStyle = '#166534';
          gctx.fillRect(gx, 0, stripeW, gH);
          gctx.fillStyle = '#15803D';
          gctx.fillRect(gx + stripeW, 0, stripeW, gH);
        }
        gctx.fillStyle = '#FFFFFF';
        gctx.fillRect(0, 0, gW, 5);
        gctx.strokeStyle = 'rgba(255, 255, 255, 0.38)';
        gctx.lineWidth = 3;
        gctx.beginPath();
        gctx.moveTo(192, 5);
        gctx.lineTo(192, gH);
        gctx.stroke();
        gctx.beginPath();
        gctx.arc(192, 42, 26, 0, Math.PI * 2);
        gctx.stroke();

        const turfShadow = gctx.createLinearGradient(0, 5, 0, 18);
        turfShadow.addColorStop(0, 'rgba(0,0,0,0.3)');
        turfShadow.addColorStop(1, 'rgba(0,0,0,0)');
        gctx.fillStyle = turfShadow;
        gctx.fillRect(0, 5, gW, 13);
      }

      // 4. Pipe Body Strip (PIPE_WIDTH x 16) & Cap Sprite ((PIPE_WIDTH + 12) x 24)
      cache.pipeBodyCanvas.width = PIPE_WIDTH;
      cache.pipeBodyCanvas.height = 16;
      const pbCtx = cache.pipeBodyCanvas.getContext('2d');
      if (pbCtx) {
        const bodyGrad = pbCtx.createLinearGradient(0, 0, PIPE_WIDTH, 0);
        bodyGrad.addColorStop(0, '#09090B');
        bodyGrad.addColorStop(0.22, '#27272A');
        bodyGrad.addColorStop(0.36, '#3F3F46');
        bodyGrad.addColorStop(0.75, '#18181B');
        bodyGrad.addColorStop(1, '#09090B');
        pbCtx.fillStyle = bodyGrad;
        pbCtx.fillRect(0, 0, PIPE_WIDTH, 16);
        pbCtx.fillStyle = 'rgba(248, 250, 252, 0.9)';
        pbCtx.fillRect(10, 0, 6, 16);
        pbCtx.fillStyle = '#E4E4E7';
        pbCtx.fillRect(0, 0, 1.5, 16);
        pbCtx.fillRect(PIPE_WIDTH - 1.5, 0, 1.5, 16);
      }

      const capW = PIPE_WIDTH + 12;
      const capH = 24;
      cache.pipeCapCanvas.width = capW;
      cache.pipeCapCanvas.height = capH;
      const pcCtx = cache.pipeCapCanvas.getContext('2d');
      if (pcCtx) {
        const capGrad = pcCtx.createLinearGradient(0, 0, capW, 0);
        capGrad.addColorStop(0, '#E2E8F0');
        capGrad.addColorStop(0.25, '#FFFFFF');
        capGrad.addColorStop(0.75, '#CBD5E1');
        capGrad.addColorStop(1, '#94A3B8');
        pcCtx.fillStyle = capGrad;
        pcCtx.beginPath();
        pcCtx.roundRect(1, 1, capW - 2, capH - 2, 4);
        pcCtx.fill();
        pcCtx.fillStyle = '#18181B';
        pcCtx.fillRect(4, 9, capW - 8, 6);
        pcCtx.strokeStyle = '#09090B';
        pcCtx.lineWidth = 2;
        pcCtx.beginPath();
        pcCtx.roundRect(1, 1, capW - 2, capH - 2, 4);
        pcCtx.stroke();
      }
    };

    const ensureSkyCache = (width: number, groundY: number) => {
      if (cache.skyW === width && cache.skyH === groundY) return;
      cache.skyW = width;
      cache.skyH = groundY;
      cache.skyCanvas.width = Math.max(1, width);
      cache.skyCanvas.height = Math.max(1, groundY);
      const ctx = cache.skyCanvas.getContext('2d');
      if (!ctx) return;

      const skyGrad = ctx.createLinearGradient(0, 0, 0, groundY);
      skyGrad.addColorStop(0, '#050811');
      skyGrad.addColorStop(0.55, '#0B1325');
      skyGrad.addColorStop(1, '#16243E');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, width, groundY);

      ctx.fillStyle = 'rgba(248, 250, 252, 0.5)';
      for (let i = 0; i < 24; i++) {
        const sx = ((i * 137.5 + 31) % 1) * width;
        const sy = ((i * 73.1 + 17) % 1) * (groundY * 0.48);
        const s = i % 3 === 0 ? 2 : 1.4;
        ctx.fillRect(sx, sy, s, s);
      }

      const moonX = width * 0.82;
      const moonY = groundY * 0.16;
      ctx.fillStyle = 'rgba(248, 250, 252, 0.9)';
      ctx.beginPath();
      ctx.arc(moonX, moonY, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#070C18';
      ctx.beginPath();
      ctx.arc(moonX + 6, moonY - 3, 14, 0, Math.PI * 2);
      ctx.fill();
    };

    const drawStadiumAndSky = (ctx: CanvasRenderingContext2D, w: typeof worldRef.current) => {
      const { width, groundY, scrollFar, scrollMid, scrollGround, time, ultiTimer } = w;
      buildStaticSprites();
      ensureSkyCache(width, groundY);

      // 1. Cached Sky + Moon + Stars (single drawImage)
      ctx.drawImage(cache.skyCanvas, 0, 0);

      // 2. Cached Far Skyline (tiled drawImage)
      const farW = 360;
      const farY = groundY - 185;
      const farOffset = scrollFar % farW;
      for (let x = -farOffset; x < width; x += farW) {
        ctx.drawImage(cache.farCanvas, x, farY);
      }

      // 3. Cached Besiktas Stadium (tiled drawImage)
      const stadW = 420;
      const stadY = groundY - 235;
      const stadOffset = scrollMid % stadW;
      for (let x = -stadOffset; x < width; x += stadW) {
        ctx.drawImage(cache.stadiumCanvas, x, stadY);
      }

      // Ulti high-speed wind streaks
      if (ultiTimer > 0) {
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.34)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let s = 0; s < 10; s++) {
          const ly = ((s * 59 + 25) % (groundY - 40)) + 20;
          const lx = width - (((time * 1350 + s * 210) % (width + 260)) - 120);
          ctx.moveTo(lx, ly);
          ctx.lineTo(lx + 95, ly);
        }
        ctx.stroke();
      }

      // 4. Cached Ground Turf (tiled drawImage)
      const gW = 384;
      const gOffset = scrollGround % gW;
      for (let x = -gOffset; x < width; x += gW) {
        ctx.drawImage(cache.groundCanvas, x, groundY);
      }
    };

    const drawPipes = (ctx: CanvasRenderingContext2D, w: typeof worldRef.current) => {
      const { pipes, groundY } = w;
      const capHeight = 24;
      const capOverhang = 6;

      for (const pipe of pipes) {
        const topHeight = Math.max(0, pipe.gapY - pipe.gapHeight / 2);
        const bottomY = pipe.gapY + pipe.gapHeight / 2;
        const bottomHeight = Math.max(0, groundY - bottomY);

        const drawSingleColumn = (
          x: number,
          y: number,
          h: number,
          isTop: boolean,
          offsetX: number,
          offsetY: number,
          rot: number
        ) => {
          if (h <= 0) return;

          if (pipe.smashed) {
            ctx.save();
            const pivotX = x + PIPE_WIDTH / 2 + offsetX;
            const pivotY = y + h / 2 + offsetY;
            ctx.translate(pivotX, pivotY);
            ctx.rotate(isTop ? -rot : rot);
            ctx.translate(-(x + PIPE_WIDTH / 2), -(y + h / 2));
            ctx.globalAlpha = 0.85;
          }

          ctx.drawImage(cache.pipeBodyCanvas, x, y, PIPE_WIDTH, h);

          const capY = isTop ? y + h - capHeight : y;
          ctx.drawImage(cache.pipeCapCanvas, x - capOverhang, capY);

          if (pipe.smashed) {
            ctx.restore();
          }
        };

        drawSingleColumn(
          pipe.x,
          0,
          topHeight,
          true,
          pipe.smashOffsetX,
          -pipe.smashOffsetY * 0.55,
          pipe.smashRot
        );
        drawSingleColumn(
          pipe.x,
          bottomY,
          bottomHeight,
          false,
          pipe.smashOffsetX,
          pipe.smashOffsetY,
          pipe.smashRot
        );
      }
    };

    const drawBonuses = (ctx: CanvasRenderingContext2D, w: typeof worldRef.current) => {
      for (const b of w.bonuses) {
        if (b.collected) continue;
        ctx.save();
        ctx.translate(b.x, b.y);

        const pulse = 1 + Math.sin(w.time * 6 + b.phase) * 0.12;
        ctx.fillStyle = 'rgba(251, 191, 36, 0.25)';
        ctx.beginPath();
        ctx.arc(0, 0, b.radius * 1.55 * pulse, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, b.radius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.rotate(w.time * 2.2 + b.phase);
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(0, 0, b.radius - 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#18181B';
        ctx.beginPath();
        ctx.arc(0, 0, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(-8, -5, 2.5, 0, Math.PI * 2);
        ctx.arc(8, -5, 2.5, 0, Math.PI * 2);
        ctx.arc(-6, 8, 2.5, 0, Math.PI * 2);
        ctx.arc(6, 8, 2.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();

        ctx.font = '700 10px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#FDE047';
        ctx.fillText('PENALTI', b.x, b.y + b.radius + 13);
      }
    };

    const drawEagle = (ctx: CanvasRenderingContext2D, w: typeof worldRef.current) => {
      const { birdX, birdY, birdRot, wingPhase, flapBoost, flipTimer, ultiTimer, graceTimer, time } = w;
      ctx.save();
      ctx.translate(birdX, birdY);

      if (graceTimer > 0 && Math.floor(time * 16) % 2 === 0) {
        ctx.globalAlpha = 0.65;
      }

      if (ultiTimer > 0) {
        ctx.fillStyle = 'rgba(251, 191, 36, 0.24)';
        ctx.beginPath();
        ctx.arc(4, 0, 38, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(8, 0, 30, -0.85, 0.85);
        ctx.stroke();
      }

      const flipAngle = flipTimer > 0 ? ((FLIP_DURATION - flipTimer) / FLIP_DURATION) * Math.PI * 2 : 0;
      ctx.rotate(birdRot + flipAngle);

      if (flapBoost > 0.05) {
        ctx.fillStyle = `rgba(248, 250, 252, ${flapBoost * 0.16})`;
        ctx.beginPath();
        ctx.arc(0, 0, 26, 0, Math.PI * 2);
        ctx.fill();
      }

      // Tail feathers
      ctx.fillStyle = '#09090B';
      ctx.beginPath();
      ctx.moveTo(-14, 1);
      ctx.lineTo(-29, -8);
      ctx.lineTo(-25, 0);
      ctx.lineTo(-30, 7);
      ctx.lineTo(-14, 7);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#F8FAFC';
      ctx.beginPath();
      ctx.moveTo(-22, -4);
      ctx.lineTo(-29, -8);
      ctx.lineTo(-26, -1);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-22, 3);
      ctx.lineTo(-30, 7);
      ctx.lineTo(-24, 6);
      ctx.closePath();
      ctx.fill();

      // Main Eagle Body
      ctx.fillStyle = ultiTimer > 0 ? '#27272A' : '#111114';
      ctx.beginPath();
      ctx.ellipse(0, 2, 18, 13, -0.08, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = ultiTimer > 0 ? '#F59E0B' : 'rgba(248,250,252,0.32)';
      ctx.lineWidth = ultiTimer > 0 ? 1.8 : 1.2;
      ctx.stroke();

      ctx.fillStyle = '#F8FAFC';
      ctx.beginPath();
      ctx.ellipse(6, 6, 8, 5, -0.35, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-4, 13);
      ctx.lineTo(-9, 17);
      ctx.lineTo(-12, 16);
      ctx.moveTo(-9, 17);
      ctx.lineTo(-7, 19);
      ctx.stroke();

      ctx.fillStyle = '#18181B';
      ctx.beginPath();
      ctx.arc(10, -5, 10, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#F8FAFC';
      ctx.beginPath();
      ctx.moveTo(2, -11);
      ctx.quadraticCurveTo(9, -17, 16, -11);
      ctx.quadraticCurveTo(10, -10, 2, -11);
      ctx.fill();

      ctx.fillStyle = '#F59E0B';
      ctx.beginPath();
      ctx.moveTo(17, -7);
      ctx.lineTo(29, -3);
      ctx.quadraticCurveTo(26, 3, 21, 2);
      ctx.lineTo(17, 0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#B45309';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = ultiTimer > 0 ? '#FDE047' : '#FFFFFF';
      ctx.beginPath();
      ctx.arc(13, -6, 3.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#09090B';
      ctx.beginPath();
      ctx.arc(14, -6, 1.7, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#F8FAFC';
      ctx.lineWidth = 2.1;
      ctx.beginPath();
      ctx.moveTo(8, -10);
      ctx.lineTo(17, -8.5);
      ctx.stroke();

      const wingSwing = Math.sin(wingPhase) * 14 - flapBoost * 7;
      ctx.save();
      ctx.translate(-2, 0);
      ctx.fillStyle = '#18181B';
      ctx.strokeStyle = ultiTimer > 0 ? '#FDE047' : '#F8FAFC';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(6, -1);
      ctx.quadraticCurveTo(-4, -14 + wingSwing, -19, -7 + wingSwing * 1.15);
      ctx.lineTo(-14, 3 + wingSwing * 0.65);
      ctx.lineTo(-18, 6 + wingSwing * 0.45);
      ctx.quadraticCurveTo(-4, 9 + wingSwing * 0.25, 6, 4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = 'rgba(248, 250, 252, 0.65)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-6, -1 + wingSwing * 0.5);
      ctx.lineTo(-15, -3 + wingSwing * 0.85);
      ctx.moveTo(-4, 2 + wingSwing * 0.35);
      ctx.lineTo(-14, 2 + wingSwing * 0.55);
      ctx.stroke();
      ctx.restore();

      ctx.restore();
    };

    const drawParticlesAndBanner = (ctx: CanvasRenderingContext2D, w: typeof worldRef.current) => {
      for (const p of w.particles) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        if (p.kind === 'feather') {
          ctx.beginPath();
          ctx.ellipse(0, 0, p.size * 1.4, p.size * 0.55, 0, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        }
        ctx.restore();
      }
      ctx.globalAlpha = 1;

      if (w.banner && w.banner.alpha > 0.01) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, w.banner.alpha);
        const cx = w.width / 2;
        const cy = Math.round(w.groundY * 0.25) + w.banner.yOffset;

        ctx.font = '800 30px "Barlow Condensed", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.fillStyle = 'rgba(9, 9, 11, 0.84)';
        const textWidth = ctx.measureText(w.banner.text).width;
        ctx.beginPath();
        ctx.roundRect(cx - textWidth / 2 - 20, cy - 21, textWidth + 40, 42, 10);
        ctx.fill();
        ctx.strokeStyle = w.banner.color;
        ctx.lineWidth = 1.6;
        ctx.stroke();

        ctx.fillStyle = w.banner.color;
        ctx.fillText(w.banner.text, cx, cy + 1);
        ctx.restore();
      }

      if (w.flashAlpha > 0.01) {
        ctx.fillStyle = `rgba(255, 255, 255, ${w.flashAlpha})`;
        ctx.fillRect(0, 0, w.width, w.height);
      }
    };

    const tick = (now: number) => {
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(rawDt, 0.05);

      const canvas = canvasRef.current;
      const ctx = mainCtx || (canvas ? canvas.getContext('2d') : null);
      const w = worldRef.current;
      const state = gameStateRef.current;

      w.time += dt;

      if (state === 'MENU' || state === 'READY') {
        const idleSpeed = BASE_SPEED * 0.52;
        w.scrollFar += idleSpeed * 0.15 * dt;
        w.scrollMid += idleSpeed * 0.42 * dt;
        w.scrollGround += idleSpeed * dt;
        w.birdY = Math.round(w.groundY * 0.44) + Math.sin(w.time * 3.4) * 10;
        w.birdRot = Math.sin(w.time * 3.4) * 0.06;
        w.wingPhase += dt * 11;
      } else if (state === 'PLAYING') {
        const wasUlti = w.ultiTimer > 0;
        if (wasUlti) {
          w.ultiTimer = Math.max(0, w.ultiTimer - dt);
          if (ultiProgressBarRef.current) {
            ultiProgressBarRef.current.style.transform = `scaleX(${Math.max(
              0,
              w.ultiTimer / ULTI_DURATION
            ).toFixed(3)})`;
          }
          if (w.ultiTimer === 0) {
            // Ulti finished: clear a generous 440px safe runway ahead so player doesn't die immediately
            const safeHorizonX = w.birdX + 440;
            for (const p of w.pipes) {
              if (!p.smashed && p.x < safeHorizonX) {
                if (p.x >= w.birdX - 40 && p.x <= w.birdX + 240) {
                  // Shatter nearby pipe cleanly outward as final Ulti shockwave
                  p.smashed = true;
                  p.smashVx = 360;
                  p.smashVy = -200;
                  p.smashVRot = 3.5;
                  if (!p.passed) {
                    p.passed = true;
                    w.pipesCleared += 1;
                    setPipesCleared(w.pipesCleared);
                    applyScoreDelta(10);
                  }
                } else if (p.x > w.birdX + 240) {
                  // Remove unbroken pipes inside the 440px post-Ulti safety buffer
                  p.x = -999;
                }
              }
            }
            w.pipes = w.pipes.filter((p) => p.x > -900);
            w.graceTimer = 0.85;
            w.birdVel = Math.min(w.birdVel, -150);
            w.banner = {
              text: 'ULTİ BİTTİ · SERBEST UÇUŞ',
              color: '#F8FAFC',
              alpha: 1.15,
              yOffset: 0,
            };
          } else if (Math.random() < 0.35 && w.particles.length < 48) {
            emitParticles(w.birdX - 18, w.birdY, 1, 'spark', ['#F59E0B', '#F8FAFC'], 0.8);
          }
        }

        const isUlti = w.ultiTimer > 0;
        if (isUlti !== prevUltiActive) {
          prevUltiActive = isUlti;
          setUltiActive(isUlti);
        }

        if (w.graceTimer > 0) {
          w.graceTimer = Math.max(0, w.graceTimer - dt);
        }
        if (w.flipTimer > 0) {
          w.flipTimer = Math.max(0, w.flipTimer - dt);
        }
        if (w.flipCooldown > 0) {
          w.flipCooldown = Math.max(0, w.flipCooldown - dt);
          if (flipCooldownBarRef.current) {
            flipCooldownBarRef.current.style.transform = `scaleX(${Math.max(
              0,
              w.flipCooldown / FLIP_COOLDOWN
            ).toFixed(3)})`;
          }
        }
        const cooldownNow = w.flipCooldown > 0;
        if (cooldownNow !== prevFlipCooldownActive) {
          prevFlipCooldownActive = cooldownNow;
          setFlipOnCooldown(cooldownNow);
        }

        const currentSpeed =
          BASE_SPEED * w.speedMultiplier * (isUlti ? ULTI_SPEED_BOOST : 1);
        w.scrollFar += currentSpeed * 0.15 * dt;
        w.scrollMid += currentSpeed * 0.42 * dt;
        w.scrollGround += currentSpeed * dt;

        w.birdVel = Math.min(MAX_FALL_SPEED, w.birdVel + GRAVITY * dt);
        w.birdY += w.birdVel * dt;
        w.flapBoost = Math.max(0, w.flapBoost - dt * 4.5);

        const wingFreq = isUlti ? 28 : w.birdVel < 80 ? 22 : 9;
        w.wingPhase += dt * wingFreq;

        const targetRot =
          w.birdVel < 0
            ? -0.42
            : Math.min(Math.PI / 2.2, ((w.birdVel - 40) / (MAX_FALL_SPEED - 40)) * (Math.PI / 2.2));
        w.birdRot += (targetRot - w.birdRot) * Math.min(1, dt * 12);

        if (w.birdY < EAGLE_RADIUS + 4) {
          w.birdY = EAGLE_RADIUS + 4;
          if (w.birdVel < 0) w.birdVel = 0;
        }

        if (w.birdY + EAGLE_RADIUS >= w.groundY) {
          if (isUlti || w.graceTimer > 0) {
            w.birdY = w.groundY - EAGLE_RADIUS;
            w.birdVel = -340;
          } else {
            w.birdY = w.groundY - EAGLE_RADIUS;
            die();
          }
        }

        let rightmostX = -Infinity;
        for (const p of w.pipes) {
          p.x -= currentSpeed * dt;
          if (p.x > rightmostX) rightmostX = p.x;

          if (p.smashed) {
            p.smashOffsetX += p.smashVx * dt;
            p.smashOffsetY += p.smashVy * dt;
            p.smashVy += 720 * dt;
            p.smashRot += p.smashVRot * dt;
            continue;
          }

          if (!p.passed && p.x + PIPE_WIDTH / 2 < w.birdX) {
            p.passed = true;
            w.pipesCleared += 1;
            setPipesCleared(w.pipesCleared);
            applyScoreDelta(10);
            if (Math.floor(w.score / 50) === w.speedTier && w.score % 50 !== 0) {
              audioRef.current.playScore(mutedRef.current);
            }
          }

          const topPipeBottom = p.gapY - p.gapHeight / 2;
          const bottomPipeTop = p.gapY + p.gapHeight / 2;
          const closestX = Math.max(p.x - 3, Math.min(w.birdX, p.x + PIPE_WIDTH + 3));
          const closestTopY = Math.max(0, Math.min(w.birdY, topPipeBottom));
          const closestBottomY = Math.max(bottomPipeTop, Math.min(w.birdY, w.groundY));

          const dxTop = w.birdX - closestX;
          const dyTop = w.birdY - closestTopY;
          const dxBot = w.birdX - closestX;
          const dyBot = w.birdY - closestBottomY;

          const hitPipe =
            dxTop * dxTop + dyTop * dyTop < EAGLE_RADIUS * EAGLE_RADIUS ||
            dxBot * dxBot + dyBot * dyBot < EAGLE_RADIUS * EAGLE_RADIUS;

          if (isUlti && (hitPipe || (w.birdX + 26 >= p.x && w.birdX - 18 <= p.x + PIPE_WIDTH))) {
            p.smashed = true;
            p.smashVx = 340 + Math.random() * 140;
            p.smashVy = -180 - Math.random() * 120;
            p.smashVRot = 3.2 + Math.random() * 2.5;
            w.shakeTime = 0.16;
            if (w.particles.length < 48) {
              emitParticles(
                p.x + PIPE_WIDTH / 2,
                w.birdY,
                12,
                'debris',
                ['#FFFFFF', '#18181B', '#F59E0B'],
                1.5
              );
            }
            audioRef.current.playSmash(mutedRef.current);

            if (!p.passed) {
              p.passed = true;
              w.pipesCleared += 1;
              setPipesCleared(w.pipesCleared);
              applyScoreDelta(10);
            }
            continue;
          }

          if (hitPipe && w.graceTimer <= 0) {
            die();
            break;
          }
        }

        while (w.pipes.length > 0 && w.pipes[0].x + PIPE_WIDTH + 80 < 0) {
          w.pipes.shift();
        }
        // Keep safe horizon after Ulti ends so newly spawned pipes stay >= 440px ahead
        const minNextPipeBase = w.graceTimer > 0 && !isUlti ? w.birdX + 440 : w.width + 80;
        while (rightmostX < w.width + PIPE_SPACING) {
          rightmostX =
            rightmostX === -Infinity
              ? Math.max(w.width + 80, minNextPipeBase)
              : Math.max(rightmostX + PIPE_SPACING, minNextPipeBase);
          w.pipes.push(spawnPipeWithOptionalBonus(rightmostX, w.groundY));
        }

        for (let i = w.bonuses.length - 1; i >= 0; i--) {
          const b = w.bonuses[i];
          b.x -= currentSpeed * dt;
          b.y = b.baseY + Math.sin(w.time * 4 + b.phase) * 10;

          if (!b.collected) {
            const dx = w.birdX - b.x;
            const dy = w.birdY - b.y;
            const hitDist = EAGLE_RADIUS + b.radius + 4;
            if (dx * dx + dy * dy <= hitDist * hitDist) {
              b.collected = true;
              emitParticles(b.x, b.y, 12, 'spark', ['#F59E0B', '#FFFFFF'], 1.3);
              audioRef.current.playWhistle(mutedRef.current);
              gameStateRef.current = 'PENALTY';
              setGameState('PENALTY');
              break;
            }
          }

          if (b.collected || b.x + b.radius < -20) {
            w.bonuses.splice(i, 1);
          }
        }
      } else if (state === 'GAME_OVER') {
        if (w.birdY + EAGLE_RADIUS < w.groundY) {
          w.birdVel = Math.min(MAX_FALL_SPEED * 1.15, w.birdVel + GRAVITY * dt);
          w.birdY = Math.min(w.groundY - EAGLE_RADIUS, w.birdY + w.birdVel * dt);
          w.birdRot = Math.min(Math.PI / 2, w.birdRot + dt * 6);
        }
      }

      if (state !== 'PAUSED' && state !== 'PENALTY') {
        for (let i = w.particles.length - 1; i >= 0; i--) {
          const pt = w.particles[i];
          pt.x += pt.vx * dt;
          pt.y += pt.vy * dt;
          pt.vy += 240 * dt;
          pt.rotation += pt.vRot * dt;
          pt.alpha -= pt.decay * dt;
          if (pt.alpha <= 0) {
            w.particles.splice(i, 1);
          }
        }

        if (w.banner) {
          w.banner.alpha -= dt * 0.82;
          w.banner.yOffset -= dt * 18;
          if (w.banner.alpha <= 0) w.banner = null;
        }
        w.shakeTime = Math.max(0, w.shakeTime - dt);
        w.flashAlpha = Math.max(0, w.flashAlpha - dt * 2.4);
      }

      if (canvas && ctx) {
        const scaleX = canvas.width / w.width;
        const scaleY = canvas.height / w.height;

        ctx.save();
        ctx.scale(scaleX, scaleY);

        if (w.shakeTime > 0) {
          const mag = (w.shakeTime / 0.28) * 7;
          ctx.translate((Math.random() - 0.5) * mag * 2, (Math.random() - 0.5) * mag * 2);
        }

        drawStadiumAndSky(ctx, w);
        drawPipes(ctx, w);
        drawBonuses(ctx, w);
        drawEagle(ctx, w);
        drawParticlesAndBanner(ctx, w);

        ctx.restore();
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [applyScoreDelta, die, emitParticles, spawnPipeWithOptionalBonus]);

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (gameStateRef.current === 'READY' || gameStateRef.current === 'PLAYING') {
      triggerFlap();
    }
  };

  const speedTier = Math.floor(score / 50);
  const speedMultiplier = Math.pow(1.1, speedTier);
  const ultiReady = flipCharges >= 2 && !ultiActive;

  return (
    <div
      ref={containerRef}
      className="relative w-full h-dvh overflow-hidden bg-zinc-950 select-none"
    >
      <canvas
        ref={canvasRef}
        onPointerDown={handleCanvasPointerDown}
        className="block w-full h-full cursor-pointer touch-none"
        aria-label="Kara Kartal oyun alanı"
      />

      {/* Top HUD */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 px-3 pt-3 sm:px-6 sm:pt-4">
        <div className="pointer-events-auto flex items-center gap-2">
          {gameState !== 'MENU' && (
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                goToMenu();
              }}
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-white/15 bg-zinc-950/88 px-3.5 text-sm font-semibold text-zinc-100 transition-colors hover:bg-zinc-900 whitespace-nowrap shrink-0"
              aria-label="Ana Menü"
            >
              <Home className="h-4 w-4" />
              <span>Menü</span>
            </button>
          )}

          {(gameState === 'PLAYING' || gameState === 'PAUSED') && (
            <button
              key="pause-btn"
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                togglePause();
              }}
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-white/15 bg-zinc-950/88 px-3.5 text-sm font-semibold text-zinc-100 transition-colors hover:bg-zinc-900 whitespace-nowrap shrink-0"
              aria-label={gameState === 'PAUSED' ? 'Devam Et' : 'Duraklat'}
            >
              {gameState === 'PAUSED' ? (
                <span key="resume-label" className="inline-flex items-center gap-2">
                  <Play className="h-4 w-4" />
                  <span className="hidden sm:inline">Devam Et</span>
                </span>
              ) : (
                <span key="pause-label" className="inline-flex items-center gap-2">
                  <Pause className="h-4 w-4" />
                  <span className="hidden sm:inline">Duraklat</span>
                </span>
              )}
            </button>
          )}
        </div>

        {gameState !== 'MENU' && (
          <div key="hud-score" className="flex flex-col items-center text-center">
            <div className="font-display text-5xl sm:text-6xl font-extrabold leading-none tracking-tight text-white tabular-nums drop-shadow-[0_3px_10px_rgba(0,0,0,0.85)]">
              {score}
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs sm:text-sm font-semibold text-zinc-200 tabular-nums drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
              <span>En İyi: {Math.max(bestScore, score)}</span>
              <span aria-hidden="true">·</span>
              <span className={speedTier > 0 ? 'text-amber-400' : 'text-zinc-200'}>
                Hız: {speedMultiplier.toFixed(2)}x
              </span>
            </div>
          </div>
        )}

        <div className="pointer-events-auto flex items-center gap-2">
          {gameState !== 'MENU' && (
            <button
              key="restart-btn"
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                startGame();
              }}
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-white/15 bg-zinc-950/88 px-3.5 text-sm font-semibold text-zinc-100 transition-colors hover:bg-zinc-900 whitespace-nowrap shrink-0"
              aria-label="Yeniden Başlat"
            >
              <RotateCcw className="h-4 w-4" />
              <span className="hidden sm:inline">Yeniden Başlat</span>
            </button>
          )}

          <button
            key="mute-btn"
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              setMuted((m) => !m);
            }}
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-white/15 bg-zinc-950/88 text-zinc-100 transition-colors hover:bg-zinc-900 shrink-0"
            aria-label={muted ? 'Sesi Aç' : 'Sesi Kapat'}
            title={muted ? 'Sesi Aç' : 'Sesi Kapat'}
          >
            {muted ? <VolumeX key="vol-off" className="h-4 w-4" /> : <Volume2 key="vol-on" className="h-4 w-4" />}
          </button>
        </div>
      </header>

      {/* Bottom Action Controls: Takla & Ulti */}
      {(gameState === 'PLAYING' || gameState === 'READY') && (
        <div key="bottom-controls" className="pointer-events-none absolute inset-x-0 bottom-3 z-20 flex items-end justify-between px-3 sm:px-6">
          <button
            key="flip-btn"
            type="button"
            disabled={gameState !== 'PLAYING' || flipOnCooldown}
            onPointerDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              triggerFlip();
            }}
            className="pointer-events-auto relative inline-flex h-12 min-w-[132px] items-center justify-center gap-2 overflow-hidden rounded-lg border border-white/25 bg-zinc-950/90 px-4 text-sm font-bold text-white shadow-lg transition-transform active:scale-95 disabled:opacity-55 whitespace-nowrap"
            aria-label="Takla At (+20 Puan)"
          >
            <span
              ref={flipCooldownBarRef}
              className={`absolute inset-0 origin-left bg-white/15 ${flipOnCooldown ? 'block' : 'hidden'}`}
              style={{ transform: 'scaleX(1)' }}
            />
            <RefreshCw className="relative h-4 w-4 text-amber-400" />
            <span className="relative">Takla [E]</span>
            <span className="relative text-xs font-semibold text-amber-300">+20</span>
          </button>

          <button
            key="ulti-btn"
            type="button"
            disabled={gameState !== 'PLAYING' || !ultiReady}
            onPointerDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              triggerUlti();
            }}
            className={`pointer-events-auto relative inline-flex h-12 min-w-[144px] items-center justify-center gap-2 overflow-hidden rounded-lg border px-4 text-sm font-extrabold shadow-lg transition-transform active:scale-95 whitespace-nowrap ${
              ultiActive
                ? 'border-amber-300 bg-amber-600 text-zinc-950'
                : ultiReady
                ? 'border-amber-400 bg-amber-400 text-zinc-950 hover:bg-amber-300'
                : 'border-white/20 bg-zinc-950/90 text-zinc-300 opacity-75'
            }`}
            aria-label="Ulti Aç"
          >
            <span
              ref={ultiProgressBarRef}
              className={`absolute inset-0 origin-left bg-amber-300/75 ${ultiActive ? 'block' : 'hidden'}`}
              style={{ transform: 'scaleX(1)' }}
            />
            {ultiActive ? (
              <span key="ulti-on-label" className="relative inline-flex items-center gap-2">
                <Flame className="h-4 w-4" />
                <span>ULTİ AKTİF</span>
              </span>
            ) : (
              <span key="ulti-off-label" className="relative inline-flex items-center gap-2">
                <Zap className={`h-4 w-4 ${ultiReady ? 'text-zinc-950' : 'text-amber-400'}`} />
                <span>Ulti [R]</span>
                <span className="tabular-nums text-xs">
                  {ultiReady ? 'HAZIR!' : `${flipCharges}/2`}
                </span>
              </span>
            )}
          </button>
        </div>
      )}

      {/* READY Prompt */}
      {gameState === 'READY' && (
        <div className="pointer-events-none absolute inset-x-0 bottom-[23%] z-10 flex flex-col items-center px-4 text-center">
          <p className="font-display text-3xl sm:text-4xl font-bold tracking-wide text-white drop-shadow-[0_3px_10px_rgba(0,0,0,0.9)]">
            UÇUŞA HAZIR MISIN?
          </p>
          <p className="mt-1.5 text-sm sm:text-base font-medium text-zinc-200 drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)]">
            Zıpla: Boşluk / Dokun · Takla: E · Ulti: R
          </p>
        </div>
      )}

      {/* MAIN MENU OVERLAY */}
      {gameState === 'MENU' && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-zinc-950/45 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-md rounded-xl border border-white/15 bg-zinc-950/90 p-6 sm:p-7 text-center shadow-2xl">
            <p className="text-xs font-semibold tracking-widest text-zinc-400">
              BEŞİKTAŞ STADYUMU · ARCADE UÇUŞ
            </p>
            <h1 className="font-display mt-2 text-5xl sm:text-6xl font-extrabold tracking-tight text-white text-balance">
              KARA KARTAL
            </h1>
            <p className="mt-2.5 text-sm sm:text-base leading-relaxed text-zinc-300">
              Boru aralarından sıyrıl, havada takla atarak Ulti biriktir ve bonus toplarla penaltı gole git.
            </p>

            <div className="mt-5 grid grid-cols-2 gap-3 border-y border-white/10 py-4 text-center sm:grid-cols-4">
              <div>
                <div className="font-display text-2xl font-bold text-white tabular-nums">+10</div>
                <div className="mt-0.5 text-xs text-zinc-400">Her Boru</div>
              </div>
              <div>
                <div className="font-display text-2xl font-bold text-amber-400 tabular-nums">+20</div>
                <div className="mt-0.5 text-xs text-zinc-400">Takla (E)</div>
              </div>
              <div>
                <div className="font-display text-2xl font-bold text-white tabular-nums">2 Takla</div>
                <div className="mt-0.5 text-xs text-zinc-400">Ulti Yıkar (R)</div>
              </div>
              <div>
                <div className="font-display text-2xl font-bold text-emerald-400 tabular-nums">+30/-10</div>
                <div className="mt-0.5 text-xs text-zinc-400">Penaltı Ödülü</div>
              </div>
            </div>

            <div className="mt-3 text-xs font-semibold text-zinc-300 tabular-nums">
              Her 50 puanda hız +%10 artar · En Yüksek Puan: {bestScore}
            </div>

            <div className="mt-5 flex flex-col gap-3">
              <button
                type="button"
                onClick={startGame}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-white px-6 text-base font-bold text-zinc-950 transition-transform duration-150 hover:bg-zinc-200 active:scale-[0.98] whitespace-nowrap"
              >
                <Play className="h-5 w-5 fill-current" />
                <span>Oyunu Başlat</span>
              </button>
            </div>

            <p className="mt-4 text-xs font-medium text-zinc-400">
              Zıpla: Boşluk / Dokunma · Takla: E · Ulti: R
            </p>
          </div>
        </div>
      )}

      {/* PENALTY SHOOTOUT MINI-GAME */}
      {gameState === 'PENALTY' && (
        <PenaltyShootoutModal
          muted={muted}
          audio={audioRef.current}
          onComplete={handlePenaltyComplete}
        />
      )}

      {/* PAUSE OVERLAY */}
      {gameState === 'PAUSED' && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-zinc-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-xl border border-white/15 bg-zinc-950/95 p-6 text-center shadow-2xl">
            <h2 className="font-display text-4xl font-extrabold text-white">DURAKLATILDI</h2>
            <p className="mt-2 text-sm text-zinc-300 tabular-nums">
              Güncel Puan: {score} · Hız: {speedMultiplier.toFixed(2)}x
            </p>

            <div className="mt-6 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={togglePause}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-white px-5 text-sm font-bold text-zinc-950 transition-colors hover:bg-zinc-200 whitespace-nowrap"
              >
                <Play className="h-4 w-4 fill-current" />
                <span>Devam Et</span>
              </button>
              <button
                type="button"
                onClick={startGame}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-white/15 bg-zinc-900 px-5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 whitespace-nowrap"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Yeniden Başlat</span>
              </button>
              <button
                type="button"
                onClick={goToMenu}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-transparent px-5 text-sm font-semibold text-zinc-300 transition-colors hover:bg-zinc-900 hover:text-white whitespace-nowrap"
              >
                <Home className="h-4 w-4" />
                <span>Ana Menü</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GAME OVER OVERLAY */}
      {gameState === 'GAME_OVER' && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-zinc-950/65 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-xl border border-white/15 bg-zinc-950/95 p-6 sm:p-7 text-center shadow-2xl">
            <div className="flex items-center justify-center gap-2 text-xs font-semibold tracking-wider text-zinc-400">
              {isNewRecord ? (
                <span className="inline-flex items-center gap-1.5 text-amber-400">
                  <Trophy className="h-4 w-4" />
                  YENİ REKOR
                </span>
              ) : (
                <span>MAÇ SONU SKORU</span>
              )}
            </div>

            <h2 className="font-display mt-1.5 text-4xl sm:text-5xl font-extrabold text-white">
              OYUN BİTTİ
            </h2>

            <div className="mt-5 grid grid-cols-2 gap-4 border-y border-white/10 py-4">
              <div>
                <div className="text-xs text-zinc-400">Puan</div>
                <div className="font-display mt-0.5 text-4xl font-extrabold text-white tabular-nums">
                  {score}
                </div>
              </div>
              <div>
                <div className="text-xs text-zinc-400">En Yüksek</div>
                <div className="font-display mt-0.5 text-4xl font-extrabold text-amber-400 tabular-nums">
                  {bestScore}
                </div>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-center gap-3 text-xs font-medium text-zinc-300 tabular-nums">
              <span>Geçilen Boru: {pipesCleared}</span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1">
                <Zap className="h-3.5 w-3.5 text-amber-400" />
                Son Hız: {speedMultiplier.toFixed(2)}x
              </span>
            </div>

            <div className="mt-6 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={startGame}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-white px-5 text-base font-bold text-zinc-950 transition-transform duration-150 hover:bg-zinc-200 active:scale-[0.98] whitespace-nowrap"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Yeniden Başlat</span>
              </button>
              <button
                type="button"
                onClick={goToMenu}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-white/15 bg-zinc-900 px-5 text-sm font-semibold text-zinc-100 transition-colors hover:bg-zinc-800 whitespace-nowrap"
              >
                <Home className="h-4 w-4" />
                <span>Ana Menü</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
