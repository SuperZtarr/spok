const STORAGE_KEY = 'spok-recent-spaces';
const MAX_RECENT = 20;

interface RecentEntry {
  id: string;
  visitedAt: number;
}

function readEntries(): RecentEntry[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

export function recordSpaceVisit(spaceId: string): void {
  const entries = readEntries().filter(e => e.id !== spaceId);
  entries.unshift({ id: spaceId, visitedAt: Date.now() });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_RECENT)));
}

export function getRecentSpaceIds(): string[] {
  return readEntries().map(e => e.id);
}
