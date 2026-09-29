/* Tests de l'accusé de lecture à l'assignation : tampon d'assignation et calcul vu / pas vu. */
import { describe, it, expect, vi } from 'vitest';
import { assignmentStamp, computeAssignmentReceipts } from './assignment.js';

const NOW = new Date('2026-09-29T10:00:00Z');

describe('assignmentStamp', () => {
  it('assigné non fourni dans la requête : rien ne bouge', () => {
    expect(assignmentStamp('u1', undefined, 'me', NOW)).toEqual({});
  });
  it('assigné inchangé : rien ne bouge', () => {
    expect(assignmentStamp('u1', 'u1', 'me', NOW)).toEqual({});
  });
  it('nouvel assigné : date et auteur posés', () => {
    expect(assignmentStamp('u1', 'u2', 'me', NOW)).toEqual({ assignedAt: NOW, assignedById: 'me' });
    expect(assignmentStamp(null, 'u2', 'me', NOW)).toEqual({ assignedAt: NOW, assignedById: 'me' });
  });
  it('désassignation : date et auteur effacés', () => {
    expect(assignmentStamp('u1', null, 'me', NOW)).toEqual({ assignedAt: null, assignedById: null });
  });
});

describe('computeAssignmentReceipts', () => {
  const assignedAt = new Date('2026-09-28T10:00:00Z');
  const prismaWith = (views: Array<{ userId: string; itemId: string; viewedAt: Date }>) => ({
    itemView: { findMany: vi.fn().mockResolvedValue(views) },
  });

  it('vu après l\'assignation → seenAt ; vu avant → null ; jamais vu → null', async () => {
    const items = [
      { id: 'a', assignedToId: 'alice', assignedAt, assignedById: 'me' },
      { id: 'b', assignedToId: 'alice', assignedAt, assignedById: 'me' },
      { id: 'c', assignedToId: 'bob', assignedAt, assignedById: 'me' },
    ];
    const prisma = prismaWith([
      { userId: 'alice', itemId: 'a', viewedAt: new Date('2026-09-28T12:00:00Z') },
      { userId: 'alice', itemId: 'b', viewedAt: new Date('2026-09-27T12:00:00Z') },
    ]);
    const r = await computeAssignmentReceipts(prisma as any, items);
    expect(r.get('a')).toEqual({ seenAt: '2026-09-28T12:00:00.000Z' });
    expect(r.get('b')).toEqual({ seenAt: null });
    expect(r.get('c')).toEqual({ seenAt: null });
    expect(prisma.itemView.findMany).toHaveBeenCalledTimes(1); // une requête pour toute la liste
  });

  it('pas d\'indicateur (null) : non assigné, assignation antérieure, auto-assignation', async () => {
    const items = [
      { id: 'n', assignedToId: null, assignedAt: null, assignedById: null },
      { id: 'old', assignedToId: 'alice', assignedAt: null, assignedById: null },
      { id: 'self', assignedToId: 'alice', assignedAt, assignedById: 'alice' },
    ];
    const prisma = prismaWith([]);
    const r = await computeAssignmentReceipts(prisma as any, items);
    expect(r.get('n')).toBeNull();
    expect(r.get('old')).toBeNull();
    expect(r.get('self')).toBeNull();
    expect(prisma.itemView.findMany).not.toHaveBeenCalled();
  });
});
