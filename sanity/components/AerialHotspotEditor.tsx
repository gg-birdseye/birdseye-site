'use client'

import { Box, Button, Card, Flex, Stack, Text } from '@sanity/ui'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { set, unset, useClient, useFormValue } from 'sanity'
import type { ArrayOfObjectsInputProps } from 'sanity'
import {
  containedMediaRect,
  pointerToMediaPercent,
  type ContainedMediaRect,
} from '../../lib/aerial-map-geometry'

type HotspotItem = {
  _type: 'aerialMapHotspot'
  _key: string
  holeNumber: number
  x: number
  y: number
}

type AerialMapFileValue = {
  asset?: { _ref?: string }
  alt?: string
} | null

function makeHotspotKey(holeNumber: number) {
  return `aerial-hotspot-${holeNumber}`
}

function upsertHotspot(
  hotspots: HotspotItem[],
  holeNumber: number,
  x: number,
  y: number,
): HotspotItem[] {
  const existing = hotspots.find((item) => item.holeNumber === holeNumber)
  if (existing) {
    return hotspots.map((item) =>
      item.holeNumber === holeNumber ? { ...item, x, y } : item,
    )
  }
  return [
    ...hotspots,
    {
      _type: 'aerialMapHotspot',
      _key: makeHotspotKey(holeNumber),
      holeNumber,
      x,
      y,
    },
  ]
}

function removeHotspot(hotspots: HotspotItem[], holeNumber: number): HotspotItem[] {
  return hotspots.filter((item) => item.holeNumber !== holeNumber)
}

function readMediaDimensions(
  element: HTMLImageElement | HTMLVideoElement,
): { width: number; height: number } | null {
  if (element instanceof HTMLVideoElement) {
    if (element.videoWidth > 0 && element.videoHeight > 0) {
      return { width: element.videoWidth, height: element.videoHeight }
    }
    return null
  }
  if (element.naturalWidth > 0 && element.naturalHeight > 0) {
    return { width: element.naturalWidth, height: element.naturalHeight }
  }
  return null
}

export function AerialHotspotEditor(props: ArrayOfObjectsInputProps) {
  const holeCount = useFormValue(['holeCount']) as number | undefined
  const aerialMap = useFormValue(['aerialMap']) as AerialMapFileValue
  const assetRef = aerialMap?.asset?._ref

  const client = useClient({ apiVersion: '2024-01-01' })
  const containerRef = useRef<HTMLDivElement>(null)
  const mediaRef = useRef<HTMLImageElement | HTMLVideoElement>(null)

  const [mediaUrl, setMediaUrl] = useState<string | null>(null)
  const [isVideo, setIsVideo] = useState(false)
  const [selectedHole, setSelectedHole] = useState(1)
  const [mediaRect, setMediaRect] = useState<ContainedMediaRect | null>(null)
  const [draggingHole, setDraggingHole] = useState<number | null>(null)

  const hotspots = (props.value ?? []) as HotspotItem[]

  useEffect(() => {
    if (!assetRef) {
      setMediaUrl(null)
      setIsVideo(false)
      return
    }

    let cancelled = false
    client
      .fetch<{ url?: string; mimeType?: string }>(
        `*[_id == $id][0]{ url, mimeType }`,
        { id: assetRef },
      )
      .then((doc) => {
        if (cancelled) return
        const url = doc?.url?.trim()
        if (!url) {
          setMediaUrl(null)
          return
        }
        const mimeType = doc?.mimeType ?? ''
        setIsVideo(mimeType.startsWith('video/') || url.toLowerCase().endsWith('.webm'))
        setMediaUrl(url)
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
    if (!container || !media) {
      setMediaRect(null)
      return
    }

    const dimensions = readMediaDimensions(media)
    if (!dimensions) {
      setMediaRect(null)
      return
    }

    setMediaRect(
      containedMediaRect(
        container.clientWidth,
        container.clientHeight,
        dimensions.width,
        dimensions.height,
      ),
    )
  }, [])

  useEffect(() => {
    updateMediaRect()
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver(updateMediaRect)
    observer.observe(container)
    return () => observer.disconnect()
  }, [mediaUrl, updateMediaRect])

  const placedCount = hotspots.length
  const holes = useMemo(
    () => Array.from({ length: holeCount ?? 0 }, (_, index) => index + 1),
    [holeCount],
  )

  const placeHotspot = useCallback(
    (holeNumber: number, x: number, y: number) => {
      props.onChange(set(upsertHotspot(hotspots, holeNumber, x, y)))
    },
    [hotspots, props],
  )

  const placeAtPointer = useCallback(
    (clientX: number, clientY: number, holeNumber: number) => {
      if (!mediaRect || !containerRef.current) return
      const point = pointerToMediaPercent(
        clientX,
        clientY,
        containerRef.current.getBoundingClientRect(),
        mediaRect,
      )
      if (!point) return
      placeHotspot(holeNumber, point.x, point.y)
    },
    [mediaRect, placeHotspot],
  )

  const handleMapPointer = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>, holeNumber: number) => {
      placeAtPointer(event.clientX, event.clientY, holeNumber)
    },
    [placeAtPointer],
  )

  const handleMarkerPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>, holeNumber: number) => {
      event.preventDefault()
      event.stopPropagation()
      setSelectedHole(holeNumber)
      setDraggingHole(holeNumber)
      event.currentTarget.setPointerCapture(event.pointerId)
    },
    [],
  )

  const handleMarkerPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>, holeNumber: number) => {
      if (draggingHole !== holeNumber) return
      placeAtPointer(event.clientX, event.clientY, holeNumber)
    },
    [draggingHole, placeAtPointer],
  )

  const handleMarkerPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (draggingHole == null) return
      setDraggingHole(null)
      event.currentTarget.releasePointerCapture(event.pointerId)
    },
    [draggingHole],
  )

  if (!holeCount || holeCount < 1) {
    return (
      <Card padding={3} tone="transparent" border>
        <Text size={1} muted>
          Select a course type above to place aerial map hotspots.
        </Text>
      </Card>
    )
  }

  if (!assetRef) {
    return (
      <Card padding={3} tone="transparent" border>
        <Text size={1} muted>
          Upload an aerial map above, then click the image to place hole markers.
        </Text>
      </Card>
    )
  }

  if (!mediaUrl) {
    return (
      <Card padding={3} tone="transparent" border>
        <Text size={1} muted>
          Loading aerial map preview…
        </Text>
      </Card>
    )
  }

  const selectedPlaced = hotspots.some((item) => item.holeNumber === selectedHole)

  return (
    <Stack space={3}>
      <Card padding={3} tone="transparent" border>
        <Stack space={3}>
          <Text size={1}>
            Select a hole, then click the map to place its marker. Drag a marker to
            reposition it. Coordinates are saved as percentages so markers stay aligned
            on every screen size.
          </Text>

          <Flex gap={1} wrap="wrap">
            {holes.map((hole) => {
              const placed = hotspots.some((item) => item.holeNumber === hole)
              const isSelected = selectedHole === hole
              return (
                <Button
                  key={hole}
                  mode={isSelected ? 'default' : 'ghost'}
                  tone={placed ? 'positive' : 'default'}
                  text={`${hole}`}
                  fontSize={1}
                  padding={2}
                  onClick={() => setSelectedHole(hole)}
                />
              )
            })}
          </Flex>

          <Flex gap={2} wrap="wrap">
            <Button
              mode="bleed"
              tone="critical"
              text={`Clear hole ${selectedHole}`}
              disabled={!selectedPlaced}
              onClick={() =>
                props.onChange(set(removeHotspot(hotspots, selectedHole)))
              }
            />
            <Button
              mode="bleed"
              tone="critical"
              text="Clear all"
              disabled={placedCount === 0}
              onClick={() => props.onChange(unset())}
            />
            <Text size={1} muted style={{ alignSelf: 'center' }}>
              {placedCount} of {holeCount} placed
            </Text>
          </Flex>
        </Stack>
      </Card>

      <Card padding={2} tone="transparent" border>
        <Box
          ref={containerRef}
          onPointerDown={(event) => {
            if (draggingHole != null) return
            handleMapPointer(event, selectedHole)
          }}
          style={{
            position: 'relative',
            width: '100%',
            aspectRatio: '16 / 10',
            maxHeight: 'min(70vh, 640px)',
            borderRadius: '6px',
            overflow: 'hidden',
            background: 'var(--card-muted-bg-color, #1a1a1a)',
            cursor: 'crosshair',
            touchAction: 'none',
          }}
        >
          {isVideo ? (
            <video
              ref={mediaRef as React.RefObject<HTMLVideoElement>}
              src={mediaUrl}
              muted
              playsInline
              preload="metadata"
              onLoadedMetadata={updateMediaRect}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                pointerEvents: 'none',
                display: 'block',
              }}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              ref={mediaRef as React.RefObject<HTMLImageElement>}
              src={mediaUrl}
              alt={aerialMap?.alt ?? 'Aerial map preview'}
              onLoad={updateMediaRect}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                pointerEvents: 'none',
                display: 'block',
              }}
            />
          )}

          {mediaRect ? (
            <Box
              style={{
                position: 'absolute',
                left: `${mediaRect.left}px`,
                top: `${mediaRect.top}px`,
                width: `${mediaRect.width}px`,
                height: `${mediaRect.height}px`,
              }}
            >
              {hotspots.map((hotspot) => {
                const isSelected = hotspot.holeNumber === selectedHole
                return (
                  <button
                    key={hotspot._key ?? makeHotspotKey(hotspot.holeNumber)}
                    type="button"
                    aria-label={`Hole ${hotspot.holeNumber}`}
                    onPointerDown={(event) =>
                      handleMarkerPointerDown(event, hotspot.holeNumber)
                    }
                    onPointerMove={(event) =>
                      handleMarkerPointerMove(event, hotspot.holeNumber)
                    }
                    onPointerUp={handleMarkerPointerUp}
                    onPointerCancel={handleMarkerPointerUp}
                    style={{
                      position: 'absolute',
                      left: `${hotspot.x}%`,
                      top: `${hotspot.y}%`,
                      transform: 'translate(-50%, -50%)',
                      width: '28px',
                      height: '28px',
                      borderRadius: '999px',
                      border: isSelected
                        ? '2px solid #fff'
                        : '2px solid rgba(255,255,255,0.85)',
                      background: isSelected ? '#2563eb' : 'rgba(37, 99, 235, 0.92)',
                      color: '#fff',
                      fontSize: '11px',
                      fontWeight: 700,
                      lineHeight: 1,
                      cursor: draggingHole === hotspot.holeNumber ? 'grabbing' : 'grab',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
                      zIndex: isSelected ? 2 : 1,
                    }}
                  >
                    {hotspot.holeNumber}
                  </button>
                )
              })}
            </Box>
          ) : null}
        </Box>
      </Card>
    </Stack>
  )
}
