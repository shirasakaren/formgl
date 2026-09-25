'use client';

import { create } from 'zustand';
import { createField, withSettingsDefaults, withThemeDefaults, type FieldType, type FormDoc, type FormField, type FormSettings, type FormTheme } from '@formgl/shared';

export type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

interface EditorState {
  form: FormDoc | null;
  selectedId: string | null;
  saveState: SaveState;
  /** increments on every local edit; the autosaver compares against the last saved revision */
  revision: number;
  load: (form: FormDoc) => void;
  /** replace server-controlled fields (status, slug…) without marking dirty */
  syncServer: (form: FormDoc) => void;
  setSaveState: (s: SaveState) => void;
  select: (id: string | null) => void;
  setMeta: (patch: Partial<Pick<FormDoc, 'title' | 'description'>>) => void;
  setTheme: (patch: Partial<FormTheme>) => void;
  setSettings: (patch: Partial<FormSettings>) => void;
  setFields: (fields: FormField[]) => void;
  updateField: (id: string, patch: Partial<FormField>) => void;
  addField: (type: FieldType) => void;
  duplicateField: (id: string) => void;
  removeField: (id: string) => void;
  moveField: (id: string, delta: number) => void;
}

const cloneField = (f: FormField): FormField => {
  const c = JSON.parse(JSON.stringify(f)) as FormField;
  c.id = `f_${Math.random().toString(36).slice(2, 10)}`;
  c.options = c.options?.map((o) => ({ ...o, id: `o_${Math.random().toString(36).slice(2, 9)}` }));
  return c;
};

export const useEditor = create<EditorState>((set, get) => {
  const edit = (fn: (form: FormDoc) => FormDoc) => {
    const { form, revision } = get();
    if (!form) return;
    set({ form: fn(form), revision: revision + 1, saveState: 'dirty' });
  };
  return {
    form: null,
    selectedId: null,
    saveState: 'idle',
    revision: 0,
    load: (form) =>
      set({
        form: { ...form, theme: withThemeDefaults(form.theme), settings: withSettingsDefaults(form.settings), fields: form.fields ?? [] },
        selectedId: form.fields?.[0]?.id ?? null,
        saveState: 'idle',
        revision: 0,
      }),
    syncServer: (srv) => {
      const { form } = get();
      if (!form) return;
      set({ form: { ...form, status: srv.status, slug: srv.slug, publishedAt: srv.publishedAt, updatedAt: srv.updatedAt } });
    },
    setSaveState: (saveState) => set({ saveState }),
    select: (selectedId) => set({ selectedId }),
    setMeta: (patch) => edit((f) => ({ ...f, ...patch })),
    setTheme: (patch) => edit((f) => ({ ...f, theme: { ...f.theme, ...patch } })),
    setSettings: (patch) => edit((f) => ({ ...f, settings: { ...f.settings, ...patch } })),
    setFields: (fields) => edit((f) => ({ ...f, fields })),
    updateField: (id, patch) => edit((f) => ({ ...f, fields: f.fields.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),
    addField: (type) => {
      const field = createField(type);
      const { form, selectedId } = get();
      if (!form) return;
      const idx = selectedId ? form.fields.findIndex((x) => x.id === selectedId) : -1;
      const fields = [...form.fields];
      fields.splice(idx >= 0 ? idx + 1 : fields.length, 0, field);
      edit((f) => ({ ...f, fields }));
      set({ selectedId: field.id });
    },
    duplicateField: (id) => {
      const { form } = get();
      if (!form) return;
      const idx = form.fields.findIndex((x) => x.id === id);
      if (idx < 0) return;
      const copy = cloneField(form.fields[idx]);
      const fields = [...form.fields];
      fields.splice(idx + 1, 0, copy);
      edit((f) => ({ ...f, fields }));
      set({ selectedId: copy.id });
    },
    removeField: (id) => {
      const { form, selectedId } = get();
      if (!form) return;
      const idx = form.fields.findIndex((x) => x.id === id);
      const fields = form.fields.filter((x) => x.id !== id);
      edit((f) => ({ ...f, fields }));
      if (selectedId === id) set({ selectedId: fields[Math.min(idx, fields.length - 1)]?.id ?? null });
    },
    moveField: (id, delta) => {
      const { form } = get();
      if (!form) return;
      const idx = form.fields.findIndex((x) => x.id === id);
      const to = idx + delta;
      if (idx < 0 || to < 0 || to >= form.fields.length) return;
      const fields = [...form.fields];
      const [m] = fields.splice(idx, 1);
      fields.splice(to, 0, m);
      edit((f) => ({ ...f, fields }));
    },
  };
});
