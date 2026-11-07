/* Tests du suivi de l'aide par compte : nouvel arrivant selon l'ancienneté du compte, fusion des annonces traitées. */
import { describe, it, expect } from 'vitest';
import { HELP_STATE_SINCE, mergeHandled, resolveOnboardingDone } from './helpState.js';

const before = new Date(HELP_STATE_SINCE.getTime() - 1000);
const after = new Date(HELP_STATE_SINCE.getTime() + 1000);

describe('resolveOnboardingDone', () => {
  it('sans réponse : un compte ancien connaît SPOK, un compte récent est nouvel arrivant', () => {
    expect(resolveOnboardingDone(null, before)).toBe(true);
    expect(resolveOnboardingDone(null, after)).toBe(false);
  });

  it('une réponse enregistrée prime sur l\'ancienneté, y compris une réinitialisation', () => {
    expect(resolveOnboardingDone(true, after)).toBe(true);
    expect(resolveOnboardingDone(false, before)).toBe(false);
  });
});

describe('mergeHandled', () => {
  it('ajoute sans doublon et conserve ce qui existait', () => {
    expect(mergeHandled(['a'], ['a', 'b'])).toEqual(['a', 'b']);
  });

  it('retire les identifiants demandés', () => {
    expect(mergeHandled(['a', 'b'], [], ['a'])).toEqual(['b']);
  });

  it('sans changement, garde la liste telle quelle', () => {
    expect(mergeHandled(['a'])).toEqual(['a']);
  });
});
