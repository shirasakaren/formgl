import Link from 'next/link';

export default function NotFound() {
  return (
    <main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24, background: 'radial-gradient(120% 90% at 30% 10%, #fff6e3 0%, #efe4cf 55%, #dccdb0 100%)', color: '#2b2320', textAlign: 'center' }}>
      <div>
        <p style={{ fontFamily: "'Pinyon Script', cursive", fontSize: 'clamp(48px, 12vw, 84px)', margin: 0, lineHeight: 1 }}>Lost in the wind</p>
        <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontStyle: 'italic', opacity: 0.75, maxWidth: 420, margin: '16px auto 28px' }}>
          This letter may have been moved, sealed away, or never written at all.
        </p>
        <Link href="/" style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, padding: '12px 22px', borderRadius: 999, background: '#2b2320', color: '#fffaf2', textDecoration: 'none' }}>
          Back to the park
        </Link>
      </div>
    </main>
  );
}
