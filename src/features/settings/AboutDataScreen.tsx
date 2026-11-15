import { Link } from 'react-router-dom';

export function AboutDataScreen() {
  return (
    <div className="space-y-4">
      <Link to="/settings" className="text-sm text-muted">← Ustawienia</Link>
      <h1 className="text-2xl font-bold">O danych</h1>
      <section className="space-y-3 rounded-2xl bg-surface p-4 text-sm leading-relaxed ring-1 ring-muted/10">
        <p>
          Lista słów A1 została ułożona na podstawie zakresu tematycznego poziomu A1 (Goethe-Institut). Rodzajniki i liczby mnogie
          zostały zweryfikowane z danymi{' '}
          <a className="text-accent underline" href="https://en.wiktionary.org/" target="_blank" rel="noreferrer">Wiktionary</a>{' '}
          w opracowaniu{' '}
          <a className="text-accent underline" href="https://kaikki.org/" target="_blank" rel="noreferrer">Wiktextract (kaikki.org)</a>.
        </p>
        <p>
          Dane Wiktionary są dostępne na licencji{' '}
          <a className="text-accent underline" href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">
            CC BY-SA 4.0
          </a>
          . Zmiany: wybór haseł, weryfikacja rodzaju i liczby mnogiej, własne tłumaczenia i zdania przykładowe. Dane słownikowe aplikacji
          udostępniamy na tej samej licencji.
        </p>
        <p className="text-muted">Wymowa: synteza mowy wbudowana w urządzenie (Web Speech API).</p>
      </section>
    </div>
  );
}
