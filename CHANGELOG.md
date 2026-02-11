# CHANGELOG

## [2026-02-11]

### Ajouts
- Ajout de la vue Sunburst dans le Dashboard : visualisation hiérarchique interactive en anneaux concentriques (Global → Communautés → Espaces → Items → Enfants) avec navigation au clic et fil d'Ariane au survol
- Ajout de la vue Texte : affichage des items en mode document lisible avec hiérarchie, descriptions et contributions inline, et recherche dans tous les champs
- Ajout du nœud central espace dans la vue graphe au niveau espace, relié aux items racines par des liens hiérarchiques
- Ajout du support d'upload d'images via Cloudflare R2 (CDN) avec drag & drop, prévisualisation, traitement automatique (redimensionnement 1920px, conversion WebP) et suppression d'anciennes images
- Ajout du type BUG (Anomalies) aux types d'items disponibles
- Ajout du script `dev:start` pour démarrage complet en une commande (Docker, PostgreSQL, libération des ports, pnpm dev)

### Modifications
- Refonte complète de la vue MindMap avec d3-hierarchy : layout radial mathématiquement correct, drag familial (déplacer un nœud déplace tous ses descendants), groupes PROJECT simplifiés
- Migration du port PostgreSQL de 15433 vers 25432 pour éviter les conflits avec les plages réservées Hyper-V
- Amélioration du rendu HTML dans la vue Texte : affichage du contenu riche (gras, listes, liens) au lieu du texte brut

### Corrections
- Correction du défilement des pages : ajout de `overflow-auto` sur le conteneur principal du Layout pour permettre le scroll sur toutes les pages
- Correction de l'affichage plein écran du graphe sur grand écran : restauration du flexbox sur le conteneur principal
- Correction de la restauration d'éléments supprimés : le POST envoyait un body vide rejeté par le serveur, fonctionne maintenant correctement
- Correction du placement des éléments restaurés : si le parent a été supprimé, l'élément est replacé à la racine de l'espace

## [2026-02-10]

### Ajouts
- Ajout de la page d'accueil publique (Landing Page) pour les visiteurs non connectés avec présentation des fonctionnalités et modes de visualisation
- Ajout du logo large et tagline "Single Point Of Knowledge" dans le hero de la landing page
- Ajout de l'optimistic locking sur les items avec détection des éditions concurrentes et dialogue de résolution de conflit champ par champ
- Ajout des statuts "Bloqué" et "En retard" avec recolorisation de l'ensemble des statuts

### Modifications
- Amélioration de la vue MindMap : le filtre par type devient un highlight (opacité 35% sur les autres types) au lieu d'un masquage
- Amélioration du contraste dans la MindMap : couleur de texte automatique (clair/foncé) selon la luminosité du fond
- Amélioration de la suppression d'items : ajout d'une confirmation avec affichage du titre et avertissement si l'item a des enfants qui deviendront orphelins

### Corrections
- Correction du cache navigateur : ajout de `no-cache` sur index.html pour déploiements immédiats sans vidage manuel du cache
- Correction des headers sticky sur toutes les pages d'administration

## [2026-02-09]

### Ajouts
- Ajout de la hiérarchie d'espaces : un espace peut maintenant avoir un espace parent (parentId) avec héritage de communauté, validation anti-boucle circulaire et suppression en cascade
- Ajout de l'arborescence des espaces dans la sidebar avec expand/collapse persisté en localStorage
- Ajout du sélecteur d'espace parent dans les formulaires de création et paramètres d'espace
- Ajout de la vue graphe force-directed à 3 niveaux (espace, communauté, global) avec liens hiérarchiques, relationnels et par tags communs
- Ajout du sélecteur de périmètre dans le panneau de contrôle du graphe pour basculer entre espace, communauté et global
- Ajout du filtre par communauté dans la vue graphe globale avec checkboxes
- Ajout des nœuds structurels (SPACE, COMMUNITY) dans le graphe pour relier les items orphelins à leur contexte
- Ajout de la page Statistiques dans l'administration avec totaux, séries temporelles d'activité, répartition par type et top 10 des espaces

### Corrections
- Correction de la hauteur du graphe : suppression de la hauteur fixe pour utilisation de toute la hauteur disponible de la page
- Correction du layout flex des pages : remplacement de `h-full` par `flex-1 min-h-0` pour résolution correcte dans les conteneurs flex
- Correction du défilement : chaque page gère maintenant son propre scroll (overflow-auto pour les pages de contenu, overflow-hidden pour les vues plein écran)
- Correction de la pagination en administration : passage à 1000 éléments par page pour afficher tous les espaces personnels
- Correction du calcul de hauteur du GraphView : utilisation de getBoundingClientRect() au lieu de dépendre de la chaîne CSS flex

## [2026-02-08]

### Ajouts
- Ajout du fil d'Ariane cliquable dans la modale d'édition d'item (Espace > Parent1 > ... > Item) avec navigation entre items
- Ajout du zoom projet dans la MindMap : double-clic sur un PROJECT affiche uniquement son sous-arbre avec bouton de retour
- Ajout de tooltips d'assistance étendus à toutes les vues et composants (Kanban, Types, Séquence, Liste, Timeline, MindMap, paramètres, modales)
- Ajout des vues colonnes Planning et Séquence avec layout aligné sur la vue Liste
- Ajout de la documentation de cartographie des composants et du catalogue de fonctionnalités (70+ fonctionnalités)

### Modifications
- Application des couleurs des types de référentiel dans toute l'application : filtres, badges, icônes et boutons utilisent maintenant les couleurs spécifiques définies par type
- Amélioration du layout de la vue Liste : affichage colonné avec en-tête sticky et alignement vertical
- Refactorisation du groupement MindMap : utilisation du groupement natif ReactFlow via parentId au lieu du mécanisme custom (~200 lignes supprimées)
- Amélioration du layout MindMap : disposition en étoile des enfants avec résolution automatique des collisions et chevauchements
- Optimisation du favicon : réduction de 2.2 Mo (1536x1024) à 1 Ko (32x32)
- Repositionnement du champ statut à côté du parent dans le formulaire d'item (layout responsive)

### Corrections
- Correction du déploiement Railway : limitation du nombre de workers nginx à 2 pour éviter le dépassement mémoire (au lieu de `auto` qui créait 47 workers)
- Correction du crash MindMap lors du drag des blocs projet : réécriture du drag groupé via onNodeDragStart/onNodeDrag
- Correction de la transparence des zones projet MindMap : les clics passent maintenant à travers le fond pour permettre de sélectionner les items en dessous
- Correction de la résolution des collisions dans MindMap : application en dernier pour garantir qu'aucun item étranger ne reste dans une zone projet
