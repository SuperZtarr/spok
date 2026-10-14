/* Tests de buildPortalNodesAndEdges (mindmap-layout) : hiérarchie des sous-espaces — un sous-sous-espace
   affiché est relié au nœud de son espace parent, pas à la racine (bug 2026-10-14 « les méchants »). */
import { describe, it, expect } from 'vitest'
import { buildPortalNodesAndEdges, SPACE_NODE_ID } from './mindmap-layout'

const space = (id: string, parentId: string | null) => ({ id, name: id, parentId, type: 'GROUP', role: 'MEMBER' } as any)
const item = (id: string, spaceId: string) => ({ id, title: id, spaceId, parentId: null, status: null, relationsFrom: [], relationsTo: [] } as any)

function build(savedPositions: Record<string, { x: number; y: number }> = {}) {
  const mesPnj = space('mes-pnj', 'root')
  const mechants = space('mechants', 'mes-pnj')
  return buildPortalNodesAndEdges({
    positionedNodes: [{ id: SPACE_NODE_ID, position: { x: 0, y: 0 }, data: {} } as any],
    portals: [],
    portalItemsBySpace: new Map([['mechants', [item('garmadon', 'mechants')]]]),
    childSpaces: [mesPnj],
    communitySpaces: [space('root', null), mesPnj, mechants],
    portalSpaceNames: new Map([['mes-pnj', 'Mes PNJ'], ['mechants', 'les méchants']]),
    statuses: [],
    collapsedIds: new Set(),
    items: [],
    callbacks: {} as any,
    options: { statusOptions: [], canEdit: false } as any,
    removePortal: () => {},
    savedPositions,
  }, [])
}

describe('buildPortalNodesAndEdges — hiérarchie des sous-espaces', () => {
  it('sous-sous-espace relié à son parent, sous-espace direct relié à la racine', () => {
    const { portalEdges } = build()
    const edgeTo = (target: string) => portalEdges.find(e => e.target === target)
    expect(edgeTo('child-space-mes-pnj')?.source).toBe(SPACE_NODE_ID)
    expect(edgeTo('child-space-mechants')?.source).toBe('child-space-mes-pnj')
  })

  it('sous-sous-espace placé au-delà de son parent (plus loin de la racine)', () => {
    const { portalNodes } = build()
    const pos = (id: string) => portalNodes.find(n => n.id === id)!.position
    const dist = (p: { x: number; y: number }) => Math.hypot(p.x, p.y)
    expect(dist(pos('child-space-mechants'))).toBeGreaterThan(dist(pos('child-space-mes-pnj')))
  })

  it('une position enregistrée reste prioritaire', () => {
    const { portalNodes } = build({ 'child-space-mechants': { x: 12, y: 34 } })
    expect(portalNodes.find(n => n.id === 'child-space-mechants')!.position).toEqual({ x: 12, y: 34 })
  })
})
