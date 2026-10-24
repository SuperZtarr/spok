/* Tests du classement des éléments proposés par le sélecteur d'article (articleCandidates.ts). */
import { describe, it, expect } from 'vitest'
import { plainText, rankArticleCandidates, type CandidateRow } from './articleCandidates.js'

const CTX = { articleSpaceId: 's1', articleCommunityId: 'c1' }
let n = 0
const row = (over: Partial<CandidateRow>): CandidateRow => ({
  id: `i${++n}`, type: 'NOTE', title: 'Sans rapport', description: null, url: null, spaceId: 's1',
  updatedAt: new Date('2026-10-01T00:00:00Z'),
  space: { name: 'Espace 1', communityId: 'c1', community: { name: 'Comm 1' } },
  ...over,
})

describe('plainText', () => {
  it('retire les balises et décode les entités', () => {
    expect(plainText('<p style="color:red">Bonjour&nbsp;le&amp;monde</p>')).toBe('Bonjour le&monde')
    expect(plainText(null)).toBe('')
  })
})

describe('rankArticleCandidates', () => {
  it('ignore les correspondances dans le HTML seul', () => {
    const r = rankArticleCandidates('st', [row({ description: '<p style="x">abc</p>' })], CTX)
    expect(r).toEqual([])
  })

  it('titre qui commence, puis titre qui contient, puis texte', () => {
    const texte = row({ title: 'Autre', description: '<p>un plan précis</p>' })
    const contient = row({ title: 'Mon plan' })
    const commence = row({ title: 'Plan B' })
    const r = rankArticleCandidates('plan', [texte, contient, commence], CTX)
    expect(r.map((c) => c.title)).toEqual(['Plan B', 'Mon plan', 'Autre'])
  })

  it('à rang égal : espace de l’article, même communauté, autre communauté, puis récence', () => {
    const autreComm = row({ title: 'Plan x', spaceId: 's9', space: { name: 'E9', communityId: 'c9', community: { name: 'C9' } } })
    const memeComm = row({ title: 'Plan y', spaceId: 's2', space: { name: 'E2', communityId: 'c1', community: { name: 'Comm 1' } } })
    const ancien = row({ title: 'Plan z', updatedAt: new Date('2026-01-01T00:00:00Z') })
    const recent = row({ title: 'Plan w', updatedAt: new Date('2026-10-20T00:00:00Z') })
    const r = rankArticleCandidates('plan', [autreComm, memeComm, ancien, recent], CTX)
    expect(r.map((c) => c.title)).toEqual(['Plan w', 'Plan z', 'Plan y', 'Plan x'])
  })

  it('ignore accents et casse', () => {
    expect(rankArticleCandidates('éte', [row({ title: 'Été 2026' })], CTX).map((c) => c.title)).toEqual(['Été 2026'])
    expect(rankArticleCandidates('ETE', [row({ title: 'été' })], CTX)).toHaveLength(1)
  })

  it('extrait seulement pour une correspondance dans le texte', () => {
    const long = `<p>${'a'.repeat(200)} le mot cherché ${'b'.repeat(200)}</p>`
    const [c] = rankArticleCandidates('cherché', [row({ title: 'Autre', description: long })], CTX)
    expect(c.snippet).toContain('cherché')
    expect(c.snippet!.length).toBeLessThanOrEqual(122)
    expect(c.snippet!.startsWith('…')).toBe(true)
    const [t] = rankArticleCandidates('autre', [row({ title: 'Autre', description: long })], CTX)
    expect(t.snippet).toBeNull()
  })

  it('respecte la limite et accepte un terme d’un caractère', () => {
    const rows = Array.from({ length: 5 }, (_, i) => row({ title: `x${i}` }))
    expect(rankArticleCandidates('x', rows, CTX, 3)).toHaveLength(3)
  })

  it('sort les champs attendus', () => {
    const [c] = rankArticleCandidates('plan', [row({ id: 'p', title: 'Plan', type: 'TASK' })], CTX)
    expect(c).toEqual({ id: 'p', type: 'TASK', title: 'Plan', spaceId: 's1', spaceName: 'Espace 1', communityName: 'Comm 1', snippet: null })
  })
})
