/*
 * Tests des fonctions pures d'horizon temporel (packages/shared/src/utils/horizon.ts) :
 * dérivation depuis dueDate, grâce avant remontée en revue par horizon manuel.
 * Vit ici (projet vitest "api") faute de projet vitest dédié à packages/shared.
 */
import { describe, it, expect } from 'vitest'
import { effectiveHorizon, isOverdueForReview } from '@spok/shared'

const NOW = new Date('2026-07-19T12:00:00.000Z') // dimanche

describe('effectiveHorizon', () => {
  it('retourne NOW pour une échéance en retard', () => {
    expect(effectiveHorizon({ dueDate: '2026-07-10T00:00:00.000Z', manualHorizon: null }, NOW)).toBe('NOW')
  })

  it('retourne NOW pour une échéance aujourd\'hui', () => {
    expect(effectiveHorizon({ dueDate: '2026-07-19T18:00:00.000Z', manualHorizon: null }, NOW)).toBe('NOW')
  })

  it('retourne WEEK pour une échéance cette semaine', () => {
    // now isolé (mercredi) plutôt que le NOW partagé (qui tombe un dimanche, cas limite
    // testé séparément ci-dessous) : ce test vise l'intention "échéance dans la semaine en
    // cours", pas le comportement de bord de fin de semaine.
    const now = new Date('2026-07-15T12:00:00.000Z') // mercredi
    expect(effectiveHorizon({ dueDate: '2026-07-17T00:00:00.000Z', manualHorizon: null }, now)).toBe('WEEK') // vendredi, même semaine
  })

  it('un dimanche, la semaine en cours se termine aujourd\'hui — le lendemain n\'est plus WEEK', () => {
    expect(effectiveHorizon({ dueDate: '2026-07-20T00:00:00.000Z', manualHorizon: null }, NOW)).toBe('MONTH')
  })

  it('retourne MONTH pour une échéance ce mois-ci', () => {
    expect(effectiveHorizon({ dueDate: '2026-07-30T00:00:00.000Z', manualHorizon: null }, NOW)).toBe('MONTH')
  })

  it('retourne LATER pour une échéance au-delà du mois', () => {
    expect(effectiveHorizon({ dueDate: '2026-09-01T00:00:00.000Z', manualHorizon: null }, NOW)).toBe('LATER')
  })

  it('sans échéance, retourne manualHorizon tel quel', () => {
    expect(effectiveHorizon({ dueDate: null, manualHorizon: 'WEEK' }, NOW)).toBe('WEEK')
  })

  it('sans échéance ni manualHorizon, retourne null (bac à trier)', () => {
    expect(effectiveHorizon({ dueDate: null, manualHorizon: null }, NOW)).toBeNull()
  })

  it('dueDate prime toujours sur manualHorizon', () => {
    expect(effectiveHorizon({ dueDate: '2026-07-10T00:00:00.000Z', manualHorizon: 'LATER' }, NOW)).toBe('NOW')
  })

  it('reste cohérent quel que soit le fuseau du process (fixé sur Europe/Paris)', () => {
    // 23:30 UTC le 31 juillet est déjà le 1er août en Europe/Paris (été, UTC+2). Avant le
    // fix, les composants de date étaient lus dans le fuseau LOCAL DU PROCESS : un serveur
    // tournant en UTC aurait vu "juillet" comme mois courant (→ LATER pour une échéance à
    // mi-août), alors qu'un navigateur en Europe/Paris aurait vu "août" (→ MONTH) — deux
    // résultats différents pour le même instant absolu. Avec le fuseau Paris fixé via
    // Intl.DateTimeFormat, le résultat est MONTH quel que soit le fuseau du process qui
    // exécute le calcul (vérifié ici en forçant TZ=UTC pour simuler un serveur Railway).
    const originalTz = process.env.TZ
    try {
      process.env.TZ = 'UTC'
      const now = new Date('2026-07-31T23:30:00.000Z')
      expect(effectiveHorizon({ dueDate: '2026-08-15T00:00:00.000Z', manualHorizon: null }, now)).toBe('MONTH')
    } finally {
      // process.env.TZ = undefined ne supprime PAS la variable : Node la coerce en la chaîne
      // littérale "undefined", ce qui polluerait le fuseau par défaut du process pour le
      // reste du worker Vitest. `delete` restaure l'absence réelle de la variable.
      if (originalTz === undefined) delete process.env.TZ
      else process.env.TZ = originalTz
    }
  })
})

describe('isOverdueForReview', () => {
  it('faux si l\'item a une échéance (toujours à jour par recalcul)', () => {
    expect(isOverdueForReview({ dueDate: '2026-01-01T00:00:00.000Z', manualHorizon: null, horizonSetAt: null }, NOW)).toBe(false)
  })

  it('faux si aucun horizon manuel assigné (bac à trier)', () => {
    expect(isOverdueForReview({ dueDate: null, manualHorizon: null, horizonSetAt: null }, NOW)).toBe(false)
  })

  it('LATER ne remonte jamais, même très ancien', () => {
    expect(isOverdueForReview({ dueDate: null, manualHorizon: 'LATER', horizonSetAt: '2025-01-01T00:00:00.000Z' }, NOW)).toBe(false)
  })

  it('NOW dépasse la grâce d\'1 jour', () => {
    expect(isOverdueForReview({ dueDate: null, manualHorizon: 'NOW', horizonSetAt: '2026-07-17T00:00:00.000Z' }, NOW)).toBe(true)
  })

  it('NOW dans la grâce d\'1 jour', () => {
    expect(isOverdueForReview({ dueDate: null, manualHorizon: 'NOW', horizonSetAt: '2026-07-19T00:00:00.000Z' }, NOW)).toBe(false)
  })

  it('WEEK dépasse la grâce de 10 jours', () => {
    expect(isOverdueForReview({ dueDate: null, manualHorizon: 'WEEK', horizonSetAt: '2026-07-05T00:00:00.000Z' }, NOW)).toBe(true)
  })

  it('WEEK dans la grâce de 10 jours', () => {
    expect(isOverdueForReview({ dueDate: null, manualHorizon: 'WEEK', horizonSetAt: '2026-07-12T00:00:00.000Z' }, NOW)).toBe(false)
  })

  it('MONTH dépasse la grâce de 35 jours', () => {
    expect(isOverdueForReview({ dueDate: null, manualHorizon: 'MONTH', horizonSetAt: '2026-06-01T00:00:00.000Z' }, NOW)).toBe(true)
  })

  it('MONTH dans la grâce de 35 jours', () => {
    expect(isOverdueForReview({ dueDate: null, manualHorizon: 'MONTH', horizonSetAt: '2026-07-01T00:00:00.000Z' }, NOW)).toBe(false)
  })

  it('faux si horizonSetAt absent (ne devrait pas arriver mais ne doit pas planter)', () => {
    expect(isOverdueForReview({ dueDate: null, manualHorizon: 'NOW', horizonSetAt: null }, NOW)).toBe(false)
  })
})
