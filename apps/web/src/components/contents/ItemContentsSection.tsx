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
 * schéma modifiable : DrawioEditor compact (clic = draw.io plein écran). Détail sous le nom (tileDetail) : poids d'un
 * fichier ou d'une image envoyée (2026-11-15), site d'un lien.
 * Props clés : spaceId, itemId (absent = élément pas encore enregistré), contents (item.contents, détail complet avec
 * xml), canEdit, onTitleHint (titre suggéré par le premier fichier ou lien, appliqué par la fiche si le titre est vide).
 * Règles : zone masquée sur un Article (décidé par l'appelant) ; adresses toujours passées par safeHref / isSafeUrl
 * (règle user-html-sanitized) ; écritures via hooks/useItemContents seulement. Aide : components/help/item-contents.help.ts
 * (zones data-help-zone item-contents:*, rappels pageHint('item-contents', …)). Règle de gestion : item-contents-zone.
 * Données sécurisées (2026-11-20) : dernière section (ITEM_CONTENT_SECTIONS), entrée « Donnée sécurisée » du menu
 * « + Ajouter » ; rendues par ItemSecretsSection (table et routes à part, jamais dans item.contents).
 * Coordonnées (Téléphone, E-mail, Adresse — 2026-11-25) : lignes compactes (ContactRow) dans les deux modes, saisie
 * ContactForm ; libellés et icônes du registre (@spok/shared, constants/itemContentIcons.ts).
 * Aperçu des liens (2026-11-25) : image du site (previewUrl, rangée par l'API) en haut de la vignette d'un lien ; bouton
 * « Actualiser l'aperçu » (↻) au pied ; fiche relue 6 s après l'ajout d'un lien (aperçu cherché en tâche de fond).
 * « Déplacer vers… » (2026-11-21) : bouton → au pied de chaque vignette, MoveToItemDialog (choix de l'élément cible).
 */
import { useEffect, useRef, useState } from 'react';
import { Plus, Trash2, MoveRight, RefreshCw, ChevronLeft, ChevronRight, Pencil, ExternalLink, Check, X } from 'lucide-react';
import { fileExtension, hostOf } from '../../lib/itemFace';
import { ITEM_CONTENT_KINDS, ITEM_CONTENT_KIND_DEFS, CONTACT_CONTENT_KINDS, CONTACT_VALUE_MAX, PHONE_PATTERN, contactHref, sortItemContents, type ItemContent, type ItemContentKind, type ItemContentSection, type ContactContentKind } from '@spok/shared';
import { ITEM_CONTENT_ICONS } from '../../constants/itemContentIcons';
import { useItemContents } from '../../hooks/useItemContents';
import { useItemSecretList } from '../../hooks/useItemSecrets';
import { ItemSecretsSection } from './ItemSecretsSection';
import { MoveToItemDialog } from './MoveToItemDialog';
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

// Libellés : registre @spok/shared (ITEM_CONTENT_KIND_DEFS, 2026-11-25) + section des données sécurisées
export const KIND_LABELS = Object.fromEntries([
  ...ITEM_CONTENT_KIND_DEFS.map((d) => [d.id, d.label]), ['SECRET', 'Données sécurisées'],
]) as Record<ItemContentSection, string>;
const ADD_LABELS = Object.fromEntries([
  ...ITEM_CONTENT_KIND_DEFS.map((d) => [d.id, d.singular]), ['SECRET', 'Donnée sécurisée'],
]) as Record<ItemContentSection, string>;
/** Ordre du menu « + Ajouter » (décision Thomas) — l'affichage, lui, suit ITEM_CONTENT_SECTIONS */
const ADD_ORDER: ItemContentSection[] = ['FILE', 'IMAGE', 'LINK', 'PHONE', 'EMAIL', 'ADDRESS', 'DIAGRAM', 'SECRET'];
const KIND_ICONS = ITEM_CONTENT_ICONS;
const isContact = (k: string): k is ContactContentKind => (CONTACT_CONTENT_KINDS as readonly string[]).includes(k);

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

const displayName = (c: ItemContent) => c.name?.trim() || (c.kind === 'LINK' ? c.url : null) || c.value || KIND_LABELS[c.kind];

/** Image en plein écran (clic pour fermer) — aussi utilisée par les blocs d'article (ArticleBlock) */
export function Lightbox({ url, alt, onClose }: { url: string; alt: string; onClose: () => void }) {
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
  const { data: secrets = [] } = useItemSecretList(spaceId, itemId);
  const [menuOpen, setMenuOpen] = useState(false);
  const [adding, setAdding] = useState<ItemContentSection | null>(null);
  const [toRemove, setToRemove] = useState<ItemContent | null>(null);
  const [toMove, setToMove] = useState<ItemContent | null>(null);
  const [lightbox, setLightbox] = useState<ItemContent | null>(null);
  const groups = groupContents(contents);
  const writable = canEdit && !!itemId;
  const error = [api.add, api.upload, api.update, api.remove, api.reorder].find((m) => m.isError)?.error as Error | undefined;

  // Changement d'élément dans la même fiche : formulaires d'ajout refermés
  useEffect(() => { setAdding(null); setMenuOpen(false); setToRemove(null); }, [itemId]);

  const choose = (kind: ItemContentSection) => {
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

  if (!canEdit && groups.length === 0 && secrets.length === 0) return null;

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
      {writable && groups.length === 0 && secrets.length === 0 && !adding && <FieldHelp page="item-contents" field="empty" />}

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

      {adding && isContact(adding) && (
        <ContactForm kind={adding} pending={api.add.isPending} onCancel={() => setAdding(null)}
          onSubmit={(value, name) => api.add.mutate({ kind: adding, value, name: name || null }, { onSuccess: () => setAdding(null) })} />
      )}

      {error && <p className="text-sm text-destructive">{error.message || 'Opération impossible sur ce contenu'}</p>}

      <div className="space-y-3" data-help-zone="item-contents:contenus">
        {groups.map(([kind, list]) => (
          <section key={kind} className="space-y-1.5" aria-label={KIND_LABELS[kind]}>
            <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{KIND_LABELS[kind]}</h4>
            {isContact(kind) ? (
              <ul className="space-y-1">
                {list.map((c) => (
                  <ContactRow key={c.id} content={c} actions={writable ? (
                    <span className="flex items-center gap-0.5">
                      <HelpHint text={pageHint('item-contents', 'moveTo')}>
                        <button type="button" className="p-1 rounded hover:bg-accent text-muted-foreground" onClick={() => setToMove(c)} aria-label="Déplacer vers un autre élément"><MoveRight className="w-3.5 h-3.5" /></button>
                      </HelpHint>
                      <HelpHint text={pageHint('item-contents', 'removeHint')}>
                        <button type="button" className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive" onClick={() => setToRemove(c)} aria-label="Retirer"><Trash2 className="w-3.5 h-3.5" /></button>
                      </HelpHint>
                    </span>
                  ) : null} />
                ))}
              </ul>
            ) : (
            <div className="flex flex-wrap gap-2">
              {list.map((c, i) => (
                <ContentRow key={c.id} content={c} canEdit={writable}
                  first={i === 0} last={i === list.length - 1}
                  onUp={() => move(list, i, -1)} onDown={() => move(list, i, 1)}
                  onRemove={() => setToRemove(c)} onMoveTo={() => setToMove(c)} onOpenImage={() => setLightbox(c)}
                  onRefreshPreview={() => api.refreshPreview.mutate(c.id)}
                  refreshing={api.refreshPreview.isPending && api.refreshPreview.variables === c.id}
                  onRename={(name) => api.update.mutate({ id: c.id, name: name || null })}
                  diagram={kind === 'DIAGRAM' ? {
                    save: (xml) => api.update.mutateAsync({ id: c.id, xml }),
                    preview: (png) => api.upload.mutateAsync({ kind: 'image', file: png, previewOf: c.id }),
                  } : undefined} />
              ))}
            </div>
            )}
          </section>
        ))}
        {/* Dernière section (ITEM_CONTENT_SECTIONS) : données sécurisées, table et routes à part */}
        <ItemSecretsSection spaceId={spaceId} itemId={itemId} canAdd={writable} title={KIND_LABELS.SECRET}
          adding={adding === 'SECRET'} onAddingDone={() => setAdding(null)} />
      </div>

      {lightbox?.url && isSafeUrl(lightbox.url) && <Lightbox url={lightbox.url} alt={displayName(lightbox) ?? ''} onClose={() => setLightbox(null)} />}
      {toMove && itemId && (
        <MoveToItemDialog isOpen onClose={() => setToMove(null)} spaceId={spaceId} itemId={itemId}
          what={displayName(toMove) ?? KIND_LABELS[toMove.kind]}
          onMove={(hit) => api.move.mutateAsync({ id: toMove.id, target: hit })} />
      )}
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

/** Coordonnée (2026-11-25) : ligne compacte — icône, libellé, valeur cliquable (tel:, mailto:, carte) */
function ContactRow({ content: c, actions }: { content: ItemContent; actions?: React.ReactNode }) {
  const Icon = KIND_ICONS[c.kind];
  const href = contactHref(c.kind, c.value);
  return (
    <li className="flex items-start gap-2 text-sm">
      <Icon className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" aria-hidden />
      {c.name && <span className="text-muted-foreground">{c.name} :</span>}
      <span className="whitespace-pre-line">
        {href ? <a href={href} target={c.kind === 'ADDRESS' ? '_blank' : undefined} rel="noopener noreferrer" className="text-primary hover:underline">{c.value}</a> : c.value}
      </span>
      {c.kind === 'ADDRESS' && href && <span className="text-xs text-muted-foreground">(carte)</span>}
      {actions && <span className="ml-auto">{actions}</span>}
    </li>
  );
}

/** Saisie d'une coordonnée : valeur (adresse sur plusieurs lignes) et libellé facultatif — l'API vérifie le format */
function ContactForm({ kind, onSubmit, onCancel, pending }: { kind: ContactContentKind; onSubmit: (value: string, name: string) => void; onCancel: () => void; pending: boolean }) {
  const [value, setValue] = useState('');
  const [name, setName] = useState('');
  const v = value.trim();
  const valid = kind === 'PHONE' ? PHONE_PATTERN.test(v) : kind === 'EMAIL' ? /^\S+@\S+\.\S+$/.test(v) : v.length > 0;
  const submit = () => { if (valid) onSubmit(v, name.trim()); };
  const label = ADD_LABELS[kind];
  return (
    <div className="rounded-md border border-dashed p-2 space-y-2">
      {kind === 'ADDRESS'
        ? <textarea className="w-full rounded-md border bg-background p-2 text-sm" rows={3} value={value} autoFocus maxLength={CONTACT_VALUE_MAX[kind]}
            onChange={(e) => setValue(e.target.value)} aria-label={label} placeholder="N°, rue, code postal, ville" />
        : <Input type={kind === 'EMAIL' ? 'email' : 'tel'} value={value} autoFocus maxLength={CONTACT_VALUE_MAX[kind]} placeholder={label}
            onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }} aria-label={label} />}
      <Input value={name} placeholder="Libellé (facultatif, ex. Standard)" onChange={(e) => setName(e.target.value)} aria-label="Libellé" />
      <FieldHelp page="item-contents" field="contact" />
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="bordered" size="sm" onClick={onCancel}>Annuler</Button>
        <HelpHint text={pageHint('item-contents', 'addContactConfirm')}>
          <Button type="button" size="sm" disabled={!valid || pending} onClick={submit}>Ajouter</Button>
        </HelpHint>
      </div>
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
  /** « Déplacer vers… » : ouvre le choix de l'élément cible */
  onMoveTo: () => void;
  /** Lien : relancer la récupération de l'image du site (2026-11-25) */
  onRefreshPreview?: () => void;
  refreshing?: boolean;
  onRename: (name: string) => void;
  onOpenImage: () => void;
  diagram?: { save: (xml: string) => Promise<unknown>; preview: (png: Blob) => Promise<unknown> };
}

/** Un contenu : aperçu selon sa sorte + actions (renommer, monter, descendre, retirer) */
function ContentRow({ content: c, canEdit, first, last, onUp, onDown, onRemove, onMoveTo, onRefreshPreview, refreshing, onRename, onOpenImage, diagram }: RowProps) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(c.name ?? '');
  useEffect(() => { if (!renaming) setName(c.name ?? ''); }, [c.name, renaming]);

  const actions = canEdit && (
    <div className="flex items-center gap-0.5 shrink-0">
      {c.kind === 'LINK' && onRefreshPreview && (
        <HelpHint text={pageHint('item-contents', 'refreshPreview')}>
          <button type="button" className="p-1 rounded hover:bg-accent text-muted-foreground disabled:opacity-40" disabled={refreshing}
            onClick={onRefreshPreview} aria-label="Actualiser l'aperçu">
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </HelpHint>
      )}
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
      <HelpHint text={pageHint('item-contents', 'moveTo')}>
        <button type="button" className="p-1 rounded hover:bg-accent text-muted-foreground" onClick={onMoveTo} aria-label="Déplacer vers un autre élément">
          <MoveRight className="w-3.5 h-3.5" />
        </button>
      </HelpHint>
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

/** Détail sous le nom : poids d'un fichier ou d'une image envoyée (absent pour une image par adresse), site d'un lien */
function tileDetail(c: ItemContent): string | null {
  if (c.kind === 'FILE' || c.kind === 'IMAGE') return formatSize(c.size);
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
  // Lien avec l'image d'aperçu du site, rangée chez nous (2026-11-25) : jamais d'appel au site à l'affichage
  if (c.kind === 'LINK' && c.previewUrl && isSafeUrl(c.previewUrl)) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" aria-label={`${label} — Ouvrir`} className="block h-full w-full hover:opacity-90 transition-opacity">
        <img src={c.previewUrl} alt="" className="h-full w-full object-cover" />
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
          {isContact(kind) ? <ul className="space-y-1">{list.map((c) => <ContactRow key={c.id} content={c} />)}</ul> : (
          <div className="flex flex-wrap gap-3">
            {list
              // Image sans adresse sûre : rien à montrer ; fichier ou lien sans adresse sûre : rien à ouvrir
              .filter((c) => c.kind === 'DIAGRAM' || !!safeHref(c.url))
              .map((c) => (
                <ContentTile key={c.id} content={c} wide preview={<TilePreview content={c} onOpenImage={() => setLightbox(c)} />} />
              ))}
          </div>
          )}
        </div>
      ))}
      {lightbox?.url && <Lightbox url={lightbox.url} alt={displayName(lightbox) ?? ''} onClose={() => setLightbox(null)} />}
    </section>
  );
}
