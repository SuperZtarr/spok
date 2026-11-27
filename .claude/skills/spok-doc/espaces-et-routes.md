# spok-doc — Annuaire : items des espaces de doc et lexique des routes

> Données de référence de la skill spok-doc (extraites le 2026-11-26 pour alléger la skill). Les règles restent dans SKILL.md.
> Mettre ce fichier à jour si la structure des espaces de doc change.

## Détail des espaces

### Structure `cmnq9c5jr000s5yz2vthye9ws`
| ID | Item |
|----|------|
| `cmnq9ctvy00ao5yz2ugz3dicd` | En-tête [Header] |
| `cmnq9c9zj00265yz2875z82fl` | Zone principale [Main] |
| `cmnq9c7tx00185yz2sfznl4x3` | Barre latérale [Sidebar] |
| `cmnq9ccfd00365yz2w5pke7oj` | Sécurité & Accès (item parent, spaceId=cmnq9c5jr000s5yz2vthye9ws) |

### Modales & Overlays `cmmts8ab200ajwbfkewwrj2b6`
| ID | Item |
|----|------|
| `cmmti1lkp006kf03nzbdq9acw` | Modale d'édition d'item [ItemEditModal] |
| `cmmtjtwrd00srf03n6d810van` | Détail espace (admin) [SpaceDetailModal] |
| `cmmtjtv6b00snf03ne6mtot7d` | Détail communauté (admin) [CommunityDetailModal] |
| `cmmti1yez007gf03n2trd658b` | Autres modales |
| `cmmtiyxlp00b3f03nmog78n1f` | Détails utilisateur [UserDetailModal] |
| `cmmtiyx5f00avf03n3lp982rd` | Création d'espace |
| `cmmtiyxdm00azf03n0rmow5w1` | Création de communauté |

### Pages publiques `cmnxnu81f01h8n856xt1fj4bo`
| ID | Item |
|----|------|
| `cmnxpqf1g01q0n856blbgriei` | Authentification (5 sous-items) |
| `cmnxpqf8y01q4n8567es0rbho` | Accès par lien — Invitation |
| `cmnxpqfle01q8n85655c4744j` | Découverte — Landing, Sitemap |

### Pages utilisateur `cmnxohuia01mln856b8bu9luo`
| ID | Item |
|----|------|
| `cmnxpvfye01qzn856runief9k` | Navigation globale (Accueil, Espaces, Dashboard, Recherche) |
| `cmnxpvgcg01r3n856nl0qya0o` | Visualisations globales (Graphe, Sunburst, MindMap, Tâches) |

### Communautés `cmnq9c2fa00085yz2u2961kvx`
| ID | Item |
|----|------|
| `cmnq9c830001c5yz29upq89c8` | Page communauté [CommunityPage] |
| `cmnq9c87k001e5yz28d635i0m` | Liste des communautés [CommunitiesListPage] |
| `cmnq9cfpv004m5yz20n3meqfg` | Paramètres communauté [CommunitySettingsPage] |

### Espaces `cmnq9c31s000c5yz2co7rpg8m`
| ID | Item |
|----|------|
| `cmnq9c8gp001i5yz2jioyartd` | Contenu espace [SpacePage] |
| `cmnq9cw6h00bo5yz2dtf4wlu0` | Vues |
| `cmnq9ctre00am5yz236zts7mm` | Barre d'outils espace |
| `cmnq9c8l9001k5yz2t1kcpkkd` | Paramètres espace [SpaceSettingsPage] |
| `cmnq9c8c3001g5yz2a0mza14i` | Aperçu espace [SpaceOverviewPage] |
| `cmnq9cg84004u5yz2qt0svazx` | Historique espace [SpaceHistoryPage] |

### Administration `cmnq9c3oa000g5yz26hkk5adh`
| ID | Item |
|----|------|
| `cmnq9c8pu001m5yz2ubtshw1m` | Gestion utilisateurs [UsersPage] |
| `cmnq9cd26003g5yz2xu95powk` | Gestion des espaces [SpacesPage] |
| `cmnq9cd6q003i5yz2f7btm0nr` | Gestion des communautés [CommunitiesPage] |
| `cmnq9c8ug001o5yz28naev90e` | Statistiques [StatsPage] |
| `cmnq9c8z1001q5yz28s6mjoy6` | Journaux d'audit [AuditLogsPage] |
| `cmnq9cdb8003k5yz22ngl0570` | Diagnostics [AnomaliesPage] |
| `cmnq9c93l001s5yz2dpx2fguy` | Configuration des menus [MenuConfigPage] |
| `cmnq9c985001u5yz2vhjzllrf` | Référentiels [ReferentielsPage] |

### Modèle de données `cmnq9c4x8000o5yz2xrlcel81`
| ID | Item |
|----|------|
| `cmnq9chmk005e5yz2ss5q7l1c` | Tables fonctionnelles (13) |
| `cmnq9chdh005c5yz2560eetsp` | Tables techniques (12, dont ItemView ; MenuItem = concept AppConfig, pas une table) |
| `cmnq9cdtl003s5yz293mlb05a` | Types d'items [enum ItemType] (à la racine, pas une table) |

### Système `cmmthmtr7000mf03nkqrv7a3z`
| ID | Item |
|----|------|
| `cmnufclwh01snx6kko2m73lax` | PROD (Railway, Docker, domaine, env vars) |
| `cmnufcg9301shx6kkws6xwkwh` | DEV (Docker local, ports) |

### Contexte `cmnq9c6st00105yz2eoky7uvt`
| ID | Item |
|----|------|
| `cmnq9cb96002q5yz2bqkzo1r7` | Vision |
| `cmnq9cbdq002s5yz291lftyg8` | Problème résolu |
| `cmnq9cbmu002w5yz2vxrbjwh2` | Utilisateurs cibles |
| `cmnq9cbib002u5yz2zvz6uslm` | Objectifs |
| `cmnq9cbvv002y5yz2508md8cv` | Centraliser sans rigidité |
| `cmnq9cc0g00305yz2a20e7rdq` | Plusieurs lectures du même contenu |
| `cmnq9cc5000325yz2flyn9qdj` | Liens plutôt que silos |
| `cmnq9ccau00345yz2ji5lge7n` | Simple à prendre en main, puissant à l'usage |

---

## Lexique des routes

### Publiques (sans auth)
| Route | Composant |
|-------|-----------|
| `/` (non connecté) | `LandingPage` |
| `/login` | `LoginPage` |
| `/register` | `RegisterPage` |
| `/forgot-password` | `ForgotPasswordPage` |
| `/reset-password` | `ResetPasswordPage` |
| `/verify-email` | `VerifyEmailPage` |
| `/invitation` | `InvitationPage` |
| `/sitemap` | `SitemapPage` |

### Utilisateur connecté
| Route | Composant |
|-------|-----------|
| `/` | `HomePage` → `HomeView` |
| `/communities` | `CommunitiesListPage` |
| `/spaces` | `SpacesListPage` |
| `/dashboard` | `DashboardViewPage` |
| `/graph` | `GraphPage` |
| `/sunburst` | `SunburstPage` |
| `/mindmap` | `MindMapPage` |
| `/tasks` | `GlobalTasksPage` |
| `/search` | `SearchPage` |

### Espaces
| Route | Composant |
|-------|-----------|
| `/spaces/:id` | `SpaceOverviewPage` |
| `/spaces/:id/content` | `SpacePage` (vues) |
| `/spaces/:id/settings` | `SpaceSettingsPage` |
| `/spaces/:id/history` | `SpaceHistoryPage` |

### Communautés
| Route | Composant |
|-------|-----------|
| `/communities/:id` | `CommunityPage` |
| `/communities/:id/settings` | `CommunitySettingsPage` |

### Administration
| Route | Composant |
|-------|-----------|
| `/admin/users` | `UsersPage` |
| `/admin/spaces` | `SpacesPage` |
| `/admin/communities` | `CommunitiesPage` |
| `/admin/stats` | `StatsPage` |
| `/admin/audit-logs` | `AuditLogsPage` |
| `/admin/anomalies` | `AnomaliesPage` |
| `/admin/menu` | `MenuConfigPage` |
| `/admin/views` | `ViewsConfigPage` |
| `/admin/referentiels` | `ReferentielsPage` |
| `/admin/api-doc` | `ApiDocPage` |
| `/admin/perf` | `PerfPage` |
