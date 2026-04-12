---
name: spok-doc
description: Gérer la documentation fonctionnelle dans l'application SPOK (espace Produit SPOK). Utiliser quand on veut créer, mettre à jour ou enrichir la documentation des interfaces dans SPOK. Déclencher systématiquement quand on documente une page, une section ou un composant de SPOK.
---

# spok-doc — Documentation fonctionnelle dans SPOK

Ce skill gère la documentation vivante de l'application SPOK, stockée directement dans SPOK sous forme d'items DOCUMENT.

## Outils MCP disponibles

Utiliser les outils MCP `spok` directement — pas de scripts Python ni de curl.

| Opération | Outil MCP |
|-----------|-----------|
| Lister les espaces | `mcp__spok__list_spaces` |
| Lire un espace + ses items | `mcp__spok__get_space` |
| Chercher un item existant | `mcp__spok__search_items` |
| Créer un item DOCUMENT | `mcp__spok__create_item` |

## Structure documentaire

```
Produit SPOK (espace parent)
├── Contexte projet
│   ├── Vision
│   ├── Problème résolu
│   ├── Objectifs
│   └── Utilisateurs cibles
├── Modèle de données
├── Structure
│   ├── Barre latérale [Sidebar]
│   ├── En-tête [Header]
│   ├── Zone principale [Main]
│   └── Sécurité & Accès
├── Interfaces
│   ├── Communautés
│   ├── Espaces
│   ├── Administration
│   ├── Autres
└── Interactions
```

## Règles systématiques

Quand on documente un composant ou une page :
1. **Chercher d'abord** avec `mcp__spok__search_items` pour ne pas créer un doublon
2. **Créer** avec `mcp__spok__create_item` (type: `DOCUMENT`, spaceId, parentId si sous-composant)
3. **Toujours renseigner `description`** — 1 ligne résumant le rôle de l'item
4. **Convention de nommage** : nom français + terme technique entre crochets
   - Ex : `Barre latérale [Sidebar]`, `Authentification [JWT]`
5. **Toujours renseigner le statut** : `done`, `to_validate`, ou `todo`
6. Ne jamais supposer un ID — utiliser `mcp__spok__get_space` pour récupérer les IDs réels

## IDs des espaces Produit SPOK (prod)

| Espace | ID |
|--------|----|
| Produit SPOK (parent) | `cmnn2fh8401tutmos4yse7vuk` |
| Contexte projet | `cmnn824ak023jtmoswzqvrjgq` |
| Modèle de données | `cmnn2fhfw01tytmos3k607kvz` |
| Structure | `cmnn2fhn801u2tmosagjc84lt` |
| Interfaces - Espaces | `cmnn2fi3301uatmoswfii34wk` |
| Interfaces - Communautés | `cmnn2fhvd01u6tmos0glnjmq8` |
| Interfaces - Administration | `cmnn2fiac01uetmosa27z8zb9` |
| Interfaces - Autres | `cmnn2figx01uitmosfqkwqvg2` |
| Interactions | `cmnn2fiol01umtmoso056ajbx` |

## Format de documentation d'un composant

```
Description courte (1 ligne)

## Rôle
Ce que fait ce composant, pourquoi il existe.

## Contenu
Liste des éléments visuels ou fonctionnels présents.

## Comportement
Comment il réagit : conditions d'affichage, états, variantes.

## Interactions clés (si pertinent)
- Clic : action
- Raccourci : action
```
