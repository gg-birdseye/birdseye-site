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
  arcClipIsReady,
  buildClippedCirclePath,
  buildHoleGraphicPlayableMask,
  clipPolygonToSvgPoints,
  pinToMediaPx,
  resolveArcAllowTest,
  sortMarkersByYards,
  suggestNextYardage,
  yardageMarkerRadiusPx,
  type HoleGraphicPlayableMask,
  type YardageArcClipPoint,
  type YardageArcMarker,
  type YardageArcPin,
} from '../../lib/yardage-arcs'

type MarkerItem = YardageArcMarker & {
  _type: 'yardageArcMarker'
  _key: string
}

type ClipPointItem = YardageArcClipPoint & {
  _type: 'yardageArcClipPoint'
  _key: string
}

type YardageArcsValue = {
  pin?: YardageArcPin | null
  markers?: MarkerItem[] | null
  arcClip?: ClipPointItem[] | null
} | null

type HoleGraphicFileValue = {
  asset?: { _ref?: string }
  alt?: string
} | null

type EditorTool = 'markers' | 'clip'

type DragTarget =
  | { kind: 'pin' }
  | { kind: 'marker'; index: number }
  | { kind: 'clip'; index: number }
  | null

const ZOOM_MIN = 1
const ZOOM_MAX = 3
const ZOOM_STEP = 0.25

function makeMarkerKey(index: number) {
  return `yardage-arc-marker-${index + 1}`
}

function makeClipKey(index: number) {
  return `yardage-arc-clip-${index + 1}`
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
  const raw = window.prompt('Yards to pin', String(defaultYards))
  if (raw == null) return null
  const value = Number.parseFloat(raw.trim())
  if (!Number.isFinite(value) || value <= 0) return null
  return Math.round(value)
}

function normalizeClipPoints(points: ClipPointItem[] | null | undefined): ClipPointItem[] {
  return (points ?? []).map((point, index) => ({
    _type: 'yardageArcClipPoint' as const,
    _key: point._key || makeClipKey(index),
    x: point.x,
    y: point.y,
  }))
}

export function YardageArcEditor(props: ObjectInputProps) {
  const parentPath = useMemo(() => props.path.slice(0, -1), [props.path])
  const holeGraphic = useFormValue([...parentPath, 'holeGraphic']) as HoleGraphicFileValue
  const holeNumber = useFormValue([...parentPath, 'holeNumber']) as number | undefined
  const assetRef = holeGraphic?.asset?._ref

  const client = useClient({ apiVersion: '2024-01-01' })
  const viewportRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const mediaRef = useRef<HTMLImageElement>(null)

  const [mediaUrl, setMediaUrl] = useState<string | null>(null)
  const [mediaRect, setMediaRect] = useState<ContainedMediaRect | null>(null)
  const [playableMask, setPlayableMask] = useState<HoleGraphicPlayableMask | null>(null)
  const [dragging, setDragging] = useState<DragTarget>(null)
  const [pendingYards, setPendingYards] = useState(100)
  const [zoom, setZoom] = useState(1)
  const [tool, setTool] = useState<EditorTool>('markers')

  const value = (props.value ?? null) as YardageArcsValue
  const pin = value?.pin ?? null
  const markers = (value?.markers ?? []) as MarkerItem[]
  const arcClip = useMemo(
    () => normalizeClipPoints(value?.arcClip),
    [value?.arcClip],
  )
  const hasCustomClip: boolean = arcClipIsReady(arcClip)

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

  const updateContentMask = useCallback(() => {
    if (hasCustomClip) {
      setPlayableMask(null)
      return
    }
    const media = mediaRef.current
    if (!media || !media.complete || media.naturalWidth < 1) {
      setPlayableMask(null)
      return
    }
    setPlayableMask(buildHoleGraphicPlayableMask(media))
  }, [hasCustomClip])

  const handleMediaLoad = useCallback(() => {
    updateMediaRect()
    updateContentMask()
  }, [updateContentMask, updateMediaRect])

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      updateMediaRect()
      updateContentMask()
    })
    window.addEventListener('resize', updateMediaRect)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', updateMediaRect)
    }
  }, [mediaUrl, updateContentMask, updateMediaRect, zoom])

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
    (next: YardageArcsValue) => {
      const nextClip = next?.arcClip?.length ? next.arcClip : undefined
      const nextMarkers = next?.markers?.length ? next.markers : undefined
      if (!next?.pin && !nextMarkers && !nextClip) {
        props.onChange(unset())
        return
      }
      props.onChange(
        set({
          ...(next?.pin ? { pin: next.pin } : {}),
          ...(nextMarkers ? { markers: nextMarkers } : {}),
          ...(nextClip ? { arcClip: nextClip } : {}),
        }),
      )
    },
    [props],
  )

  const commitParts = useCallback(
    (patch: {
      pin?: YardageArcPin | null
      markers?: MarkerItem[] | null
      arcClip?: ClipPointItem[] | null
    }) => {
      commit({
        pin: patch.pin === undefined ? pin : patch.pin,
        markers: patch.markers === undefined ? markers : patch.markers,
        arcClip: patch.arcClip === undefined ? arcClip : patch.arcClip,
      })
    },
    [arcClip, commit, markers, pin],
  )

  const setPin = useCallback(
    (nextPin: YardageArcPin) => {
      commitParts({ pin: nextPin })
    },
    [commitParts],
  )

  const setMarkers = useCallback(
    (nextMarkers: MarkerItem[]) => {
      commitParts({ markers: nextMarkers })
    },
    [commitParts],
  )

  const setArcClip = useCallback(
    (nextClip: ClipPointItem[]) => {
      commitParts({ arcClip: nextClip })
    },
    [commitParts],
  )

  const addMarker = useCallback(
    (x: number, y: number) => {
      const yards = promptForYards(pendingYards)
      if (yards == null) return
      const next: MarkerItem = {
        _type: 'yardageArcMarker',
        _key: makeMarkerKey(markers.length),
        x,
        y,
        yards,
      }
      setMarkers([...markers, next])
    },
    [markers, pendingYards, setMarkers],
  )

  const addClipPoint = useCallback(
    (x: number, y: number) => {
      const next: ClipPointItem = {
        _type: 'yardageArcClipPoint',
        _key: makeClipKey(arcClip.length),
        x,
        y,
      }
      setArcClip([...arcClip, next])
    },
    [arcClip, setArcClip],
  )

  const updateMarker = useCallback(
    (index: number, patch: Partial<MarkerItem>) => {
      setMarkers(
        markers.map((marker, i) => (i === index ? { ...marker, ...patch } : marker)),
      )
    },
    [markers, setMarkers],
  )

  const updateClipPoint = useCallback(
    (index: number, patch: Partial<ClipPointItem>) => {
      setArcClip(
        arcClip.map((point, i) => (i === index ? { ...point, ...patch } : point)),
      )
    },
    [arcClip, setArcClip],
  )

  const removeMarker = useCallback(
    (index: number) => {
      setMarkers(markers.filter((_, i) => i !== index))
    },
    [markers, setMarkers],
  )

  const removeClipPoint = useCallback(
    (index: number) => {
      setArcClip(arcClip.filter((_, i) => i !== index))
    },
    [arcClip, setArcClip],
  )

  const handleCanvasPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!mediaRect || !containerRef.current || dragging) return
      const rect = containerRef.current.getBoundingClientRect()
      const coords = pointerToMediaPercent(event.clientX, event.clientY, rect, mediaRect)
      if (!coords) return

      if (tool === 'clip') {
        addClipPoint(coords.x, coords.y)
        return
      }

      if (!pin) {
        setPin(coords)
        return
      }
      addMarker(coords.x, coords.y)
    },
    [addClipPoint, addMarker, dragging, mediaRect, pin, setPin, tool],
  )

  const handlePinPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      event.stopPropagation()
      event.currentTarget.setPointerCapture(event.pointerId)
      setDragging({ kind: 'pin' })
    },
    [],
  )

  const handleMarkerPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>, index: number) => {
      event.stopPropagation()
      event.currentTarget.setPointerCapture(event.pointerId)
      setDragging({ kind: 'marker', index })
    },
    [],
  )

  const handleClipPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>, index: number) => {
      event.stopPropagation()
      event.currentTarget.setPointerCapture(event.pointerId)
      setDragging({ kind: 'clip', index })
    },
    [],
  )

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!dragging || !mediaRect || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const coords = pointerToMediaPercent(event.clientX, event.clientY, rect, mediaRect)
      if (!coords) return

      if (dragging.kind === 'pin') {
        setPin(coords)
        return
      }
      if (dragging.kind === 'clip') {
        updateClipPoint(dragging.index, { x: coords.x, y: coords.y })
        return
      }
      updateMarker(dragging.index, { x: coords.x, y: coords.y })
    },
    [dragging, mediaRect, setPin, updateClipPoint, updateMarker],
  )

  const handlePointerUp = useCallback(() => {
    setDragging(null)
  }, [])

  const sortedMarkers = useMemo(() => sortMarkersByYards(markers), [markers])

  const editorArcPaths = useMemo(() => {
    if (!pin || !mediaRect) return []
    const center = pinToMediaPx(pin, mediaRect.width, mediaRect.height)
    const isAllowed = resolveArcAllowTest(
      arcClip,
      playableMask,
      mediaRect.width,
      mediaRect.height,
    )
    return sortedMarkers.map((marker) => {
      const radius = yardageMarkerRadiusPx(
        pin,
        marker,
        mediaRect.width,
        mediaRect.height,
      )
      return {
        key: marker._key,
        pathD: buildClippedCirclePath(center.x, center.y, radius, isAllowed),
        labelX: (marker.x / 100) * mediaRect.width,
        labelY: (marker.y / 100) * mediaRect.height,
        yards: marker.yards,
      }
    })
  }, [arcClip, mediaRect, pin, playableMask, sortedMarkers])

  const clipSvgPoints =
    mediaRect && arcClip.length >= 2
      ? clipPolygonToSvgPoints(arcClip, mediaRect.width, mediaRect.height)
      : ''

  if (!assetRef) {
    return (
      <Card padding={3} radius={2} tone="caution">
        <Text size={1}>
          Upload a hole graphic above first, then place the pin and yardage arcs on it.
        </Text>
      </Card>
    )
  }

  return (
    <Stack space={3}>
      <Flex gap={2} wrap="wrap" align="center">
        <Button
          text="Place markers"
          mode={tool === 'markers' ? 'default' : 'ghost'}
          tone={tool === 'markers' ? 'primary' : 'default'}
          onClick={() => setTool('markers')}
        />
        <Button
          text="Draw clip region"
          mode={tool === 'clip' ? 'default' : 'ghost'}
          tone={tool === 'clip' ? 'primary' : 'default'}
          onClick={() => setTool('clip')}
        />
        <Button
          text="Clear clip"
          mode="ghost"
          disabled={arcClip.length === 0}
          onClick={() => setArcClip([])}
        />
        <Button
          text="Clear all"
          tone="critical"
          mode="ghost"
          disabled={!pin && markers.length === 0 && arcClip.length === 0}
          onClick={() => commit(null)}
        />
        <Button
          text="Clear pin"
          mode="ghost"
          disabled={!pin}
          onClick={() => commitParts({ pin: null })}
        />
        <Button
          text="Remove last marker"
          mode="ghost"
          disabled={markers.length === 0}
          onClick={() => removeMarker(markers.length - 1)}
        />
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
        <Flex align="center" gap={1}>
          <Button
            text="−"
            mode="ghost"
            disabled={zoom <= ZOOM_MIN}
            onClick={zoomOut}
            aria-label="Zoom out"
          />
          <Text size={1} muted style={{ minWidth: '3rem', textAlign: 'center' }}>
            {Math.round(zoom * 100)}%
          </Text>
          <Button
            text="+"
            mode="ghost"
            disabled={zoom >= ZOOM_MAX}
            onClick={zoomIn}
            aria-label="Zoom in"
          />
          <Button
            text="Reset"
            mode="ghost"
            disabled={zoom === 1}
            onClick={zoomReset}
          />
        </Flex>
      </Flex>

      <Text size={1} muted>
        {holeNumber ? `Hole ${holeNumber}: ` : ''}
        {tool === 'clip'
          ? hasCustomClip
            ? 'Custom clip is active (replaces auto green). Click to add vertices, drag handles to adjust, double-click a handle to remove.'
            : `Click to add clip vertices (${arcClip.length}/3 minimum). When ready, arcs will only appear inside this polygon.`
          : !pin
            ? 'Click the center of the green to set the pin.'
            : 'Click the graphic to add a yardage arc (you’ll be prompted for yards). Drag markers to adjust. Double-click a marker to remove it.'}
        {' '}
        Use + / − to zoom for more precise placement.
        {hasCustomClip && tool === 'markers'
          ? ' Custom clip region is active for this hole.'
          : !hasCustomClip && tool === 'markers'
            ? ' Arcs use auto-detected green unless you draw a clip region.'
            : ''}
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
          <Box
            ref={containerRef}
            onPointerDown={handleCanvasPointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            style={{
              position: 'relative',
              width: `${zoom * 100}%`,
              aspectRatio: '16 / 10',
              minHeight: '240px',
              cursor: 'crosshair',
              touchAction: 'none',
            }}
          >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={mediaRef}
            src={mediaUrl}
            alt={holeGraphic?.alt ?? 'Hole graphic preview'}
            onLoad={handleMediaLoad}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              pointerEvents: 'none',
              display: 'block',
            }}
          />
          {mediaRect ? (
            <>
              <Box
                style={{
                  position: 'absolute',
                  left: `${mediaRect.left}px`,
                  top: `${mediaRect.top}px`,
                  width: `${mediaRect.width}px`,
                  height: `${mediaRect.height}px`,
                  overflow: 'hidden',
                  pointerEvents: 'none',
                }}
              >
                <svg
                  width={mediaRect.width}
                  height={mediaRect.height}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    pointerEvents: 'none',
                    overflow: 'hidden',
                  }}
                >
                  {arcClip.length >= 2 ? (
                    <polygon
                      points={clipSvgPoints}
                      fill={
                        hasCustomClip
                          ? 'rgba(56, 189, 248, 0.14)'
                          : 'rgba(56, 189, 248, 0.08)'
                      }
                      stroke="rgba(56, 189, 248, 0.9)"
                      strokeWidth={1.5}
                      strokeDasharray={hasCustomClip ? undefined : '4 3'}
                    />
                  ) : null}
                  {pin
                    ? editorArcPaths.map((arc) =>
                        arc.pathD ? (
                          <path
                            key={arc.key}
                            d={arc.pathD}
                            fill="none"
                            stroke="rgba(255,255,255,0.85)"
                            strokeWidth={1.75}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeDasharray="6 5"
                          />
                        ) : null,
                      )
                    : null}
                </svg>
                {pin ? (
                  <svg
                    width={mediaRect.width}
                    height={mediaRect.height}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      width: '100%',
                      height: '100%',
                      pointerEvents: 'none',
                      overflow: 'visible',
                      zIndex: 1,
                    }}
                  >
                    {editorArcPaths.map((arc) => (
                      <g key={`label-${arc.key}`}>
                        <rect
                          x={arc.labelX - 18}
                          y={arc.labelY - 22}
                          width={36}
                          height={16}
                          rx={3}
                          fill="rgba(0,0,0,0.55)"
                        />
                        <text
                          x={arc.labelX}
                          y={arc.labelY - 10}
                          textAnchor="middle"
                          fill="#fff"
                          fontSize={11}
                          fontWeight={700}
                          fontFamily="ui-sans-serif, system-ui, sans-serif"
                        >
                          {arc.yards}
                        </text>
                      </g>
                    ))}
                  </svg>
                ) : null}
              </Box>

              <Box
                style={{
                  position: 'absolute',
                  left: `${mediaRect.left}px`,
                  top: `${mediaRect.top}px`,
                  width: `${mediaRect.width}px`,
                  height: `${mediaRect.height}px`,
                }}
              >
                {arcClip.map((point, index) => (
                  <button
                    key={point._key}
                    type="button"
                    aria-label={`Clip vertex ${index + 1}`}
                    onPointerDown={(event) => handleClipPointerDown(event, index)}
                    onDoubleClick={(event) => {
                      event.stopPropagation()
                      removeClipPoint(index)
                    }}
                    style={{
                      position: 'absolute',
                      left: `${point.x}%`,
                      top: `${point.y}%`,
                      transform: 'translate(-50%, -50%)',
                      width: '10px',
                      height: '10px',
                      borderRadius: '2px',
                      border: '2px solid #fff',
                      background: '#38bdf8',
                      cursor: 'grab',
                      padding: 0,
                      zIndex: 4,
                    }}
                  />
                ))}

                {pin ? (
                  <button
                    type="button"
                    aria-label="Pin / green center"
                    onPointerDown={handlePinPointerDown}
                    style={{
                      position: 'absolute',
                      left: `${pin.x}%`,
                      top: `${pin.y}%`,
                      transform: 'translate(-50%, -50%)',
                      width: '16px',
                      height: '16px',
                      borderRadius: '999px',
                      border: '2px solid #fff',
                      background: '#16a34a',
                      cursor: 'grab',
                      padding: 0,
                      zIndex: 3,
                    }}
                  />
                ) : null}

                {markers.map((marker, index) => (
                  <button
                    key={marker._key ?? makeMarkerKey(index)}
                    type="button"
                    aria-label={`${marker.yards} yard marker`}
                    onPointerDown={(event) => handleMarkerPointerDown(event, index)}
                    onDoubleClick={(event) => {
                      event.stopPropagation()
                      removeMarker(index)
                    }}
                    style={{
                      position: 'absolute',
                      left: `${marker.x}%`,
                      top: `${marker.y}%`,
                      transform: 'translate(-50%, -50%)',
                      width: '12px',
                      height: '12px',
                      borderRadius: '999px',
                      border: '2px solid #fff',
                      background: '#f59e0b',
                      cursor: 'grab',
                      padding: 0,
                      zIndex: 2,
                    }}
                  />
                ))}
              </Box>
            </>
          ) : null}
          </Box>
        </Box>
      )}

      {props.renderDefault(props)}
    </Stack>
  )
}
