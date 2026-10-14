/* Contrôle de couverture de l'aide utilisateur (exécuté par la TNR à chaque MEP et en CI) : toute vue du
   registre des vues (VIEW_REGISTRY partagé + VIEW_MODES) a une fiche complète — titre, résumé, au moins un
   conseil et un tour guidé non vide. Ajouter une vue sans sa fiche fait échouer ce test. */
import { describe, it, expect } from 'vitest'
import { VIEW_REGISTRY } from '@spok/shared'
import { VIEW_MODES } from '../stores/viewMode'
import { VIEW_HELP } from '../components/views/help'

const allModes = [...new Set([...VIEW_MODES.map((v) => v.value as string), ...VIEW_REGISTRY.map((v: { id: string }) => v.id)])]

// Vues passées au modèle de tour complet (2026-10-14, par lots) : au moins 5 étapes dont 3 pointées sur
// un élément réel. Ajouter les vues des lots suivants ici au fur et à mesure (à terme : toutes).
const FULL_TOUR_VIEWS = [
  // Lot 1 — vues du mode JDR
  'list', 'thread', 'mindmap', 'images', 'documents', 'links', 'recent',
  // Lot 2 — vues de pilotage
  'kanban', 'tree', 'timeline', 'planning', 'calendar', 'pert', 'todo', 'bugs', 'types', 'priority', 'members',
  // Lot 3 — vues d'exploration
  'graph', 'sunburst', 'radialTree', 'bubble', 'treemap', 'chord', 'heatmap', 'ego', 'relations', 'crossTable',
  'burndown', 'cfd', 'text', 'overview',
]

describe('aide utilisateur — couverture des vues', () => {
  it.each(allModes)('vue %s : fiche complète (titre, résumé, conseils, tour)', (mode) => {
    const help = (VIEW_HELP as Record<string, typeof VIEW_HELP[keyof typeof VIEW_HELP] | undefined>)[mode]
    expect(help, `fiche manquante : components/views/help/${mode}.help.ts`).toBeDefined()
    expect(help!.title.trim()).not.toBe('')
    expect(help!.summary.trim()).not.toBe('')
    expect(help!.tips.length).toBeGreaterThan(0)
    expect(help!.tour.length).toBeGreaterThan(0)
  })

  it('toutes les vues sont passées au tour complet (une nouvelle vue doit être ajoutée à FULL_TOUR_VIEWS)', () => {
    expect(allModes.filter((m) => !FULL_TOUR_VIEWS.includes(m))).toEqual([])
  })

  it.each(FULL_TOUR_VIEWS)('vue %s : tour complet (≥ 5 étapes, ≥ 3 pointées)', (mode) => {
    const tour = (VIEW_HELP as Record<string, { tour: { element?: string }[] }>)[mode].tour
    expect(tour.length).toBeGreaterThanOrEqual(5)
    expect(tour.filter((s) => s.element).length).toBeGreaterThanOrEqual(3)
  })

  it('chaque repère data-tour cité par un tour complet existe dans le code', async () => {
    const { readdirSync, readFileSync, statSync } = await import('node:fs')
    const { join } = await import('node:path')
    const src = join(__dirname, '..')
    const files: string[] = []
    const walk = (dir: string) => readdirSync(dir).forEach((f) => {
      const p = join(dir, f)
      if (statSync(p).isDirectory()) walk(p)
      else if (p.endsWith('.tsx')) files.push(readFileSync(p, 'utf8'))
    })
    walk(src)
    const code = files.join('\n')
    for (const mode of FULL_TOUR_VIEWS) {
      for (const step of (VIEW_HELP as Record<string, { tour: { element?: string }[] }>)[mode].tour) {
        const m = step.element?.match(/data-tour="([^"]+)"/)
        if (m) expect(code.includes(`data-tour="${m[1]}"`) || code.includes(`'data-tour': '${m[1]}'`), `repère absent : ${m[1]} (${mode})`).toBe(true)
      }
    }
  })
})
