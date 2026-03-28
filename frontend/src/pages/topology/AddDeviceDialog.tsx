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
import type { NetworkGroupDto, CreateDeviceInput } from '@/hooks/useTopology'

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  groups: NetworkGroupDto[]
  onSubmit: (data: CreateDeviceInput) => void
  loading?: boolean
}

const DEVICE_TYPES = ['HOST', 'ROUTER', 'FIREWALL', 'SWITCH', 'PRINTER', 'INTERNET', 'UNKNOWN']

export function AddDeviceDialog({ open, onOpenChange, groups, onSubmit, loading }: Props) {
  const [name, setName] = useState('')
  const [ip, setIp] = useState('')
  const [mac, setMac] = useState('')
  const [type, setType] = useState('HOST')
  const [groupId, setGroupId] = useState<string>('none')
  const [description, setDescription] = useState('')
  const [isShared, setIsShared] = useState(false)

  const ipValid = ip.trim() === '' || /^(\d{1,3}\.){3}\d{1,3}$/.test(ip.trim())

  function reset() {
    setName(''); setIp(''); setMac(''); setType('HOST')
    setGroupId('none'); setDescription(''); setIsShared(false)
  }

  function handleSubmit() {
    if (!name.trim() || !ipValid) return
    onSubmit({
      name: name.trim(),
      ipAddress: ip.trim() || undefined,
      macAddress: mac.trim() || undefined,
      description: description.trim() || undefined,
      deviceType: type,
      groupId: groupId !== 'none' ? Number(groupId) : null,
      isShared,
    })
    reset()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={v => { onOpenChange(v); if (!v) reset() }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Gerät hinzufügen</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Name *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="z.B. Firewall-01" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">IP-Adresse</Label>
              <Input
                value={ip}
                onChange={e => setIp(e.target.value)}
                placeholder="192.168.1.1"
                className={!ipValid ? 'border-destructive' : ''}
              />
              {!ipValid && <p className="text-[10px] text-destructive">Ungültige IP-Adresse</p>}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">MAC-Adresse</Label>
              <Input value={mac} onChange={e => setMac(e.target.value)} placeholder="aa:bb:cc:dd:ee:ff" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Typ</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DEVICE_TYPES.map(t => (
                  <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Gruppe</Label>
            <Select value={groupId} onValueChange={setGroupId}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Keine Gruppe" />
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
            <Label className="text-xs">Beschreibung</Label>
            <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional" />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="shared"
              checked={isShared}
              onChange={e => setIsShared(e.target.checked)}
              className="h-3.5 w-3.5"
            />
            <Label htmlFor="shared" className="text-xs cursor-pointer">Für alle Benutzer sichtbar</Label>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" size="sm">Abbrechen</Button>
          </DialogClose>
          <Button size="sm" onClick={handleSubmit} disabled={!name.trim() || !ipValid || loading}>
            {loading ? 'Speichert…' : 'Hinzufügen'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
