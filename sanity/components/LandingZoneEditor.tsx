'use client'

import { Box, Button, Card, Flex, Stack, Text, TextInput } from '@sanity/ui'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { set, unset, useClient, useFormValue } from 'sanity'
import type { ObjectInputProps } from 'sanity'
import {
  containedMediaRect,
  pointerToMediaPercent,
  type ContainedMediaRect,
} from '../../lib/aerial-map-geometry'
import {
  GREEN_EDGE_LABELS,
  GREEN_EDGE_SIDES,
  suggestNextYardage,
  type GreenEdgeSide,
  type LandingZoneGreenEdge,
  type LandingZoneMarker,
  type LandingZonePoint,
  type LandingZoneTeePoint,
} from '../../lib/landing-zone'

type TeeItem = LandingZoneTeePoint & {
  _type: 'landingZoneTee'
  _key: string
}

type MarkerItem = LandingZoneMarker & {
  _type: 'landingZoneMarker'
  _key: string
}

type GreenEdgeItem = LandingZoneGreenEdge & {
  _type: 'landingZoneGreenEdge'
  _key: string
}

type LandingZoneValue = {
  green?: LandingZonePoint | null
  tees?: TeeItem[] | null
  markers?: MarkerItem[] | null
  greenEdges?: GreenEdgeItem[] | null
} | null

type HoleGraphicFileValue = {
  asset?: { _ref?: string }
  alt?: string
} | null

type ScorecardDoc = {
  teeCount?: number | null
  teeSets?: Array<{ name?: string | null; color?: string | null } | null> | null
} | null

type EditorTool = 'green' | 'tee' | 'markers' | 'greenEdges'

type DragTarget =
  | { kind: 'green' }
  | { kind: 'tee'; index: number }
  | { kind: 'marker'; index: number }
  | { kind: 'greenEdge'; index: number }
  | null

const ZOOM_MIN = 1
const ZOOM_MAX = 3
const ZOOM_STEP = 0.25

const DEFAULT_GREEN_EDGE_YARDS: Record<GreenEdgeSide, number> = {
  front: 12,
  back: 16,
  left: 15,
  right: 15,
}

function makeTeeKey(index: number) {
  return `landing-zone-tee-${index}`
}

function makeMarkerKey(index: number) {
  return `landing-zone-marker-${index + 1}`
}

function makeGreenEdgeKey(side: GreenEdgeSide) {
  return `landing-zone-green-edge-${side}`
}

function readMediaDimensions(
  element: HTMLImageElement,
): { width: number; height: number } | null {
  if (element.naturalWidth > 0 && element.naturalHeight > 0) {
    return { width: element.naturalWidth, height: element.naturalHeight }
  }
  return null
}

function promptForYards(defaultYards: number): number | null {
  const raw = window.prompt('Yards from green center', String(defaultYards))
  if (raw == null) return null
  const value = Number.parseFloat(raw.trim())
  if (!Number.isFinite(value) || value <= 0) return null
  return Math.round(value)
}

function promptForTeeYards(defaultYards: number | null): number | null {
  const raw = window.prompt(
    'Yards from furthest back tee (to this point)',
    defaultYards != null ? String(defaultYards) : '',
  )
  if (raw == null) return null
  const value = Number.parseFloat(raw.trim())
  if (!Number.isFinite(value) || value < 0) return null
  return Math.round(value)
}

function promptForMarkerYardages(
  defaults: { fromGreen: number; fromTee: number | null },
): { yards: number; yardsFromTee: number } | null {
  const yards = promptForYards(defaults.fromGreen)
  if (yards == null) return null
  const yardsFromTee = promptForTeeYards(defaults.fromTee)
  if (yardsFromTee == null) return null
  return { yards, yardsFromTee }
}

export function LandingZoneEditor(props: ObjectInputProps) {
  const parentPath = useMemo(() => props.path.slice(0, -1), [props.path])
  const holeGraphic = useFormValue([...parentPath, 'holeGraphic']) as HoleGraphicFileValue
  const holeNumber = useFormValue([...parentPath, 'holeNumber']) as number | undefined
  const scorecard = useFormValue(['scorecard']) as ScorecardDoc
  const assetRef = holeGraphic?.asset?._ref

  const client = useClient({ apiVersion: '2024-01-01' })
  const viewportRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const mediaRef = useRef<HTMLImageElement>(null)

  const [mediaUrl, setMediaUrl] = useState<string | null>(null)
  const [mediaRect, setMediaRect] = useState<ContainedMediaRect | null>(null)
  const [dragging, setDragging] = useState<DragTarget>(null)
  const [zoom, setZoom] = useState(1)
  const [tool, setTool] = useState<EditorTool>('green')
  const [selectedTeeIndex, setSelectedTeeIndex] = useState(0)
  const [selectedGreenEdgeSide, setSelectedGreenEdgeSide] =
    useState<GreenEdgeSide>('front')
  const [pendingYards, setPendingYards] = useState(100)
  const [pendingYardsFromTee, setPendingYardsFromTee] = useState<number | null>(null)
  const [pendingGreenEdgeYards, setPendingGreenEdgeYards] = useState(12)

  const value = (props.value ?? null) as LandingZoneValue
  const green = value?.green ?? null
  const tees = (value?.tees ?? []) as TeeItem[]
  const markers = (value?.markers ?? []) as MarkerItem[]
  const greenEdges = (value?.greenEdges ?? []) as GreenEdgeItem[]

  const teeOptions = useMemo(() => {
    const count = Math.max(
      scorecard?.teeCount ?? 0,
      scorecard?.teeSets?.length ?? 0,
      3,
    )
    return Array.from({ length: count }, (_, index) => {
      const setDoc = scorecard?.teeSets?.[index]
      const name = setDoc?.name?.trim() || `Tee ${index + 1}`
      const color = setDoc?.color?.trim() || '#CF8018'
      return { index, name, color }
    })
  }, [scorecard])

  useEffect(() => {
    setPendingYards(suggestNextYardage(markers.map((m) => m.yards)))
  }, [markers])

  useEffect(() => {
    if (!assetRef) {
      setMediaUrl(null)
      return
    }

    let cancelled = false
    client
      .fetch<{ url?: string }>(`*[_id == $id][0]{ url }`, { id: assetRef })
      .then((doc) => {
        if (cancelled) return
        setMediaUrl(doc?.url?.trim() || null)
      })
      .catch(() => {
        if (!cancelled) setMediaUrl(null)
      })

    return () => {
      cancelled = true
    }
  }, [assetRef, client])

  const updateMediaRect = useCallback(() => {
    const container = containerRef.current
    const media = mediaRef.current
    if (!container || !media) return

    const containerRect = container.getBoundingClientRect()
    const dimensions = readMediaDimensions(media)
    if (!dimensions) return

    setMediaRect(
      containedMediaRect(
        containerRect.width,
        containerRect.height,
        dimensions.width,
        dimensions.height,
      ),
    )
  }, [])

  const handleMediaLoad = useCallback(() => {
    updateMediaRect()
  }, [updateMediaRect])

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => updateMediaRect())
    window.addEventListener('resize', updateMediaRect)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', updateMediaRect)
    }
  }, [mediaUrl, updateMediaRect, zoom])

  const zoomIn = useCallback(() => {
    const viewport = viewportRef.current
    const nextZoom = Math.min(ZOOM_MAX, Math.round((zoom + ZOOM_STEP) * 100) / 100)
    if (nextZoom === zoom) return
    const ratioX = viewport
      ? (viewport.scrollLeft + viewport.clientWidth / 2) / Math.max(viewport.scrollWidth, 1)
      : 0.5
    const ratioY = viewport
      ? (viewport.scrollTop + viewport.clientHeight / 2) / Math.max(viewport.scrollHeight, 1)
      : 0.5
    setZoom(nextZoom)
    requestAnimationFrame(() => {
      if (!viewport) return
      viewport.scrollLeft = ratioX * viewport.scrollWidth - viewport.clientWidth / 2
      viewport.scrollTop = ratioY * viewport.scrollHeight - viewport.clientHeight / 2
    })
  }, [zoom])

  const zoomOut = useCallback(() => {
    const viewport = viewportRef.current
    const nextZoom = Math.max(ZOOM_MIN, Math.round((zoom - ZOOM_STEP) * 100) / 100)
    if (nextZoom === zoom) return
    const ratioX = viewport
      ? (viewport.scrollLeft + viewport.clientWidth / 2) / Math.max(viewport.scrollWidth, 1)
      : 0.5
    const ratioY = viewport
      ? (viewport.scrollTop + viewport.clientHeight / 2) / Math.max(viewport.scrollHeight, 1)
      : 0.5
    setZoom(nextZoom)
    requestAnimationFrame(() => {
      if (!viewport) return
      viewport.scrollLeft = ratioX * viewport.scrollWidth - viewport.clientWidth / 2
      viewport.scrollTop = ratioY * viewport.scrollHeight - viewport.clientHeight / 2
    })
  }, [zoom])

  const zoomReset = useCallback(() => {
    setZoom(1)
    const viewport = viewportRef.current
    if (viewport) {
      viewport.scrollLeft = 0
      viewport.scrollTop = 0
    }
  }, [])

  const commit = useCallback(
    (next: LandingZoneValue) => {
      const nextTees = next?.tees?.length ? next.tees : undefined
      const nextMarkers = next?.markers?.length ? next.markers : undefined
      const nextEdges = next?.greenEdges?.length ? next.greenEdges : undefined
      if (!next?.green && !nextTees && !nextMarkers && !nextEdges) {
        props.onChange(unset())
        return
      }
      props.onChange(
        set({
          ...(next?.green ? { green: next.green } : {}),
          ...(nextTees ? { tees: nextTees } : {}),
          ...(nextMarkers ? { markers: nextMarkers } : {}),
          ...(nextEdges ? { greenEdges: nextEdges } : {}),
        }),
      )
    },
    [props],
  )

  const commitParts = useCallback(
    (patch: {
      green?: LandingZonePoint | null
      tees?: TeeItem[] | null
      markers?: MarkerItem[] | null
      greenEdges?: GreenEdgeItem[] | null
    }) => {
      commit({
        green: patch.green === undefined ? green : patch.green,
        tees: patch.tees === undefined ? tees : patch.tees,
        markers: patch.markers === undefined ? markers : patch.markers,
        greenEdges: patch.greenEdges === undefined ? greenEdges : patch.greenEdges,
      })
    },
    [commit, green, greenEdges, markers, tees],
  )

  const upsertTee = useCallback(
    (teeIndex: number, point: LandingZonePoint) => {
      const existing = tees.findIndex((tee) => tee.teeIndex === teeIndex)
      if (existing >= 0) {
        commitParts({
          tees: tees.map((tee, i) =>
            i === existing ? { ...tee, x: point.x, y: point.y } : tee,
          ),
        })
        return
      }
      commitParts({
        tees: [
          ...tees,
          {
            _type: 'landingZoneTee',
            _key: makeTeeKey(teeIndex),
            teeIndex,
            x: point.x,
            y: point.y,
          },
        ],
      })
    },
    [commitParts, tees],
  )

  const addMarker = useCallback(
    (point: LandingZonePoint, yards: number, yardsFromTee: number) => {
      commitParts({
        markers: [
          ...markers,
          {
            _type: 'landingZoneMarker',
            _key: makeMarkerKey(markers.length),
            x: point.x,
            y: point.y,
            yards,
            yardsFromTee,
          },
        ],
      })
    },
    [commitParts, markers],
  )

  const updateMarker = useCallback(
    (index: number, patch: Partial<LandingZoneMarker>) => {
      commitParts({
        markers: markers.map((marker, i) =>
          i === index ? { ...marker, ...patch } : marker,
        ),
      })
    },
    [commitParts, markers],
  )

  const removeMarker = useCallback(
    (index: number) => {
      commitParts({
        markers: markers.filter((_, i) => i !== index),
      })
    },
    [commitParts, markers],
  )

  const upsertGreenEdge = useCallback(
    (side: GreenEdgeSide, point: LandingZonePoint, yards: number) => {
      const existing = greenEdges.findIndex((edge) => edge.side === side)
      if (existing >= 0) {
        commitParts({
          greenEdges: greenEdges.map((edge, i) =>
            i === existing ? { ...edge, x: point.x, y: point.y, yards } : edge,
          ),
        })
        return
      }
      commitParts({
        greenEdges: [
          ...greenEdges,
          {
            _type: 'landingZoneGreenEdge',
            _key: makeGreenEdgeKey(side),
            side,
            x: point.x,
            y: point.y,
            yards,
          },
        ],
      })
    },
    [commitParts, greenEdges],
  )

  const updateGreenEdge = useCallback(
    (index: number, patch: Partial<LandingZoneGreenEdge>) => {
      commitParts({
        greenEdges: greenEdges.map((edge, i) =>
          i === index ? { ...edge, ...patch } : edge,
        ),
      })
    },
    [commitParts, greenEdges],
  )

  const removeGreenEdge = useCallback(
    (index: number) => {
      commitParts({
        greenEdges: greenEdges.filter((_, i) => i !== index),
      })
    },
    [commitParts, greenEdges],
  )

  const handleCanvasPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!mediaRect || !containerRef.current || dragging) return
      const rect = containerRef.current.getBoundingClientRect()
      const coords = pointerToMediaPercent(event.clientX, event.clientY, rect, mediaRect)
      if (!coords) return

      if (tool === 'green') {
        commitParts({ green: coords })
        return
      }

      if (tool === 'tee') {
        upsertTee(selectedTeeIndex, coords)
        return
      }

      if (!green) {
        window.alert('Set the green center first, then place distance markers.')
        return
      }
      if (tool === 'greenEdges') {
        const yards = promptForYards(pendingGreenEdgeYards)
        if (yards == null) return
        setPendingGreenEdgeYards(yards)
        upsertGreenEdge(selectedGreenEdgeSide, coords, yards)
        return
      }
      if (tees.length === 0) {
        window.alert('Place at least one tee (furthest back) before adding distance markers.')
        return
      }

      const yardages = promptForMarkerYardages({
        fromGreen: pendingYards,
        fromTee: pendingYardsFromTee,
      })
      if (yardages == null) return
      setPendingYards(yardages.yards)
      setPendingYardsFromTee(yardages.yardsFromTee)
      addMarker(coords, yardages.yards, yardages.yardsFromTee)
    },
    [
      addMarker,
      commitParts,
      dragging,
      green,
      mediaRect,
      pendingGreenEdgeYards,
      pendingYards,
      pendingYardsFromTee,
      selectedGreenEdgeSide,
      selectedTeeIndex,
      tees.length,
      tool,
      upsertGreenEdge,
      upsertTee,
    ],
  )

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!dragging || !mediaRect || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const coords = pointerToMediaPercent(event.clientX, event.clientY, rect, mediaRect)
      if (!coords) return

      if (dragging.kind === 'green') {
        commitParts({ green: coords })
        return
      }
      if (dragging.kind === 'tee') {
        const tee = tees[dragging.index]
        if (!tee) return
        upsertTee(tee.teeIndex, coords)
        return
      }
      if (dragging.kind === 'marker') {
        updateMarker(dragging.index, { x: coords.x, y: coords.y })
        return
      }
      if (dragging.kind === 'greenEdge') {
        updateGreenEdge(dragging.index, { x: coords.x, y: coords.y })
      }
    },
    [
      commitParts,
      dragging,
      mediaRect,
      tees,
      updateGreenEdge,
      updateMarker,
      upsertTee,
    ],
  )

  const handlePointerUp = useCallback(() => {
    setDragging(null)
  }, [])

  if (!assetRef) {
    return (
      <Card padding={3} radius={2} tone="caution">
        <Text size={1}>
          Upload a hole graphic above first, then place the green, tee points,
          fairway distances, and green edges.
        </Text>
      </Card>
    )
  }

  return (
    <Stack space={3}>
      <Flex gap={2} wrap="wrap" align="center">
        <Button
          text="Green"
          mode={tool === 'green' ? 'default' : 'ghost'}
          tone={tool === 'green' ? 'primary' : 'default'}
          onClick={() => setTool('green')}
        />
        <Button
          text="Tee"
          mode={tool === 'tee' ? 'default' : 'ghost'}
          tone={tool === 'tee' ? 'primary' : 'default'}
          onClick={() => setTool('tee')}
        />
        <Button
          text="Distances"
          mode={tool === 'markers' ? 'default' : 'ghost'}
          tone={tool === 'markers' ? 'primary' : 'default'}
          onClick={() => setTool('markers')}
        />
        <Button
          text="Green edges"
          mode={tool === 'greenEdges' ? 'default' : 'ghost'}
          tone={tool === 'greenEdges' ? 'primary' : 'default'}
          onClick={() => setTool('greenEdges')}
        />
        <Button
          text="Clear all"
          tone="critical"
          mode="ghost"
          disabled={
            !green && tees.length === 0 && markers.length === 0 && greenEdges.length === 0
          }
          onClick={() => commit(null)}
        />
        <Button
          text="Remove last distance"
          mode="ghost"
          disabled={markers.length === 0}
          onClick={() => removeMarker(markers.length - 1)}
        />
        {tool === 'tee' ? (
          <Flex align="center" gap={2} wrap="wrap">
            {teeOptions.map((option) => (
              <Button
                key={option.index}
                text={option.name}
                mode={selectedTeeIndex === option.index ? 'default' : 'ghost'}
                tone={selectedTeeIndex === option.index ? 'primary' : 'default'}
                style={
                  selectedTeeIndex === option.index
                    ? { backgroundColor: option.color, borderColor: option.color }
                    : { borderColor: option.color }
                }
                onClick={() => setSelectedTeeIndex(option.index)}
              />
            ))}
          </Flex>
        ) : null}
        {tool === 'greenEdges' ? (
          <Flex align="center" gap={2} wrap="wrap">
            {GREEN_EDGE_SIDES.map((side) => (
              <Button
                key={side}
                text={GREEN_EDGE_LABELS[side]}
                mode={selectedGreenEdgeSide === side ? 'default' : 'ghost'}
                tone={selectedGreenEdgeSide === side ? 'primary' : 'default'}
                onClick={() => {
                  setSelectedGreenEdgeSide(side)
                  setPendingGreenEdgeYards(DEFAULT_GREEN_EDGE_YARDS[side])
                }}
              />
            ))}
            <Flex align="center" gap={2}>
              <Text size={1} muted>
                Yards to center
              </Text>
              <TextInput
                type="number"
                value={String(pendingGreenEdgeYards)}
                onChange={(event) => {
                  const next = Number.parseFloat(event.currentTarget.value)
                  if (Number.isFinite(next) && next > 0) {
                    setPendingGreenEdgeYards(Math.round(next))
                  }
                }}
                style={{ width: '5rem' }}
              />
            </Flex>
          </Flex>
        ) : null}
        {tool === 'markers' ? (
          <Flex align="center" gap={3} wrap="wrap">
            <Flex align="center" gap={2}>
              <Text size={1} muted>
                Next from green
              </Text>
              <TextInput
                type="number"
                value={String(pendingYards)}
                onChange={(event) => {
                  const next = Number.parseFloat(event.currentTarget.value)
                  if (Number.isFinite(next) && next > 0) setPendingYards(Math.round(next))
                }}
                style={{ width: '5rem' }}
              />
            </Flex>
            <Flex align="center" gap={2}>
              <Text size={1} muted>
                Next from tee
              </Text>
              <TextInput
                type="number"
                value={pendingYardsFromTee != null ? String(pendingYardsFromTee) : ''}
                placeholder="—"
                onChange={(event) => {
                  const raw = event.currentTarget.value.trim()
                  if (!raw) {
                    setPendingYardsFromTee(null)
                    return
                  }
                  const next = Number.parseFloat(raw)
                  if (Number.isFinite(next) && next >= 0) {
                    setPendingYardsFromTee(Math.round(next))
                  }
                }}
                style={{ width: '5rem' }}
              />
            </Flex>
          </Flex>
        ) : null}
        <Flex align="center" gap={1}>
          <Button text="−" mode="ghost" disabled={zoom <= ZOOM_MIN} onClick={zoomOut} aria-label="Zoom out" />
          <Text size={1} muted style={{ minWidth: '3rem', textAlign: 'center' }}>
            {Math.round(zoom * 100)}%
          </Text>
          <Button text="+" mode="ghost" disabled={zoom >= ZOOM_MAX} onClick={zoomIn} aria-label="Zoom in" />
          <Button text="Reset" mode="ghost" disabled={zoom === 1} onClick={zoomReset} />
        </Flex>
      </Flex>

      <Text size={1} muted>
        {holeNumber ? `Hole ${holeNumber}: ` : ''}
        {tool === 'green'
          ? 'Click the center of the green. Drag the green marker to adjust.'
          : tool === 'tee'
            ? `Click to place ${teeOptions[selectedTeeIndex]?.name ?? `Tee ${selectedTeeIndex + 1}`}. Drag tee markers to adjust.`
            : tool === 'greenEdges'
              ? `Click the ${GREEN_EDGE_LABELS[selectedGreenEdgeSide].toLowerCase()} edge of the green, then enter yards to center. Drag to move; double-click to edit; Shift+double-click to remove.`
            : 'Click a fairway point, then enter yards from the green and from the furthest-back tee. Drag to move; double-click to edit; Shift+double-click to remove.'}
        {' '}
        Use + / − to zoom for precise placement.
      </Text>

      {!mediaUrl ? (
        <Card padding={3} radius={2} tone="transparent">
          <Text size={1} muted>
            Loading hole graphic preview…
          </Text>
        </Card>
      ) : (
        <Box
          ref={viewportRef}
          style={{
            width: '100%',
            maxHeight: 'min(70vh, 640px)',
            borderRadius: '6px',
            overflow: 'auto',
            background: 'var(--card-muted-bg-color, #1a1a1a)',
            border: '1px solid var(--card-border-color, rgba(255,255,255,0.08))',
          }}
        >
          <div
            ref={containerRef}
            onPointerDown={handleCanvasPointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            style={{
              position: 'relative',
              width: `${zoom * 100}%`,
              minWidth: '100%',
              aspectRatio: '1 / 1.2',
              cursor: 'crosshair',
              userSelect: 'none',
              touchAction: 'none',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={mediaRef}
              src={mediaUrl}
              alt={holeGraphic?.alt || `Hole ${holeNumber ?? ''} graphic`}
              onLoad={handleMediaLoad}
              draggable={false}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                pointerEvents: 'none',
              }}
            />

            {mediaRect && green ? (
              <svg
                width={mediaRect.width}
                height={mediaRect.height}
                viewBox={`0 0 ${mediaRect.width} ${mediaRect.height}`}
                style={{
                  position: 'absolute',
                  left: mediaRect.left,
                  top: mediaRect.top,
                  overflow: 'visible',
                  pointerEvents: 'none',
                }}
              >
                {markers.map((marker) => {
                  const gx = (green.x / 100) * mediaRect.width
                  const gy = (green.y / 100) * mediaRect.height
                  const mx = (marker.x / 100) * mediaRect.width
                  const my = (marker.y / 100) * mediaRect.height
                  return (
                    <g key={marker._key}>
                      <line
                        x1={gx}
                        y1={gy}
                        x2={mx}
                        y2={my}
                        stroke="rgba(56, 189, 248, 0.55)"
                        strokeWidth={1.5}
                        strokeDasharray="5 4"
                      />
                      <text
                        x={mx + 10}
                        y={my + 4}
                        fill="#e0f2fe"
                        fontSize={12}
                        fontWeight={700}
                      >
                        {marker.yards}
                      </text>
                    </g>
                  )
                })}
              </svg>
            ) : null}

            {mediaRect && green ? (
              <button
                type="button"
                aria-label="Green center"
                onPointerDown={(event) => {
                  event.stopPropagation()
                  event.currentTarget.setPointerCapture(event.pointerId)
                  setDragging({ kind: 'green' })
                }}
                style={{
                  position: 'absolute',
                  left: mediaRect.left + (green.x / 100) * mediaRect.width,
                  top: mediaRect.top + (green.y / 100) * mediaRect.height,
                  width: 16,
                  height: 16,
                  marginLeft: -8,
                  marginTop: -8,
                  borderRadius: '9999px',
                  border: '2px solid #fff',
                  background: '#22c55e',
                  cursor: 'grab',
                  zIndex: 3,
                }}
              />
            ) : null}

            {mediaRect
              ? tees.map((tee, index) => {
                  const option = teeOptions.find((item) => item.index === tee.teeIndex)
                  return (
                    <button
                      key={tee._key}
                      type="button"
                      aria-label={option?.name ?? `Tee ${tee.teeIndex + 1}`}
                      title={option?.name ?? `Tee ${tee.teeIndex + 1}`}
                      onPointerDown={(event) => {
                        event.stopPropagation()
                        event.currentTarget.setPointerCapture(event.pointerId)
                        setDragging({ kind: 'tee', index })
                        setSelectedTeeIndex(tee.teeIndex)
                      }}
                      style={{
                        position: 'absolute',
                        left: mediaRect.left + (tee.x / 100) * mediaRect.width,
                        top: mediaRect.top + (tee.y / 100) * mediaRect.height,
                        width: 14,
                        height: 14,
                        marginLeft: -7,
                        marginTop: -7,
                        borderRadius: '9999px',
                        border: '2px solid #fff',
                        background: option?.color ?? '#CF8018',
                        cursor: 'grab',
                        zIndex: 3,
                      }}
                    />
                  )
                })
              : null}

            {mediaRect
              ? markers.map((marker, index) => (
                  <button
                    key={marker._key}
                    type="button"
                    aria-label={
                      Number.isFinite(marker.yardsFromTee)
                        ? `${marker.yards} yards from green, ${marker.yardsFromTee} from tee`
                        : `${marker.yards} yards from green`
                    }
                    title={
                      Number.isFinite(marker.yardsFromTee)
                        ? `${marker.yards} yd green · ${marker.yardsFromTee} yd tee`
                        : `${marker.yards} yd from green`
                    }
                    onPointerDown={(event) => {
                      event.stopPropagation()
                      event.currentTarget.setPointerCapture(event.pointerId)
                      setDragging({ kind: 'marker', index })
                    }}
                    onDoubleClick={(event) => {
                      event.stopPropagation()
                      if (event.shiftKey) {
                        removeMarker(index)
                        return
                      }
                      const yardages = promptForMarkerYardages({
                        fromGreen: marker.yards,
                        fromTee:
                          Number.isFinite(marker.yardsFromTee)
                            ? Number(marker.yardsFromTee)
                            : pendingYardsFromTee,
                      })
                      if (!yardages) return
                      updateMarker(index, yardages)
                      setPendingYards(yardages.yards)
                      setPendingYardsFromTee(yardages.yardsFromTee)
                    }}
                    style={{
                      position: 'absolute',
                      left: mediaRect.left + (marker.x / 100) * mediaRect.width,
                      top: mediaRect.top + (marker.y / 100) * mediaRect.height,
                      width: 12,
                      height: 12,
                      marginLeft: -6,
                      marginTop: -6,
                      borderRadius: '9999px',
                      border: '2px solid #fff',
                      background: Number.isFinite(marker.yardsFromTee)
                        ? '#38bdf8'
                        : '#f59e0b',
                      cursor: 'grab',
                      zIndex: 2,
                    }}
                  />
                ))
              : null}

            {mediaRect
              ? greenEdges.map((edge, index) => (
                  <button
                    key={edge._key}
                    type="button"
                    aria-label={`${GREEN_EDGE_LABELS[edge.side]} green edge, ${edge.yards} yards from center`}
                    title={`${GREEN_EDGE_LABELS[edge.side]} · ${edge.yards} yd`}
                    onPointerDown={(event) => {
                      event.stopPropagation()
                      event.currentTarget.setPointerCapture(event.pointerId)
                      setDragging({ kind: 'greenEdge', index })
                      setSelectedGreenEdgeSide(edge.side)
                      setTool('greenEdges')
                    }}
                    onDoubleClick={(event) => {
                      event.stopPropagation()
                      if (event.shiftKey) {
                        removeGreenEdge(index)
                        return
                      }
                      const yards = promptForYards(edge.yards)
                      if (yards == null) return
                      updateGreenEdge(index, { yards })
                      setPendingGreenEdgeYards(yards)
                    }}
                    style={{
                      position: 'absolute',
                      left: mediaRect.left + (edge.x / 100) * mediaRect.width,
                      top: mediaRect.top + (edge.y / 100) * mediaRect.height,
                      width: 14,
                      height: 14,
                      marginLeft: -7,
                      marginTop: -7,
                      borderRadius: '4px',
                      border: '2px solid #fff',
                      background: '#16a34a',
                      color: '#fff',
                      fontSize: 8,
                      fontWeight: 700,
                      lineHeight: '10px',
                      cursor: 'grab',
                      zIndex: 4,
                    }}
                  >
                    {edge.side[0]?.toUpperCase()}
                  </button>
                ))
              : null}
          </div>
        </Box>
      )}
    </Stack>
  )
}
