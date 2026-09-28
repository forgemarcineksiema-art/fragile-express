import { describe, expect, it } from 'vitest';
import { detectLanguage, registerLanguage, setFallback, setLanguage, t } from '../core/i18n.ts';
import { DICTS, LANGUAGE_NAMES } from './index.ts';

describe('dictionaries', () => {
  const base = Object.keys(DICTS.en!).sort();

  for (const [code, dict] of Object.entries(DICTS)) {
    it(`${code} has every key and no extras`, () => {
      expect(Object.keys(dict).sort()).toEqual(base);
      expect(LANGUAGE_NAMES[code]).toBeTruthy();
    });

    it(`${code} keeps the placeholders of every string`, () => {
      for (const key of base) {
        const want = (DICTS.en![key]!.match(/\{\w+\}/g) ?? []).sort();
        const got = (dict[key]!.match(/\{\w+\}/g) ?? []).sort();
        expect(got, `${code}:${key}`).toEqual(want);
      }
    });
  }
});

describe('i18n runtime', () => {
  it('translates with params and falls back to English', () => {
    registerLanguage('en', { a: 'Hello {name}', b: 'only english' });
    registerLanguage('pl', { a: 'Cześć {name}' });
    setFallback('en');
    setLanguage('pl');
    expect(t('a', { name: 'Ola' })).toBe('Cześć Ola');
    expect(t('b')).toBe('only english');
    expect(t('missing')).toBe('missing');
    expect(detectLanguage(['pl-PL', 'en-US'])).toBe('pl');
    expect(detectLanguage(['xx'])).toBe('en');
  });
});
