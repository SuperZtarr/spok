/* Import en masse de captures d'écran locales vers R2 + items IMAGE en prod. Credentials via .env racine. */
import { PrismaClient } from '@prisma/client';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, '../../../.env') });

function env(key: string): string {
  return (process.env[key] || '').replace(/^["']|["']$/g, '');
}

const PROD_DATABASE_URL = env('PROD_DATABASE_URL');
const SOURCE_DIR = 'C:\\Users\\Admin\\OneDrive\\Images\\Screenshots';
const USER_EMAIL = 'superztarr@gmail.com';
const SPACE_NAME = 'Captures d\u2019\u00e9cran';
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

const prisma = new PrismaClient({
  datasources: { db: { url: PROD_DATABASE_URL } },
});

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${env('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env('R2_ACCESS_KEY_ID'),
    secretAccessKey: env('R2_SECRET_ACCESS_KEY'),
  },
});

async function processImage(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .resize(1920, 1920, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
}

async function uploadToR2(buffer: Buffer, itemId: string): Promise<string> {
  const key = `items/${itemId}/${Date.now()}.webp`;
  await s3.send(new PutObjectCommand({
    Bucket: env('R2_BUCKET_NAME'),
    Key: key,
    Body: buffer,
    ContentType: 'image/webp',
  }));
  return `${env('R2_PUBLIC_URL')}/${key}`;
}

async function importImagesFromDir(dir: string, spaceId: string, userId: string): Promise<number> {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const imageFiles = entries
    .filter(e => e.isFile() && IMAGE_EXTENSIONS.includes(path.extname(e.name).toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  let imported = 0;
  for (const entry of imageFiles) {
    const filePath = path.join(dir, entry.name);
    const title = path.basename(entry.name, path.extname(entry.name));

    const existing = await prisma.item.findFirst({
      where: { spaceId, title, type: 'IMAGE' },
    });
    if (existing?.url) {
      continue; // already imported
    }

    try {
      const rawBuffer = fs.readFileSync(filePath);
      const processed = await processImage(rawBuffer);

      const item = existing || await prisma.item.create({
        data: { title, type: 'IMAGE', spaceId, createdById: userId },
      });

      const url = await uploadToR2(processed, item.id);
      await prisma.item.update({ where: { id: item.id }, data: { url } });

      imported++;
      console.log(`    [${imported}] ${entry.name}`);
    } catch (err) {
      console.error(`    Error: ${entry.name}: ${(err as Error).message}`);
    }
  }
  return imported;
}

async function main() {
  const user = await prisma.user.findUnique({ where: { email: USER_EMAIL } });
  if (!user) { console.error('User not found:', USER_EMAIL); process.exit(1); }
  console.log(`User: ${user.name} (${user.id})`);

  // Get or create root space
  let rootSpace = await prisma.space.findFirst({
    where: { name: SPACE_NAME, memberships: { some: { userId: user.id } } },
  });
  if (!rootSpace) {
    rootSpace = await prisma.space.create({
      data: {
        name: SPACE_NAME,
        type: 'PERSONAL',
        memberships: { create: { userId: user.id, role: 'OWNER' } },
      },
    });
    console.log(`Root space created: ${rootSpace.id}`);
  } else {
    console.log(`Root space exists: ${rootSpace.id}`);
  }

  let totalImported = 0;

  // Import root dir images
  console.log(`\n[Root] ${SPACE_NAME}`);
  totalImported += await importImagesFromDir(SOURCE_DIR, rootSpace.id, user.id);

  // Scan subdirectories
  const subdirs = fs.readdirSync(SOURCE_DIR, { withFileTypes: true })
    .filter(e => e.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name));

  for (const subdir of subdirs) {
    const subdirPath = path.join(SOURCE_DIR, subdir.name);
    const imageCount = fs.readdirSync(subdirPath)
      .filter(f => IMAGE_EXTENSIONS.includes(path.extname(f).toLowerCase())).length;

    if (imageCount === 0) {
      console.log(`\n[Skip] ${subdir.name} (no images)`);
      continue;
    }

    console.log(`\n[Subdir] ${subdir.name} (${imageCount} images)`);

    // Get or create sub-space
    let subSpace = await prisma.space.findFirst({
      where: { name: subdir.name, parentId: rootSpace.id },
    });
    if (!subSpace) {
      subSpace = await prisma.space.create({
        data: {
          name: subdir.name,
          type: 'PERSONAL',
          parentId: rootSpace.id,
          memberships: { create: { userId: user.id, role: 'OWNER' } },
        },
      });
      console.log(`  Sub-space created: ${subSpace.id}`);
    } else {
      console.log(`  Sub-space exists: ${subSpace.id}`);
    }

    totalImported += await importImagesFromDir(subdirPath, subSpace.id, user.id);
  }

  console.log(`\nDone: ${totalImported} images imported total`);
  await prisma.$disconnect();
}

main().catch(console.error);
