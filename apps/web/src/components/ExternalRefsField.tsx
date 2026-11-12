/*
 * Références externes d'un élément (règle item-external-refs, décision Thomas 2026-11-12) : identifiants de l'élément
 * dans d'autres outils, saisis sur UNE ligne « Appli1 : Réf1 | appli2 : réf2 » (« | » sépare les entrées, « : » le nom
 * de l'application de la référence). Découpe et mise en forme : @spok/shared (constants/externalRefs.ts).
 * - ExternalRefsList : affichage — nom de l'application en gras, entrées séparées par un « | » estompé. Rien si vide.
 * - ExternalRefsInput : saisie (texte libre, normalisé quand on quitte le champ) + aperçu mis en forme dessous.
 * Usage : ItemEditModal (fiche complète, saisie ou lecture), ItemReadView (mode Afficher). La valeur enregistrée est
 * la liste découpée (splitExternalRefs), envoyée par « Enregistrer » avec les autres champs.
 */
import { Fragment } from 'react';
import { parseExternalRef, splitExternalRefs, formatExternalRefs } from '@spok/shared';
import { Input } from './ui/Input';

export function ExternalRefsList({ refs, className = '' }: { refs: string[] | null | undefined; className?: string }) {
  if (!refs?.length) return null;
  return (
    <span className={`inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5 ${className}`} data-testid="external-refs">
      {refs.map((value, i) => {
        const { app, ref } = parseExternalRef(value);
        return (
          <Fragment key={`${value}-${i}`}>
            {i > 0 && <span className="text-muted-foreground" aria-hidden>|</span>}
            <span>{app && <><span className="font-semibold">{app}</span> : </>}{ref}</span>
          </Fragment>
        );
      })}
    </span>
  );
}

interface ExternalRefsInputProps {
  value: string;
  onChange: (text: string) => void;
  placeholder?: string;
}

export function ExternalRefsInput({ value, onChange, placeholder }: ExternalRefsInputProps) {
  const refs = splitExternalRefs(value);
  return (
    <div className="space-y-1">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        // Quitter le champ remet la saisie au propre (espaces, doublons) sans changer son sens
        onBlur={() => { const clean = formatExternalRefs(refs); if (clean !== value) onChange(clean); }}
        placeholder={placeholder}
        aria-label="Références externes"
      />
      {refs.length > 0 && <ExternalRefsList refs={refs} className="text-xs" />}
    </div>
  );
}
