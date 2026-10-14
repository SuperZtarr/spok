/* Tableau de bord (/dashboard) : MyDashboardView (aujourd'hui, échéances, assignés à moi).
   Aide : fiche PAGE_HELP.dashboard (pages/help/dashboard.help.ts) via PageHelpButton. */
import { MyDashboardView } from '../components/views/MyDashboardView';
import { PageHelpButton } from '../help/PageHelpButton';

export function DashboardViewPage() {
  return (
    <div className="flex-1 min-h-0 flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-end px-4 pt-2 pb-0 flex-shrink-0">
        <PageHelpButton pageKey="dashboard" />
      </div>
      <MyDashboardView />
    </div>
  );
}
