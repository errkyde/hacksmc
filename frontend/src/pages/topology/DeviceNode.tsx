import { Handle, Position, type NodeProps } from '@xyflow/react'
import {
  Server, Shield, Network, Globe, HelpCircle, Printer, Router,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { NetworkDeviceDto, DeviceType } from '@/hooks/useTopology'

const TYPE_CONFIG: Record<DeviceType, { color: string; bg: string; Icon: LucideIcon; label: string }> = {
  HOST:     { color: '#3b82f6', bg: '#3b82f615', Icon: Server,     label: 'Host' },
  ROUTER:   { color: '#f97316', bg: '#f9731615', Icon: Router,     label: 'Router' },
  FIREWALL: { color: '#ef4444', bg: '#ef444415', Icon: Shield,     label: 'Firewall' },
  SWITCH:   { color: '#a855f7', bg: '#a855f715', Icon: Network,    label: 'Switch' },
  PRINTER:  { color: '#6b7280', bg: '#6b728015', Icon: Printer,    label: 'Drucker' },
  INTERNET: { color: '#64748b', bg: '#64748b15', Icon: Globe,      label: 'Internet' },
  UNKNOWN:  { color: '#64748b', bg: '#64748b15', Icon: HelpCircle, label: 'Unbekannt' },
}

export type ConnStatus = 'ok' | 'nat' | 'issue' | 'none'

export interface DeviceNodeData {
  device: NetworkDeviceDto
  selected?: boolean
  dimmed?: boolean
  groupColor?: string
  highlighted?: boolean
  connStatus?: ConnStatus
}

export function DeviceNode({ data, selected }: NodeProps) {
  const d = data as unknown as DeviceNodeData
  const device = d.device
  const cfg = TYPE_CONFIG[device.deviceType as DeviceType] ?? TYPE_CONFIG.UNKNOWN
  const { Icon, color, bg } = cfg

  const statusDot = d.connStatus && d.connStatus !== 'none' ? (
    d.connStatus === 'issue' ? { bg: '#ef4444', title: 'Verbindungsproblem' }
    : d.connStatus === 'nat'   ? { bg: '#22c55e', title: 'NAT-Regel aktiv' }
    :                            { bg: '#64748b', title: 'Verbunden' }
  ) : null

  return (
    <div
      className={cn(
        'group relative flex items-center gap-2.5 rounded-lg border bg-card shadow-sm',
        'w-[176px] px-3 py-2.5 transition-all duration-200',
        selected && 'ring-2 ring-primary shadow-md',
        d.highlighted && 'ring-2 ring-amber-400 shadow-amber-400/30 shadow-md',
        d.dimmed && 'opacity-15 pointer-events-none',
      )}
      style={{
        borderLeftWidth: 3,
        borderLeftColor: color,
        backgroundColor: selected ? bg : undefined,
      }}
    >
      {/* Target handle — invisible until node is hovered, then shows as a clear drop zone */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !opacity-0 group-hover:!opacity-100 !bg-primary !border-2 !border-background !transition-opacity !duration-150"
        title="Verbindung hierher ziehen"
      />

      {/* Icon badge */}
      <div
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded"
        style={{ background: bg, border: `1px solid ${color}30` }}
      >
        <Icon className="h-3.5 w-3.5" style={{ color }} />
      </div>

      {/* Text content */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-semibold leading-tight text-foreground">
          {device.name}
        </p>
        {device.ipAddress ? (
          <p className="truncate font-mono text-[9px] text-muted-foreground leading-tight mt-0.5">
            {device.ipAddress}
          </p>
        ) : device.hostname ? (
          <p className="truncate text-[9px] text-muted-foreground leading-tight mt-0.5 italic">
            {device.hostname}
          </p>
        ) : null}
      </div>

      {/* Group color dot (top-right) */}
      {d.groupColor && (
        <span
          className="absolute right-1.5 top-1 h-2 w-2 rounded-full shrink-0 ring-1 ring-background"
          style={{ background: d.groupColor }}
          title="Gruppe"
        />
      )}

      {/* Connection status dot (bottom-left) */}
      {statusDot && (
        <span
          className="absolute bottom-1 left-1.5 h-1.5 w-1.5 rounded-full ring-1 ring-background"
          style={{ background: statusDot.bg }}
          title={statusDot.title}
        />
      )}

      {/* Shared indicator (bottom-right) */}
      {device.isShared && (
        <span
          className="absolute bottom-1 right-1.5 text-[8px] text-muted-foreground/60 font-mono"
          title="Für alle sichtbar"
        >
          ⊕
        </span>
      )}

      {/* Source handle — visible hint on hover: drag from here to create connections */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !opacity-0 group-hover:!opacity-100 !bg-emerald-500 !border-2 !border-background !transition-opacity !duration-150"
        title="Verbindung ziehen"
      />
    </div>
  )
}
