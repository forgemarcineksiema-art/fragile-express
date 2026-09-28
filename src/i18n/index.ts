import { registerLanguage, setFallback } from '../core/i18n.ts';
import { en } from './en.ts';
import { pl } from './pl.ts';

export const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  pl: 'Polski',
};

export function registerLanguages(): void {
  registerLanguage('en', en);
  registerLanguage('pl', pl);
  setFallback('en');
}
