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
import { help as moveToSpaceHelp } from '../components/help/move-to-space.help';
import { help as duplicateToSpaceHelp } from '../components/help/duplicate-to-space.help';
import { help as mergeItemHelp } from '../components/help/merge-item.help';
import { help as articleHelp } from '../pages/help/article.help';
import { help as globalGraphHelp } from '../pages/help/global-graph.help';
import { help as globalSunburstHelp } from '../pages/help/global-sunburst.help';
import { help as globalMindmapHelp } from '../pages/help/global-mindmap.help';
import { help as globalLinksHelp } from '../pages/help/global-links.help';
import { help as adminUsersHelp } from '../pages/help/admin-users.help';
import { help as adminUserAccessHelp } from '../pages/help/admin-user-access.help';
import { help as adminCommunitiesHelp } from '../pages/help/admin-communities.help';
import { help as adminSpacesHelp } from '../pages/help/admin-spaces.help';
import { help as adminAnomaliesHelp } from '../pages/help/admin-anomalies.help';
import { help as adminDuplicatesHelp } from '../pages/help/admin-duplicates.help';
import { help as adminReferentielsHelp } from '../pages/help/admin-referentiels.help';
import { help as adminStatsHelp } from '../pages/help/admin-stats.help';
import { help as adminAuditHelp } from '../pages/help/admin-audit.help';
import { help as adminApiDocHelp } from '../pages/help/admin-api-doc.help';
import { help as adminPerfHelp } from '../pages/help/admin-perf.help';
import { help as adminViewsHelp } from '../pages/help/admin-views.help';

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
  'merge-item': mergeItemHelp,
  'move-to-space': moveToSpaceHelp,
  'duplicate-to-space': duplicateToSpaceHelp,
  article: articleHelp,
  'global-graph': globalGraphHelp,
  'global-sunburst': globalSunburstHelp,
  'global-mindmap': globalMindmapHelp,
  'global-links': globalLinksHelp,
  'admin-users': adminUsersHelp,
  'admin-user-access': adminUserAccessHelp,
  'admin-communities': adminCommunitiesHelp,
  'admin-spaces': adminSpacesHelp,
  'admin-anomalies': adminAnomaliesHelp,
  'admin-duplicates': adminDuplicatesHelp,
  'admin-referentiels': adminReferentielsHelp,
  'admin-stats': adminStatsHelp,
  'admin-audit': adminAuditHelp,
  'admin-api-doc': adminApiDocHelp,
  'admin-perf': adminPerfHelp,
  'admin-views': adminViewsHelp,
} satisfies Record<string, HelpEntry>;

export type PageHelpKey = keyof typeof PAGE_HELP;
