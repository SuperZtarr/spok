/*
 * Zone « Contenus » de la fiche (contenus multiples, lot 2, décision Thomas 2026-11-08) : les images, fichiers, liens et
 * schémas portés par un élément, plusieurs par sorte, quel que soit son type. Regroupés dans l'ordre fixe Images,
 * Fichiers, Liens, Schémas (ITEM_CONTENT_KINDS / sortItemContents de @spok/shared) ; ordre réglable à l'intérieur d'une
 * sorte (Monter / Descendre).
 * Deux composants :
 * - ItemContentsSection (fiche, mode Modifier) : bouton « + Ajouter » (Fichier, Image, Lien, Schéma), renommer,
 *   supprimer (confirmation), réordonner ; schéma modifié dans draw.io (xml enregistré 2 s après la dernière retouche,
 *   aperçu PNG envoyé à « Enregistrer et fermer » de draw.io). Sans droit (lecteur, copie de séance verrouillée) :
 *   affichage seul. Chaque écriture part tout de suite (pas besoin d'« Enregistrer »).
 * - ItemContentsRead (mode Afficher, ItemReadView) : les mêmes contenus en grand, sans action d'écriture.
 * Mise en forme en vignettes (décision Thomas 2026-11-11), dans les deux modes : chaque sorte est une suite de
 * vignettes alignées à gauche (flex-wrap), grande zone d'aperçu en haut (ContentTile / TilePreview), nom et détail
 * dessous ; en mode Modifier, actions en pied (renommer, ← → dans la sorte, retirer), toujours visibles ; en mode
 * Afficher, vignettes plus grandes. Fichier : 1re page ou début du texte (FilePreviewThumb), sinon icône + extension ;
 * schéma modifiable : DrawioEditor compact (clic = draw.io plein écran).
 * Props clés : spaceId, itemId (absent = élément pas encore enregistré), contents (item.contents, détail complet avec
 * xml), canEdit, onTitleHint (titre suggéré par le premier fichier ou lien, appliqué par la fiche si le titre est vide).
 * Règles : zone masquée sur un Article (décidé par l'appelant) ; adresses toujours passées par safeHref / isSafeUrl
 * (règle user-html-sanitized) ; écritures via hooks/useItemContents seulement. Aide : components/help/item-contents.help.ts
 * (zones data-help-zone item-contents:*, rappels pageHint('item-contents', …)). Règle de gestion : item-contents-zone.
 */
import { useEffect, useRef, useState } from 'react';
import { Plus, Image as ImageIcon, FileText, Link2, Workflow, Trash2, ChevronLeft, ChevronRight, Pencil, ExternalLink, Check, X } from 'lucide-react';
import { fileExtension, hostOf } from '../../lib/itemFace';
import { ITEM_CONTENT_KINDS, sortItemContents, type ItemContent, type ItemContentKind } from '@spok/shared';
import { useItemContents } from '../../hooks/useItemContents';
import { isSafeUrl, safeHref } from '../../lib/sanitizeHtml';
import { HelpHint } from '../../help/HelpHint';
import { FieldHelp } from '../../help/FieldHelp';
import { pageHint } from '../../help/pageHint';
import { ImageUploadZone } from '../ui/ImageUploadZone';
import { FileUploadZone } from '../ui/FileUploadZone';
import { DrawioEditor } from '../ui/DrawioEditor';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { ConfirmModal } from '../ConfirmModal';
import { fileNameToTitle, urlToTitle } from '../item-edit-helpers';
import { FilePreviewThumb, hasFilePreview } from './FilePreviewThumb';

export const KIND_LABELS: Record<ItemContentKind, string> = { IMAGE: 'Images', FILE: 'Fichiers', LINK: 'Liens', DIAGRAM: 'Schémas' };
const ADD_LABELS: Record<ItemContentKind, string> = { FILE: 'Fichier', IMAGE: 'Image', LINK: 'Lien', DIAGRAM: 'Schéma' };
/** Ordre du menu « + Ajouter » (décision Thomas) — l'affichage, lui, suit ITEM_CONTENT_KINDS */
const ADD_ORDER: ItemContentKind[] = ['FILE', 'IMAGE', 'LINK', 'DIAGRAM'];
const KIND_ICONS = { IMAGE: ImageIcon, FILE: FileText, LINK: Link2, DIAGRAM: Workflow } as const;

/** Taille lisible (Ko / Mo) */
export function formatSize(size: number | null | undefined): string | null {
  if (!size) return null;
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} Ko`;
  return `${(size / (1024 * 1024)).toFixed(1).replace('.', ',')} Mo`;
}

/** Contenus regroupés par sorte, dans l'ordre fixe, sortes vides retirées */
export function groupContents(contents: ItemContent[] | undefined): Array<[ItemContentKind, ItemContent[]]> {
  const sorted = sortItemContents(contents ?? []);
  return ITEM_CONTENT_KINDS
    .map((kind) => [kind, sorted.filter((c) => c.kind === kind)] as [ItemContentKind, ItemContent[]])
    .filter(([, list]) => list.length > 0);
}

const displayName = (c: ItemContent) => c.name?.trim() || (c.kind === 'LINK' ? c.url : null) || KIND_LABELS[c.kind];

/** Image en plein écran (clic pour fermer) */
function Lightbox({ url, alt, onClose }: { url: string; alt: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 cursor-pointer" onClick={onClose}>
      <img src={url} alt={alt} className="max-w-[95vw] max-h-[95vh] object-contain rounded-lg shadow-2xl" />
    </div>
  );
}

interface SectionProps {
  spaceId: string;
  itemId?: string;
  contents?: ItemContent[];
  canEdit: boolean;
  onTitleHint?: (title: string) => void;
}

export function ItemContentsSection({ spaceId, itemId, contents, canEdit, onTitleHint }: SectionProps) {
  const api = useItemContents(spaceId, itemId);
  const [menuOpen, setMenuOpen] = useState(false);
  const [adding, setAdding] = useState<ItemContentKind | null>(null);
  const [toRemove, setToRemove] = useState<ItemContent | null>(null);
  const [lightbox, setLightbox] = useState<ItemContent | null>(null);
  const groups = groupContents(contents);
  const writable = canEdit && !!itemId;
  const error = [api.add, api.upload, api.update, api.remove, api.reorder].find((m) => m.isError)?.error as Error | undefined;

  // Changement d'élément dans la même fiche : formulaires d'ajout refermés
  useEffect(() => { setAdding(null); setMenuOpen(false); setToRemove(null); }, [itemId]);

  const choose = (kind: ItemContentKind) => {
    setMenuOpen(false);
    if (kind === 'DIAGRAM') { api.add.mutate({ kind: 'DIAGRAM', xml: '' }); return; }
    setAdding(kind);
  };

  const uploadFile = (kind: 'image' | 'file', file: File) => {
    onTitleHint?.(fileNameToTitle(file.name));
    api.upload.mutate({ kind, file }, { onSuccess: () => setAdding(null) });
  };

  const move = (list: ItemContent[], index: number, delta: number) => {
    const ids = list.map((c) => c.id);
    const [moved] = ids.splice(index, 1);
    ids.splice(index + delta, 0, moved);
    api.reorder.mutate(ids);
  };

  if (!canEdit && groups.length === 0) return null;

  return (
    <div className="space-y-3" data-devzone="item-medias">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">Contenus</span>
        {writable && (
          <div className="relative" data-help-zone="item-contents:ajouter">
            <HelpHint text={pageHint('item-contents', 'add')}>
              <Button type="button" variant="bordered" size="sm" onClick={() => setMenuOpen((o) => !o)} aria-expanded={menuOpen}>
                <Plus className="w-4 h-4 mr-1" /> Ajouter
              </Button>
            </HelpHint>
            {menuOpen && (
              <div className="absolute right-0 z-20 mt-1 w-44 rounded-md border bg-popover shadow-md py-1" role="menu">
                {ADD_ORDER.map((kind) => {
                  const Icon = KIND_ICONS[kind];
                  return (
                    <HelpHint key={kind} text={pageHint('item-contents', `add${kind}`)} className="block">
                      <button type="button" role="menuitem" onClick={() => choose(kind)}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent text-left">
                        <Icon className="w-4 h-4" /> {ADD_LABELS[kind]}
                      </button>
                    </HelpHint>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {canEdit && !itemId && <FieldHelp page="item-contents" field="unsaved" />}
      {writable && groups.length === 0 && !adding && <FieldHelp page="item-contents" field="empty" />}

      {adding === 'IMAGE' && (
        <AddSlot onCancel={() => setAdding(null)}>
          <ImageUploadZone onUpload={(file) => uploadFile('image', file)} isUploading={api.upload.isPending} />
        </AddSlot>
      )}
      {adding === 'FILE' && (
        <AddSlot onCancel={() => setAdding(null)}>
          <FileUploadZone onUpload={(file) => uploadFile('file', file)} isUploading={api.upload.isPending} />
        </AddSlot>
      )}
      {adding === 'LINK' && (
        <LinkForm pending={api.add.isPending} onCancel={() => setAdding(null)}
          onSubmit={(url, name) => {
            const hint = urlToTitle(url);
            if (hint) onTitleHint?.(name || hint);
            api.add.mutate({ kind: 'LINK', url, name: name || null }, { onSuccess: () => setAdding(null) });
          }} />
      )}

      {error && <p className="text-sm text-destructive">{error.message || 'Opération impossible sur ce contenu'}</p>}

      <div className="space-y-3" data-help-zone="item-contents:contenus">
        {groups.map(([kind, list]) => (
          <section key={kind} className="space-y-1.5" aria-label={KIND_LABELS[kind]}>
            <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{KIND_LABELS[kind]}</h4>
            <div className="flex flex-wrap gap-2">
              {list.map((c, i) => (
                <ContentRow key={c.id} content={c} canEdit={writable}
                  first={i === 0} last={i === list.length - 1}
                  onUp={() => move(list, i, -1)} onDown={() => move(list, i, 1)}
                  onRemove={() => setToRemove(c)} onOpenImage={() => setLightbox(c)}
                  onRename={(name) => api.update.mutate({ id: c.id, name: name || null })}
                  diagram={kind === 'DIAGRAM' ? {
                    save: (xml) => api.update.mutateAsync({ id: c.id, xml }),
                    preview: (png) => api.upload.mutateAsync({ kind: 'image', file: png, previewOf: c.id }),
                  } : undefined} />
              ))}
            </div>
          </section>
        ))}
      </div>

      {lightbox?.url && isSafeUrl(lightbox.url) && <Lightbox url={lightbox.url} alt={displayName(lightbox) ?? ''} onClose={() => setLightbox(null)} />}
      <ConfirmModal
        isOpen={!!toRemove}
        onClose={() => setToRemove(null)}
        onConfirm={() => { if (toRemove) api.remove.mutate(toRemove.id, { onSettled: () => setToRemove(null) }); }}
        title="Retirer ce contenu ?"
        message={pageHint('item-contents', 'remove') ?? ''}
        confirmLabel="Retirer"
        confirmVariant="destructive"
        isPending={api.remove.isPending}
      />
    </div>
  );
}

/** Emplacement d'ajout (zone d'envoi) avec sa croix de fermeture */
function AddSlot({ children, onCancel }: { children: React.ReactNode; onCancel: () => void }) {
  return (
    <div className="relative rounded-md border border-dashed p-2">
      <button type="button" onClick={onCancel} className="absolute right-1 top-1 z-10 p-1 text-muted-foreground hover:text-foreground" aria-label="Fermer">
        <X className="w-4 h-4" />
      </button>
      {children}
    </div>
  );
}

/** Saisie d'un lien : adresse (obligatoire, http/https) et nom facultatif */
function LinkForm({ onSubmit, onCancel, pending }: { onSubmit: (url: string, name: string) => void; onCancel: () => void; pending: boolean }) {
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const valid = /^https?:\/\/\S+$/i.test(url.trim());
  const submit = () => { if (valid) onSubmit(url.trim(), name.trim()); };
  return (
    <div className="rounded-md border border-dashed p-2 space-y-2">
      <Input type="url" value={url} autoFocus placeholder="https://…" onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }} aria-label="Adresse du lien" />
      <Input value={name} placeholder="Nom (facultatif)" onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }} aria-label="Nom du lien" />
      <FieldHelp page="item-contents" field="link" />
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="bordered" size="sm" onClick={onCancel}>Annuler</Button>
        <HelpHint text={pageHint('item-contents', 'addLinkConfirm')}>
          <Button type="button" size="sm" disabled={!valid || pending} onClick={submit}>Ajouter le lien</Button>
        </HelpHint>
      </div>
    </div>
  );
}

interface RowProps {
  content: ItemContent;
  canEdit: boolean;
  first: boolean;
  last: boolean;
  onUp: () => void;
  onDown: () => void;
  onRemove: () => void;
  onRename: (name: string) => void;
  onOpenImage: () => void;
  diagram?: { save: (xml: string) => Promise<unknown>; preview: (png: Blob) => Promise<unknown> };
}

/** Un contenu : aperçu selon sa sorte + actions (renommer, monter, descendre, retirer) */
function ContentRow({ content: c, canEdit, first, last, onUp, onDown, onRemove, onRename, onOpenImage, diagram }: RowProps) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(c.name ?? '');
  useEffect(() => { if (!renaming) setName(c.name ?? ''); }, [c.name, renaming]);

  const actions = canEdit && (
    <div className="flex items-center gap-0.5 shrink-0">
      {c.kind !== 'DIAGRAM' && (
        <HelpHint text={pageHint('item-contents', 'rename')}>
          <button type="button" className="p-1 rounded hover:bg-accent text-muted-foreground" onClick={() => setRenaming(true)} aria-label="Renommer">
            <Pencil className="w-3.5 h-3.5" />
          </button>
        </HelpHint>
      )}
      {!(first && last) && (
        <>
          <HelpHint text={pageHint('item-contents', 'moveUp')}>
            <button type="button" className="p-1 rounded hover:bg-accent text-muted-foreground disabled:opacity-30" disabled={first} onClick={onUp} aria-label="Placer avant">
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          </HelpHint>
          <HelpHint text={pageHint('item-contents', 'moveDown')}>
            <button type="button" className="p-1 rounded hover:bg-accent text-muted-foreground disabled:opacity-30" disabled={last} onClick={onDown} aria-label="Placer après">
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </HelpHint>
        </>
      )}
      <HelpHint text={pageHint('item-contents', 'removeHint')}>
        <button type="button" className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive" onClick={onRemove} aria-label="Retirer">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </HelpHint>
    </div>
  );

  const renameField = renaming && (
    <div className="flex items-center gap-1">
      <Input value={name} autoFocus className="h-7 text-sm" onChange={(e) => setName(e.target.value)} aria-label="Nom du contenu"
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); onRename(name.trim()); setRenaming(false); }
          if (e.key === 'Escape') { e.stopPropagation(); setRenaming(false); }
        }} />
      <button type="button" className="p-1 rounded hover:bg-accent" aria-label="Valider le nom" onClick={() => { onRename(name.trim()); setRenaming(false); }}>
        <Check className="w-4 h-4" />
      </button>
    </div>
  );

  const preview = c.kind === 'DIAGRAM'
    ? <DiagramContent content={c} canEdit={canEdit} diagram={diagram} />
    : <TilePreview content={c} onOpenImage={onOpenImage} />;
  return <ContentTile content={c} preview={preview} caption={renameField || undefined} footer={actions || undefined} />;
}

/** Détail sous le nom : taille d'un fichier, site d'un lien */
function tileDetail(c: ItemContent): string | null {
  if (c.kind === 'FILE') return formatSize(c.size);
  if (c.kind === 'LINK') return hostOf(c.url) ?? c.url ?? null;
  return null;
}

/** Icône de remplacement, grande, centrée dans la zone d'aperçu (avec l'extension d'un fichier) */
function TileIcon({ kind, label }: { kind: ItemContentKind; label?: string | null }) {
  const Icon = kind === 'LINK' ? ExternalLink : KIND_ICONS[kind];
  return (
    <span className="flex h-full w-full flex-col items-center justify-center gap-1 text-muted-foreground">
      <Icon className="h-10 w-10 opacity-60" />
      {label && <span className="text-xs font-semibold">{label}</span>}
    </span>
  );
}

/**
 * Zone d'aperçu d'une vignette (hors schéma modifiable) : image (clic = plein écran), fichier (1re page ou début du
 * texte, sinon icône + extension ; clic = ouvrir), lien (icône + site ; clic = ouvrir), schéma en lecture (aperçu,
 * clic = plein écran). Adresses passées par safeHref / isSafeUrl.
 */
function TilePreview({ content: c, onOpenImage }: { content: ItemContent; onOpenImage: () => void }) {
  const href = safeHref(c.url);
  const label = displayName(c) ?? '';
  if (c.kind === 'IMAGE' || c.kind === 'DIAGRAM') {
    if (!c.url || !isSafeUrl(c.url)) return <TileIcon kind={c.kind} label={c.kind === 'DIAGRAM' ? 'Sans aperçu' : null} />;
    return (
      <button type="button" onClick={onOpenImage} title="Cliquer pour agrandir" className="block h-full w-full cursor-zoom-in hover:opacity-90 transition-opacity">
        <img src={c.url} alt={label} className={`h-full w-full ${c.kind === 'IMAGE' ? 'object-cover' : 'object-contain bg-white p-1 dark:bg-gray-900'}`} />
      </button>
    );
  }
  if (!href) return <TileIcon kind={c.kind} />;
  if (c.kind === 'FILE' && hasFilePreview(c)) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" data-help-zone="item-contents:apercu" aria-label={`${label} — Ouvrir`}
        className="block h-full w-full hover:opacity-90 transition-opacity">
        <FilePreviewThumb content={c} size="fill" />
      </a>
    );
  }
  const ext = c.kind === 'FILE' ? fileExtension(c.name) ?? fileExtension(c.url) : null;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" aria-label={`${label} — Ouvrir`} className="block h-full w-full hover:bg-accent/50 transition-colors">
      <TileIcon kind={c.kind} label={ext} />
    </a>
  );
}

/**
 * Vignette d'un contenu (mise en forme en vignettes, décision Thomas 2026-11-11) : grande zone d'aperçu en haut, nom
 * (lien pour un fichier ou un lien) et détail dessous, actions en pied (mode Modifier). wide : mode Afficher, plus grande.
 * caption remplace le nom (champ de renommage).
 */
function ContentTile({ content: c, preview, caption, footer, wide = false }: {
  content: ItemContent; preview: React.ReactNode; caption?: React.ReactNode; footer?: React.ReactNode; wide?: boolean;
}) {
  const href = c.kind === 'FILE' || c.kind === 'LINK' ? safeHref(c.url) : undefined;
  const label = displayName(c) ?? '';
  const detail = tileDetail(c);
  return (
    <div className={`flex flex-col overflow-hidden rounded-md border bg-card ${wide ? 'w-52' : 'w-40'}`}>
      <div className={`overflow-hidden border-b bg-muted/30 ${wide ? 'h-64' : 'h-48'}`}>{preview}</div>
      <div className="min-w-0 space-y-0.5 px-2 py-1.5">
        {caption || (href
          ? <a href={href} target="_blank" rel="noopener noreferrer" title={label} className="block text-xs font-medium text-primary hover:underline line-clamp-2 break-all">{label}</a>
          : <span title={label} className="block text-xs font-medium line-clamp-2 break-all">{c.name || (c.kind === 'IMAGE' || c.kind === 'DIAGRAM' ? '' : label)}</span>)}
        {detail && <span className="block truncate text-[11px] text-muted-foreground" title={c.kind === 'LINK' ? c.url ?? '' : undefined}>{detail}</span>}
      </div>
      {footer && <div className="mt-auto flex justify-end border-t px-1 py-0.5">{footer}</div>}
    </div>
  );
}

/** Schéma draw.io : xml enregistré 2 s après la dernière retouche, aperçu PNG à « Enregistrer et fermer » */
function DiagramContent({ content, canEdit, diagram }: { content: ItemContent; canEdit: boolean; diagram?: RowProps['diagram'] }) {
  const saved = content.xml ?? '';
  const [xml, setXml] = useState(saved);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Version serveur plus récente (autre onglet, relecture) : reprise si aucune retouche n'attend d'être enregistrée
  useEffect(() => { if (!timer.current) setXml(saved); }, [saved]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const onChange = (next: string) => {
    setXml(next);
    if (!canEdit || !diagram || next === saved) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { timer.current = null; diagram.save(next).catch(() => {}); }, 2000);
  };

  return (
    <DrawioEditor
      compact
      xml={xml}
      onChange={onChange}
      editable={canEdit}
      previewUrl={content.url && isSafeUrl(content.url) ? content.url : undefined}
      onSaveAndClose={diagram ? async (savedXml, png) => {
        if (timer.current) { clearTimeout(timer.current); timer.current = null; }
        setXml(savedXml);
        await diagram.save(savedXml);
        // xml déjà écrit : un échec de l'aperçu (stockage absent en local) n'annule rien
        await diagram.preview(png).catch(() => {});
      } : undefined}
    />
  );
}

/** Mode Afficher : contenus en grandes vignettes, regroupés dans l'ordre fixe, sans action d'écriture */
export function ItemContentsRead({ contents }: { contents?: ItemContent[] }) {
  const [lightbox, setLightbox] = useState<ItemContent | null>(null);
  const groups = groupContents(contents);
  if (groups.length === 0) return null;
  return (
    <section data-devzone="item-lecture-media" className="space-y-4">
      {groups.map(([kind, list]) => (
        <div key={kind} className="space-y-2">
          {(groups.length > 1 || list.length > 1) && (
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{KIND_LABELS[kind]}</h3>
          )}
          <div className="flex flex-wrap gap-3">
            {list
              // Image sans adresse sûre : rien à montrer ; fichier ou lien sans adresse sûre : rien à ouvrir
              .filter((c) => c.kind === 'DIAGRAM' || !!safeHref(c.url))
              .map((c) => (
                <ContentTile key={c.id} content={c} wide preview={<TilePreview content={c} onOpenImage={() => setLightbox(c)} />} />
              ))}
          </div>
        </div>
      ))}
      {lightbox?.url && <Lightbox url={lightbox.url} alt={displayName(lightbox) ?? ''} onClose={() => setLightbox(null)} />}
    </section>
  );
}
