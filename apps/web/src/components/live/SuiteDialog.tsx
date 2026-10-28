/*
 * SuiteDialog — « Créer la suite » d'une séance terminée (bandeau LiveSessionBar, animateur) : demande la date
 * prévue de la suite (SessionDateField, aujourd'hui par défaut) qui lui donne son nom, puis appelle onCreate(name).
 * Ce que reprend la suite (présentateurs, invités, préparation non présentée, éléments présentés recopiés) est
 * décidé par l'API (/live-sessions/:id/suite) — rien n'est choisi ici.
 * Props : onCreate(name) (l'appelant crée et navigue, renvoie une promesse), onClose ; busy / error affichés tels quels.
 */
import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { PAGE_HELP } from '../../help/pageHelp';
import { SessionDateField } from './SessionDateField';
import { sessionNameFor, todayLocal } from './sessionName';

interface Props { onCreate: (name: string) => void; onClose: () => void; busy?: boolean; error?: string | null }

export function SuiteDialog({ onCreate, onClose, busy, error }: Props) {
  const [date, setDate] = useState(todayLocal());
  return (
    <Modal isOpen onClose={onClose} title="Créer la suite" size="small" devName="SuiteDialog">
      <p className="text-sm text-muted-foreground mb-3">{PAGE_HELP['live-window'].hints?.suiteIntro}</p>
      <SessionDateField value={date} onChange={setDate} />
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
      <div className="flex justify-end gap-2 mt-4">
        <Button type="button" variant="bordered" onClick={onClose} disabled={busy}>Annuler</Button>
        <Button type="button" data-autofocus disabled={busy || !date} onClick={() => onCreate(sessionNameFor(date))}>
          {busy ? 'Création…' : 'Créer la suite'}
        </Button>
      </div>
    </Modal>
  );
}
