const DAY = 24 * 60 * 60 * 1000;

export const MEETING_DURATIONS = [
  { label: '15 min', ms: 15 * 60 * 1000 },
  { label: '30 min', ms: 30 * 60 * 1000 },
  { label: '45 min', ms: 45 * 60 * 1000 },
  { label: '1h', ms: 60 * 60 * 1000 },
  { label: '1h30', ms: 90 * 60 * 1000 },
  { label: '2h', ms: 2 * 60 * 60 * 1000 },
  { label: '3h', ms: 3 * 60 * 60 * 1000 },
  { label: '4h', ms: 4 * 60 * 60 * 1000 },
];

export const PERIOD_DURATIONS = [
  { label: '1 jour', ms: DAY },
  { label: '2 jours', ms: 2 * DAY },
  { label: '3 jours', ms: 3 * DAY },
  { label: '5 jours', ms: 5 * DAY },
  { label: '1 sem.', ms: 7 * DAY },
  { label: '2 sem.', ms: 14 * DAY },
  { label: '1 mois', ms: 30 * DAY },
  { label: '3 mois', ms: 90 * DAY },
];

export const TASK_DURATIONS = [
  { label: '15 min', ms: 15 * 60 * 1000 },
  { label: '30 min', ms: 30 * 60 * 1000 },
  { label: '45 min', ms: 45 * 60 * 1000 },
  { label: '1h', ms: 60 * 60 * 1000 },
  { label: '1h30', ms: 90 * 60 * 1000 },
  { label: '2h', ms: 2 * 60 * 60 * 1000 },
  { label: '3h', ms: 3 * 60 * 60 * 1000 },
  { label: '4h', ms: 4 * 60 * 60 * 1000 },
  { label: '1 jour', ms: DAY },
  { label: '2 jours', ms: 2 * DAY },
  { label: '1 sem.', ms: 7 * DAY },
  { label: '2 sem.', ms: 14 * DAY },
];

export const PROJECT_DURATIONS = [
  { label: '1 mois', ms: 30 * DAY },
  { label: '3 mois', ms: 90 * DAY },
  { label: '6 mois', ms: 180 * DAY },
  { label: '1 an', ms: 365 * DAY },
  { label: '2 ans', ms: 730 * DAY },
];

export const DUE_DATE_DURATIONS = [
  { label: 'Même jour', ms: 0 },
  { label: '+1j', ms: DAY },
  { label: '+2j', ms: 2 * DAY },
  { label: '+1 sem.', ms: 7 * DAY },
  { label: '+2 sem.', ms: 14 * DAY },
  { label: '+1 mois', ms: 30 * DAY },
  { label: '+3 mois', ms: 90 * DAY },
];
