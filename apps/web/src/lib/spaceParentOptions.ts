/*
 * Options « Espace parent » d'un formulaire d'espace (création, déplacement) : arbre aplati et indenté
 * des espaces de groupe d'UNE communauté (communityId null = espaces indépendants, hors communauté).
 * - excludeSubtreeOf : espace déplacé — lui et ses descendants sont exclus (pas de cycle).
 * - Seuls les espaces GROUP peuvent être parents (règle API POST/PATCH /spaces).
 * Fonction pure, testée (spaceParentOptions.test.ts) ; utilisée par CreateSpaceModal et MoveSpaceModal.
 */

export interface ParentCandidate {
  id: string;
  name: string;
  type: string;
  parentId?: string | null;
  communityId?: string | null;
}

export interface ParentOption {
  value: string;
  label: string;
}

/** Libellé de l'option « pas de parent ». */
export const ROOT_OPTION_LABEL = 'Aucun (espace de premier niveau)';

export function buildParentOptions(
  spaces: ParentCandidate[],
  communityId: string | null,
  excludeSubtreeOf?: string,
): ParentOption[] {
  const inScope = spaces.filter((s) => (s.communityId ?? null) === communityId && s.type !== 'PERSONAL');
  const ids = new Set(inScope.map((s) => s.id));
  const childrenOf = new Map<string | null, ParentCandidate[]>();
  for (const s of inScope) {
    // Parent hors du périmètre (inaccessible ou autre communauté) → traité comme racine
    const key = s.parentId && ids.has(s.parentId) ? s.parentId : null;
    if (!childrenOf.has(key)) childrenOf.set(key, []);
    childrenOf.get(key)!.push(s);
  }
  for (const list of childrenOf.values()) list.sort((a, b) => a.name.localeCompare(b.name, 'fr'));

  const options: ParentOption[] = [{ value: '', label: ROOT_OPTION_LABEL }];
  const walk = (parentKey: string | null, depth: number) => {
    for (const s of childrenOf.get(parentKey) ?? []) {
      if (s.id === excludeSubtreeOf) continue; // son sous-arbre entier est sauté
      if (s.type === 'GROUP') {
        options.push({ value: s.id, label: `${'   '.repeat(depth)}${depth > 0 ? '└ ' : ''}${s.name}` });
      }
      walk(s.id, depth + 1);
    }
  };
  walk(null, 0);
  return options;
}
