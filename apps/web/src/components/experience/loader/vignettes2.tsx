'use client';
/* Loader vignettes for the seaside, atelier and skies environments. */
type P = { ink: string; accent: string };

export function Waves({ ink, accent }: P) {
  return (
    <svg viewBox="0 0 200 140" className="fgl-v fgl-v-waves" aria-hidden>
      <circle cx="140" cy="46" r="16" fill={accent} opacity="0.18" />
      {[0, 1, 2].map((i) => (
        <path
          key={i}
          className={`w w${i}`}
          d="M-60 0 Q -45 -10 -30 0 T 0 0 T 30 0 T 60 0 T 90 0 T 120 0 T 150 0 T 180 0 T 210 0 T 240 0 T 270 0"
          transform={`translate(0 ${78 + i * 16})`}
          fill="none"
          stroke={i === 0 ? accent : ink}
          strokeOpacity={i === 0 ? 0.8 : 0.35 - i * 0.08}
          strokeWidth={2.2 - i * 0.5}
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}

export function Bottle({ ink, accent }: P) {
  return (
    <svg viewBox="0 0 200 140" className="fgl-v fgl-v-bottle" aria-hidden>
      <g className="bob">
        <g transform="translate(100 70) rotate(-72)">
          <path d="M-12 -34 L -12 18 Q -12 30 0 30 Q 12 30 12 18 L 12 -34 Q 12 -40 5 -44 L 5 -56 L -5 -56 L -5 -44 Q -12 -40 -12 -34 Z" fill="#e8f4f2" stroke={ink} strokeOpacity="0.5" strokeWidth="1.4" />
          <rect x="-4.5" y="-64" width="9" height="9" rx="2" fill="#b98b5e" />
          <rect x="-7" y="-20" width="14" height="30" rx="7" fill="#f3e7cf" stroke={ink} strokeOpacity="0.25" />
          <line x1="-7" y1="-5" x2="7" y2="-5" stroke={accent} strokeWidth="2" />
        </g>
      </g>
      <path className="sea" d="M0 96 Q 25 88 50 96 T 100 96 T 150 96 T 200 96 T 250 96" fill="none" stroke={accent} strokeOpacity="0.6" strokeWidth="2" />
    </svg>
  );
}

export function Shell({ ink, accent }: P) {
  return (
    <svg viewBox="0 0 200 140" className="fgl-v fgl-v-shell" aria-hidden>
      <path className="spiral" d="M100 70 m0 0 a4 4 0 0 1 6 2 a8 8 0 0 1 -8 10 a13 13 0 0 1 -14 -14 a19 19 0 0 1 20 -19 a26 26 0 0 1 26 26 a34 34 0 0 1 -34 34" fill="none" stroke={ink} strokeWidth="2.2" strokeLinecap="round" />
      <circle className="pearl" cx="132" cy="96" r="4" fill={accent} />
    </svg>
  );
}

export function Gull({ ink }: P) {
  return (
    <svg viewBox="0 0 200 140" className="fgl-v fgl-v-gull" aria-hidden>
      {[0, 1].map((i) => (
        <g key={i} className={`g g${i}`}>
          <path className="wing" d="M-14 0 Q -7 -8 0 0 Q 7 -8 14 0" fill="none" stroke={ink} strokeWidth="2" strokeLinecap="round" />
        </g>
      ))}
      <path d="M20 118 Q 60 112 100 118 T 180 118" fill="none" stroke={ink} strokeOpacity="0.2" />
    </svg>
  );
}

export function Lighthouse({ ink, accent }: P) {
  return (
    <svg viewBox="0 0 200 140" className="fgl-v fgl-v-lighthouse" aria-hidden>
      <g className="beam">
        <path d="M100 38 L 190 20 L 190 56 Z" fill={accent} opacity="0.16" />
        <path d="M100 38 L 10 20 L 10 56 Z" fill={accent} opacity="0.16" />
      </g>
      <path d="M88 124 L 94 44 L 106 44 L 112 124 Z" fill="#fffaf2" stroke={ink} strokeOpacity="0.5" />
      <path d="M90 96 L 110 96 M 91.5 76 L 108.5 76 M 93 58 L 107 58" stroke={accent} strokeWidth="4" />
      <rect x="92" y="32" width="16" height="12" rx="2" fill="#fff3c4" stroke={ink} strokeOpacity="0.5" />
      <path d="M90 32 L 100 22 L 110 32 Z" fill={ink} opacity="0.8" />
      <path d="M40 124 Q 100 116 160 124" fill="none" stroke={ink} strokeOpacity="0.25" strokeWidth="2" />
    </svg>
  );
}

export function Sunrise({ ink, accent }: P) {
  return (
    <svg viewBox="0 0 200 140" className="fgl-v fgl-v-sunrise" aria-hidden>
      <clipPath id="fgl-sr"><rect x="0" y="0" width="200" height="96" /></clipPath>
      <g clipPath="url(#fgl-sr)">
        <g className="sun">
          <circle cx="100" cy="100" r="22" fill={accent} opacity="0.85" />
          {Array.from({ length: 10 }, (_, i) => (
            <line key={i} x1="100" y1="64" x2="100" y2="54" stroke={accent} strokeWidth="2.4" strokeLinecap="round" transform={`rotate(${-90 + i * 20} 100 100)`} />
          ))}
        </g>
      </g>
      <line x1="30" y1="96" x2="170" y2="96" stroke={ink} strokeOpacity="0.5" strokeWidth="1.6" />
      <line x1="55" y1="106" x2="145" y2="106" stroke={ink} strokeOpacity="0.25" strokeWidth="1.2" />
    </svg>
  );
}

export function Typewriter({ ink, accent }: P) {
  return (
    <svg viewBox="0 0 200 140" className="fgl-v fgl-v-typewriter" aria-hidden>
      <rect x="62" y="18" width="76" height="46" rx="2" fill="#fffaf2" stroke={ink} strokeOpacity="0.3" />
      {[0, 1, 2].map((r) => (
        <g key={r} className={`line l${r}`}>
          {Array.from({ length: 9 }, (_, i) => (
            <rect key={i} className="ch" x={70 + i * 6.6} y={28 + r * 10} width="4.4" height="2.4" rx="0.8" fill={ink} opacity="0.7" style={{ animationDelay: `${r * 0.8 + i * 0.08}s` }} />
          ))}
        </g>
      ))}
      <rect x="40" y="62" width="120" height="16" rx="5" fill={ink} opacity="0.85" />
      <rect x="48" y="78" width="104" height="36" rx="8" fill={ink} opacity="0.92" />
      {Array.from({ length: 3 }, (_, r) =>
        Array.from({ length: 8 }, (_, i) => (
          <circle key={`${r}-${i}`} className="key" cx={62 + i * 11 + (r % 2) * 5} cy={86 + r * 9} r="3.2" fill="#fffaf2" opacity="0.9" style={{ animationDelay: `${(i * 3 + r * 5) % 11 * 0.13}s` }} />
        )),
      )}
      <rect x="34" y="64" width="8" height="10" rx="2" fill={accent} />
    </svg>
  );
}

export function Candle({ ink, accent }: P) {
  return (
    <svg viewBox="0 0 200 140" className="fgl-v fgl-v-candle" aria-hidden>
      <circle className="glow" cx="100" cy="44" r="34" fill="#ffcf7a" opacity="0.22" />
      <path className="flame" d="M100 26 C 108 38, 108 50, 100 56 C 92 50, 92 38, 100 26 Z" fill="#ffb347" />
      <path className="flame inner" d="M100 38 C 104 44, 104 50, 100 54 C 96 50, 96 44, 100 38 Z" fill="#fff4c8" />
      <line x1="100" y1="56" x2="100" y2="62" stroke={ink} strokeWidth="1.6" />
      <rect x="88" y="62" width="24" height="46" rx="3" fill="#fffaf2" stroke={ink} strokeOpacity="0.3" />
      <path d="M88 70 Q 94 76 92 84" stroke="#f1e6d3" strokeWidth="3" fill="none" />
      <ellipse cx="100" cy="112" rx="30" ry="6" fill={accent} opacity="0.7" />
    </svg>
  );
}

export function Teacup({ ink, accent }: P) {
  return (
    <svg viewBox="0 0 200 140" className="fgl-v fgl-v-teacup" aria-hidden>
      {[0, 1, 2].map((i) => (
        <path key={i} className={`steam s${i}`} d={`M${90 + i * 10} 60 C ${84 + i * 10} 50, ${98 + i * 10} 42, ${90 + i * 10} 30`} fill="none" stroke={ink} strokeOpacity="0.35" strokeWidth="2" strokeLinecap="round" />
      ))}
      <path d="M68 66 L 132 66 Q 130 100 100 102 Q 70 100 68 66 Z" fill="#fffaf2" stroke={ink} strokeOpacity="0.45" strokeWidth="1.4" />
      <path d="M130 72 Q 146 72 144 84 Q 142 94 126 92" fill="none" stroke={ink} strokeOpacity="0.45" strokeWidth="3" />
      <path d="M74 76 Q 100 82 126 76" stroke={accent} strokeWidth="2.4" fill="none" />
      <ellipse cx="100" cy="106" rx="46" ry="7" fill="none" stroke={ink} strokeOpacity="0.4" strokeWidth="1.4" />
    </svg>
  );
}

export function Clock({ ink, accent }: P) {
  return (
    <svg viewBox="0 0 200 140" className="fgl-v fgl-v-clock" aria-hidden>
      <circle cx="100" cy="70" r="42" fill="#fffaf2" stroke={ink} strokeOpacity="0.5" strokeWidth="2" />
      {Array.from({ length: 12 }, (_, i) => (
        <line key={i} x1="100" y1="32" x2="100" y2={i % 3 ? 36 : 39} stroke={ink} strokeOpacity="0.6" strokeWidth={i % 3 ? 1.2 : 2} transform={`rotate(${i * 30} 100 70)`} />
      ))}
      <line className="hour" x1="100" y1="70" x2="100" y2="48" stroke={ink} strokeWidth="3" strokeLinecap="round" />
      <line className="minute" x1="100" y1="70" x2="100" y2="38" stroke={accent} strokeWidth="2" strokeLinecap="round" />
      <circle cx="100" cy="70" r="3" fill={ink} />
    </svg>
  );
}

export function Balloon({ ink, accent }: P) {
  return (
    <svg viewBox="0 0 200 140" className="fgl-v fgl-v-balloon" aria-hidden>
      {[0, 1, 2].map((i) => (
        <g key={i} className={`b b${i}`}>
          <path d="M0 -26 C 16 -26, 18 -4, 0 6 C -18 -4, -16 -26, 0 -26 Z" fill={[accent, '#f2c14e', '#8fc1d4'][i]} opacity="0.92" />
          <path d="M-5 -18 Q -8 -12 -6 -6" stroke="#fff" strokeOpacity="0.6" strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d="M0 6 L -2 10 L 2 10 Z" fill={[accent, '#f2c14e', '#8fc1d4'][i]} />
          <path d="M0 10 C 4 22, -4 30, 0 44" stroke={ink} strokeOpacity="0.45" fill="none" />
        </g>
      ))}
    </svg>
  );
}

export function Clouds({ ink }: P) {
  const cloud = 'M0 0 a12 12 0 0 1 20 -8 a16 16 0 0 1 30 4 a11 11 0 0 1 10 18 L 2 14 a8 8 0 0 1 -2 -14 Z';
  return (
    <svg viewBox="0 0 200 140" className="fgl-v fgl-v-clouds" aria-hidden>
      {[0, 1, 2].map((i) => (
        <path key={i} className={`c c${i}`} d={cloud} fill="#fffaf2" stroke={ink} strokeOpacity="0.25" strokeWidth="1.2" />
      ))}
    </svg>
  );
}

export function HotAir({ ink, accent }: P) {
  return (
    <svg viewBox="0 0 200 140" className="fgl-v fgl-v-hotair" aria-hidden>
      <g className="float">
        <path d="M100 14 C 132 14, 140 48, 118 74 L 82 74 C 60 48, 68 14, 100 14 Z" fill={accent} opacity="0.9" />
        <path d="M100 14 C 112 14, 116 48, 108 74 L 92 74 C 84 48, 88 14, 100 14 Z" fill="#fffaf2" opacity="0.85" />
        <path d="M84 74 L 92 92 M 116 74 L 108 92" stroke={ink} strokeOpacity="0.5" />
        <rect x="90" y="92" width="20" height="14" rx="2" fill="#b98b5e" stroke={ink} strokeOpacity="0.4" />
      </g>
      <path className="cl" d="M30 122 a10 10 0 0 1 18 -6 a13 13 0 0 1 24 6 Z" fill="#fffaf2" stroke={ink} strokeOpacity="0.2" />
      <path className="cl two" d="M130 118 a9 9 0 0 1 16 -5 a12 12 0 0 1 22 5 Z" fill="#fffaf2" stroke={ink} strokeOpacity="0.2" />
    </svg>
  );
}

export function Kite({ ink, accent }: P) {
  return (
    <svg viewBox="0 0 200 140" className="fgl-v fgl-v-kite" aria-hidden>
      <g className="kite">
        <path d="M0 -24 L 16 0 L 0 30 L -16 0 Z" fill={accent} opacity="0.9" />
        <path d="M0 -24 L 0 30 M -16 0 L 16 0" stroke="#fffaf2" strokeOpacity="0.8" />
        <path className="tail" d="M0 30 C 8 42, -8 52, 4 64 C 12 72, -4 82, 6 92" fill="none" stroke={ink} strokeOpacity="0.5" />
      </g>
      <path className="string" d="M100 70 Q 60 110 20 134" fill="none" stroke={ink} strokeOpacity="0.3" />
    </svg>
  );
}

export function LanternV({ ink, accent }: P) {
  return (
    <svg viewBox="0 0 200 140" className="fgl-v fgl-v-lantern" aria-hidden>
      <path className="ripple r0" d="M50 116 Q 100 110 150 116" fill="none" stroke={ink} strokeOpacity="0.3" strokeWidth="1.2" strokeLinecap="round" />
      <path className="ripple r1" d="M64 124 Q 100 120 136 124" fill="none" stroke={ink} strokeOpacity="0.2" strokeWidth="1.2" strokeLinecap="round" />
      <g className="lan">
        <circle className="halo" cx="100" cy="74" r="42" fill="#ffb35c" opacity="0.2" />
        <rect x="80" y="54" width="40" height="46" rx="2" fill="#ffd08a" stroke={ink} strokeOpacity="0.5" strokeWidth="1.2" />
        <rect x="80" y="54" width="40" height="46" rx="2" fill="url(#fgl-lan-g)" />
        <line x1="100" y1="54" x2="100" y2="100" stroke={ink} strokeOpacity="0.25" />
        <rect x="80" y="54" width="40" height="3" fill={accent} />
        <rect x="76" y="100" width="48" height="6" rx="1" fill={ink} opacity="0.7" />
        <path className="flame" d="M100 78 C 104 84, 104 90, 100 93 C 96 90, 96 84, 100 78 Z" fill="#fff4c8" />
      </g>
      <defs>
        <radialGradient id="fgl-lan-g" cx="0.5" cy="0.72" r="0.6">
          <stop offset="0" stopColor="#fff2c4" stopOpacity="0.9" />
          <stop offset="1" stopColor="#e98a3a" stopOpacity="0.2" />
        </radialGradient>
      </defs>
    </svg>
  );
}

export function MoonV({ ink }: P) {
  return (
    <svg viewBox="0 0 200 140" className="fgl-v fgl-v-moon" aria-hidden>
      {[
        [40, 30, 1.4], [150, 22, 1.1], [168, 64, 1.6], [26, 78, 1], [70, 16, 1], [128, 90, 1.2],
      ].map(([x, y, r], i) => (
        <circle key={i} className={`star s${i % 3}`} cx={x} cy={y} r={r} fill={ink} />
      ))}
      <g className="moon">
        <circle cx="100" cy="60" r="30" fill="#f4efe2" opacity="0.18" />
        <circle cx="100" cy="60" r="22" fill="#f4efe2" />
        <circle cx="108" cy="54" r="22" fill="currentColor" className="shade" />
      </g>
      <path d="M40 112 C 70 108, 130 116, 160 110" fill="none" stroke={ink} strokeOpacity="0.25" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export function FirefliesV({ ink }: P) {
  return (
    <svg viewBox="0 0 200 140" className="fgl-v fgl-v-fireflies" aria-hidden>
      {[60, 72, 84, 118, 130, 142].map((x, i) => (
        <path key={x} d={`M${x} 132 C ${x - 4} 110, ${x + 3} 96, ${x - 2 + (i % 2) * 6} ${80 + (i % 3) * 8}`} fill="none" stroke={ink} strokeOpacity="0.45" strokeWidth="1.4" strokeLinecap="round" />
      ))}
      {Array.from({ length: 9 }, (_, i) => (
        <g key={i} className={`fly f${i % 5}`} style={{ translate: `${40 + ((i * 53) % 120)}px ${30 + ((i * 37) % 60)}px` }}>
          <circle r="7" fill="#f7e27a" opacity="0.25" />
          <circle r="2.2" fill="#fff6b8" />
        </g>
      ))}
    </svg>
  );
}
