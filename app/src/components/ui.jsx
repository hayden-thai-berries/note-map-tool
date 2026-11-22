import { useEffect } from 'react';
import { ReactFlow, Background, Controls, MiniMap, useNodesState, useEdgesState } from '@xyflow/react';
import { nodeTypes } from './nodes.jsx';

export function Canvas({ graph, onNode, fitKey, types = nodeTypes, minimap = true }) {
  const [nodes, setNodes, onNodesChange] = useNodesState(graph.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(graph.edges);
  useEffect(() => { setNodes(graph.nodes); setEdges(graph.edges); }, [graph, setNodes, setEdges]);
  return (
    <ReactFlow key={fitKey} nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} nodeTypes={types}
      onNodeClick={(_, n) => onNode?.(n)} onPaneClick={() => onNode?.(null)} fitView fitViewOptions={{ padding: 0.12 }} minZoom={0.2} nodesConnectable={false}>
      <Background gap={22} color="#e2e8f0" /><Controls showInteractive={false} />{minimap && <MiniMap pannable zoomable className="!hidden md:!block" />}
    </ReactFlow>
  );
}
export const Select = ({ value, onChange, children }) => (
  <select value={value} onChange={(e) => onChange(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm">{children}</select>
);
