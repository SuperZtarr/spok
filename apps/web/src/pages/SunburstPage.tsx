/* Page « Panorama » (/sunburst, clé global-sunburst — libellé dans MENU_REGISTRY) : SunburstView en mode global
   (hiérarchie communautés > espaces > items). Ex-« Sunburst global », renommée le 2026-11-18. */
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
