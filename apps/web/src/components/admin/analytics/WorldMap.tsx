'use client';

import { useEffect, useMemo, useState } from 'react';
import { geoNaturalEarth1, geoPath, type GeoPermissibleObjects, type GeoProjection } from 'd3-geo';
import { feature } from 'topojson-client';
import { SEQ, fmtNum, seqColor } from '@/lib/admin/utils';

/** ISO alpha-2 → ISO numeric (world-atlas ids) for common countries; name matching is the fallback */
const A2N: Record<string, string> = {
  US: '840', CA: '124', MX: '484', BR: '076', AR: '032', GB: '826', FR: '250', DE: '276', ES: '724', IT: '380', NL: '528', BE: '056', CH: '756', AT: '040', SE: '752',
  NO: '578', DK: '208', FI: '246', IE: '372', PT: '620', PL: '616', CZ: '203', HU: '348', RO: '642', BG: '100', GR: '300', TR: '792', RU: '643', UA: '804', IN: '356',
  CN: '156', JP: '392', KR: '410', ID: '360', MY: '458', SG: '702', TH: '764', VN: '704', PH: '608', AU: '036', NZ: '554', ZA: '710', NG: '566', EG: '818', KE: '404',
  MA: '504', SA: '682', AE: '784', IL: '376', PK: '586', BD: '050', LK: '144', NP: '524', IR: '364', IQ: '368', CL: '152', CO: '170', PE: '604', VE: '862', UY: '858',
  TW: '158', KZ: '398', GH: '288', DZ: '012', JO: '400', KW: '414', QA: '634', OM: '512', CY: '196', LU: '442', IS: '352', EE: '233', LV: '428', LT: '440', SK: '703',
  SI: '705', HR: '191', RS: '688', GE: '268', AM: '051', AZ: '031', UZ: '860', KH: '116', LA: '418', MM: '104', BN: '096', TL: '626', AF: '004', AL: '008', LB: '422',
};
const NAME_ALIASES: Record<string, string> = { 'united states': 'united states of america', usa: 'united states of america', czechia: 'czechia', 'türkiye': 'turkey', 'south korea': 'south korea', 'korea, republic of': 'south korea' };

type CountryFeature = { type: 'Feature'; id?: string | number; properties: { name: string }; geometry: unknown };
type CountryFC = { type: 'FeatureCollection'; features: CountryFeature[] };
const toFeatures = feature as unknown as (topo: unknown, obj: unknown) => CountryFC;
type FitObj = Parameters<GeoProjection['fitExtent']>[1];

type CountryDatum = { country: string; countryCode?: string; count: number };
type Point = { lat: number; lon: number; city?: string; country?: string; type?: string };

const W = 960;
const H = 470;

export function WorldMap({ countries, points }: { countries: CountryDatum[]; points: Point[] }) {
  const [geo, setGeo] = useState<CountryFC | null>(null);
  const [hover, setHover] = useState<{ name: string; count: number; x: number; y: number } | null>(null);

  useEffect(() => {
    let alive = true;
    import('world-atlas/countries-110m.json').then((m) => {
      const topo = (m.default ?? m) as unknown as { objects: { countries: unknown } };
      const fc = toFeatures(topo, topo.objects.countries);
      if (alive) setGeo({ ...fc, features: fc.features.filter((f) => f.properties.name !== 'Antarctica') });
    });
    return () => {
      alive = false;
    };
  }, []);

  const { path, projection } = useMemo(() => {
    const projection = geoNaturalEarth1().fitExtent([[4, 4], [W - 4, H - 4]], (geo ?? { type: 'Sphere' }) as unknown as FitObj);
    return { projection, path: geoPath(projection) };
  }, [geo]);

  const counts = useMemo(() => {
    const byId = new Map<string, number>();
    const byName = new Map<string, number>();
    for (const c of countries) {
      const id = c.countryCode ? A2N[c.countryCode.toUpperCase()] : undefined;
      if (id) byId.set(id, (byId.get(id) ?? 0) + c.count);
      else {
        const n = c.country?.toLowerCase() ?? '';
        byName.set(NAME_ALIASES[n] ?? n, (byName.get(NAME_ALIASES[n] ?? n) ?? 0) + c.count);
      }
    }
    return { byId, byName, max: Math.max(1, ...countries.map((c) => c.count)) };
  }, [countries]);

  const valueFor = (id: string | number | undefined, name: string) => counts.byId.get(String(id)) ?? counts.byName.get(name.toLowerCase()) ?? 0;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="World map of visitors by country" onMouseLeave={() => setHover(null)}>
        <path d={path({ type: 'Sphere' }) ?? ''} fill="#f8f4ee" />
        {geo?.features.map((f, i) => {
          const v = valueFor(f.id, f.properties.name);
          return (
            <path
              key={String(f.id ?? i)}
              d={path(f as unknown as GeoPermissibleObjects) ?? ''}
              fill={v ? seqColor(Math.sqrt(v / counts.max)) : '#ebe4d8'}
              stroke="#fff"
              strokeWidth={0.6}
              className="transition-opacity hover:opacity-80"
              onMouseMove={(e) => {
                const r = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                setHover({ name: f.properties.name, count: v, x: e.clientX - r.left, y: e.clientY - r.top });
              }}
            />
          );
        })}
        {points.slice(0, 1500).map((p, i) => {
          const xy = projection([p.lon, p.lat]);
          if (!xy) return null;
          return <circle key={i} cx={xy[0]} cy={xy[1]} r={p.type === 'submit' ? 3.2 : 2.2} fill={p.type === 'submit' ? '#0f8a7a' : '#2b2320'} fillOpacity={p.type === 'submit' ? 0.85 : 0.35} stroke="#fff" strokeWidth={0.6} />;
        })}
      </svg>
      {hover && (
        <div className="pointer-events-none absolute z-10 rounded-lg border border-(--line) bg-white px-2.5 py-1.5 text-xs shadow-lg" style={{ left: Math.min(hover.x + 12, 9999), top: hover.y + 12 }}>
          <p className="font-medium">{hover.name}</p>
          <p className="text-(--ink-2)">{fmtNum(hover.count)} visits</p>
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-4 text-[11px] text-(--ink-2)">
        <span className="flex items-center gap-1.5">
          Fewer
          <span className="flex">
            {SEQ.slice(1).map((c) => (
              <span key={c} className="h-2.5 w-5" style={{ background: c }} />
            ))}
          </span>
          More visits
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-[#2b2320]/40" /> Visit
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-[#0f8a7a]" /> Submission
        </span>
      </div>
    </div>
  );
}
