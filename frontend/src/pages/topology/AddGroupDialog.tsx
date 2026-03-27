import { useState } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { CreateGroupInput } from '@/hooks/useTopology'

const PRESET_COLORS = ['#3b82f6', '#22c55e', '#f97316', '#ef4444', '#a855f7', '#64748b', '#0ea5e9', '#eab308']

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSubmit: (data: CreateGroupInput) => void
  loading?: boolean
}

export function AddGroupDialog({ open, onOpenChange, onSubmit, loading }: Props) {
  const [name, setName] = useState('')
  const [color, setColor] = useState('#64748b')
  const [layerOrder, setLayerOrder] = useState(0)

  function reset() { setName(''); setColor('#64748b'); setLayerOrder(0) }

  function handleSubmit() {
    if (!name.trim()) return
    onSubmit({ name: name.trim(), color, layerOrder })
    reset()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={v => { onOpenChange(v); if (!v) reset() }}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle>Gruppe erstellen</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Name *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="z.B. Produktion" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Farbe</Label>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  className="h-6 w-6 rounded-full border-2 transition-all"
                  style={{
                    background: c,
                    borderColor: color === c ? 'white' : 'transparent',
                    boxShadow: color === c ? `0 0 0 2px ${c}` : 'none',
                  }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Schicht (Layer-Reihenfolge)</Label>
            <Input
              type="number"
              value={layerOrder}
              onChange={e => setLayerOrder(Number(e.target.value))}
              className="h-8 text-xs"
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" size="sm">Abbrechen</Button>
          </DialogClose>
          <Button size="sm" onClick={handleSubmit} disabled={!name.trim() || loading}>
            {loading ? 'Erstellt…' : 'Erstellen'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
