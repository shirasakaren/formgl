"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Eye,
  Hammer,
  History,
  Loader2,
  Palette,
  Redo2,
  Plug,
  Rocket,
  Save,
  Send,
  Settings2,
  Cloud,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { api, ApiError, errorMessage } from "@/lib/admin/api";
import { useEditor } from "@/lib/admin/editor-store";
import { cn } from "@/lib/admin/utils";
import { Button, EmptyState, IconButton, PageLoader, StatusBadge } from "../ui";
import { VersionsDrawer } from "./VersionsDrawer";
import { BuildTab } from "./BuildTab";
import { DesignTab } from "./DesignTab";
import { SettingsTab } from "./SettingsTab";
import { ShareTab } from "./ShareTab";
import { ConnectTab } from "./ConnectTab";
import { LivePreview } from "./LivePreview";

const TABS = [
  { id: "build", label: "Build", icon: Hammer },
  { id: "design", label: "Design", icon: Palette },
  { id: "settings", label: "Settings", icon: Settings2 },
  { id: "share", label: "Share", icon: Send },
  { id: "connect", label: "Connect", icon: Plug },
] as const;
type TabId = (typeof TABS)[number]["id"];

export function FormEditor({ id }: { id: string }) {
  const form = useEditor((s) => s.form);
  const load = useEditor((s) => s.load);
  const setMeta = useEditor((s) => s.setMeta);
  const saveState = useEditor((s) => s.saveState);
  const revision = useEditor((s) => s.revision);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTabState] = useState<TabId>("build");
  const [history, setHistory] = useState(false);
  const [preview, setPreviewState] = useState(false);
  useEffect(() => {
    try {
      setPreviewState(window.localStorage.getItem("fgl_admin_preview") === "1");
    } catch {
      /* noop */
    }
  }, []);
  const setPreview = (v: boolean) => {
    setPreviewState(v);
    try {
      window.localStorage.setItem("fgl_admin_preview", v ? "1" : "0");
    } catch {
      /* noop */
    }
  };
  const [publishing, setPublishing] = useState(false);
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);
  const savedRev = useRef(0);
  const inflight = useRef<Promise<boolean> | null>(null);

  // initial load
  useEffect(() => {
    let alive = true;
    useEditor.setState({ form: null });
    savedRev.current = 0;
    api.forms
      .get(id)
      .then((f) => alive && load(f))
      .catch(
        (e) =>
          alive &&
          setError(
            e instanceof ApiError && e.status === 404
              ? "This form doesn’t exist (anymore)."
              : errorMessage(e),
          ),
      );
    const fromHash = () => {
      const hash = window.location.hash.slice(1) as TabId;
      if (TABS.some((t) => t.id === hash)) setTabState(hash);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => {
      alive = false;
      window.removeEventListener("hashchange", fromHash);
    };
  }, [id, load]);

  const setTab = (t: TabId) => {
    setTabState(t);
    window.history.replaceState(null, "", `#${t}`);
  };

  /** Persist the current draft. Resolves true when everything up to now is saved. */
  const saveNow = useCallback(async (): Promise<boolean> => {
    if (inflight.current) await inflight.current;
    const { form: f, revision: rev } = useEditor.getState();
    if (!f) return false;
    if (rev === savedRev.current) return true;
    useEditor.getState().setSaveState("saving");
    const p = api.forms
      .update(f.id, {
        title: f.title,
        description: f.description,
        fields: f.fields,
        theme: f.theme,
        settings: f.settings,
      })
      .then((doc) => {
        savedRev.current = rev;
        useEditor.getState().syncServer(doc);
        const now = useEditor.getState().revision;
        useEditor.getState().setSaveState(now === rev ? "saved" : "dirty");
        return true;
      })
      .catch((e) => {
        useEditor.getState().setSaveState("error");
        toast.error(`Couldn’t save: ${errorMessage(e)}`);
        return false;
      })
      .finally(() => {
        inflight.current = null;
      });
    inflight.current = p;
    return p;
  }, []);

  // debounced autosave
  useEffect(() => {
    if (!form || revision === 0 || revision === savedRev.current) return;
    const t = setTimeout(() => void saveNow(), 800);
    return () => clearTimeout(t);
  }, [revision, form, saveNow]);

  // ⌘S + unload guard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void saveNow().then((ok) => ok && toast.success("Saved"));
      }
      // undo / redo — but leave text fields their own native undo
      const el = e.target as HTMLElement | null;
      const typing =
        !!el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.isContentEditable);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z" && !typing) {
        e.preventDefault();
        if (e.shiftKey) useEditor.getState().redo();
        else useEditor.getState().undo();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "y" && !typing) {
        e.preventDefault();
        useEditor.getState().redo();
      }
    };
    const onUnload = (e: BeforeUnloadEvent) => {
      if (useEditor.getState().revision !== savedRev.current) {
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("beforeunload", onUnload);
      if (useEditor.getState().revision !== savedRev.current) void saveNow();
    };
  }, [saveNow]);

  const publishChanges = async () => {
    const f = useEditor.getState().form;
    if (!f) return;
    // first publish needs a link: that lives in the Share tab
    if (f.slug.startsWith("draft-")) {
      setTab("share");
      return;
    }
    setPublishing(true);
    try {
      if (!(await saveNow())) throw new Error("Save your changes first");
      const doc = await api.forms.publish(f.id);
      useEditor.getState().syncServer(doc);
      toast.success(`Version ${doc.liveVersion} is live ✉︎`);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setPublishing(false);
    }
  };

  // actions from the command palette
  useEffect(() => {
    const onAction = (e: Event) => {
      const a = (e as CustomEvent<string>).detail;
      if (a.startsWith('tab:')) {
        const t = a.slice(4) as TabId;
        if (TABS.some((x) => x.id === t)) setTab(t);
      } else if (a === 'publish') void publishChanges();
      else if (a === 'preview') setPreview(!preview);
      else if (a === 'history') setHistory(true);
    };
    window.addEventListener('fgl:editor', onAction);
    return () => window.removeEventListener('fgl:editor', onAction);
  });

  if (error)
    return (
      <EmptyState
        icon={AlertCircle}
        title="Can’t open this form"
        action={
          <Link
            href="/admin"
            className="text-sm font-medium text-(--accent) underline"
          >
            Back to all forms
          </Link>
        }
      >
        {error}
      </EmptyState>
    );
  if (!form || form.id !== id)
    return <PageLoader label="Unfolding the letter…" />;

  return (
    <div className="flex h-dvh flex-col max-lg:h-[calc(100dvh-56px)]">
      <header className="shrink-0 border-b border-(--line) bg-white">
        <div className="flex items-center gap-2 px-3 py-2.5 sm:px-5">
          <Link
            href="/admin"
            className="grid size-8 shrink-0 place-items-center rounded-lg text-(--ink-2) hover:bg-(--paper-2)"
            aria-label="Back to forms"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <input
            value={form.title}
            onChange={(e) => setMeta({ title: e.target.value })}
            aria-label="Form title"
            className="font-display min-w-0 flex-1 truncate rounded-md bg-transparent px-1.5 py-0.5 text-xl font-semibold hover:bg-(--paper) focus:bg-(--paper) focus:outline-none sm:text-2xl"
          />
          <span className="hidden sm:inline-flex">
            <StatusBadge status={form.status} />
          </span>
          <SaveIndicator state={saveState} />
          <span className="hidden items-center md:flex">
            <IconButton
              icon={Undo2}
              label="Undo (⌘Z)"
              size="sm"
              onClick={() => useEditor.getState().undo()}
              disabled={!canUndo}
            />
            <IconButton
              icon={Redo2}
              label="Redo (⇧⌘Z)"
              size="sm"
              onClick={() => useEditor.getState().redo()}
              disabled={!canRedo}
            />
            <IconButton
              icon={History}
              label="Version history"
              size="sm"
              onClick={() => setHistory(true)}
            />
          </span>
          <Button
            size="sm"
            icon={Eye}
            className={cn(
              "hidden md:inline-flex",
              preview && "lg:border-(--accent) lg:text-(--accent)",
            )}
            aria-pressed={preview}
            onClick={async () => {
              await saveNow();
              if (window.matchMedia("(min-width: 1024px)").matches)
                setPreview(!preview);
              else window.open(`/${form.slug}?preview=1`, "_blank", "noopener");
            }}
          >
            Preview
          </Button>
          {form.status === "published" ? (
            form.hasUnpublishedChanges ||
            saveState === "dirty" ||
            saveState === "saving" ? (
              <Button
                size="sm"
                variant="primary"
                icon={Rocket}
                onClick={publishChanges}
                loading={publishing}
                title="Your draft differs from what respondents see"
              >
                <span className="hidden sm:inline">Publish changes</span>
              </Button>
            ) : (
              <span
                className="hidden items-center gap-1 rounded-full bg-[#e7f3ea] px-2.5 py-1 text-[12px] font-medium text-[#2f7a4a] sm:inline-flex"
                title="Respondents see exactly this"
              >
                <Check className="size-3.5" /> Live · v{form.liveVersion ?? 1}
              </span>
            )
          ) : (
            <Button
              size="sm"
              variant="primary"
              icon={form.slug.startsWith("draft-") ? Send : Save}
              onClick={() =>
                form.slug.startsWith("draft-")
                  ? setTab("share")
                  : publishChanges()
              }
              loading={publishing}
            >
              <span className="hidden sm:inline">
                {form.slug.startsWith("draft-") ? "Publish…" : "Publish"}
              </span>
            </Button>
          )}
        </div>
        <nav
          role="tablist"
          aria-label="Editor sections"
          className="fgl-scroll flex gap-1 overflow-x-auto px-3 sm:px-5"
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "-mb-px flex items-center gap-1.5 border-b-2 px-3 pt-1.5 pb-2.5 text-[13px] font-medium whitespace-nowrap transition-colors",
                tab === t.id
                  ? "border-(--accent) text-(--ink)"
                  : "border-transparent text-(--ink-2) hover:text-(--ink)",
              )}
            >
              <t.icon
                className={cn("size-4", tab === t.id && "text-(--accent)")}
                aria-hidden
              />
              {t.label}
            </button>
          ))}
        </nav>
      </header>
      <div className="flex min-h-0 flex-1">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col" role="tabpanel">
          {tab === "build" && <BuildTab />}
          {tab === "design" && <DesignTab />}
          {tab === "settings" && <SettingsTab />}
          {tab === "share" && <ShareTab saveNow={saveNow} />}
          {tab === "connect" && <ConnectTab />}
        </div>
        {preview && <LivePreview onClose={() => setPreview(false)} />}
      </div>
      <VersionsDrawer
        open={history}
        onClose={() => setHistory(false)}
        saveNow={saveNow}
      />
    </div>
  );
}

function SaveIndicator({
  state,
}: {
  state: ReturnType<typeof useEditor.getState>["saveState"];
}) {
  const map = {
    idle: { icon: Cloud, text: "All saved", cls: "text-(--ink-3)" },
    saved: { icon: Check, text: "Saved", cls: "text-[#2f7a4a]" },
    dirty: { icon: Cloud, text: "Unsaved", cls: "text-(--ink-3)" },
    saving: { icon: Loader2, text: "Saving…", cls: "text-(--ink-2)" },
    error: { icon: AlertCircle, text: "Not saved", cls: "text-(--accent)" },
  }[state];
  return (
    <span
      className={cn("flex shrink-0 items-center gap-1 px-1 text-xs", map.cls)}
      aria-live="polite"
    >
      <map.icon
        className={cn("size-3.5", state === "saving" && "animate-spin")}
        aria-hidden
      />
      <span className="hidden sm:inline">{map.text}</span>
    </span>
  );
}
