/* ──────────────────────────────────────────────────────────────────────────
 *  FormGL shared contract — used by the web app (public + admin) and the API.
 * ────────────────────────────────────────────────────────────────────────── */

export const INPUT_FIELD_TYPES = [
  'short_text',
  'long_text',
  'email',
  'phone',
  'url',
  'number',
  'currency',
  'multiple_choice',
  'checkboxes',
  'dropdown',
  'multiselect',
  'yes_no',
  'rating',
  'scale',
  'nps',
  'slider',
  'ranking',
  'matrix',
  'date',
  'time',
  'datetime',
  'date_range',
  'file_upload',
  'image_upload',
  'signature',
  'color',
  'name',
  'address',
  'country',
  'consent',
  'hidden',
] as const;

export const CONTENT_BLOCK_TYPES = [
  'heading',
  'paragraph',
  'image',
  'video',
  'quote',
  'divider',
  'spacer',
  'page_break',
] as const;

export type InputFieldType = (typeof INPUT_FIELD_TYPES)[number];
export type ContentBlockType = (typeof CONTENT_BLOCK_TYPES)[number];
export type FieldType = InputFieldType | ContentBlockType;

export interface FieldOption {
  id: string;
  label: string;
  /** optional image shown with the option (picture choice) */
  imageUrl?: string;
}

export interface FieldValidation {
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  step?: number;
  /** JS regex source (without slashes) */
  pattern?: string;
  patternMessage?: string;
  minSelect?: number;
  maxSelect?: number;
  maxFiles?: number;
  maxSizeMb?: number;
  /** accepted mime types or extensions e.g. ["image/*", ".pdf"] */
  accept?: string[];
}

export type LogicOperator =
  | 'eq'
  | 'neq'
  | 'contains'
  | 'not_contains'
  | 'gt'
  | 'lt'
  | 'empty'
  | 'not_empty';

export interface LogicCondition {
  fieldId: string;
  op: LogicOperator;
  value?: string | number | boolean;
}

export interface FieldLogic {
  action: 'show' | 'hide';
  match: 'all' | 'any';
  conditions: LogicCondition[];
}

export type FieldAnimation = 'none' | 'fade' | 'rise' | 'ink' | 'typewriter' | 'blur';

export interface FieldConfig {
  /* rating */
  ratingMax?: number;
  ratingIcon?: 'star' | 'heart' | 'circle' | 'thumb' | 'flower';
  /* scale / slider / nps */
  scaleMin?: number;
  scaleMax?: number;
  minLabel?: string;
  maxLabel?: string;
  /* number / currency */
  currency?: string;
  prefix?: string;
  suffix?: string;
  /* matrix */
  rows?: FieldOption[];
  columns?: FieldOption[];
  matrixMultiple?: boolean;
  /* content blocks */
  /** sanitized rich HTML (paragraph, quote, description) */
  html?: string;
  /** heading level for heading blocks */
  level?: 1 | 2 | 3;
  /** media src for image / video blocks (YouTube, Vimeo, mp4, image url) */
  src?: string;
  alt?: string;
  caption?: string;
  align?: 'left' | 'center' | 'right';
  /** 0-100 (% of letter width) */
  mediaWidth?: number;
  rounded?: boolean;
  autoplay?: boolean;
  loop?: boolean;
  muted?: boolean;
  /** spacer height px */
  height?: number;
  divider?: 'line' | 'dots' | 'flourish' | 'wave';
  /* phone / country */
  defaultCountry?: string;
  /* hidden */
  /** URL query param that fills this hidden field */
  param?: string;
  /* consent */
  consentHtml?: string;
  /* long text */
  rows_?: number;
  /* date */
  includeTime?: boolean;
  /* name */
  nameParts?: Array<'title' | 'first' | 'middle' | 'last'>;
  /* address */
  addressParts?: Array<'line1' | 'line2' | 'city' | 'state' | 'zip' | 'country'>;
  /* choice appearance */
  layout?: 'list' | 'grid' | 'inline' | 'cards';
  /* yes/no labels */
  yesLabel?: string;
  noLabel?: string;
}

export interface FormField {
  id: string;
  type: FieldType;
  /** plain text label / question */
  label: string;
  /** rich HTML help text shown under the label */
  description?: string;
  placeholder?: string;
  required?: boolean;
  defaultValue?: AnswerValue;
  options?: FieldOption[];
  allowOther?: boolean;
  shuffle?: boolean;
  validation?: FieldValidation;
  config?: FieldConfig;
  logic?: FieldLogic;
  width?: 'full' | 'half';
  animation?: FieldAnimation;
}

export interface FileRef {
  id: string;
  key: string;
  name: string;
  size: number;
  mime: string;
  url: string;
}

export type AnswerValue =
  | string
  | number
  | boolean
  | string[]
  | FileRef[]
  | Record<string, string | string[]>
  | { start?: string; end?: string }
  | null;

export type Answers = Record<string, AnswerValue>;

/* ───────────────────────── Theme ───────────────────────── */

export type TimeOfDay = 'morning' | 'noon' | 'golden' | 'dusk' | 'overcast';
/** the 3D world the letter arrives in */
export type EnvironmentKey = 'park' | 'seaside' | 'atelier' | 'skies';
export type FontKey =
  | 'script'
  | 'elegant'
  | 'serif'
  | 'classic'
  | 'hand'
  | 'marker'
  | 'sans'
  | 'mono'
  | 'typewriter';
export type PaperKind = 'cotton' | 'laid' | 'linen' | 'kraft' | 'parchment' | 'watercolor';
export type LetterRuling = 'plain' | 'lined' | 'dotted' | 'grid';
export type PageTransition = 'flip' | 'slide' | 'fold' | 'stack' | 'fade';
export type LoaderStyle = 'mixed' | 'ink' | 'stamp' | 'plane' | 'leaves' | 'minimal';

export interface FormTheme {
  environment: EnvironmentKey;
  timeOfDay: TimeOfDay;
  /** solid color of the loading screen — it dissolves into dandelion seeds */
  loaderColor: string;
  loaderStyle: LoaderStyle;
  envelopeColor: string;
  envelopePaper: PaperKind;
  /** inside liner pattern color */
  linerColor: string;
  sealColor: string;
  /** logo used as the embossed stamp on the wax seal */
  logoUrl?: string;
  /** optional text engraved on seal when no logo (defaults to title initial) */
  sealMonogram?: string;
  paperColor: string;
  paper: PaperKind;
  ruling: LetterRuling;
  inkColor: string;
  accentColor: string;
  highlightColor: string;
  titleFont: FontKey;
  bodyFont: FontKey;
  labelFont: FontKey;
  /** big title handwritten on the envelope (defaults to form title) */
  envelopeTitle?: string;
  /** small line under the title e.g. "for you, with love" */
  envelopeSubtitle?: string;
  /** hint bubble text on the envelope */
  openHint?: string;
  coverImageUrl?: string;
  /** youtube/vimeo/mp4 url shown on the first page of the letter */
  coverVideoUrl?: string;
  ambientSound: boolean;
  musicUrl?: string;
  dust: boolean;
  fallingLeaves: boolean;
  petals: boolean;
  butterflies: boolean;
  /** 0..1 */
  wind: number;
  fieldAnimation: FieldAnimation;
  pageTransition: PageTransition;
  /** scene camera auto sway */
  cameraSway: boolean;
  /** rounded corners of inputs 0..24 */
  inputRadius: number;
  inputStyle: 'underline' | 'boxed' | 'soft';
}

export interface FormSettings {
  /** max number of input fields per letter page (content blocks don't count) */
  fieldsPerPage: number;
  showProgress: boolean;
  showPageNumbers: boolean;
  greeting?: string;
  /** rich HTML intro shown at the top of the first page */
  introHtml?: string;
  signOff?: string;
  signature?: string;
  nextLabel: string;
  backLabel: string;
  submitLabel: string;
  thankYouHeading: string;
  thankYouHtml?: string;
  redirectUrl?: string;
  confetti: boolean;
  opensAt?: string | null;
  closesAt?: string | null;
  responseLimit?: number | null;
  closedMessage?: string;
  onePerDevice: boolean;
  collectGeo: boolean;
  allowSaveProgress: boolean;
  /** SEO */
  metaDescription?: string;
  ogImageUrl?: string;
  hideBranding?: boolean;
}

export type FormStatus = 'draft' | 'published' | 'closed';

export interface FormDoc {
  id: string;
  slug: string;
  title: string;
  description?: string;
  status: FormStatus;
  fields: FormField[];
  theme: FormTheme;
  settings: FormSettings;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string | null;
  /** version respondents currently see (0 = never published) */
  liveVersion?: number;
  /** when the live version was published */
  livePublishedAt?: string | null;
  /** the draft differs from what respondents see */
  hasUnpublishedChanges?: boolean;
  pinned?: boolean;
}

export interface FormVersionSummary {
  id: string;
  version: number;
  title: string;
  note?: string;
  fieldCount: number;
  questionCount: number;
  environment: EnvironmentKey;
  createdAt: string;
  /** this is what respondents see right now */
  live: boolean;
}

export type WebhookKind = 'json' | 'slack' | 'discord';

export interface WebhookDoc {
  id: string;
  url: string;
  kind: WebhookKind;
  active: boolean;
  /** shown once on creation; afterwards masked */
  secret: string;
  createdAt: string;
  lastDelivery?: WebhookDeliveryDoc | null;
}

export interface WebhookDeliveryDoc {
  id: number;
  event: string;
  attempt: number;
  status: number | null;
  ok: boolean;
  durationMs: number | null;
  error?: string | null;
  responseBody?: string | null;
  createdAt: string;
}

/** what GET /api/public/forms/:slug returns */
export interface PublicForm {
  id: string;
  slug: string;
  title: string;
  description?: string;
  fields: FormField[];
  theme: FormTheme;
  settings: FormSettings;
  /** 'open' | 'closed' | 'not_yet' | 'limit' */
  availability: 'open' | 'closed' | 'not_yet' | 'limit';
}

export interface FormSummary {
  id: string;
  slug: string;
  title: string;
  status: FormStatus;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string | null;
  responseCount: number;
  viewCount: number;
  theme: Pick<FormTheme, 'envelopeColor' | 'sealColor' | 'loaderColor' | 'paperColor' | 'logoUrl' | 'environment' | 'accentColor'>;
  liveVersion?: number;
  hasUnpublishedChanges?: boolean;
  pinned?: boolean;
  /** newest response, if any */
  lastResponseAt?: string | null;
  /** responses per day for the last 14 days (oldest first) */
  spark?: number[];
}

/* ───────────────────────── Responses & analytics ───────────────────────── */

export interface ResponseMeta {
  ip?: string;
  country?: string;
  countryCode?: string;
  region?: string;
  city?: string;
  lat?: number;
  lon?: number;
  timezone?: string;
  userAgent?: string;
  browser?: string;
  os?: string;
  device?: 'desktop' | 'mobile' | 'tablet' | 'bot' | 'unknown';
  referrer?: string;
  utm?: Record<string, string>;
  locale?: string;
  screen?: string;
  /** ms from first view to submit */
  durationMs?: number;
  sessionId?: string;
  /** version of the form the respondent answered */
  formVersion?: number;
}

export interface FormResponse {
  id: string;
  formId: string;
  answers: Answers;
  meta: ResponseMeta;
  starred?: boolean;
  tags?: string[];
  note?: string;
  createdAt: string;
}

export type TrackEventType = 'view' | 'loaded' | 'open' | 'start' | 'page' | 'submit' | 'abandon';

export interface TrackEventInput {
  type: TrackEventType;
  sessionId: string;
  page?: number;
  referrer?: string;
  screen?: string;
  locale?: string;
  timezone?: string;
  utm?: Record<string, string>;
}

export interface SubmitInput {
  answers: Answers;
  sessionId: string;
  startedAt?: number;
  referrer?: string;
  screen?: string;
  locale?: string;
  timezone?: string;
  utm?: Record<string, string>;
}

export interface AnalyticsSummary {
  totals: {
    views: number;
    uniqueVisitors: number;
    opens: number;
    starts: number;
    submissions: number;
    completionRate: number;
    openRate: number;
    avgDurationMs: number;
    medianDurationMs: number;
  };
  funnel: Array<{ step: string; count: number }>;
  timeseries: Array<{ date: string; views: number; opens: number; submissions: number }>;
  byHour: Array<{ hour: number; count: number }>;
  byWeekday: Array<{ weekday: number; count: number }>;
  countries: Array<{ country: string; countryCode?: string; count: number }>;
  cities: Array<{ city: string; country?: string; count: number; lat?: number; lon?: number }>;
  devices: Array<{ device: string; count: number }>;
  browsers: Array<{ browser: string; count: number }>;
  os: Array<{ os: string; count: number }>;
  referrers: Array<{ referrer: string; count: number }>;
  pageDropoff: Array<{ page: number; count: number }>;
  points: Array<{ lat: number; lon: number; city?: string; country?: string; type: string }>;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
