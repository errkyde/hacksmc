import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Server, Shield, Network, Globe, HelpCircle, Printer, Router, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { NetworkDeviceDto, DeviceType } from '@/hooks/useTopology'

const TYPE_CONFIG: Record<DeviceType, { color: string; Icon: LucideIcon }> = {
  HOST:     { color: '#3b82f6', Icon: Server },
  ROUTER:   { color: '#f97316', Icon: Router },
  FIREWALL: { color: '#ef4444', Icon: Shield },
  SWITCH:   { color: '#a855f7', Icon: Network },
  PRINTER:  { color: '#6b7280', Icon: Printer },
  INTERNET: { color: '#1e293b', Icon: Globe },
  UNKNOWN:  { color: '#64748b', Icon: HelpCircle },
}

export interface DeviceNodeData {
  device: NetworkDeviceDto
  selected?: boolean
  dimmed?: boolean
}

export function DeviceNode({ data, selected }: NodeProps) {
  const d = data as unknown as DeviceNodeData
  const device = d.device
  const cfg = TYPE_CONFIG[device.deviceType as DeviceType] ?? TYPE_CONFIG.UNKNOWN
  const { Icon } = cfg

  return (
    <div
      className={cn(
        'relative flex items-center gap-2 rounded border bg-card px-3 py-2 shadow-sm transition-opacity',
        'w-[160px]',
        selected && 'ring-2 ring-primary',
        d.dimmed && 'opacity-20',
      )}
      style={{ borderLeftWidth: 4, borderLeftColor: cfg.color }}
    >
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-muted-foreground" />
      <Icon className="h-4 w-4 shrink-0" style={{ color: cfg.color }} />
      <div className="min-w-0">
        <p className="truncate text-xs font-medium leading-tight">{device.name}</p>
        {device.ipAddress && (
          <p className="truncate text-[10px] text-muted-foreground leading-tight">{device.ipAddress}</p>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-muted-foreground" />
    </div>
  )
}
