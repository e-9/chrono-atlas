import { useEffect, useRef, lazy, Suspense } from 'react';
import { aboutContent } from './aboutContent';

const CosmicCanvas = lazy(() => import('../components/CosmicCanvas/CosmicCanvas').then(m => ({ default: m.CosmicCanvas })));

interface AboutProps {
  onBack: () => void;
}

function FadeSection({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.style.opacity = '1';
          el.style.transform = 'translateY(0)';
          observer.unobserve(el);
        }
      },
      { threshold: 0.15 },
    );
    const timer = setTimeout(() => observer.observe(el), delay);
    return () => { clearTimeout(timer); observer.disconnect(); };
  }, [delay]);

  return (
    <div
      ref={ref}
      style={{
        opacity: 0,
        transform: 'translateY(24px)',
        transition: 'opacity 0.8s ease, transform 0.8s ease',
      }}
    >
      {children}
    </div>
  );
}

export default function About({ onBack }: AboutProps) {
  return (
    <div style={{
      fontFamily: "'Cormorant Garamond', Georgia, serif",
      minHeight: '100vh',
      background: 'radial-gradient(ellipse at 50% 0%, #0d1b2a 0%, #070d15 50%, #020408 100%)',
      color: '#e0dde4',
      overflowY: 'auto',
    }}>
      <Suspense fallback={null}>
        <CosmicCanvas />
      </Suspense>

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 680, margin: '0 auto', padding: '48px 24px 80px' }}>
        {/* Back link */}
        <FadeSection>
          <button
            onClick={onBack}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: "'Cinzel', serif", fontSize: 12, letterSpacing: '0.1em',
              color: '#6b7d99', padding: 0, marginBottom: 48,
              transition: 'color 0.3s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#e8e4d9'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#6b7d99'; }}
          >
            ← Back to the Globe
          </button>
        </FadeSection>

        {/* Hero */}
        <FadeSection delay={100}>
          <h1 style={{
            fontFamily: "'Cinzel', serif", fontWeight: 400,
            fontSize: 'clamp(32px, 5vw, 48px)', letterSpacing: '0.15em',
            color: '#e8e4d9', margin: '0 0 16px', textAlign: 'center',
          }}>
            {aboutContent.hero.title}
          </h1>
          <p style={{
            fontStyle: 'italic', fontWeight: 400,
            fontSize: 'clamp(18px, 3vw, 24px)', lineHeight: 1.5,
            color: '#c8c3ba', textAlign: 'center', margin: '0 0 56px',
          }}>
            {aboutContent.hero.subtitle}
          </p>
        </FadeSection>

        {/* Sections */}
        {aboutContent.sections.map((section, i) => (
          <FadeSection key={i} delay={200 + i * 120}>
            <div style={{ marginBottom: 48 }}>
              {i > 0 && (
                <hr style={{
                  border: 'none', borderTop: '1px solid rgba(255,255,255,0.06)',
                  margin: '0 0 48px',
                }} />
              )}
              <h2 style={{
                fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 600,
                fontSize: 22, color: '#e8e4d9', margin: '0 0 16px',
                letterSpacing: '0.04em',
              }}>
                {section.heading}
              </h2>
              <p style={{
                fontSize: 17, lineHeight: 1.7, color: '#b0aaa0', margin: 0,
              }}>
                {section.body}
              </p>
            </div>
          </FadeSection>
        ))}

        {/* Closing */}
        <FadeSection delay={200 + aboutContent.sections.length * 120}>
          <hr style={{
            border: 'none', borderTop: '1px solid rgba(255,255,255,0.06)',
            margin: '0 0 64px',
          }} />
          <p style={{
            fontStyle: 'italic', fontWeight: 400,
            fontSize: 'clamp(20px, 3vw, 26px)', lineHeight: 1.5,
            color: '#c8c3ba', textAlign: 'center', margin: 0,
          }}>
            {aboutContent.closing.text}
          </p>
        </FadeSection>
      </div>
    </div>
  );
}
