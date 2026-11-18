/* Aide utilisateur de la modale « Profil utilisateur » (UserProfileModal + PersonalTokensSection), écrite en éléments
   d'aide (help/elements.ts) : un élément par fonction, repris par le « ? » (PageHelpButton), le tour et le mode Aide —
   registre help/pageHelp.ts.
   - elements : une fonction chacun ; zone data-help-zone="profile:<clé>" dans le code. Les fonctions de l'onglet Compte
     (affiché à l'ouverture) sont visées directement ; celles des autres onglets visent le bouton d'onglet
     (data-tour profile-tab-<id>), jamais un contenu caché. Administration n'existe que pour un administrateur : son
     étape est sautée pour les autres.
   - hints : rappels fonctionnels des actions à effet (pageHint('profile', clé)), vérifiés dans l'API
     (routes/user.ts, auth.ts, personal-tokens.ts, utils/personalTokens.ts).
   - fields : textes à lire avant d'agir, affichés en ligne par FieldHelp (email, Accès Claude, communautés). */
import type { HelpEntry } from '../../help/types';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../help/elements';

const elements: HelpElements = {
  avatar: {
    title: 'Photo de profil',
    short: 'Votre photo, visible partout dans SPOK.',
    text: 'L\'appareil photo change votre photo (JPEG, PNG, WebP ou GIF) ; vous pouvez aussi coller une image (Ctrl+V) tant que le profil est ouvert. « Supprimer l\'avatar » la retire.',
    side: 'bottom',
  },
  nom: {
    title: 'Nom',
    short: 'Votre nom affiché, modifiable sur place.',
    text: 'Cliquez sur votre nom pour le modifier : Entrée ou un clic ailleurs enregistre, Échap annule.',
    side: 'bottom',
  },
  deconnexion: {
    title: 'Déconnexion',
    short: 'Ferme votre session sur cet appareil.',
    text: 'Ferme votre session sur cet appareil et revient à l\'accueil. Vos autres appareils et vos jetons Claude restent connectés.',
    side: 'left',
  },
  email: {
    title: 'Email',
    short: 'Votre adresse de connexion et de notification.',
    text: 'Votre adresse sert à vous connecter et à recevoir les notifications par email. Modifiez-la sur place (Entrée enregistre, Échap annule) : la nouvelle adresse reçoit un lien de vérification et reste « Non vérifié » jusqu\'au clic.',
    side: 'bottom',
    changes: [{ id: 'profile-tabs', kind: 'evolution', text: 'Le profil s\'agrandit et se range en onglets : Compte, Préférences, Notifications, Accès Claude.', date: '2026-11-11' }],
  },
  motdepasse: {
    title: 'Mot de passe',
    short: 'Changer votre mot de passe.',
    text: '« Changer le mot de passe » demande le mot de passe actuel, puis le nouveau (8 caractères au moins). Vos sessions ouvertes ailleurs restent connectées.',
    side: 'bottom',
  },
  role: {
    title: 'Rôle et identifiant',
    short: 'Votre rôle global et votre identifiant.',
    text: 'Rôle global : Utilisateur, ou Administrateur (gère tout SPOK). Il est fixé par un administrateur. L\'identifiant sert au support et aux échanges techniques.',
    side: 'bottom',
  },
  claude: {
    title: 'Accès Claude',
    short: 'Connectez votre Claude à SPOK.',
    text: 'Connecte Claude Code à SPOK : votre Claude peut alors chercher, lire et (selon la portée du jeton) créer ou modifier vos éléments, avec vos droits. 1. « Demander l\'accès » : un administrateur l\'accorde (un administrateur l\'a d\'office). 2. Nommez un jeton, choisissez portée et durée, « Créer un jeton ». 3. Copiez la commande affichée et lancez-la dans un terminal où Claude Code est installé. Un jeton par appareil : révoquez celui d\'un appareil perdu.',
    side: 'top',
  },
  communautes: {
    title: 'Communautés',
    short: 'Les communautés dont vous êtes membre.',
    text: 'Onglet Communautés : les communautés dont vous êtes membre, avec votre rôle (Propriétaire ou Membre).',
    target: '[data-tour="profile-tab-communities"]',
    side: 'bottom',
    changes: [{ id: 'profile-communities-tab', kind: 'evolution', text: 'Les communautés ont leur propre onglet, et l\'accès Claude rejoint l\'onglet Compte.', date: '2026-11-18' }],
  },
  theme: {
    title: 'Thème',
    short: 'Affichage clair ou sombre.',
    text: 'Onglet Préférences : thème clair ou sombre, appliqué tout de suite.',
    target: '[data-tour="profile-tab-preferences"]',
    side: 'bottom',
  },
  tutoriels: {
    title: 'Tutoriels',
    short: 'Remet à zéro les tutoriels déjà vus.',
    text: 'Onglet Préférences : « Réinitialiser tous les tutoriels » remet à zéro ceux déjà vus ; ils se reproposeront à la prochaine visite de leur page.',
    target: '[data-tour="profile-tab-preferences"]',
    side: 'bottom',
  },
  notifications: {
    title: 'Notifications',
    short: 'Ce qui vous est notifié, et comment.',
    text: 'Onglet Notifications : pour chaque type d\'événement, choisissez App + Email, App seule ou Désactivé. Le choix s\'enregistre au clic.',
    target: '[data-tour="profile-tab-notifications"]',
    side: 'bottom',
  },
  administration: {
    title: 'Administration',
    short: 'Bascules réservées aux administrateurs.',
    text: 'Onglet Administration (administrateurs seulement) : mode admin (tout voir et tout faire), mode dev (indicateur d\'environnement) et état de la connexion à la base.',
    target: '[data-tour="profile-tab-admin"]',
    side: 'bottom',
  },
};

const derived = helpFromElements(elements);

export const help: HelpEntry = {
  title: 'Profil',
  summary: 'Votre compte. Compte : identité, mot de passe et accès Claude. Puis les onglets Communautés, Préférences (thème, tutoriels), Notifications — et Administration pour un administrateur.',
  ...derived,
  hints: {
    ...derived.hints,
    avatarChange: 'Choisir une nouvelle photo : elle remplace l\'ancienne partout dans SPOK.',
    avatarDelete: 'Retire votre photo de profil, partout dans SPOK. Vous pourrez en remettre une.',
    logout: 'Ferme votre session sur cet appareil et revient à l\'accueil. Vos autres appareils et vos jetons Claude restent connectés.',
    passwordSave: 'Remplace votre mot de passe. Les sessions déjà ouvertes ailleurs restent connectées.',
    tutorialsReset: 'Efface la mémoire des tutoriels déjà vus (ce navigateur et votre compte) : chacun se reproposera à la prochaine visite de sa page.',
    tokenRequest: 'Envoie une notification aux administrateurs. Vous pourrez créer un jeton dès que l\'accès est accordé.',
    tokenCreate: 'Crée le jeton et affiche une seule fois la commande de connexion : copiez-la tout de suite.',
    tokenCopy: 'Copie la commande dans le presse-papiers. Collez-la dans un terminal où Claude Code est installé.',
    tokenRevoke: 'Le Claude qui utilise ce jeton perd l\'accès immédiatement. Définitif : il faudra créer un nouveau jeton.',
  },
  fields: {
    email: 'Une nouvelle adresse reçoit un lien de vérification et reste « Non vérifié » jusqu\'au clic.',
    claudeIntro: 'Connectez Claude Code à SPOK : votre Claude pourra chercher, lire et, selon la portée du jeton, créer ou modifier vos éléments, avec vos droits. Un jeton est personnel : ne le partagez pas.',
    claudeSteps: '1. Demandez l\'accès (accordé par un administrateur). 2. Créez un jeton, un par appareil. 3. Copiez la commande affichée et lancez-la dans un terminal où Claude Code est installé.',
    tokenOptions: 'Portée — Lecture seule : Claude consulte sans rien modifier ; Lecture et écriture : il peut aussi créer, modifier et supprimer, comme vous. Durée : passé ce délai, le jeton ne fonctionne plus ; créez-en un autre et relancez la commande.',
    communities: 'Les communautés dont vous êtes membre, avec votre rôle : Propriétaire (gère la communauté et ses membres) ou Membre.',
  },
  tour: [
    {
      popover: {
        title: 'Profil',
        description: 'Tout ce qui concerne votre compte.',
      },
    },
    ...elementTourSteps('profile', elements),
  ],
};
