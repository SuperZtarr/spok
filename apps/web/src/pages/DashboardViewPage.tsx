import { HelpCircle } from 'lucide-react';
import { MyOrganizationView } from '../components/views/MyOrganizationView';
import { usePageTourPulse } from '../hooks/useOnboarding';
import { DASHBOARD_TOUR } from '../hooks/viewTours';

export function DashboardViewPage() {
  const { pulseHelp, startTour } = usePageTourPulse('dashboard', DASHBOARD_TOUR);

  return (
    <div className="flex-1 min-h-0 flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-end px-4 pt-2 pb-0 flex-shrink-0">
        <button
          onClick={startTour}
          className={`inline-flex items-center justify-center w-8 h-8 rounded-md border border-input bg-background shadow-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors${pulseHelp ? ' animate-pulse ring-2 ring-primary ring-offset-2' : ''}`}
          title="Aide sur cette vue"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>
      <MyOrganizationView />
    </div>
  );
}
