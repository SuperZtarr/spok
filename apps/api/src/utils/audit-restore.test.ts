/*
 * Tests de la sauvegarde/recréation par l'audit (utils/audit.ts) : un espace ou une communauté sérialisé
 * puis recréé garde visibilité, contexte, référentiels, description ; les anciennes entrées (isPublic seul)
 * sont converties en visibility.
 */
import { describe, it, expect } from 'vitest'
import {
  communityRestoreData,
  restoredCommunityVisibility,
  serializeCommunityForAudit,
  serializeSpaceForAudit,
  spaceRestoreData,
} from './audit.js'

describe('communauté : sérialisation puis recréation', () => {
  it('conserve visibilité, demande en attente, contexte et référentiels', () => {
    const row = {
      id: 'c1', name: 'Club', description: 'desc', visibility: 'READONLY', pendingVisibility: 'OPEN',
      context: 'PROJECT', referentiels: { statuses: [{ id: 'todo' }] }, avatarUrl: null, coverUrl: 'x.png',
      coverPosition: 30, coverPositionX: 60, coverZoom: 120,
    }
    const data = communityRestoreData(serializeCommunityForAudit(row))
    expect(data).toMatchObject({
      id: 'c1', name: 'Club', description: 'desc', visibility: 'READONLY', pendingVisibility: 'OPEN',
      context: 'PROJECT', referentiels: { statuses: [{ id: 'todo' }] }, coverUrl: 'x.png',
      coverPosition: 30, coverPositionX: 60, coverZoom: 120,
    })
  })

  it('ancienne entrée : isPublic true → OPEN, false/absent → PRIVATE, champs absents laissés au défaut', () => {
    expect(restoredCommunityVisibility({ isPublic: true })).toBe('OPEN')
    expect(restoredCommunityVisibility({ isPublic: false })).toBe('PRIVATE')
    expect(restoredCommunityVisibility({})).toBe('PRIVATE')
    const data = communityRestoreData({ id: 'c1', name: 'Club', isPublic: true })
    expect(data.visibility).toBe('OPEN')
    expect(data.context).toBeUndefined()
    expect(data.referentiels).toBeUndefined()
    expect('isPublic' in data).toBe(false)
  })
})

describe('espace : sérialisation puis recréation', () => {
  it('conserve description, visibilité, rôle et vue par défaut, position', () => {
    const row = {
      id: 's1', name: 'Projet', description: 'notes', type: 'GROUP', communityId: 'c1', parentId: 'p1',
      visibility: 'PRIVATE', defaultRole: 'MEMBER', defaultView: 'kanban', position: 3,
    }
    const data = spaceRestoreData(serializeSpaceForAudit(row), { communityId: 'c1', parentId: null })
    expect(data).toMatchObject({
      id: 's1', name: 'Projet', description: 'notes', type: 'GROUP', communityId: 'c1', parentId: null,
      visibility: 'PRIVATE', defaultRole: 'MEMBER', defaultView: 'kanban', position: 3,
    })
  })

  it('visibilité null (héritée) reste héritée', () => {
    const data = spaceRestoreData({ id: 's1', name: 'P', type: 'GROUP', visibility: null }, { communityId: null, parentId: null })
    expect(data.visibility).toBeUndefined()
  })
})
