import { describe, expect, test } from 'vitest';
import { checkAnswer, expectedAnswer, normalize } from '@/domain/answerCheck';
import type { Word } from '@/domain/types';

const w = (p: Partial<Word> & Pick<Word, 'id' | 'de' | 'pos' | 'en'>): Word => ({
  cefr: 'A1', topic: 't', example_de: 'x', example_en: 'x', ...p,
});
const tisch = w({ id: 'der-tisch', de: 'Tisch', article: 'der', plural: 'Tische', pos: 'noun', en: 'table' });
const strasse = w({ id: 'die-strasse', de: 'Straße', article: 'die', plural: 'Straßen', pos: 'noun', en: 'street' });
const haus = w({ id: 'das-haus', de: 'Haus', article: 'das', plural: 'Häuser', pos: 'noun', en: 'house' });
const gehen = w({ id: 'gehen', de: 'gehen', pos: 'verb', en: 'to go', en_prompt: 'to go (on foot)' });
const fahren = w({ id: 'fahren', de: 'fahren', pos: 'verb', en: 'to go; to drive', en_prompt: 'to go (by vehicle)', accept: ['Auto fahren'] });
const schoen = w({ id: 'schoen', de: 'schön', pos: 'adj', en: 'nice; beautiful' });
const nett = w({ id: 'nett', de: 'nett', pos: 'adj', en: 'nice; kind' });
const all = [tisch, strasse, haus, gehen, fahren, schoen, nett];

const v = (word: Word, input: string) => checkAnswer(word, input, all).verdict;

describe('normalize', () => {
  test('lowercases, trims, collapses spaces, maps umlauts, strips final punctuation', () => {
    expect(normalize('  Die   Straße! ')).toBe('die strasse');
    expect(normalize('schön.')).toBe('schoen');
    expect(normalize('Über')).toBe('ueber');
  });
});

describe('expectedAnswer', () => {
  test('noun includes article', () => expect(expectedAnswer(tisch)).toBe('der Tisch'));
  test('verb is bare', () => expect(expectedAnswer(gehen)).toBe('gehen'));
});

describe('checkAnswer', () => {
  test.each(['der Tisch', 'Der Tisch ', 'der tisch.'])('"%s" → correct', (i) => expect(v(tisch, i)).toBe('correct'));
  test('ß ≡ ss', () => {
    expect(v(strasse, 'die Strasse')).toBe('correct');
    expect(v(strasse, 'die Straße')).toBe('correct');
  });
  test('missing article', () => expect(v(tisch, 'Tisch')).toBe('missing_article'));
  test('wrong article', () => expect(v(tisch, 'das Tisch')).toBe('wrong_article'));
  test('transposed letters in noun with ≥5 letters → typo', () => expect(v(tisch, 'der Tsich')).toBe('typo'));
  test('missing letter in 5-letter noun → typo', () => expect(v(tisch, 'der Tisc')).toBe('typo'));
  test('one-letter typo, word ≥5 letters → typo', () => {
    expect(v(strasse, 'die Strase')).toBe('typo');
    expect(v(gehen, 'gehn')).toBe('typo');
  });
  test('short word typo is wrong', () => {
    expect(v(haus, 'das Hsus')).toBe('wrong');
    expect(v(gehen, 'ghn')).toBe('wrong');
  });
  test('clearly wrong', () => expect(v(strasse, 'die Stra')).toBe('wrong'));
  test('other word sharing an English meaning → other_word with no suggested grade', () => {
    const r = checkAnswer(schoen, 'nett', all);
    expect(r.verdict).toBe('other_word');
    expect(r.suggested).toBeNull();
  });
  test('accept list counts as correct', () => expect(v(fahren, 'Auto fahren')).toBe('correct'));
  test('suggested grades', () => {
    expect(checkAnswer(tisch, 'der Tisch', all).suggested).toBe(3);
    expect(checkAnswer(strasse, 'die Strase', all).suggested).toBe(2);
    expect(checkAnswer(tisch, 'Tisch', all).suggested).toBe(1);
    expect(checkAnswer(tisch, 'der Tisch', all).expected).toBe('der Tisch');
  });
});
