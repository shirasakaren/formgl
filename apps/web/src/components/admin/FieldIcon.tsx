import {
  AlignLeft, Calendar, CalendarClock, CalendarRange, ChevronDown, CircleDot, Clock, DollarSign, EyeOff, Gauge, Globe, Grid3x3, Hash, Heading, Image, ImagePlus,
  Link, ListChecks, ListOrdered, Mail, MapPin, Minus, MoveVertical, Palette, Paperclip, PenLine, Phone, Pilcrow, Quote, SeparatorHorizontal, ShieldCheck,
  SlidersHorizontal, SquareCheck, SquarePlay, Star, ToggleLeft, TrendingUp, Type, User, type LucideIcon,
} from 'lucide-react';
import { FIELD_META, type FieldType } from '@formgl/shared';

const ICONS: Record<string, LucideIcon> = {
  AlignLeft, Calendar, CalendarClock, CalendarRange, ChevronDown, CircleDot, Clock, DollarSign, EyeOff, Gauge, Globe, Grid3x3, Hash, Heading, Image, ImagePlus,
  Link, ListChecks, ListOrdered, Mail, MapPin, Minus, MoveVertical, Palette, Paperclip, PenLine, Phone, Pilcrow, Quote, SeparatorHorizontal, ShieldCheck,
  SlidersHorizontal, SquareCheck, Star, ToggleLeft, TrendingUp, Type, User, Youtube: SquarePlay,
};

export function fieldIcon(type: FieldType): LucideIcon {
  return ICONS[FIELD_META[type]?.icon] ?? Type;
}

export function FieldIcon({ type, className }: { type: FieldType; className?: string }) {
  const Icon = fieldIcon(type);
  return <Icon className={className ?? 'size-4'} aria-hidden />;
}
