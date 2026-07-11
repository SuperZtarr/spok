/* Vérification ponctuelle de compteurs en base (debug). */
import { prisma } from '@spok/database';
import * as fs from 'fs';

async function main() {
  // Trouver la communauté MSF
  const community = await prisma.community.findFirst({
    where: { name: 'MSF Forum Archive' }
  });

  if (!community) {
    console.log('Communauté MSF Forum Archive non trouvée');
    return;
  }

  console.log(`Communauté: ${community.name} (${community.id})\n`);

  // Compter les espaces
  const spaces = await prisma.space.count({
    where: { communityId: community.id }
  });
  console.log(`Espaces: ${spaces}`);

  // Compter les items dans ces espaces
  const items = await prisma.item.count({
    where: {
      space: { communityId: community.id }
    }
  });
  console.log(`Items (topics): ${items}`);

  // Compter les contributions
  const contributions = await prisma.contribution.count({
    where: {
      item: {
        space: { communityId: community.id }
      }
    }
  });
  console.log(`Contributions (réponses): ${contributions}`);

  console.log(`\nTotal messages importés: ${items + contributions}`);

  // Vérifier le nombre attendu dans le dump SQL
  const content = fs.readFileSync('C:/_dev/spok/ex forum.sql', 'utf8');

  // Compter les topics dans le dump
  const topicsRegex = /INSERT INTO `gbk_topics`[^;]+;/gs;
  let topicMatches = content.match(topicsRegex) || [];
  let totalTopicsInDump = 0;
  for (const tm of topicMatches) {
    const rows = (tm.match(/\),\s*\n?\(/g) || []).length + 1;
    totalTopicsInDump += rows;
  }
  console.log(`\n=== Dans le dump SQL ===`);
  console.log(`  Topics: ${totalTopicsInDump}`);

  // Compter les messages dans le dump (méthode améliorée)
  const msgInsertRegex = /INSERT INTO `gbk_messages`/g;
  const msgInserts = (content.match(msgInsertRegex) || []).length;

  // Compter les enregistrements
  let totalMsgsInDump = 0;
  const messagesRegex = /INSERT INTO `gbk_messages`[^;]+;/gs;
  let msgMatches = content.match(messagesRegex) || [];
  for (const mm of msgMatches) {
    // Compter les occurrences de patterns de début d'enregistrement
    const records = mm.match(/\(\d+,\s*\d+,\s*\d+,\s*\d+/g) || [];
    totalMsgsInDump += records.length;
  }
  console.log(`  Messages: ${totalMsgsInDump}`);
  console.log(`  INSERT statements: ${msgInserts}`);

  // Différence
  const diff = totalMsgsInDump - (items + contributions);
  console.log(`\n=== Comparaison ===`);
  console.log(`  Messages dans dump: ${totalMsgsInDump}`);
  console.log(`  Messages importés: ${items + contributions}`);
  console.log(`  Différence: ${diff} (${diff > 0 ? 'manquants' : 'supplémentaires'})`);
  console.log(`  Taux de récupération: ${((items + contributions) / totalMsgsInDump * 100).toFixed(1)}%`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
