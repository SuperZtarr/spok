/* Aide sous un champ de formulaire (aide utilisateur, phase 3) : une phrase qui dit à quoi sert le champ ou ce qu'il
   change. Le texte vient du champ `fields` de la fiche de la page ou modale (registre help/pageHelp.ts) — ne pas
   écrire l'aide d'un champ en dur dans le formulaire, l'ajouter à la fiche.
   Props : page (clé PAGE_HELP), field (clé dans `fields` — contrôlée par help/coverage.test.ts), className (remplace
   le style par défaut text-xs muted mt-1). Ne rend rien si le texte manque. */
import { PAGE_HELP, type PageHelpKey } from './pageHelp';
import type { HelpEntry } from './types';

interface FieldHelpProps {
  page: PageHelpKey;
  field: string;
  className?: string;
}

export function FieldHelp({ page, field, className }: FieldHelpProps) {
  const text = (PAGE_HELP[page] as HelpEntry).fields?.[field];
  if (!text) return null;
  return <p className={className ?? 'text-xs text-muted-foreground mt-1'}>{text}</p>;
}
