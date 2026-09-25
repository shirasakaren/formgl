import { createField, DEFAULT_SETTINGS, DEFAULT_THEME, environmentMeta, type EnvironmentKey, type PublicForm } from '@formgl/shared';

const opts = (...l: string[]) => l.map((label, i) => ({ id: `o${i}`, label }));

/** A showcase letter used on the landing page (no backend needed). */
export function demoForm(env: EnvironmentKey = 'park'): PublicForm {
  const f = createField;
  const meta = environmentMeta(env);
  const subtitles: Record<EnvironmentKey, string> = { park: 'open me slowly', seaside: 'found at low tide', atelier: 'written by the window', skies: 'carried on the wind', lantern: 'light it and let it go' };
  return {
    id: 'demo',
    slug: 'demo',
    title: 'A letter for you',
    description: '',
    availability: 'open',
    theme: { ...DEFAULT_THEME, ...(env === 'park' ? {} : meta.suggest), environment: env, envelopeTitle: 'For You', envelopeSubtitle: subtitles[env], openHint: '', timeOfDay: env === 'seaside' || env === 'atelier' ? 'morning' : env === 'lantern' ? 'dusk' : 'golden' },
    settings: {
      ...DEFAULT_SETTINGS,
      fieldsPerPage: 3,
      greeting: 'Dear friend,',
      introHtml: '<p>Thank you for stopping by this quiet bench. I wrote you a few questions — answer only what feels <mark>right</mark>.</p>',
      signOff: 'With warmth,',
      signature: 'FormGL',
      thankYouHeading: 'Thank you',
      thankYouHtml: '<p>Your reply has been sealed and carried off on the wind. (This is a demo — nothing was sent.)</p>',
    },
    fields: [
      f('short_text', { id: 'name', label: 'What should I call you?', placeholder: 'Your name', required: true }),
      f('multiple_choice', { id: 'mood', label: 'How is your day going?', options: opts('Wonderful', 'Quietly good', 'A little heavy', 'Too busy to tell') }),
      f('rating', { id: 'bench', label: 'How cozy does this bench look?', config: { ratingMax: 5, ratingIcon: 'heart' } }),
      f('page_break'),
      f('long_text', { id: 'story', label: 'Tell me about a small thing that made you smile recently', placeholder: 'Write from the heart…' }),
      f('checkboxes', { id: 'seasons', label: 'Which seasons feel like home?', options: opts('Spring', 'Summer', 'Autumn', 'Winter') }),
      f('slider', { id: 'tea', label: 'Tea or coffee?', config: { scaleMin: 0, scaleMax: 100, minLabel: 'Tea', maxLabel: 'Coffee' } }),
      f('page_break'),
      f('email', { id: 'email', label: 'Where can I write back?', placeholder: 'you@example.com' }),
      f('yes_no', { id: 'again', label: 'May I send you another letter someday?', config: { yesLabel: 'Please do', noLabel: 'Not now' } }),
    ],
  };
}
