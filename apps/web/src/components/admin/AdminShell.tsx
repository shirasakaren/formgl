'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Toaster, toast } from 'sonner';
import { BarChart3, Eye, EyeOff, Inbox, LayoutGrid, LogOut, Menu as MenuIcon, PenSquare, Search, X } from 'lucide-react';
import { CommandPalette } from './CommandPalette';
import { api, ApiError, errorMessage } from '@/lib/admin/api';
import { cn } from '@/lib/admin/utils';
import { Button, PageLoader } from './ui';

type AuthState = 'checking' | 'in' | 'out';

export function AdminShell({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>('checking');

  useEffect(() => {
    let alive = true;
    api.auth
      .me()
      .then(() => alive && setAuth('in'))
      .catch((e) => {
        if (!alive) return;
        setAuth('out');
        if (!(e instanceof ApiError && e.status === 401)) toast.error(`Can’t reach the API: ${errorMessage(e)}`);
      });
    const onUnauth = () => setAuth('out');
    window.addEventListener('fgl:unauthorized', onUnauth);
    return () => {
      alive = false;
      window.removeEventListener('fgl:unauthorized', onUnauth);
    };
  }, []);

  return (
    <div className="fgl-admin">
      <Toaster
        position="bottom-right"
        toastOptions={{ style: { fontFamily: 'Inter, system-ui, sans-serif', borderRadius: 12, border: '1px solid #e6ddd0', color: '#2b2320' } }}
      />
      {auth === 'checking' && <PageLoader label="Opening the study…" />}
      {auth === 'out' && <LoginScreen onSuccess={() => setAuth('in')} />}
      {auth === 'in' && <Frame onLogout={() => setAuth('out')}>{children}</Frame>}
    </div>
  );
}

/* ───────────────────────── Login ───────────────────────── */

function LoginScreen({ onSuccess }: { onSuccess: () => void }) {
  const [pass, setPass] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pass) return;
    setBusy(true);
    setError(null);
    try {
      await api.auth.login(pass);
      onSuccess();
    } catch (err) {
      setError(err instanceof ApiError && err.status === 401 ? 'That passphrase doesn’t open this envelope.' : err instanceof ApiError && err.status === 429 ? 'Too many attempts — take a breath and try again in a minute.' : errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-10">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,#fffaf2_0%,transparent_60%),radial-gradient(ellipse_at_bottom_right,#efe3d2_0%,transparent_55%)]" />
      <div className="fgl-anim-pop relative w-full max-w-sm">
        {/* envelope */}
        <div aria-hidden className="relative mx-auto mb-[-28px] h-28 w-56">
          <div className="absolute inset-0 rounded-md bg-[#efe6d6] shadow-[0_12px_30px_-10px_rgba(60,40,20,.35)]" />
          <div className="absolute inset-x-0 top-0 h-16 origin-top bg-[#e7dcc8] [clip-path:polygon(0_0,100%_0,50%_100%)]" />
          <div className="absolute top-11 left-1/2 grid size-11 -translate-x-1/2 place-items-center rounded-full bg-(--accent) font-script text-xl text-[#f6dcd4] shadow-[0_2px_0_#6d1212,0_6px_12px_-2px_rgba(80,20,20,.5)] ring-4 ring-(--accent)/25">
            F
          </div>
        </div>
        <form onSubmit={submit} className="relative rounded-2xl border border-(--line) bg-white px-7 pt-12 pb-7 shadow-[0_24px_60px_-24px_rgba(60,40,20,.35)]">
          <h1 className="font-display text-center text-3xl font-semibold">Welcome back</h1>
          <p className="mt-1 text-center text-sm text-(--ink-2)">Enter the passphrase to open the FormGL study.</p>
          <label htmlFor="fgl-pass" className="mt-6 block text-[13px] font-medium">
            Passphrase
          </label>
          <div className="relative mt-1.5">
            <input
              id="fgl-pass"
              type={show ? 'text' : 'password'}
              autoComplete="current-password"
              autoFocus
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              aria-invalid={!!error}
              aria-describedby={error ? 'fgl-pass-err' : undefined}
              className="h-11 w-full rounded-lg border border-(--line) bg-[#fdfbf7] px-3 pr-10 text-[15px] tracking-wide focus:border-(--accent) focus:ring-3 focus:ring-(--accent)/10 focus:outline-none"
            />
            <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Hide passphrase' : 'Show passphrase'} className="absolute top-1/2 right-2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-(--ink-3) hover:text-(--ink)">
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {error && (
            <p id="fgl-pass-err" role="alert" className="mt-2 text-[13px] text-(--accent)">
              {error}
            </p>
          )}
          <Button type="submit" variant="primary" size="lg" className="mt-5 w-full" loading={busy} disabled={!pass}>
            Break the seal
          </Button>
        </form>
        <p className="mt-6 text-center font-script text-2xl text-(--ink-3)">FormGL</p>
      </div>
    </main>
  );
}

/* ───────────────────────── Frame ───────────────────────── */

function Frame({ children, onLogout }: { children: ReactNode; onLogout: () => void }) {
  const pathname = usePathname() ?? '/admin';
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const formId = pathname.match(/^\/admin\/forms\/([^/]+)/)?.[1];

  useEffect(() => setOpen(false), [pathname]);

  const logout = useCallback(async () => {
    try {
      await api.auth.logout();
    } catch {
      /* ignore */
    }
    onLogout();
    router.replace('/admin');
  }, [onLogout, router]);

  const nav = [{ href: '/admin', label: 'All forms', icon: LayoutGrid, active: pathname === '/admin' }];
  const formNav = formId
    ? [
        { href: `/admin/forms/${formId}`, label: 'Editor', icon: PenSquare, active: pathname === `/admin/forms/${formId}` },
        { href: `/admin/forms/${formId}/responses`, label: 'Responses', icon: Inbox, active: pathname.endsWith('/responses') },
        { href: `/admin/forms/${formId}/analytics`, label: 'Analytics', icon: BarChart3, active: pathname.endsWith('/analytics') },
      ]
    : [];

  const sidebar = (
    <nav aria-label="Admin" className="flex h-full flex-col gap-6 px-3 py-5">
      <Link href="/admin" className="flex items-center gap-2.5 px-2">
        <span className="grid size-8 place-items-center rounded-full bg-(--accent) font-script text-lg text-[#f6dcd4] shadow-[0_2px_0_#6d1212]">F</span>
        <span className="leading-none">
          <span className="block font-script text-[26px] text-(--ink)">FormGL</span>
          <span className="block text-[10px] tracking-[0.16em] text-(--ink-3) uppercase">Studio</span>
        </span>
      </Link>
      <button
        onClick={() => window.dispatchEvent(new Event('fgl:palette'))}
        className="flex items-center gap-2 rounded-lg border border-(--line) bg-white/70 px-2.5 py-2 text-[13px] text-(--ink-3) transition-colors hover:bg-white hover:text-(--ink-2)"
      >
        <Search className="size-4" aria-hidden />
        <span className="flex-1 text-left">Search…</span>
        <kbd className="rounded border border-(--line) px-1 text-[10.5px]">⌘K</kbd>
      </button>
      <NavGroup items={nav} />
      {formNav.length > 0 && <NavGroup title="This form" items={formNav} />}
      <div className="mt-auto">
        <button onClick={logout} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-(--ink-2) transition-colors hover:bg-white hover:text-(--ink)">
          <LogOut className="size-4" aria-hidden /> Sign out
        </button>
      </div>
    </nav>
  );

  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 border-r border-(--line) bg-[#f2ece2] lg:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-[80] lg:hidden">
          <div className="fgl-anim-fade absolute inset-0 bg-[#2b2320]/35" onClick={() => setOpen(false)} aria-hidden />
          <aside className="fgl-anim-slide absolute inset-y-0 left-0 w-64 border-r border-(--line) bg-[#f2ece2] shadow-2xl">
            <button onClick={() => setOpen(false)} aria-label="Close menu" className="absolute top-4 right-3 grid size-8 place-items-center rounded-lg text-(--ink-2) hover:bg-white">
              <X className="size-4" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-(--line) bg-(--paper)/90 px-4 backdrop-blur lg:hidden">
          <button onClick={() => setOpen(true)} aria-label="Open menu" className="grid size-9 place-items-center rounded-lg text-(--ink-2) hover:bg-white">
            <MenuIcon className="size-5" />
          </button>
          <Link href="/admin" className="font-script text-2xl">
            FormGL
          </Link>
          <button onClick={() => window.dispatchEvent(new Event('fgl:palette'))} aria-label="Search" className="ml-auto grid size-9 place-items-center rounded-lg text-(--ink-2) hover:bg-white">
            <Search className="size-4" />
          </button>
          <button onClick={logout} aria-label="Sign out" className="grid size-9 place-items-center rounded-lg text-(--ink-2) hover:bg-white">
            <LogOut className="size-4" />
          </button>
        </header>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
      <CommandPalette formId={formId} onLogout={logout} />
    </div>
  );
}

function NavGroup({ title, items }: { title?: string; items: Array<{ href: string; label: string; icon: typeof LayoutGrid; active: boolean }> }) {
  return (
    <div>
      {title && <p className="mb-1.5 px-2.5 text-[10px] font-semibold tracking-[0.14em] text-(--ink-3) uppercase">{title}</p>}
      <ul className="space-y-0.5">
        {items.map((it) => (
          <li key={it.href}>
            <Link
              href={it.href}
              aria-current={it.active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors',
                it.active ? 'bg-white text-(--ink) shadow-[0_1px_2px_rgba(60,40,20,.08)]' : 'text-(--ink-2) hover:bg-white/60 hover:text-(--ink)',
              )}
            >
              <it.icon className={cn('size-4', it.active && 'text-(--accent)')} aria-hidden />
              {it.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Standard page header used across admin pages */
export function PageHeader({ title, subtitle, actions, eyebrow }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1 text-xs text-(--ink-3)">{eyebrow}</div>}
        <h1 className="font-display truncate text-[32px] leading-tight font-semibold sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-(--ink-2)">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
