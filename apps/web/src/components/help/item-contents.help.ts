/* Aide utilisateur de la zone « Contenus » de la fiche (ItemContentsSection : mode Modifier ; ItemContentsRead : mode
   Afficher), écrite en éléments d'aide (help/elements.ts) — registre help/pageHelp.ts, clé 'item-contents'.
   Zones data-help-zone item-contents:ajouter, item-contents:contenus et item-contents:apercu (aperçu d'un fichier,
   présent seulement si un fichier en a un — l'étape du tour est alors sautée ; annonce file-preview, 2026-11-11).
   Mise en forme en vignettes (2026-11-11) : textes de contenus, apercu, moveUp / moveDown (← →) ; pas d'annonce
   propre, les contenus multiples ne sont pas encore en ligne (leur annonce item-contents couvre la présentation).
   hints : rappels fonctionnels de chaque action à effet (ajouter chaque sorte, renommer, réordonner, retirer), vérifiés
   dans apps/api/src/routes/item-contents.ts ; fields : phrases visibles (élément non enregistré, zone vide, lien).
   Plafond d'un fichier : DOCUMENT_MAX_MB (jamais écrit en dur) ; annonce file-size-100 (2026-11-15, poids affiché).
   Données sécurisées (2026-11-20) : élément secrets (zone item-contents:secrets, présente seulement si l'élément en
   porte — étape sautée sinon), rappels secret* vérifiés dans apps/api/src/routes/item-secrets.ts, champs secretValue /
   secretVisibility, annonce item-secrets (sans date).
   Retrait (2026-11-26) : le fichier part à la corbeille du stockage (délai STORAGE_TRASH_GRACE_DAYS, registre shared).
   L'annonce `item-contents` est sans date : la session MEP la date au déploiement (règles : skill spok-doc). */
import type { HelpEntry } from '../../help/types';
import { ITEM_SECRETS_MAX, STORAGE_TRASH_GRACE_DAYS } from '@spok/shared';
import { DOCUMENT_MAX_MB } from '../../lib/uploadRules';
import { elementTourSteps, helpFromElements, type HelpElements } from '../../help/elements';

const elements: HelpElements = {
  ajouter: {
    title: 'Ajouter un contenu',
    short: 'Joindre un fichier, une image, un lien ou un schéma.',
    text: '« + Ajouter » joint à l\'élément un fichier, une image (déposée, choisie ou collée), un lien ou un schéma dessiné dans SPOK. Quel que soit le type de l\'élément, vous pouvez en ajouter plusieurs de chaque sorte. L\'ajout est enregistré tout de suite.',
    side: 'left',
  },
  contenus: {
    title: 'Contenus',
    short: 'Ce que porte l\'élément, rangé par sorte.',
    text: 'Les contenus de l\'élément, en vignettes alignées les unes à côté des autres et regroupées toujours dans le même ordre : Images, Fichiers, Liens, Téléphones, E-mails, Adresses, Schémas. Les coordonnées s\'affichent en lignes courtes et cliquables (appeler, écrire, voir sur une carte). Le haut de chaque vignette montre un aperçu (pour un lien, l\'image d\'aperçu de son site, récupérée une fois et rangée dans SPOK ; ↻ la récupère de nouveau) ; sous le nom, le poids d\'un fichier ou d\'une image envoyée, le site d\'un lien. Cliquez une image pour l\'agrandir, un fichier ou un lien pour l\'ouvrir, un schéma pour le modifier. Au pied de la vignette, les flèches ← → changent sa place parmi ceux de sa sorte, le crayon la renomme, la flèche longue → la déplace vers un autre élément et la corbeille la retire. En mode Afficher, les vignettes sont plus grandes.',
    side: 'top',
    changes: [
      { id: 'item-contents', kind: 'evolution', text: 'Un élément porte maintenant plusieurs contenus (images, fichiers, liens, schémas), quel que soit son type : « + Ajouter » sous la description.', date: '2026-11-11' },
      { id: 'link-preview', kind: 'new', text: 'Un lien montre maintenant l\'image d\'aperçu de son site, récupérée une fois et rangée dans SPOK ; ↻ au pied de la vignette la récupère de nouveau.', date: '2026-11-25' },
      { id: 'content-contacts', kind: 'new', text: 'Un élément porte maintenant des téléphones, e-mails et adresses : « + Ajouter » › Téléphone, E-mail ou Adresse. Ils sont cliquables (appeler, écrire, voir sur une carte).', date: '2026-11-25' },
      { id: 'content-move', kind: 'new', text: 'Un contenu ou une donnée sécurisée se déplace vers un autre élément : flèche longue → au pied de sa vignette, puis choix de l\'élément.', date: '2026-11-21' },
      { id: 'file-size-100', kind: 'evolution', text: `Les fichiers joints peuvent maintenant peser jusqu'à ${DOCUMENT_MAX_MB} Mo, et le poids de chaque fichier ou image s'affiche sous son nom.`, date: '2026-11-15' },
    ],
  },
  secrets: {
    title: 'Données sécurisées',
    short: 'Mots de passe et codes rangés sur l\'élément, masqués.',
    text: '« + Ajouter » › « Donnée sécurisée » range sur l\'élément un mot de passe, un code ou une clé, avec un libellé et un identifiant facultatif. La valeur est chiffrée et toujours masquée : l\'œil l\'affiche 30 secondes, le bouton Copier la place dans le presse-papiers, vidé au bout de 30 secondes. « Moi seul » (par défaut) : vous seul la voyez. « Membres de l\'espace » : les membres de l\'espace peuvent aussi l\'afficher. Chaque consultation est enregistrée ; l\'auteur voit combien de fois sa donnée a été consultée. Les données sécurisées n\'apparaissent jamais dans l\'export, la copie de la fiche, la recherche, les vignettes ni pour Claude (MCP), qui n\'en voit que le libellé.',
    side: 'top',
    changes: [{ id: 'item-secrets', kind: 'new', text: 'Un élément peut porter des données sécurisées (mot de passe, code) : masquées, chiffrées, visibles par vous seul ou par les membres de l\'espace. « + Ajouter » › « Donnée sécurisée ».', date: '2026-11-20' }],
  },
  apercu: {
    title: 'Aperçu d\'un fichier',
    short: 'Le début du fichier, pour savoir ce qu\'il contient sans l\'ouvrir.',
    text: 'À l\'envoi d\'un fichier, SPOK prépare son aperçu : la première page d\'un PDF, ou la miniature enregistrée dans un fichier Word, Excel ou PowerPoint. L\'aperçu occupe le haut de la vignette du fichier dans la fiche ; il apparaît aussi dans la vue Documents et sur la vignette de l\'élément. Cliquez dessus pour ouvrir le fichier. Sans aperçu (autres formats, fichier Office enregistré sans miniature), la vignette montre l\'icône de l\'application qui ouvre le fichier — Word, Excel, PowerPoint, PDF… — et son extension. Le début du texte sert seulement de résumé sur la vignette d\'un élément sans description.',
    side: 'right',
    changes: [{ id: 'file-preview', kind: 'new', text: 'Les fichiers joints montrent un aperçu : la première page d\'un PDF, la miniature d\'un document Office ou le début du texte, dans la fiche, la vue Documents et les vignettes.', date: '2026-11-11' }],
  },
};

const derived = helpFromElements(elements);

export const help: HelpEntry = {
  title: 'Contenus',
  summary: 'Les images, fichiers, liens et schémas portés par un élément, plusieurs par sorte, quel que soit son type.',
  ...derived,
  hints: {
    ...derived.hints,
    add: 'Choisir la sorte de contenu à joindre : fichier, image, lien ou schéma.',
    addFILE: `Joint un fichier (PDF, bureautique…, ${DOCUMENT_MAX_MB} Mo au plus ; exécutables refusés). Il est enregistré dès l'envoi.`,
    addIMAGE: 'Joint une image (déposée, choisie ou collée avec Ctrl+V), réduite si besoin. Elle est enregistrée dès l\'envoi.',
    addLINK: 'Joint une adresse web, avec un nom facultatif.',
    addPHONE: 'Ajoute un numéro de téléphone (chiffres, espaces, + . - ( )), avec un libellé facultatif. Cliquable pour appeler.',
    addEMAIL: 'Ajoute une adresse e-mail, avec un libellé facultatif. Cliquable pour écrire.',
    addADDRESS: 'Ajoute une adresse postale (plusieurs lignes possibles), avec un libellé facultatif. Un clic l\'ouvre sur une carte.',
    refreshPreview: 'Va chercher de nouveau l\'image d\'aperçu du site (celle qu\'affichent les réseaux sociaux) et la range dans SPOK. Si le site n\'en fournit pas ou ne répond pas, rien ne change.',
    addContactConfirm: 'Enregistre la coordonnée tout de suite sur l\'élément. Elle est visible des membres de l\'espace, cherchable et exportée.',
    addDIAGRAM: 'Crée un schéma vide, enregistré tout de suite : cliquez « Modifier » pour le dessiner dans draw.io.',
    addSECRET: `Range un mot de passe ou un code sur l'élément, chiffré et masqué (${ITEM_SECRETS_MAX} au plus). Vous choisissez qui peut l'afficher.`,
    secretReveal: 'Affiche la valeur 30 secondes, puis la masque. La consultation est enregistrée.',
    secretCopy: 'Copie la valeur dans le presse-papiers ; il est vidé au bout de 30 secondes. La consultation est enregistrée.',
    secretEdit: 'Modifier le libellé, l\'identifiant, la valeur ou la visibilité (seul l\'auteur le peut).',
    secretRemoveHint: 'Retirer cette donnée sécurisée (une confirmation est demandée).',
    secretRemove: 'La donnée est effacée définitivement, pour tous ceux qui pouvaient la voir. Elle ne peut pas être restaurée. L\'élément et ses autres contenus restent.',
    secretVisibility: 'Qui peut afficher la valeur : « Moi seul » ou « Membres de l\'espace ». Si l\'élément part dans un autre espace, elle repasse « Moi seul ».',
    moveTo: 'Déplacer ce contenu vers un autre élément (de cet espace ou d\'un autre) : il quitte celui-ci tout de suite. Vous devez pouvoir modifier les deux éléments.',
    secretMoveTo: 'Déplacer cette donnée vers un autre élément : elle quitte celui-ci tout de suite, toujours chiffrée. Vers un autre espace, elle repasse « Moi seul ».',
    secretSave: 'Enregistre tout de suite la donnée, chiffrée. Le libellé reste lisible ; la valeur et l\'identifiant ne le sont qu\'avec l\'œil ou Copier.',
    addLinkConfirm: 'Enregistre le lien tout de suite sur l\'élément.',
    rename: 'Renommer ce contenu (le fichier lui-même n\'est pas modifié).',
    moveUp: 'Place ce contenu un cran avant, parmi ceux de sa sorte. L\'ordre est enregistré tout de suite.',
    moveDown: 'Place ce contenu un cran après, parmi ceux de sa sorte. L\'ordre est enregistré tout de suite.',
    removeHint: 'Retirer ce contenu de l\'élément (une confirmation est demandée).',
    remove: `Le contenu est retiré de l'élément tout de suite. Un fichier envoyé qui n'est plus utilisé ailleurs n'est plus accessible à son adresse ; il est gardé ${STORAGE_TRASH_GRACE_DAYS} jours dans la corbeille du stockage, puis effacé. Les autres contenus et l'élément restent.`,
    badges: 'Contenus de l\'élément : nombre d\'images, de fichiers, de liens et de schémas. La miniature montre déjà la première image (sinon le premier schéma, sinon la première page d\'un fichier), elle n\'est pas comptée. Ouvrez la fiche pour les voir.',
  },
  fields: {
    unsaved: 'Enregistrez d\'abord l\'élément pour lui ajouter des contenus.',
    empty: 'Aucun contenu. « + Ajouter » joint un fichier, une image, un lien ou un schéma.',
    link: 'L\'adresse doit commencer par http:// ou https://.',
    contact: 'Valeur en clair : visible des membres de l\'espace, retrouvée par la recherche et reprise dans l\'export. Pour un mot de passe, choisissez « Donnée sécurisée ».',
    move: 'Choisissez l\'élément qui recevra ce contenu, puis « Déplacer ici ». Il y est rangé en dernier de sa sorte ; le déplacement est noté dans l\'historique des deux éléments.',
    secretValue:'La valeur et l\'identifiant sont chiffrés et ne s\'affichent qu\'à la demande. Le libellé, lui, reste lisible : n\'y mettez rien de secret.',
    secretVisibility: '« Moi seul » : vous seul pourrez l\'afficher. « Membres de l\'espace » : chaque membre pourra l\'afficher et la copier. L\'administrateur ne peut pas lire la valeur.',
  },
  tour: [
    {
      popover: {
        title: 'Contenus',
        description: 'Ce que porte l\'élément : images, fichiers, liens et schémas, plusieurs de chaque sorte.',
      },
    },
    ...elementTourSteps('item-contents', elements),
  ],
};
