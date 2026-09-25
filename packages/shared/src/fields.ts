import {
  CONTENT_BLOCK_TYPES,
  type ContentBlockType,
  type FieldType,
  type FormField,
  type FormSettings,
  type FormTheme,
  type InputFieldType,
} from './types';

export interface FieldMeta {
  type: FieldType;
  label: string;
  group: 'text' | 'choice' | 'scale' | 'datetime' | 'media' | 'contact' | 'advanced' | 'content';
  description: string;
  /** lucide icon name suggestion for UIs */
  icon: string;
  hasOptions?: boolean;
}

export const FIELD_CATALOG: FieldMeta[] = [
  { type: 'short_text', label: 'Short answer', group: 'text', description: 'A single line of text', icon: 'Type' },
  { type: 'long_text', label: 'Long answer', group: 'text', description: 'Paragraphs, stories, feedback', icon: 'AlignLeft' },
  { type: 'email', label: 'Email', group: 'contact', description: 'Validated email address', icon: 'Mail' },
  { type: 'phone', label: 'Phone number', group: 'contact', description: 'International phone number', icon: 'Phone' },
  { type: 'url', label: 'Link', group: 'contact', description: 'A website or URL', icon: 'Link' },
  { type: 'name', label: 'Full name', group: 'contact', description: 'First & last name', icon: 'User' },
  { type: 'address', label: 'Address', group: 'contact', description: 'Street, city, zip, country', icon: 'MapPin' },
  { type: 'country', label: 'Country', group: 'contact', description: 'Pick a country', icon: 'Globe' },
  { type: 'number', label: 'Number', group: 'text', description: 'Numeric input with min / max', icon: 'Hash' },
  { type: 'currency', label: 'Currency', group: 'text', description: 'Money amount', icon: 'DollarSign' },
  { type: 'multiple_choice', label: 'Multiple choice', group: 'choice', description: 'Pick exactly one', icon: 'CircleDot', hasOptions: true },
  { type: 'checkboxes', label: 'Checkboxes', group: 'choice', description: 'Pick any number', icon: 'SquareCheck', hasOptions: true },
  { type: 'dropdown', label: 'Dropdown', group: 'choice', description: 'Pick one from a list', icon: 'ChevronDown', hasOptions: true },
  { type: 'multiselect', label: 'Multiselect', group: 'choice', description: 'Tag-style multi pick', icon: 'ListChecks', hasOptions: true },
  { type: 'yes_no', label: 'Yes / No', group: 'choice', description: 'A simple toggle choice', icon: 'ToggleLeft' },
  { type: 'ranking', label: 'Ranking', group: 'choice', description: 'Drag options into order', icon: 'ListOrdered', hasOptions: true },
  { type: 'matrix', label: 'Matrix / grid', group: 'choice', description: 'Rows × columns', icon: 'Grid3x3' },
  { type: 'rating', label: 'Rating', group: 'scale', description: 'Stars, hearts, flowers', icon: 'Star' },
  { type: 'scale', label: 'Linear scale', group: 'scale', description: '1 to N with labels', icon: 'Gauge' },
  { type: 'nps', label: 'Net Promoter Score', group: 'scale', description: '0 – 10 recommend score', icon: 'TrendingUp' },
  { type: 'slider', label: 'Slider', group: 'scale', description: 'Drag a value', icon: 'SlidersHorizontal' },
  { type: 'date', label: 'Date', group: 'datetime', description: 'Calendar date', icon: 'Calendar' },
  { type: 'time', label: 'Time', group: 'datetime', description: 'Time of day', icon: 'Clock' },
  { type: 'datetime', label: 'Date & time', group: 'datetime', description: 'Date with time', icon: 'CalendarClock' },
  { type: 'date_range', label: 'Date range', group: 'datetime', description: 'Start & end dates', icon: 'CalendarRange' },
  { type: 'file_upload', label: 'File upload', group: 'media', description: 'Any documents', icon: 'Paperclip' },
  { type: 'image_upload', label: 'Image upload', group: 'media', description: 'Photos with preview', icon: 'ImagePlus' },
  { type: 'signature', label: 'Signature', group: 'media', description: 'Draw a signature', icon: 'PenLine' },
  { type: 'color', label: 'Color', group: 'advanced', description: 'Pick a color', icon: 'Palette' },
  { type: 'consent', label: 'Consent', group: 'advanced', description: 'Terms / agreement checkbox', icon: 'ShieldCheck' },
  { type: 'hidden', label: 'Hidden field', group: 'advanced', description: 'Filled from URL ?param=', icon: 'EyeOff' },
  { type: 'heading', label: 'Heading', group: 'content', description: 'Section title', icon: 'Heading' },
  { type: 'paragraph', label: 'Rich text', group: 'content', description: 'Formatted text block', icon: 'Pilcrow' },
  { type: 'image', label: 'Image', group: 'content', description: 'Picture inside the letter', icon: 'Image' },
  { type: 'video', label: 'Video', group: 'content', description: 'YouTube / Vimeo / mp4', icon: 'Youtube' },
  { type: 'quote', label: 'Quote', group: 'content', description: 'A highlighted quotation', icon: 'Quote' },
  { type: 'divider', label: 'Divider', group: 'content', description: 'Line, dots or flourish', icon: 'Minus' },
  { type: 'spacer', label: 'Spacer', group: 'content', description: 'Vertical breathing room', icon: 'MoveVertical' },
  { type: 'page_break', label: 'Page break', group: 'content', description: 'Start a new letter page', icon: 'SeparatorHorizontal' },
];

export const FIELD_META: Record<FieldType, FieldMeta> = Object.fromEntries(
  FIELD_CATALOG.map((m) => [m.type, m]),
) as Record<FieldType, FieldMeta>;

export function isContentBlock(type: FieldType): type is ContentBlockType {
  return (CONTENT_BLOCK_TYPES as readonly string[]).includes(type);
}

export function isInputField(type: FieldType): type is InputFieldType {
  return !isContentBlock(type);
}

export function uid(prefix = ''): string {
  const s = Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  return prefix ? `${prefix}_${s}` : s;
}

const opt = (label: string) => ({ id: uid('o'), label });

/** Sensible defaults when an admin drops a new field into the editor */
export function createField(type: FieldType, overrides: Partial<FormField> = {}): FormField {
  const base: FormField = {
    id: uid('f'),
    type,
    label: FIELD_META[type]?.label ?? 'Question',
    required: false,
    width: 'full',
  };
  switch (type) {
    case 'multiple_choice':
    case 'checkboxes':
    case 'dropdown':
    case 'multiselect':
    case 'ranking':
      base.options = [opt('Option one'), opt('Option two'), opt('Option three')];
      break;
    case 'matrix':
      base.config = {
        rows: [opt('Quality'), opt('Speed'), opt('Kindness')],
        columns: [opt('Poor'), opt('Okay'), opt('Good'), opt('Great')],
      };
      break;
    case 'rating':
      base.config = { ratingMax: 5, ratingIcon: 'star' };
      break;
    case 'scale':
      base.config = { scaleMin: 1, scaleMax: 5, minLabel: 'Not at all', maxLabel: 'Absolutely' };
      break;
    case 'nps':
      base.label = 'How likely are you to recommend us to a friend?';
      base.config = { scaleMin: 0, scaleMax: 10, minLabel: 'Not likely', maxLabel: 'Very likely' };
      break;
    case 'slider':
      base.config = { scaleMin: 0, scaleMax: 100, suffix: '' };
      base.validation = { step: 1 };
      break;
    case 'currency':
      base.config = { currency: 'USD', prefix: '$' };
      break;
    case 'yes_no':
      base.config = { yesLabel: 'Yes', noLabel: 'No' };
      break;
    case 'file_upload':
      base.validation = { maxFiles: 3, maxSizeMb: 10 };
      break;
    case 'image_upload':
      base.validation = { maxFiles: 3, maxSizeMb: 10, accept: ['image/*'] };
      break;
    case 'name':
      base.label = 'Your name';
      base.config = { nameParts: ['first', 'last'] };
      break;
    case 'address':
      base.config = { addressParts: ['line1', 'line2', 'city', 'state', 'zip', 'country'] };
      break;
    case 'consent':
      base.label = 'Agreement';
      base.config = { consentHtml: 'I agree to the <a href="#">terms</a>.' };
      break;
    case 'hidden':
      base.config = { param: 'ref' };
      break;
    case 'heading':
      base.label = 'A new chapter';
      base.config = { level: 2, align: 'left' };
      break;
    case 'paragraph':
      base.label = '';
      base.config = { html: '<p>Write something <mark>lovely</mark> here…</p>' };
      break;
    case 'quote':
      base.label = '';
      base.config = { html: '<p>“The best things in life are the people we love.”</p>', caption: '' };
      break;
    case 'image':
      base.label = '';
      base.config = { src: '', alt: '', caption: '', mediaWidth: 100, align: 'center', rounded: true };
      break;
    case 'video':
      base.label = '';
      base.config = { src: '', caption: '', mediaWidth: 100, align: 'center', rounded: true };
      break;
    case 'divider':
      base.label = '';
      base.config = { divider: 'flourish' };
      break;
    case 'spacer':
      base.label = '';
      base.config = { height: 32 };
      break;
    case 'page_break':
      base.label = '';
      break;
  }
  return { ...base, ...overrides, config: { ...base.config, ...overrides.config } };
}

export const DEFAULT_THEME: FormTheme = {
  timeOfDay: 'golden',
  loaderColor: '#f3e9dc',
  loaderStyle: 'mixed',
  envelopeColor: '#efe6d6',
  envelopePaper: 'cotton',
  linerColor: '#9c6b4e',
  sealColor: '#8e1b1b',
  paperColor: '#fbf7ef',
  paper: 'cotton',
  ruling: 'plain',
  inkColor: '#2b2320',
  accentColor: '#8e1b1b',
  highlightColor: '#ffe08a',
  titleFont: 'script',
  bodyFont: 'elegant',
  labelFont: 'elegant',
  envelopeSubtitle: 'a letter, for you',
  openHint: 'Tap to open',
  ambientSound: true,
  dust: true,
  fallingLeaves: true,
  petals: false,
  butterflies: true,
  wind: 0.45,
  fieldAnimation: 'ink',
  pageTransition: 'flip',
  cameraSway: true,
  inputRadius: 10,
  inputStyle: 'underline',
};

export const DEFAULT_SETTINGS: FormSettings = {
  fieldsPerPage: 4,
  showProgress: true,
  showPageNumbers: true,
  greeting: 'Dear friend,',
  signOff: 'With warmth,',
  signature: '',
  nextLabel: 'Turn the page',
  backLabel: 'Back',
  submitLabel: 'Seal & send',
  thankYouHeading: 'Thank you',
  thankYouHtml: '<p>Your letter has been sealed and sent. It means a lot.</p>',
  confetti: true,
  opensAt: null,
  closesAt: null,
  responseLimit: null,
  closedMessage: 'This letter is no longer accepting replies.',
  onePerDevice: false,
  collectGeo: true,
  allowSaveProgress: true,
  hideBranding: false,
};

export const FONT_FAMILIES: Record<string, { family: string; css: string; label: string }> = {
  script: { family: 'Pinyon Script', css: "'Pinyon Script', 'Great Vibes', cursive", label: 'Pinyon (script)' },
  elegant: { family: 'Cormorant Garamond', css: "'Cormorant Garamond', 'EB Garamond', Georgia, serif", label: 'Cormorant (elegant)' },
  serif: { family: 'Playfair Display', css: "'Playfair Display', Georgia, serif", label: 'Playfair (display)' },
  classic: { family: 'EB Garamond', css: "'EB Garamond', Georgia, serif", label: 'EB Garamond (classic)' },
  hand: { family: 'Caveat', css: "'Caveat', 'Segoe Print', cursive", label: 'Caveat (handwriting)' },
  marker: { family: 'Homemade Apple', css: "'Homemade Apple', 'Caveat', cursive", label: 'Homemade Apple (pen)' },
  sans: { family: 'Inter', css: "'Inter', system-ui, sans-serif", label: 'Inter (sans)' },
  mono: { family: 'JetBrains Mono', css: "'JetBrains Mono', ui-monospace, monospace", label: 'JetBrains Mono' },
  typewriter: { family: 'Special Elite', css: "'Special Elite', 'Courier New', monospace", label: 'Special Elite (typewriter)' },
};

export function withThemeDefaults(theme?: Partial<FormTheme> | null): FormTheme {
  return { ...DEFAULT_THEME, ...(theme ?? {}) };
}

export function withSettingsDefaults(settings?: Partial<FormSettings> | null): FormSettings {
  return { ...DEFAULT_SETTINGS, ...(settings ?? {}) };
}
