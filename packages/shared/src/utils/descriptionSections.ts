/*
 * Découpage d'une description (HTML de l'éditeur) par ses titres de niveau 2 et 3 : source unique pour la fonction
 * « Éclater en sous-éléments ». La modale web s'en sert pour l'aperçu (une ligne par section), l'API pour l'exécution,
 * pour que ce que l'utilisateur coche soit exactement ce qui est créé.
 * - splitDescriptionSections(html) : texte avant le premier titre + sections (titre en texte, titre HTML brut, corps).
 * - planDescriptionSplit(html, selected?) : sections choisies (indices ; absent = toutes) → sous-éléments ; le texte
 *   avant le premier titre et les sections non choisies (titre compris, à leur place) restent dans la description.
 * Fonctions pures, sans dépendance. Règle de gestion : `item-split-sections` (apps/web/src/lib/businessRules.ts).
 */

export interface DescriptionSection {
  /** Titre en texte brut (balises retirées) : titre du sous-élément créé. */
  title: string;
  /** Balise de titre telle qu'écrite (`<h2>…</h2>`) : remise en place si la section reste dans la description. */
  headingHtml: string;
  /** HTML entre ce titre et le suivant : description du sous-élément créé. */
  body: string;
}

export interface DescriptionSections {
  preContent: string;
  sections: DescriptionSection[];
}

/** La description contient-elle au moins un titre de niveau 2 ou 3 (condition d'affichage de « Éclater ») ? */
export function hasDescriptionHeadings(html?: string | null): boolean {
  return !!html && /<h[2-3][^>]*>/i.test(html);
}

export function splitDescriptionSections(html?: string | null): DescriptionSections {
  const source = html ?? '';
  const headingRegex = /<h([2-3])[^>]*>([\s\S]*?)<\/h[2-3]>/gi;
  const matches: { index: number; end: number; title: string; raw: string }[] = [];
  let match: RegExpExecArray | null;
  while ((match = headingRegex.exec(source)) !== null) {
    matches.push({
      index: match.index,
      end: match.index + match[0].length,
      title: match[2].replace(/<[^>]+>/g, '').trim(),
      raw: match[0],
    });
  }
  if (matches.length === 0) return { preContent: source.trim(), sections: [] };
  return {
    preContent: source.slice(0, matches[0].index).trim(),
    sections: matches.map((m, i) => ({
      title: m.title,
      headingHtml: m.raw,
      body: source.slice(m.end, i + 1 < matches.length ? matches[i + 1].index : source.length).trim(),
    })),
  };
}

export interface DescriptionSplitPlan {
  /** Description qui reste sur l'élément d'origine (null si vide). */
  parentDescription: string | null;
  /** Sous-éléments à créer, dans l'ordre des titres. */
  children: { title: string; description: string | null }[];
}

export function planDescriptionSplit(html: string | null | undefined, selected?: number[]): DescriptionSplitPlan {
  const { preContent, sections } = splitDescriptionSections(html);
  const keep = selected ? new Set(selected) : null;
  const isSplit = (i: number) => !keep || keep.has(i);
  const remaining = [preContent];
  const children: DescriptionSplitPlan['children'] = [];
  sections.forEach((s, i) => {
    if (isSplit(i)) children.push({ title: s.title || 'Sans titre', description: s.body || null });
    else remaining.push(s.headingHtml + s.body);
  });
  const parentDescription = remaining.filter(Boolean).join('');
  return { parentDescription: parentDescription || null, children };
}
