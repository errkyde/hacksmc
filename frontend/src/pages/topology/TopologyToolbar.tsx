import { useState } from 'react'
import {
  Scan, Download, Plus, Maximize2, RotateCcw, GitMerge, Shield,
  LayoutDashboard, Map, ArrowDownUp, ArrowRightLeft, Users,
  Zap, ChevronDown, ChevronUp, Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Animated step indicator shown while auto-scan runs
const AUTO_SCAN_STEPS = ['ARP', 'NAT', 'FW', 'Inference', 'Grouping', 'Layout']

interface Props {
  isAdmin: boolean
  showLegend: boolean
  onToggleLegend: () => void
  onAutoScanClick: () => void
  onScanClick: () => void
  onArpClick: () => void
  onNatImportClick: () => void
  onFirewallImportClick: () => void
  onAddDevice: () => void
  onFitView: () => void
  onReset: () => void
  onAutoLayout: () => void
  layoutDirection: 'TB' | 'LR'
  onToggleLayoutDirection: () => void
  onlineCount: number | null
  autoScanLoading?: boolean
  arpLoading?: boolean
  natImportLoading?: boolean
  firewallImportLoading?: boolean
}

export function TopologyToolbar({
  isAdmin,
  showLegend,
  onToggleLegend,
  onAutoScanClick,
  onScanClick,
  onArpClick,
  onNatImportClick,
  onFirewallImportClick,
  onAddDevice,
  onFitView,
  onReset,
  onAutoLayout,
  layoutDirection,
  onToggleLayoutDirection,
  onlineCount,
  autoScanLoading,
  arpLoading,
  natImportLoading,
  firewallImportLoading,
}: Props) {
  const [showManual, setShowManual] = useState(false)

  return (
    <div className="flex items-center gap-1 border-b bg-background px-3 py-1.5">
      <span className="text-sm font-semibold tracking-wide mr-2">Netzwerk-Topologie</span>

      {/* Separator */}
      <div className="h-4 w-px bg-border mx-1" />

      {isAdmin && (
        <>
          {/* ── Primary: Auto Scan ─────────────────────────────────────────── */}
          <Button
            size="sm"
            variant="default"
            className={cn(
              'h-7 text-xs gap-1.5 relative',
              autoScanLoading && 'opacity-80 cursor-not-allowed',
            )}
            onClick={onAutoScanClick}
            disabled={autoScanLoading}
            title="Vollautomatische Netzwerk-Erkennung: ARP → Verbindungen → Topologie-Inferenz → Gruppierung → Layout"
          >
            {autoScanLoading
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Zap className="h-3.5 w-3.5" />
            }
            {autoScanLoading ? 'Scanning…' : 'Auto Scan'}
          </Button>

          {/* Auto-scan step pills (visible while scanning) */}
          {autoScanLoading && (
            <div className="flex items-center gap-0.5 ml-1">
              {AUTO_SCAN_STEPS.map((step, i) => (
                <span
                  key={step}
                  className="text-[9px] px-1 py-0.5 rounded border border-border text-muted-foreground animate-pulse"
                  style={{ animationDelay: `${i * 200}ms` }}
                >
                  {step}
                </span>
              ))}
            </div>
          )}

          <div className="h-4 w-px bg-border mx-1" />

          {/* ── Secondary: Manual import buttons (collapsible) ─────────────── */}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs gap-1"
            onClick={() => setShowManual(v => !v)}
            title="Manuelle Import-Optionen ein-/ausblenden"
          >
            {showManual ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            Manuell
          </Button>

          {showManual && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1.5"
                onClick={onScanClick}
                title="Netzwerk-CIDR scannen und Geräte importieren"
              >
                <Scan className="h-3.5 w-3.5" />
                Scan
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1.5"
                onClick={onArpClick}
                disabled={arpLoading}
                title="ARP-Tabelle von pfSense importieren (Geräte + VLAN-Gruppen)"
              >
                <Download className="h-3.5 w-3.5" />
                {arpLoading ? 'ARP…' : 'ARP'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1.5"
                onClick={onNatImportClick}
                disabled={natImportLoading}
                title="NAT Port-Forward-Regeln aus pfSense als Verbindungen importieren"
              >
                <GitMerge className="h-3.5 w-3.5" />
                {natImportLoading ? 'NAT…' : 'NAT'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1.5"
                onClick={onFirewallImportClick}
                disabled={firewallImportLoading}
                title="Firewall-Pass-Regeln aus pfSense als Verbindungen importieren"
              >
                <Shield className="h-3.5 w-3.5" />
                {firewallImportLoading ? 'FW…' : 'FW'}
              </Button>

              <div className="h-4 w-px bg-border mx-1" />
            </>
          )}

          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1.5"
            onClick={onAddDevice}
            title="Gerät manuell hinzufügen"
          >
            <Plus className="h-3.5 w-3.5" />
            Gerät
          </Button>
        </>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Online presence */}
      {onlineCount != null && (
        <div
          className="flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground"
          title={`${onlineCount} aktive Sitzung${onlineCount !== 1 ? 'en' : ''}`}
        >
          <Users className="h-3 w-3" />
          {onlineCount}
        </div>
      )}

      {/* View controls */}
      <Button
        size="sm"
        variant={showLegend ? 'secondary' : 'ghost'}
        className="h-7 text-xs gap-1.5"
        onClick={onToggleLegend}
        title="Legende ein-/ausblenden"
      >
        <Map className="h-3.5 w-3.5" />
        Legende
      </Button>
      {isAdmin && (
        <>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs gap-1.5"
            onClick={onAutoLayout}
            title="Geräte automatisch anordnen (Dagre hierarchisch)"
          >
            <LayoutDashboard className="h-3.5 w-3.5" />
            Layout
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={onToggleLayoutDirection}
            title={layoutDirection === 'TB' ? 'Richtung: oben→unten (klicken für links→rechts)' : 'Richtung: links→rechts (klicken für oben→unten)'}
          >
            {layoutDirection === 'TB'
              ? <ArrowDownUp className="h-3.5 w-3.5" />
              : <ArrowRightLeft className="h-3.5 w-3.5" />}
          </Button>
        </>
      )}
      <Button
        size="sm"
        variant="ghost"
        className="h-7 px-2"
        onClick={onFitView}
        title="Alle Geräte einpassen"
      >
        <Maximize2 className="h-3.5 w-3.5" />
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="h-7 px-2"
        onClick={onReset}
        title="Auswahl und Filter zurücksetzen"
      >
        <RotateCcw className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}
