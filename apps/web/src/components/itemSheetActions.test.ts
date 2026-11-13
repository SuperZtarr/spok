/* Tests des groupes du menu « Actions » de la fiche (itemSheetActions.ts) : partage pour tous, réorganisation et
 * suppression seulement si canEdit, entrée retirée sans gestionnaire, Supprimer seule et en rouge, rappels transmis. */
import { describe, it, expect, vi } from 'vitest'
import { buildSheetActionGroups, type SheetActionHandlers } from './itemSheetActions'

const all = (): SheetActionHandlers => ({
  print: vi.fn(), exportPdf: vi.fn(), copySheet: vi.fn(), copyThumbnail: vi.fn(), copyId: vi.fn(), toggleBookmark: vi.fn(),
  markUnread: vi.fn(), duplicate: vi.fn(), move: vi.fn(), convertToSpace: vi.fn(), absorbChildren: vi.fn(),
  splitDescription: vi.fn(), merge: vi.fn(), saveAsTemplate: vi.fn(), insertTemplate: vi.fn(), delete: vi.fn(),
})
const ids = (groups: ReturnType<typeof buildSheetActionGroups>) => groups.map((g) => g.actions.map((a) => a.id))

describe('buildSheetActionGroups', () => {
  it('droit de modifier : quatre groupes, Supprimer seule et en rouge', () => {
    const groups = buildSheetActionGroups(all(), { canEdit: true, isBookmarked: false })
    expect(groups.map((g) => g.label)).toEqual(['Partager', 'Organiser', 'Structure', undefined])
    expect(ids(groups)[3]).toEqual(['delete'])
    expect(groups[3].actions[0].variant).toBe('danger')
  })

  it('sans droit : partage et épingle seulement', () => {
    expect(ids(buildSheetActionGroups(all(), { canEdit: false, isBookmarked: true }))).toEqual([
      ['print', 'exportPdf', 'copySheet', 'copyThumbnail', 'copyId'],
      ['bookmark'],
    ])
  })

  it('gestionnaire absent : entrée retirée (visiteur sans épingle, vue sans fusion)', () => {
    const h = all(); delete h.toggleBookmark; delete h.merge; delete h.absorbChildren
    const flat = ids(buildSheetActionGroups(h, { canEdit: true, isBookmarked: false })).flat()
    expect(flat).not.toContain('bookmark')
    expect(flat).not.toContain('merge')
    expect(flat).not.toContain('absorbChildren')
  })

  it('libellé de l\'épingle, vignette en cours désactivée, rappels transmis', () => {
    const groups = buildSheetActionGroups(all(), { canEdit: false, isBookmarked: true, thumbnailBusy: true, hints: { print: 'Imprime' } })
    const flat = groups.flatMap((g) => g.actions)
    expect(flat.find((a) => a.id === 'bookmark')?.label).toBe('Retirer des épingles')
    expect(flat.find((a) => a.id === 'copyThumbnail')?.disabled).toBe(true)
    expect(flat.find((a) => a.id === 'print')?.hint).toBe('Imprime')
  })
})
