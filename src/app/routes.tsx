import { createBrowserRouter } from 'react-router-dom';
import { Layout } from './Layout';
import { RequireAuth, RequireProfile } from './guards';
import { PairPasswordScreen } from '@/features/auth/PairPasswordScreen';
import { ProfilePicker } from '@/features/auth/ProfilePicker';
import { ReviewScreen } from '@/features/review/ReviewScreen';
import { TodayScreen } from '@/features/today/TodayScreen';
import { WordsScreen } from '@/features/words/WordsScreen';
import { WordDetailScreen } from '@/features/words/WordDetailScreen';
import { StatsScreen } from '@/features/stats/StatsScreen';
import { SettingsScreen } from '@/features/settings/SettingsScreen';
import { AboutDataScreen } from '@/features/settings/AboutDataScreen';

const authed = (el: JSX.Element) => <RequireAuth>{el}</RequireAuth>;
const withProfile = (el: JSX.Element) => authed(<RequireProfile>{el}</RequireProfile>);

export const router = createBrowserRouter([
  { path: '/setup', element: <PairPasswordScreen /> },
  { path: '/who', element: authed(<ProfilePicker />) },
  { path: '/review', element: withProfile(<ReviewScreen />) },
  {
    element: withProfile(<Layout />),
    children: [
      { path: '/', element: <TodayScreen /> },
      { path: '/words', element: <WordsScreen /> },
      { path: '/words/:id', element: <WordDetailScreen /> },
      { path: '/stats', element: <StatsScreen /> },
      { path: '/settings', element: <SettingsScreen /> },
      { path: '/settings/about-data', element: <AboutDataScreen /> },
    ],
  },
]);
