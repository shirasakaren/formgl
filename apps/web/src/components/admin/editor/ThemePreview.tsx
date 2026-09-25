'use client';

import { FONT_FAMILIES, type FormTheme, type PaperKind, type TimeOfDay } from '@formgl/shared';

export const SKY: Record<TimeOfDay, [string, string, string]> = {
  morning: ['#bfe0f0', '#fde8d0', 'Morning'],
  noon: ['#9fd0f5', '#f4f9fc', 'Noon'],
  golden: ['#f6c27f', '#f28f5e', 'Golden hour'],
  dusk: ['#5e5391', '#f09b7d', 'Dusk'],
  overcast: ['#b9bec6', '#e9e7e2', 'Overcast'],
};

export const PAPER_TEXTURE: Record<PaperKind, string> = {
  cotton: 'radial-gradient(rgba(0,0,0,.035) 1px, transparent 1px)',
  laid: 'repeating-linear-gradient(0deg, rgba(0,0,0,.04) 0 1px, transparent 1px 4px)',
  linen: 'repeating-linear-gradient(0deg, rgba(0,0,0,.03) 0 1px, transparent 1px 3px), repeating-linear-gradient(90deg, rgba(0,0,0,.03) 0 1px, transparent 1px 3px)',
  kraft: 'radial-gradient(rgba(90,60,20,.12) 1px, transparent 1.5px)',
  parchment: 'radial-gradient(circle at 30% 20%, rgba(160,120,60,.14), transparent 60%), radial-gradient(circle at 80% 90%, rgba(160,120,60,.12), transparent 55%)',
  watercolor: 'radial-gradient(circle at 20% 30%, rgba(180,140,200,.12), transparent 45%), radial-gradient(circle at 75% 70%, rgba(120,170,200,.12), transparent 45%)',
};

export const font = (k: string) => FONT_FAMILIES[k]?.css ?? 'inherit';

function ruling(r: FormTheme['ruling'], ink: string) {
  const c = `${ink}22`;
  if (r === 'lined') return `repeating-linear-gradient(0deg, ${c} 0 1px, transparent 1px 26px)`;
  if (r === 'dotted') return `radial-gradient(${c} 1px, transparent 1.2px)`;
  if (r === 'grid') return `linear-gradient(${c} 1px, transparent 1px), linear-gradient(90deg, ${c} 1px, transparent 1px)`;
  return 'none';
}

export function ThemePreview({ theme, title }: { theme: FormTheme; title: string }) {
  const [top, bottom] = SKY[theme.timeOfDay] ?? SKY.golden;
  const monogram = (theme.sealMonogram || title || 'F').slice(0, 2);
  const inputStyle: React.CSSProperties =
    theme.inputStyle === 'underline'
      ? { borderBottom: `1.5px solid ${theme.inkColor}55`, borderRadius: 0 }
      : theme.inputStyle === 'boxed'
        ? { border: `1.5px solid ${theme.inkColor}40`, borderRadius: theme.inputRadius, background: '#ffffff80' }
        : { background: `${theme.inkColor}0d`, borderRadius: theme.inputRadius };

  return (
    <div className="space-y-3">
      {/* Envelope scene */}
      <div className="relative overflow-hidden rounded-xl p-5 pt-6" style={{ background: `linear-gradient(170deg, ${top}, ${bottom})` }}>
        {theme.coverImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={theme.coverImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />
        )}
        <div className="relative mx-auto aspect-[3/2] w-full max-w-[300px]">
          <div className="absolute inset-0 rounded-md shadow-[0_18px_30px_-12px_rgba(40,20,10,.45)]" style={{ background: theme.envelopeColor, backgroundImage: PAPER_TEXTURE[theme.envelopePaper], backgroundSize: '6px 6px' }} />
          <div className="absolute inset-x-0 top-0 h-[58%] [clip-path:polygon(0_0,100%_0,50%_100%)]" style={{ background: theme.linerColor }} />
          <div className="absolute inset-x-[3px] top-0 h-[55%] [clip-path:polygon(0_0,100%_0,50%_100%)]" style={{ background: theme.envelopeColor, backgroundImage: PAPER_TEXTURE[theme.envelopePaper], backgroundSize: '6px 6px', opacity: 0.94 }} />
          <div className="absolute top-[46%] left-1/2 grid size-12 -translate-x-1/2 place-items-center overflow-hidden rounded-full shadow-[0_3px_0_rgba(0,0,0,.25),0_8px_14px_-4px_rgba(0,0,0,.4)]" style={{ background: theme.sealColor }}>
            {theme.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={theme.logoUrl} alt="" className="size-8 rounded-full object-cover opacity-90" />
            ) : (
              <span className="text-xl text-white/80" style={{ fontFamily: font('script') }}>
                {monogram}
              </span>
            )}
          </div>
          <div className="absolute inset-x-3 bottom-3 text-center">
            <p className="truncate text-[26px] leading-tight" style={{ fontFamily: font(theme.titleFont), color: theme.inkColor }}>
              {theme.envelopeTitle || title || 'Your letter'}
            </p>
            {theme.envelopeSubtitle && (
              <p className="truncate text-xs" style={{ fontFamily: font(theme.bodyFont), color: `${theme.inkColor}bb` }}>
                {theme.envelopeSubtitle}
              </p>
            )}
          </div>
        </div>
        {theme.openHint && (
          <p className="relative mx-auto mt-3 w-fit rounded-full bg-white/80 px-2.5 py-0.5 text-[11px] text-[#2b2320] shadow-sm backdrop-blur">{theme.openHint}</p>
        )}
      </div>

      {/* Paper swatch */}
      <div
        className="relative overflow-hidden rounded-xl p-5 shadow-[0_10px_24px_-14px_rgba(40,20,10,.4)] ring-1 ring-black/5"
        style={{
          background: theme.paperColor,
          backgroundImage: `${ruling(theme.ruling, theme.inkColor) !== 'none' ? ruling(theme.ruling, theme.inkColor) + ', ' : ''}${PAPER_TEXTURE[theme.paper]}`,
          backgroundSize: theme.ruling === 'grid' ? '20px 20px, 20px 20px, 5px 5px' : theme.ruling === 'dotted' ? '14px 14px, 5px 5px' : 'auto, 5px 5px',
          color: theme.inkColor,
        }}
      >
        <p className="text-2xl" style={{ fontFamily: font(theme.titleFont) }}>
          Dear friend,
        </p>
        <p className="mt-1 text-[15px] leading-snug" style={{ fontFamily: font(theme.bodyFont) }}>
          We would <mark style={{ background: theme.highlightColor, color: 'inherit', padding: '0 2px', borderRadius: 2 }}>love</mark> to hear from you.
        </p>
        <label className="mt-4 block text-[15px]" style={{ fontFamily: font(theme.labelFont) }}>
          What made you smile today?
        </label>
        <div className="mt-1.5 h-9 px-2.5 py-1.5 text-sm" style={{ ...inputStyle, fontFamily: font(theme.bodyFont), color: `${theme.inkColor}88` }}>
          A slow morning…
        </div>
        <div className="mt-3 flex gap-2">
          {['Yes', 'Maybe'].map((o, i) => (
            <span key={o} className="rounded-full px-3 py-1 text-xs" style={{ fontFamily: font(theme.bodyFont), background: i === 0 ? theme.accentColor : 'transparent', color: i === 0 ? '#fff' : theme.inkColor, border: `1px solid ${i === 0 ? theme.accentColor : theme.inkColor + '40'}` }}>
              {o}
            </span>
          ))}
        </div>
        <div className="mt-4 flex justify-end">
          <span className="rounded-md px-3 py-1.5 text-xs text-white" style={{ background: theme.accentColor, borderRadius: theme.inputRadius }}>
            Turn the page →
          </span>
        </div>
      </div>
    </div>
  );
}
