/* Registre des règles de gestion implicites (type/statut/priorité), consulté par RuleHint (UI dev) et par Claude comme documentation vivante. */

export interface ItemBusinessRule {
  id: string;
  category: 'type' | 'status' | 'priority';
  appliesToValues: string[];
  trigger: string;
  effect: string;
  location: string;
}

export interface PageBusinessRule {
  id: string;
  page: string;
  trigger: string;
  effect: string;
  location: string;
}

export const ITEM_BUSINESS_RULES: ItemBusinessRule[] = [
  {
    id: 'default-type-undefined',
    category: 'type',
    appliesToValues: ['UNDEFINED'],
    trigger: "Création d'un item",
    effect: 'Type initialisé à UNDEFINED ("Non défini")',
    location: 'apps/web/src/pages/SpacePage.tsx:470,502,517',
  },
  {
    id: 'type-shows-url-field',
    category: 'type',
    appliesToValues: ['LINK'],
    trigger: 'Type = Lien',
    effect: 'Affiche un champ URL',
    location: 'apps/web/src/components/ItemEditModal.tsx:1244-1256',
  },
  {
    id: 'type-shows-diagram-editor',
    category: 'type',
    appliesToValues: ['DIAGRAM'],
    trigger: 'Type = Diagramme',
    effect: "Affiche l'éditeur de diagramme (draw.io)",
    location: 'apps/web/src/components/ItemEditModal.tsx:1259-1275',
  },
  {
    id: 'type-shows-image-upload',
    category: 'type',
    appliesToValues: ['IMAGE'],
    trigger: 'Type = Image',
    effect: "Affiche la zone d'upload d'image",
    location: 'apps/web/src/components/ItemEditModal.tsx:1278-1299',
  },
  {
    id: 'type-shows-document-upload',
    category: 'type',
    appliesToValues: ['DOCUMENT'],
    trigger: 'Type = Document',
    effect: "Affiche la zone d'upload de fichier",
    location: 'apps/web/src/components/ItemEditModal.tsx:1302-1318',
  },
  {
    id: 'type-shows-hours-mode',
    category: 'type',
    appliesToValues: ['MEETING'],
    trigger: 'Type = Réunion',
    effect: "Affiche les dates en mode heures (H:MM) par défaut, au lieu de jours pleins",
    location: 'apps/web/src/components/ItemEditModal.tsx:319-324,1033,1017',
  },
  {
    id: 'type-default-duration-meeting-task',
    category: 'type',
    appliesToValues: ['MEETING', 'TASK'],
    trigger: 'Date de début renseignée sans date de fin',
    effect: 'Date de fin par défaut = début + 1 heure',
    location: 'apps/web/src/components/ItemEditModal.tsx:498-499',
  },
  {
    id: 'type-default-duration-project',
    category: 'type',
    appliesToValues: ['PROJECT'],
    trigger: 'Date de début renseignée sans date de fin',
    effect: 'Date de fin par défaut = début + 1 mois',
    location: 'apps/web/src/components/ItemEditModal.tsx:500-501',
  },
  {
    id: 'type-default-duration-period',
    category: 'type',
    appliesToValues: ['PERIOD'],
    trigger: 'Date de début renseignée sans date de fin',
    effect: 'Date de fin par défaut = début + 1 jour',
    location: 'apps/web/src/components/ItemEditModal.tsx:502-503',
  },
  {
    id: 'status-clear-dates',
    category: 'status',
    appliesToValues: ['undefined'],
    trigger: 'Statut = "Non défini"',
    effect: 'Vide les dates de début et de fin',
    location: 'apps/web/src/components/ItemEditModal.tsx:1084',
  },
  {
    id: 'status-autofill-start',
    category: 'status',
    appliesToValues: ['todo', 'in_progress', 'to_validate', 'scheduled', 'late'],
    trigger: 'Statut choisi (≠ "Non défini"), date de début vide',
    effect: "Remplit la date de début à aujourd'hui",
    location: 'apps/web/src/components/ItemEditModal.tsx:1088',
  },
  {
    id: 'status-autofill-end-terminal',
    category: 'status',
    appliesToValues: ['done', 'cancelled'],
    trigger: 'Statut = "Terminé"/"Annulé", date de fin vide',
    effect: "Remplit la date de fin à aujourd'hui",
    location: 'apps/web/src/components/ItemEditModal.tsx:1087',
  },
];

export const PAGE_BUSINESS_RULES: PageBusinessRule[] = [];
