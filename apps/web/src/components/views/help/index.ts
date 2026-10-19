/* Registre de l'aide des vues : une fiche par ViewMode (Record strict — TS échoue si une vue manque).
   Fiches dans ./<vue>.help.ts, à côté des vues. Couverture (tour non vide) contrôlée par help/coverage.test.ts. */
import type { ViewMode } from '../../../stores/viewMode';
import type { HelpEntry } from '../../../help/types';
import { help as overview } from './overview.help';
import { help as list } from './list.help';
import { help as tree } from './tree.help';
import { help as kanban } from './kanban.help';
import { help as text } from './text.help';
import { help as planning } from './planning.help';
import { help as timeline } from './timeline.help';
import { help as calendar } from './calendar.help';
import { help as types } from './types.help';
import { help as mindmap } from './mindmap.help';
import { help as graph } from './graph.help';
import { help as sunburst } from './sunburst.help';
import { help as relations } from './relations.help';
import { help as bubble } from './bubble.help';
import { help as radialTree } from './radialTree.help';
import { help as treemap } from './treemap.help';
import { help as chord } from './chord.help';
import { help as burndown } from './burndown.help';
import { help as cfd } from './cfd.help';
import { help as crossTable } from './crossTable.help';
import { help as ego } from './ego.help';
import { help as heatmap } from './heatmap.help';
import { help as priority } from './priority.help';
import { help as members } from './members.help';
import { help as links } from './links.help';
import { help as bugs } from './bugs.help';
import { help as todo } from './todo.help';
import { help as documents } from './documents.help';
import { help as thread } from './thread.help';
import { help as images } from './images.help';
import { help as recent } from './recent.help';
import { help as pert } from './pert.help';
import { help as processHelp } from './process.help';

export const VIEW_HELP: Record<ViewMode, HelpEntry> = {
  overview: overview,
  list: list,
  tree: tree,
  kanban: kanban,
  text: text,
  planning: planning,
  timeline: timeline,
  calendar: calendar,
  types: types,
  mindmap: mindmap,
  graph: graph,
  sunburst: sunburst,
  relations: relations,
  bubble: bubble,
  radialTree: radialTree,
  treemap: treemap,
  chord: chord,
  burndown: burndown,
  cfd: cfd,
  crossTable: crossTable,
  ego: ego,
  heatmap: heatmap,
  priority: priority,
  members: members,
  links: links,
  bugs: bugs,
  todo: todo,
  documents: documents,
  thread: thread,
  images: images,
  recent: recent,
  pert: pert,
  process: processHelp,
};
