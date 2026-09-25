'use client';
import { create } from 'zustand';
import type { Answers, PublicForm } from '@formgl/shared';

export type Phase = 'loading' | 'revealing' | 'idle' | 'opening' | 'reading' | 'sending' | 'sent';
export type Quality = 'low' | 'medium' | 'high';

interface ExperienceState {
  form: PublicForm | null;
  demo: boolean;
  preview: boolean;
  phase: Phase;
  progress: number;
  progressLabel: string;
  quality: Quality;
  reducedMotion: boolean;
  webgl: boolean;
  soundOn: boolean;
  page: number;
  answers: Answers;
  startedAt: number;
  hoverEnvelope: boolean;
  /** screen-space position of the envelope (px) used by the DOM hint */
  envelopeScreen: { x: number; y: number; r: number; visible: boolean };
  set: (p: Partial<ExperienceState>) => void;
  setAnswer: (id: string, v: Answers[string]) => void;
}

export const useExperience = create<ExperienceState>((set) => ({
  form: null,
  demo: false,
  preview: false,
  phase: 'loading',
  progress: 0,
  progressLabel: 'Gathering sunlight',
  quality: 'high',
  reducedMotion: false,
  webgl: true,
  soundOn: true,
  page: 0,
  answers: {},
  startedAt: 0,
  hoverEnvelope: false,
  envelopeScreen: { x: 0, y: 0, r: 0, visible: false },
  set: (p) => set(p),
  setAnswer: (id, v) =>
    set((s) => ({
      answers: { ...s.answers, [id]: v },
      startedAt: s.startedAt || Date.now(),
    })),
}));

/**
 * Mutable animation channels. GSAP timelines tween these numbers and the
 * render loop reads them every frame — no React re-renders involved.
 */
export const anim = {
  /** 1 = wide establishing shot of the park, eased to 0 after the reveal */
  intro: 1,
  /** 0 overview → 1 close-up on envelope → 2 letter view */
  cam: 0,
  /** envelope lift off the bench (0..1) */
  lift: 0,
  /** hover amount (0..1), eased in the render loop */
  hover: 0,
  /** seal shake / crack (0..1) */
  crack: 0,
  /** top flap rotation progress 0 closed → 1 open */
  flap: 0,
  /** letter slide out of envelope 0..1 */
  slide: 0,
  /** letter flight toward the camera 0..1 */
  rise: 0,
  /** letter unfolding 0 folded → 1 flat */
  unfold: 0,
  /** move from the centred presentation pose into DOM alignment 0..1 */
  align: 0,
  /** envelope settles back / drifts away after the letter leaves 0..1 */
  settle: 0,
  /** re-sealing (sending): new seal press 0..1 */
  stamp: 0,
  /** envelope flying away at the end 0..1 */
  flyAway: 0,
  /** visibility of the 3D letter (0..1) — fades when the DOM letter takes over */
  letterVisible: 1,
  /** extra background blur focus toward letter 0..1 */
  focusLetter: 0,
  /** global time multiplier for wind */
  wind: 0.45,
  /** environment specific channels (cork, wave, ribbon, balloons…) */
  fx: {} as Record<string, number>,
  /** pointer in NDC (-1..1) smoothed */
  px: 0,
  py: 0,
};

export type AnimChannels = typeof anim;

export function resetAnim() {
  Object.assign(anim, {
    intro: 1,
    cam: 0,
    lift: 0,
    hover: 0,
    crack: 0,
    flap: 0,
    slide: 0,
    rise: 0,
    unfold: 0,
    align: 0,
    settle: 0,
    stamp: 0,
    flyAway: 0,
    letterVisible: 1,
    focusLetter: 0,
  });
  for (const k of Object.keys(anim.fx)) anim.fx[k] = 0;
}
