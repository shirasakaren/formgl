import type { EnvironmentKey } from '@formgl/shared';
import { cn } from '@/lib/admin/utils';
import { EnvelopeSwatch } from './EnvelopeSwatch';

interface Props {
  world?: EnvironmentKey;
  envelope: string;
  seal: string;
  paper?: string;
  accent?: string;
  logoUrl?: string;
  monogram?: string;
  className?: string;
}

/** A small drawing of the form's vessel in its world — envelope, bottle, tied letter, balloons or lantern. */
export function WorldSwatch({ world = 'park', envelope, seal, paper = '#fbf7ef', accent = '#8e1b1b', logoUrl, monogram, className }: Props) {
  if (world === 'park') return <EnvelopeSwatch envelope={envelope} seal={seal} paper={paper} logoUrl={logoUrl} monogram={monogram} className={className} />;
  if (world === 'seaside')
    return (
      <svg viewBox="0 0 140 80" className={cn('overflow-visible', className)} aria-hidden>
        <path d="M-10 62 C 20 56, 40 66, 70 60 S 120 56, 150 62 L150 90 L-10 90 Z" fill="#e9d9b8" />
        <path d="M-10 58 C 15 54, 35 60, 60 57" fill="none" stroke="#fff" strokeOpacity=".8" strokeWidth="2" strokeLinecap="round" />
        <ellipse cx="72" cy="61" rx="44" ry="4" fill="#000" opacity=".12" />
        <g transform="rotate(-8 70 48)">
          <path d="M22 40 h70 c8 0 12 3 16 6 h12 v8 h-12 c-4 3 -8 6 -16 6 h-70 a10 10 0 0 1 0 -20 z" fill="#d6ece6" fillOpacity=".75" stroke="#7fa9a0" strokeOpacity=".7" />
          <rect x="120" y="44" width="10" height="12" rx="2" fill="#b98a5c" />
          <rect x="30" y="44" width="58" height="12" rx="6" fill={paper} stroke="#c8b99c" strokeWidth=".6" />
          <rect x="54" y="43" width="4" height="14" fill={accent} />
          <path d="M34 42 C 60 38, 90 40, 104 43" fill="none" stroke="#fff" strokeOpacity=".9" strokeWidth="1.5" strokeLinecap="round" />
        </g>
      </svg>
    );
  if (world === 'atelier')
    return (
      <svg viewBox="0 0 140 80" className={cn('overflow-visible', className)} aria-hidden>
        <rect x="-10" y="58" width="160" height="30" fill="#a8744a" />
        <rect x="-10" y="58" width="160" height="3" fill="#c49069" />
        <g transform="rotate(-6 70 50)">
          <rect x="38" y="30" width="64" height="40" rx="2" fill={paper} stroke="#d8ccb8" />
          <rect x="38" y="47" width="64" height="5" fill={accent} opacity=".9" />
          <rect x="61" y="30" width="5" height="40" fill={accent} opacity=".9" />
          <path d="M63 50 c -10 -8 -16 -2 -8 4 M64 50 c 10 -8 16 -2 8 4" fill="none" stroke={accent} strokeWidth="3" strokeLinecap="round" />
          <circle cx="63.5" cy="50" r="5" fill={seal} />
          <circle cx="86" cy="38" r="4" fill="#a58ad0" />
          <circle cx="86" cy="38" r="1.5" fill="#f3d25c" />
        </g>
        <path d="M108 58 v-18 h8 v18" fill="#27313a" />
        <path d="M113 40 C 118 20, 126 10, 132 4" stroke="#efe6d2" strokeWidth="2" fill="none" />
      </svg>
    );
  if (world === 'lantern')
    return (
      <svg viewBox="0 0 140 80" className={cn('overflow-visible', className)} aria-hidden>
        <rect x="-10" y="-10" width="160" height="100" rx="6" fill="#141a2e" />
        <circle cx="26" cy="16" r="7" fill="#eef0f8" />
        <circle cx="29" cy="14" r="7" fill="#141a2e" />
        {[[50, 10], [92, 6], [120, 18], [70, 22], [110, 30]].map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r=".9" fill="#fff" opacity=".7" />
        ))}
        <rect x="-10" y="54" width="160" height="36" fill="#0b1020" />
        <ellipse cx="70" cy="64" rx="6" ry="14" fill="#f0a24f" opacity=".25" />
        <circle cx="112" cy="40" r="2" fill="#ffc47a" opacity=".85" />
        <circle cx="30" cy="46" r="1.6" fill="#ffc47a" opacity=".7" />
        <circle cx="70" cy="44" r="16" fill="#ffb35c" opacity=".22" />
        <rect x="60" y="34" width="20" height="22" rx="1.5" fill={paper} />
        <rect x="60" y="34" width="20" height="22" rx="1.5" fill="#ff9a3c" opacity=".45" />
        <rect x="60" y="34" width="20" height="2.5" fill={seal} />
        <rect x="58" y="55" width="24" height="3.5" rx="1" fill="#3b2b20" />
        <path d="M70 42 c 2.5 3 2.5 6 0 7.5 c -2.5 -1.5 -2.5 -4.5 0 -7.5z" fill="#fff4c8" />
        <path d="M56 62 Q 70 60 84 62" stroke="#ffc47a" strokeOpacity=".5" fill="none" />
      </svg>
    );
  // skies
  return (
    <svg viewBox="0 0 140 80" className={cn('overflow-visible', className)} aria-hidden>
      <ellipse cx="30" cy="70" rx="40" ry="10" fill="#fff" opacity=".8" />
      <ellipse cx="110" cy="72" rx="44" ry="10" fill="#fff" opacity=".8" />
      {[
        [58, 18, '#f4b6c2'],
        [74, 12, '#cdb4db'],
        [88, 20, '#fde2a7'],
        [70, 26, accent],
      ].map(([x, y, c], i) => (
        <g key={i}>
          <path d={`M${x} ${Number(y) + 13} L 72 56`} stroke="#fff" strokeWidth=".8" />
          <ellipse cx={x} cy={y} rx="9" ry="11" fill={String(c)} />
          <ellipse cx={Number(x) - 3} cy={Number(y) - 4} rx="2" ry="3" fill="#fff" opacity=".55" />
        </g>
      ))}
      <rect x="56" y="54" width="32" height="7" rx="3.5" fill={paper} stroke="#c8b99c" strokeWidth=".6" />
      <rect x="70" y="53" width="4" height="9" fill={seal} />
    </svg>
  );
}
