/* Envoi d'un email aux membres d'une communauté (composition + destinataires). */
import { useState, useMemo } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Mail, Check, Loader2 } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { RichTextEditor } from './ui/RichTextEditor';
import { communitiesApi, spacesApi } from '../lib/api';

interface Member {
  userId: string;
  name: string;
  email: string;
}

interface SendEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  members: Member[];
  target: { type: 'community'; id: string; name: string } | { type: 'space'; id: string; name: string };
}

export function SendEmailModal({ isOpen, onClose, members, target }: SendEmailModalProps) {
  const [subject, setSubject] = useState('');
  const [html, setHtml] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(members.map(m => m.userId)));
  const [result, setResult] = useState<{ sent: number; failed: number } | null>(null);

  // Sync selectedIds when members change
  useMemo(() => {
    setSelectedIds(new Set(members.map(m => m.userId)));
  }, [members]);

  const sendMutation = useMutation({
    mutationFn: (data: { subject: string; html: string; recipientIds: string[] }) => {
      if (target.type === 'community') {
        return communitiesApi.sendEmail(target.id, data);
      }
      return spacesApi.sendEmail(target.id, data);
    },
    onSuccess: (data) => {
      setResult(data);
    },
  });

  const handleSend = () => {
    if (!subject.trim() || !html.trim() || selectedIds.size === 0) return;
    sendMutation.mutate({
      subject: subject.trim(),
      html,
      recipientIds: Array.from(selectedIds),
    });
  };

  const handleClose = () => {
    setSubject('');
    setHtml('');
    setResult(null);
    sendMutation.reset();
    onClose();
  };

  const toggleAll = () => {
    if (selectedIds.size === members.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(members.map(m => m.userId)));
    }
  };

  const toggleMember = (userId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const allSelected = selectedIds.size === members.length;

  if (result) {
    return (
      <Modal isOpen={isOpen} onClose={handleClose} title={<span className="text-lg font-semibold">Email envoyé</span>}>
        <div className="flex flex-col items-center gap-4 py-8">
          <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <Check className="w-6 h-6 text-green-600 dark:text-green-400" />
          </div>
          <div className="text-center">
            <p className="text-lg font-medium">{result.sent} email{result.sent > 1 ? 's' : ''} envoyé{result.sent > 1 ? 's' : ''}</p>
            {result.failed > 0 && (
              <p className="text-sm text-destructive mt-1">{result.failed} échec{result.failed > 1 ? 's' : ''}</p>
            )}
          </div>
          <Button onClick={handleClose}>Fermer</Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={<span className="text-lg font-semibold">Envoyer un email — {target.name}</span>}>
      <div className="space-y-4">
        {/* Subject */}
        <div>
          <label className="text-sm font-medium">Objet</label>
          <Input
            value={subject}
            onChange={e => setSubject(e.target.value)}
            placeholder="Objet du message"
            autoFocus
          />
        </div>

        {/* Message body */}
        <div>
          <label className="text-sm font-medium">Message</label>
          <div className="mt-1">
            <RichTextEditor
              content={html}
              onChange={setHtml}
              placeholder="Votre message..."
            />
          </div>
        </div>

        {/* Recipients */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium">
              Destinataires ({selectedIds.size}/{members.length})
            </label>
            <button
              type="button"
              onClick={toggleAll}
              className="text-xs text-primary hover:underline"
            >
              {allSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
            </button>
          </div>
          <div className="max-h-48 overflow-y-auto border border-border rounded-md divide-y divide-border">
            {members.map(member => (
              <label
                key={member.userId}
                className="flex items-center gap-3 px-3 py-2 hover:bg-accent/50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(member.userId)}
                  onChange={() => toggleMember(member.userId)}
                  className="rounded border-border"
                />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium">{member.name}</span>
                  <span className="text-xs text-muted-foreground ml-2">{member.email}</span>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Error */}
        {sendMutation.error && (
          <p className="text-sm text-destructive">{(sendMutation.error as Error).message}</p>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="bordered" onClick={handleClose}>Annuler</Button>
          <Button
            onClick={handleSend}
            disabled={!subject.trim() || !html.trim() || selectedIds.size === 0 || sendMutation.isPending}
          >
            {sendMutation.isPending ? (
              <><Loader2 className="w-4 h-4 animate-spin mr-2" />Envoi...</>
            ) : (
              <><Mail className="w-4 h-4 mr-2" />Envoyer ({selectedIds.size})</>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
