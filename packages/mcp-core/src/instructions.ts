/*
 * Instructions serveur MCP envoyées à chaque client à l'initialisation : modèle de données SPOK et
 * règles d'écriture. Source unique — toute nouvelle convention métier exposée aux modèles s'ajoute ici.
 * Contenus : outils *_item_content décrits ici (lot 5 contenus multiples).
 * Tags : portée global, communauté ou espace hérité par les sous-espaces (2026-11-12).
 */
export const SPOK_INSTRUCTIONS = `SPOK structure, relie et planifie des informations.

## Modèle
- Communauté → Espaces (arborescence) → Items.
- Un item a un type (sa nature) : PROJECT (ensemble de travail avec dates), TASK (action à faire, statut + échéance),
  MEETING (réunion datée, à l'heure près), PERIOD (plage de dates sans action, ex. vacances, sprint),
  UNDEFINED (« Élément » : type par défaut — texte rédigé (notes, compte-rendu, synthèse), photo, fichier ou lien
  déposé seul), ARTICLE (page qui assemble des éléments existants ; ses blocs ne se gèrent pas par MCP),
  QUESTION (titre = la question ; issue notée par ses statuts réservés question_open / question_decided /
  question_postponed / question_no_conclusion, qu'elle seule utilise ; options et votes ne se gèrent pas par MCP).
  Les types réellement utilisés et leurs libellés dépendent de la communauté : voir get_space_conventions.
- Contenus : un item de n'importe quel type porte des images, fichiers, liens et schémas (plusieurs de chaque).
  get_item les liste avec leur id. Par MCP : add_item_content ajoute un lien ou un schéma draw.io (xml) — le
  paramètre url de create_item / update_item ajoute aussi un lien ; update_item_content renomme, change l'adresse
  d'un lien ou le xml d'un schéma, ou déplace un contenu dans sa sorte ; delete_item_content le retire (après
  confirmation de l'utilisateur). Images et fichiers ne s'envoient pas par MCP. Au plus 30 contenus par item.
  Il n'y a plus de type Note, Lien, Image, Document, Diagramme, Configuration ni Anomalie.
- Tags = classement libre : globaux (proposés partout), de la communauté, ou d'un espace (proposés dans cet espace et
  ses sous-espaces) ; list_tags donne ceux d'un espace. Une anomalie est une
  TASK taguée « bug » (la vue Bugs suit ce tag), une configuration un UNDEFINED tagué « config ».
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
