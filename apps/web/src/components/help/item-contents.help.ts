/* Aide utilisateur de la zone « Contenus » de la fiche (ItemContentsSection : mode Modifier ; ItemContentsRead : mode
   Afficher), écrite en éléments d'aide (help/elements.ts) — registre help/pageHelp.ts, clé 'item-contents'.
   Zones data-help-zone item-contents:ajouter, item-contents:contenus et item-contents:apercu (aperçu d'un fichier,
   présent seulement si un fichier en a un — l'étape du tour est alors sautée ; annonce file-preview, 2026-11-11).
   Mise en forme en vignettes (2026-11-11) : textes de contenus, apercu, moveUp / moveDown (← →) ; pas d'annonce
   propre, les contenus multiples ne sont pas encore en ligne (leur annonce item-contents couvre la présentation).
   hints : rappels fonctionnels de chaque action à effet (ajouter chaque sorte, renommer, réordonner, retirer), vérifiés
   dans apps/api/src/routes/item-contents.ts ; fields : phrases visibles (élément non enregistré, zone vide, lien).
   L'annonce `item-contents` est sans date : la session MEP la date au déploiement (règles : skill spok-doc). */
import type { HelpEntry } from '../../help/types';
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
    text: 'Les contenus de l\'élément, en vignettes alignées les unes à côté des autres et regroupées toujours dans le même ordre : Images, Fichiers, Liens, Schémas. Le haut de chaque vignette montre un aperçu. Cliquez une image pour l\'agrandir, un fichier ou un lien pour l\'ouvrir, un schéma pour le modifier. Au pied de la vignette, les flèches ← → changent sa place parmi ceux de sa sorte, le crayon la renomme et la corbeille la retire. En mode Afficher, les vignettes sont plus grandes.',
    side: 'top',
    changes: [{ id: 'item-contents', kind: 'evolution', text: 'Un élément porte maintenant plusieurs contenus (images, fichiers, liens, schémas), quel que soit son type : « + Ajouter » sous la description.', date: '2026-11-11' }],
  },
  apercu: {
    title: 'Aperçu d\'un fichier',
    short: 'Le début du fichier, pour savoir ce qu\'il contient sans l\'ouvrir.',
    text: 'À l\'envoi d\'un fichier, SPOK prépare son aperçu : la première page d\'un PDF, la miniature enregistrée dans un fichier Word, Excel ou PowerPoint, et le début du texte d\'un PDF, d\'un document Word ou d\'un fichier texte. L\'aperçu occupe le haut de la vignette du fichier dans la fiche ; il apparaît aussi dans la vue Documents et sur la vignette de l\'élément. Cliquez dessus pour ouvrir le fichier. Les autres formats montrent leur icône et leur extension, et un fichier Word enregistré sans miniature montre seulement son début de texte.',
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
    addFILE: 'Joint un fichier (PDF, bureautique…, 25 Mo au plus ; exécutables refusés). Il est enregistré dès l\'envoi.',
    addIMAGE: 'Joint une image (déposée, choisie ou collée avec Ctrl+V), réduite si besoin. Elle est enregistrée dès l\'envoi.',
    addLINK: 'Joint une adresse web, avec un nom facultatif.',
    addDIAGRAM: 'Crée un schéma vide, enregistré tout de suite : cliquez « Modifier » pour le dessiner dans draw.io.',
    addLinkConfirm: 'Enregistre le lien tout de suite sur l\'élément.',
    rename: 'Renommer ce contenu (le fichier lui-même n\'est pas modifié).',
    moveUp: 'Place ce contenu un cran avant, parmi ceux de sa sorte. L\'ordre est enregistré tout de suite.',
    moveDown: 'Place ce contenu un cran après, parmi ceux de sa sorte. L\'ordre est enregistré tout de suite.',
    removeHint: 'Retirer ce contenu de l\'élément (une confirmation est demandée).',
    remove: 'Le contenu est retiré de l\'élément tout de suite. Un fichier envoyé est effacé du stockage s\'il n\'est plus utilisé ailleurs. Les autres contenus et l\'élément restent.',
    badges: 'Contenus de l\'élément : nombre d\'images, de fichiers, de liens et de schémas. La miniature montre déjà la première image (sinon le premier schéma, sinon la première page d\'un fichier), elle n\'est pas comptée. Ouvrez la fiche pour les voir.',
  },
  fields: {
    unsaved: 'Enregistrez d\'abord l\'élément pour lui ajouter des contenus.',
    empty: 'Aucun contenu. « + Ajouter » joint un fichier, une image, un lien ou un schéma.',
    link: 'L\'adresse doit commencer par http:// ou https://.',
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
