/*
 * ItemModeSwitch — sélecteur des affichages d'un élément : Lire | Modifier | Composer (décision Thomas 2026-11-26).
 * Le même composant, au même endroit (en haut à gauche), sur la fiche (ItemEditModal), la page d'un article
 * (ArticlePage) et le canevas d'un process (ProcessView) : on passe d'un affichage à l'autre en un clic.
 * Libellés et icônes : registre constants/itemActions.ts (ITEM_ACTIONS, ITEM_MODES) — jamais écrits ici.
 * Props : entries = les modes proposés à cet endroit, dans n'importe quel ordre (rangés selon ITEM_MODES) ; chacun
 * actif ou non, avec soit `to` (lien, éventuellement `state` et `onNavigate` — ex. fermer la fiche), soit `onClick` ;
 * disabled, hint (rappel fonctionnel, texte de la fiche d'aide de l'écran).
 * Un mode absent n'est pas affiché (ex. Modifier et Composer pour qui ne peut pas modifier) ; une seule entrée →
 * rien n'est affiché (pas de choix). Repère d'aide (data-tour) : posé en littéral par l'appelant sur un conteneur
 * autour du sélecteur — le test de couverture de l'aide ne reconnaît que les littéraux.
 */
import { Link } from 'react-router-dom';
import { ITEM_ACTIONS, ITEM_MODES, type ItemMode } from '../../constants/itemActions';
import { HelpHint } from '../../help/HelpHint';

export type ModeEntry = {
  mode: ItemMode;
  active?: boolean;
  to?: string;
  state?: unknown;
  replace?: boolean;
  onNavigate?: () => void;
  onClick?: () => void;
  disabled?: boolean;
  hint?: string;
};

const SIZES = {
  xs: { button: 'px-2 py-1 text-xs gap-1', icon: 'w-3 h-3' },
  sm: { button: 'px-2.5 py-1 text-sm gap-1', icon: 'w-3.5 h-3.5' },
};

export function ItemModeSwitch({ entries, size = 'xs' }: { entries: ModeEntry[]; size?: keyof typeof SIZES }) {
  const shown = ITEM_MODES.map((m) => entries.find((e) => e.mode === m)).filter((e): e is ModeEntry => !!e);
  if (shown.length < 2) return null;
  const s = SIZES[size];
  return (
    <div className="flex items-center rounded-md bg-muted p-0.5 flex-shrink-0" role="group" aria-label="Affichage de l'élément">
      {shown.map((e) => {
        const { label, icon: Icon } = ITEM_ACTIONS[e.mode];
        const cls = `flex items-center ${s.button} font-medium rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${e.active ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`;
        const content = <><Icon className={s.icon} /><span>{label}</span></>;
        const control = e.to && !e.disabled && !e.active ? (
          <Link to={e.to} state={e.state} replace={e.replace} onClick={e.onNavigate} aria-pressed={false} className={cls}>{content}</Link>
        ) : (
          <button type="button" aria-pressed={!!e.active} disabled={e.disabled} onClick={e.active ? undefined : e.onClick} className={cls}>{content}</button>
        );
        return <HelpHint key={e.mode} text={e.hint}>{control}</HelpHint>;
      })}
    </div>
  );
}
