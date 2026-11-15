import { createBrowserRouter } from 'react-router-dom';
import { Layout } from './Layout';
import { AuthGate, ProfileGate } from './guards';
import { PairPasswordScreen } from '@/features/auth/PairPasswordScreen';
import { ProfilePicker } from '@/features/auth/ProfilePicker';
import { ReviewScreen } from '@/features/review/ReviewScreen';
import { TodayScreen } from '@/features/today/TodayScreen';
import { WordsScreen } from '@/features/words/WordsScreen';
import { WordDetailScreen } from '@/features/words/WordDetailScreen';
import { StatsScreen } from '@/features/stats/StatsScreen';
import { SettingsScreen } from '@/features/settings/SettingsScreen';
import { AboutDataScreen } from '@/features/settings/AboutDataScreen';

export const router = createBrowserRouter([
  { path: '/setup', element: <PairPasswordScreen /> },
  {
    element: <AuthGate />,
    children: [
      { path: '/who', element: <ProfilePicker /> },
      {
        element: <ProfileGate />,
        children: [
          { path: '/review', element: <ReviewScreen /> },
          {
            element: <Layout />,
            children: [
              { path: '/', element: <TodayScreen /> },
              { path: '/words', element: <WordsScreen /> },
              { path: '/words/:id', element: <WordDetailScreen /> },
              { path: '/stats', element: <StatsScreen /> },
              { path: '/settings', element: <SettingsScreen /> },
              { path: '/settings/about-data', element: <AboutDataScreen /> },
            ],
          },
        ],
      },
    ],
  },
]);
