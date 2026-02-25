export interface ConnectorLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  type: 'depends' | 'blocks' | 'hierarchy' | 'relates' | 'duplicates' | 'implements' | 'tests';
  relationId?: string;
  fromItemId?: string;
}

export function SVGConnectors({ lines, onClickRelation }: { lines: ConnectorLine[]; onClickRelation?: (fromItemId: string, relationId: string) => void }) {
  if (lines.length === 0) return null;

  return (
    <svg
      className="absolute inset-0 pointer-events-none overflow-visible"
      style={{ width: '100%', height: '100%', zIndex: 0 }}
    >
      <defs>
        {[
          { id: 'arrow-depends', color: '#3b82f6' },
          { id: 'arrow-blocks', color: '#ef4444' },
          { id: 'arrow-hierarchy', color: '#9ca3af' },
          { id: 'arrow-relates', color: '#8b5cf6' },
          { id: 'arrow-duplicates', color: '#6b7280' },
          { id: 'arrow-implements', color: '#3b82f6' },
          { id: 'arrow-tests', color: '#22c55e' },
        ].map(m => (
          <marker
            key={m.id}
            id={m.id}
            viewBox="0 0 10 8"
            refX="10"
            refY="4"
            markerWidth={m.id === 'arrow-hierarchy' ? 7 : 8}
            markerHeight={m.id === 'arrow-hierarchy' ? 5 : 6}
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 4 L 0 8 z" fill={m.color} />
          </marker>
        ))}
      </defs>
      {lines.map((line, i) => {
        const midX = (line.x1 + line.x2) / 2;
        const isHierarchy = line.type === 'hierarchy';
        const colorMap: Record<string, string> = {
          hierarchy: '#9ca3af',
          depends: '#3b82f6',
          blocks: '#ef4444',
          relates: '#8b5cf6',
          duplicates: '#6b7280',
          implements: '#3b82f6',
          tests: '#22c55e',
        };
        const color = colorMap[line.type] || '#8b5cf6';
        const markerId = `arrow-${line.type}`;
        const isClickable = !isHierarchy && line.relationId && onClickRelation;
        return (
          <g key={i}>
            {/* Invisible wider hit area for clickable relations */}
            {isClickable && (
              <path
                d={`M ${line.x1},${line.y1} C ${midX},${line.y1} ${midX},${line.y2} ${line.x2},${line.y2}`}
                stroke="transparent"
                strokeWidth={12}
                fill="none"
                className="pointer-events-auto cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm('Supprimer cette relation ?')) {
                    onClickRelation!(line.fromItemId!, line.relationId!);
                  }
                }}
              />
            )}
            <path
              d={`M ${line.x1},${line.y1} C ${midX},${line.y1} ${midX},${line.y2} ${line.x2},${line.y2}`}
              stroke={color}
              strokeWidth={isHierarchy ? 1.5 : 2}
              strokeDasharray={isHierarchy ? '4 3' : undefined}
              fill="none"
              markerEnd={`url(#${markerId})`}
              opacity={isHierarchy ? 0.5 : 0.7}
              className={isClickable ? 'pointer-events-auto cursor-pointer hover:opacity-100' : ''}
              onClick={isClickable ? (e) => {
                e.stopPropagation();
                if (confirm('Supprimer cette relation ?')) {
                  onClickRelation!(line.fromItemId!, line.relationId!);
                }
              } : undefined}
            />
          </g>
        );
      })}
    </svg>
  );
}
