import { useState } from 'react'
import { Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { NetworkGroupDto } from '@/hooks/useTopology'

interface Props {
  groups: NetworkGroupDto[]
  search: string
  onSearchChange: (v: string) => void
  isAdmin: boolean
  onAddGroup: () => void
  onDeleteGroup: (id: number) => void
  collapsedGroups: Set<number>
  onToggleGroup: (id: number) => void
}

export function TopologyLeftSidebar({
  groups,
  search,
  onSearchChange,
  isAdmin,
  onAddGroup,
  onDeleteGroup,
  collapsedGroups,
  onToggleGroup,
}: Props) {
  return (
    <div className="flex w-52 shrink-0 flex-col border-r bg-background">
      <div className="border-b px-3 py-2">
        <Input
          placeholder="Suchen…"
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          className="h-7 text-xs"
        />
      </div>

      <div className="flex-1 overflow-y-auto">
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

        {groups.map(g => (
          <GroupRow
            key={g.id}
            group={g}
            isAdmin={isAdmin}
            collapsed={collapsedGroups.has(g.id)}
            onToggle={() => onToggleGroup(g.id)}
            onDelete={() => onDeleteGroup(g.id)}
          />
        ))}

        {groups.length === 0 && (
          <p className="px-3 py-2 text-xs text-muted-foreground">Keine Gruppen</p>
        )}
      </div>
    </div>
  )
}

function GroupRow({
  group,
  isAdmin,
  collapsed,
  onToggle,
  onDelete,
}: {
  group: NetworkGroupDto
  isAdmin: boolean
  collapsed: boolean
  onToggle: () => void
  onDelete: () => void
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      className={cn('flex items-center gap-1.5 px-3 py-1.5 text-xs hover:bg-muted/50 cursor-pointer')}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onToggle}
    >
      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: group.color }} />
      <span className="flex-1 truncate">{group.name}</span>
      {collapsed
        ? <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
        : <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />}
      {isAdmin && hovered && (
        <button
          className="ml-1 text-destructive hover:opacity-70"
          onClick={e => { e.stopPropagation(); onDelete() }}
        >
          <Trash2 className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}
