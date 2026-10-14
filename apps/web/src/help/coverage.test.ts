/* Contrôle de couverture de l'aide utilisateur (exécuté par la TNR à chaque MEP et en CI) :
   - toute vue du registre des vues (VIEW_REGISTRY partagé + VIEW_MODES) a une fiche complète (titre, résumé,
     accroche, conseils, tour d'au moins 5 étapes dont 3 pointées) ;
   - toute page ou modale du registre PAGE_HELP a une fiche complète (tour d'au moins 2 étapes pointées — une petite
     page n'a pas plus de zones à montrer ; ne pas gonfler un tour pour atteindre un seuil) ;
   - tout <FieldHelp page field> pointe un texte existant dans `fields` de la fiche ;
   - toute vue (sauf NO_EMPTY_STATE) a un texte d'état vide et un <EmptyHelp mode="…"> branché ;
   - chaque repère data-tour cité par un tour existe dans le code (littéral ou généré : `prefix-${…}`).
   Ajouter une vue ou une page aidée sans sa fiche, ou renommer un repère sans son tour, fait échouer ce test. */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { VIEW_REGISTRY } from '@spok/shared'
import { VIEW_MODES } from '../stores/viewMode'
import { VIEW_HELP } from '../components/views/help'
import { PAGE_HELP } from './pageHelp'
import type { HelpEntry } from './types'

const allModes = [...new Set([...VIEW_MODES.map((v) => v.value as string), ...VIEW_REGISTRY.map((v: { id: string }) => v.id)])]
const viewHelp = VIEW_HELP as Record<string, HelpEntry | undefined>
const pageHelp = PAGE_HELP as Record<string, HelpEntry>
/** Vues sans état vide : leur cadre reste utile vide (grille du calendrier et de la heatmap, nœud racine de la carte
    mentale) ou elles ne sont jamais vides (présentation de l'espace). */
const NO_EMPTY_STATE = new Set(['overview', 'calendar', 'heatmap', 'mindmap'])

// Code source (.tsx) pour vérifier l'existence des repères
const code = (() => {
  const files: string[] = []
  const walk = (dir: string) => readdirSync(dir).forEach((f) => {
    const p = join(dir, f)
    if (statSync(p).isDirectory()) walk(p)
    else if (p.endsWith('.tsx')) files.push(readFileSync(p, 'utf8'))
  })
  walk(join(__dirname, '..'))
  return files.join('\n')
})()

/** Le repère existe : littéral (data-tour="x" / 'data-tour': 'x') ou généré par un gabarit (`prefix-${…}`). */
function anchorExists(name: string): boolean {
  if (code.includes(`data-tour="${name}"`) || code.includes(`'data-tour': '${name}'`)) return true
  return [...code.matchAll(/data-tour=\{`([a-z-]+)\$\{/g)].some((m) => name.startsWith(m[1]))
}

function expectAnchors(entry: HelpEntry, where: string) {
  for (const step of entry.tour) {
    const m = step.element?.match(/data-tour="([^"]+)"/)
    if (m) expect(anchorExists(m[1]), `repère absent : ${m[1]} (${where})`).toBe(true)
  }
}

describe('aide utilisateur — vues', () => {
  it.each(allModes)('vue %s : fiche complète (titre, résumé, accroche, conseils)', (mode) => {
    const help = viewHelp[mode]
    expect(help, `fiche manquante : components/views/help/${mode}.help.ts`).toBeDefined()
    expect(help!.title.trim()).not.toBe('')
    expect(help!.summary.trim()).not.toBe('')
    expect(help!.short?.trim(), `accroche (short) manquante : ${mode}`).toBeTruthy()
    expect(help!.tips.length).toBeGreaterThan(0)
  })

  it.each(allModes.filter((m) => !NO_EMPTY_STATE.has(m)))('vue %s : texte d\'état vide (empty, lu par EmptyHelp)', (mode) => {
    expect(viewHelp[mode]?.empty?.trim(), `état vide manquant : ${mode}`).toBeTruthy()
    expect(code.includes(`mode="${mode}"`), `EmptyHelp non branché : ${mode}`).toBe(true)
  })

  it.each(allModes)('vue %s : tour complet (≥ 5 étapes, ≥ 3 pointées, repères existants)', (mode) => {
    const help = viewHelp[mode]!
    expect(help.tour.length).toBeGreaterThanOrEqual(5)
    expect(help.tour.filter((s) => s.element).length).toBeGreaterThanOrEqual(3)
    expectAnchors(help, mode)
  })
})

describe('aide utilisateur — pages et modales', () => {
  it.each(Object.keys(pageHelp))('%s : fiche complète et tour (≥ 2 étapes pointées, repères existants)', (key) => {
    const help = pageHelp[key]
    expect(help.title.trim()).not.toBe('')
    expect(help.summary.trim()).not.toBe('')
    expect(help.tips.length).toBeGreaterThan(0)
    expect(help.tour.filter((s) => s.element).length).toBeGreaterThanOrEqual(2)
    expectAnchors(help, key)
  })

  const fieldRefs = [...code.matchAll(/<FieldHelp page="([^"]+)" field="([^"]+)"/g)].map((m) => `${m[1]}.${m[2]}`)
  it.each([...new Set(fieldRefs)])('aide de champ %s : texte présent dans la fiche (fields)', (ref) => {
    const [page, field] = ref.split('.')
    expect(pageHelp[page]?.fields?.[field]?.trim(), `fields.${field} manquant dans la fiche ${page}`).toBeTruthy()
  })
})
