import { useEffect, useRef } from 'react';

interface Star {
  x: number;
  y: number;
  radius: number;
  baseAlpha: number;
  twinkleSpeed: number;
  twinkleOffset: number;
  tint: number; // 0 = white, 1 = warm, 2 = cool
}

interface ShootingStar {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  length: number;
}

const STAR_COUNT = 700;
const SHOOTING_STAR_INTERVAL_MIN = 4000;
const SHOOTING_STAR_INTERVAL_MAX = 12000;

function createStars(w: number, h: number): Star[] {
  const stars: Star[] = [];
  for (let i = 0; i < STAR_COUNT; i++) {
    stars.push({
      x: Math.random() * w,
      y: Math.random() * h,
      radius: Math.random() < 0.05 ? 1.4 + Math.random() * 0.8 : Math.random() < 0.3 ? 0.7 + Math.random() * 0.6 : 0.4 + Math.random() * 0.5,
      baseAlpha: Math.random() < 0.05 ? 0.5 + Math.random() * 0.3 : 0.2 + Math.random() * 0.4,
      twinkleSpeed: 0.3 + Math.random() * 1.8,
      twinkleOffset: Math.random() * Math.PI * 2,
      tint: Math.random() < 0.15 ? 1 : Math.random() < 0.1 ? 2 : 0,
    });
  }
  return stars;
}

function spawnShootingStar(w: number, h: number): ShootingStar {
  const fromLeft = Math.random() > 0.5;
  const x = fromLeft ? Math.random() * w * 0.3 : w * 0.7 + Math.random() * w * 0.3;
  const y = Math.random() * h * 0.4;
  const angle = fromLeft
    ? 0.3 + Math.random() * 0.5
    : Math.PI - 0.3 - Math.random() * 0.5;
  const speed = 1.5 + Math.random() * 2;
  return {
    x, y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    life: 0,
    maxLife: 80 + Math.random() * 60,
    length: 100 + Math.random() * 120,
  };
}

function tintColor(tint: number, alpha: number): string {
  if (tint === 1) return `rgba(255,220,180,${alpha})`;
  if (tint === 2) return `rgba(180,210,255,${alpha})`;
  return `rgba(255,255,255,${alpha})`;
}

export function CosmicCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = window.innerWidth;
    let h = window.innerHeight;
    canvas.width = w;
    canvas.height = h;

    let stars = createStars(w, h);
    let shootingStars: ShootingStar[] = [];
    let nextShoot = performance.now() + 2000 + Math.random() * 3000;

    const handleResize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w;
      canvas.height = h;
      stars = createStars(w, h);
    };
    window.addEventListener('resize', handleResize);

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let prevTime = performance.now();

    function draw(time: number) {
      const dt = (time - prevTime) / 1000;
      prevTime = time;
      ctx!.clearRect(0, 0, w, h);

      // Stars
      for (const star of stars) {
        const twinkle = prefersReduced
          ? star.baseAlpha
          : star.baseAlpha * (0.5 + 0.5 * Math.sin(time * 0.001 * star.twinkleSpeed + star.twinkleOffset));
        const alpha = Math.max(0.05, twinkle);

        ctx!.beginPath();
        ctx!.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        ctx!.fillStyle = tintColor(star.tint, alpha);
        ctx!.fill();

        // Glow on brighter stars
        if (star.radius > 1.2 && alpha > 0.4) {
          ctx!.beginPath();
          ctx!.arc(star.x, star.y, star.radius * 3, 0, Math.PI * 2);
          const grad = ctx!.createRadialGradient(star.x, star.y, 0, star.x, star.y, star.radius * 3);
          grad.addColorStop(0, tintColor(star.tint, alpha * 0.25));
          grad.addColorStop(1, 'transparent');
          ctx!.fillStyle = grad;
          ctx!.fill();
        }
      }

      if (!prefersReduced) {
        // Spawn shooting stars periodically
        if (time > nextShoot) {
          shootingStars.push(spawnShootingStar(w, h));
          nextShoot = time + SHOOTING_STAR_INTERVAL_MIN +
            Math.random() * (SHOOTING_STAR_INTERVAL_MAX - SHOOTING_STAR_INTERVAL_MIN);
        }

        // Animate shooting stars
        for (let i = shootingStars.length - 1; i >= 0; i--) {
          const s = shootingStars[i];
          s.x += s.vx * dt * 60;
          s.y += s.vy * dt * 60;
          s.life++;

          const progress = s.life / s.maxLife;
          const fadeIn = Math.min(1, s.life / 5);
          const fadeOut = Math.max(0, 1 - (progress - 0.6) / 0.4);
          const alpha = fadeIn * fadeOut * 0.8;

          if (s.life > s.maxLife || s.x < -100 || s.x > w + 100 || s.y > h + 100) {
            shootingStars.splice(i, 1);
            continue;
          }

          const mag = Math.sqrt(s.vx * s.vx + s.vy * s.vy);
          const tailX = s.x - (s.vx / mag) * s.length * fadeIn;
          const tailY = s.y - (s.vy / mag) * s.length * fadeIn;

          // Trail gradient
          const grad = ctx!.createLinearGradient(tailX, tailY, s.x, s.y);
          grad.addColorStop(0, 'transparent');
          grad.addColorStop(0.6, `rgba(180,210,255,${alpha * 0.3})`);
          grad.addColorStop(1, `rgba(255,255,255,${alpha})`);

          ctx!.beginPath();
          ctx!.moveTo(tailX, tailY);
          ctx!.lineTo(s.x, s.y);
          ctx!.strokeStyle = grad;
          ctx!.lineWidth = 1.5;
          ctx!.lineCap = 'round';
          ctx!.stroke();

          // Head glow
          const headGrad = ctx!.createRadialGradient(s.x, s.y, 0, s.x, s.y, 4);
          headGrad.addColorStop(0, `rgba(255,255,255,${alpha})`);
          headGrad.addColorStop(1, 'transparent');
          ctx!.beginPath();
          ctx!.arc(s.x, s.y, 4, 0, Math.PI * 2);
          ctx!.fillStyle = headGrad;
          ctx!.fill();
        }
      }

      animRef.current = requestAnimationFrame(draw);
    }

    animRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}
    />
  );
}
