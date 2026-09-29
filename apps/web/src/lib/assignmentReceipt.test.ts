/* Tests du libellé de l'accusé de lecture à l'assignation. */
import { assignmentReceiptLabel } from './assignmentReceipt';

describe('assignmentReceiptLabel', () => {
  it('pas d\'indicateur si pas d\'accusé', () => {
    expect(assignmentReceiptLabel(null, 'Alice')).toBeNull();
    expect(assignmentReceiptLabel(undefined, 'Alice')).toBeNull();
  });

  it('pas encore vu', () => {
    expect(assignmentReceiptLabel({ seenAt: null }, 'Alice')).toEqual({ text: 'Pas encore vu', seen: false });
  });

  it('vu : nom et date courte', () => {
    const label = assignmentReceiptLabel({ seenAt: '2026-10-03T10:00:00Z' }, 'Alice');
    expect(label?.seen).toBe(true);
    expect(label?.text).toMatch(/^Vu par Alice le 3 oct/);
  });

  it('vu sans nom connu', () => {
    expect(assignmentReceiptLabel({ seenAt: '2026-10-03T10:00:00Z' })?.text).toMatch(/^Vu le 3 oct/);
  });
});
