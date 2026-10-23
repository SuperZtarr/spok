/* TNR de itemClipboard — conversion HTML → Markdown et rendu de la fiche (champs vides omis,
 * image/schéma intégrés, fichier nommé). */
import { describe, it, expect } from 'vitest';
import { htmlToMarkdown, buildItemSheet, itemSheetToMarkdown, itemSheetToHtml, withAbsoluteMediaUrl, itemSheetToClipboardHtml, type ItemSheetSource } from './itemClipboard';

const labels = {
  typeLabel: (t: string) => ({ TASK: 'Tâche' } as Record<string, string>)[t],
  statusLabel: (s: string) => ({ in_progress: 'En cours' } as Record<string, string>)[s],
  priorityLabel: (p: number) => ({ 3: 'Haute' } as Record<number, string>)[p],
  formatDate: (iso: string) => iso.slice(0, 10),
};
const relationLabel = (type: string, dir: 'from' | 'to') => (dir === 'from' ? `${type}→` : `←${type}`);

function makeItem(over: Partial<ItemSheetSource> = {}): ItemSheetSource {
  return {
    id: 'i1', type: 'TASK', title: 'Ma tâche', position: 0, spaceId: 's1', createdById: 'u1',
    createdAt: '2026-10-01T10:00:00Z', updatedAt: '2026-10-02T10:00:00Z',
    ...over,
  } as ItemSheetSource;
}

describe('htmlToMarkdown', () => {
  it('convertit paragraphes, gras, italique, liens', () => {
    expect(htmlToMarkdown('<p>Un <strong>mot</strong> et <em>autre</em></p><p><a href="https://x.fr">site</a></p>'))
      .toBe('Un **mot** et *autre*\n\n[site](https://x.fr)');
  });

  it('convertit listes à puces, numérotées et imbriquées', () => {
    expect(htmlToMarkdown('<ul><li>a</li><li>b</li></ul>')).toBe('- a\n- b');
    expect(htmlToMarkdown('<ol><li><p>un</p></li><li><p>deux</p></li></ol>')).toBe('1. un\n2. deux');
    expect(htmlToMarkdown('<ul><li>a<ul><li>a1</li></ul></li></ul>')).toBe('- a\n  - a1');
  });

  it('décale les titres sous le titre de la fiche et décode les entités', () => {
    expect(htmlToMarkdown('<h1>Titre</h1><p>A&nbsp;&amp;&nbsp;B</p>')).toBe('## Titre\n\nA & B');
  });

  it('ignore les images en data: et garde les autres', () => {
    expect(htmlToMarkdown('<img src="data:image/png;base64,xx">')).toBe('');
    expect(htmlToMarkdown('<img src="https://i.png" alt="x">')).toBe('![x](https://i.png)');
  });

  it('laisse le texte brut tel quel', () => {
    expect(htmlToMarkdown('ligne 1\nligne 2')).toBe('ligne 1\nligne 2');
  });
});

describe('fiche', () => {
  it('omet les champs non renseignés', () => {
    const md = itemSheetToMarkdown(buildItemSheet({ item: makeItem(), labels, relationLabel }));
    expect(md).toBe('# Ma tâche\n\n- **Type** : Tâche\n');
  });

  it('inclut les champs renseignés, enfants et relations avec le titre lié', () => {
    const sheet = buildItemSheet({
      item: makeItem({
        status: 'in_progress', priority: 3, dueDate: '2026-10-20T00:00:00Z',
        description: '<p>Faire <b>ça</b></p>',
        assignedTo: { name: 'Léa' },
        tags: [{ id: 't', name: 'urgent', spaceId: 's1' }],
        relationsFrom: [{ id: 'r', fromItemId: 'i1', toItemId: 'i2', type: 'blocks', toItem: { id: 'i2', title: 'Autre' } }],
      }),
      children: [makeItem({ id: 'c', title: 'Sous-tâche', status: 'in_progress', parentId: 'i1' })],
      spaceName: 'Espace A',
      parentTitle: 'Projet',
      labels, relationLabel,
    });
    const md = itemSheetToMarkdown(sheet);
    expect(md).toContain('- **Statut** : En cours');
    expect(md).toContain('- **Priorité** : Haute');
    expect(md).toContain('- **Espace** : Espace A');
    expect(md).toContain('- **Parent** : Projet');
    expect(md).toContain('- **Assigné à** : Léa');
    expect(md).toContain('- **Échéance** : 2026-10-20');
    expect(md).toContain('**Tags** : urgent');
    expect(md).toContain('## Description\n\nFaire **ça**');
    expect(md).toContain('## Éléments enfants (1)\n\n- Sous-tâche — En cours');
    expect(md).toContain('## Relations\n\n- blocks→ : Autre');
    expect(itemSheetToHtml(sheet)).toContain('<h1>Ma tâche</h1>');
  });

  it('intègre l\'image d\'un item IMAGE ou DIAGRAM (HTML) et son adresse (Markdown)', () => {
    for (const type of ['IMAGE', 'DIAGRAM'] as const) {
      const sheet = buildItemSheet({ item: makeItem({ type, title: 'Schéma', url: 'https://r2.x/items/i1/1.webp' }), labels, relationLabel });
      expect(itemSheetToHtml(sheet)).toContain('<img src="https://r2.x/items/i1/1.webp" alt="Schéma"');
      expect(itemSheetToMarkdown(sheet)).toContain('![Schéma](https://r2.x/items/i1/1.webp)');
    }
  });

  it('nomme le fichier d\'un DOCUMENT sans le préfixe horodaté', () => {
    const url = 'https://r2.x/items/i1/1761200000000-compte_rendu%20v2.pdf';
    const sheet = buildItemSheet({ item: makeItem({ type: 'DOCUMENT', url }), labels, relationLabel });
    expect(itemSheetToHtml(sheet)).toContain(`📎 <a href="${url}">compte_rendu v2.pdf</a>`);
    expect(itemSheetToHtml(sheet)).not.toContain('<img');
    expect(itemSheetToMarkdown(sheet)).toContain(`**Fichier** : [compte_rendu v2.pdf](${url})`);
  });

  it('garde un LINK en lien brut', () => {
    const sheet = buildItemSheet({ item: makeItem({ type: 'LINK', url: 'https://site.fr' }), labels, relationLabel });
    expect(itemSheetToMarkdown(sheet)).toContain('**Lien** : https://site.fr');
  });

  it('ignore une description vide (<p></p>)', () => {
    const sheet = buildItemSheet({ item: makeItem({ description: '<p></p>' }), labels, relationLabel });
    expect(sheet.descriptionHtml).toBeNull();
  });
});

describe('image de la copie (Word / mail)', () => {
  const imageSheet = (url: string) => buildItemSheet({ item: makeItem({ type: 'IMAGE', url }), labels, relationLabel });

  it('rend absolue une adresse relative (upload local du dev), laisse une adresse complète intacte', () => {
    expect(withAbsoluteMediaUrl(imageSheet('/api/local-uploads/items/a/b.webp'), 'http://localhost:3000').media?.url)
      .toBe('http://localhost:3000/api/local-uploads/items/a/b.webp');
    expect(withAbsoluteMediaUrl(imageSheet('https://r2.test/b.webp'), 'http://localhost:3000').media?.url)
      .toBe('https://r2.test/b.webp');
  });

  it('intègre l\'image convertie en PNG quand la conversion réussit', async () => {
    const html = await itemSheetToClipboardHtml(imageSheet('https://r2.test/b.webp'), async () => 'data:image/png;base64,AAA');
    expect(html).toContain('<img src="data:image/png;base64,AAA"');
    expect(html).not.toContain('r2.test');
  });

  it('garde l\'adresse de l\'image quand la conversion échoue', async () => {
    const html = await itemSheetToClipboardHtml(imageSheet('https://r2.test/b.webp'), async () => null);
    expect(html).toContain('<img src="https://r2.test/b.webp"');
  });

  it('ne convertit rien pour un document', async () => {
    let called = false;
    const sheet = buildItemSheet({ item: makeItem({ type: 'DOCUMENT', url: 'https://r2.test/1792094633080-plan.pdf' }), labels, relationLabel });
    await itemSheetToClipboardHtml(sheet, async () => { called = true; return null; });
    expect(called).toBe(false);
  });
});
