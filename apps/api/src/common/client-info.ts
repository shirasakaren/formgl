import { Logger } from '@nestjs/common';
import { COUNTRIES, type ResponseMeta } from '@formgl/shared';
import type { Request } from 'express';
import { UAParser } from 'ua-parser-js';

const logger = new Logger('ClientInfo');

function header(req: Request, name: string): string | undefined {
  const v = req.headers[name];
  const s = Array.isArray(v) ? v[0] : v;
  return s && s.trim() ? s.trim() : undefined;
}

function cleanIp(ip: string | undefined): string | undefined {
  if (!ip) return undefined;
  let s = ip.split(',')[0].trim();
  if (s.startsWith('::ffff:')) s = s.slice(7);
  return s || undefined;
}

/**
 * Client IP: `req.ip` honours express `trust proxy` (X-Forwarded-For). When proxies are trusted,
 * CDN headers (`cf-connecting-ip`, `x-real-ip`) take precedence as they carry the real client.
 */
export function getClientIp(req: Request, trustProxy: boolean): string | undefined {
  if (trustProxy) {
    const cdn = cleanIp(header(req, 'cf-connecting-ip') ?? header(req, 'x-real-ip'));
    if (cdn) return cdn;
  }
  return cleanIp(req.ip ?? req.socket?.remoteAddress);
}

/* ───────────────────────── Geo ───────────────────────── */

export interface GeoInfo {
  country?: string;
  countryCode?: string;
  region?: string;
  city?: string;
  lat?: number;
  lon?: number;
  timezone?: string;
}

type GeoipLite = typeof import('geoip-lite');
let geoip: GeoipLite | null | undefined;
function loadGeoip(): GeoipLite | null {
  if (geoip !== undefined) return geoip;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    geoip = require('geoip-lite') as GeoipLite;
    // sanity probe — throws / returns null when the bundled data files are missing
    geoip.lookup('8.8.8.8');
  } catch (e) {
    logger.warn(`geoip-lite unavailable (${(e as Error).message}); falling back to CDN headers only`);
    geoip = null;
  }
  return geoip;
}
/** Load the geoip database eagerly (it is ~100MB and takes a moment). */
export function preloadGeoip() {
  loadGeoip();
}

const COUNTRY_NAMES = new Map(COUNTRIES.map((c) => [c.code.toUpperCase(), c.name]));
let regionNames: Intl.DisplayNames | undefined;
export function countryName(code?: string): string | undefined {
  if (!code) return undefined;
  const cc = code.toUpperCase();
  const known = COUNTRY_NAMES.get(cc);
  if (known) return known;
  try {
    regionNames ??= new Intl.DisplayNames(['en'], { type: 'region' });
    return regionNames.of(cc) ?? cc;
  } catch {
    return cc;
  }
}

const num = (s?: string) => {
  if (s == null) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
};
const decode = (s?: string) => {
  if (!s) return undefined;
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

function isPrivateIp(ip: string): boolean {
  return (
    ip === '::1' ||
    ip === '127.0.0.1' ||
    ip.startsWith('10.') ||
    ip.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ||
    ip.startsWith('169.254.') ||
    /^f[cd][0-9a-f]{2}:/i.test(ip) ||
    /^fe80:/i.test(ip)
  );
}

/** Geo from CDN headers (Cloudflare / Vercel) when proxies are trusted, then geoip-lite. */
export function resolveGeo(req: Request, ip: string | undefined, trustProxy: boolean): GeoInfo {
  const geo: GeoInfo = {};
  if (trustProxy) {
    const cc = header(req, 'cf-ipcountry') ?? header(req, 'x-vercel-ip-country');
    if (cc && /^[A-Za-z]{2}$/.test(cc) && !['XX', 'T1'].includes(cc.toUpperCase())) geo.countryCode = cc.toUpperCase();
    geo.city = decode(header(req, 'x-vercel-ip-city') ?? header(req, 'cf-ipcity'));
    geo.region = decode(header(req, 'x-vercel-ip-country-region') ?? header(req, 'cf-region-code') ?? header(req, 'cf-region'));
    geo.lat = num(header(req, 'x-vercel-ip-latitude') ?? header(req, 'cf-iplatitude'));
    geo.lon = num(header(req, 'x-vercel-ip-longitude') ?? header(req, 'cf-iplongitude'));
    geo.timezone = header(req, 'x-vercel-ip-timezone') ?? header(req, 'cf-timezone');
  }
  const needsLookup = !geo.countryCode || !geo.city || geo.lat == null;
  if (ip && needsLookup && !isPrivateIp(ip)) {
    const g = loadGeoip();
    try {
      const hit = g?.lookup(ip);
      if (hit && (!geo.countryCode || geo.countryCode === hit.country)) {
        geo.countryCode ??= hit.country || undefined;
        geo.region ??= hit.region || undefined;
        geo.city ??= hit.city || undefined;
        if (geo.lat == null && hit.ll) {
          geo.lat = hit.ll[0];
          geo.lon = hit.ll[1];
        }
        geo.timezone ??= hit.timezone || undefined;
      }
    } catch {
      /* ignore lookup errors */
    }
  }
  geo.country = countryName(geo.countryCode);
  for (const k of Object.keys(geo) as (keyof GeoInfo)[]) if (geo[k] === undefined || geo[k] === '') delete geo[k];
  return geo;
}

/* ───────────────────────── User agent ───────────────────────── */

export interface UaInfo {
  userAgent?: string;
  browser?: string;
  os?: string;
  device: NonNullable<ResponseMeta['device']>;
}

const BOT_RE =
  /bot\b|bot\/|crawl|spider|slurp|facebookexternalhit|embedly|quora link preview|whatsapp|telegrambot|preview|headless|lighthouse|pingdom|uptime|monitor/i;

export function parseUa(ua: string | undefined): UaInfo {
  if (!ua) return { device: 'unknown' };
  const userAgent = ua.slice(0, 512);
  try {
    const r = UAParser(userAgent);
    const btype = r.browser.type as string | undefined;
    let device: UaInfo['device'];
    if (btype === 'crawler' || btype === 'fetcher' || BOT_RE.test(userAgent)) device = 'bot';
    else if (r.device.type === 'tablet') device = 'tablet';
    else if (r.device.type === 'mobile' || r.device.type === 'wearable') device = 'mobile';
    else device = 'desktop';
    return { userAgent, browser: r.browser.name || undefined, os: r.os.name || undefined, device };
  } catch {
    return { userAgent, device: 'unknown' };
  }
}

/* ───────────────────────── Combined ───────────────────────── */

export interface ClientInfo extends UaInfo, GeoInfo {
  ip?: string;
}

export function clientInfo(req: Request, opts: { trustProxy: boolean; collectGeo: boolean }): ClientInfo {
  const ua = parseUa(header(req, 'user-agent'));
  if (!opts.collectGeo) return ua;
  const ip = getClientIp(req, opts.trustProxy);
  return { ...ua, ip, ...resolveGeo(req, ip, opts.trustProxy) };
}
