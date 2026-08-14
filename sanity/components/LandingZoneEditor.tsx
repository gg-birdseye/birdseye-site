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
  suggestNextYardage,
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

type LandingZoneValue = {
  green?: LandingZonePoint | null
  tees?: TeeItem[] | null
  markers?: MarkerItem[] | null
} | null

type HoleGraphicFileValue = {
  asset?: { _ref?: string }
  alt?: string
} | null

type ScorecardDoc = {
  teeCount?: number | null
  teeSets?: Array<{ name?: string | null; color?: string | null } | null> | null
} | null

type EditorTool = 'green' | 'tee' | 'markers'

type DragTarget =
  | { kind: 'green' }
  | { kind: 'tee'; index: number }
  | { kind: 'marker'; index: number }
  | null

const ZOOM_MIN = 1
const ZOOM_MAX = 3
const ZOOM_STEP = 0.25

function makeTeeKey(index: number) {
  return `landing-zone-tee-${index}`
}

function makeMarkerKey(index: number) {
  return `landing-zone-marker-${index + 1}`
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
  const [pendingYards, setPendingYards] = useState(100)

  const value = (props.value ?? null) as LandingZoneValue
  const green = value?.green ?? null
  const tees = (value?.tees ?? []) as TeeItem[]
  const markers = (value?.markers ?? []) as MarkerItem[]

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
      if (!next?.green && !nextTees && !nextMarkers) {
        props.onChange(unset())
        return
      }
      props.onChange(
        set({
          ...(next?.green ? { green: next.green } : {}),
          ...(nextTees ? { tees: nextTees } : {}),
          ...(nextMarkers ? { markers: nextMarkers } : {}),
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
    }) => {
      commit({
        green: patch.green === undefined ? green : patch.green,
        tees: patch.tees === undefined ? tees : patch.tees,
        markers: patch.markers === undefined ? markers : patch.markers,
      })
    },
    [commit, green, markers, tees],
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
    (point: LandingZonePoint, yards: number) => {
      commitParts({
        markers: [
          ...markers,
          {
            _type: 'landingZoneMarker',
            _key: makeMarkerKey(markers.length),
            x: point.x,
            y: point.y,
            yards,
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

      const yards = promptForYards(pendingYards)
      if (yards == null) return
      setPendingYards(yards)
      addMarker(coords, yards)
    },
    [
      addMarker,
      commitParts,
      dragging,
      green,
      mediaRect,
      pendingYards,
      selectedTeeIndex,
      tool,
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
      updateMarker(dragging.index, { x: coords.x, y: coords.y })
    },
    [commitParts, dragging, mediaRect, tees, updateMarker, upsertTee],
  )

  const handlePointerUp = useCallback(() => {
    setDragging(null)
  }, [])

  if (!assetRef) {
    return (
      <Card padding={3} radius={2} tone="caution">
        <Text size={1}>
          Upload a hole graphic above first, then place the green, tee points, and
          distances from green.
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
          text="Clear all"
          tone="critical"
          mode="ghost"
          disabled={!green && tees.length === 0 && markers.length === 0}
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
        {tool === 'markers' ? (
          <Flex align="center" gap={2}>
            <Text size={1} muted>
              Next yards
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
            : 'Click a point that is a known distance from the green (e.g. 100 yd), then enter yards. Drag markers to adjust; double-click to remove.'}
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
                    aria-label={`${marker.yards} yards from green`}
                    title={`${marker.yards} yd`}
                    onPointerDown={(event) => {
                      event.stopPropagation()
                      event.currentTarget.setPointerCapture(event.pointerId)
                      setDragging({ kind: 'marker', index })
                    }}
                    onDoubleClick={(event) => {
                      event.stopPropagation()
                      removeMarker(index)
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
                      background: '#38bdf8',
                      cursor: 'grab',
                      zIndex: 2,
                    }}
                  />
                ))
              : null}
          </div>
        </Box>
      )}
    </Stack>
  )
}
