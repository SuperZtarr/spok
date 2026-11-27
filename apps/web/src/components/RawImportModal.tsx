/*
 * Fenêtre « Importer des données » (décision Thomas 2026-11-27) : recrée dans une communauté un espace exporté en
 * « Données brutes » (JSON ou XML, menu Exporter d'un espace), avec ses sous-espaces. Ouverte depuis l'onglet Espaces
 * des paramètres de la communauté (CommunitySettingsPage).
 * Props : isOpen, onClose, communityId (communauté de destination).
 * Déroulé : fichier choisi → lu dans le navigateur (≤ RAW_EXPORT_MAX_BYTES, format par l'extension, sinon par le premier
 * caractère) → aperçu demandé à l'API (dryRun, rien n'est écrit) ; changer la destination relance l'aperçu (tags
 * rapprochés selon l'endroit) → Importer (copie, tout ou rien, POST /spaces/raw-import) → compte rendu et lien vers
 * l'espace créé. Droits contrôlés par l'API ; l'erreur renvoyée est affichée telle quelle.
 * Libellés des comptes : registre shared (RAW_IMPORT_*_LABELS) ; textes d'aide : components/help/raw-import.help.ts.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FileUp, Loader2 } from 'lucide-react';
import {
  RAW_EXPORT_FILE_FORMATS, RAW_EXPORT_MAX_BYTES, RAW_IMPORT_CREATED_LABELS, RAW_IMPORT_DROPPED_LABELS, rawExportFormatOfFilename,
  type RawExportFileFormat, type RawImportReport,
} from '@spok/shared';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Select } from './ui/Select';
import { PageHelpButton } from '../help/PageHelpButton';
import { HelpHint } from '../help/HelpHint';
import { pageHint } from '../help/pageHint';
import { spacesApi } from '../lib/api';
import { rawImport } from '../lib/rawExportApi';
import { buildParentOptions, ROOT_OPTION_LABEL } from '../lib/spaceParentOptions';

interface RawImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  communityId: string;
}

const ACCEPT = RAW_EXPORT_FILE_FORMATS.map((f) => `.${f.extension}`).join(',');

function ReportCounts({ report }: { report: RawImportReport }) {
  const created = (Object.keys(RAW_IMPORT_CREATED_LABELS) as (keyof typeof RAW_IMPORT_CREATED_LABELS)[]).filter((k) => report.created[k] > 0);
  const dropped = (Object.keys(RAW_IMPORT_DROPPED_LABELS) as (keyof typeof RAW_IMPORT_DROPPED_LABELS)[]).filter((k) => report.dropped[k] > 0);
  return (
    <div className="space-y-2 text-sm">
      <ul className="grid grid-cols-2 gap-x-4 gap-y-0.5">
        {created.map((k) => (
          <li key={k} className="flex justify-between"><span className="text-muted-foreground">{RAW_IMPORT_CREATED_LABELS[k]}</span><span className="tabular-nums">{report.created[k]}</span></li>
        ))}
        {report.copiedFiles > 0 && (
          <li className="flex justify-between"><span className="text-muted-foreground">Fichiers recopiés</span><span className="tabular-nums">{report.copiedFiles}</span></li>
        )}
      </ul>
      {dropped.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground">Laissé de côté</p>
          <ul className="text-xs">
            {dropped.map((k) => <li key={k}>{RAW_IMPORT_DROPPED_LABELS[k]} : {report.dropped[k]}</li>)}
          </ul>
        </div>
      )}
      {report.unmatchedUsers.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground">Personnes sans compte ici (remplacées par vous)</p>
          <p className="text-xs">{report.unmatchedUsers.join(', ')}</p>
        </div>
      )}
    </div>
  );
}

export function RawImportModal({ isOpen, onClose, communityId }: RawImportModalProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; content: string; format: RawExportFileFormat } | null>(null);
  const [parentId, setParentId] = useState('');
  const [preview, setPreview] = useState<RawImportReport | null>(null);
  const [result, setResult] = useState<RawImportReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isOpen) { setFile(null); setParentId(''); setPreview(null); setResult(null); setError(null); setBusy(false); }
  }, [isOpen]);

  const { data: allSpaces } = useQuery({ queryKey: ['spaces', 'all'], queryFn: () => spacesApi.list(), enabled: isOpen });
  const parentOptions = useMemo(() => buildParentOptions(allSpaces ?? [], communityId), [allSpaces, communityId]);

  const target = parentId ? { parentSpaceId: parentId } : { communityId };

  // Aperçu : à chaque fichier ou destination
  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    setBusy(true); setError(null); setPreview(null);
    rawImport({ format: file.format, content: file.content, ...target, dryRun: true })
      .then((r) => { if (!cancelled) setPreview(r); })
      .catch((e: Error) => { if (!cancelled) setError(e.message || 'Fichier refusé'); })
      .finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [file, parentId]); // eslint-disable-line react-hooks/exhaustive-deps

  const pickFile = async (f: File | undefined) => {
    setResult(null); setPreview(null); setError(null);
    if (!f) return;
    if (f.size > RAW_EXPORT_MAX_BYTES) {
      setError(`Fichier trop gros (${Math.round(f.size / 1024 / 1024)} Mo, maximum ${RAW_EXPORT_MAX_BYTES / 1024 / 1024} Mo)`);
      return;
    }
    const content = await f.text();
    const format = rawExportFormatOfFilename(f.name) ?? (content.trimStart().startsWith('<') ? 'xml' : 'json');
    setFile({ name: f.name, content, format });
  };

  const doImport = async () => {
    if (!file || !preview) return;
    setBusy(true); setError(null);
    try {
      const r = await rawImport({ format: file.format, content: file.content, ...target, dryRun: false });
      setResult(r);
      queryClient.invalidateQueries({ queryKey: ['spaces'] });
      queryClient.invalidateQueries({ queryKey: ['sidebar-spaces'] });
      queryClient.invalidateQueries({ queryKey: ['community', communityId] });
      if (parentId) queryClient.invalidateQueries({ queryKey: ['space', parentId] });
    } catch (e) {
      setError((e as Error).message || 'L\'import a échoué');
    } finally {
      setBusy(false);
    }
  };

  const title = (
    <span className="flex items-center gap-2">
      Importer des données
      <PageHelpButton pageKey="raw-import" />
    </span>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} devName="RawImportModal">
      {result ? (
        <div className="space-y-4">
          <p className="text-sm">
            Espace « {result.rootSpaceName} » créé.
          </p>
          <ReportCounts report={result} />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="bordered" onClick={onClose}>Fermer</Button>
            <Button size="sm" onClick={() => { onClose(); navigate(`/spaces/${result.rootSpaceId}`); }}>Ouvrir l'espace</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div data-tour="raw-import-file" data-help-zone="raw-import:fichier" className="space-y-1">
            <input ref={fileRef} type="file" accept={ACCEPT} className="hidden" onChange={(e) => { void pickFile(e.target.files?.[0]); e.target.value = ''; }} />
            <Button size="sm" variant="bordered" onClick={() => fileRef.current?.click()}>
              <FileUp className="w-4 h-4 mr-1" />
              {file ? 'Choisir un autre fichier' : 'Choisir un fichier (JSON ou XML)'}
            </Button>
            {file && <p className="text-xs text-muted-foreground">{file.name} — {file.format.toUpperCase()}</p>}
          </div>

          <div data-tour="raw-import-destination" data-help-zone="raw-import:destination" className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Destination</label>
            <Select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              options={parentOptions.length ? parentOptions : [{ value: '', label: ROOT_OPTION_LABEL }]}
            />
          </div>

          <div data-tour="raw-import-preview" data-help-zone="raw-import:apercu" className="min-h-[3rem] rounded border bg-muted/30 p-3">
            {busy && <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Lecture…</p>}
            {!busy && !file && !error && <p className="text-sm text-muted-foreground">Choisissez un fichier pour voir ce qui sera créé.</p>}
            {!busy && preview && (
              <div className="space-y-2">
                <p className="text-sm">
                  Espace « {preview.rootSpaceName} »{preview.exportedAt ? `, exporté le ${new Date(preview.exportedAt).toLocaleString('fr-FR')}` : ''}.
                </p>
                <ReportCounts report={preview} />
              </div>
            )}
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          </div>

          <div className="flex justify-end gap-2">
            <Button size="sm" variant="bordered" onClick={onClose}>Annuler</Button>
            <HelpHint text={pageHint('raw-import', 'confirm')}>
              <Button size="sm" data-tour="raw-import-confirm" onClick={doImport} disabled={!preview || busy}>
                {busy && preview ? 'Import…' : 'Importer'}
              </Button>
            </HelpHint>
          </div>
        </div>
      )}
    </Modal>
  );
}
