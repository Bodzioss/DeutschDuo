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
import { MapScreen } from '@/features/game/MapScreen';
import { BoardScreen } from '@/features/game/BoardScreen';
import { PairScreen } from '@/features/pair/PairScreen';

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
          { path: '/game/:level', element: <BoardScreen /> },
          {
            element: <Layout />,
            children: [
              { path: '/', element: <TodayScreen /> },
              { path: '/game', element: <MapScreen /> },
              { path: '/para', element: <PairScreen /> },
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
