import { PrismaClient } from '@spok/database';
const prod = new PrismaClient({
  datasources: { db: { url: 'postgresql://postgres:GSpgpyKTewWFHHkmYtgsxwCmdbBIYiZW@ballast.proxy.rlwy.net:31323/railway' } },
});
await prod.community.delete({ where: { id: 'cmnq9b3kz00006jwqtk1yth7x' } });
console.log('OK');
await prod.$disconnect();
