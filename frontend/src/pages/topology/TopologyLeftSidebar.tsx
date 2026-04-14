import { useState } from 'react'
import {
  Plus, Trash2, Eye, EyeOff, Ban, ScanLine,
  ChevronRight, ChevronDown, Pencil, Network,
} from 'lucide-react'
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
  draggingDeviceId: number | null
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
  draggingDeviceId,
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

  const ungroupedDevices = devices.filter(d => d.groupId == null)
  const searchLower = search.toLowerCase()
  const filterDevice = (d: NetworkDeviceDto) =>
    !search ||
    d.name.toLowerCase().includes(searchLower) ||
    (d.ipAddress ?? '').toLowerCase().includes(searchLower) ||
    (d.hostname ?? '').toLowerCase().includes(searchLower)

  const totalDevices = devices.length
  const visibleGroups = groups.filter(g => !g.hidden || isAdmin)

  return (
    <div className="flex w-56 shrink-0 flex-col border-r bg-background">
      {/* Search */}
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
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Gruppen
          </span>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-muted-foreground">{totalDevices} Geräte</span>
            {isAdmin && (
              <Button
                size="icon"
                variant="ghost"
                className="h-5 w-5 ml-1"
                onClick={onAddGroup}
                title="Gruppe hinzufügen"
              >
                <Plus className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>

        {/* "Show all" row */}
        <div
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 text-xs cursor-pointer hover:bg-muted/50 select-none',
            focusedGroupId === null && 'bg-primary/10 font-medium',
          )}
          onClick={() => onFocusGroup(null)}
        >
          <Network className="h-3 w-3 text-muted-foreground shrink-0" />
          <span className="flex-1 truncate text-muted-foreground">Alle anzeigen</span>
          <span className="text-[10px] text-muted-foreground shrink-0">{totalDevices}</span>
        </div>

        {/* Group rows */}
        {visibleGroups.map(g => {
          const groupDevices = devices.filter(d => d.groupId === g.id).filter(filterDevice)
          const isExpanded = expandedGroups.has(g.id)
          return (
            <GroupSection
              key={g.id}
              group={g}
              devices={groupDevices}
              allGroupDevicesCount={devices.filter(d => d.groupId === g.id).length}
              isAdmin={isAdmin}
              focused={focusedGroupId === g.id}
              expanded={isExpanded}
              isDragTarget={draggingDeviceId != null}
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

        {/* Empty state for groups */}
        {groups.length === 0 && isAdmin && (
          <div className="px-3 py-3 text-center">
            <p className="text-[11px] text-muted-foreground">Keine Gruppen vorhanden.</p>
            <button
              className="text-[11px] text-primary hover:underline mt-1"
              onClick={onAddGroup}
            >
              + Gruppe erstellen
            </button>
          </div>
        )}

        {/* Ungrouped devices */}
        {ungroupedDevices.filter(filterDevice).length > 0 && (
          <>
            <div className="flex items-center justify-between px-3 pt-3 pb-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Ohne Gruppe
              </span>
              <span className="text-[10px] text-muted-foreground">
                {ungroupedDevices.filter(filterDevice).length}
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

        {/* Global empty state */}
        {devices.length === 0 && (
          <div className="px-4 py-6 text-center space-y-1">
            <Network className="h-6 w-6 text-muted-foreground/40 mx-auto" />
            <p className="text-[11px] text-muted-foreground">Noch keine Geräte.</p>
            {isAdmin && (
              <p className="text-[11px] text-muted-foreground">
                Nutze{' '}
                <span className="text-primary">Scan</span> oder{' '}
                <span className="text-primary">ARP</span> in der Toolbar.
              </p>
            )}
          </div>
        )}

        {/* Search no results */}
        {search && devices.filter(filterDevice).length === 0 && devices.length > 0 && (
          <div className="px-4 py-4 text-center">
            <p className="text-[11px] text-muted-foreground">Keine Treffer für „{search}"</p>
          </div>
        )}
      </div>
    </div>
  )
}

function GroupSection({
  group, devices, allGroupDevicesCount, isAdmin, focused, expanded, isDragTarget,
  onToggleExpand, onFocus, onDelete, onToggleHidden, onToggleScanBlocked,
  onDeleteDevice, onSelectDevice,
}: {
  group: NetworkGroupDto
  devices: NetworkDeviceDto[]
  allGroupDevicesCount: number
  isAdmin: boolean
  focused: boolean
  expanded: boolean
  isDragTarget: boolean
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
      <div
        data-group-id={group.id}
        className={cn(
          'flex items-center gap-1 px-2 py-1.5 text-xs hover:bg-muted/50 cursor-pointer select-none',
          focused && 'bg-primary/10 font-medium',
          group.hidden && 'opacity-40',
          isDragTarget && 'ring-1 ring-inset ring-primary/40 bg-primary/5',
        )}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Expand chevron */}
        <button
          className="text-muted-foreground hover:text-foreground shrink-0 p-0.5"
          onClick={e => { e.stopPropagation(); onToggleExpand() }}
          title={expanded ? 'Zuklappen' : 'Aufklappen'}
        >
          {expanded
            ? <ChevronDown className="h-3 w-3" />
            : <ChevronRight className="h-3 w-3" />}
        </button>

        {/* Color dot + name */}
        <span
          className="h-2.5 w-2.5 rounded-full shrink-0 ring-1 ring-background"
          style={{ background: group.hidden ? '#64748b' : group.color }}
        />
        <span
          className={cn('flex-1 truncate', group.hidden && 'line-through')}
          onClick={onFocus}
          title={group.name}
        >
          {group.name}
        </span>
        <span className="text-[10px] text-muted-foreground shrink-0">{allGroupDevicesCount}</span>

        {/* Scan-blocked badge */}
        {group.scanBlocked && (
          <span title="Scan-Import blockiert">
            <Ban className="h-3 w-3 text-amber-500 shrink-0" aria-label="Scan blockiert" />
          </span>
        )}

        {/* Admin actions on hover */}
        {isAdmin && hovered && (
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              className="text-muted-foreground hover:text-foreground p-0.5"
              title={group.hidden ? 'Einblenden' : 'Ausblenden'}
              onClick={e => { e.stopPropagation(); onToggleHidden() }}
            >
              {group.hidden ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
            </button>
            <button
              className={cn('p-0.5 hover:text-foreground', group.scanBlocked ? 'text-amber-500' : 'text-muted-foreground')}
              title={group.scanBlocked ? 'Scan erlauben' : 'Scan blockieren'}
              onClick={e => { e.stopPropagation(); onToggleScanBlocked() }}
            >
              <ScanLine className="h-3 w-3" />
            </button>
            <button
              className="text-destructive hover:opacity-70 p-0.5"
              title="Gruppe löschen"
              onClick={e => { e.stopPropagation(); onDelete() }}
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>

      {/* Expanded device list */}
      {expanded && (
        <div className="ml-5 border-l border-border/40">
          {devices.length === 0 && (
            <p className="px-3 py-1.5 text-[10px] text-muted-foreground italic">Keine Geräte</p>
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
  device, isAdmin, onSelect, onDelete,
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
      {device.ipAddress && !hovered && (
        <span className="shrink-0 text-[10px] text-muted-foreground font-mono">{device.ipAddress}</span>
      )}
      {isAdmin && hovered && (
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            className="text-muted-foreground hover:text-foreground p-0.5"
            title="Auswählen"
            onClick={e => { e.stopPropagation(); onSelect() }}
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            className="text-destructive hover:opacity-70 p-0.5"
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
