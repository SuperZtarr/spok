/* Badge dev-only affichant le nom d'une modale "maison" (overlay fait main, pas Modal.tsx) —
 * même style que le badge intégré à Modal.tsx, pour garder un vocabulaire commun entre modales
 * quel que soit leur mode d'implémentation (cf. DevZoneInspector). */
import { useDevMode } from '../DevDbStatus';

export function DevModalBadge({ name }: { name: string }) {
  const devMode = useDevMode();
  if (!devMode) return null;
  return (
    <span className="shrink-0 text-[10px] font-mono uppercase tracking-wide bg-black/80 text-white px-1.5 py-0.5 rounded">
      {name}
    </span>
  );
}
