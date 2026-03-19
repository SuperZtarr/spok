import { useNavigate } from 'react-router-dom';
import { GraphView } from '../components/views/GraphView';

export function GraphPage() {
  const navigate = useNavigate();

  return (
    <div className="flex-1 min-h-0 flex flex-col h-full overflow-hidden">
      <GraphView
        level="global"
        onNodeClick={(itemId, spaceId) => navigate(`/spaces/${spaceId}/content`, { state: { openItemId: itemId } })}
      />
    </div>
  );
}
