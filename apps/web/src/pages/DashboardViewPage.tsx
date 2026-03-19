import { MyOrganizationView } from '../components/views/MyOrganizationView';

export function DashboardViewPage() {
  return (
    <div className="flex-1 min-h-0 flex flex-col h-full overflow-hidden">
      <MyOrganizationView />
    </div>
  );
}
