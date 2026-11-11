/*
 * Vue Documents : contenus Fichier de TOUS les éléments, quel que soit leur type — une carte par fichier
 * (contentEntries, lib/itemContentEntries ; décision Thomas 2026-11-08, règle item-contents-views), groupées par
 * parent de l'élément ; titre = titre de l'élément (+ nom du fichier s'il en porte plusieurs), extension tirée du nom.
 * Glisser une carte déplace l'élément (id de glisser = id du contenu) ; clic, menu ⋮ : l'élément ; ⬇ : ce fichier.
 * Import en masse (bouton + glisser-déposer de fichiers sur la vue) via useBulkUpload : un élément « Élément »
 * (UNDEFINED) portant un contenu Fichier par fichier, créé à la racine — réservé à canEdit et à l'espace courant.
 * Liens vers une URL d'item via safeHref (règle user-html-sanitized).
 * Aperçu (2026-11-11) : une carte dont le fichier a un aperçu montre sa 1re page, ou à défaut le début du texte, en
 * haut de la carte à la place de l'icône (FilePreviewThumb, règle item-contents-file-preview).
 */
import { useMemo, useCallback } from 'react';
import { useBulkUpload } from '../../hooks/useBulkUpload';
import { BulkUploadButton, BulkUploadDropZone, BulkUploadStatus } from '../ui/BulkUploadButton';
import { DndContext, pointerWithin, PointerSensor, useSensor, useSensors, DragEndEvent, useDraggable, useDroppable } from '@dnd-kit/core';
import { FileText, Download, FolderKanban, GripVertical } from 'lucide-react';
import { SpaceExportButton } from '../SpaceExportButton';
import { ViewHelpButton } from '../ViewHelpButton';
import type { Item } from '@spok/shared';
import { DEFAULT_REFERENTIELS } from '@spok/shared';
import { ItemActionMenu } from '../ui/ItemActionMenu';
import { getFileIcon } from '../../constants/ui';
import { buildItemMenuGroups, hasHeadings, hasChildItems } from '../../lib/itemMenuGroups';
import { EmptyHelp } from '../../help/EmptyHelp';
import { safeHref } from '../../lib/sanitizeHtml';
import { contentEntries, fileExtension, type ContentEntry } from '../../lib/itemContentEntries';
import { FilePreviewThumb, hasFilePreview } from '../contents/FilePreviewThumb';

/** Icône selon l'extension du fichier (nom du contenu, sinon adresse) */
function entryIcon(entry: ContentEntry) {
  const ext = fileExtension(entry);
  return getFileIcon(ext ? `fichier.${ext.toLowerCase()}` : entry.url ?? '');
}

const FILE_KINDS = ['FILE'] as const;

function DraggableDoc({ id, children, canDrag }: { id: string; children: React.ReactNode; canDrag: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id, disabled: !canDrag });
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)`, zIndex: isDragging ? 50 : undefined } : undefined;
  return (
    <div ref={setNodeRef} style={style} className={`group/drag relative ${isDragging ? 'opacity-60 shadow-lg' : ''}`}>
      {canDrag && (
        <div {...attributes} {...listeners} className="absolute top-2 left-2 z-10 p-0.5 text-muted-foreground/40 hover:text-muted-foreground cursor-grab opacity-0 group-hover/drag:opacity-100 transition-opacity">
          <GripVertical className="w-3.5 h-3.5" />
        </div>
      )}
      {children}
    </div>
  );
}

function DroppableDocGroup({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`border border-border rounded-lg bg-card transition-colors ${isOver ? 'border-primary bg-primary/5' : ''}`}>
      {children}
    </div>
  );
}

interface DocGroup {
  parentId: string | null;
  parentTitle: string;
  docs: ContentEntry[];
}

interface PortalGroup {
  spaceId: string;
  spaceName: string;
  items: Item[];
}

interface DocumentsViewProps {
  items: Item[] | undefined;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onUpdateStatus?: (id: string, status: string) => void;
  onAddChild?: (id: string) => void;
  onMoveToSpace?: (id: string) => void;
  onDuplicateToSpace?: (id: string) => void;
  onConvertToSpace?: (id: string) => void;
  onSelfAssign?: (id: string) => void;
  onMerge?: (id: string) => void;
  onAbsorbChildren?: (id: string) => void;
  onSplitDescription?: (id: string) => void;
  onOpen?: (id: string) => void;
  onOpenInNewTab?: (id: string) => void;
  onMove?: (id: string, parentId: string | null, position: number) => void;
  referentiels?: any;
  canEdit?: boolean;
  canEditItem?: (item: { createdById?: string }) => boolean;
  portalGroups?: PortalGroup[];
  currentSpaceId?: string;
  spaceName?: string;
  viewContainerRef?: React.RefObject<HTMLDivElement>;
  onStartTour?: () => void;
  pulseHelp?: boolean;
}

export function DocumentsView({ items, onEdit, onDelete, onUpdateStatus, onAddChild, onMoveToSpace, onDuplicateToSpace, onConvertToSpace, onSelfAssign, onMerge, onAbsorbChildren, onSplitDescription, onOpen,
            onOpenInNewTab, onMove, referentiels, canEdit = true, canEditItem, portalGroups, currentSpaceId,
            spaceName, viewContainerRef, onStartTour, pulseHelp }: DocumentsViewProps) {
  const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const bulk = useBulkUpload(currentSpaceId, 'document');
  const canBulkUpload = canEdit && !!currentSpaceId;
  const documents = useMemo(() => {
    return contentEntries(items, FILE_KINDS);
  }, [items]);

  const groups = useMemo<DocGroup[]>(() => {
    const parentNames: Record<string, string> = {};
    if (items) {
      for (const item of items) parentNames[item.id] = item.title;
    }
    const groupMap = new Map<string | null, ContentEntry[]>();
    for (const doc of documents) {
      const key = doc.item.parentId || null;
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key)!.push(doc);
    }
    const result: DocGroup[] = [];
    const rootDocs = groupMap.get(null);
    if (rootDocs) result.push({ parentId: null, parentTitle: 'Sans parent', docs: rootDocs });
    for (const [parentId, docs] of groupMap) {
      if (parentId === null) continue;
      result.push({ parentId, parentTitle: parentNames[parentId] || 'Parent inconnu', docs });
    }
    return result;
  }, [documents, items]);

  const statusOptions = useMemo(() => {
    const statuses = referentiels?.statuses || DEFAULT_REFERENTIELS.statuses;
    return (statuses as Array<{ id: string; label: string; visible: boolean; order: number }>).filter(s => s.visible).sort((a, b) => a.order - b.order);
  }, [referentiels]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || !onMove) return;
    // id de glisser = id du contenu ; le déplacement porte sur l'élément qui le porte
    const doc = documents.find(d => d.key === active.id);
    const dropId = over.id as string;
    if (!doc || !dropId.startsWith('group:')) return;
    const itemId = doc.item.id;
    const newParentId = dropId === 'group:__root__' ? null : dropId.replace('group:', '');
    if ((doc.item.parentId || null) === newParentId) return;
    const targetGroup = groups.find(g => g.parentId === newParentId);
    const position = targetGroup ? targetGroup.docs.length : 0;
    onMove(itemId, newParentId, position);
  }, [onMove, documents, groups]);

  const header = (
    <div id="view-header" data-devzone="contenu-barre-vue" className="flex items-center gap-1 px-2 py-1 border-b border-border bg-background flex-shrink-0">
      {canBulkUpload && <BulkUploadButton bulk={bulk} kind="document" />}
      <div className="flex-1" />
      <ViewHelpButton viewMode="documents" onStartTour={onStartTour} pulse={pulseHelp} />
      {spaceName && viewContainerRef && (
        <SpaceExportButton items={items ?? []} spaceName={spaceName} viewMode="documents" viewContainerRef={viewContainerRef} />
      )}
    </div>
  );

  if (documents.length === 0) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        {header}
        <BulkUploadStatus bulk={bulk} />
        <BulkUploadDropZone bulk={bulk} kind="document" enabled={canBulkUpload}>
        <EmptyHelp mode="documents" title="Aucun document" icon={FileText}>
          {canBulkUpload && <p className="text-sm text-muted-foreground">Glissez des fichiers ici pour les importer.</p>}
        </EmptyHelp>
        </BulkUploadDropZone>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {header}
      <BulkUploadStatus bulk={bulk} />
    <BulkUploadDropZone bulk={bulk} kind="document" enabled={canBulkUpload}>
    <DndContext sensors={dndSensors} collisionDetection={pointerWithin} onDragEnd={handleDragEnd}>
    <div className="flex-1 overflow-auto p-4 space-y-4">
      {groups.map((group) => (
        <DroppableDocGroup key={group.parentId ?? '__root__'} id={`group:${group.parentId ?? '__root__'}`}>
          <div
            data-help-zone="documents:groupe"
            className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/40 rounded-t-lg cursor-pointer hover:bg-muted/60 transition-colors"
            onClick={() => group.parentId && onEdit?.(group.parentId)}
          >
            <FolderKanban className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <span className="text-sm font-medium truncate">{group.parentTitle}</span>
            <span className="text-xs text-muted-foreground ml-auto flex-shrink-0">{group.docs.length}</span>
          </div>
          <div className="p-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {group.docs.map(entry => {
                const doc = entry.item;
                const Icon = entryIcon(entry);
                const ext = fileExtension(entry);
                return (
                  <DraggableDoc key={entry.key} id={entry.key} canDrag={canEdit && !!onMove}>
                  <div
                    data-tour="documents-row"
                    data-help-zone="documents:ligne"
                    className="group flex flex-wrap items-start gap-3 p-3 rounded-lg border bg-card hover:shadow-md hover:border-primary/30 transition-all cursor-pointer relative"
                    onClick={() => onEdit?.(doc.id)}
                  >
                    {hasFilePreview(entry.content) ? (
                      <FilePreviewThumb content={entry.content} size="md" className="basis-full" />
                    ) : (
                      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                        <Icon className="w-5 h-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{entry.label}</p>
                      {doc.description && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{doc.description}</p>
                      )}
                      {ext && (
                        <span className="inline-block mt-1 px-1.5 py-0.5 text-[10px] font-medium bg-muted rounded">
                          {ext}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <a
                        href={safeHref(entry.url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="p-1 rounded hover:bg-accent opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Telecharger"
                      >
                        <Download className="w-4 h-4 text-muted-foreground" />
                      </a>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                        <ItemActionMenu
                          groups={buildItemMenuGroups(doc.id, { onEdit, onDelete, onUpdateStatus, onAddChild, onMoveToSpace, onDuplicateToSpace, onConvertToSpace, onSelfAssign, onMerge, onAbsorbChildren: hasChildItems(doc) ? onAbsorbChildren : undefined, onSplitDescription: hasHeadings(doc.description) ? onSplitDescription : undefined, onOpen,
            onOpenInNewTab }, { item: doc, canEdit: canEditItem ? canEditItem(doc) : canEdit, statusOptions, currentStatusId: doc.status || undefined })}
                        />
                      </div>
                    </div>
                  </div>
                  </DraggableDoc>
                );
              })}
            </div>
          </div>
        </DroppableDocGroup>
      ))}

      {/* Portal sections for child spaces */}
      {portalGroups?.map(group => {
        const portalDocs = contentEntries(group.items, FILE_KINDS);
        if (portalDocs.length === 0) return null;
        // Group portal docs by parent
        const portalParentNames: Record<string, string> = {};
        for (const item of group.items) portalParentNames[item.id] = item.title;
        const portalGroupMap = new Map<string | null, ContentEntry[]>();
        for (const doc of portalDocs) {
          const key = doc.item.parentId || null;
          if (!portalGroupMap.has(key)) portalGroupMap.set(key, []);
          portalGroupMap.get(key)!.push(doc);
        }
        const portalDocGroups: DocGroup[] = [];
        const rootDocs = portalGroupMap.get(null);
        if (rootDocs) portalDocGroups.push({ parentId: null, parentTitle: 'Sans parent', docs: rootDocs });
        for (const [parentId, docs] of portalGroupMap) {
          if (parentId === null) continue;
          portalDocGroups.push({ parentId, parentTitle: portalParentNames[parentId] || 'Parent inconnu', docs });
        }
        return (
          <div key={`portal-${group.spaceId}`} className="mt-4">
            <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-accent/50 text-sm font-medium text-muted-foreground mb-2">
              <FolderKanban className="w-4 h-4 text-primary" />
              <span>{group.spaceName}</span>
              <span className="text-xs text-muted-foreground/60">({portalDocs.length})</span>
            </div>
            {portalDocGroups.map((pGroup) => (
              <div key={pGroup.parentId ?? '__root__'} className="border border-border rounded-lg bg-card mb-2">
                <div
                  className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/40 rounded-t-lg cursor-pointer hover:bg-muted/60 transition-colors"
                  onClick={() => pGroup.parentId && onEdit?.(pGroup.parentId)}
                >
                  <FolderKanban className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm font-medium truncate">{pGroup.parentTitle}</span>
                  <span className="text-xs text-muted-foreground ml-auto flex-shrink-0">{pGroup.docs.length}</span>
                </div>
                <div className="p-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {pGroup.docs.map(entry => {
                      const doc = entry.item;
                const Icon = entryIcon(entry);
                      const ext = fileExtension(entry);
                      return (
                        <div
                          key={entry.key}
                          className="group flex flex-wrap items-start gap-3 p-3 rounded-lg border bg-card hover:shadow-md hover:border-primary/30 transition-all cursor-pointer relative"
                          onClick={() => onEdit?.(doc.id)}
                        >
                          {hasFilePreview(entry.content) ? (
                            <FilePreviewThumb content={entry.content} size="md" className="basis-full" />
                          ) : (
                            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                              <Icon className="w-5 h-5 text-muted-foreground" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{entry.label}</p>
                            {doc.description && (
                              <p className="text-xs text-muted-foreground truncate mt-0.5">{doc.description}</p>
                            )}
                            {ext && (
                              <span className="inline-block mt-1 px-1.5 py-0.5 text-[10px] font-medium bg-muted rounded">
                                {ext}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <a
                              href={safeHref(entry.url)}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="p-1 rounded hover:bg-accent opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Telecharger"
                            >
                              <Download className="w-4 h-4 text-muted-foreground" />
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
    </DndContext>
    </BulkUploadDropZone>
    </div>
  );
}
