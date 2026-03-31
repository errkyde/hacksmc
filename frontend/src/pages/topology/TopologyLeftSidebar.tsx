import { useState } from 'react'
import { Plus, Trash2, Eye, EyeOff, Ban, ScanLine, ChevronRight, ChevronDown, Pencil } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { NetworkGroupDto, NetworkDeviceDto } from '@/hooks/useTopology'

interface Props {
  groups: NetworkGroupDto[]
  devices: NetworkDeviceDto[]
  search: string
  onSearchChange: (v: string) => void
  isAdmin: boolean
  onAddGroup: () => void
  onDeleteGroup: (id: number) => void
  onToggleHidden: (id: number, hidden: boolean) => void
  onToggleScanBlocked: (id: number, scanBlocked: boolean) => void
  onDeleteDevice: (id: number) => void
  onSelectDevice: (id: number) => void
  focusedGroupId: number | null
  onFocusGroup: (id: number | null) => void
}

export function TopologyLeftSidebar({
  groups,
  devices,
  search,
  onSearchChange,
  isAdmin,
  onAddGroup,
  onDeleteGroup,
  onToggleHidden,
  onToggleScanBlocked,
  onDeleteDevice,
  onSelectDevice,
  focusedGroupId,
  onFocusGroup,
}: Props) {
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set())

  function toggleExpand(id: number) {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Ungrouped devices (no groupId)
  const ungroupedDevices = devices.filter(d => d.groupId == null)

  const searchLower = search.toLowerCase()
  const filterDevice = (d: NetworkDeviceDto) =>
    !search ||
    d.name.toLowerCase().includes(searchLower) ||
    (d.ipAddress ?? '').toLowerCase().includes(searchLower)

  return (
    <div className="flex w-56 shrink-0 flex-col border-r bg-background">
      <div className="border-b px-3 py-2">
        <Input
          placeholder="Suchen…"
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          className="h-7 text-xs"
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Groups header */}
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Gruppen
          </span>
          {isAdmin && (
            <Button size="icon" variant="ghost" className="h-5 w-5" onClick={onAddGroup}>
              <Plus className="h-3 w-3" />
            </Button>
          )}
        </div>

        {/* "Show all" row */}
        <div
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 text-xs cursor-pointer hover:bg-muted/50',
            focusedGroupId === null && 'bg-muted/40 font-medium',
          )}
          onClick={() => onFocusGroup(null)}
        >
          <span className="h-2.5 w-2.5 rounded-full shrink-0 bg-muted-foreground/40" />
          <span className="flex-1 truncate text-muted-foreground">Alle anzeigen</span>
        </div>

        {/* Group rows */}
        {groups.map(g => {
          const groupDevices = devices.filter(d => d.groupId === g.id).filter(filterDevice)
          const isExpanded = expandedGroups.has(g.id)
          return (
            <GroupSection
              key={g.id}
              group={g}
              devices={groupDevices}
              isAdmin={isAdmin}
              focused={focusedGroupId === g.id}
              expanded={isExpanded}
              onToggleExpand={() => toggleExpand(g.id)}
              onFocus={() => onFocusGroup(focusedGroupId === g.id ? null : g.id)}
              onDelete={() => onDeleteGroup(g.id)}
              onToggleHidden={() => onToggleHidden(g.id, !g.hidden)}
              onToggleScanBlocked={() => onToggleScanBlocked(g.id, !g.scanBlocked)}
              onDeleteDevice={onDeleteDevice}
              onSelectDevice={onSelectDevice}
            />
          )
        })}

        {groups.length === 0 && (
          <p className="px-3 py-2 text-xs text-muted-foreground">Keine Gruppen</p>
        )}

        {/* Ungrouped devices */}
        {ungroupedDevices.filter(filterDevice).length > 0 && (
          <>
            <div className="px-3 pt-3 pb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Ohne Gruppe
              </span>
            </div>
            {ungroupedDevices.filter(filterDevice).map(d => (
              <DeviceRow
                key={d.id}
                device={d}
                isAdmin={isAdmin}
                onSelect={() => onSelectDevice(d.id)}
                onDelete={() => onDeleteDevice(d.id)}
              />
            ))}
          </>
        )}
      </div>
    </div>
  )
}

function GroupSection({
  group,
  devices,
  isAdmin,
  focused,
  expanded,
  onToggleExpand,
  onFocus,
  onDelete,
  onToggleHidden,
  onToggleScanBlocked,
  onDeleteDevice,
  onSelectDevice,
}: {
  group: NetworkGroupDto
  devices: NetworkDeviceDto[]
  isAdmin: boolean
  focused: boolean
  expanded: boolean
  onToggleExpand: () => void
  onFocus: () => void
  onDelete: () => void
  onToggleHidden: () => void
  onToggleScanBlocked: () => void
  onDeleteDevice: (id: number) => void
  onSelectDevice: (id: number) => void
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <div>
      {/* Group header row */}
      <div
        className={cn(
          'flex items-center gap-1 px-2 py-1.5 text-xs hover:bg-muted/50 cursor-pointer select-none',
          focused && 'bg-muted/40 font-medium',
          group.hidden && 'opacity-40',
        )}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Expand chevron */}
        <button
          className="text-muted-foreground hover:text-foreground shrink-0"
          onClick={e => { e.stopPropagation(); onToggleExpand() }}
        >
          {expanded
            ? <ChevronDown className="h-3 w-3" />
            : <ChevronRight className="h-3 w-3" />}
        </button>

        {/* Color dot + name → click focuses group */}
        <span
          className="h-2.5 w-2.5 rounded-full shrink-0"
          style={{ background: group.hidden ? '#64748b' : group.color }}
        />
        <span
          className={cn('flex-1 truncate', group.hidden && 'line-through')}
          onClick={onFocus}
          title={group.name}
        >
          {group.name}
        </span>
        <span className="text-[10px] text-muted-foreground shrink-0">{devices.length}</span>

        {/* Scan-blocked badge (always visible if active) */}
        {group.scanBlocked && (
          <span title="Scan-Import blockiert">
            <Ban className="h-3 w-3 text-amber-500 shrink-0" />
          </span>
        )}

        {/* Admin action icons (on hover) */}
        {isAdmin && hovered && (
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              className="text-muted-foreground hover:text-foreground"
              title={group.hidden ? 'Im Canvas einblenden' : 'Im Canvas ausblenden'}
              onClick={e => { e.stopPropagation(); onToggleHidden() }}
            >
              {group.hidden ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
            </button>
            <button
              className={cn('hover:text-foreground', group.scanBlocked ? 'text-amber-500' : 'text-muted-foreground')}
              title={group.scanBlocked ? 'Scan-Import erlauben' : 'Scan-Import blockieren'}
              onClick={e => { e.stopPropagation(); onToggleScanBlocked() }}
            >
              <ScanLine className="h-3 w-3" />
            </button>
            <button
              className="text-destructive hover:opacity-70"
              title="Gruppe löschen"
              onClick={e => { e.stopPropagation(); onDelete() }}
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>

      {/* Device list (when expanded) */}
      {expanded && (
        <div className="ml-5 border-l border-border/50">
          {devices.length === 0 && (
            <p className="px-3 py-1 text-[11px] text-muted-foreground italic">Keine Geräte</p>
          )}
          {devices.map(d => (
            <DeviceRow
              key={d.id}
              device={d}
              isAdmin={isAdmin}
              onSelect={() => onSelectDevice(d.id)}
              onDelete={() => onDeleteDevice(d.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function DeviceRow({
  device,
  isAdmin,
  onSelect,
  onDelete,
}: {
  device: NetworkDeviceDto
  isAdmin: boolean
  onSelect: () => void
  onDelete: () => void
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      className="flex items-center gap-1 px-2 py-1 text-[11px] hover:bg-muted/40 cursor-pointer"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onSelect}
    >
      <span className="flex-1 truncate font-medium">{device.name}</span>
      {device.ipAddress && (
        <span className="shrink-0 text-muted-foreground font-mono">{device.ipAddress}</span>
      )}
      {isAdmin && hovered && (
        <div className="flex items-center gap-0.5 shrink-0 ml-1">
          <button
            className="text-muted-foreground hover:text-foreground"
            title="Auswählen / bearbeiten"
            onClick={e => { e.stopPropagation(); onSelect() }}
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            className="text-destructive hover:opacity-70"
            title="Gerät löschen"
            onClick={e => { e.stopPropagation(); onDelete() }}
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  )
}
