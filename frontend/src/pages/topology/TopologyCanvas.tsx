import { useCallback } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useReactFlow,
  type Node,
  type Edge,
  type NodeTypes,
  type EdgeTypes,
  type OnNodeDrag,
  type OnConnect,
  type OnNodesChange,
  type OnEdgesChange,
  type OnSelectionChangeFunc,
  BackgroundVariant,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { DeviceNode } from './DeviceNode'
import { CustomEdge } from './CustomEdge'
import type { DeviceNodeData } from './DeviceNode'

const nodeTypes: NodeTypes = {
  deviceNode: DeviceNode as unknown as NodeTypes[string],
}

const edgeTypes: EdgeTypes = {
  custom: CustomEdge as unknown as EdgeTypes[string],
}

function miniMapNodeColor(node: Node): string {
  const d = (node.data as unknown as DeviceNodeData).device
  if (!d) return '#64748b'
  switch (d.deviceType) {
    case 'HOST':     return '#3b82f6'
    case 'ROUTER':   return '#f97316'
    case 'FIREWALL': return '#ef4444'
    case 'SWITCH':   return '#a855f7'
    case 'PRINTER':  return '#6b7280'
    case 'INTERNET': return '#1e293b'
    default:         return '#64748b'
  }
}

interface Props {
  nodes: Node[]
  edges: Edge[]
  onNodesChange: OnNodesChange<Node>
  onEdgesChange: OnEdgesChange<Edge>
  onNodeClick: (event: React.MouseEvent, node: Node) => void
  onNodeDragStart: OnNodeDrag
  onNodeDragStop: OnNodeDrag
  onConnect: OnConnect
  onPaneClick: () => void
  onSelectionChange: OnSelectionChangeFunc
  fitViewRef: (fn: () => void) => void
  flyToNodeRef: (fn: (nodeId: string) => void) => void
}

const NODE_W = 176, NODE_H = 80

export function TopologyCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onNodeClick,
  onNodeDragStart,
  onNodeDragStop,
  onConnect,
  onPaneClick,
  onSelectionChange,
  fitViewRef,
  flyToNodeRef,
}: Props) {
  const { setCenter, getNode } = useReactFlow()

  const onInit = useCallback(
    (instance: { fitView: () => void }) => {
      fitViewRef(instance.fitView)
      flyToNodeRef((nodeId: string) => {
        const node = getNode(nodeId)
        if (!node) return
        setCenter(
          node.position.x + NODE_W / 2,
          node.position.y + NODE_H / 2,
          { zoom: 1.3, duration: 500 },
        )
      })
    },
    [fitViewRef, flyToNodeRef, getNode, setCenter],
  )

  return (
    <div style={{ height: '100%', width: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onNodeDragStart={onNodeDragStart}
        onNodeDragStop={onNodeDragStop}
        onConnect={onConnect}
        onPaneClick={onPaneClick}
        onSelectionChange={onSelectionChange}
        onInit={onInit as never}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        className="bg-background"
        defaultEdgeOptions={{
          type: 'custom',
          markerEnd: { type: 'arrowclosed' as never, width: 14, height: 14 },
          style: { strokeWidth: 2 },
        }}
        proOptions={{ hideAttribution: true }}
        minZoom={0.1}
        maxZoom={2}
        elevateEdgesOnSelect
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1.2}
          className="opacity-20"
        />
        <Controls
          className="!bg-card !border-border !text-foreground [&>button]:!bg-card [&>button]:!border-border [&>button]:!text-foreground"
          showInteractive={false}
        />
        <MiniMap
          nodeColor={miniMapNodeColor}
          maskColor="hsl(var(--background) / 0.7)"
          className="!bg-card !border !border-border"
          style={{ height: 100, width: 150 }}
          pannable
          zoomable
        />
      </ReactFlow>
    </div>
  )
}
