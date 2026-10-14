/* Contrôle de couverture de l'aide utilisateur (exécuté par la TNR à chaque MEP et en CI) :
   - toute vue du registre des vues (VIEW_REGISTRY partagé + VIEW_MODES) a une fiche complète (titre, résumé,
     accroche, conseils, tour d'au moins 5 étapes dont 3 pointées) ;
   - toute page ou modale du registre PAGE_HELP a une fiche complète (tour d'au moins 2 étapes pointées — une petite
     page n'a pas plus de zones à montrer ; ne pas gonfler un tour pour atteindre un seuil) ;
   - tout <FieldHelp page field> pointe un texte existant dans `fields` de la fiche ;
   - toute vue (sauf NO_EMPTY_STATE) a un texte d'état vide et un <EmptyHelp mode="…"> branché ;
   - chaque repère data-tour cité par un tour existe dans le code (littéral ou généré : `prefix-${…}`) ;
   - barre d'espace (SpaceToolbar, Séances, Exporter) : aucun `title` natif, et toute commande nommée (aria-label)
     est enveloppée d'un HelpHint ou porte un repère de tour ; chaque repère toolbar-* / view-export posé a son
     étape dans SPACE_TOOLBAR_STEPS.
   Ajouter une vue ou une page aidée sans sa fiche, ou renommer un repère sans son tour, fait échouer ce test. */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { VIEW_REGISTRY } from '@spok/shared'
import { VIEW_MODES } from '../stores/viewMode'
import { VIEW_HELP } from '../components/views/help'
import { PAGE_HELP } from './pageHelp'
import { SPACE_TOOLBAR_STEPS } from './commonTourSteps'
import { SHELL_ZONES } from './shellZones'
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

describe('aide utilisateur — barre d\'espace', () => {
  const src = join(__dirname, '..')
  const TOOLBAR_FILES = [
    'pages/SpaceToolbar.tsx', 'components/live/ParentSessionsButton.tsx', 'components/ui/ExportDropdownButton.tsx',
    // commandes partagées des en-têtes de vue
    'components/ui/NewItemButton.tsx', 'components/ui/CollapseToggleButton.tsx', 'components/ui/BulkUploadButton.tsx',
  ]
  /** Balises ouvrantes de commande (button / Button / Link / select / input) : ligne de début + texte de la balise
      jusqu'au `>` final. */
  const commandTags = (lines: string[]) => lines.flatMap((line, i) => {
    if (!/<(button|Button|Link|select|input)(\s|$|>)/.test(line)) return []
    let tag = line
    for (let j = i + 1; j < lines.length && !/>\s*$/.test(tag.split('\n').pop()!) ; j++) tag += '\n' + lines[j]
    return [{ i, tag }]
  })

  it.each(TOOLBAR_FILES)('%s : pas de title natif, commandes nommées couvertes (HelpHint ou repère)', (file) => {
    const lines = readFileSync(join(src, file), 'utf8').split('\n')
    for (const { i, tag } of commandTags(lines)) {
      expect(/\stitle=/.test(tag), `title natif ligne ${i + 1} (${file}) : utiliser HelpHint`).toBe(false)
      if (!/aria-label=/.test(tag)) continue
      const wrapped = /<HelpHint/.test(lines[i - 1] ?? '') || /<HelpHint/.test(lines[i - 2] ?? '')
      expect(wrapped || /data-tour=/.test(tag), `commande sans infobulle ni repère ligne ${i + 1} (${file})`).toBe(true)
    }
  })

  /** Blocs #view-header de toutes les vues (découpés par indentation : de la ligne id="view-header" au </div> de même
      retrait) — leurs commandes passent par HelpHint, jamais par un title natif. */
  const viewHeaders = (() => {
    const blocks: { file: string; start: number; lines: string[] }[] = []
    const walk = (dir: string) => readdirSync(dir).forEach((f) => {
      const p = join(dir, f)
      if (statSync(p).isDirectory()) return walk(p)
      if (!p.endsWith('.tsx')) return
      const lines = readFileSync(p, 'utf8').split('\n')
      lines.forEach((line, i) => {
        if (!line.includes('id="view-header"')) return
        const indent = line.match(/^\s*/)![0]
        const end = lines.findIndex((l, j) => j > i && l.startsWith(`${indent}</div>`)) // `</div>` ou `</div>}`
        blocks.push({ file: p.slice(src.length + 1), start: i, lines: lines.slice(i, end === -1 ? undefined : end + 1) })
      })
    })
    walk(src)
    return blocks
  })()

  it('des en-têtes de vue sont trouvés', () => expect(viewHeaders.length).toBeGreaterThan(15))

  it.each(viewHeaders.map((b) => [`${b.file}:${b.start + 1}`, b] as const))('en-tête %s : pas de title natif', (_where, block) => {
    for (const { i, tag } of commandTags(block.lines)) {
      expect(/\stitle=/.test(tag), `title natif ${block.file}:${block.start + i + 1} : utiliser HelpHint (texte dans la fiche, hints)`).toBe(false)
    }
  })

  it('chaque repère toolbar-* / view-export posé a son étape dans SPACE_TOOLBAR_STEPS', () => {
    const posted = new Set(TOOLBAR_FILES.flatMap((f) =>
      [...readFileSync(join(src, f), 'utf8').matchAll(/data-tour="((?:toolbar|view-export)[a-z-]*)"/g)].map((m) => m[1])))
    const stepped = new Set(SPACE_TOOLBAR_STEPS.map((s) => s.element?.match(/data-tour="([^"]+)"/)?.[1]).filter(Boolean))
    for (const anchor of posted) expect(stepped.has(anchor), `repère ${anchor} sans étape de tour`).toBe(true)
  })
})

describe('mode Aide — zones du cadre', () => {
  const devzones = new Set([...code.matchAll(/data-devzone="([a-z-]+)"/g)].map((m) => m[1]))
  it.each(Object.keys(SHELL_ZONES))('zone du cadre %s : posée dans le code (data-devzone)', (zone) => {
    expect(devzones.has(zone), `data-devzone="${zone}" absent du code`).toBe(true)
  })
  // 'contenu' (toute la zone de contenu, trop large pour une explication) et 'x' (exemple dans un commentaire)
  it.each([...devzones].filter((z) => !['contenu', 'x'].includes(z)))('data-devzone %s : texte dans SHELL_ZONES', (zone) => {
    expect(SHELL_ZONES[zone], `texte manquant dans help/shellZones.ts : ${zone}`).toBeDefined()
  })
})

describe('mode Aide — zones des vues', () => {
  const posted = [...code.matchAll(/data-help-zone="([A-Za-z]+):([a-z-]+)"|'data-help-zone': '([A-Za-z]+):([a-z-]+)'/g)]
    .map((m) => [m[1] ?? m[3], m[2] ?? m[4]] as const)
  it.each([...new Set(posted.map(([v, z]) => `${v}:${z}`))])('zone %s : texte dans la fiche', (id) => {
    const [v, z] = id.split(':')
    expect((viewHelp[v] ?? pageHelp[v])?.zones?.[z], `zones.${z} manquant dans la fiche ${v}`).toBeDefined()
  })
  /** Vues qui affichent une autre vue (ses zones s'y trouvent aussi) : À faire et Bugs rendent ListView. */
  const COMPOSED: Record<string, string> = { todo: 'list', bugs: 'list' }
  /** Une seule zone possible : l'intérieur de FullCalendar (barre, grille) n'est pas annotable sans wrapper. */
  const ONE_ZONE = new Set(['calendar'])
  it.each(Object.keys(VIEW_HELP))('vue %s : au moins 2 zones visibles, aucun texte orphelin', (mode) => {
    const own = new Set(posted.filter(([v]) => v === mode).map(([, z]) => z))
    const base = COMPOSED[mode] ? posted.filter(([v]) => v === COMPOSED[mode]).length : 0
    const min = ONE_ZONE.has(mode) ? 1 : 2
    expect(own.size + base, `vue ${mode} : ${own.size + base} zone(s) visible(s), ${min} minimum`).toBeGreaterThanOrEqual(min)
    for (const z of Object.keys(viewHelp[mode]?.zones ?? {})) expect(own.has(z), `texte orphelin ${mode}.zones.${z}`).toBe(true)
  })
})
