/*
 * Hook : didacticiels driver.js — tutoriel d'accueil (éléments de help/onboarding.elements.ts) + tours par vue et par page
 * (fiches d'aide, champ `tour`). « Déjà vu » des tours par vue et par page : localStorage (spok-view-tour-done-*,
 * spok-page-tour-done-*), rien par vue en base. Réponse au tutoriel d'accueil : par compte, côté serveur (useHelpAnnouncementsStore).
 * Accueil : un nouvel arrivant se voit proposer le tutoriel une seule fois (WelcomeModal, showWelcome). Le suivre ou le passer
 * revient au même : l'accueil est traité et les nouveautés déjà présentes comptent comme vues (treatOnboarding), seules les
 * suivantes s'annonceront. Relancer le guide plus tard (bouton de la barre latérale) ne touche pas aux annonces en attente.
 * showWelcome reste faux tant que le suivi du compte n'est pas chargé ; Layout n'ouvre la fenêtre que hors pages d'authentification.
 * Dernière étape « Besoin d'aide ? » d'un tour de vue ou de page : pointe le point d'interrogation qui l'a lancé, marqué par
 * HelpButton (TOUR_ANCHOR_ATTR) — pas de sélecteur global, une modale ouverte sur une vue affiche deux « ? ».
 * Clignotement du « ? » : une fois par vue ou page et par navigateur, à la première visite, tour lancé ou non.
 * Nouveautés : une étape montre le changement de sa fonction tant qu'il n'est pas traité, et le voir le traite (toDriveStep).
 * Un changement masqué ou programmé dans /admin/news n'est pas montré (withheldAnnouncementIds).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { driver, type DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';
import type { TourStep } from '../help/types';
import { listAnnouncements, withheldAnnouncementIds } from '../help/announcements';
import { toDriveStep } from '../help/elements';
import { ONBOARDING_STEPS } from '../help/onboarding.elements';
import { VIEW_HELP } from '../components/views/help';
import { useHelpAnnouncementsStore } from '../stores/helpAnnouncements';
import type { ViewMode } from '../stores/viewMode';

const STORAGE_KEY = 'spok-onboarding-done';
const VIEW_STORAGE_PREFIX = 'spok-view-tour-done-';

/** Posé par HelpButton sur son bouton juste avant de lancer le tour, consommé par runTour. */
export const TOUR_ANCHOR_ATTR = 'data-tour-anchor';

const HELP_BUTTON_POPOVER: DriveStep['popover'] = {
  title: 'Besoin d\'aide ?',
  description: 'Relancez ce tutoriel à tout moment en cliquant sur ce bouton.',
  side: 'bottom',
};

function runTour(steps: TourStep[], storageKey: string) {
  const anchor = document.querySelector(`[${TOUR_ANCHOR_ATTR}]`);
  anchor?.removeAttribute(TOUR_ANCHOR_ATTR);
  const { handled, markHandled } = useHelpAnnouncementsStore.getState();
  // Annonce masquée ou programmée dans /admin/news : l'étape garde son explication, sans le badge de nouveauté
  const notShown = [...handled, ...withheldAnnouncementIds()];
  const validSteps: DriveStep[] = steps
    .filter(step => !step.element || document.querySelector(step.element))
    .map(step => toDriveStep(step, notShown, markHandled));
  // Rappel final sur le « ? » qui a lancé le tour (absent pour le guide de démarrage, qui a sa propre fin)
  if (anchor) validSteps.push({ element: anchor, popover: HELP_BUTTON_POPOVER });

  if (validSteps.length === 0) return;

  const d = driver({
    showProgress: true,
    showButtons: ['next', 'previous', 'close'],
    nextBtnText: 'Suivant',
    prevBtnText: 'Précédent',
    doneBtnText: 'Terminer',
    progressText: '{{current}} / {{total}}',
    steps: validSteps,
    onDestroyed: () => {
      localStorage.setItem(storageKey, 'true');
    },
  });

  d.drive();
}

/** Première réponse à la proposition du tutoriel : les nouveautés déjà présentes ne seront pas annoncées. Sans effet ensuite. */
export function treatOnboarding() {
  const { onboardingDone, completeOnboarding } = useHelpAnnouncementsStore.getState();
  if (onboardingDone !== false) return;
  completeOnboarding(listAnnouncements().map((announcement) => announcement.id));
}

export function useOnboarding() {
  const onboardingDone = useHelpAnnouncementsStore((state) => state.onboardingDone);

  const startTour = useCallback(() => {
    treatOnboarding();
    runTour(ONBOARDING_STEPS, STORAGE_KEY);
  }, []);

  return { startTour, showWelcome: onboardingDone === false, closeWelcome: treatOnboarding };
}

export function useViewOnboarding(viewMode: ViewMode | null) {
  const prevViewRef = useRef<ViewMode | null>(null);
  const [pulseHelp, setPulseHelp] = useState(false);

  const startViewTour = useCallback((mode: ViewMode) => {
    setPulseHelp(false);
    const steps = VIEW_HELP[mode]?.tour;
    if (!steps?.length) return;
    runTour(steps, VIEW_STORAGE_PREFIX + mode);
  }, []);

  // Pulse help button when entering a new view for the first time
  useEffect(() => {
    if (!viewMode || viewMode === prevViewRef.current) return;
    prevViewRef.current = viewMode;
    setPulseHelp(false);

    if (localStorage.getItem(VIEW_STORAGE_PREFIX + viewMode)) return;
    if (!VIEW_HELP[viewMode]?.tour?.length) return;

    const timer = setTimeout(() => {
      setPulseHelp(true);
      localStorage.setItem(VIEW_STORAGE_PREFIX + viewMode, 'true');
    }, 800);
    return () => clearTimeout(timer);
  }, [viewMode]);

  return { startViewTour, pulseHelp };
}

/**
 * Generic hook for pages with a guided tour (settings, dashboard, item modal, etc.)
 * Pulses the help button on first visit only.
 */
export function usePageTourPulse(pageKey: string, steps: TourStep[]) {
  const [pulseHelp, setPulseHelp] = useState(false);
  const storageKey = `spok-page-tour-done-${pageKey}`;

  useEffect(() => {
    if (localStorage.getItem(storageKey)) return;
    if (steps.length === 0) return;
    const timer = setTimeout(() => {
      setPulseHelp(true);
      localStorage.setItem(storageKey, 'true');
    }, 800);
    return () => clearTimeout(timer);
  }, [storageKey, steps.length]);

  const startTour = useCallback(() => {
    setPulseHelp(false);
    if (steps.length === 0) return;
    runTour(steps, storageKey);
  }, [steps, storageKey]);

  return { pulseHelp, startTour };
}
