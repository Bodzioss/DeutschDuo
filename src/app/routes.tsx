import { createBrowserRouter } from 'react-router-dom';
import { Layout } from './Layout';
import { ReviewScreen } from '@/features/review/ReviewScreen';
import { TodayScreen } from '@/features/today/TodayScreen';
import { WordsScreen } from '@/features/words/WordsScreen';
import { WordDetailScreen } from '@/features/words/WordDetailScreen';
import { StatsScreen } from '@/features/stats/StatsScreen';

const Placeholder = ({ title }: { title: string }) => <h1 className="text-2xl font-semibold">{title}</h1>;

export const router = createBrowserRouter([
  { path: '/setup', element: <Placeholder title="Hasło pary" /> },
  { path: '/who', element: <Placeholder title="Kto się uczy?" /> },
  { path: '/review', element: <ReviewScreen /> },
  {
    element: <Layout />,
    children: [
      { path: '/', element: <TodayScreen /> },
      { path: '/words', element: <WordsScreen /> },
      { path: '/words/:id', element: <WordDetailScreen /> },
      { path: '/stats', element: <StatsScreen /> },
      { path: '/settings', element: <Placeholder title="Ustawienia" /> },
      { path: '/settings/about-data', element: <Placeholder title="O danych" /> },
    ],
  },
]);
