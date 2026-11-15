import { createBrowserRouter } from 'react-router-dom';
import { Layout } from './Layout';
import { ReviewScreen } from '@/features/review/ReviewScreen';

const Placeholder = ({ title }: { title: string }) => <h1 className="text-2xl font-semibold">{title}</h1>;

export const router = createBrowserRouter([
  { path: '/setup', element: <Placeholder title="Hasło pary" /> },
  { path: '/who', element: <Placeholder title="Kto się uczy?" /> },
  { path: '/review', element: <ReviewScreen /> },
  {
    element: <Layout />,
    children: [
      { path: '/', element: <Placeholder title="Heute" /> },
      { path: '/words', element: <Placeholder title="Słowa" /> },
      { path: '/words/:id', element: <Placeholder title="Słowo" /> },
      { path: '/stats', element: <Placeholder title="Statystyki" /> },
      { path: '/settings', element: <Placeholder title="Ustawienia" /> },
      { path: '/settings/about-data', element: <Placeholder title="O danych" /> },
    ],
  },
]);
