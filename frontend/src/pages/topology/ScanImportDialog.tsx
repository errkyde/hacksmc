import { useState } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useNetworkScan } from '@/hooks/useAdmin'
import { inferDeviceType } from '@/hooks/useTopology'
import type { ScannedHost } from '@/hooks/useAdmin'
import type { NetworkGroupDto } from '@/hooks/useTopology'

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  groups: NetworkGroupDto[]
  onImport: (devices: ScannedHost[], targetGroupId?: number | null) => void
  importLoading?: boolean
}

const TYPE_COLORS: Record<string, string> = {
  HOST:     'bg-blue-500/20 text-blue-400 border-blue-500/30',
  ROUTER:   'bg-orange-500/20 text-orange-400 border-orange-500/30',
  FIREWALL: 'bg-red-500/20 text-red-400 border-red-500/30',
  SWITCH:   'bg-purple-500/20 text-purple-400 border-purple-500/30',
  PRINTER:  'bg-gray-500/20 text-gray-400 border-gray-500/30',
  INTERNET: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  UNKNOWN:  'bg-slate-500/20 text-slate-400 border-slate-500/30',
}

const TYPE_LABELS: Record<string, string> = {
  HOST: 'Host', ROUTER: 'Router', FIREWALL: 'Firewall',
  SWITCH: 'Switch', PRINTER: 'Drucker', INTERNET: 'Internet', UNKNOWN: '?',
}

const COMMON_PORTS: Record<number, string> = {
  22: 'SSH', 23: 'Telnet', 25: 'SMTP', 53: 'DNS',
  80: 'HTTP', 110: 'POP3', 143: 'IMAP', 161: 'SNMP',
  443: 'HTTPS', 445: 'SMB', 587: 'SMTP', 631: 'IPP',
  3389: 'RDP', 8080: 'HTTP-Alt', 9100: 'Drucker',
}

function portLabel(port: number) {
  return COMMON_PORTS[port] ? `${COMMON_PORTS[port]}` : `${port}`
}

export function ScanImportDialog({ open, onOpenChange, groups, onImport, importLoading }: Props) {
  const [subnet, setSubnet] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [targetGroupId, setTargetGroupId] = useState<string>('none')
  const networkScan = useNetworkScan()

  const results = networkScan.data ?? []

  // Computed type summary
  const typeCounts = results.reduce<Record<string, number>>((acc, h) => {
    const t = inferDeviceType(h.ipAddress, h.openPorts ?? [])
    acc[t] = (acc[t] ?? 0) + 1
    return acc
  }, {})

  function handleScan() {
    const trimmed = subnet.trim()
    if (!trimmed) return
    networkScan.mutate(trimmed, {
      onSuccess: (data) => setSelected(new Set(data.map(h => h.ipAddress))),
    })
  }

  function toggleAll() {
    if (selected.size === results.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(results.map(h => h.ipAddress)))
    }
  }

  function toggleOne(ip: string) {
    const next = new Set(selected)
    if (next.has(ip)) next.delete(ip)
    else next.add(ip)
    setSelected(next)
  }

  function handleImport() {
    const toImport = results.filter(h => selected.has(h.ipAddress))
    const gid = targetGroupId !== 'none' ? Number(targetGroupId) : null
    onImport(toImport, gid)
    onOpenChange(false)
  }

  function reset() {
    setSubnet('')
    setSelected(new Set())
    setTargetGroupId('none')
    networkScan.reset()
  }

  const isValidCidr = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/.test(subnet.trim())

  return (
    <Dialog open={open} onOpenChange={v => { onOpenChange(v); if (!v) reset() }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Netzwerk-Scan &amp; Import</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Scan input */}
          <div className="flex gap-2 items-end">
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Subnetz (CIDR)</Label>
              <Input
                value={subnet}
                onChange={e => setSubnet(e.target.value)}
                placeholder="192.168.1.0/24"
                onKeyDown={e => e.key === 'Enter' && isValidCidr && handleScan()}
                className={subnet && !isValidCidr ? 'border-destructive' : ''}
              />
              {subnet && !isValidCidr && (
                <p className="text-[10px] text-destructive">Ungültiges CIDR (z.B. 192.168.1.0/24)</p>
              )}
            </div>
            <Button
              onClick={handleScan}
              disabled={!isValidCidr || networkScan.isPending}
            >
              {networkScan.isPending ? (
                <span className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                  Scannt…
                </span>
              ) : 'Scannen'}
            </Button>
          </div>

          {/* Scan hint */}
          {!networkScan.data && !networkScan.isPending && (
            <p className="text-xs text-muted-foreground">
              Scannt erreichbare Hosts via ICMP + TCP-Portscan (22, 80, 161, 443, 3389, 9100).
              Subnetz max. /22 (1024 Hosts).
            </p>
          )}

          {/* Loading bar */}
          {networkScan.isPending && (
            <div className="space-y-1">
              <div className="h-1 bg-muted rounded overflow-hidden">
                <div className="h-full bg-primary animate-pulse rounded" style={{ width: '60%' }} />
              </div>
              <p className="text-xs text-muted-foreground text-center">Scan läuft — bitte warten…</p>
            </div>
          )}

          {/* Error */}
          {networkScan.isError && (
            <div className="rounded border border-destructive/30 bg-destructive/10 px-3 py-2">
              <p className="text-xs text-destructive">
                Scan fehlgeschlagen. Subnetz prüfen oder Serverlog für Details ansehen.
              </p>
            </div>
          )}

          {/* Results */}
          {results.length > 0 && (
            <div className="space-y-2">
              {/* Summary badges */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-muted-foreground font-medium">
                  {results.length} Geräte gefunden:
                </span>
                {Object.entries(typeCounts).map(([type, count]) => (
                  <Badge
                    key={type}
                    variant="outline"
                    className={`text-[10px] px-1.5 py-0 ${TYPE_COLORS[type] ?? TYPE_COLORS.UNKNOWN}`}
                  >
                    {TYPE_LABELS[type] ?? type} ×{count}
                  </Badge>
                ))}
                <button className="text-xs text-primary hover:underline ml-auto" onClick={toggleAll}>
                  {selected.size === results.length ? 'Alle abwählen' : 'Alle auswählen'}
                </button>
              </div>

              {/* Device list */}
              <div className="max-h-52 overflow-y-auto rounded border divide-y divide-border">
                {results.map(h => {
                  const type = inferDeviceType(h.ipAddress, h.openPorts ?? [])
                  const ports = h.openPorts ?? []
                  return (
                    <label
                      key={h.ipAddress}
                      className="flex items-start gap-2 cursor-pointer px-3 py-2 hover:bg-muted/40"
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(h.ipAddress)}
                        onChange={() => toggleOne(h.ipAddress)}
                        className="h-3.5 w-3.5 mt-0.5 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-mono font-medium">{h.ipAddress}</span>
                          {h.hostname && (
                            <span className="text-[10px] text-muted-foreground truncate">
                              {h.hostname}
                            </span>
                          )}
                          {h.latencyMs > 0 && (
                            <span className="text-[10px] text-muted-foreground ml-auto shrink-0">
                              {h.latencyMs}ms
                            </span>
                          )}
                        </div>
                        {ports.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {ports.slice(0, 6).map(p => (
                              <span
                                key={p}
                                className="text-[9px] bg-muted px-1 rounded text-muted-foreground font-mono"
                                title={`Port ${p}`}
                              >
                                {portLabel(p)}
                              </span>
                            ))}
                            {ports.length > 6 && (
                              <span className="text-[9px] text-muted-foreground">+{ports.length - 6}</span>
                            )}
                          </div>
                        )}
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-[9px] px-1.5 py-0 shrink-0 ${TYPE_COLORS[type] ?? TYPE_COLORS.UNKNOWN}`}
                      >
                        {TYPE_LABELS[type] ?? type}
                      </Badge>
                    </label>
                  )
                })}
              </div>

              {/* Target group */}
              <div className="space-y-1">
                <Label className="text-xs">Zielgruppe für Import</Label>
                <Select value={targetGroupId} onValueChange={setTargetGroupId}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Keine Gruppe" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="text-xs">Keine Gruppe</SelectItem>
                    {groups.map(g => (
                      <SelectItem key={g.id} value={String(g.id)} className="text-xs">
                        {g.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">
                  Neu importierte Geräte werden dieser Gruppe zugewiesen. Bereits bekannte IPs werden aktualisiert.
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" size="sm">Schließen</Button>
          </DialogClose>
          <Button
            size="sm"
            onClick={handleImport}
            disabled={selected.size === 0 || importLoading}
          >
            {importLoading
              ? <span className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
                  Importiert…
                </span>
              : `${selected.size} Gerät${selected.size !== 1 ? 'e' : ''} importieren`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
