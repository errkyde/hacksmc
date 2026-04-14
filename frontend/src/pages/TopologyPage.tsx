import dagre from '@dagrejs/dagre'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { ToastAction } from '@/components/ui/toast'
import {
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  addEdge,
  type Node,
  type Edge,
  type OnConnect,
  type OnNodeDrag,
  type OnSelectionChangeFunc,
} from '@xyflow/react'
import Layout from '@/components/Layout'
import { getTokenPayload } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import {
  useTopologyGroups,
  useTopologyDevices,
  useTopologyConnections,
  useCreateConnection,
  useDeleteConnection,
  useSaveDevicePosition,
  useCreateTopologyDevice,
  useDeleteTopologyDevice,
  useDeleteTopologyGroup,
  useCreateTopologyGroup,
  useUpdateTopologyGroup,
  useImportScanToTopology,
  useImportArpTable,
  useImportNatConnections,
  useImportFirewallConnections,
  useAutoScan,
  usePatchTopologyDevice,
  useTopologyEvents,
  useTopologyViews,
  useCreateTopologyView,
  useDeleteTopologyView,
  useUpdateTopologyView,
  type NetworkConnectionDto,
  type TopologyEvent,
} from '@/hooks/useTopology'
import { TopologyToolbar } from './topology/TopologyToolbar'
import { TopologyViewTabs } from './topology/TopologyViewTabs'
import { TopologyLeftSidebar } from './topology/TopologyLeftSidebar'
import { TopologyCanvas } from './topology/TopologyCanvas'
import { TopologyRightPanel } from './topology/TopologyRightPanel'
import { AddDeviceDialog } from './topology/AddDeviceDialog'
import { AddConnectionDialog } from './topology/AddConnectionDialog'
import { AddGroupDialog } from './topology/AddGroupDialog'
import { ScanImportDialog } from './topology/ScanImportDialog'
import type { ScannedHost } from '@/hooks/useAdmin'

// ── SSE attribution messages (German) ─────────────────────────────────────────
const ACTION_LABELS: Record<string, (actor: string, entity?: string) => string> = {
  DEVICE_CREATED:     (a, e) => `${a} hat "${e}" hinzugefügt`,
  DEVICE_UPDATED:     (a, e) => `${a} hat "${e}" bearbeitet`,
  DEVICE_DELETED:     (a, e) => `${a} hat "${e}" gelöscht`,
  CONNECTION_CREATED: (a, e) => `${a} hat Verbindung erstellt (${e})`,
  CONNECTION_DELETED: (a, e) => `${a} hat Verbindung gelöscht (${e})`,
  GROUP_CREATED:      (a, e) => `${a} hat Gruppe "${e}" erstellt`,
  GROUP_UPDATED:      (a, e) => `${a} hat Gruppe "${e}" aktualisiert`,
  GROUP_DELETED:      (a, e) => `${a} hat Gruppe "${e}" gelöscht`,
  SCAN_IMPORTED:      (a, e) => `${a}: Scan-Import (${e})`,
  ARP_IMPORTED:       (a, e) => `${a}: ARP-Import (${e})`,
  NAT_IMPORTED:       (a, e) => `${a}: NAT-Import (${e})`,
  FW_IMPORTED:        (a, e) => `${a}: Firewall-Import (${e})`,
}

// ── Edge color legend ──────────────────────────────────────────────────────────
const LEGEND_ITEMS = [
  { color: '#22c55e', label: 'Allgemein / OK' },
  { color: '#3b82f6', label: 'Eingehend (Inbound)' },
  { color: '#f97316', label: 'Ausgehend (Outbound)' },
  { color: '#a855f7', label: 'Intern (VLAN)' },
  { color: '#ef4444', label: 'Problem / Issue' },
]

export default function TopologyPage() {
  return (
    <Layout fluid>
      <ReactFlowProvider>
        <TopologyInner />
      </ReactFlowProvider>
    </Layout>
  )
}

// ── OSI-layer rank constraints for Dagre ──────────────────────────────────────
// Lower rank = higher in the graph (rendered first / at top in TB mode)
const OSI_RANK: Record<string, number> = {
  INTERNET:  0,
  FIREWALL:  1,
  ROUTER:    1,
  SWITCH:    2,
  PRINTER:   3,
  HOST:      3,
  UNKNOWN:   4,
}
const NODE_W = 180, NODE_H = 80

// ── Dagre-based hierarchical auto-layout ──────────────────────────────────────
function computeDagreLayout(
  nodes: Node[],
  edges: Edge[],
  direction: 'TB' | 'LR' = 'TB',
): Array<{ id: string; x: number; y: number }> {
  if (nodes.length === 0) return []

  const g = new dagre.graphlib.Graph({ compound: false })
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({
    rankdir: direction,
    ranksep: direction === 'TB' ? 120 : 180,
    nodesep: direction === 'TB' ? 60 : 40,
    edgesep: 20,
    marginx: 60,
    marginy: 60,
    // Use Sugiyama-compatible rank assignment — Dagre calls it "network-simplex"
    ranker: 'network-simplex',
  })

  // Register nodes with preferred rank (Dagre rank = layer index)
  nodes.forEach(n => {
    const deviceType = (n.data as { device?: { deviceType?: string } })?.device?.deviceType ?? 'UNKNOWN'
    g.setNode(n.id, {
      width: NODE_W,
      height: NODE_H,
      rank: OSI_RANK[deviceType] ?? 4,
    })
  })

  // Add edges — Dagre uses these to determine flow direction
  edges.forEach(e => {
    if (g.hasNode(e.source) && g.hasNode(e.target)) {
      g.setEdge(e.source, e.target)
    }
  })

  // For isolated nodes (no edges), add dummy edges from any INTERNET node to
  // pull them into the graph rather than leaving them in rank 0
  const isolated = nodes.filter(n => !edges.some(e => e.source === n.id || e.target === n.id))
  const anchor = nodes.find(
    n => (n.data as { device?: { deviceType?: string } })?.device?.deviceType === 'INTERNET',
  )
  if (anchor) {
    isolated
      .filter(n => n.id !== anchor.id)
      .forEach(n => g.setEdge(anchor.id, n.id))
  }

  dagre.layout(g)

  return nodes.map(n => {
    const pos = g.node(n.id)
    if (!pos) return { id: n.id, x: 0, y: 0 }
    return {
      id: n.id,
      x: pos.x - NODE_W / 2,
      y: pos.y - NODE_H / 2,
    }
  })
}

function TopologyInner() {
  const payload = getTokenPayload()
  const isAdmin = payload?.role === 'ADMIN'
  const currentUsername = payload?.sub as string | undefined
  const { toast } = useToast()

  // ── Real-time SSE: attribution toast + online count ───────────────────────
  const { onlineCount } = useTopologyEvents((event: TopologyEvent) => {
    if (!event.actor || event.actor === 'system' || event.actor === currentUsername) return
    const msgFn = ACTION_LABELS[event.action]
    if (msgFn) toast({ title: msgFn(event.actor, event.entity), duration: 4000 })
  })

  // ── View selection ────────────────────────────────────────────────────────
  const [selectedViewId, setSelectedViewId] = useState(1)
  const { data: views } = useTopologyViews()
  const createView = useCreateTopologyView()
  const deleteView = useDeleteTopologyView()
  const updateView = useUpdateTopologyView()

  // ── Data ──────────────────────────────────────────────────────────────────
  const { data: groups } = useTopologyGroups(selectedViewId)
  const { data: devices } = useTopologyDevices(selectedViewId)
  const { data: connections } = useTopologyConnections(selectedViewId)

  // ── Mutations ─────────────────────────────────────────────────────────────
  const createDevice = useCreateTopologyDevice()
  const deleteDevice = useDeleteTopologyDevice()
  const createGroup = useCreateTopologyGroup()
  const deleteGroup = useDeleteTopologyGroup()
  const createConn = useCreateConnection()
  const deleteConn = useDeleteConnection()
  const savePosition = useSaveDevicePosition()
  const updateGroup = useUpdateTopologyGroup()
  const patchDevice = usePatchTopologyDevice()
  const importScan = useImportScanToTopology()
  const importArp = useImportArpTable()
  const importNat = useImportNatConnections()
  const importFw = useImportFirewallConnections()
  const autoScan = useAutoScan()

  // ── UI State ──────────────────────────────────────────────────────────────
  const [selectedDeviceId, setSelectedDeviceId] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [focusedGroupId, setFocusedGroupId] = useState<number | null>(null)
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null)
  const [showLegend, setShowLegend] = useState(false)
  const [layoutDirection, setLayoutDirection] = useState<'TB' | 'LR'>('TB')
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null)

  const [draggingDeviceId, setDraggingDeviceId] = useState<number | null>(null)
  const [multiSelection, setMultiSelection] = useState<{ nodeIds: string[]; edgeIds: string[] }>({ nodeIds: [], edgeIds: [] })
  const dragStartPositions = useRef<Map<number, { x: number; y: number }>>(new Map())

  const flyToNodeFn = useRef<((nodeId: string) => void) | null>(null)
  const pendingDeletes = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  useEffect(() => {
    const pd = pendingDeletes.current
    return () => { pd.forEach(t => clearTimeout(t)); pd.clear() }
  }, [])

  const [showAddDevice, setShowAddDevice] = useState(false)
  const [showAddConnection, setShowAddConnection] = useState(false)
  const [showAddGroup, setShowAddGroup] = useState(false)
  const [showScan, setShowScan] = useState(false)
  const [preselectedSourceId, setPreselectedSourceId] = useState<number | undefined>()

  const fitViewFn = useRef<(() => void) | null>(null)

  // ── Group lookups ─────────────────────────────────────────────────────────
  const groupColorMap = useMemo(() => {
    const map = new Map<number, string>()
    ;(groups ?? []).forEach(g => map.set(g.id, g.color))
    return map
  }, [groups])

  // Hidden groups: non-admins don't see those devices at all;
  // admins see them dimmed (so edges between hidden-group devices remain visible).
  const hiddenGroupIds = useMemo(() => {
    if (isAdmin) return new Set<number>()
    const s = new Set<number>()
    ;(groups ?? []).filter(g => g.hidden).forEach(g => s.add(g.id))
    return s
  }, [groups, isAdmin])

  // ── Connection status per device (derived from connections list) ──────────
  const deviceConnStatus = useMemo(() => {
    const map = new Map<number, { hasIssue: boolean; hasNat: boolean }>()
    for (const c of connections ?? []) {
      for (const devId of [c.sourceDeviceId, c.targetDeviceId]) {
        const prev = map.get(devId) ?? { hasIssue: false, hasNat: false }
        map.set(devId, {
          hasIssue: prev.hasIssue || c.status === 'ISSUE',
          hasNat:   prev.hasNat   || c.natRuleId != null,
        })
      }
    }
    return map
  }, [connections])

  // ── Node/Edge transforms ──────────────────────────────────────────────────
  const searchLower = search.toLowerCase()

  const rfNodes: Node[] = useMemo(() => {
    const allDevices = devices ?? []
    const filtered = search
      ? allDevices.filter(d =>
          d.name.toLowerCase().includes(searchLower) ||
          (d.ipAddress ?? '').toLowerCase().includes(searchLower) ||
          (d.hostname ?? '').toLowerCase().includes(searchLower),
        )
      : allDevices

    // For non-admins, completely exclude hidden-group devices.
    // For admins, hiddenGroupIds is always empty (see above), so all devices are included.
    const visible = filtered.filter(d => d.groupId == null || !hiddenGroupIds.has(d.groupId))

    return visible.map(d => {
      const groupColor = d.groupId != null ? groupColorMap.get(d.groupId) : undefined
      const inHiddenGroup = isAdmin && d.groupId != null &&
        (groups ?? []).some(g => g.id === d.groupId && g.hidden)
      const inFocusedGroup = focusedGroupId === null || d.groupId === focusedGroupId
      const dimmedByGroup = !inFocusedGroup
      const dimmedByNode = focusedNodeId !== null &&
        focusedNodeId !== String(d.id) &&
        !isConnectedTo(focusedNodeId, String(d.id), connections ?? [])
      return {
        id: String(d.id),
        type: 'deviceNode',
        position: { x: d.posX, y: d.posY },
        selected: String(d.id) === String(selectedDeviceId),
        data: {
          device: d,
          groupColor,
          // Devices in hidden groups are shown to admins but heavily dimmed
          dimmed: dimmedByGroup || dimmedByNode || inHiddenGroup,
          highlighted: String(d.id) === highlightedNodeId,
          connStatus: (() => {
            const s = deviceConnStatus.get(d.id)
            if (!s) return 'none'
            if (s.hasIssue) return 'issue'
            if (s.hasNat)   return 'nat'
            return 'ok'
          })(),
        },
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devices, groupColorMap, hiddenGroupIds, focusedGroupId, search, selectedDeviceId, focusedNodeId, connections, highlightedNodeId, deviceConnStatus])

  const rfEdges: Edge[] = useMemo(() => {
    // Build a set of currently visible node IDs so we can filter orphan edges.
    // React Flow silently drops edges whose source/target node doesn't exist,
    // which causes connections to disappear without any error.
    const visibleNodeIds = new Set(rfNodes.map(n => n.id))
    return (connections ?? [])
      .filter(c => visibleNodeIds.has(String(c.sourceDeviceId)) && visibleNodeIds.has(String(c.targetDeviceId)))
      .map(c => {
        const label = c.label ?? (c.protocol && c.portStart
          ? `${c.protocol}:${c.portStart}${c.portEnd && c.portEnd !== c.portStart ? `-${c.portEnd}` : ''}`
          : undefined)
        const dimmedByNode = focusedNodeId !== null &&
          focusedNodeId !== String(c.sourceDeviceId) &&
          focusedNodeId !== String(c.targetDeviceId)
        const dimmedByGroup = focusedGroupId !== null && (() => {
          const srcDevice = (devices ?? []).find(d => d.id === c.sourceDeviceId)
          const tgtDevice = (devices ?? []).find(d => d.id === c.targetDeviceId)
          return srcDevice?.groupId !== focusedGroupId && tgtDevice?.groupId !== focusedGroupId
        })()
        return {
          id: String(c.id),
          source: String(c.sourceDeviceId),
          target: String(c.targetDeviceId),
          label,
          labelStyle: { fontSize: 9, fill: 'hsl(var(--muted-foreground))' },
          style: {
            stroke: edgeColor(c),
            opacity: dimmedByNode || dimmedByGroup ? 0.1 : 1,
            strokeWidth: 2,
          },
          animated: c.natRuleId != null && c.status === 'OK',
          data: { connection: c },
        }
      })
  }, [rfNodes, connections, focusedNodeId, focusedGroupId, devices])

  const [nodes, setNodes, onNodesChange] = useNodesState(rfNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(rfEdges)

  // When server data changes, sync nodes — but preserve the in-flight position of any
  // node currently being dragged so an SSE-triggered refetch doesn't snap it back.
  const draggingDeviceIdRef = useRef<number | null>(null)
  useEffect(() => {
    const draggingId = draggingDeviceIdRef.current
    setNodes(prev =>
      rfNodes.map(n =>
        draggingId != null && n.id === String(draggingId)
          ? { ...n, position: prev.find(p => p.id === n.id)?.position ?? n.position }
          : n,
      ),
    )
  }, [rfNodes, setNodes])
  useEffect(() => { setEdges(rfEdges) }, [rfEdges, setEdges])

  // ── Event handlers ────────────────────────────────────────────────────────

  function handleNodeClick(_: React.MouseEvent, node: Node) {
    if (node.type !== 'deviceNode') return
    const id = Number(node.id)
    if (selectedDeviceId === id) {
      setSelectedDeviceId(null)
      setFocusedNodeId(null)
    } else {
      setSelectedDeviceId(id)
      setFocusedNodeId(node.id)
    }
  }

  const dragTimeouts = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())
  useEffect(() => {
    const timeouts = dragTimeouts.current
    return () => { timeouts.forEach(t => clearTimeout(t)); timeouts.clear() }
  }, [])

  const handleNodeDragStart: OnNodeDrag = useCallback((_event, node) => {
    if (node.type !== 'deviceNode') return
    const id = Number(node.id)
    dragStartPositions.current.set(id, { x: node.position.x, y: node.position.y })
    draggingDeviceIdRef.current = id
    setDraggingDeviceId(id)
  }, [])

  const handleNodeDragStop: OnNodeDrag = useCallback((event, node) => {
    if (node.type !== 'deviceNode') return
    const id = Number(node.id)
    draggingDeviceIdRef.current = null
    setDraggingDeviceId(null)

    // ── Drag-to-assign: check if released over a sidebar group row ───────────
    const el = document.elementFromPoint(event.clientX, event.clientY)
    const groupRow = el?.closest('[data-group-id]') as HTMLElement | null
    if (groupRow?.dataset.groupId) {
      const groupId = Number(groupRow.dataset.groupId)
      // Restore pre-drag position so node doesn't end up off-canvas
      const orig = dragStartPositions.current.get(id)
      if (orig) {
        setNodes(prev => prev.map(n => n.id === String(id) ? { ...n, position: orig } : n))
      }
      patchDevice.mutate(
        { id, data: { groupId } },
        {
          onSuccess: () => toast({ title: `Gerät zur Gruppe verschoben` }),
          onError: () => toast({ title: 'Fehler beim Verschieben', variant: 'destructive' }),
        },
      )
      return
    }

    // ── Regular position save (debounced 400 ms) ─────────────────────────────
    const existing = dragTimeouts.current.get(id)
    if (existing) clearTimeout(existing)
    const t = setTimeout(() => {
      savePosition.mutate({ id, posX: node.position.x, posY: node.position.y })
      dragTimeouts.current.delete(id)
    }, 400)
    dragTimeouts.current.set(id, t)
  }, [savePosition, patchDevice, setNodes, toast])

  const handleConnect: OnConnect = useCallback((params) => {
    const sourceId = Number(params.source)
    const targetId = Number(params.target)
    const tempId = `temp-${Date.now()}`
    setEdges(eds => addEdge({ ...params, id: tempId }, eds))
    createConn.mutate(
      { sourceDeviceId: sourceId, targetDeviceId: targetId },
      {
        onError: () => {
          setEdges(eds => eds.filter(e => e.id !== tempId))
          toast({ title: 'Verbindung fehlgeschlagen', description: 'Konnte nicht erstellt werden.', variant: 'destructive' })
        },
      },
    )
  }, [createConn, setEdges, toast])

  function handlePaneClick() {
    setSelectedDeviceId(null)
    setFocusedNodeId(null)
  }

  function handleDeleteDevice(id: number) {
    const deviceName = (devices ?? []).find(d => d.id === id)?.name ?? `#${id}`
    const key = `device-${id}`
    const existing = pendingDeletes.current.get(key)
    if (existing) { clearTimeout(existing); pendingDeletes.current.delete(key); return }

    const { dismiss } = toast({
      title: `"${deviceName}" wird gelöscht`,
      description: 'Klicke Rückgängig um abzubrechen.',
      duration: 5000,
      action: (
        <ToastAction altText="Rückgängig" onClick={() => {
          clearTimeout(pendingDeletes.current.get(key))
          pendingDeletes.current.delete(key)
          dismiss()
        }}>
          Rückgängig
        </ToastAction>
      ),
    })

    const timer = setTimeout(() => {
      pendingDeletes.current.delete(key)
      deleteDevice.mutate(id, {
        onSuccess: () => { setSelectedDeviceId(null); setFocusedNodeId(null) },
        onError: () => toast({ title: 'Fehler', description: 'Gerät konnte nicht gelöscht werden.', variant: 'destructive' }),
      })
    }, 5000)
    pendingDeletes.current.set(key, timer)
  }

  function handlePatchDevice(id: number, data: Parameters<typeof patchDevice.mutate>[0]['data']) {
    patchDevice.mutate({ id, data }, {
      onSuccess: () => toast({ title: 'Gerät aktualisiert' }),
      onError: () => toast({ title: 'Fehler', description: 'Änderungen konnten nicht gespeichert werden.', variant: 'destructive' }),
    })
  }

  function handleDeleteConnection(id: number) {
    const conn = (connections ?? []).find(c => c.id === id)
    const srcName = (devices ?? []).find(d => d.id === conn?.sourceDeviceId)?.name ?? '?'
    const tgtName = (devices ?? []).find(d => d.id === conn?.targetDeviceId)?.name ?? '?'
    const label = conn ? `${srcName} → ${tgtName}` : `#${id}`
    const key = `conn-${id}`
    const existing = pendingDeletes.current.get(key)
    if (existing) { clearTimeout(existing); pendingDeletes.current.delete(key); return }

    const { dismiss } = toast({
      title: `Verbindung wird gelöscht`,
      description: label,
      duration: 5000,
      action: (
        <ToastAction altText="Rückgängig" onClick={() => {
          clearTimeout(pendingDeletes.current.get(key))
          pendingDeletes.current.delete(key)
          dismiss()
        }}>
          Rückgängig
        </ToastAction>
      ),
    })

    const timer = setTimeout(() => {
      pendingDeletes.current.delete(key)
      deleteConn.mutate(id, {
        onError: () => toast({ title: 'Fehler', description: 'Verbindung konnte nicht gelöscht werden.', variant: 'destructive' }),
      })
    }, 5000)
    pendingDeletes.current.set(key, timer)
  }

  function handleToggleGroupHidden(id: number, hidden: boolean) {
    updateGroup.mutate({ id, data: { hidden } })
  }

  function handleToggleGroupScanBlocked(id: number, scanBlocked: boolean) {
    updateGroup.mutate({ id, data: { scanBlocked } })
  }

  function handleSelectDevice(id: number) {
    setSelectedDeviceId(id)
    setFocusedNodeId(String(id))
    // Fly to node and briefly highlight it (amber ring for 1.5 s)
    const nodeId = String(id)
    flyToNodeFn.current?.(nodeId)
    setHighlightedNodeId(nodeId)
    setTimeout(() => setHighlightedNodeId(null), 1500)
  }

  function handleDeleteGroup(id: number) {
    deleteGroup.mutate(id, {
      onSuccess: () => {
        if (focusedGroupId === id) setFocusedGroupId(null)
        toast({ title: 'Gruppe gelöscht' })
      },
      onError: () => toast({ title: 'Fehler', description: 'Gruppe konnte nicht gelöscht werden.', variant: 'destructive' }),
    })
  }

  function handleImportScan(scanned: ScannedHost[], targetGroupId?: number | null) {
    importScan.mutate(
      { devices: scanned, targetGroupId: targetGroupId ?? undefined, viewId: selectedViewId },
      {
        onSuccess: (data: { imported: number }) =>
          toast({ title: `${data.imported} Gerät${data.imported !== 1 ? 'e' : ''} importiert` }),
        onError: () => toast({ title: 'Import fehlgeschlagen', variant: 'destructive' }),
      },
    )
  }

  function handleArpImport() {
    importArp.mutate(selectedViewId, {
      onSuccess: (data: { upserted: number }) =>
        toast({ title: `ARP: ${data.upserted} Gerät${data.upserted !== 1 ? 'e' : ''} importiert/aktualisiert` }),
      onError: (err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Unbekannter Fehler'
        toast({ title: 'ARP-Import fehlgeschlagen', description: msg, variant: 'destructive' })
      },
    })
  }

  function handleNatImport() {
    importNat.mutate(selectedViewId, {
      onSuccess: (data: { imported: number }) =>
        toast({ title: `NAT: ${data.imported} neue Verbindung${data.imported !== 1 ? 'en' : ''} erstellt` }),
      onError: () => toast({ title: 'NAT-Import fehlgeschlagen', variant: 'destructive' }),
    })
  }

  function handleFirewallImport() {
    importFw.mutate(selectedViewId, {
      onSuccess: (data: { imported: number }) =>
        toast({ title: `Firewall: ${data.imported} neue Verbindung${data.imported !== 1 ? 'en' : ''} importiert` }),
      onError: () => toast({ title: 'Firewall-Import fehlgeschlagen', variant: 'destructive' }),
    })
  }

  function handleAutoScan() {
    autoScan.mutate(selectedViewId, {
      onSuccess: (data) => {
        // Auto-apply hierarchical layout immediately after scan completes
        // (nodes/edges will have been refreshed by query invalidation)
        setTimeout(() => {
          handleAutoLayout()
        }, 300)
        toast({
          title: 'Auto Scan abgeschlossen',
          description: [
            data.devices > 0 && `${data.devices} Gerät${data.devices !== 1 ? 'e' : ''} importiert`,
            data.connections > 0 && `${data.connections} Verbindung${data.connections !== 1 ? 'en' : ''} erstellt`,
            data.grouped > 0 && `${data.grouped} Gerät${data.grouped !== 1 ? 'e' : ''} gruppiert`,
          ].filter(Boolean).join(' · ') || 'Keine Änderungen',
          duration: 6000,
        })
      },
      onError: (err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Unbekannter Fehler'
        toast({ title: 'Auto Scan fehlgeschlagen', description: msg, variant: 'destructive' })
      },
    })
  }

  function handleAutoLayout(direction?: 'TB' | 'LR') {
    if (!devices?.length) return
    const dir = direction ?? layoutDirection
    const layout = computeDagreLayout(nodes, edges, dir)
    layout.forEach(({ id, x, y }) => {
      savePosition.mutate({ id: Number(id), posX: x, posY: y })
    })
    setNodes(prev =>
      prev.map(n => {
        const pos = layout.find(l => l.id === n.id)
        return pos ? { ...n, position: { x: pos.x, y: pos.y } } : n
      }),
    )
    setTimeout(() => fitViewFn.current?.(), 100)
    toast({ title: `Layout angewendet (${dir === 'TB' ? 'oben→unten' : 'links→rechts'})` })
  }

  function handleToggleLayoutDirection() {
    const next = layoutDirection === 'TB' ? 'LR' : 'TB'
    setLayoutDirection(next)
    // Re-apply layout in the new direction immediately if nodes exist
    if (devices?.length) handleAutoLayout(next)
  }

  function handleReset() {
    setSearch('')
    setFocusedNodeId(null)
    setFocusedGroupId(null)
    setSelectedDeviceId(null)
    fitViewFn.current?.()
  }

  // ── Multi-select ──────────────────────────────────────────────────────────
  const handleSelectionChange: OnSelectionChangeFunc = useCallback(({ nodes: selNodes, edges: selEdges }) => {
    const nodeIds = selNodes.map(n => n.id)
    const edgeIds = selEdges.map(e => e.id)
    // Only activate multi-select UI when more than one item is selected
    if (nodeIds.length > 1 || (nodeIds.length > 0 && edgeIds.length > 0) || edgeIds.length > 1) {
      setMultiSelection({ nodeIds, edgeIds })
    } else {
      setMultiSelection({ nodeIds: [], edgeIds: [] })
    }
  }, [])

  function handleBulkDelete() {
    const { nodeIds, edgeIds } = multiSelection
    const totalNodes = nodeIds.length
    const totalEdges = edgeIds.length
    const total = totalNodes + totalEdges
    if (total === 0) return

    const key = `bulk-${Date.now()}`
    const { dismiss } = toast({
      title: `${total} Element${total !== 1 ? 'e' : ''} werden gelöscht`,
      description: `${totalNodes > 0 ? `${totalNodes} Gerät${totalNodes !== 1 ? 'e' : ''}` : ''}${totalNodes > 0 && totalEdges > 0 ? ', ' : ''}${totalEdges > 0 ? `${totalEdges} Verbindung${totalEdges !== 1 ? 'en' : ''}` : ''}`,
      duration: 5000,
      action: (
        <ToastAction altText="Rückgängig" onClick={() => {
          clearTimeout(pendingDeletes.current.get(key))
          pendingDeletes.current.delete(key)
          dismiss()
        }}>
          Rückgängig
        </ToastAction>
      ),
    })

    const timer = setTimeout(() => {
      pendingDeletes.current.delete(key)
      edgeIds.forEach(id => deleteConn.mutate(Number(id)))
      nodeIds.forEach(id => deleteDevice.mutate(Number(id)))
      setMultiSelection({ nodeIds: [], edgeIds: [] })
      setSelectedDeviceId(null)
      setFocusedNodeId(null)
    }, 5000)
    pendingDeletes.current.set(key, timer)
  }

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  const handleDeleteDeviceRef = useRef(handleDeleteDevice)
  handleDeleteDeviceRef.current = handleDeleteDevice

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedDeviceId != null) {
        e.preventDefault()
        handleDeleteDeviceRef.current(selectedDeviceId)
      }
      if (e.key === 'Escape') {
        setSelectedDeviceId(null)
        setFocusedNodeId(null)
      }
      if ((e.key === 'f' || e.key === 'F') && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        fitViewFn.current?.()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedDeviceId])

  const selectedDevice = selectedDeviceId != null
    ? ((devices ?? []).find(d => d.id === selectedDeviceId) ?? null)
    : null

  function handleCreateView(name: string) {
    createView.mutate({ name }, {
      onSuccess: (view) => setSelectedViewId(view.id),
      onError: () => toast({ title: 'Fehler beim Erstellen der Ansicht', variant: 'destructive' }),
    })
  }

  function handleDeleteView(id: number) {
    const viewName = (views ?? []).find(v => v.id === id)?.name ?? `#${id}`
    const key = `view-${id}`
    const existing = pendingDeletes.current.get(key)
    if (existing) { clearTimeout(existing); pendingDeletes.current.delete(key); return }

    const { dismiss } = toast({
      title: `Ansicht "${viewName}" wird gelöscht`,
      description: 'Klicke Rückgängig um abzubrechen.',
      duration: 5000,
      action: (
        <ToastAction altText="Rückgängig" onClick={() => {
          clearTimeout(pendingDeletes.current.get(key))
          pendingDeletes.current.delete(key)
          dismiss()
        }}>
          Rückgängig
        </ToastAction>
      ),
    })

    const timer = setTimeout(() => {
      pendingDeletes.current.delete(key)
      if (selectedViewId === id) setSelectedViewId(1)
      deleteView.mutate(id, {
        onError: () => toast({ title: 'Fehler beim Löschen der Ansicht', variant: 'destructive' }),
      })
    }, 5000)
    pendingDeletes.current.set(key, timer)
  }

  function handleRenameView(id: number, name: string) {
    const view = (views ?? []).find(v => v.id === id)
    if (!view) return
    updateView.mutate({ id, name, description: view.description ?? undefined }, {
      onError: () => toast({ title: 'Fehler beim Umbenennen', variant: 'destructive' }),
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <TopologyViewTabs
        views={views ?? []}
        selectedViewId={selectedViewId}
        onSelect={setSelectedViewId}
        onCreateView={handleCreateView}
        onDeleteView={handleDeleteView}
        onRenameView={handleRenameView}
        isAdmin={isAdmin}
      />
      <TopologyToolbar
        isAdmin={isAdmin}
        showLegend={showLegend}
        onToggleLegend={() => setShowLegend(v => !v)}
        onAutoScanClick={handleAutoScan}
        onScanClick={() => setShowScan(true)}
        onArpClick={handleArpImport}
        onNatImportClick={handleNatImport}
        onFirewallImportClick={handleFirewallImport}
        onAddDevice={() => setShowAddDevice(true)}
        onFitView={() => fitViewFn.current?.()}
        onReset={handleReset}
        onAutoLayout={() => handleAutoLayout()}
        layoutDirection={layoutDirection}
        onToggleLayoutDirection={handleToggleLayoutDirection}
        onlineCount={onlineCount}
        autoScanLoading={autoScan.isPending}
        arpLoading={importArp.isPending}
        natImportLoading={importNat.isPending}
        firewallImportLoading={importFw.isPending}
      />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0, position: 'relative' }}>
        <TopologyLeftSidebar
          groups={groups ?? []}
          devices={devices ?? []}
          search={search}
          onSearchChange={setSearch}
          isAdmin={isAdmin}
          onAddGroup={() => setShowAddGroup(true)}
          onDeleteGroup={handleDeleteGroup}
          onToggleHidden={handleToggleGroupHidden}
          onToggleScanBlocked={handleToggleGroupScanBlocked}
          onDeleteDevice={handleDeleteDevice}
          onSelectDevice={handleSelectDevice}
          focusedGroupId={focusedGroupId}
          onFocusGroup={setFocusedGroupId}
          draggingDeviceId={draggingDeviceId}
        />

        <div style={{ flex: 1, overflow: 'hidden', minWidth: 0, minHeight: 0 }}>
          <TopologyCanvas
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={handleNodeClick}
            onNodeDragStart={handleNodeDragStart}
            onNodeDragStop={handleNodeDragStop}
            onConnect={handleConnect}
            onPaneClick={handlePaneClick}
            onSelectionChange={handleSelectionChange}
            fitViewRef={fn => { fitViewFn.current = fn }}
            flyToNodeRef={fn => { flyToNodeFn.current = fn }}
          />
        </div>

        <TopologyRightPanel
          device={selectedDevice}
          connections={connections ?? []}
          devices={devices ?? []}
          groups={groups ?? []}
          isAdmin={isAdmin}
          onClose={() => { setSelectedDeviceId(null); setFocusedNodeId(null) }}
          onDeleteDevice={handleDeleteDevice}
          onDeleteConnection={handleDeleteConnection}
          onPatchDevice={handlePatchDevice}
          onAddConnection={() => {
            setPreselectedSourceId(selectedDeviceId ?? undefined)
            setShowAddConnection(true)
          }}
        />

        {/* Multi-select bulk-delete action bar */}
        {(multiSelection.nodeIds.length > 0 || multiSelection.edgeIds.length > 0) && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 rounded-lg border bg-card/95 backdrop-blur px-3 py-2 shadow-lg">
            <span className="text-xs text-muted-foreground">
              {[
                multiSelection.nodeIds.length > 0 && `${multiSelection.nodeIds.length} Gerät${multiSelection.nodeIds.length !== 1 ? 'e' : ''}`,
                multiSelection.edgeIds.length > 0 && `${multiSelection.edgeIds.length} Verbindung${multiSelection.edgeIds.length !== 1 ? 'en' : ''}`,
              ].filter(Boolean).join(', ')} ausgewählt
            </span>
            <button
              className="flex items-center gap-1 text-xs text-destructive hover:opacity-80 font-medium"
              onClick={handleBulkDelete}
            >
              <Trash2 className="h-3 w-3" />
              Löschen
            </button>
            <button
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setMultiSelection({ nodeIds: [], edgeIds: [] })}
              title="Auswahl aufheben"
            >
              ✕
            </button>
          </div>
        )}

        {/* Edge color legend */}
        {showLegend && (
          <div
            className="absolute bottom-4 left-[15rem] z-10 rounded-lg border bg-card/95 backdrop-blur px-3 py-2.5 shadow-lg"
            style={{ pointerEvents: 'none' }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Verbindungen
            </p>
            <div className="space-y-1.5">
              {LEGEND_ITEMS.map(item => (
                <div key={item.color} className="flex items-center gap-2">
                  <div
                    className="h-px w-6 rounded"
                    style={{ background: item.color, height: 2 }}
                  />
                  <span className="text-[10px] text-muted-foreground">{item.label}</span>
                </div>
              ))}
              <div className="flex items-center gap-2 pt-0.5 border-t border-border/50 mt-1">
                <div className="flex gap-0.5">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="h-0.5 w-1.5 rounded" style={{ background: '#22c55e' }} />
                  ))}
                </div>
                <span className="text-[10px] text-muted-foreground">Animiert = NAT-Regel aktiv</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <AddDeviceDialog
        open={showAddDevice}
        onOpenChange={setShowAddDevice}
        groups={groups ?? []}
        onSubmit={data => createDevice.mutate({ data, viewId: selectedViewId }, {
          onSuccess: () => toast({ title: 'Gerät erstellt' }),
          onError: () => toast({ title: 'Fehler beim Erstellen', variant: 'destructive' }),
        })}
        loading={createDevice.isPending}
      />
      <AddConnectionDialog
        open={showAddConnection}
        onOpenChange={setShowAddConnection}
        devices={devices ?? []}
        preselectedSourceId={preselectedSourceId}
        onSubmit={data => createConn.mutate(data, {
          onSuccess: () => toast({ title: 'Verbindung erstellt' }),
          onError: () => toast({ title: 'Fehler beim Erstellen', variant: 'destructive' }),
        })}
        loading={createConn.isPending}
      />
      <AddGroupDialog
        open={showAddGroup}
        onOpenChange={setShowAddGroup}
        onSubmit={data => createGroup.mutate({ data, viewId: selectedViewId }, {
          onSuccess: () => toast({ title: 'Gruppe erstellt' }),
          onError: () => toast({ title: 'Fehler beim Erstellen', variant: 'destructive' }),
        })}
        loading={createGroup.isPending}
      />
      <ScanImportDialog
        open={showScan}
        onOpenChange={setShowScan}
        groups={groups ?? []}
        onImport={handleImportScan}
        importLoading={importScan.isPending}
      />
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function edgeColor(c: NetworkConnectionDto): string {
  if (c.status === 'ISSUE') return '#ef4444'
  switch (c.direction) {
    case 'INBOUND':  return '#3b82f6'
    case 'OUTBOUND': return '#f97316'
    case 'INTERNAL': return '#a855f7'
    default:         return '#22c55e'
  }
}

function isConnectedTo(focusedId: string, nodeId: string, connections: NetworkConnectionDto[]) {
  return connections.some(
    c => (String(c.sourceDeviceId) === focusedId && String(c.targetDeviceId) === nodeId) ||
         (String(c.targetDeviceId) === focusedId && String(c.sourceDeviceId) === nodeId),
  )
}
