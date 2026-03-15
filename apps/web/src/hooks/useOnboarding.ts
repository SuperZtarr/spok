import { useCallback, useEffect, useRef, useState } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { VIEW_TOURS, type TourStep } from './viewTours';
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
      element: '#header-view-selector',
      popover: {
        title: 'Vues',
        description: 'Changez de vue pour visualiser vos données différemment : liste, kanban, mindmap, timeline, graphe et bien d\'autres.',
        side: 'bottom' as const,
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
      element: '#header-user-menu',
      popover: {
        title: 'Votre profil',
        description: 'Accédez à vos préférences, notifications et paramètres. Les administrateurs y trouvent aussi le panneau d\'administration.',
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

function runTour(steps: TourStep[], storageKey: string) {
  const validSteps = steps.filter(step =>
    !step.element || document.querySelector(step.element)
  );

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

  const startTour = useCallback(() => {
    runTour(buildMainSteps(), STORAGE_KEY);
  }, []);

  // Show welcome modal on first visit
  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY)) return;
    const timer = setTimeout(() => setShowWelcome(true), 500);
    return () => clearTimeout(timer);
  }, []);

  const closeWelcome = useCallback(() => {
    setShowWelcome(false);
    localStorage.setItem(STORAGE_KEY, 'true');
  }, []);

  return { startTour, showWelcome, closeWelcome };
}

export function useViewOnboarding(viewMode: ViewMode | null) {
  const prevViewRef = useRef<ViewMode | null>(null);

  const startViewTour = useCallback((mode: ViewMode) => {
    const steps = VIEW_TOURS[mode];
    if (!steps) return;
    runTour(steps, VIEW_STORAGE_PREFIX + mode);
  }, []);

  // Auto-start when entering a new view for the first time
  useEffect(() => {
    if (!viewMode || viewMode === prevViewRef.current) return;
    prevViewRef.current = viewMode;

    if (localStorage.getItem(VIEW_STORAGE_PREFIX + viewMode)) return;

    const steps = VIEW_TOURS[viewMode];
    if (!steps) return;

    const timer = setTimeout(() => {
      runTour(steps, VIEW_STORAGE_PREFIX + viewMode);
    }, 800);

    return () => clearTimeout(timer);
  }, [viewMode]);

  return { startViewTour };
}
