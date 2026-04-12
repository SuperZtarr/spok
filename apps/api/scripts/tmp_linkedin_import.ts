import { PrismaClient } from '@spok/database';

const prod = new PrismaClient({
  datasources: { db: { url: 'postgresql://postgres:GSpgpyKTewWFHHkmYtgsxwCmdbBIYiZW@ballast.proxy.rlwy.net:31323/railway' } },
});

const PROD_ADMIN_ID = 'cml3q8k60000012gz2ev4dz7r';
const SPACE_ID = 'cmnpqva590003i4t1q0cro6fy';

function html(...sections: { heading?: string; text: string }[]) {
  return sections.map(s =>
    (s.heading ? `<h2>${s.heading}</h2>` : '') +
    s.text.split('\n').filter(l => l.trim()).map(l => `<p>${l.trim()}</p>`).join('')
  ).join('');
}

// Supprimer les items existants
const existing = await prod.item.findMany({
  where: { spaceId: SPACE_ID },
  select: { id: true },
});
if (existing.length > 0) {
  await prod.item.deleteMany({ where: { spaceId: SPACE_ID } });
  console.log(`${existing.length} items supprimés.`);
}

const articles = [
  { num: 1, title: "IBM – L'obsession de partager la connaissance", messageKey: "La transmission de connaissance comme obsession fondatrice", narrative: "Auto-formation Access puis PHP pour créer des bases de connaissances clients chez IBM" },
  { num: 2, title: "3 niveaux, 3 publics – documenter pour qui ?", messageKey: "Documenter n'a de sens que si on sait pour qui", narrative: "3 niveaux : fonctionnelle utilisateur / fonctionnelle technicien / technique" },
  { num: 3, title: "Le comptable n'est pas l'informaticien", messageKey: "Chaque persona lit la doc à travers son propre prisme", narrative: "Documentation contextualisée par persona : comptable, RH, informaticien" },
  { num: 4, title: "Mon Shadow IT sous Excel est passé sur Claude Code", messageKey: "Le bricolage Excel d'hier = SPOK d'aujourd'hui", narrative: "Genèse de SPOK (spok.space) – Structurer, Relier, Planifier – développé avec Claude Code" },
  { num: 5, title: "Pourquoi prendre un stagiaire quand on a Claude Code ?", messageKey: "L'IA fait le travail junior en quelques minutes", narrative: "Contraste : heures passées à former/encadrer vs résultat immédiat avec Claude Code" },
  { num: 6, title: "Pourquoi payer une société de conseil quand on a Claude Code ?", messageKey: "La valeur du conseil est remise en question", narrative: "28 ans d'expérience condensés, disponibles instantanément" },
  { num: 7, title: "Mon IA m'a rappelé que je devais écrire un article", messageKey: "L'IA comme système de relance et d'organisation personnelle", narrative: "L'IA comme copilote de charge mentale" },
  { num: 8, title: "Penser ? pour quoi faire ?", messageKey: "La réflexion profonde est-elle encore nécessaire ?", narrative: "Délégation progressive de la cognition à l'IA" },
  { num: 9, title: "J'ai rendu mon cerveau à son fournisseur", messageKey: "La désintermédiation du cerveau humain", narrative: "\"J'ai rendu mon cerveau à son fournisseur. Je n'en ai plus besoin.\"" },
  { num: 10, title: "La charge mentale existe-t-elle encore ?", messageKey: "L'IA absorbe-t-elle la charge cognitive ?", narrative: "Allègement ou transfert de la charge mentale vers l'IA" },
  { num: 11, title: "Ce que j'ai appris en documentant 28 ans d'expérience", messageKey: "La documentation comme miroir de l'expertise accumulée", narrative: "Synthèse finale de la série" },
];

// Item parent : la série
const serie = await prod.item.create({
  data: {
    title: 'Série LinkedIn – IA & Connaissance',
    type: 'NOTE',
    spaceId: SPACE_ID,
    createdById: PROD_ADMIN_ID,
    status: 'todo',
    description: html(
      { heading: 'Introduction commune', text: "Encore un article écrit par une IA.\nMoi aussi je m'y mets, comme les autres.\nPour faire style ? naaan, c'est pour faire mon intéressant.\nSauf que je déteste ça.\nMais je m'y soumets, puisque l'IA m'a dépassé, et qu'elle me permet d'atteindre une efficacité que je ne pourrais pas atteindre seul." },
      { heading: 'Fil rouge', text: "J'ai passé des heures à réfléchir, à construire, à structurer… Claude Code m'a rendu le même résultat en quelques minutes." },
      { heading: 'Fin de chaque article', text: "Je n'ai pas envie de vous perdre en route. La suite au prochain épisode." },
      { heading: 'Note de transparence', text: "Ces idées sont les miennes, accumulées sur 28 ans. Claude les a mises en forme. C'est d'ailleurs tout le sujet." },
    ),
  },
});
console.log(`✓ Série créée : ${serie.id}`);

// Articles
for (const article of articles) {
  await prod.item.create({
    data: {
      title: `#${article.num} – ${article.title}`,
      type: 'DOCUMENT',
      spaceId: SPACE_ID,
      parentId: serie.id,
      createdById: PROD_ADMIN_ID,
      status: 'todo',
      description: html(
        { heading: 'Message clé', text: article.messageKey },
        { heading: 'Éléments narratifs', text: article.narrative },
      ),
    },
  });
  console.log(`  ✓ #${article.num} ${article.title}`);
}

console.log('\nImport terminé.');
await prod.$disconnect();
