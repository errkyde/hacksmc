import { useState } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useNetworkScan } from '@/hooks/useAdmin'
import { inferDeviceType } from '@/hooks/useTopology'
import type { ScannedHost } from '@/hooks/useAdmin'

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  onImport: (devices: ScannedHost[]) => void
  importLoading?: boolean
}

const TYPE_COLORS: Record<string, string> = {
  HOST: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  ROUTER: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  FIREWALL: 'bg-red-500/20 text-red-400 border-red-500/30',
  SWITCH: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  PRINTER: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  UNKNOWN: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
}

export function ScanImportDialog({ open, onOpenChange, onImport, importLoading }: Props) {
  const [subnet, setSubnet] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const networkScan = useNetworkScan()

  const results = networkScan.data ?? []

  function handleScan() {
    if (!subnet.trim()) return
    networkScan.mutate(subnet.trim(), {
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
    onImport(toImport)
    onOpenChange(false)
  }

  function reset() {
    setSubnet('')
    setSelected(new Set())
    networkScan.reset()
  }

  return (
    <Dialog open={open} onOpenChange={v => { onOpenChange(v); if (!v) reset() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Netzwerk-Scan &amp; Import</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Subnetz (CIDR)</Label>
              <Input
                value={subnet}
                onChange={e => setSubnet(e.target.value)}
                placeholder="192.168.1.0/24"
                onKeyDown={e => e.key === 'Enter' && handleScan()}
              />
            </div>
            <Button
              className="self-end"
              onClick={handleScan}
              disabled={!subnet.trim() || networkScan.isPending}
            >
              {networkScan.isPending ? 'Scannt…' : 'Scannen'}
            </Button>
          </div>

          {results.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {results.length} Geräte gefunden
                </span>
                <button className="text-xs text-primary hover:underline" onClick={toggleAll}>
                  {selected.size === results.length ? 'Alle abwählen' : 'Alle auswählen'}
                </button>
              </div>
              <div className="max-h-56 overflow-y-auto space-y-1 rounded border p-2">
                {results.map(h => {
                  const type = inferDeviceType(h.ipAddress, h.openPorts ?? [])
                  return (
                    <label key={h.ipAddress} className="flex items-center gap-2 cursor-pointer rounded px-1 py-0.5 hover:bg-muted/50">
                      <input
                        type="checkbox"
                        checked={selected.has(h.ipAddress)}
                        onChange={() => toggleOne(h.ipAddress)}
                        className="h-3.5 w-3.5"
                      />
                      <span className="flex-1 text-xs">
                        {h.ipAddress}
                        {h.hostname && <span className="ml-1 text-muted-foreground">({h.hostname})</span>}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{h.latencyMs}ms</span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1 py-0 ${TYPE_COLORS[type] ?? TYPE_COLORS.UNKNOWN}`}
                      >
                        {type}
                      </Badge>
                    </label>
                  )
                })}
              </div>
            </div>
          )}

          {networkScan.isError && (
            <p className="text-xs text-destructive">Scan fehlgeschlagen. Subnetz prüfen.</p>
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
            {importLoading ? 'Importiert…' : `${selected.size} importieren`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
