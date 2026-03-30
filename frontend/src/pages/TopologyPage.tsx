import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  addEdge,
  type Node,
  type Edge,
  type OnConnect,
  type OnNodeDrag,
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
  type NetworkConnectionDto,
} from '@/hooks/useTopology'
import { TopologyToolbar } from './topology/TopologyToolbar'
import { TopologyLeftSidebar } from './topology/TopologyLeftSidebar'
import { TopologyCanvas } from './topology/TopologyCanvas'
import { TopologyRightPanel } from './topology/TopologyRightPanel'
import { AddDeviceDialog } from './topology/AddDeviceDialog'
import { AddConnectionDialog } from './topology/AddConnectionDialog'
import { AddGroupDialog } from './topology/AddGroupDialog'
import { ScanImportDialog } from './topology/ScanImportDialog'
import type { ScannedHost } from '@/hooks/useAdmin'

export default function TopologyPage() {
  return (
    <Layout fluid>
      <ReactFlowProvider>
        <TopologyInner />
      </ReactFlowProvider>
    </Layout>
  )
}

function TopologyInner() {
  const payload = getTokenPayload()
  const isAdmin = payload?.role === 'ADMIN'
  const { toast } = useToast()

  // ── Data ──────────────────────────────────────────────────────────────────
  // Use undefined-safe refs — never inline `= []` here: a new [] on every render
  // makes useMemo deps change every render → setNodes loop → React error #185.
  const { data: groups } = useTopologyGroups()
  const { data: devices } = useTopologyDevices()
  const { data: connections } = useTopologyConnections()

  // ── Mutations ─────────────────────────────────────────────────────────────
  const createDevice = useCreateTopologyDevice()
  const deleteDevice = useDeleteTopologyDevice()
  const createGroup = useCreateTopologyGroup()
  const deleteGroup = useDeleteTopologyGroup()
  const updateGroup = useUpdateTopologyGroup()
  const createConn = useCreateConnection()
  const deleteConn = useDeleteConnection()
  const savePosition = useSaveDevicePosition()
  const importScan = useImportScanToTopology()
  const importArp = useImportArpTable()
  const importNat = useImportNatConnections()

  // ── UI State ──────────────────────────────────────────────────────────────
  const [selectedDeviceId, setSelectedDeviceId] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [collapsedGroups, setCollapsedGroups] = useState<Set<number>>(new Set())
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null)

  const [showAddDevice, setShowAddDevice] = useState(false)
  const [showAddConnection, setShowAddConnection] = useState(false)
  const [showAddGroup, setShowAddGroup] = useState(false)
  const [showScan, setShowScan] = useState(false)
  const [preselectedSourceId, setPreselectedSourceId] = useState<number | undefined>()

  const fitViewFn = useRef<(() => void) | null>(null)

  // ── Handlers ──────────────────────────────────────────────────────────────
  function toggleGroupCollapse(groupId: number) {
    const willCollapse = !collapsedGroups.has(groupId)
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
    updateGroup.mutate({ id: groupId, data: { collapsed: willCollapse } })
  }

  // ── Node/Edge transforms ──────────────────────────────────────────────────
  const searchLower = search.toLowerCase()

  const rfNodes: Node[] = useMemo(() => {
    const groupNodes: Node[] = (groups ?? []).map(g => ({
      id: `group-${g.id}`,
      type: 'groupNode',
      position: { x: 0, y: 0 },
      data: {
        group: { ...g, collapsed: collapsedGroups.has(g.id) },
        onToggleCollapse: (id: number) => toggleGroupCollapse(id),
      },
      style: {
        width: 300,
        height: 200,
        backgroundColor: g.color + '18',
        border: `2px solid ${g.color}`,
      },
      zIndex: 0,
    }))

    const filtered = search
      ? (devices ?? []).filter(d =>
          d.name.toLowerCase().includes(searchLower) ||
          (d.ipAddress ?? '').toLowerCase().includes(searchLower) ||
          (d.hostname ?? '').toLowerCase().includes(searchLower),
        )
      : (devices ?? [])

    const deviceNodes: Node[] = filtered.map(d => {
      const inGroup = d.groupId != null
      const groupCollapsed = d.groupId != null && collapsedGroups.has(d.groupId)
      return {
        id: String(d.id),
        type: 'deviceNode',
        position: { x: d.posX, y: d.posY },
        parentId: inGroup ? `group-${d.groupId}` : undefined,
        extent: inGroup ? ('parent' as const) : undefined,
        hidden: groupCollapsed,
        selected: String(d.id) === String(selectedDeviceId),
        data: {
          device: d,
          dimmed: focusedNodeId !== null && focusedNodeId !== String(d.id) && !isConnectedTo(focusedNodeId, String(d.id), connections ?? []),
        },
        zIndex: 1,
      }
    })

    return [...groupNodes, ...deviceNodes]
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups, devices, collapsedGroups, search, selectedDeviceId, focusedNodeId, connections])

  const rfEdges: Edge[] = useMemo(() =>
    (connections ?? []).map(c => {
      const label = c.label ?? (c.protocol && c.portStart
        ? `${c.protocol}:${c.portStart}${c.portEnd && c.portEnd !== c.portStart ? `-${c.portEnd}` : ''}`
        : undefined)
      const dimmed = focusedNodeId !== null &&
        focusedNodeId !== String(c.sourceDeviceId) &&
        focusedNodeId !== String(c.targetDeviceId)
      return {
        id: String(c.id),
        source: String(c.sourceDeviceId),
        target: String(c.targetDeviceId),
        label,
        labelStyle: { fontSize: 10 },
        style: {
          stroke: c.status === 'OK' ? '#22c55e' : c.status === 'ISSUE' ? '#ef4444' : '#64748b',
          opacity: dimmed ? 0.15 : 1,
          strokeWidth: 1.5,
        },
        animated: c.natRuleId != null && c.status === 'OK',
        data: { connection: c },
      }
    }),
    [connections, focusedNodeId],
  )

  const [nodes, setNodes, onNodesChange] = useNodesState(rfNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(rfEdges)

  // Sync RF state when data changes (useEffect, not useMemo — side effects must not run during render)
  useEffect(() => { setNodes(rfNodes) }, [rfNodes, setNodes])
  useEffect(() => { setEdges(rfEdges) }, [rfEdges, setEdges])

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

  const handleNodeDragStop: OnNodeDrag = useCallback((_event, node) => {
    if (node.type !== 'deviceNode') return
    const id = Number(node.id)
    const existing = dragTimeouts.current.get(id)
    if (existing) clearTimeout(existing)
    const t = setTimeout(() => {
      savePosition.mutate({ id, posX: node.position.x, posY: node.position.y })
      dragTimeouts.current.delete(id)
    }, 500)
    dragTimeouts.current.set(id, t)
  }, [savePosition])

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
          toast({ title: 'Fehler', description: 'Verbindung konnte nicht erstellt werden.', variant: 'destructive' })
        },
      },
    )
  }, [createConn, setEdges, toast])

  function handlePaneClick() {
    setSelectedDeviceId(null)
    setFocusedNodeId(null)
  }

  function handleDeleteDevice(id: number) {
    deleteDevice.mutate(id, {
      onSuccess: () => {
        toast({ title: 'Gerät gelöscht' })
        setSelectedDeviceId(null)
        setFocusedNodeId(null)
      },
      onError: () => toast({ title: 'Fehler', description: 'Gerät konnte nicht gelöscht werden.', variant: 'destructive' }),
    })
  }

  function handleDeleteConnection(id: number) {
    deleteConn.mutate(id, {
      onError: () => toast({ title: 'Fehler', description: 'Verbindung konnte nicht gelöscht werden.', variant: 'destructive' }),
    })
  }

  function handleDeleteGroup(id: number) {
    deleteGroup.mutate(id, {
      onError: () => toast({ title: 'Fehler', description: 'Gruppe konnte nicht gelöscht werden.', variant: 'destructive' }),
    })
  }

  function handleImportScan(scanned: ScannedHost[]) {
    importScan.mutate(scanned, {
      onSuccess: (data: { imported: number }) => toast({ title: `${data.imported} Gerät(e) importiert` }),
      onError: () => toast({ title: 'Fehler', description: 'Import fehlgeschlagen.', variant: 'destructive' }),
    })
  }

  function handleArpImport() {
    importArp.mutate(undefined, {
      onSuccess: (data: { upserted: number }) => toast({ title: `ARP Import: ${data.upserted} Gerät(e) aktualisiert/erstellt` }),
      onError: () => toast({ title: 'ARP-Import fehlgeschlagen', variant: 'destructive' }),
    })
  }

  function handleNatImport() {
    importNat.mutate(undefined, {
      onSuccess: (data: { imported: number }) =>
        toast({ title: `NAT Import: ${data.imported} neue Verbindung(en) erstellt` }),
      onError: () => toast({ title: 'NAT-Import fehlgeschlagen', variant: 'destructive' }),
    })
  }

  function handleReset() {
    setSearch('')
    setFocusedNodeId(null)
    setSelectedDeviceId(null)
    fitViewFn.current?.()
  }

  const selectedDevice = selectedDeviceId != null
    ? ((devices ?? []).find(d => d.id === selectedDeviceId) ?? null)
    : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <TopologyToolbar
        isAdmin={isAdmin}
        onScanClick={() => setShowScan(true)}
        onArpClick={handleArpImport}
        onNatImportClick={handleNatImport}
        onAddDevice={() => setShowAddDevice(true)}
        onFitView={() => fitViewFn.current?.()}
        onReset={handleReset}
        arpLoading={importArp.isPending}
        natImportLoading={importNat.isPending}
      />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
        <TopologyLeftSidebar
          groups={groups ?? []}
          search={search}
          onSearchChange={setSearch}
          isAdmin={isAdmin}
          onAddGroup={() => setShowAddGroup(true)}
          onDeleteGroup={handleDeleteGroup}
          collapsedGroups={collapsedGroups}
          onToggleGroup={toggleGroupCollapse}
        />
        <div style={{ flex: 1, overflow: 'hidden', minWidth: 0, minHeight: 0 }}>
          <TopologyCanvas
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={handleNodeClick}
            onNodeDragStop={handleNodeDragStop}
            onConnect={handleConnect}
            onPaneClick={handlePaneClick}
            fitViewRef={fn => { fitViewFn.current = fn }}
          />
        </div>
        <TopologyRightPanel
          device={selectedDevice}
          connections={connections ?? []}
          devices={devices ?? []}
          isAdmin={isAdmin}
          onClose={() => { setSelectedDeviceId(null); setFocusedNodeId(null) }}
          onDeleteDevice={handleDeleteDevice}
          onDeleteConnection={handleDeleteConnection}
          onAddConnection={() => {
            setPreselectedSourceId(selectedDeviceId ?? undefined)
            setShowAddConnection(true)
          }}
        />
      </div>

      {/* Dialogs */}
      <AddDeviceDialog
        open={showAddDevice}
        onOpenChange={setShowAddDevice}
        groups={groups ?? []}
        onSubmit={data => createDevice.mutate(data, {
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
        onSubmit={data => createGroup.mutate(data, {
          onSuccess: () => toast({ title: 'Gruppe erstellt' }),
          onError: () => toast({ title: 'Fehler beim Erstellen', variant: 'destructive' }),
        })}
        loading={createGroup.isPending}
      />
      <ScanImportDialog
        open={showScan}
        onOpenChange={setShowScan}
        onImport={handleImportScan}
        importLoading={importScan.isPending}
      />
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isConnectedTo(focusedId: string, nodeId: string, connections: NetworkConnectionDto[]) {
  return connections.some(
    c => (String(c.sourceDeviceId) === focusedId && String(c.targetDeviceId) === nodeId) ||
         (String(c.targetDeviceId) === focusedId && String(c.sourceDeviceId) === nodeId),
  )
}
