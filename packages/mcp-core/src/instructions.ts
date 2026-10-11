/*
 * Instructions serveur MCP envoyées à chaque client à l'initialisation : modèle de données SPOK et
 * règles d'écriture. Source unique — toute nouvelle convention métier exposée aux modèles s'ajoute ici.
 */
export const SPOK_INSTRUCTIONS = `SPOK structure, relie et planifie des informations.

## Modèle
- Communauté → Espaces (arborescence) → Items.
- Un item a un type : PROJECT (ensemble de travail avec dates), TASK (action à faire, statut + échéance),
  MEETING (réunion datée), NOTE (texte libre), DOCUMENT (texte long structuré), LINK (url obligatoire),
  PERIOD (plage de dates sans action, ex. vacances, sprint), BUG (anomalie à corriger), IMAGE, DIAGRAM, CONFIG.
  Les types réellement utilisés et leurs libellés dépendent de la communauté : voir get_space_conventions.
- Hiérarchie (parentId) : décomposition. Un PROJECT contient des TASK ; une TASK peut contenir des sous-TASK.
  Le parent doit être dans le même espace.
- Relations (create_relation), entre items qui ne sont pas parent/enfant :
  blocks = la source empêche la cible de démarrer ; implements = la source réalise/permet la cible ;
  drives = la source pilote la cible (décaler la source décale la cible) ; relates = simple lien.

## Règles d'écriture (obligatoires)
1. Avant toute création ou modification dans un espace, appelle get_space_conventions(spaceId) une fois
   et utilise exclusivement les statuts et types qu'il renvoie.
2. Les descriptions et contributions s'écrivent en Markdown (titres, listes, liens) — pas de HTML.
3. Dates : AAAA-MM-JJ ou ISO 8601. startDate ≤ endDate. dueDate = échéance d'une tâche.
4. Priorité : 1 (basse) à 4 (critique), à omettre si non pertinente.
5. Titres courts et explicites (pas de phrase entière) ; le détail va dans la description.
6. Avant de créer, cherche un doublon (search_items) ; préfère update_item à la création d'un quasi-doublon.
7. Si un outil renvoie une erreur de convention, corrige la valeur avec la liste fournie et réessaie.
8. Ne supprime rien sans confirmation explicite de l'utilisateur.
9. Tags : utilise uniquement les tags existants de l'espace (get_space_conventions ou list_tags) ; n'en invente pas.
   Dans update_item, tags remplace la liste complète : reprends les tags existants de l'item à conserver.`
