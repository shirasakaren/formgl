import { cn } from '@/lib/admin/utils';

/** Small SVG envelope used on cards and previews */
export function EnvelopeSwatch({ envelope, seal, paper, liner, className, monogram, logoUrl }: { envelope: string; seal: string; paper?: string; liner?: string; className?: string; monogram?: string; logoUrl?: string }) {
  return (
    <svg viewBox="0 0 120 80" className={cn('drop-shadow-[0_6px_10px_rgba(60,40,20,.22)]', className)} aria-hidden>
      <rect x="1" y="1" width="118" height="78" rx="4" fill={envelope} />
      {paper && <rect x="12" y="6" width="96" height="30" rx="2" fill={paper} opacity="0.9" />}
      <path d="M1 5 L60 46 L119 5 L119 1 L1 1 Z" fill={liner ?? envelope} opacity={liner ? 0.9 : 1} />
      <path d="M1 5 L60 46 L119 5" fill="none" stroke="rgba(0,0,0,.12)" strokeWidth="1" />
      <path d="M1 79 L48 40 M119 79 L72 40" stroke="rgba(0,0,0,.08)" strokeWidth="1" />
      <circle cx="60" cy="45" r="10" fill={seal} />
      <circle cx="60" cy="45" r="7" fill="none" stroke="rgba(255,255,255,.28)" strokeWidth="1" />
      {logoUrl ? (
        <>
          <clipPath id="seal-clip">
            <circle cx="60" cy="45" r="6.5" />
          </clipPath>
          <image href={logoUrl} x="53.5" y="38.5" width="13" height="13" clipPath="url(#seal-clip)" preserveAspectRatio="xMidYMid slice" opacity="0.85" />
        </>
      ) : (
        monogram && (
          <text x="60" y="49.5" textAnchor="middle" fontSize="11" fill="rgba(255,255,255,.75)" fontFamily="'Pinyon Script', cursive">
            {monogram.slice(0, 2)}
          </text>
        )
      )}
    </svg>
  );
}
