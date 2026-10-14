/* Sunburst global (/sunburst) : SunburstView en mode global (hiérarchie communautés > espaces > items). */
import { SunburstView } from '../components/views/SunburstView';
import { PageHelpButton } from '../help/PageHelpButton';

export function SunburstPage() {
  return (
    <div className="relative flex-1 min-h-0 flex flex-col h-full overflow-hidden">
      <div className="absolute top-3 left-3 z-20"><PageHelpButton pageKey="global-sunburst" /></div>
      <SunburstView />
    </div>
  );
}
