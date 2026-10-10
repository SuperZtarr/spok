/* Tests de l'orchestration de l'import en masse : refus avant envoi, création + envoi, nettoyage en cas d'échec, parallélisme borné. */
import { runBulkUpload, type BulkUploadDeps } from './bulkUpload';

function fakeFile(name: string, type = 'image/png', size = 100): File {
  const f = new File(['x'], name, { type });
  Object.defineProperty(f, 'size', { value: size });
  return f;
}

function makeDeps(overrides: Partial<BulkUploadDeps> = {}): BulkUploadDeps & { created: string[]; deleted: string[] } {
  const created: string[] = [];
  const deleted: string[] = [];
  let n = 0;
  return {
    created,
    deleted,
    prepare: async (f) => f,
    createItem: async (title) => { const id = `id${++n}`; created.push(`${id}:${title}`); return id; },
    upload: async () => {},
    deleteItem: async (id) => { deleted.push(id); },
    ...overrides,
  };
}

describe('runBulkUpload', () => {
  it('crée un item par fichier valide, titré sans extension', async () => {
    const deps = makeDeps();
    const res = await runBulkUpload([fakeFile('a.png'), fakeFile('b.jpg', 'image/jpeg')], 'image', deps);
    expect(res.succeeded).toBe(2);
    expect(res.failures).toEqual([]);
    expect(deps.created).toEqual(['id1:a', 'id2:b']);
  });

  it('refuse les fichiers invalides sans rien créer', async () => {
    const deps = makeDeps();
    const res = await runBulkUpload([fakeFile('a.bmp', 'image/bmp')], 'image', deps);
    expect(res.succeeded).toBe(0);
    expect(res.failures).toEqual([{ name: 'a.bmp', reason: expect.stringMatching(/Format non supporté/) }]);
    expect(deps.created).toEqual([]);
  });

  it("valide la taille après préparation (réduction d'image)", async () => {
    const big = fakeFile('big.jpg', 'image/jpeg', 9 * 1024 * 1024);
    const deps = makeDeps({ prepare: async () => fakeFile('big.webp', 'image/webp', 500_000) });
    const res = await runBulkUpload([big], 'image', deps);
    expect(res.succeeded).toBe(1);
    expect(deps.created).toEqual(['id1:big']);
  });

  it("supprime l'item créé si l'envoi échoue", async () => {
    const deps = makeDeps({ upload: async () => { throw new Error('R2 indisponible'); } });
    const res = await runBulkUpload([fakeFile('a.png')], 'image', deps);
    expect(res.succeeded).toBe(0);
    expect(res.failures).toEqual([{ name: 'a.png', reason: 'R2 indisponible' }]);
    expect(deps.deleted).toEqual(['id1']);
  });

  it('signale la progression à chaque fichier traité', async () => {
    const deps = makeDeps();
    const seen: number[] = [];
    await runBulkUpload([fakeFile('a.png'), fakeFile('b.png'), fakeFile('c.bmp', 'image/bmp')], 'image', deps, {
      onProgress: (done) => seen.push(done),
    });
    expect(seen.sort()).toEqual([1, 2, 3]);
  });

  it('ne lance jamais plus de N envois en parallèle', async () => {
    let running = 0;
    let peak = 0;
    const deps = makeDeps({
      upload: async () => {
        running++; peak = Math.max(peak, running);
        await new Promise((r) => setTimeout(r, 5));
        running--;
      },
    });
    const files = Array.from({ length: 8 }, (_, i) => fakeFile(`f${i}.png`));
    const res = await runBulkUpload(files, 'image', deps, { concurrency: 3 });
    expect(res.succeeded).toBe(8);
    expect(peak).toBe(3);
  });

  it('accepte les documents et bloque les extensions interdites', async () => {
    const deps = makeDeps();
    const res = await runBulkUpload(
      [fakeFile('rapport.pdf', 'application/pdf'), fakeFile('virus.bat', 'application/x-bat')],
      'document',
      deps,
    );
    expect(res.succeeded).toBe(1);
    expect(deps.created).toEqual(['id1:rapport']);
    expect(res.failures[0].name).toBe('virus.bat');
  });
});
