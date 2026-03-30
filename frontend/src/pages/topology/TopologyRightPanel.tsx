import { X, Trash2, Plus, ExternalLink, Shield, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { NetworkDeviceDto, NetworkConnectionDto } from '@/hooks/useTopology'

interface Props {
  device: NetworkDeviceDto | null
  connections: NetworkConnectionDto[]
  devices: NetworkDeviceDto[]
  isAdmin: boolean
  onClose: () => void
  onDeleteDevice: (id: number) => void
  onDeleteConnection: (id: number) => void
  onAddConnection: () => void
}

const DEVICE_TYPE_LABELS: Record<string, string> = {
  HOST: 'Host',
  ROUTER: 'Router',
  FIREWALL: 'Firewall',
  SWITCH: 'Switch',
  PRINTER: 'Drucker',
  INTERNET: 'Internet',
  UNKNOWN: 'Unbekannt',
}

export function TopologyRightPanel({
  device,
  connections,
  devices,
  isAdmin,
  onClose,
  onDeleteDevice,
  onDeleteConnection,
  onAddConnection,
}: Props) {
  if (!device) return null

  const inbound = connections.filter(c => c.targetDeviceId === device.id)
  const outbound = connections.filter(c => c.sourceDeviceId === device.id)

  function getDeviceName(id: number) {
    return devices.find(d => d.id === id)?.name ?? `#${id}`
  }

  function connectionLabel(c: NetworkConnectionDto) {
    if (c.label) return c.label
    if (c.protocol && c.portStart) {
      return `${c.protocol}:${c.portStart}${c.portEnd && c.portEnd !== c.portStart ? `-${c.portEnd}` : ''}`
    }
    return 'Verbindung'
  }

  return (
    <div className="flex w-72 shrink-0 flex-col border-l bg-background overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-2">
        <span className="text-sm font-semibold truncate">{device.name}</span>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 space-y-4 p-4">
        {/* Device info */}
        <div className="space-y-1.5">
          <Row label="Typ" value={DEVICE_TYPE_LABELS[device.deviceType] ?? device.deviceType} />
          {device.ipAddress && <Row label="IP" value={device.ipAddress} />}
          {device.macAddress && <Row label="MAC" value={device.macAddress} />}
          {device.hostname && <Row label="Hostname" value={device.hostname} />}
          {device.description && <Row label="Beschreibung" value={device.description} />}
          <Row label="Geteilt" value={device.isShared ? 'Ja' : 'Nein'} />
          {device.hostId && (
            <div className="flex items-center gap-1">
              <Badge variant="secondary" className="text-[10px]">Verknüpft mit Host #{device.hostId}</Badge>
            </div>
          )}
          {isAdmin && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">FW Interface</span>
              {device.pfSenseInterface
                ? <span className="font-mono text-emerald-500">{device.pfSenseInterface}</span>
                : <span className="text-amber-500 font-mono">nicht gesetzt — FW-Regeln inaktiv</span>
              }
            </div>
          )}
        </div>

        {/* Outbound connections */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Ausgehend ({outbound.length})
            </span>
            <Button size="icon" variant="ghost" className="h-5 w-5" onClick={onAddConnection} title="Verbindung hinzufügen">
              <Plus className="h-3 w-3" />
            </Button>
          </div>
          {outbound.length === 0 && (
            <p className="text-xs text-muted-foreground">Keine ausgehenden Verbindungen</p>
          )}
          {outbound.map(c => (
            <ConnectionRow
              key={c.id}
              label={connectionLabel(c)}
              peer={getDeviceName(c.targetDeviceId)}
              status={c.status}
              natRuleId={c.natRuleId}
              firewallRuleId={c.firewallRuleId}
              onDelete={() => onDeleteConnection(c.id)}
              isAdmin={isAdmin}
            />
          ))}
        </div>

        {/* Inbound connections */}
        <div>
          <div className="mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Eingehend ({inbound.length})
            </span>
          </div>
          {inbound.length === 0 && (
            <p className="text-xs text-muted-foreground">Keine eingehenden Verbindungen</p>
          )}
          {inbound.map(c => (
            <ConnectionRow
              key={c.id}
              label={connectionLabel(c)}
              peer={getDeviceName(c.sourceDeviceId)}
              status={c.status}
              natRuleId={c.natRuleId}
              firewallRuleId={c.firewallRuleId}
              onDelete={() => onDeleteConnection(c.id)}
              isAdmin={isAdmin}
            />
          ))}
        </div>
      </div>

      {/* Footer actions */}
      {isAdmin && (
        <div className="border-t p-3">
          <Button
            size="sm"
            variant="destructive"
            className="w-full"
            onClick={() => onDeleteDevice(device.id)}
          >
            <Trash2 className="mr-1 h-3.5 w-3.5" />
            Gerät löschen
          </Button>
        </div>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 text-xs">
      <span className="w-24 shrink-0 text-muted-foreground">{label}</span>
      <span className="break-all">{value}</span>
    </div>
  )
}

function ConnectionRow({
  label,
  peer,
  status,
  natRuleId,
  firewallRuleId,
  onDelete,
  isAdmin,
}: {
  label: string
  peer: string
  status: string
  natRuleId: number | null
  firewallRuleId: string | null
  onDelete: () => void
  isAdmin: boolean
}) {
  return (
    <div className="flex items-center gap-1 py-1 text-xs group">
      <div
        className="h-1.5 w-1.5 rounded-full shrink-0"
        style={{ background: status === 'OK' ? '#22c55e' : status === 'ISSUE' ? '#ef4444' : '#64748b' }}
      />
      <span className="flex-1 truncate">
        {peer} <span className="text-muted-foreground">({label})</span>
      </span>
      {firewallRuleId ? (
        <Shield className="h-3 w-3 text-green-500 shrink-0" aria-label="Firewall-Regel aktiv" />
      ) : status === 'ISSUE' ? (
        <ShieldAlert className="h-3 w-3 text-destructive shrink-0" aria-label="Keine Firewall-Regel" />
      ) : null}
      {natRuleId && (
        <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" aria-label={`NAT Rule #${natRuleId}`} />
      )}
      {isAdmin && (
        <button
          className="hidden group-hover:block text-destructive hover:opacity-70 shrink-0"
          onClick={onDelete}
        >
          <Trash2 className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}
