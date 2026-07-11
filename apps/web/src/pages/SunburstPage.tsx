/* Sunburst global (/sunburst) : SunburstView en mode global (hiérarchie communautés > espaces > items). */
import { SunburstView } from '../components/views/SunburstView';

export function SunburstPage() {
  return (
    <div className="flex-1 min-h-0 flex flex-col h-full overflow-hidden">
      <SunburstView />
    </div>
  );
}
