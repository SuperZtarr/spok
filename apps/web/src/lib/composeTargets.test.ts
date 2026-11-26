/* TNR du bouton « Composer » commun aux Articles et aux Process (composeTargets) : libellé, emplacement unique,
 * grisé avant enregistrement ou avec des saisies en attente, lecteur d'un Process, types sans espace de travail. */
import { describe, it, expect } from 'vitest';
import { composeButton } from './composeTargets';

const base = { canEdit: true, modeAllowed: true, hasChanges: false };

describe('composeButton', () => {
  it('Article et Process enregistrés : même libellé « Composer », actif', () => {
    for (const t of ['ARTICLE', 'PROCESS']) {
      const b = composeButton({ ...base, formType: t, savedType: t });
      expect(b?.label).toBe('Composer');
      expect(b?.disabled).toBe(false);
    }
    expect(composeButton({ ...base, formType: 'PROCESS', savedType: 'PROCESS' })?.target.kind).toBe('page');
    // Article : sa page en composition (2026-11-26), comme le canevas d'un Process
    const article = composeButton({ ...base, formType: 'ARTICLE', savedType: 'ARTICLE' });
    expect(article?.target.kind).toBe('page');
    expect(article?.target.kind === 'page' && article.target.url('s1', 'a1')).toBe('/spaces/s1/articles/a1?mode=composition');
  });

  it('pas encore enregistré dans ce type : grisé, phrase propre au type ; rien pour un lecteur', () => {
    expect(composeButton({ ...base, formType: 'PROCESS', savedType: 'TASK' })).toMatchObject({ disabled: true, hint: 'openProcessUnsaved' });
    expect(composeButton({ ...base, formType: 'ARTICLE', savedType: null })).toMatchObject({ disabled: true, hint: 'openArticleUnsaved' });
    expect(composeButton({ ...base, canEdit: false, formType: 'PROCESS', savedType: 'TASK' })).toBeNull();
  });

  it('saisies en attente : grisé, même rappel pour les deux types', () => {
    for (const t of ['ARTICLE', 'PROCESS']) {
      expect(composeButton({ ...base, hasChanges: true, formType: t, savedType: t })).toMatchObject({ disabled: true, hint: 'composeModeUnsaved' });
    }
  });

  it('lecteur : « Afficher le process » ou « Lire l\'article » au même endroit', () => {
    expect(composeButton({ ...base, canEdit: false, modeAllowed: false, formType: 'PROCESS', savedType: 'PROCESS' })).toMatchObject({ label: 'Afficher le process', reader: true, disabled: false });
    expect(composeButton({ ...base, canEdit: false, modeAllowed: false, formType: 'ARTICLE', savedType: 'ARTICLE' })).toMatchObject({ label: 'Lire l\'article', reader: true, hint: 'openArticleRead' });
  });

  it('type sans espace de travail : pas de bouton', () => {
    expect(composeButton({ ...base, formType: 'TASK', savedType: 'TASK' })).toBeNull();
  });
});
