'use client'

import { useCallback, useEffect, useRef } from 'react'
import { set, useFormValue } from 'sanity'
import type { ArrayOfObjectsInputProps } from 'sanity'
import { BulkFlyoverUpload } from './BulkFlyoverUpload'
import { muxVideoFieldValue } from '../lib/upload-mux-video'

type HoleItem = {
  _type: 'holeFlyover'
  _key: string
  holeNumber: number
  flyoverVideo?: {
    asset?: { _ref?: string } | null
  } | null
}

function makeKey(holeNumber: number) {
  return `hole-${holeNumber}`
}

function buildSlots(count: number, existing: HoleItem[] = []): HoleItem[] {
  const byNumber = new Map(
    existing
      .filter((item) => typeof item?.holeNumber === 'number')
      .map((item) => [item.holeNumber, item]),
  )

  return Array.from({ length: count }, (_, index) => {
    const holeNumber = index + 1
    const prev = byNumber.get(holeNumber)
    if (prev) {
      return { ...prev, holeNumber }
    }
    return {
      _type: 'holeFlyover',
      _key: makeKey(holeNumber),
      holeNumber,
    }
  })
}

function slotsMatch(count: number, current: HoleItem[]): boolean {
  if (current.length !== count) return false
  for (let i = 0; i < count; i += 1) {
    if (current[i]?.holeNumber !== i + 1) return false
  }
  return true
}

function holeHasVideo(hole: HoleItem | undefined): boolean {
  return Boolean(hole?.flyoverVideo?.asset?._ref)
}

export function HoleFlyoversInput(props: ArrayOfObjectsInputProps) {
  const holeCount = useFormValue(['holeCount']) as number | undefined
  const syncingRef = useRef(false)
  const holes = (props.value ?? []) as HoleItem[]

  useEffect(() => {
    if (!holeCount || holeCount < 1) return
    const current = (props.value ?? []) as HoleItem[]
    if (slotsMatch(holeCount, current) || syncingRef.current) return

    syncingRef.current = true
    props.onChange(set(buildSlots(holeCount, current)))
    queueMicrotask(() => {
      syncingRef.current = false
    })
  }, [holeCount, props.value, props.onChange])

  const handleAttach = useCallback(
    (holeNumber: number, assetDocumentId: string) => {
      const current = (props.value ?? []) as HoleItem[]
      const hole =
        current.find((item) => item.holeNumber === holeNumber) ??
        buildSlots(holeCount ?? current.length, current).find(
          (item) => item.holeNumber === holeNumber,
        )
      if (!hole?._key) return

      props.onChange(
        set(muxVideoFieldValue(assetDocumentId), [
          { _key: hole._key },
          'flyoverVideo',
        ]),
      )
    },
    [holeCount, props],
  )

  if (!holeCount) {
    return (
      <div style={{ padding: '0.75rem 0', color: 'var(--card-muted-fg-color, #888)' }}>
        Select a course type (9, 18, or Other) above to configure per-hole flyover
        uploads.
      </div>
    )
  }

  return (
    <div>
      <BulkFlyoverUpload
        holeCount={holeCount}
        holes={holes.map((hole) => ({
          holeNumber: hole.holeNumber,
          hasVideo: holeHasVideo(hole),
        }))}
        disabled={props.readOnly}
        onAttach={handleAttach}
      />
      {props.renderDefault(props)}
    </div>
  )
}
