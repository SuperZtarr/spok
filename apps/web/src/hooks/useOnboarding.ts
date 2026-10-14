/*
 * Hook : didacticiels driver.js — tour principal à la première visite + tours par vue (fiches d'aide
 * VIEW_HELP[vue].tour, components/views/help), suivi « déjà vu » en localStorage (spok-onboarding-done,
 * spok-view-tour-done-*).
 * Dernière étape « Besoin d'aide ? » : pointe le point d'interrogation qui a lancé le tour, marqué par HelpButton
 * (TOUR_ANCHOR_ATTR) — pas de sélecteur global, une modale ouverte sur une vue affiche deux « ? ».
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { driver, type DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';
import type { TourStep } from '../help/types';
import { VIEW_HELP } from '../components/views/help';
import type { ViewMode } from '../stores/viewMode';

const STORAGE_KEY = 'spok-onboarding-done';
const VIEW_STORAGE_PREFIX = 'spok-view-tour-done-';

function buildMainSteps() {
  return [
    {
      element: '#sidebar-logo',
      popover: {
        title: 'Bienvenue sur SPOK !',
        description: 'SPOK est votre outil pour structurer, relier, évaluer et planifier. Ce guide rapide vous montre les bases.',
        side: 'right' as const,
      },
    },
    {
      element: '#sidebar-communities',
      popover: {
        title: 'Communautés',
        description: 'Les communautés regroupent des personnes autour d\'un sujet commun. Chaque communauté contient des espaces de travail partagés.',
        side: 'right' as const,
      },
    },
    {
      element: '#sidebar-first-space',
      popover: {
        title: 'Espaces',
        description: 'Les espaces contiennent vos éléments : notes, tâches, projets, réunions… Cliquez sur un espace pour l\'ouvrir.',
        side: 'right' as const,
      },
    },
    {
      element: '[data-tour="home-communities"]',
      popover: {
        title: 'Vos communautés',
        description: 'Retrouvez ici toutes vos communautés en cartes. Cliquez sur une carte pour accéder à ses espaces et contenus.',
        side: 'top' as const,
      },
    },
    {
      element: '#sidebar-favorites',
      popover: {
        title: 'Favoris & Récents',
        description: 'Vos espaces favoris (étoile) et récemment visités apparaissent ici pour un accès rapide. Cliquez l\'étoile sur n\'importe quel espace pour l\'ajouter aux favoris.',
        side: 'right' as const,
      },
    },
    {
      element: '#header-global-search',
      popover: {
        title: 'Recherche globale',
        description: 'Recherchez un élément, un espace ou un membre dans tous vos espaces d\'un coup.',
        side: 'bottom' as const,
      },
    },
    {
      element: '#sidebar-help-button',
      popover: {
        title: 'Besoin d\'aide ?',
        description: 'Vous pouvez relancer ce guide à tout moment en cliquant sur ce bouton.',
        side: 'right' as const,
      },
    },
  ];
}

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
  const validSteps: DriveStep[] = steps.filter(step =>
    !step.element || document.querySelector(step.element)
  );
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

export function useOnboarding() {
  const [showWelcome, setShowWelcome] = useState(false);
  const [pulseHelp, setPulseHelp] = useState(false);

  const startTour = useCallback(() => {
    setPulseHelp(false);
    localStorage.setItem(STORAGE_KEY, 'true');
    runTour(buildMainSteps(), STORAGE_KEY);
  }, []);

  // Show welcome modal or pulse help button
  useEffect(() => {
    const onboardingDone = localStorage.getItem(STORAGE_KEY);
    const hideWelcome = localStorage.getItem('spok-hide-welcome') === 'true';
    if (onboardingDone && hideWelcome) return;
    if (!onboardingDone) {
      // First visit: pulse the help button
      const timer = setTimeout(() => setPulseHelp(true), 500);
      return () => clearTimeout(timer);
    }
    // User opted to keep seeing welcome modal
    const timer = setTimeout(() => setShowWelcome(true), 500);
    return () => clearTimeout(timer);
  }, []);

  const closeWelcome = useCallback(() => {
    setShowWelcome(false);
    localStorage.setItem(STORAGE_KEY, 'true');
  }, []);

  return { startTour, showWelcome, closeWelcome, pulseHelp };
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

    if (localStorage.getItem(VIEW_STORAGE_PREFIX + viewMode)) {
      setPulseHelp(false);
      return;
    }

    const steps = VIEW_HELP[viewMode]?.tour;
    if (!steps?.length) {
      setPulseHelp(false);
      return;
    }

    const timer = setTimeout(() => setPulseHelp(true), 800);
    return () => clearTimeout(timer);
  }, [viewMode]);

  return { startViewTour, pulseHelp };
}

/**
 * Generic hook for pages with a guided tour (settings, dashboard, item modal, etc.)
 * Pulses the help button on first visit, marks done when tour is started.
 */
export function usePageTourPulse(pageKey: string, steps: TourStep[]) {
  const [pulseHelp, setPulseHelp] = useState(false);
  const storageKey = `spok-page-tour-done-${pageKey}`;

  useEffect(() => {
    if (localStorage.getItem(storageKey)) return;
    if (steps.length === 0) return;
    const timer = setTimeout(() => setPulseHelp(true), 800);
    return () => clearTimeout(timer);
  }, [storageKey, steps.length]);

  const startTour = useCallback(() => {
    setPulseHelp(false);
    if (steps.length === 0) return;
    runTour(steps, storageKey);
  }, [steps, storageKey]);

  return { pulseHelp, startTour };
}

