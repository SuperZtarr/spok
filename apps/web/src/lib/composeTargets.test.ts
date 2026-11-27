/* TNR des pages de travail (composeTargets, 2026-11-26) : Article et Process ont une adresse de lecture et une de
 * composition ; « Composer » de la fiche grisé avant enregistrement ou avec des saisies en attente, absent sans droit
 * de modifier ou pour un type sans page de travail. */
import { describe, it, expect } from 'vitest';
import { composeButton, workspaceOf } from './composeTargets';

const base = { canEdit: true, hasChanges: false };

describe('composeTargets', () => {
  it('Article et Process : adresses de lecture et de composition', () => {
    expect(workspaceOf('ARTICLE')!.readUrl('s1', 'a1')).toBe('/spaces/s1/articles/a1');
    expect(workspaceOf('ARTICLE')!.composeUrl('s1', 'a1')).toBe('/spaces/s1/articles/a1?mode=composition');
    expect(workspaceOf('PROCESS')!.readUrl('s1', 'p1')).toBe('/spaces/s1?view=process&process=p1');
    expect(workspaceOf('PROCESS')!.composeUrl('s1', 'p1')).toBe('/spaces/s1?view=process&process=p1&mode=composition');
    expect(workspaceOf('TASK')).toBeUndefined();
  });

  it('Composer actif une fois enregistré dans ce type', () => {
    for (const t of ['ARTICLE', 'PROCESS']) expect(composeButton({ ...base, formType: t, savedType: t })?.disabled).toBe(false);
  });

  it('pas encore enregistré dans ce type : grisé, phrase propre au type', () => {
    expect(composeButton({ ...base, formType: 'PROCESS', savedType: 'TASK' })).toMatchObject({ disabled: true, hint: 'openProcessUnsaved' });
    expect(composeButton({ ...base, formType: 'ARTICLE', savedType: null })).toMatchObject({ disabled: true, hint: 'openArticleUnsaved' });
  });

  it('saisies en attente : grisé, même rappel pour les deux types', () => {
    for (const t of ['ARTICLE', 'PROCESS']) {
      expect(composeButton({ ...base, hasChanges: true, formType: t, savedType: t })).toMatchObject({ disabled: true, hint: 'composeModeUnsaved' });
    }
  });

  it('sans droit de modifier ou type ordinaire : pas de Composer', () => {
    expect(composeButton({ ...base, canEdit: false, formType: 'ARTICLE', savedType: 'ARTICLE' })).toBeNull();
    expect(composeButton({ ...base, formType: 'TASK', savedType: 'TASK' })).toBeNull();
  });
});
