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
import { buildCameraPathPolyline } from '../../lib/camera-path'

type PathPointItem = {
  _type: 'cameraPathPoint'
  _key: string
  x: number
  y: number
  videoProgress?: number
}

function clampProgressPercent(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.min(100, Math.max(0, value))
}

/** Keep start at 0%, end at 100%, and leave midpoints as set (or even defaults). */
function withEndpointProgress(points: PathPointItem[]): PathPointItem[] {
  if (points.length === 0) return points
  return points.map((point, index, arr) => {
    if (index === 0) return { ...point, videoProgress: 0 }
    if (index === arr.length - 1) return { ...point, videoProgress: 100 }
    if (typeof point.videoProgress === 'number' && Number.isFinite(point.videoProgress)) {
      return {
        ...point,
        videoProgress: clampProgressPercent(point.videoProgress),
      }
    }
    return {
      ...point,
      videoProgress: clampProgressPercent((index / (arr.length - 1)) * 100),
    }
  })
}

type HoleGraphicFileValue = {
  asset?: { _ref?: string }
  alt?: string
} | null

function makePointKey(index: number) {
  return `camera-path-point-${index + 1}`
}

function readMediaDimensions(
  element: HTMLImageElement,
): { width: number; height: number } | null {
  if (element.naturalWidth > 0 && element.naturalHeight > 0) {
    return { width: element.naturalWidth, height: element.naturalHeight }
  }
  return null
}

export function CameraPathEditor(props: ArrayOfObjectsInputProps) {
  const parentPath = useMemo(() => props.path.slice(0, -1), [props.path])
  const holeGraphic = useFormValue([...parentPath, 'holeGraphic']) as HoleGraphicFileValue
  const holeNumber = useFormValue([...parentPath, 'holeNumber']) as number | undefined
  const assetRef = holeGraphic?.asset?._ref

  const client = useClient({ apiVersion: '2024-01-01' })
  const containerRef = useRef<HTMLDivElement>(null)
  const mediaRef = useRef<HTMLImageElement>(null)

  const [mediaUrl, setMediaUrl] = useState<string | null>(null)
  const [mediaRect, setMediaRect] = useState<ContainedMediaRect | null>(null)
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)

  const points = (props.value ?? []) as PathPointItem[]

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

  useEffect(() => {
    updateMediaRect()
    window.addEventListener('resize', updateMediaRect)
    return () => window.removeEventListener('resize', updateMediaRect)
  }, [mediaUrl, updateMediaRect])

  const setPoints = useCallback(
    (next: PathPointItem[]) => {
      if (next.length === 0) {
        props.onChange(unset())
        return
      }
      props.onChange(set(next))
    },
    [props],
  )

  const addPoint = useCallback(
    (x: number, y: number) => {
      const next: PathPointItem = {
        _type: 'cameraPathPoint',
        _key: makePointKey(points.length),
        x,
        y,
        videoProgress: 100,
      }
      setPoints(withEndpointProgress([...points, next]))
    },
    [points, setPoints],
  )

  const updatePoint = useCallback(
    (index: number, x: number, y: number) => {
      setPoints(points.map((point, i) => (i === index ? { ...point, x, y } : point)))
    },
    [points, setPoints],
  )

  const updatePointVideoProgress = useCallback(
    (index: number, videoProgress: number) => {
      if (index <= 0 || index >= points.length - 1) return
      setPoints(
        withEndpointProgress(
          points.map((point, i) =>
            i === index
              ? { ...point, videoProgress: clampProgressPercent(videoProgress) }
              : point,
          ),
        ),
      )
    },
    [points, setPoints],
  )

  const removePoint = useCallback(
    (index: number) => {
      setPoints(withEndpointProgress(points.filter((_, i) => i !== index)))
    },
    [points, setPoints],
  )

  const handleCanvasPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!mediaRect || !containerRef.current || draggingIndex !== null) return
      const rect = containerRef.current.getBoundingClientRect()
      const coords = pointerToMediaPercent(event.clientX, event.clientY, rect, mediaRect)
      if (!coords) return
      addPoint(coords.x, coords.y)
    },
    [addPoint, draggingIndex, mediaRect],
  )

  const handleMarkerPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>, index: number) => {
      event.stopPropagation()
      event.currentTarget.setPointerCapture(event.pointerId)
      setDraggingIndex(index)
    },
    [],
  )

  const handleMarkerPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>, index: number) => {
      if (draggingIndex !== index || !mediaRect || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const coords = pointerToMediaPercent(event.clientX, event.clientY, rect, mediaRect)
      if (!coords) return
      updatePoint(index, coords.x, coords.y)
    },
    [draggingIndex, mediaRect, updatePoint],
  )

  const handleMarkerPointerUp = useCallback(() => {
    setDraggingIndex(null)
  }, [])

  const pathD = buildCameraPathPolyline(points)

  if (!assetRef) {
    return (
      <Card padding={3} radius={2} tone="caution">
        <Text size={1}>
          Upload a hole graphic above first, then draw the camera path on it.
        </Text>
      </Card>
    )
  }

  return (
    <Stack space={3}>
      <Flex gap={2} wrap="wrap">
        <Button
          text="Clear path"
          tone="critical"
          mode="ghost"
          disabled={points.length === 0}
          onClick={() => setPoints([])}
        />
        <Button
          text="Remove last point"
          mode="ghost"
          disabled={points.length === 0}
          onClick={() => removePoint(points.length - 1)}
        />
      </Flex>

      <Text size={1} muted>
        {holeNumber
          ? `Hole ${holeNumber}: click the graphic to add path points (start → waypoints → end).`
          : 'Click the graphic to add path points (start → waypoints → end).'}
        {' '}
        Set Video progress (%) on midpoints to match the flyover — e.g. 30 means that
        point is reached when the video is 30% complete. Start is always 0%, end is 100%.
      </Text>

      {!mediaUrl ? (
        <Card padding={3} radius={2} tone="transparent">
          <Text size={1} muted>
            Loading hole graphic preview…
          </Text>
        </Card>
      ) : (
        <Box
          ref={containerRef}
          onPointerDown={handleCanvasPointerDown}
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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={mediaRef}
            src={mediaUrl}
            alt={holeGraphic?.alt ?? 'Hole graphic preview'}
            onLoad={updateMediaRect}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              pointerEvents: 'none',
              display: 'block',
            }}
          />

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
              {pathD ? (
                <svg
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    pointerEvents: 'none',
                  }}
                >
                  <path
                    d={pathD}
                    fill="none"
                    stroke="#2563eb"
                    strokeWidth="0.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
              ) : null}

              {points.map((point, index) => {
                const isStart = index === 0
                const isEnd = index === points.length - 1
                return (
                  <button
                    key={point._key ?? makePointKey(index)}
                    type="button"
                    aria-label={`Path point ${index + 1}`}
                    onPointerDown={(event) => handleMarkerPointerDown(event, index)}
                    onPointerMove={(event) => handleMarkerPointerMove(event, index)}
                    onPointerUp={handleMarkerPointerUp}
                    onPointerCancel={handleMarkerPointerUp}
                    onDoubleClick={(event) => {
                      event.stopPropagation()
                      removePoint(index)
                    }}
                    style={{
                      position: 'absolute',
                      left: `${point.x}%`,
                      top: `${point.y}%`,
                      transform: 'translate(-50%, -50%)',
                      width: isStart || isEnd ? '14px' : '10px',
                      height: isStart || isEnd ? '14px' : '10px',
                      borderRadius: '999px',
                      border: '2px solid #fff',
                      background: isStart ? '#16a34a' : isEnd ? '#dc2626' : '#2563eb',
                      cursor: 'grab',
                      padding: 0,
                      zIndex: 2,
                    }}
                  />
                )
              })}
            </Box>
          ) : null}
        </Box>
      )}

      {points.length > 1 ? (
        <Stack space={2}>
          <Text size={1} weight="semibold">
            Video progress at each point
          </Text>
          {points.map((point, index) => {
            const isStart = index === 0
            const isEnd = index === points.length - 1
            const value = isStart
              ? 0
              : isEnd
                ? 100
                : typeof point.videoProgress === 'number' &&
                    Number.isFinite(point.videoProgress)
                  ? point.videoProgress
                  : Math.round((index / (points.length - 1)) * 1000) / 10
            return (
              <Flex key={point._key ?? makePointKey(index)} align="center" gap={3}>
                <Text size={1} style={{ minWidth: '5.5rem' }}>
                  Point {index + 1}
                  {isStart ? ' (start)' : isEnd ? ' (end)' : ''}
                </Text>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={value}
                  disabled={isStart || isEnd}
                  aria-label={`Video progress for point ${index + 1}`}
                  onChange={(event) => {
                    const next = Number(event.currentTarget.value)
                    updatePointVideoProgress(index, next)
                  }}
                  style={{
                    width: '5.5rem',
                    padding: '0.35rem 0.5rem',
                    borderRadius: '4px',
                    border: '1px solid var(--card-border-color, #444)',
                    background: 'var(--card-bg-color, #111)',
                    color: 'inherit',
                    opacity: isStart || isEnd ? 0.65 : 1,
                  }}
                />
                <Text size={1} muted>
                  % through video
                </Text>
              </Flex>
            )
          })}
        </Stack>
      ) : null}

      {props.renderDefault(props)}
    </Stack>
  )
}
