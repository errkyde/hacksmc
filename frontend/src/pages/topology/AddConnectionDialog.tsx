import { useState } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import type { NetworkDeviceDto, CreateConnectionInput } from '@/hooks/useTopology'

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  devices: NetworkDeviceDto[]
  preselectedSourceId?: number
  onSubmit: (data: CreateConnectionInput) => void
  loading?: boolean
}

export function AddConnectionDialog({
  open,
  onOpenChange,
  devices,
  preselectedSourceId,
  onSubmit,
  loading,
}: Props) {
  const [sourceId, setSourceId] = useState<string>(
    preselectedSourceId ? String(preselectedSourceId) : '',
  )
  const [targetId, setTargetId] = useState('')
  const [protocol, setProtocol] = useState('TCP')
  const [portStart, setPortStart] = useState('')
  const [portEnd, setPortEnd] = useState('')
  const [label, setLabel] = useState('')

  function reset() {
    setSourceId(preselectedSourceId ? String(preselectedSourceId) : '')
    setTargetId(''); setProtocol('TCP'); setPortStart(''); setPortEnd(''); setLabel('')
  }

  function handleSubmit() {
    if (!sourceId || !targetId) return
    const data: CreateConnectionInput = {
      sourceDeviceId: Number(sourceId),
      targetDeviceId: Number(targetId),
    }
    if (protocol) data.protocol = protocol
    if (portStart) data.portStart = Number(portStart)
    if (portEnd) data.portEnd = Number(portEnd)
    else if (portStart) data.portEnd = Number(portStart)
    if (label.trim()) data.label = label.trim()
    onSubmit(data)
    reset()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={v => { onOpenChange(v); if (!v) reset() }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Verbindung erstellen</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Quelle *</Label>
            <Select value={sourceId} onValueChange={setSourceId}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Gerät auswählen" />
              </SelectTrigger>
              <SelectContent>
                {devices.map(d => (
                  <SelectItem key={d.id} value={String(d.id)} className="text-xs">
                    {d.name}{d.ipAddress ? ` (${d.ipAddress})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Ziel *</Label>
            <Select value={targetId} onValueChange={setTargetId}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Gerät auswählen" />
              </SelectTrigger>
              <SelectContent>
                {devices.filter(d => String(d.id) !== sourceId).map(d => (
                  <SelectItem key={d.id} value={String(d.id)} className="text-xs">
                    {d.name}{d.ipAddress ? ` (${d.ipAddress})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Protokoll</Label>
              <Select value={protocol} onValueChange={setProtocol}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TCP" className="text-xs">TCP</SelectItem>
                  <SelectItem value="UDP" className="text-xs">UDP</SelectItem>
                  <SelectItem value="ICMP" className="text-xs">ICMP</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Port von</Label>
              <Input
                type="number"
                min={1}
                max={65535}
                value={portStart}
                onChange={e => setPortStart(e.target.value)}
                placeholder="80"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Port bis</Label>
              <Input
                type="number"
                min={1}
                max={65535}
                value={portEnd}
                onChange={e => setPortEnd(e.target.value)}
                placeholder="80"
                className="h-8 text-xs"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Label (optional)</Label>
            <Input
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="z.B. HTTPS Traffic"
              className="h-8 text-xs"
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" size="sm">Abbrechen</Button>
          </DialogClose>
          <Button size="sm" onClick={handleSubmit} disabled={!sourceId || !targetId || loading}>
            {loading ? 'Erstellt…' : 'Verbinden'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
