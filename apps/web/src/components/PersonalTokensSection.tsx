/*
 * Section « Accès Claude (MCP) » de la modale profil (dans l'onglet Compte depuis 2026-11-18, sans séparateur propre) : création, liste et révocation des jetons personnels
 * permettant à un Claude externe d'accéder à SPOK via le serveur MCP distant (getMcpServerUrl). Le jeton en
 * clair n'est affiché qu'une fois, juste après création, avec la commande de connexion prête à copier.
 * Accès accordé par un admin : sans accord, la section propose « Demander l'accès » (puis « demande en attente »)
 * au lieu de la création de jetons. Les jetons déjà créés restent listés (révocables) même si l'accès est retiré.
 * Aucune prop : agit sur l'utilisateur connecté. Ne jamais stocker le jeton en clair (ni store, ni localStorage).
 * Aide : textes dans la fiche « profile » (components/help/profile.help.ts) — usage et options en ligne (FieldHelp
 * claudeIntro / claudeSteps / tokenOptions), rappels des actions (pageHint tokenRequest / tokenCreate / tokenCopy /
 * tokenRevoke). Ne pas écrire ces textes ici.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Copy, Check, Trash2, Clock } from 'lucide-react';
import { personalTokensApi, getMcpServerUrl, type PersonalToken } from '../lib/api';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { HelpHint } from '../help/HelpHint';
import { FieldHelp } from '../help/FieldHelp';
import { pageHint } from '../help/pageHint';

type Expiry = '30' | '90' | '365' | 'never';

const SCOPE_OPTIONS = [
  { value: 'write', label: 'Lecture et écriture' },
  { value: 'read', label: 'Lecture seule' },
];

const EXPIRY_OPTIONS = [
  { value: '30', label: '30 jours' },
  { value: '90', label: '90 jours' },
  { value: '365', label: '1 an' },
  { value: 'never', label: 'Sans expiration' },
];

function formatDate(d: string | null) {
  return d ? new Date(d).toLocaleDateString('fr-FR') : '—';
}

export function PersonalTokensSection() {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [scope, setScope] = useState<'read' | 'write'>('write');
  const [expires, setExpires] = useState<Expiry>('90');
  const [created, setCreated] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: tokens = [] } = useQuery({ queryKey: ['personal-tokens'], queryFn: personalTokensApi.list });
  const { data: access } = useQuery({ queryKey: ['mcp-access'], queryFn: personalTokensApi.mcpAccess });

  const requestMut = useMutation({
    mutationFn: personalTokensApi.requestMcpAccess,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mcp-access'] }),
  });

  const createMut = useMutation({
    mutationFn: () => personalTokensApi.create({
      name: name.trim(),
      scope,
      expiresInDays: expires === 'never' ? null : (Number(expires) as 30 | 90 | 365),
    }),
    onSuccess: (res) => {
      setCreated(res.token);
      setName('');
      qc.invalidateQueries({ queryKey: ['personal-tokens'] });
    },
  });

  const revokeMut = useMutation({
    mutationFn: (id: string) => personalTokensApi.revoke(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['personal-tokens'] }),
  });

  const command = created
    ? `claude mcp add --transport http spok ${getMcpServerUrl()} --header "Authorization: Bearer ${created}"`
    : '';

  async function copy() {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const active = tokens.filter((t: PersonalToken) => !t.revokedAt);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <KeyRound className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium">Accès Claude (MCP)</span>
      </div>
      <FieldHelp page="profile" field="claudeIntro" className="text-xs text-muted-foreground" />
      <FieldHelp page="profile" field="claudeSteps" className="text-xs text-muted-foreground" />

      {created && (
        <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-2">
          <p className="text-xs font-medium">Copiez cette commande maintenant : le jeton ne sera plus affiché.</p>
          <code className="block text-xs break-all">{command}</code>
          <div className="flex gap-2">
            <HelpHint text={pageHint('profile', 'tokenCopy')} className="inline-flex">
              <Button size="sm" variant="outline" onClick={copy}>
                {copied ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}Copier
              </Button>
            </HelpHint>
            <Button size="sm" variant="ghost" onClick={() => setCreated(null)}>J'ai copié</Button>
          </div>
        </div>
      )}

      {access && !access.granted && (
        access.requestedAt ? (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="w-3.5 h-3.5" />
            Demande envoyée le {formatDate(access.requestedAt)}, en attente de l'administrateur.
          </p>
        ) : (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">L'accès Claude doit être accordé par l'administrateur.</p>
            <HelpHint text={pageHint('profile', 'tokenRequest')} className="inline-flex">
              <Button size="sm" variant="outline" disabled={requestMut.isPending} onClick={() => requestMut.mutate()}>
                Demander l'accès
              </Button>
            </HelpHint>
            {requestMut.isError && <p className="text-xs text-destructive">{(requestMut.error as Error).message}</p>}
          </div>
        )
      )}

      {access?.granted && (
      <div>
      <div className="flex flex-wrap gap-2 items-center">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nom (ex. Claude portable)"
          maxLength={60}
          className="flex-1 min-w-[10rem]"
        />
        <Select className="w-auto" options={SCOPE_OPTIONS} value={scope} onChange={(e) => setScope(e.target.value as 'read' | 'write')} />
        <Select className="w-auto" options={EXPIRY_OPTIONS} value={expires} onChange={(e) => setExpires(e.target.value as Expiry)} />
        <HelpHint text={pageHint('profile', 'tokenCreate')} className="inline-flex">
          <Button size="sm" disabled={!name.trim() || createMut.isPending} onClick={() => createMut.mutate()}>
            Créer un jeton
          </Button>
        </HelpHint>
      </div>
      <FieldHelp page="profile" field="tokenOptions" />
      </div>
      )}
      {createMut.isError && <p className="text-xs text-destructive">{(createMut.error as Error).message}</p>}

      {active.length > 0 && (
        <ul className="divide-y divide-border text-sm">
          {active.map((t: PersonalToken) => (
            <li key={t.id} className="flex items-center justify-between py-2 gap-2">
              <div className="min-w-0">
                <div className="truncate">
                  {t.name}{' '}
                  <span className="text-xs text-muted-foreground">({t.scope === 'read' ? 'lecture' : 'lecture/écriture'})</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {t.tokenPrefix}… · utilisé le {formatDate(t.lastUsedAt)} · expire {t.expiresAt ? `le ${formatDate(t.expiresAt)}` : 'jamais'}
                </div>
              </div>
              <HelpHint text={pageHint('profile', 'tokenRevoke')} className="inline-flex">
                <Button size="icon" variant="ghost" onClick={() => revokeMut.mutate(t.id)} aria-label={`Révoquer ${t.name}`}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </HelpHint>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
