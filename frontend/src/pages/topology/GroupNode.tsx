import { NodeResizer, type NodeProps } from '@xyflow/react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { NetworkGroupDto } from '@/hooks/useTopology'

export interface GroupNodeData {
  group: NetworkGroupDto
  onToggleCollapse: (id: number) => void
}

export function GroupNode({ data, selected }: NodeProps) {
  const d = data as unknown as GroupNodeData
  const group = d.group

  return (
    <div className="relative h-full w-full rounded" style={{ border: `2px solid ${group.color}` }}>
      <NodeResizer
        minWidth={180}
        minHeight={80}
        isVisible={selected}
        lineStyle={{ borderColor: group.color }}
        handleStyle={{ borderColor: group.color, background: group.color }}
      />
      <div
        className="flex items-center gap-1 px-2 py-1 text-xs font-semibold"
        style={{ color: group.color }}
      >
        <button
          className="flex items-center gap-1 hover:opacity-70"
          onClick={() => d.onToggleCollapse(group.id)}
        >
          {group.collapsed
            ? <ChevronRight className="h-3 w-3" />
            : <ChevronDown className="h-3 w-3" />}
          {group.name}
        </button>
      </div>
    </div>
  )
}
