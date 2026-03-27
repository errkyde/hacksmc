import { useCallback } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type NodeTypes,
  type OnNodeDrag,
  type OnConnect,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { DeviceNode } from './DeviceNode'
import { GroupNode } from './GroupNode'

const nodeTypes: NodeTypes = {
  deviceNode: DeviceNode as unknown as NodeTypes[string],
  groupNode: GroupNode as unknown as NodeTypes[string],
}

interface Props {
  nodes: Node[]
  edges: Edge[]
  onNodesChange: (changes: unknown) => void
  onEdgesChange: (changes: unknown) => void
  onNodeClick: (event: React.MouseEvent, node: Node) => void
  onNodeDragStop: OnNodeDrag
  onConnect: OnConnect
  onPaneClick: () => void
  fitViewRef: (fn: () => void) => void
}

export function TopologyCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onNodeClick,
  onNodeDragStop,
  onConnect,
  onPaneClick,
  fitViewRef,
}: Props) {
  const onInit = useCallback(
    (instance: { fitView: () => void }) => {
      fitViewRef(instance.fitView)
    },
    [fitViewRef],
  )

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange as never}
      onEdgesChange={onEdgesChange as never}
      onNodeClick={onNodeClick}
      onNodeDragStop={onNodeDragStop}
      onConnect={onConnect}
      onPaneClick={onPaneClick}
      onInit={onInit as never}
      nodeTypes={nodeTypes}
      fitView
      className="bg-background"
      defaultEdgeOptions={{
        type: 'smoothstep',
        markerEnd: { type: 'arrowclosed' as never, width: 12, height: 12 },
        style: { strokeWidth: 1.5 },
      }}
      proOptions={{ hideAttribution: true }}
    >
      <Background gap={16} size={1} className="opacity-30" />
      <Controls className="!bg-card !border-border !text-foreground [&>button]:!bg-card [&>button]:!border-border [&>button]:!text-foreground" />
      <MiniMap
        className="!bg-card !border-border"
        nodeColor={node => {
          if (node.type === 'groupNode') return '#334155'
          return '#3b82f6'
        }}
      />
    </ReactFlow>
  )
}
