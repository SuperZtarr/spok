/* ItemReadView — mode « Afficher » de la modale item : la fiche présentée comme un document, en lecture seule.
 * Rend la même fiche que « Copier la fiche » (ItemSheet de lib/itemClipboard.ts) : ce qu'on lit est ce qu'on copie.
 * Une colonne centrée : titre, champs renseignés, tags, média en grand (image / schéma plein largeur, cliquable
 * pour le plein écran ; document = nom + Ouvrir ; lien), description, enfants (cliquables), relations, contributions.
 * Props clés :
 * - sheet : fiche construite par l'appelant (buildItemSheet, libellés de l'espace)
 * - toolbar : boutons d'action fournis par la modale (Copier la fiche, Imprimer) — affichés en haut à droite
 * - reactions : barre de réactions (lecture seule chez un visiteur) fournie par la modale
 * - onOpenChild : clic sur un enfant (navigation dans la modale)
 * - articleContent : blocs d'un article (ArticleReadBlocks) sous la description, pour le type ARTICLE
 * Règles : aucun champ modifiable ici — l'édition reste dans la fiche (ItemEditModal, sélecteur Afficher / Modifier).
 * Les textes d'aide (zones du mode Aide) sont dans components/help/item-modal.help.ts (zones read-media / read-content).
 * HTML de description et contributions : toujours nettoyé par sanitizeHtml (l'API ne filtre pas le HTML). */
import { useState, type ReactNode } from 'react';
import { ExternalLink, Paperclip } from 'lucide-react';
import type { ItemSheet } from '../lib/itemClipboard';
import { sanitizeHtml, isSafeUrl } from '../lib/sanitizeHtml';

interface ItemReadViewProps {
  sheet: ItemSheet;
  toolbar?: ReactNode;
  reactions?: ReactNode;
  onOpenChild?: (id: string) => void;
  /** Contenu d'un article (blocs), affiché sous la description — fourni par la modale pour le type ARTICLE */
  articleContent?: ReactNode;
}

const PROSE = 'prose prose-sm sm:prose-base dark:prose-invert max-w-none text-foreground';

function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border pb-1 mb-3">{children}</h2>;
}

export function ItemReadView({ sheet, toolbar, reactions, onOpenChild, articleContent }: ItemReadViewProps) {
  const [zoomed, setZoomed] = useState(false);
  // item.url n'est pas filtré par l'API : un schéma hors liste blanche (javascript:…) n'est ni affiché ni cliquable
  const media = sheet.media && isSafeUrl(sheet.media.url) ? sheet.media : null;

  return (
    <article className="max-w-3xl mx-auto w-full space-y-8 pb-8" data-tour="item-read-view">
      <header className="space-y-3">
        <div className="flex items-start gap-3">
          <h1 className="text-2xl sm:text-3xl font-bold leading-tight flex-1 min-w-0 break-words">{sheet.title}</h1>
          {toolbar && <div className="flex items-center gap-1 flex-shrink-0">{toolbar}</div>}
        </div>
        {sheet.fields.length > 0 && (
          <dl className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
            {sheet.fields.map((f) => (
              <div key={f.label} className="flex gap-1.5">
                <dt className="text-muted-foreground">{f.label}</dt>
                <dd className="font-medium">{f.value}</dd>
              </div>
            ))}
          </dl>
        )}
        {sheet.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {sheet.tags.map((t) => (
              <span key={t} className="px-2 py-0.5 rounded-full text-xs border border-border text-muted-foreground">{t}</span>
            ))}
          </div>
        )}
      </header>

      {media && (
        <section data-help-zone="item-modal:read-media">
          {media.kind === 'image' ? (
            <>
              <img
                src={media.url}
                alt={media.name}
                className="w-full max-h-[70vh] object-contain rounded-lg border border-border bg-muted cursor-zoom-in"
                onClick={() => setZoomed(true)}
              />
              {zoomed && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 cursor-zoom-out" onClick={() => setZoomed(false)}>
                  <img src={media.url} alt={media.name} className="max-w-[95vw] max-h-[95vh] object-contain" />
                </div>
              )}
            </>
          ) : (
            <a
              href={media.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3 py-2 text-sm text-primary bg-primary/5 border border-primary/20 rounded-md hover:bg-primary/10 transition-colors break-all"
            >
              {media.kind === 'file' ? <Paperclip className="w-4 h-4 flex-shrink-0" /> : <ExternalLink className="w-4 h-4 flex-shrink-0" />}
              {media.kind === 'file' ? `${media.name} — Ouvrir` : media.url}
            </a>
          )}
        </section>
      )}

      <div className="space-y-8" data-help-zone="item-modal:read-content">
        {sheet.descriptionHtml && (
          <section className={PROSE} dangerouslySetInnerHTML={{ __html: sanitizeHtml(sheet.descriptionHtml) }} />
        )}

        {articleContent}

        {sheet.children.length > 0 && (
          <section>
            <SectionTitle>Éléments enfants ({sheet.children.length})</SectionTitle>
            <ul className="space-y-1">
              {sheet.children.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onOpenChild?.(c.id)}
                    disabled={!onOpenChild}
                    className="w-full flex items-center gap-2 px-2 py-1 rounded text-left text-sm hover:bg-accent disabled:hover:bg-transparent"
                  >
                    <span className="flex-1 min-w-0 truncate">{c.title}</span>
                    {c.status && <span className="text-xs text-muted-foreground px-1.5 py-0.5 rounded bg-muted flex-shrink-0">{c.status}</span>}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {sheet.relations.length > 0 && (
          <section>
            <SectionTitle>Relations</SectionTitle>
            <ul className="space-y-1 text-sm">
              {sheet.relations.map((r, i) => (
                <li key={i}>
                  <span className="text-muted-foreground">{r.label} :</span> <span className="font-medium">{r.title}</span>
                  {r.comment && <span className="text-muted-foreground"> ({r.comment})</span>}
                </li>
              ))}
            </ul>
          </section>
        )}

        {reactions}

        {sheet.contributions.length > 0 && (
          <section>
            <SectionTitle>Contributions ({sheet.contributions.length})</SectionTitle>
            <div className="space-y-4">
              {sheet.contributions.map((c, i) => (
                <div key={i} className="border-l-2 border-primary/40 pl-3">
                  <div className="text-xs text-muted-foreground mb-1">
                    <span className="font-semibold text-foreground">{c.author}</span> — {c.date}
                  </div>
                  <div className="prose prose-sm dark:prose-invert max-w-none text-foreground" dangerouslySetInnerHTML={{ __html: sanitizeHtml(c.contentHtml) }} />
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </article>
  );
}
