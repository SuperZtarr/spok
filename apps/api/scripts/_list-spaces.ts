import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient({ datasources: { db: { url: 'postgresql://postgres:GSpgpyKTewWFHHkmYtgsxwCmdbBIYiZW@ballast.proxy.rlwy.net:31323/railway' } } })

async function main() {
  const memberships = await prisma.spaceMembership.findMany({
    where: { userId: 'cml3q8k60000012gz2ev4dz7r', role: 'OWNER' },
    include: { space: { select: { id: true, name: true, communityId: true } } }
  })
  for (const m of memberships) {
    console.log(`${m.space.id} | ${m.space.name} | community=${m.space.communityId}`)
  }
  await prisma.$disconnect()
}
main()
