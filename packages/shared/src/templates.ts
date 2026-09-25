import { createField, DEFAULT_SETTINGS, DEFAULT_THEME } from './fields';
import type { FormField, FormSettings, FormTheme } from './types';

export interface FormTemplate {
  id: string;
  name: string;
  category: 'Personal' | 'Events' | 'Business' | 'Feedback' | 'Community' | 'Education';
  description: string;
  title: string;
  fields: () => FormField[];
  theme?: Partial<FormTheme>;
  settings?: Partial<FormSettings>;
}

const f = createField;
const opts = (...labels: string[]) => labels.map((label, i) => ({ id: `o${i + 1}`, label }));

export const TEMPLATES: FormTemplate[] = [
  {
    id: 'blank',
    name: 'Blank letter',
    category: 'Personal',
    description: 'Start from an empty sheet of paper.',
    title: 'Untitled letter',
    fields: () => [f('short_text', { label: 'Your name', required: true })],
  },
  {
    id: 'wedding-rsvp',
    name: 'Wedding RSVP',
    category: 'Events',
    description: 'A romantic, golden-hour invitation with guest count and dietary notes.',
    title: 'You’re invited',
    theme: { timeOfDay: 'golden', sealColor: '#7a1f2b', envelopeColor: '#f4ece1', loaderColor: '#f1e4d3', petals: true, envelopeSubtitle: 'to celebrate love, with us' },
    settings: { greeting: 'Dearest guest,', signOff: 'With all our love,', signature: 'A & J', submitLabel: 'Send our RSVP', fieldsPerPage: 3 },
    fields: () => [
      f('paragraph', { config: { html: '<p>We would be <em>honoured</em> to have you by our side as we say <strong>“I do.”</strong></p>' } }),
      f('name', { label: 'Your name', required: true }),
      f('yes_no', { label: 'Will you be joining us?', required: true, config: { yesLabel: 'Joyfully accepts', noLabel: 'Regretfully declines' } }),
      f('number', { label: 'How many guests (including you)?', validation: { min: 1, max: 6 } }),
      f('page_break'),
      f('checkboxes', { label: 'Dietary preferences', options: opts('Vegetarian', 'Vegan', 'Gluten free', 'Halal', 'No restrictions'), allowOther: true }),
      f('dropdown', { label: 'Pick your dinner', options: opts('Herb roasted chicken', 'Seared salmon', 'Wild mushroom risotto') }),
      f('long_text', { label: 'A wish for the couple', placeholder: 'Write from the heart…' }),
    ],
  },
  {
    id: 'birthday',
    name: 'Birthday wishes',
    category: 'Personal',
    description: 'Collect warm wishes, photos and memories for someone special.',
    title: 'Happy Birthday',
    theme: { environment: 'skies', timeOfDay: 'golden', sealColor: '#c2577a', accentColor: '#b84f76', envelopeColor: '#f6eef2', loaderColor: '#f4e9f0', butterflies: true },
    settings: { greeting: 'Hello you,', submitLabel: 'Send my wish', fieldsPerPage: 3 },
    fields: () => [
      f('short_text', { label: 'Your name', required: true }),
      f('long_text', { label: 'Your birthday wish', required: true, placeholder: 'May your year be…' }),
      f('image_upload', { label: 'A photo of a memory together', validation: { maxFiles: 4, maxSizeMb: 15, accept: ['image/*'] } }),
      f('rating', { label: 'How awesome is the birthday person?', config: { ratingMax: 5, ratingIcon: 'heart' } }),
    ],
  },
  {
    id: 'event-registration',
    name: 'Event registration',
    category: 'Events',
    description: 'Tickets, sessions, and contact info for workshops or meetups.',
    title: 'Save your seat',
    theme: { timeOfDay: 'noon', sealColor: '#1f4e5f', envelopeColor: '#eef1ec', loaderColor: '#e6ede8', accentColor: '#1f4e5f' },
    settings: { fieldsPerPage: 4, submitLabel: 'Register' },
    fields: () => [
      f('name', { required: true }),
      f('email', { label: 'Email', required: true }),
      f('phone', { label: 'Phone number' }),
      f('dropdown', { label: 'Ticket type', required: true, options: opts('General', 'Student', 'VIP') }),
      f('multiselect', { label: 'Sessions you’d like to attend', options: opts('Opening keynote', 'Design systems', 'Creative coding', '3D on the web', 'Closing party') }),
      f('consent', { required: true, config: { consentHtml: 'I agree to receive event updates by email.' } }),
    ],
  },
  {
    id: 'customer-feedback',
    name: 'Customer feedback',
    category: 'Feedback',
    description: 'NPS, satisfaction grid and open feedback in one elegant letter.',
    title: 'How did we do?',
    theme: { timeOfDay: 'morning', sealColor: '#2f5d3a', loaderColor: '#e9efe4', envelopeColor: '#f2f0e8' },
    settings: { fieldsPerPage: 3, submitLabel: 'Send feedback' },
    fields: () => [
      f('nps', { required: true }),
      f('matrix', { label: 'Rate your experience', config: { rows: opts('Product quality', 'Delivery', 'Support', 'Value'), columns: opts('Poor', 'Fair', 'Good', 'Excellent') } }),
      f('multiple_choice', { label: 'How did you hear about us?', options: opts('Friend', 'Social media', 'Search', 'Advertisement'), allowOther: true }),
      f('long_text', { label: 'Anything we could do better?' }),
      f('email', { label: 'Email (if you’d like a reply)' }),
    ],
  },
  {
    id: 'job-application',
    name: 'Job application',
    category: 'Business',
    description: 'Collect CVs, portfolios and motivation letters.',
    title: 'Join our team',
    theme: { timeOfDay: 'noon', sealColor: '#22313f', envelopeColor: '#f0eee9', loaderColor: '#ebe8e1', titleFont: 'serif', bodyFont: 'classic' },
    settings: { fieldsPerPage: 4, submitLabel: 'Submit application', greeting: 'Dear applicant,' },
    fields: () => [
      f('name', { required: true }),
      f('email', { required: true }),
      f('phone'),
      f('url', { label: 'Portfolio or LinkedIn' }),
      f('dropdown', { label: 'Role', required: true, options: opts('Designer', 'Engineer', 'Product manager', 'Marketing') }),
      f('file_upload', { label: 'Your CV', required: true, validation: { maxFiles: 1, maxSizeMb: 10, accept: ['.pdf', '.doc', '.docx'] } }),
      f('long_text', { label: 'Why would you love to work with us?', required: true, validation: { minLength: 40 } }),
      f('date', { label: 'Earliest start date' }),
      f('slider', { label: 'Expected salary (k / year)', config: { scaleMin: 20, scaleMax: 250, suffix: 'k' } }),
    ],
  },
  {
    id: 'secret-admirer',
    name: 'Secret admirer',
    category: 'Personal',
    description: 'An anonymous love letter with a dusk ambience.',
    title: 'To someone special',
    theme: { timeOfDay: 'dusk', sealColor: '#9b1d45', envelopeColor: '#f6e9ea', loaderColor: '#f3dfe3', petals: true, titleFont: 'marker', envelopeSubtitle: 'open when you’re ready' },
    settings: { fieldsPerPage: 2, greeting: 'Hey you,', signOff: 'Yours, secretly', submitLabel: 'Seal with a kiss' },
    fields: () => [
      f('long_text', { label: 'What do you want to tell them?', required: true }),
      f('yes_no', { label: 'Should they know it’s you?', config: { yesLabel: 'Maybe…', noLabel: 'Not yet' } }),
      f('color', { label: 'Pick the color of your feelings' }),
    ],
  },
  {
    id: 'workshop-quiz',
    name: 'Class reflection',
    category: 'Education',
    description: 'Short reflection with ratings, ranking and a signature.',
    title: 'Reflection journal',
    theme: { timeOfDay: 'overcast', sealColor: '#4a4e8a', envelopeColor: '#eef0f5', loaderColor: '#e7e9f2', ruling: 'lined', bodyFont: 'hand', labelFont: 'hand' },
    settings: { fieldsPerPage: 3, submitLabel: 'Hand it in' },
    fields: () => [
      f('short_text', { label: 'Your name', required: true }),
      f('scale', { label: 'How confident do you feel about today’s topic?', config: { scaleMin: 1, scaleMax: 7, minLabel: 'Lost', maxLabel: 'Nailed it' } }),
      f('ranking', { label: 'Rank today’s activities', options: opts('Lecture', 'Group work', 'Quiz', 'Demo') }),
      f('long_text', { label: 'One thing you learned' }),
      f('signature', { label: 'Sign here', required: true }),
    ],
  },
  {
    id: 'volunteer',
    name: 'Volunteer sign-up',
    category: 'Community',
    description: 'Availability, skills and shift preferences for volunteers.',
    title: 'Lend a hand',
    theme: { timeOfDay: 'morning', sealColor: '#b3541e', envelopeColor: '#f5efe3', loaderColor: '#f0e6d4', fallingLeaves: true },
    settings: { fieldsPerPage: 4, submitLabel: 'Count me in' },
    fields: () => [
      f('name', { required: true }),
      f('email', { required: true }),
      f('checkboxes', { label: 'When are you available?', options: opts('Weekday mornings', 'Weekday evenings', 'Saturdays', 'Sundays') }),
      f('multiselect', { label: 'Skills you can share', options: opts('Cooking', 'Driving', 'Teaching', 'Design', 'First aid', 'Photography'), allowOther: true }),
      f('date_range', { label: 'Dates you can commit to' }),
      f('address', { label: 'Where are you based?' }),
    ],
  },
  {
    id: 'product-waitlist',
    name: 'Product waitlist',
    category: 'Business',
    description: 'A premium, minimal waitlist with a cover video.',
    title: 'Be the first to know',
    theme: { timeOfDay: 'golden', sealColor: '#111111', envelopeColor: '#f2efe9', loaderColor: '#ece7df', titleFont: 'serif', bodyFont: 'sans', labelFont: 'sans', inputStyle: 'soft' },
    settings: { fieldsPerPage: 3, submitLabel: 'Join the waitlist', greeting: '' },
    fields: () => [
      f('email', { label: 'Your email', required: true }),
      f('multiple_choice', { label: 'What describes you best?', options: opts('Creator', 'Developer', 'Founder', 'Just curious'), config: { layout: 'cards' } }),
      f('country'),
    ],
  },
  {
    id: 'message-bottle',
    name: 'Message in a bottle',
    category: 'Community',
    description: 'Strangers write to strangers — a letter washed ashore at the waterline.',
    title: 'A message from the sea',
    theme: { environment: 'seaside', timeOfDay: 'morning', loaderColor: '#e6f0ef', sealColor: '#2f6f73', accentColor: '#2f6f73', paperColor: '#f8f3e8', paper: 'parchment', envelopeSubtitle: 'found at low tide' },
    settings: { fieldsPerPage: 3, greeting: 'To whoever finds this,', signOff: 'Across the water,', signature: '', submitLabel: 'Cork it & cast it off' },
    fields: () => [
      f('short_text', { label: 'What should we call you?', placeholder: 'A name, or a nickname' }),
      f('country', { label: 'Where are you writing from?' }),
      f('long_text', { label: 'What would you tell a stranger who needed it today?', required: true, placeholder: 'Write it like the sea is listening…' }),
      f('scale', { label: 'How calm is your sea right now?', config: { scaleMin: 1, scaleMax: 5, minLabel: 'Stormy', maxLabel: 'Glassy' } }),
      f('email', { label: 'Want a bottle back? Leave an email' }),
    ],
  },
  {
    id: 'pen-pal',
    name: 'Pen pal introduction',
    category: 'Personal',
    description: 'A handwritten-feeling introduction letter at a sunny writing desk.',
    title: 'Dear pen pal',
    theme: { environment: 'atelier', timeOfDay: 'morning', loaderColor: '#f4ece2', sealColor: '#6b2d3a', accentColor: '#7a3b46', ruling: 'lined', bodyFont: 'classic', labelFont: 'hand', envelopeSubtitle: 'written by the window' },
    settings: { fieldsPerPage: 3, greeting: 'Dear new friend,', signOff: 'Write back soon,', submitLabel: 'Fold & send' },
    fields: () => [
      f('name', { required: true }),
      f('short_text', { label: 'What does your window look out on?' }),
      f('checkboxes', { label: 'Things you love', options: opts('Books', 'Music', 'Tea & coffee', 'Travel', 'Cooking', 'Rainy days'), allowOther: true }),
      f('long_text', { label: 'Tell me about your perfect morning' }),
      f('image_upload', { label: 'A photo of your corner of the world', validation: { maxFiles: 2, maxSizeMb: 12, accept: ['image/*'] } }),
      f('email', { label: 'Where should I write back?', required: true }),
    ],
  },
  {
    id: 'guestbook',
    name: 'Guest book',
    category: 'Community',
    description: 'Let visitors leave a note, a doodled signature and a photo.',
    title: 'Leave a note',
    theme: { timeOfDay: 'golden', sealColor: '#6b4226', envelopeColor: '#efe3cf', envelopePaper: 'kraft', paper: 'parchment', paperColor: '#f6eedd', loaderColor: '#eadcc3' },
    settings: { fieldsPerPage: 3, submitLabel: 'Sign the book' },
    fields: () => [
      f('short_text', { label: 'Your name' }),
      f('long_text', { label: 'Your note', required: true }),
      f('image_upload', { label: 'Add a photo', validation: { maxFiles: 1, maxSizeMb: 10, accept: ['image/*'] } }),
      f('signature', { label: 'Your signature' }),
    ],
  },
];

export function templateToForm(t: FormTemplate): { title: string; fields: FormField[]; theme: FormTheme; settings: FormSettings } {
  return {
    title: t.title,
    fields: t.fields(),
    theme: { ...DEFAULT_THEME, ...(t.theme ?? {}) },
    settings: { ...DEFAULT_SETTINGS, ...(t.settings ?? {}) },
  };
}
