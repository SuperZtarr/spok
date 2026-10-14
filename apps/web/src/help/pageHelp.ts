/*
 * Registre de l'aide des pages et modales (phase 2 de l'aide intégrée) : une fiche par écran, écrite à côté
 * de l'écran (pages/help/<page>.help.ts, components/help/<modale>.help.ts). Lue par HelpButton et
 * usePageTourPulse(clé, PAGE_HELP[clé].tour). La clé sert aussi au « déjà vu » (spok-page-tour-done-<clé>) :
 * ne pas la renommer. Couverture contrôlée par help/coverage.test.ts.
 */
import type { HelpEntry } from './types';
import { help as dashboard } from '../pages/help/dashboard.help';
import { help as itemModal } from '../components/help/item-modal.help';
import { help as communitySettings } from '../pages/help/community-settings.help';
import { help as spaceSettings } from '../pages/help/space-settings.help';
import { help as homePage } from '../pages/help/home.help';
import { help as searchPage } from '../pages/help/search.help';
import { help as activityPage } from '../pages/help/activity.help';
import { help as todayPage } from '../pages/help/today.help';
import { help as tasksPage } from '../pages/help/tasks.help';
import { help as communitiesPage } from '../pages/help/communities.help';
import { help as communityPage } from '../pages/help/community.help';
import { help as spacesPage } from '../pages/help/spaces.help';
import { help as spaceOverviewPage } from '../pages/help/space-overview.help';
import { help as spaceHistoryPage } from '../pages/help/space-history.help';
import { help as bookmarksHelp } from '../pages/help/bookmarks.help';
import { help as profileHelp } from '../components/help/profile.help';
import { help as liveWindowHelp } from '../components/help/live-window.help';
import { help as globalGraphHelp } from '../pages/help/global-graph.help';
import { help as globalSunburstHelp } from '../pages/help/global-sunburst.help';
import { help as globalMindmapHelp } from '../pages/help/global-mindmap.help';
import { help as globalLinksHelp } from '../pages/help/global-links.help';

export const PAGE_HELP = {
  dashboard,
  'item-modal': itemModal,
  'community-settings': communitySettings,
  'space-settings': spaceSettings,
  home: homePage,
  search: searchPage,
  activity: activityPage,
  today: todayPage,
  tasks: tasksPage,
  communities: communitiesPage,
  community: communityPage,
  spaces: spacesPage,
  'space-overview': spaceOverviewPage,
  'space-history': spaceHistoryPage,
  bookmarks: bookmarksHelp,
  profile: profileHelp,
  'live-window': liveWindowHelp,
  'global-graph': globalGraphHelp,
  'global-sunburst': globalSunburstHelp,
  'global-mindmap': globalMindmapHelp,
  'global-links': globalLinksHelp,
} satisfies Record<string, HelpEntry>;

export type PageHelpKey = keyof typeof PAGE_HELP;
