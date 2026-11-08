/* TNR du compte-rendu de séance (utils/liveReport) : HTML généré (en-tête, déroulé avec réaffichage, relations,
 * commentaires, non présentés, créés pendant la séance, questions avec issue et votes, échappement), conservation des décisions à la régénération,
 * création puis régénération de la Note via un prisma mocké. */
import { describe, it, expect } from 'vitest'
import { createMockPrisma } from '../test/helpers.js'
import { buildReportHtml, formatTime, generateLiveReport, mergeDecisions, plainText, type ReportData } from './liveReport.js'

const liveAt = new Date('2026-11-08T13:00:00Z')
const endedAt = new Date('2026-11-08T14:05:00Z')

const base: ReportData = {
  liveAt, endedAt, host: 'Thomas', presenters: ['Alice'], participants: ['Bob', 'Chloé'],
  displays: [], notPresented: 0, suiteName: null, created: [],
}

describe('buildReportHtml', () => {
  it('en-tête : date, horaires en Europe/Paris, durée, rôles', () => {
    const html = buildReportHtml(base)
    expect(html).toContain('2026-11-08')
    expect(html).toContain(`${formatTime(liveAt)} → ${formatTime(endedAt)} (1 h 05)`)
    expect(formatTime(liveAt)).toBe('14:00')
    expect(html).toContain('Animateur :</strong> Thomas')
    expect(html).toContain('Présentateurs :</strong> Alice')
    expect(html).toContain('Participants :</strong> Bob, Chloé')
    expect(html).toContain('Aucun élément présenté.')
    expect(html).not.toContain('Non présentés')
    expect(html).not.toContain('Décisions')
  })

  it('déroulé : réaffichage, sous-éléments, relations, commentaires, échappement', () => {
    const html = buildReportHtml({
      ...base,
      displays: [{
        at: liveAt, title: 'Budget <2027>', presenter: 'Alice', redisplays: [endedAt],
        children: ['Ligne 1'], relations: ['bloque « Plan »'],
        comments: [{ at: liveAt, author: 'Bob', text: 'À revoir & chiffrer' }],
      }],
    })
    expect(html).toContain('Budget &lt;2027&gt;')
    expect(html).toContain('présenté par Alice ; réaffiché à 15:05')
    expect(html).toContain('Sous-éléments révélés : Ligne 1')
    expect(html).toContain('Relations : bloque « Plan »')
    expect(html).toContain('Commentaire de Bob (14:00) : À revoir &amp; chiffrer')
  })

  it('non présentés (avec suite) et créés pendant la séance', () => {
    const html = buildReportHtml({
      ...base, notPresented: 2, suiteName: 'Séance 2026-11-15',
      created: [{ title: 'Idée', author: 'Bob' }],
    })
    expect(html).toContain('<h2>Non présentés</h2>')
    expect(html).toContain('2 éléments de la préparation n\'ont pas été présentés ; ils sont repris dans la suite « Séance 2026-11-15 ».')
    expect(buildReportHtml({ ...base, notPresented: 1 })).toContain('1 élément de la préparation n\'a pas été présenté.')
    expect(html).toContain('<h2>Créés pendant la séance</h2>')
    expect(html).toContain('Idée (Bob)')
  })

  it('questions : issue, précision, votes nommés, qui et quand, renvoi à la suite', () => {
    const html = buildReportHtml({
      ...base, suiteName: 'Séance 2026-11-15',
      questions: [
        {
          title: 'On garde <B> ?', status: 'question_decided', answer: 'Oui', note: 'sous réserve',
          decidedBy: 'Thomas', decidedAt: endedAt,
          options: [{ label: 'Oui', voters: ['Bob', 'Chloé'] }, { label: 'Non', voters: [] }],
        },
        { title: 'Budget', status: 'question_postponed', answer: null, note: null, decidedBy: 'Thomas', decidedAt: null, options: [] },
      ],
    })
    expect(html).toContain('<h2>Questions</h2>')
    expect(html).toContain('<strong>On garde &lt;B&gt; ?</strong> — Tranchée : Oui — sous réserve')
    expect(html).toContain('Votes : Oui 2 (Bob, Chloé) ; Non 0')
    expect(html).toContain('Issue notée par Thomas à 15:05')
    expect(html).toContain('Reportée (reprise dans la suite « Séance 2026-11-15 »)')
    expect(html).toContain('Aucun vote')
    expect(html.indexOf('<h2>Questions</h2>')).toBeGreaterThan(html.indexOf('<h2>Déroulé</h2>'))
    expect(buildReportHtml(base)).not.toContain('Questions')
  })
})

describe('mergeDecisions', () => {
  it('ajoute une section vide la première fois', () => {
    expect(mergeDecisions('<p>x</p>', null)).toBe('<p>x</p><h2>Décisions</h2><p></p>')
  })
  it('conserve le titre et tout ce qui suit à la régénération', () => {
    const previous = '<p>ancien</p><h2>Décisions</h2><p>On valide le budget</p><h2>Divers</h2><p>y</p>'
    expect(mergeDecisions('<p>nouveau</p>', previous)).toBe('<p>nouveau</p><h2>Décisions</h2><p>On valide le budget</p><h2>Divers</h2><p>y</p>')
  })
  it('titre supprimé par l\'utilisateur : section vide remise', () => {
    expect(mergeDecisions('<p>n</p>', '<p>sans titre</p>')).toBe('<p>n</p><h2>Décisions</h2><p></p>')
  })
})

describe('plainText', () => {
  it('retire les balises et décode les entités', () => {
    expect(plainText('<p>Un &amp; deux</p><p>trois&nbsp;!</p>')).toBe('Un & deux trois !')
  })
})

describe('generateLiveReport', () => {
  const session = {
    id: 'ls-1', spaceId: 'sp', status: 'ENDED', liveAt, endedAt, reportItemId: null,
    space: { name: 'Séance 2026-11-08' }, host: { id: 'h', name: 'Thomas' },
    roles: [{ role: 'HOST', user: { id: 'h', name: 'Thomas' } }, { role: 'PRESENTER', user: { id: 'a', name: 'Alice' } }],
    entries: [
      { kind: 'JOIN', userId: 'b', user: { id: 'b', name: 'Bob' }, createdAt: liveAt },
      { kind: 'DISPLAY', userId: 'a', user: { id: 'a', name: 'Alice' }, itemId: 'c1', itemTitle: 'Budget', createdAt: liveAt },
      { kind: 'DISPLAY', userId: 'a', user: { id: 'a', name: 'Alice' }, itemId: 'c1', itemTitle: 'Budget', createdAt: endedAt },
    ],
    agenda: [{ id: 'ag-1', title: 'Risques', presenter: { name: 'Alice' } }],
    nextSession: null,
  }

  it('refuse une séance non terminée', async () => {
    const prisma = createMockPrisma()
    prisma.liveSession.findUnique.mockResolvedValue({ ...session, status: 'LIVE' })
    await expect(generateLiveReport(prisma, 'ls-1', 'h')).rejects.toThrow()
  })

  it('crée la Note (type NOTE) et la rattache à la séance', async () => {
    const prisma = createMockPrisma()
    prisma.liveSession.findUnique.mockResolvedValue(session)
    prisma.item.findMany.mockResolvedValue([])
    prisma.itemRelation.findMany.mockResolvedValue([
      { type: 'blocks', fromItemId: 'c1', toItemId: 'x', fromItem: { id: 'c1', title: 'Budget', spaceId: 'sp' }, toItem: { id: 'x', title: 'Plan', spaceId: 'sp' } },
      { type: 'relates', fromItemId: 'y', toItemId: 'c1', fromItem: { id: 'y', title: 'Secret', spaceId: 'autre' }, toItem: { id: 'c1', title: 'Budget', spaceId: 'sp' } },
    ])
    prisma.contribution.findMany.mockResolvedValue([{ itemId: 'c1', content: '<p>OK</p>', createdAt: liveAt, author: { name: 'Bob' } }])
    prisma.item.create.mockResolvedValue({ id: 'note-1' })
    const id = await generateLiveReport(prisma, 'ls-1', 'h')
    expect(id).toBe('note-1')
    const data = prisma.item.create.mock.calls[0][0].data
    expect(data).toMatchObject({ type: 'NOTE', title: 'Compte-rendu — Séance 2026-11-08', spaceId: 'sp', createdById: 'h' })
    expect(data.description).toContain('réaffiché à 15:05')
    expect(data.description).toContain('Relations : bloque « Plan » ; lié à un élément d\'un autre espace')
    expect(data.description).not.toContain('Secret')
    expect(data.description).toContain('Commentaire de Bob (14:00) : OK')
    expect(data.description).toContain('1 élément de la préparation n\'a pas été présenté')
    expect(data.description).not.toContain('Risques')
    expect(data.description).toContain('Participants :</strong> Bob')
    expect(data.description.endsWith('<h2>Décisions</h2><p></p>')).toBe(true)
    expect(prisma.liveSession.update).toHaveBeenCalledWith({ where: { id: 'ls-1' }, data: { reportItemId: 'note-1' } })
  })

  it('régénère la Note existante en gardant les décisions', async () => {
    const prisma = createMockPrisma()
    prisma.liveSession.findUnique.mockResolvedValue({ ...session, reportItemId: 'note-1' })
    prisma.item.findMany.mockResolvedValue([])
    prisma.itemRelation.findMany.mockResolvedValue([])
    prisma.contribution.findMany.mockResolvedValue([])
    prisma.item.findFirst.mockResolvedValue({ id: 'note-1', description: '<p>vieux</p><h2>Décisions</h2><p>Validé</p>' })
    const id = await generateLiveReport(prisma, 'ls-1', 'h')
    expect(id).toBe('note-1')
    expect(prisma.item.create).not.toHaveBeenCalled()
    const data = prisma.item.update.mock.calls[0][0].data
    expect(data.description).not.toContain('vieux')
    expect(data.description.endsWith('<h2>Décisions</h2><p>Validé</p>')).toBe(true)
    expect(data.updatedById).toBe('h')
  })
})
