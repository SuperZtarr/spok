/*
 * Découpage d'une description (HTML de l'éditeur) pour « Éclater en sous-éléments » : source unique partagée par la
 * fenêtre de choix (aperçu) et l'API (exécution), pour que ce que l'utilisateur coche soit exactement ce qui est créé.
 * Premier niveau = titres H2 (demande Thomas 2026-11-27) : une section par H2, qui embarque ses H3 (subsections).
 * - splitDescriptionSections(html) : texte avant le premier H2 + sections H2 (titre, titre HTML brut, corps complet,
 *   intro = corps avant le premier H3, subsections = H3 de la section).
 * - planDescriptionSplit(html, selection?) : H2 choisis (indices ; absent = tous) → sous-éléments ; H3 choisis
 *   ([h2, h3] ; absent = aucun) → sous-éléments de leur H2. Un H3 non choisi reste dans la description de son H2 ;
 *   un H3 d'un H2 non choisi est ignoré (la section entière reste). Le texte avant le premier H2 (H3 éventuels
 *   compris) et les H2 non choisis (titre compris, à leur place) restent dans la description d'origine.
 * Fonctions pures, sans dépendance. Règle de gestion : `item-split-sections` (apps/web/src/lib/businessRules.ts).
 */

export interface DescriptionSubsection {
  /** Titre en texte brut (balises retirées) : titre du sous-élément créé. */
  title: string;
  /** Balise de titre telle qu'écrite (`<h3>…</h3>`) : remise en place si le H3 reste dans la description. */
  headingHtml: string;
  /** HTML entre ce titre et le suivant. */
  body: string;
}

export interface DescriptionSection extends DescriptionSubsection {
  /** Corps complet (`body`) : texte et H3 jusqu'au H2 suivant. `intro` : partie avant le premier H3. */
  intro: string;
  subsections: DescriptionSubsection[];
}

export interface DescriptionSections {
  preContent: string;
  sections: DescriptionSection[];
}

/** La description contient-elle au moins un titre H2 (condition d'affichage de « Éclater ») ? */
export function hasDescriptionHeadings(html?: string | null): boolean {
  return !!html && /<h2[\s>]/i.test(html);
}

/** Coupe `source` à chaque titre du niveau donné : texte d'avant + une partie par titre. */
function cutAtHeadings(source: string, level: 2 | 3): { before: string; parts: DescriptionSubsection[] } {
  const regex = new RegExp(`<h${level}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/h${level}>`, 'gi');
  const matches: { index: number; end: number; title: string; raw: string }[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(source)) !== null) {
    matches.push({
      index: match.index,
      end: match.index + match[0].length,
      title: match[1].replace(/<[^>]+>/g, '').trim(),
      raw: match[0],
    });
  }
  if (matches.length === 0) return { before: source.trim(), parts: [] };
  return {
    before: source.slice(0, matches[0].index).trim(),
    parts: matches.map((m, i) => ({
      title: m.title,
      headingHtml: m.raw,
      body: source.slice(m.end, i + 1 < matches.length ? matches[i + 1].index : source.length).trim(),
    })),
  };
}

export function splitDescriptionSections(html?: string | null): DescriptionSections {
  const { before, parts } = cutAtHeadings(html ?? '', 2);
  return {
    preContent: before,
    sections: parts.map((p) => {
      const sub = cutAtHeadings(p.body, 3);
      return { ...p, intro: sub.before, subsections: sub.parts };
    }),
  };
}

/** Choix de la fenêtre : H2 (indices) et H3 ([indice du H2, indice du H3 dans sa section]). */
export interface DescriptionSplitSelection {
  sections?: number[];
  subsections?: [number, number][];
}

/** Corps de POST /items/:id/split : choix de la fenêtre + destination des contenus déplacés (absents = restent). */
export interface DescriptionSplitRequest extends DescriptionSplitSelection {
  contents?: { contentId: string; section: number; subsection?: number }[];
}

export interface DescriptionSplitChild {
  title: string;
  description: string | null;
  /** Indice du H2 d'origine (et du H3 pour un sous-élément de niveau 2) : destination des contenus déplacés. */
  section: number;
  subsection?: number;
  /** Sous-éléments issus des H3 choisis (vide pour un H3). */
  children: DescriptionSplitChild[];
}

export interface DescriptionSplitPlan {
  /** Description qui reste sur l'élément d'origine (null si vide). */
  parentDescription: string | null;
  /** Sous-éléments à créer, dans l'ordre des titres. */
  children: DescriptionSplitChild[];
}

export function planDescriptionSplit(html: string | null | undefined, selection?: DescriptionSplitSelection): DescriptionSplitPlan {
  const { preContent, sections } = splitDescriptionSections(html);
  const keep = selection?.sections ? new Set(selection.sections) : null;
  const subKeep = new Set((selection?.subsections ?? []).map(([s, sub]) => `${s}.${sub}`));
  const remaining = [preContent];
  const children: DescriptionSplitChild[] = [];
  sections.forEach((s, i) => {
    if (keep && !keep.has(i)) { remaining.push(s.headingHtml + s.body); return; }
    const own = [s.intro];
    const subChildren: DescriptionSplitChild[] = [];
    s.subsections.forEach((sub, j) => {
      if (subKeep.has(`${i}.${j}`)) {
        subChildren.push({ title: sub.title || 'Sans titre', description: sub.body || null, section: i, subsection: j, children: [] });
      } else {
        own.push(sub.headingHtml + sub.body);
      }
    });
    const description = subChildren.length > 0 ? own.filter(Boolean).join('') : s.body;
    children.push({ title: s.title || 'Sans titre', description: description || null, section: i, children: subChildren });
  });
  const parentDescription = remaining.filter(Boolean).join('');
  return { parentDescription: parentDescription || null, children };
}
