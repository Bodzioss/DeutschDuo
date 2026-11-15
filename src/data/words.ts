import type { Word } from '@/domain/types';

/** Order in which topic files are introduced (new words follow this order). */
export const TOPIC_ORDER: string[] = ['basics'];

export const TOPIC_LABELS: Record<string, string> = {
  basics: 'Podstawy',
};

const modules = import.meta.glob<{ default: Word[] }>('/data/vocab/a1/*.json', { eager: true });

function topicOf(path: string): string {
  return path.split('/').pop()!.replace(/\.json$/, '');
}

const ordered: Word[] = Object.entries(modules)
  .sort(([a], [b]) => {
    const ia = TOPIC_ORDER.indexOf(topicOf(a));
    const ib = TOPIC_ORDER.indexOf(topicOf(b));
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib) || a.localeCompare(b);
  })
  .flatMap(([, m]) => m.default);

const byId = new Map(ordered.map((w) => [w.id, w]));

export const getWords = (): Word[] => ordered;
export const getWord = (id: string): Word | undefined => byId.get(id);
