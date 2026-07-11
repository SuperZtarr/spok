import { PrismaClient } from '@prisma/client'
import { ENV } from './_env'
const prisma = new PrismaClient({ datasources: { db: { url: ENV.PROD_DB_URL } } })

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
