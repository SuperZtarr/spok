/*
 * ItemPageHeader — bandeau commun des pages de travail d'un élément (décision Thomas 2026-11-26 : « uniformiser le
 * bandeau ») : la page d'un article (ArticlePage) et le canevas d'un process (ProcessView) ont exactement le même.
 * De gauche à droite : « ← Retour » (là d'où l'on vient — vue d'origine, sinon le contenu de l'espace), le titre de
 * l'élément, le sélecteur Lire | Modifier | Composer (ItemModeSwitch size="sm"), puis à droite les actions propres
 * à l'écran (Imprimer, Réorganiser…) et le « ? ».
 * Props : back (to = lien avec state éventuel, ou onClick), backHint, title, modes (le sélecteur, entouré par
 * l'appelant d'un conteneur au repère d'aide littéral — le test de couverture ne reconnaît que les littéraux),
 * actions et help (à droite), containerProps (id / data-* de l'appelant : barre de vue compacte du canevas).
 * Ne pas recréer un bandeau propre à un type : tout passe ici.
 */
import type { HTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { HelpHint } from '../../help/HelpHint';

type Back = { to: string; state?: unknown } | { onClick: () => void };

export function ItemPageHeader({ back, backHint, title, modes, actions, help, containerProps, className = '' }: {
  back: Back;
  backHint?: string;
  title?: ReactNode;
  modes: ReactNode;
  actions?: ReactNode;
  help?: ReactNode;
  containerProps?: HTMLAttributes<HTMLDivElement> & Record<`data-${string}`, string>;
  className?: string;
}) {
  const backCls = 'inline-flex items-center gap-1 h-8 px-2 rounded text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground flex-shrink-0';
  const inner = <><ArrowLeft className="w-4 h-4" /><span className="hidden sm:inline vh-label">Retour</span></>;
  const backControl = 'to' in back
    ? <Link to={back.to} state={back.state} className={backCls}>{inner}</Link>
    : <button type="button" onClick={back.onClick} className={backCls}>{inner}</button>;
  return (
    <div {...containerProps} className={`flex items-center gap-2 min-w-0 ${className}`}>
      <HelpHint text={backHint}>{backControl}</HelpHint>
      {title && <span className="min-w-0 truncate text-sm font-semibold">{title}</span>}
      {modes}
      <div className="flex-1" />
      {actions}
      {help}
    </div>
  );
}
