import { Scan, Download, Plus, Maximize2, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  isAdmin: boolean
  onScanClick: () => void
  onArpClick: () => void
  onAddDevice: () => void
  onFitView: () => void
  onReset: () => void
  arpLoading?: boolean
}

export function TopologyToolbar({
  isAdmin,
  onScanClick,
  onArpClick,
  onAddDevice,
  onFitView,
  onReset,
  arpLoading,
}: Props) {
  return (
    <div className="flex items-center gap-2 border-b bg-background px-4 py-2">
      <span className="text-sm font-semibold tracking-wide">Netzwerk-Topologie</span>
      <div className="ml-auto flex items-center gap-2">
        {isAdmin && (
          <>
            <Button size="sm" variant="outline" onClick={onScanClick}>
              <Scan className="mr-1 h-3.5 w-3.5" />
              Scan
            </Button>
            <Button size="sm" variant="outline" onClick={onArpClick} disabled={arpLoading}>
              <Download className="mr-1 h-3.5 w-3.5" />
              {arpLoading ? 'Lädt…' : 'ARP Import'}
            </Button>
            <Button size="sm" variant="outline" onClick={onAddDevice}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              Gerät
            </Button>
          </>
        )}
        <Button size="sm" variant="ghost" onClick={onFitView} title="Fit view">
          <Maximize2 className="h-3.5 w-3.5" />
        </Button>
        <Button size="sm" variant="ghost" onClick={onReset} title="Reset">
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}
