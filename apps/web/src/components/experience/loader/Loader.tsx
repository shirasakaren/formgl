'use client';
import { memo, useEffect, useRef, useState } from 'react';
import type { LoaderStyle } from '@formgl/shared';
import { useExperience } from '../store';

import { envConfig, type VignetteKey } from '../envs';
import { Balloon, Bottle, Candle, Clock, Clouds, Gull, HotAir, Kite, Lighthouse, Shell, Sunrise, Teacup, Typewriter, Waves } from './vignettes2';

type Vignette = VignetteKey;

function Ink({ ink }: { ink: string }) {
  return (
    <svg viewBox="0 0 200 120" className="fgl-v fgl-v-ink" aria-hidden>
      <path
        className="stroke"
        d="M20 80 C 40 20, 60 20, 62 60 S 80 100, 96 60 S 120 20, 128 58 S 150 96, 160 52 C 166 34, 176 36, 182 44"
        fill="none"
        stroke={ink}
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <g className="nib">
        <path d="M0 0 L 7 -22 L 11 -21 L 5 1 Z" fill={ink} opacity="0.9" />
      </g>
      <path d="M40 98 C 80 92, 120 104, 170 96" fill="none" stroke={ink} strokeWidth="1" opacity="0.25" strokeLinecap="round" />
    </svg>
  );
}

function Stamp({ ink, accent }: { ink: string; accent: string }) {
  return (
    <svg viewBox="0 0 200 140" className="fgl-v fgl-v-stamp" aria-hidden>
      <rect x="40" y="96" width="120" height="30" rx="3" fill="#fffaf2" stroke={ink} strokeOpacity="0.15" />
      <g className="seal">
        <path d="M100 86 c 14 0 22 7 22 17 c 0 11 -9 17 -22 17 c -13 0 -23 -5 -23 -17 c 0 -10 9 -17 23 -17z" fill={accent} />
        <circle cx="100" cy="103" r="11" fill="none" stroke="#000" strokeOpacity="0.18" strokeWidth="1.5" />
      </g>
      <g className="handle">
        <rect x="93" y="10" width="14" height="46" rx="7" fill={ink} opacity="0.85" />
        <rect x="84" y="54" width="32" height="10" rx="3" fill={ink} opacity="0.95" />
      </g>
    </svg>
  );
}

function Plane({ ink }: { ink: string }) {
  return (
    <svg viewBox="0 0 200 140" className="fgl-v fgl-v-plane" aria-hidden>
      <path className="trail" d="M10 110 C 60 120, 70 40, 110 60 S 170 90, 190 30" fill="none" stroke={ink} strokeOpacity="0.35" strokeWidth="1.4" strokeDasharray="3 6" />
      <g className="plane">
        <path d="M0 0 L 26 -9 L 8 4 Z" fill="#fffaf2" stroke={ink} strokeWidth="1.2" strokeLinejoin="round" />
        <path d="M8 4 L 26 -9 L 12 10 Z" fill="#efe5d5" stroke={ink} strokeWidth="1.2" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

function Leaves({ ink }: { ink: string }) {
  return (
    <svg viewBox="0 0 200 140" className="fgl-v fgl-v-leaves" aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i} className={`leaf l${i}`}>
          <path d="M0 -10 C 7 -5, 7 5, 0 10 C -7 5, -7 -5, 0 -10 Z" fill={['#8aa65a', '#c9a24a', '#b86b33', '#6f9346', '#d4b560'][i]} />
          <path d="M0 -9 L 0 12" stroke={ink} strokeOpacity="0.35" strokeWidth="0.8" />
        </g>
      ))}
    </svg>
  );
}

function EnvelopeV({ ink, accent }: { ink: string; accent: string }) {
  return (
    <svg viewBox="0 0 200 140" className="fgl-v fgl-v-envelope" aria-hidden>
      <rect x="45" y="40" width="110" height="72" rx="3" fill="#fffaf2" stroke={ink} strokeOpacity="0.4" />
      <path d="M45 112 L 100 76 L 155 112" fill="none" stroke={ink} strokeOpacity="0.25" />
      <path className="flap" d="M45 40 L 100 82 L 155 40 Z" fill="#f6eee2" stroke={ink} strokeOpacity="0.4" strokeLinejoin="round" />
      <circle className="dot" cx="100" cy="80" r="8" fill={accent} />
    </svg>
  );
}

function Dandelion({ ink }: { ink: string }) {
  return (
    <svg viewBox="0 0 200 140" className="fgl-v fgl-v-dandelion" aria-hidden>
      <path d="M100 138 C 98 110, 104 90, 100 64" stroke={ink} strokeOpacity="0.6" strokeWidth="1.6" fill="none" />
      <circle cx="100" cy="62" r="3" fill={ink} opacity="0.6" />
      {Array.from({ length: 18 }, (_, i) => {
        const a = (i / 18) * Math.PI * 2;
        return (
          <g key={i} className={`seed s${i % 6}`} style={{ ['--a' as string]: `${a}rad` }} transform={`translate(100 62) rotate(${(a * 180) / Math.PI})`}>
            <line x1="0" y1="0" x2="0" y2="-22" stroke={ink} strokeOpacity="0.45" strokeWidth="0.8" />
            <g transform="translate(0 -22)">
              {[-40, -20, 0, 20, 40].map((r) => (
                <line key={r} x1="0" y1="0" x2="0" y2="-6" stroke={ink} strokeOpacity="0.35" strokeWidth="0.6" transform={`rotate(${r})`} />
              ))}
            </g>
          </g>
        );
      })}
    </svg>
  );
}

export function Loader({ hidden }: { hidden: boolean }) {
  const form = useExperience((s) => s.form);
  const progress = useExperience((s) => s.progress);
  const label = useExperience((s) => s.progressLabel);
  const reduced = useExperience((s) => s.reducedMotion);
  const theme = form?.theme;
  const env = envConfig(theme?.environment);
  const VIGNETTES = env.vignettes;
  const style: LoaderStyle = theme?.loaderStyle ?? 'mixed';
  const [idx, setIdx] = useState(0);
  const [quote, setQuote] = useState(env.quotes[0]);
  useEffect(() => setQuote(env.quotes[Math.floor(Math.random() * env.quotes.length)]), [env]);

  useEffect(() => {
    if (style !== 'mixed' || reduced) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % VIGNETTES.length), 2600);
    return () => clearInterval(t);
  }, [style, reduced, VIGNETTES.length]);

  // a specific loader style shows that vignette only when it belongs to this world
  const active: Vignette = style === 'mixed' || style === 'minimal' || !VIGNETTES.includes(style as Vignette) ? VIGNETTES[idx] : (style as Vignette);
  const ink = theme?.inkColor ?? '#2b2320';
  const accent = theme?.sealColor ?? '#8e1b1b';
  // the bar eases toward the real progress and keeps creeping a little while a step runs,
  // so the loader never looks stuck
  const [shown, setShown] = useState(0);
  const target = useRef(0);
  target.current = progress;
  useEffect(() => {
    if (hidden) return;
    const t = setInterval(() => {
      setShown((v) => {
        const goal = target.current;
        if (goal >= 1) return v + (1 - v) * 0.35;
        const cap = Math.min(0.985, goal + 0.05);
        const next = v < goal ? v + (goal - v) * 0.22 : v + (cap - v) * 0.012;
        return Math.min(cap, next);
      });
    }, 110);
    return () => clearInterval(t);
  }, [hidden]);
  const pct = Math.round(Math.min(1, shown) * 100);

  return (
    <div className={`fgl-loader${hidden ? ' is-hidden' : ''}`} style={{ background: theme?.loaderColor ?? '#f3e9dc', color: ink }} role="status" aria-live="polite" aria-busy={!hidden}>
      <Stage vignettes={VIGNETTES} active={active} ink={ink} accent={accent} show={style !== 'minimal'} />
      <p className="fgl-loader-quote">{quote}</p>
      <div className="fgl-loader-progress" aria-hidden>
        <svg viewBox="0 0 240 12" preserveAspectRatio="none">
          <path d="M2 7 C 40 3, 80 10, 120 6 S 200 3, 238 7" fill="none" stroke={ink} strokeOpacity="0.14" strokeWidth="2" strokeLinecap="round" />
          <path
            d="M2 7 C 40 3, 80 10, 120 6 S 200 3, 238 7"
            fill="none"
            stroke={accent}
            strokeWidth="2.2"
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray="100"
            strokeDashoffset={100 - pct}
            style={{ transition: 'stroke-dashoffset 0.25s linear' }}
          />
        </svg>
        {/* runs on the compositor: keeps moving even if the page is briefly busy */}
        <span className="fgl-loader-glint" style={{ background: accent }} />
      </div>
      <p className="fgl-loader-label">
        <span>{label}…</span> <span className="pct">{pct}%</span>
      </p>
      <span className="sr-only">Loading {pct} percent</span>
    </div>
  );
}

/** the drawings: memoised so the ticking progress bar doesn't re-render them */
const Stage = memo(function Stage({ vignettes: VIGNETTES, active, ink, accent, show }: { vignettes: Vignette[]; active: Vignette; ink: string; accent: string; show: boolean }) {
  return (
      <div className="fgl-loader-stage">
        {show &&
          VIGNETTES.map((v) => (
            <div key={v} className={`fgl-loader-vignette${v === active ? ' is-active' : ''}`}>
              {v === 'ink' && <Ink ink={ink} />}
              {v === 'stamp' && <Stamp ink={ink} accent={accent} />}
              {v === 'plane' && <Plane ink={ink} />}
              {v === 'leaves' && <Leaves ink={ink} />}
              {v === 'envelope' && <EnvelopeV ink={ink} accent={accent} />}
              {v === 'dandelion' && <Dandelion ink={ink} />}
              {v === 'waves' && <Waves ink={ink} accent={accent} />}
              {v === 'bottle' && <Bottle ink={ink} accent={accent} />}
              {v === 'shell' && <Shell ink={ink} accent={accent} />}
              {v === 'gull' && <Gull ink={ink} accent={accent} />}
              {v === 'lighthouse' && <Lighthouse ink={ink} accent={accent} />}
              {v === 'sunrise' && <Sunrise ink={ink} accent={accent} />}
              {v === 'typewriter' && <Typewriter ink={ink} accent={accent} />}
              {v === 'candle' && <Candle ink={ink} accent={accent} />}
              {v === 'teacup' && <Teacup ink={ink} accent={accent} />}
              {v === 'clock' && <Clock ink={ink} accent={accent} />}
              {v === 'balloon' && <Balloon ink={ink} accent={accent} />}
              {v === 'clouds' && <Clouds ink={ink} accent={accent} />}
              {v === 'hotair' && <HotAir ink={ink} accent={accent} />}
              {v === 'kite' && <Kite ink={ink} accent={accent} />}
            </div>
          ))}
      </div>
  );
});
