/* Aide sur écran tactile : détection et textes du guidage (carte de première visite, encart « ? », mode Aide).
   Sans survol, les rappels fonctionnels (HelpHint) se lisent par appui long ou en mode Aide : ces textes les annoncent,
   pour que l'utilisateur ne découvre jamais ces gestes par hasard (consigne Thomas 2026-11-06).
   Règles : isTouchDevice sert à adapter un comportement ou un texte, jamais à calculer une mise en page (responsive
   = classes Tailwind, skill spok-layout). */

/** Vrai sur un appareil sans survol (téléphone, tablette) : c'est l'absence de survol qui compte, pas la largeur. */
export function isTouchDevice(): boolean {
  return window.matchMedia('(hover: none)').matches;
}

export const TOUCH_HELP = {
  cardTitle: 'Savoir ce que fait un bouton',
  cardText: 'Maintenez le doigt sur un bouton pour lire ce qu\'il fait, sans le déclencher. Le mode Aide fait la même chose d\'un simple toucher, sur tout l\'écran.',
  cardTry: 'Essayer le mode Aide',
  cardDismiss: 'Compris',
  helpButtonTip: 'Doigt maintenu sur un bouton : lire ce qu\'il fait, sans le déclencher.',
  helpModeLabel: 'Mode Aide : toucher l\'écran',
  helpModeBanner: 'touchez une commande ou une zone pour savoir à quoi elle sert, sans rien déclencher',
  genericCommand: 'Cette commande',
} as const;
