import { Scan, Download, Plus, Maximize2, RotateCcw, GitMerge, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  isAdmin: boolean
  onScanClick: () => void
  onArpClick: () => void
  onNatImportClick: () => void
  onFirewallImportClick: () => void
  onAddDevice: () => void
  onFitView: () => void
  onReset: () => void
  arpLoading?: boolean
  natImportLoading?: boolean
  firewallImportLoading?: boolean
}

export function TopologyToolbar({
  isAdmin,
  onScanClick,
  onArpClick,
  onNatImportClick,
  onFirewallImportClick,
  onAddDevice,
  onFitView,
  onReset,
  arpLoading,
  natImportLoading,
  firewallImportLoading,
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
            <Button size="sm" variant="outline" onClick={onNatImportClick} disabled={natImportLoading}
              title="Alle NAT Port-Forward-Regeln aus pfSense importieren">
              <GitMerge className="mr-1 h-3.5 w-3.5" />
              {natImportLoading ? 'Lädt…' : 'NAT Import'}
            </Button>
            <Button size="sm" variant="outline" onClick={onFirewallImportClick} disabled={firewallImportLoading}
              title="Alle Firewall-Pass-Regeln aus pfSense importieren (nur anzeigen)">
              <Shield className="mr-1 h-3.5 w-3.5" />
              {firewallImportLoading ? 'Lädt…' : 'FW Import'}
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
