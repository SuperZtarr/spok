# SPOK - Catalogue des fonctionnalites

## Import forum MSF

| Fonctionnalite | Commit | Description |
|----------------|--------|-------------|
| Import forum complet | e313954 | 55817 messages, 3638 topics depuis base SMF |
| Import v3 GBK + BBCode→HTML | e3a39d3 | Completion import + conversion format |
| Import via tables raw + fix CP1252 | 2e7bb4a | 3638 items, 52181 contribs, 140 espaces |
| Fix rendu HTML auto | 77cc4ce | Detection auto balises + correction 98 topics |
| Fix auteurs forum | 4cd36ac | 586 items + 11383 contribs corriges, 31 users crees |
| Fix mojibake | 49a45c9 | 1283 corrections ciblees double-encodage UTF-8 |
| Fix entites HTML | e8bc85b | Correction &#039; &amp; &quot; dans donnees forum |
| Fix pseudos numeriques | script | 25 utilisateurs renommes "Membre N" |

---

## Carte mentale (MindMap)

| Fonctionnalite | Commit | Description |
|----------------|--------|-------------|
| Layout radial de base | bbf145a | Disposition en etoile autour du noeud espace |
| Replier/deplier noeuds | 1ba666a | Collapse/expand des branches |
| Nom espace au centre | 5775318 | Noeud central avec nom et compteur |
| Boutons Reorganiser + Etendre/Replier | c8683a2 | Actions globales |
| Relations entre elements | f76075b | Liens de dependance sur la carte |
| Portails vers autres espaces | 75d762d | Noeuds portail avec lien localStorage |
| Filtre par type : surlignage | dc74666 | Surlignage au lieu de masquage |
| Legende enrichie | 5b18167 | Documentation visuelle interactive |
| Drag-and-drop pour imbriquer | 056b549 | Drop sur un noeud = reparentage |
| Rectangles englobants PROJECT | a0998e4 | Blocs visuels autour des projets |
| Charger tous les items sans limite | 5ade272 | Suppression pagination |
| Persistance positions + liens dynamiques | d4f140e | Positions sauvees localStorage |
| Titres complets + espacement progressif | 9069dfd | Amelioration lisibilite |
| Rayons dynamiques + blocs deplacables | 891fc2a | Anti-superposition + drag groupe projet |

---

## Vues de visualisation

### Liste
| Fonctionnalite | Commit | Description |
|----------------|--------|-------------|
| Layout colonne avec en-tete sticky | 130999a | Tableau colonne avec alignement vertical |

### Kanban
| Fonctionnalite | Commit | Description |
|----------------|--------|-------------|
| Colonnes par statut + drag-and-drop | (initial) | Changement statut par glisser-deposer |
| Vues colonnes Planning/Sequence | 40b4884 | Support kanban etendu |

### Sequence
| Fonctionnalite | Commit | Description |
|----------------|--------|-------------|
| Tri topologique + connecteurs | 4cbf66e | Ordonnancement logique des dependances |
| Vue horizontale par chaines | 5823618 | Layout chaines de dependance |
| Fix crash hook conditionnel | f72a08c | Correction hook apres return |
| Ajout/suppression relations | 553ef2d | CRUD relations comme MindMap |

### Gantt (Timeline)
| Fonctionnalite | Commit | Description |
|----------------|--------|-------------|
| Vue Timeline de base | 3989fbb | Premiere version avec barres |
| Gestion dependances + arborescence | 925452b | Fleches de dependance |
| Niveaux de zoom | ae4c482 | Day/Week/Month/Quarter/Year |
| Elements sans date + zoom etendu | 4561546 | Completude |
| Poignees de redimensionnement | 7e650c7 | Drag resize barres |
| Fleches de dependance Gantt | a942728 | Connecteurs courbes |

### Planning
| Fonctionnalite | Commit | Description |
|----------------|--------|-------------|
| Vue planning par periode | bce0152 | Groupes : retard, aujourd'hui, semaine, mois, plus tard |

---

## Editeur rich text & contributions

| Fonctionnalite | Commit | Description |
|----------------|--------|-------------|
| TipTap pour descriptions | 3dcd743 | Editeur rich text items |
| TipTap pour contributions | 771318b | Editeur rich text forum/contributions |
| Formulaire contribution en bas | 3f1a04e | Repositionnement UX |
| Lecture seule : texte brut | c69c292 | Texte brut au lieu d'inputs disabled |
| Fix cache stale + setContent | 26640f1 | Cache apres login + type TipTap |

---

## UI / Layout

| Fonctionnalite | Commit | Description |
|----------------|--------|-------------|
| Responsive mobile : sidebar slide-over | 655959a | Hamburger menu + slide-over |
| Sidebar active + header compact | 773940c | Toolbar unifiee |
| Sidebar redimensionnable + sections | 573e18f | Espaces groupes par type |
| Header : communaute + espace courant | cb67bd5 | Affichage contexte |
| Statut en boutons + boutons sticky | 574be34 | UX formulaire |
| Filtres type : indicateur visuel | 6d55857 | Mode de filtre visible |
| Dashboard segmente + espaces communautaires | a0998e4, a1cd45d | Bouton Rejoindre |
| Titre SPOK, modal 80%, types en boutons | 648d8d5 | Coherence UI |
| Tri alphabetique espaces sidebar | a534187 | Ordre navigation |
| Logo cliquable vers dashboard | bb7cb29 | Navigation |
| Couleurs statuts bleu/jaune | bf84cfe | Theming |
| Lien cliquable sous input URL | 28c526c | UX formulaire |
| Description apres titre | 23d2bb7 | Reorganisation formulaire |
| Statut a cote du parent (responsive) | d25614e | Layout responsive |
| Dashboard titre + barre sticky | 3ded0ce | Deduplication + sticky |
| Modale largeur augmentee | cf8b86a | Scroll ameliore |
| Contraste contributions | 4c20ec8 | Accessibilite |
| Couleurs type des referentiels partout | 7cdbff0 | Bordures colorees par type |
| Tooltips d'assistance sur toutes les vues | 7cdbff0 | Aide contextuelle |

---

## Authentification & profil

| Fonctionnalite | Commit | Description |
|----------------|--------|-------------|
| Upload/suppression avatar | a4157e0 | Systeme avatar (WebP 256x256) |
| Theme clair/sombre | 90a7d37 | Preferences utilisateur |
| Fix avatar prod : data URI en DB | 3eb6c60 | Persistence avatar |
| Modification nom utilisateur | db28fe4 | Profil editable |
| Modification email | 7755feb | Changement email |
| Modification mot de passe | 39e0150 | Changement mot de passe |
| Fix coherence JWT apres changement email | 03f8328 | Renouvellement token |

---

## Permissions & acces

| Fonctionnalite | Commit | Description |
|----------------|--------|-------------|
| UI lecture seule pour VIEWER | 4879259 | Masquer actions edition dans 7 vues |
| Visibilite communautaire | 31073b5 | Membres voient tous espaces et contenus |
| Controle acces API | 31073b5 | Routes protegees VIEWER |

---

## Recherche

| Fonctionnalite | Commit | Description |
|----------------|--------|-------------|
| Recherche globale cross-espaces | 61163d5 | Items + contributions, debounce 300ms |

---

## Admin & qualite

| Fonctionnalite | Commit | Description |
|----------------|--------|-------------|
| Page Anomalies (12 controles) | 1a7818c | Qualite donnees (orphelins, doublons, mojibake...) |
| Tri colonnes par clic | d8dae87 | Tri sur 3 pages admin |
| Lignes cliquables detail | a1af4a4 | Navigation admin |
| Page Referentiels | 69745e0 | Consultation statuts/types |
| Console tests non-regression | 828a7e0 | 21 tests automatises |
| Tests coherence metier | 1a0ee62 | Liens vers consoles admin |

---

## Infrastructure & deploiement

| Fonctionnalite | Commit | Description |
|----------------|--------|-------------|
| Fix nginx workers OOM Railway | 3f285c2 | Limite a 2 workers (au lieu de ~47) |
| Nginx logs stdout/stderr | 02e002c | Visibilite Railway |
| Force redeploy production | 32734c3 | Fix deploiements "removed" |

---

## Statistiques

- **70+ fonctionnalites** implementees
- **8 vues** de visualisation (Liste, Kanban, Types, MindMap, Sequence, Planning, Gantt, Arborescence)
- **12 controles** de qualite donnees
- **21 tests** de non-regression
- Periode de developpement : fev. 2026
