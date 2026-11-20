/*
 * Section « Données sécurisées » de la zone Contenus (décision Thomas 2026-11-20) : mots de passe, codes, clés rangés
 * sur un élément, dernière section de la zone (ITEM_CONTENT_SECTIONS de @spok/shared).
 * Une ligne par donnée : libellé, identifiant et valeur masqués, « Afficher » (valeur visible 30 s puis re-masquée),
 * « Copier » (presse-papiers vidé au bout de 30 s), visibilité (« Moi seul » / « Membres de l'espace »), nombre de
 * consultations pour l'auteur, modifier (auteur) et retirer (auteur ou mode admin, confirmation).
 * Props : spaceId, itemId (absent = élément non enregistré : rien), canAdd (droit d'écrire sur l'élément), adding /
 * onAddingDone (formulaire d'ajout ouvert par « + Ajouter » de ItemContentsSection), readOnly (mode Afficher : pas de
 * formulaire ni de modification, Afficher / Copier gardés).
 * Règles : la valeur révélée ne vit que dans l'état local de la ligne (jamais dans le cache React Query — appel direct
 * à itemSecretsApi.reveal), effacée au masquage et au démontage ; jamais écrite dans la console ni un journal.
 * Droits décidés par l'API (canReveal / canEdit / canDelete). Aide : components/help/item-contents.help.ts (élément
 * secrets, rappels secretReveal / secretCopy / secretEdit / secretRemove, champs secretValue / secretVisibility).
 * Règle de gestion : item-secrets.
 */
import { useEffect, useRef, useState } from 'react';
import { Lock, Eye, EyeOff, Copy, Pencil, Trash2, X } from 'lucide-react';
import { ITEM_SECRET_LIMITS, ITEM_SECRET_VISIBILITIES, type ItemSecretSummary, type ItemSecretVisibility } from '@spok/shared';
import { itemSecretsApi, type ItemSecretInput } from '../../lib/api';
import { useItemSecretList, useItemSecrets } from '../../hooks/useItemSecrets';
import { HelpHint } from '../../help/HelpHint';
import { FieldHelp } from '../../help/FieldHelp';
import { pageHint } from '../../help/pageHint';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { ConfirmModal } from '../ConfirmModal';

/** Durée d'affichage d'une valeur révélée et de sa présence dans le presse-papiers */
export const SECRET_EXPOSURE_MS = 30_000;

const MASK = '••••••••';
const visibilityLabel = (v: ItemSecretVisibility) => ITEM_SECRET_VISIBILITIES.find((x) => x.id === v)?.label ?? v;

interface Props {
  spaceId: string;
  itemId?: string;
  canAdd: boolean;
  adding?: boolean;
  onAddingDone?: () => void;
  readOnly?: boolean;
  /** Titre de section (libellé de la sorte, fourni par la zone) */
  title: string;
}

export function ItemSecretsSection({ spaceId, itemId, canAdd, adding = false, onAddingDone, readOnly = false, title }: Props) {
  const { data: secrets = [] } = useItemSecretList(spaceId, itemId);
  const api = useItemSecrets(spaceId, itemId);
  const [toRemove, setToRemove] = useState<ItemSecretSummary | null>(null);
  const error = [api.add, api.update, api.remove].find((m) => m.isError)?.error as Error | undefined;

  if (!itemId || (secrets.length === 0 && !adding)) return null;

  return (
    <section className="space-y-1.5" aria-label={title} data-help-zone="item-contents:secrets">
      <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</h4>
      {adding && canAdd && !readOnly && (
        <SecretForm pending={api.add.isPending} onCancel={() => onAddingDone?.()}
          onSubmit={(body) => api.add.mutate(body as ItemSecretInput, { onSuccess: () => onAddingDone?.() })} />
      )}
      {error && <p className="text-sm text-destructive">{error.message || 'Opération impossible sur cette donnée'}</p>}
      <ul className="space-y-1.5">
        {secrets.map((s) => (
          <SecretRow key={s.id} spaceId={spaceId} itemId={itemId} secret={s} readOnly={readOnly}
            onUpdate={(body, done) => api.update.mutate({ id: s.id, ...body }, { onSuccess: done })}
            updating={api.update.isPending}
            onRemove={() => setToRemove(s)} />
        ))}
      </ul>
      <ConfirmModal
        isOpen={!!toRemove}
        onClose={() => setToRemove(null)}
        onConfirm={() => { if (toRemove) api.remove.mutate(toRemove.id, { onSettled: () => setToRemove(null) }); }}
        title="Retirer cette donnée sécurisée ?"
        message={pageHint('item-contents', 'secretRemove') ?? ''}
        confirmLabel="Retirer"
        confirmVariant="destructive"
        isPending={api.remove.isPending}
      />
    </section>
  );
}

interface RowProps {
  spaceId: string;
  itemId: string;
  secret: ItemSecretSummary;
  readOnly: boolean;
  updating: boolean;
  onUpdate: (body: Partial<ItemSecretInput>, done: () => void) => void;
  onRemove: () => void;
}

function SecretRow({ spaceId, itemId, secret: s, readOnly, updating, onUpdate, onRemove }: RowProps) {
  const [revealed, setRevealed] = useState<{ login: string | null; value: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();
  const clipTimer = useRef<ReturnType<typeof setTimeout>>();

  // Démontage (fiche fermée, autre élément) : valeur effacée, minuteurs arrêtés
  useEffect(() => () => { clearTimeout(hideTimer.current); clearTimeout(clipTimer.current); }, []);

  const fetchValue = async () => {
    setFailure(null);
    try {
      return await itemSecretsApi.reveal(spaceId, itemId, s.id);
    } catch (e) {
      setFailure((e as Error)?.message || 'Lecture impossible');
      return null;
    }
  };

  const show = async () => {
    if (revealed) { clearTimeout(hideTimer.current); setRevealed(null); return; }
    const data = await fetchValue();
    if (!data) return;
    setRevealed(data);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setRevealed(null), SECRET_EXPOSURE_MS);
  };

  const copy = async () => {
    const data = revealed ?? await fetchValue();
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.value);
    } catch {
      setFailure('Copie refusée par le navigateur'); return;
    }
    setCopied(true);
    clearTimeout(clipTimer.current);
    clipTimer.current = setTimeout(() => {
      setCopied(false);
      navigator.clipboard.writeText('').catch(() => {});
    }, SECRET_EXPOSURE_MS);
  };

  if (editing) {
    return (
      <li>
        <SecretForm initial={s} pending={updating} onCancel={() => setEditing(false)}
          onSubmit={(body) => onUpdate(body, () => setEditing(false))} />
      </li>
    );
  }

  return (
    <li className="rounded-md border bg-card px-3 py-2 text-sm flex flex-wrap items-center gap-x-3 gap-y-1">
      <Lock className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden />
      <span className="font-medium">{s.label}</span>
      {s.hasLogin && <span className="text-muted-foreground">{revealed?.login ?? 'identifiant ' + MASK}</span>}
      <span className="font-mono" data-testid="secret-value">{revealed ? revealed.value : MASK}</span>
      <span className="ml-auto flex items-center gap-1">
        {s.canReveal && (
          <>
            <HelpHint text={pageHint('item-contents', 'secretReveal')}>
              <Button type="button" variant="ghost" size="sm" onClick={show} aria-label={revealed ? 'Masquer' : 'Afficher'}>
                {revealed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </HelpHint>
            <HelpHint text={pageHint('item-contents', 'secretCopy')}>
              <Button type="button" variant="ghost" size="sm" onClick={copy} aria-label="Copier">
                <Copy className="w-4 h-4" />
              </Button>
            </HelpHint>
          </>
        )}
        {s.canEdit && !readOnly && (
          <HelpHint text={pageHint('item-contents', 'secretEdit')}>
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(true)} aria-label="Modifier">
              <Pencil className="w-4 h-4" />
            </Button>
          </HelpHint>
        )}
        {s.canDelete && !readOnly && (
          <HelpHint text={pageHint('item-contents', 'secretRemoveHint')}>
            <Button type="button" variant="ghost" size="sm" onClick={onRemove} aria-label="Retirer">
              <Trash2 className="w-4 h-4" />
            </Button>
          </HelpHint>
        )}
      </span>
      <span className="w-full text-xs text-muted-foreground">
        <HelpHint text={pageHint('item-contents', 'secretVisibility')}><span>{visibilityLabel(s.visibility)}</span></HelpHint>
        {s.canEdit && ` · consultée ${s.revealCount} fois`}
        {!s.canEdit && s.createdByName && ` · ajoutée par ${s.createdByName}`}
        {copied && ' · copiée, effacée du presse-papiers dans 30 s'}
      </span>
      {failure && <span className="w-full text-xs text-destructive">{failure}</span>}
    </li>
  );
}

interface FormProps {
  initial?: ItemSecretSummary;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (body: Partial<ItemSecretInput>) => void;
}

/** Ajout (initial absent) ou modification : en modification, valeur et identifiant vides = inchangés */
function SecretForm({ initial, pending, onCancel, onSubmit }: FormProps) {
  const [label, setLabel] = useState(initial?.label ?? '');
  const [login, setLogin] = useState('');
  const [value, setValue] = useState('');
  const [visibility, setVisibility] = useState<ItemSecretVisibility>(initial?.visibility ?? 'PRIVATE');
  const editing = !!initial;
  const valid = label.trim().length > 0 && (editing || value.length > 0);

  const submit = () => {
    if (!valid) return;
    const body: Partial<ItemSecretInput> = { label: label.trim(), visibility };
    if (value) body.value = value;
    if (login) body.login = login;
    else if (!editing) body.login = null;
    onSubmit(body);
  };

  return (
    <div className="rounded-md border p-3 space-y-2 relative">
      <button type="button" onClick={onCancel} aria-label="Annuler" className="absolute top-2 right-2 text-muted-foreground hover:text-foreground">
        <X className="w-4 h-4" />
      </button>
      <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Libellé (ex. Accès admin)"
        maxLength={ITEM_SECRET_LIMITS.label} aria-label="Libellé" autoFocus />
      <Input value={login} onChange={(e) => setLogin(e.target.value)} maxLength={ITEM_SECRET_LIMITS.login}
        placeholder={editing && initial?.hasLogin ? 'Identifiant (vide = inchangé)' : 'Identifiant (facultatif)'}
        aria-label="Identifiant" autoComplete="off" />
      <Input type="password" value={value} onChange={(e) => setValue(e.target.value)} maxLength={ITEM_SECRET_LIMITS.value}
        placeholder={editing ? 'Mot de passe ou code (vide = inchangé)' : 'Mot de passe ou code'}
        aria-label="Valeur" autoComplete="new-password" />
      <FieldHelp page="item-contents" field="secretValue" />
      <div className="flex flex-wrap items-center gap-3 text-sm" role="radiogroup" aria-label="Visibilité">
        {ITEM_SECRET_VISIBILITIES.map((v) => (
          <label key={v.id} className="flex items-center gap-1.5">
            <input type="radio" name="secret-visibility" checked={visibility === v.id} onChange={() => setVisibility(v.id)} />
            {v.label}
          </label>
        ))}
      </div>
      <FieldHelp page="item-contents" field="secretVisibility" />
      <div className="flex justify-end">
        <HelpHint text={pageHint('item-contents', 'secretSave')}>
          <Button type="button" size="sm" onClick={submit} disabled={!valid || pending}>Enregistrer</Button>
        </HelpHint>
      </div>
    </div>
  );
}
