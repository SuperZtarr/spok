/* Graphe global (/graph) : GraphView en mode global (communautés accessibles, filtre par communauté).
   Le « ? » est en haut à GAUCHE : le panneau de contrôle de GraphView occupe le coin haut droit. */
import { useNavigate } from 'react-router-dom';
import { GraphView } from '../components/views/GraphView';
import { PageHelpButton } from '../help/PageHelpButton';

export function GraphPage() {
  const navigate = useNavigate();

  return (
    <div className="relative flex-1 min-h-0 flex flex-col h-full overflow-hidden">
      <div className="absolute top-3 left-3 z-20"><PageHelpButton pageKey="global-graph" /></div>
      <GraphView
        level="global"
        onNodeClick={(itemId, spaceId) => navigate(`/spaces/${spaceId}?item=${itemId}`)}
      />
    </div>
  );
}
