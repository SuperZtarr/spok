import { PrismaClient } from '@spok/database';
const dev = new PrismaClient({ datasources: { db: { url: 'postgresql://spok:spok@localhost:25432/spok?schema=public' } } });
const SPACE_ID = 'cmnn2fi3301uatmoswfii34wk';

// Sections existantes
const BASIQUE    = 'cmnnp2iot00587g50igcgbmke';
const TYPES      = 'cmnnp37qn005e7g50j8jlzdp2';
const PLANNING   = 'cmnnp3x2y005o7g50ikpa9o1r';
const EXPLORATION= 'cmnnp45by005u7g50nlp6i0hn';
const VUES       = 'cmnno0by2001zjmwlw67o368p';
const ADMIN_DEV  = 'cmlup9ug40000n86xjf96ej3f';

async function move(id: string, parentId: string, label: string) {
  await dev.item.update({ where: { id }, data: { parentId } });
  console.log(`  -> ${label}`);
}

async function main() {
  // Basique
  console.log('Basique:');
  await move('cmnno0c05002jjmwlebtdwsa6', BASIQUE, 'Séquence');

  // Types
  console.log('Types:');
  await move('cmnno0cdw0069jmwli6l6l97y', TYPES, 'Bugs');
  await move('cmnno0cd80063jmwlibx2i2gf', TYPES, 'Images');

  // Planification
  console.log('Planification:');
  await move('cmnno0c0k002njmwl2mwtyncd', PLANNING, 'Priorités');
  await move('cmnno0ce4006bjmwlrlj3fs28', PLANNING, 'Planification (vue)');

  // Exploration
  console.log('Exploration:');
  await move('cmnno0cej006fjmwlhhodq3yy', EXPLORATION, 'Relations');
  await move('cmnno0c220031jmwlkr66tlwi', EXPLORATION, 'Réseau égocentrique');
  await move('cmnno0c2a0033jmwleq2n8ubw', EXPLORATION, 'Organigramme');

  // Créer section Analyse sous Vues
  console.log('Analyse (nouvelle section):');
  const analyse = await dev.item.create({
    data: {
      title: 'Analyse',
      type: 'NOTE',
      parentId: VUES,
      spaceId: SPACE_ID,
      createdById: ADMIN_DEV,
    },
  });
  console.log('  Section créée: ' + analyse.id);
  await move('cmnno0c1f002vjmwljj16s2tk', analyse.id, 'CFD');
  await move('cmnno0c1m002xjmwle0pm335a', analyse.id, 'Heatmap');
  await move('cmnno0c1u002zjmwlcbomdo1j', analyse.id, 'Chord');
  await move('cmnno0c2i0035jmwld66eyhqb', analyse.id, 'Matrice croisée');
  await move('cmnno0c2x0039jmwl0jr9nsy1', analyse.id, 'Effort / Impact');
  await move('cmnno0cer006hjmwlsfs1fyji', analyse.id, 'Dashboard Cockpit');
  await move('cmnno0cec006djmwlso60ty7j', analyse.id, 'Vue d\'ensemble');

  console.log('\nDone.');
  await dev.$disconnect();
}
main().catch(e => { console.error(e.message); process.exit(1); });
