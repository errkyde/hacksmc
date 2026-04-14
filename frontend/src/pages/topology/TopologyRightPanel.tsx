import { useState, useEffect } from 'react'
import { X, Trash2, Plus, ExternalLink, Shield, ShieldAlert, Pencil, Check, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import type { NetworkDeviceDto, NetworkConnectionDto, NetworkGroupDto } from '@/hooks/useTopology'

interface Props {
  device: NetworkDeviceDto | null
  connections: NetworkConnectionDto[]
  devices: NetworkDeviceDto[]
  groups: NetworkGroupDto[]
  isAdmin: boolean
  onClose: () => void
  onDeleteDevice: (id: number) => void
  onDeleteConnection: (id: number) => void
  onAddConnection: () => void
  onPatchDevice: (id: number, data: {
    name?: string
    description?: string
    deviceType?: string
    groupId?: number | null
    pfSenseInterface?: string | null
  }) => void
}

const DEVICE_TYPE_LABELS: Record<string, string> = {
  HOST: 'Host', ROUTER: 'Router', FIREWALL: 'Firewall',
  SWITCH: 'Switch', PRINTER: 'Drucker', INTERNET: 'Internet', UNKNOWN: 'Unbekannt',
}
const DEVICE_TYPES = ['HOST', 'ROUTER', 'FIREWALL', 'SWITCH', 'PRINTER', 'INTERNET', 'UNKNOWN']

export function TopologyRightPanel({
  device,
  connections,
  devices,
  groups,
  isAdmin,
  onClose,
  onDeleteDevice,
  onDeleteConnection,
  onAddConnection,
  onPatchDevice,
}: Props) {
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editType, setEditType] = useState('')
  const [editGroupId, setEditGroupId] = useState<string>('none')
  const [editIface, setEditIface] = useState('')

  // Reset edit state when device changes
  useEffect(() => {
    setEditing(false)
  }, [device?.id])

  if (!device) return null
  // Capture narrowed reference so closures below don't re-check null
  const dev = device

  const inbound = connections.filter(c => c.targetDeviceId === dev.id)
  const outbound = connections.filter(c => c.sourceDeviceId === dev.id)

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

  function startEditing() {
    setEditName(dev.name)
    setEditDesc(dev.description ?? '')
    setEditType(dev.deviceType)
    setEditGroupId(dev.groupId != null ? String(dev.groupId) : 'none')
    setEditIface(dev.pfSenseInterface ?? '')
    setEditing(true)
  }

  function cancelEditing() {
    setEditing(false)
  }

  function saveEditing() {
    const patch: Parameters<typeof onPatchDevice>[1] = {}
    if (editName.trim() && editName.trim() !== dev.name) patch.name = editName.trim()
    if (editDesc !== (dev.description ?? '')) patch.description = editDesc
    if (editType !== dev.deviceType) patch.deviceType = editType
    const newGroupId = editGroupId === 'none' ? null : Number(editGroupId)
    if (newGroupId !== dev.groupId) patch.groupId = newGroupId === null ? 0 : newGroupId  // 0 = unassign
    if (editIface !== (dev.pfSenseInterface ?? '')) patch.pfSenseInterface = editIface || null
    if (Object.keys(patch).length > 0) onPatchDevice(dev.id, patch)
    setEditing(false)
  }

  return (
    <div className="flex w-72 shrink-0 flex-col border-l bg-background overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-3 py-2 gap-2">
        <span className="text-sm font-semibold truncate flex-1">{dev.name}</span>
        <div className="flex items-center gap-1 shrink-0">
          {isAdmin && !editing && (
            <button
              onClick={startEditing}
              className="text-muted-foreground hover:text-foreground p-1 rounded"
              title="Gerät bearbeiten"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1 rounded"
            title="Schließen"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* ── Edit mode ─────────────────────────────────────────── */}
        {editing ? (
          <div className="space-y-3 p-3">
            <div className="space-y-1">
              <Label className="text-xs">Name</Label>
              <Input
                value={editName}
                onChange={e => setEditName(e.target.value)}
                className="h-7 text-xs"
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Beschreibung</Label>
              <Input
                value={editDesc}
                onChange={e => setEditDesc(e.target.value)}
                placeholder="Optional"
                className="h-7 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Typ</Label>
              <Select value={editType} onValueChange={setEditType}>
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEVICE_TYPES.map(t => (
                    <SelectItem key={t} value={t} className="text-xs">
                      {DEVICE_TYPE_LABELS[t] ?? t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Gruppe</Label>
              <Select value={editGroupId} onValueChange={setEditGroupId}>
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" className="text-xs">Keine Gruppe</SelectItem>
                  {groups.map(g => (
                    <SelectItem key={g.id} value={String(g.id)} className="text-xs">{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">pfSense Interface</Label>
              <Input
                value={editIface}
                onChange={e => setEditIface(e.target.value)}
                placeholder="z.B. opt1, lan"
                className="h-7 text-xs font-mono"
              />
              <p className="text-[10px] text-muted-foreground">Wird für FW-Regeln verwendet</p>
            </div>
            <div className="flex gap-2 pt-1">
              <Button size="sm" className="flex-1 h-7 text-xs gap-1" onClick={saveEditing} disabled={!editName.trim()}>
                <Check className="h-3 w-3" />
                Speichern
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={cancelEditing}>
                <XCircle className="h-3 w-3" />
                Abbrechen
              </Button>
            </div>
          </div>
        ) : (
          /* ── View mode ─────────────────────────────────────────── */
          <div className="space-y-4 p-3">
            {/* Device info */}
            <div className="space-y-1">
              <Row label="Typ" value={DEVICE_TYPE_LABELS[dev.deviceType] ?? dev.deviceType} />
              {dev.ipAddress && <Row label="IP" value={dev.ipAddress} mono />}
              {dev.macAddress && <Row label="MAC" value={dev.macAddress} mono />}
              {dev.hostname && <Row label="Hostname" value={dev.hostname} />}
              {dev.description && <Row label="Info" value={dev.description} />}
              <Row label="Sichtbarkeit" value={dev.isShared ? 'Alle Nutzer' : 'Nur Admin'} />
              {dev.hostId && (
                <div className="flex items-center gap-1 pt-0.5">
                  <Badge variant="secondary" className="text-[10px]">
                    Verknüpft mit Host #{dev.hostId}
                  </Badge>
                </div>
              )}
              {isAdmin && (
                <div className="flex items-start gap-2 text-xs pt-0.5">
                  <span className="w-20 shrink-0 text-muted-foreground">FW Interface</span>
                  {dev.pfSenseInterface
                    ? <span className="font-mono text-emerald-500 break-all">{dev.pfSenseInterface}</span>
                    : <span className="text-amber-500/80 text-[10px] italic">nicht gesetzt</span>
                  }
                </div>
              )}
              <div className="flex items-start gap-2 text-xs pt-0.5">
                <span className="w-20 shrink-0 text-muted-foreground">Geändert</span>
                <span className="text-[10px] text-muted-foreground/70" title={dev.updatedAt}>
                  {formatRelative(dev.updatedAt)}
                </span>
              </div>
            </div>

            {/* Outbound connections */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Ausgehend ({outbound.length})
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-5 w-5"
                  onClick={onAddConnection}
                  title="Verbindung hinzufügen"
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              {outbound.length === 0 && (
                <p className="text-[11px] text-muted-foreground italic">Keine ausgehenden Verbindungen</p>
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
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Eingehend ({inbound.length})
                </span>
              </div>
              {inbound.length === 0 && (
                <p className="text-[11px] text-muted-foreground italic">Keine eingehenden Verbindungen</p>
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
        )}
      </div>

      {/* Footer: delete */}
      {isAdmin && !editing && (
        <div className="border-t p-2">
          <Button
            size="sm"
            variant="destructive"
            className="w-full h-7 text-xs"
            onClick={() => onDeleteDevice(dev.id)}
          >
            <Trash2 className="mr-1 h-3.5 w-3.5" />
            Gerät löschen
          </Button>
        </div>
      )}
    </div>
  )
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'gerade eben'
  if (mins < 60) return `vor ${mins} Min.`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `vor ${hours} Std.`
  const days = Math.floor(hours / 24)
  if (days < 7) return `vor ${days} Tag${days !== 1 ? 'en' : ''}`
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex gap-2 text-xs">
      <span className="w-20 shrink-0 text-muted-foreground">{label}</span>
      <span className={`break-all ${mono ? 'font-mono text-[10px]' : ''}`}>{value}</span>
    </div>
  )
}

function ConnectionRow({
  label, peer, status, natRuleId, firewallRuleId, onDelete, isAdmin,
}: {
  label: string; peer: string; status: string
  natRuleId: number | null; firewallRuleId: string | null
  onDelete: () => void; isAdmin: boolean
}) {
  const statusColor = status === 'OK' ? '#22c55e' : status === 'ISSUE' ? '#ef4444' : '#64748b'
  return (
    <div className="flex items-center gap-1.5 py-1 text-[11px] group border-b border-border/30 last:border-0">
      <div className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: statusColor }} />
      <span className="flex-1 truncate">
        <span className="font-medium">{peer}</span>
        <span className="text-muted-foreground ml-1">({label})</span>
      </span>
      {firewallRuleId ? (
        <span title="Firewall-Regel aktiv">
          <Shield className="h-3 w-3 text-emerald-500 shrink-0" aria-label="FW-Regel aktiv" />
        </span>
      ) : status === 'ISSUE' ? (
        <span title="Keine Firewall-Regel">
          <ShieldAlert className="h-3 w-3 text-destructive shrink-0" aria-label="Keine FW-Regel" />
        </span>
      ) : null}
      {natRuleId && (
        <span title={`NAT-Regel #${natRuleId}`}>
          <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" aria-label={`NAT #${natRuleId}`} />
        </span>
      )}
      {isAdmin && (
        <button
          className="hidden group-hover:flex text-destructive hover:opacity-70 shrink-0"
          onClick={onDelete}
          title="Verbindung löschen"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}
