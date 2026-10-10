/* Tests des règles d'envoi de fichiers (images / documents) partagées par les zones de dépôt et l'import en masse. */
import { validateUploadFile, titleFromFileName, IMAGE_MAX_SIZE, DOCUMENT_MAX_SIZE } from './uploadRules';

function fakeFile(name: string, type: string, size: number): File {
  const f = new File(['x'], name, { type });
  Object.defineProperty(f, 'size', { value: size });
  return f;
}

describe('validateUploadFile — image', () => {
  it('accepte un JPEG sous la limite', () => {
    expect(validateUploadFile(fakeFile('a.jpg', 'image/jpeg', 1000), 'image')).toBeNull();
  });
  it('refuse un format non supporté', () => {
    expect(validateUploadFile(fakeFile('a.bmp', 'image/bmp', 1000), 'image')).toMatch(/Format non supporté/);
  });
  it('refuse une image au-dessus de 5 Mo', () => {
    expect(validateUploadFile(fakeFile('a.png', 'image/png', IMAGE_MAX_SIZE + 1), 'image')).toMatch(/max 5 Mo/);
  });
});

describe('validateUploadFile — document', () => {
  it('accepte un PDF', () => {
    expect(validateUploadFile(fakeFile('a.pdf', 'application/pdf', 1000), 'document')).toBeNull();
  });
  it('refuse une extension bloquée, quelle que soit la casse', () => {
    expect(validateUploadFile(fakeFile('setup.EXE', 'application/octet-stream', 10), 'document')).toMatch(/pas autorisé/);
  });
  it('refuse un document au-dessus de 25 Mo', () => {
    expect(validateUploadFile(fakeFile('a.zip', 'application/zip', DOCUMENT_MAX_SIZE + 1), 'document')).toMatch(/max 25 Mo/);
  });
});

describe('titleFromFileName', () => {
  it("retire l'extension", () => {
    expect(titleFromFileName('Carte du monde.final.png')).toBe('Carte du monde.final');
  });
  it('garde le nom sans extension tel quel', () => {
    expect(titleFromFileName('README')).toBe('README');
  });
  it('ne renvoie jamais une chaîne vide', () => {
    expect(titleFromFileName('.png')).toBe('.png');
  });
});
