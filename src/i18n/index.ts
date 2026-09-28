import { registerLanguage, setFallback, type Dict } from '../core/i18n.ts';
import { de } from './de.ts';
import { en } from './en.ts';
import { es } from './es.ts';
import { fr } from './fr.ts';
import { it } from './it.ts';
import { nl } from './nl.ts';
import { pl } from './pl.ts';
import { pt } from './pt.ts';
import { ru } from './ru.ts';
import { tr } from './tr.ts';

export const DICTS: Record<string, Dict> = { en, pl, de, es, fr, pt, it, tr, nl, ru };

export const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  pl: 'Polski',
  de: 'Deutsch',
  es: 'Español',
  fr: 'Français',
  pt: 'Português',
  it: 'Italiano',
  tr: 'Türkçe',
  nl: 'Nederlands',
  ru: 'Русский',
};

export function registerLanguages(): void {
  for (const [code, dict] of Object.entries(DICTS)) registerLanguage(code, dict);
  setFallback('en');
}
