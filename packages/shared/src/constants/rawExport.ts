/* Registre de l'export brut réimportable (« Données brutes », décision Thomas 2026-11-27) — SOURCE UNIQUE du format.
   Raison d'être : un espace et ses sous-espaces exportés en JSON ou XML, réimportables dans SPOK (prod ↔ local, autre
   communauté) ou lisibles par un autre outil. Le document (types/rawExport.ts) est le même dans les deux formats ; le XML
   en est la traduction exacte (apps/api/src/utils/rawExportXml.ts).
   - RAW_EXPORT_FILE_FORMATS : formats proposés (menu d'export de l'espace, route GET /spaces/:id/raw-export, import).
   - RAW_EXPORT_SECTIONS : listes du document, avec leur libellé (aperçu et compte rendu de l'import) et le nom d'une
     entrée en XML ; RAW_EXPORT_XML_LIST_ITEMS ajoute les listes imbriquées. RAW_EXPORT_OPAQUE_KEYS : valeurs JSON libres,
     écrites telles quelles (texte JSON) en XML.
   - RAW_EXPORT_ITEM_SOURCES / RAW_EXPORT_EXCLUDED_ITEM_FIELDS : couverture du modèle Prisma `Item` (test API
     raw-export-coverage.test.ts) — un champ ajouté au modèle doit être exporté ou exclu avec sa raison.
   Règles : les données sécurisées ne sont jamais exportées ; un import recrée tout avec de nouveaux identifiants (copie,
   jamais d'écrasement). Ne jamais recopier ces listes ailleurs : en dériver. */

export const RAW_EXPORT_FORMAT_ID = 'spok-raw-export';
export const RAW_EXPORT_VERSION = 1;
/** Taille maximale d'un fichier à importer (octets) — limite du corps de la route d'import */
export const RAW_EXPORT_MAX_BYTES = 25 * 1024 * 1024;

export const RAW_EXPORT_FILE_FORMATS = [
  { id: 'json', label: 'JSON', extension: 'json', mimeType: 'application/json' },
  { id: 'xml', label: 'XML', extension: 'xml', mimeType: 'application/xml' },
] as const;

export type RawExportFileFormat = (typeof RAW_EXPORT_FILE_FORMATS)[number]['id'];
export const RAW_EXPORT_FILE_FORMAT_IDS = RAW_EXPORT_FILE_FORMATS.map((f) => f.id) as unknown as readonly [RawExportFileFormat, ...RawExportFileFormat[]];

/** Format d'un fichier d'après son nom (extension), undefined si inconnu */
export function rawExportFormatOfFilename(name: string): RawExportFileFormat | undefined {
  const ext = name.split('.').pop()?.toLowerCase();
  return RAW_EXPORT_FILE_FORMATS.find((f) => f.extension === ext)?.id;
}

/** Listes de premier niveau du document, dans l'ordre d'écriture */
export const RAW_EXPORT_SECTIONS = [
  { key: 'spaces', label: 'Espaces', xmlItem: 'space' },
  { key: 'users', label: 'Personnes', xmlItem: 'user' },
  { key: 'tags', label: 'Tags', xmlItem: 'tag' },
  { key: 'items', label: 'Éléments', xmlItem: 'item' },
  { key: 'relations', label: 'Relations', xmlItem: 'relation' },
  { key: 'contributions', label: 'Contributions', xmlItem: 'contribution' },
] as const;

export type RawExportSectionKey = (typeof RAW_EXPORT_SECTIONS)[number]['key'];

/** Libellés du compte rendu d'un import (RawImportReport : created / dropped), lus par la fenêtre d'import */
export const RAW_IMPORT_CREATED_LABELS = {
  spaces: 'Espaces', items: 'Éléments', contents: 'Contenus', relations: 'Relations', contributions: 'Contributions', tags: 'Tags créés',
} as const;
export const RAW_IMPORT_DROPPED_LABELS = {
  relations: 'Relations vers des éléments absents du fichier',
  articleBlocks: 'Blocs d\'article vers des éléments absents du fichier',
  processPlaces: 'Places de process vers des éléments absents du fichier',
  optionRefs: 'Réponses de question renvoyant à des éléments absents du fichier',
} as const;

/** Nom XML d'une entrée de liste, par nom de liste (premier niveau et listes imbriquées) */
export const RAW_EXPORT_XML_LIST_ITEMS: Readonly<Record<string, string>> = {
  ...Object.fromEntries(RAW_EXPORT_SECTIONS.map((s) => [s.key, s.xmlItem])),
  tagIds: 'tagId',
  externalRefs: 'ref',
  contents: 'content',
  options: 'option',
  blocks: 'block',
  lanes: 'lane',
  nodes: 'node',
};

/** Élément racine du XML */
export const RAW_EXPORT_XML_ROOT = 'spokExport';

/** Clés dont la valeur est un JSON libre (écrit en texte JSON dans le XML) */
export const RAW_EXPORT_OPAQUE_KEYS = ['legacyContent'] as const;

/**
 * Champs du modèle `Item` portés par le document (nom du champ Prisma → où il va). Le test raw-export-coverage lit
 * schema.prisma : chaque champ est ici ou dans RAW_EXPORT_EXCLUDED_ITEM_FIELDS.
 */
export const RAW_EXPORT_ITEM_SOURCES: Readonly<Record<string, string>> = {
  id: 'items[].id (référence interne au fichier)',
  type: 'items[].type',
  title: 'items[].title',
  description: 'items[].description',
  content: 'items[].legacyContent',
  url: 'items[].url',
  status: 'items[].status',
  priority: 'items[].priority',
  position: 'items[].position',
  dueDate: 'items[].dueDate',
  startDate: 'items[].startDate',
  endDate: 'items[].endDate',
  manualHorizon: 'items[].manualHorizon',
  horizonSetAt: 'items[].horizonSetAt',
  createdAt: 'items[].createdAt',
  updatedAt: 'items[].updatedAt',
  spaceId: 'items[].spaceId',
  createdById: 'items[].createdById → users[]',
  assignedToId: 'items[].assignedToId → users[]',
  assignedToName: 'items[].assignedToName',
  parentId: 'items[].parentId',
  tags: 'items[].tagIds → tags[]',
  externalRefs: 'items[].externalRefs',
  contents: 'items[].contents',
  question: 'items[].question',
  questionOptions: 'items[].question.options',
  articleBlocks: 'items[].article.blocks',
  processNodes: 'items[].process.nodes',
  processLanes: 'items[].process.lanes',
  relationsFrom: 'relations[]',
  relationsTo: 'relations[]',
  contributions: 'contributions[]',
};

/** Champs du modèle `Item` volontairement absents du document, avec leur raison */
export const RAW_EXPORT_EXCLUDED_ITEM_FIELDS: Readonly<Record<string, string>> = {
  secrets: 'Données sécurisées : jamais exportées',
  space: 'Relation : portée par spaceId',
  createdBy: 'Relation : portée par createdById',
  assignedTo: 'Relation : portée par assignedToId',
  updatedById: 'Auteur de la dernière modification : historique',
  updatedBy: 'Auteur de la dernière modification : historique',
  assignedAt: 'Accusé de lecture de l\'assignation (technique)',
  assignedById: 'Accusé de lecture de l\'assignation (technique)',
  lockedAt: 'Verrou des copies de séance (technique)',
  sourceItemId: 'Trace d\'origine d\'une copie de séance (technique)',
  sourceSpaceId: 'Trace d\'origine d\'une copie de séance (technique)',
  parent: 'Relation : portée par parentId',
  children: 'Déduits de parentId',
  reactions: 'Réactions personnelles',
  bookmarkedBy: 'Favoris personnels',
  views: 'Lectures personnelles',
  dayPlanEntries: 'Planning du jour personnel',
  liveSessionEntries: 'Déroulé des séances (propre aux séances)',
  liveSessionReport: 'Compte rendu de séance (propre aux séances)',
  processPlacements: 'Côté inverse de process.nodes',
  processLaneOf: 'Côté inverse de process.lanes',
  referencedIn: 'Côté inverse de article.blocks',
  questionOptionRefs: 'Côté inverse de question.options[].refItemId',
};
