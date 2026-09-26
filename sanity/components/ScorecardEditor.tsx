'use client'

import { Box, Button, Card, Checkbox, Flex, Label, Select, Stack, Text, TextInput } from '@sanity/ui'
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type CSSProperties,
} from 'react'
import { set, useFormValue } from 'sanity'
import type { ObjectInputProps } from 'sanity'
import { resolveTeeColor, teeSplitBackground } from '../../lib/constants/teeColors'

import {
  SCORECARD_COMBO_TEE_COUNT_OPTIONS,
  SCORECARD_TEE_COUNT_OPTIONS,
} from '../schemaTypes/scorecardConfig'

type ScorecardGender = 'men' | 'women'
type ComboAvailableFor = 'both' | 'men' | 'women'

type GenderRatings = {
  courseRating?: string
  slopeRating?: string
}

type TeeEntry = {
  par?: { men?: string; women?: string } | string
  yardage?: string
  handicap?: { men?: string; women?: string } | string
}

type ComboTeeNumbers = {
  low?: number
  high?: number
}

type TeeSet = {
  name?: string
  color?: string
  totalYards?: string
  totalPar?: { men?: string; women?: string }
  ratings?: { men?: GenderRatings; women?: GenderRatings }
  isCombo?: boolean
  teeNumber?: number
  comboTeeNumbers?: ComboTeeNumbers
  availableFor?: ComboAvailableFor
  /** @deprecated Legacy flat men's ratings */
  courseRating?: string
  /** @deprecated Legacy flat men's ratings */
  slopeRating?: string
}

type HoleItem = {
  _type: 'holeScorecard'
  _key: string
  holeNumber: number
  /** @deprecated Legacy hole-level par — migrated into tees[].par */
  par?: { men?: string; women?: string } | string
  tees?: TeeEntry[]
  yardage?: string
  handicap?: string
}

type ScorecardValue = {
  _type?: 'scorecardConfig'
  hasWomenRatings?: boolean
  teeCount?: number
  teeCountWomen?: number
  hasComboTees?: boolean
  comboTeeCount?: number
  teeSets?: TeeSet[]
  teeNames?: string[]
  holes?: HoleItem[]
}

type NormalizedScorecard = Required<
  Pick<
    ScorecardValue,
    | 'hasWomenRatings'
    | 'teeCount'
    | 'teeCountWomen'
    | 'hasComboTees'
    | 'comboTeeCount'
    | 'teeSets'
    | 'holes'
  >
>

const TEE_COUNTS = SCORECARD_TEE_COUNT_OPTIONS.map((option) => option.value)
const COMBO_COUNTS = SCORECARD_COMBO_TEE_COUNT_OPTIONS.map((option) => option.value)

function makeKey(holeNumber: number) {
  return `scorecard-hole-${holeNumber}`
}

function clampWomenTeeCount(women: number | undefined, men: number, hasWomen: boolean): number {
  if (!hasWomen) return men
  const raw = typeof women === 'number' && Number.isFinite(women) ? women : men
  return Math.min(men, Math.max(1, Math.round(raw)))
}

function clampComboTeeCount(hasCombo: boolean, count: number | undefined): number {
  if (!hasCombo) return 0
  const raw = typeof count === 'number' && Number.isFinite(count) ? count : 1
  if (COMBO_COUNTS.includes(raw as (typeof COMBO_COUNTS)[number])) return raw
  return 1
}

function totalTeeSlots(standardCount: number, comboCount: number): number {
  return standardCount + comboCount
}

function normalizeGenderRatings(set: TeeSet | undefined): {
  men: GenderRatings
  women: GenderRatings
} {
  return {
    men: {
      courseRating:
        set?.ratings?.men?.courseRating?.trim() ||
        set?.courseRating?.trim() ||
        '',
      slopeRating:
        set?.ratings?.men?.slopeRating?.trim() || set?.slopeRating?.trim() || '',
    },
    women: {
      courseRating: set?.ratings?.women?.courseRating?.trim() || '',
      slopeRating: set?.ratings?.women?.slopeRating?.trim() || '',
    },
  }
}

function normalizeComboAvailableFor(value: ComboAvailableFor | undefined): ComboAvailableFor {
  if (value === 'men' || value === 'women' || value === 'both') return value
  return 'both'
}

function normalizeComboPair(
  pair: ComboTeeNumbers | undefined,
  standardCount: number,
): { low: number; high: number } {
  const max = Math.max(1, standardCount)
  let low = typeof pair?.low === 'number' && Number.isFinite(pair.low) ? Math.round(pair.low) : 1
  let high = typeof pair?.high === 'number' && Number.isFinite(pair.high) ? Math.round(pair.high) : Math.min(2, max)
  low = Math.min(max, Math.max(1, low))
  high = Math.min(max, Math.max(1, high))
  if (low === high) {
    high = low < max ? low + 1 : Math.max(1, low - 1)
  }
  if (low > high) {
    const swap = low
    low = high
    high = swap
  }
  return { low, high }
}

function syncTeeSets(
  standardCount: number,
  comboCount: number,
  existing: TeeSet[] = [],
  legacyNames: string[] = [],
): TeeSet[] {
  const total = totalTeeSlots(standardCount, comboCount)
  const usedNumbers = new Set<number>()

  return Array.from({ length: total }, (_, index) => {
    const isCombo = index >= standardCount
    const prev = existing[index]
    const ratings = normalizeGenderRatings(prev)

    if (isCombo) {
      return {
        name: prev?.name ?? '',
        isCombo: true,
        totalYards: prev?.totalYards ?? '',
        totalPar: normalizeGenderValues(prev?.totalPar),
        ratings,
        comboTeeNumbers: normalizeComboPair(prev?.comboTeeNumbers, standardCount),
        availableFor: normalizeComboAvailableFor(prev?.availableFor),
      }
    }

    let teeNumber =
      typeof prev?.teeNumber === 'number' && Number.isFinite(prev.teeNumber)
        ? Math.round(prev.teeNumber)
        : index + 1
    teeNumber = Math.min(standardCount, Math.max(1, teeNumber))
    if (usedNumbers.has(teeNumber)) {
      for (let candidate = 1; candidate <= standardCount; candidate += 1) {
        if (!usedNumbers.has(candidate)) {
          teeNumber = candidate
          break
        }
      }
    }
    usedNumbers.add(teeNumber)

    return {
      name: prev?.name ?? legacyNames[index] ?? '',
      isCombo: false,
      teeNumber,
      color: resolveTeeColor(prev?.color, index),
      totalYards: prev?.totalYards ?? '',
      totalPar: normalizeGenderValues(prev?.totalPar),
      ratings,
    }
  })
}

function sumParForTeeColumn(
  holes: HoleItem[],
  columnCount: number,
  teeIndex: number,
  gender: ScorecardGender,
): string {
  let sum = 0
  let hasValue = false
  for (const row of holes) {
    const tees = syncTeeEntries(columnCount, row.tees ?? [])
    const raw = normalizePar(tees[teeIndex]?.par)[gender].trim()
    if (!raw) continue
    const value = Number.parseInt(raw, 10)
    if (Number.isFinite(value)) {
      sum += value
      hasValue = true
    }
  }
  return hasValue ? String(sum) : ''
}

function applyComputedTotalPars(
  teeSets: TeeSet[],
  holes: HoleItem[],
  columnCount: number,
): TeeSet[] {
  return teeSets.map((teeSet, teeIndex) => ({
    ...teeSet,
    totalPar: {
      men: sumParForTeeColumn(holes, columnCount, teeIndex, 'men'),
      women: sumParForTeeColumn(holes, columnCount, teeIndex, 'women'),
    },
  }))
}

function normalizeGenderValues(
  raw: { men?: string; women?: string } | string | undefined,
): { men: string; women: string } {
  if (typeof raw === 'string') {
    return { men: raw, women: '' }
  }
  return {
    men: raw?.men ?? '',
    women: raw?.women ?? '',
  }
}

function normalizeHandicap(
  raw: TeeEntry['handicap'] | undefined,
): { men: string; women: string } {
  return normalizeGenderValues(raw)
}

function normalizePar(raw: HoleItem['par'] | undefined): { men: string; women: string } {
  return normalizeGenderValues(raw)
}

function syncTeeEntries(
  count: number,
  existing: TeeEntry[] = [],
  holePar?: { men: string; women: string },
): TeeEntry[] {
  return Array.from({ length: count }, (_, index) => {
    const prev = existing[index]
    const par = normalizePar(prev?.par)
    const hasPar = Boolean(par.men.trim() || par.women.trim())
    const fallback = !hasPar && holePar ? holePar : undefined
    return {
      par: fallback ?? par,
      yardage: prev?.yardage ?? '',
      handicap: normalizeHandicap(prev?.handicap),
    }
  })
}

function buildHoleSlots(
  holeCount: number,
  columnCount: number,
  existing: HoleItem[] = [],
): HoleItem[] {
  const byNumber = new Map(
    existing
      .filter((item) => typeof item?.holeNumber === 'number')
      .map((item) => [item.holeNumber, item]),
  )

  return Array.from({ length: holeCount }, (_, index) => {
    const holeNumber = index + 1
    const prev = byNumber.get(holeNumber)
    const legacyHandicap =
      typeof prev?.handicap === 'string' ? prev.handicap : undefined
    const legacyTees =
      prev?.yardage || legacyHandicap
        ? [
            {
              yardage: prev?.yardage ?? '',
              handicap: legacyHandicap
                ? { men: legacyHandicap, women: '' }
                : { men: '', women: '' },
            },
          ]
        : []
    const holePar = normalizePar(prev?.par)
    const tees = syncTeeEntries(
      columnCount,
      prev?.tees?.length ? prev.tees : legacyTees,
      holePar,
    )

    return {
      _type: 'holeScorecard',
      _key: prev?._key ?? makeKey(holeNumber),
      holeNumber,
      tees,
    }
  })
}

function colorByTeeNumber(teeSets: TeeSet[], teeNumber: number): string {
  const match = teeSets.find(
    (set) => !set.isCombo && set.teeNumber === teeNumber,
  )
  if (match) {
    const standardIndex = teeSets
      .filter((set) => !set.isCombo)
      .findIndex((set) => set.teeNumber === teeNumber)
    return resolveTeeColor(match.color, standardIndex >= 0 ? standardIndex : 0)
  }
  return resolveTeeColor(undefined, Math.max(0, teeNumber - 1))
}

function normalizeScorecard(
  value: ScorecardValue | undefined,
  holeCount: number,
): NormalizedScorecard {
  const teeCount = TEE_COUNTS.includes((value?.teeCount ?? 3) as (typeof TEE_COUNTS)[number])
    ? (value?.teeCount ?? 3)
    : 3
  const hasWomenRatings = Boolean(value?.hasWomenRatings)
  const teeCountWomen = clampWomenTeeCount(value?.teeCountWomen, teeCount, hasWomenRatings)
  const hasComboTees = Boolean(value?.hasComboTees)
  const comboTeeCount = clampComboTeeCount(hasComboTees, value?.comboTeeCount)
  const columnCount = totalTeeSlots(teeCount, comboTeeCount)
  const holes = buildHoleSlots(holeCount, columnCount, value?.holes ?? [])
  const teeSets = applyComputedTotalPars(
    syncTeeSets(teeCount, comboTeeCount, value?.teeSets ?? [], value?.teeNames ?? []),
    holes,
    columnCount,
  )
  return {
    hasWomenRatings,
    teeCount,
    teeCountWomen,
    hasComboTees,
    comboTeeCount: hasComboTees ? comboTeeCount || 1 : 1,
    teeSets,
    holes,
  }
}

function scorecardMatches(
  value: ScorecardValue | undefined,
  holeCount: number,
): boolean {
  const normalized = normalizeScorecard(value, holeCount)
  const columnCount = totalTeeSlots(
    normalized.teeCount,
    normalized.hasComboTees ? normalized.comboTeeCount : 0,
  )
  if ((value?.teeCount ?? 3) !== normalized.teeCount) return false
  if (Boolean(value?.hasWomenRatings) !== normalized.hasWomenRatings) return false
  if (normalized.hasWomenRatings) {
    if ((value?.teeCountWomen ?? normalized.teeCount) !== normalized.teeCountWomen) return false
  }
  if (Boolean(value?.hasComboTees) !== normalized.hasComboTees) return false
  if (normalized.hasComboTees) {
    if ((value?.comboTeeCount ?? 1) !== normalized.comboTeeCount) return false
  }
  if ((value?.teeSets ?? []).length !== columnCount) return false
  if ((value?.holes ?? []).length !== holeCount) return false

  for (let holeIndex = 0; holeIndex < holeCount; holeIndex += 1) {
    const hole = value?.holes?.[holeIndex]
    if (hole?.holeNumber !== holeIndex + 1) return false
    if ((hole?.tees ?? []).length !== columnCount) return false
  }

  for (let teeIndex = 0; teeIndex < columnCount; teeIndex += 1) {
    const storedSet = value?.teeSets?.[teeIndex]
    const normalizedSet = normalized.teeSets[teeIndex]
    if (Boolean(storedSet?.isCombo) !== Boolean(normalizedSet?.isCombo)) return false
    if (!normalizedSet.isCombo) {
      if ((storedSet?.teeNumber ?? teeIndex + 1) !== normalizedSet.teeNumber) return false
    } else {
      const storedPair = normalizeComboPair(storedSet?.comboTeeNumbers, normalized.teeCount)
      const nextPair = normalizedSet.comboTeeNumbers!
      if (storedPair.low !== nextPair.low || storedPair.high !== nextPair.high) return false
      if (normalizeComboAvailableFor(storedSet?.availableFor) !== normalizedSet.availableFor) {
        return false
      }
    }
    const stored = normalizeGenderValues(storedSet?.totalPar)
    const computed = normalizeGenderValues(normalizedSet?.totalPar)
    if (stored.men !== computed.men || stored.women !== computed.women) return false
  }

  return true
}

function buildGridStyle(columnCount: number): CSSProperties {
  const teeColumns = Array.from(
    { length: columnCount },
    () =>
      'minmax(3.25rem, 1fr) minmax(6rem, 1fr) minmax(4.5rem, 1fr)',
  ).join(' ')
  return {
    display: 'grid',
    gridTemplateColumns: `3.5rem ${teeColumns}`,
    gap: '0.5rem',
    alignItems: 'start',
    minWidth: `${10 + columnCount * 14}rem`,
  }
}

type HoleFieldKind = 'par' | 'yardage' | 'handicap'

function holeFieldTabOrder(
  holeIndex: number,
  holeCount: number,
  teeCount: number,
  kind: HoleFieldKind,
  teeIndex = 0,
): number {
  const fieldsPerTee = 3
  const base = teeIndex * fieldsPerTee * holeCount
  if (kind === 'par') return base + holeIndex
  if (kind === 'yardage') return base + holeCount + holeIndex
  return base + 2 * holeCount + holeIndex
}

function holeFieldTabCount(holeCount: number, teeCount: number): number {
  return holeCount * teeCount * 3
}

function selectAllOnFocus(event: FocusEvent<HTMLInputElement>) {
  event.currentTarget.select()
}

function focusHoleField(container: HTMLElement | null | undefined, order: number) {
  const field = container?.querySelector<HTMLInputElement>(
    `[data-scorecard-tab-order="${order}"]`,
  )
  if (!field) return
  field.focus()
  field.select()
}

function handleHoleFieldTabKey(
  event: KeyboardEvent<HTMLInputElement>,
  order: number,
  fieldCount: number,
) {
  if (event.key !== 'Tab') return

  const nextOrder = event.shiftKey ? order - 1 : order + 1
  if (nextOrder < 0 || nextOrder >= fieldCount) return

  const container = event.currentTarget.closest('[data-scorecard-grid]')
  if (!(container instanceof HTMLElement)) return

  event.preventDefault()
  focusHoleField(container, nextOrder)
}

function columnVisibleForGender(
  teeSet: TeeSet,
  editorGender: ScorecardGender,
  teeCountWomen: number,
  hasWomenRatings: boolean,
): boolean {
  if (!hasWomenRatings) return true
  if (teeSet.isCombo) {
    const available = teeSet.availableFor ?? 'both'
    if (editorGender === 'women') return available !== 'men'
    return available !== 'women'
  }
  if (editorGender === 'women') {
    return (teeSet.teeNumber ?? 1) <= teeCountWomen
  }
  return true
}

export function ScorecardEditor(props: ObjectInputProps) {
  const holeCount = useFormValue(['holeCount']) as number | undefined
  const readOnly = props.readOnly
  const syncingRef = useRef(false)
  const value = (props.value ?? {}) as ScorecardValue
  const [editorGender, setEditorGender] = useState<ScorecardGender>('men')

  useEffect(() => {
    if (!holeCount || holeCount < 1) return
    if (scorecardMatches(value, holeCount) || syncingRef.current) return

    syncingRef.current = true
    const normalized = normalizeScorecard(value, holeCount)
    props.onChange(
      set({
        _type: 'scorecardConfig',
        ...normalized,
      }),
    )
    queueMicrotask(() => {
      syncingRef.current = false
    })
  }, [holeCount, props, value])

  const display = useMemo(() => {
    if (!holeCount) return null
    return normalizeScorecard(value, holeCount)
  }, [holeCount, value])

  const columnCount = display
    ? totalTeeSlots(display.teeCount, display.hasComboTees ? display.comboTeeCount : 0)
    : 0

  const commit = useCallback(
    (next: NormalizedScorecard) => {
      if (readOnly) return
      props.onChange(
        set({
          _type: 'scorecardConfig',
          ...next,
        }),
      )
    },
    [props, readOnly],
  )

  const rebuildColumns = useCallback(
    (
      base: NormalizedScorecard,
      overrides: Partial<
        Pick<
          NormalizedScorecard,
          'teeCount' | 'teeCountWomen' | 'hasComboTees' | 'comboTeeCount' | 'hasWomenRatings'
        >
      >,
    ): NormalizedScorecard => {
      const teeCount = overrides.teeCount ?? base.teeCount
      const hasWomenRatings = overrides.hasWomenRatings ?? base.hasWomenRatings
      const teeCountWomen = clampWomenTeeCount(
        overrides.teeCountWomen ?? base.teeCountWomen,
        teeCount,
        hasWomenRatings,
      )
      const hasComboTees = overrides.hasComboTees ?? base.hasComboTees
      const comboTeeCount = clampComboTeeCount(
        hasComboTees,
        overrides.comboTeeCount ?? base.comboTeeCount,
      )
      const cols = totalTeeSlots(teeCount, comboTeeCount)
      const holes = buildHoleSlots(holeCount!, cols, base.holes)
      const teeSets = applyComputedTotalPars(
        syncTeeSets(teeCount, comboTeeCount, base.teeSets),
        holes,
        cols,
      )
      return {
        ...base,
        hasWomenRatings,
        teeCount,
        teeCountWomen,
        hasComboTees,
        comboTeeCount: hasComboTees ? comboTeeCount || 1 : 1,
        teeSets,
        holes,
      }
    },
    [holeCount],
  )

  const setHasWomenRatings = useCallback(
    (checked: boolean) => {
      if (!holeCount || readOnly) return
      const base = normalizeScorecard(value, holeCount)
      commit(
        rebuildColumns(base, {
          hasWomenRatings: checked,
          teeCountWomen: checked ? base.teeCountWomen || base.teeCount : base.teeCount,
        }),
      )
    },
    [commit, holeCount, readOnly, rebuildColumns, value],
  )

  const setTeeCount = useCallback(
    (teeCount: number) => {
      if (!holeCount || readOnly) return
      const base = normalizeScorecard(value, holeCount)
      commit(rebuildColumns(base, { teeCount }))
    },
    [commit, holeCount, readOnly, rebuildColumns, value],
  )

  const setTeeCountWomen = useCallback(
    (teeCountWomen: number) => {
      if (!holeCount || readOnly) return
      const base = normalizeScorecard(value, holeCount)
      commit(rebuildColumns(base, { teeCountWomen }))
    },
    [commit, holeCount, readOnly, rebuildColumns, value],
  )

  const setHasComboTees = useCallback(
    (checked: boolean) => {
      if (!holeCount || readOnly) return
      const base = normalizeScorecard(value, holeCount)
      commit(
        rebuildColumns(base, {
          hasComboTees: checked,
          comboTeeCount: checked ? base.comboTeeCount || 1 : 0,
        }),
      )
    },
    [commit, holeCount, readOnly, rebuildColumns, value],
  )

  const setComboTeeCount = useCallback(
    (comboTeeCount: number) => {
      if (!holeCount || readOnly) return
      const base = normalizeScorecard(value, holeCount)
      commit(rebuildColumns(base, { hasComboTees: true, comboTeeCount }))
    },
    [commit, holeCount, readOnly, rebuildColumns, value],
  )

  const withSyncedSets = useCallback(
    (base: NormalizedScorecard) => {
      const comboCount = base.hasComboTees ? base.comboTeeCount : 0
      return syncTeeSets(base.teeCount, comboCount, base.teeSets)
    },
    [],
  )

  const setTeeSetField = useCallback(
    (teeIndex: number, field: 'name' | 'color' | 'totalYards', fieldValue: string) => {
      if (!holeCount || readOnly) return
      const base = normalizeScorecard(value, holeCount)
      const teeSets = withSyncedSets(base)
      teeSets[teeIndex] = { ...teeSets[teeIndex], [field]: fieldValue }
      commit({ ...base, teeSets })
    },
    [commit, holeCount, readOnly, value, withSyncedSets],
  )

  const setTeeNumber = useCallback(
    (teeIndex: number, teeNumber: number) => {
      if (!holeCount || readOnly) return
      const base = normalizeScorecard(value, holeCount)
      const teeSets = withSyncedSets(base)
      const current = teeSets[teeIndex]
      if (!current || current.isCombo) return

      const swapIndex = teeSets.findIndex(
        (set, index) =>
          index !== teeIndex && !set.isCombo && set.teeNumber === teeNumber,
      )
      teeSets[teeIndex] = { ...current, teeNumber }
      if (swapIndex >= 0) {
        teeSets[swapIndex] = {
          ...teeSets[swapIndex],
          teeNumber: current.teeNumber ?? teeIndex + 1,
        }
      }
      commit({ ...base, teeSets })
    },
    [commit, holeCount, readOnly, value, withSyncedSets],
  )

  const setComboPairField = useCallback(
    (teeIndex: number, side: 'low' | 'high', fieldValue: number) => {
      if (!holeCount || readOnly) return
      const base = normalizeScorecard(value, holeCount)
      const teeSets = withSyncedSets(base)
      const current = teeSets[teeIndex]
      if (!current?.isCombo) return
      const pair = normalizeComboPair(current.comboTeeNumbers, base.teeCount)
      pair[side] = fieldValue
      teeSets[teeIndex] = {
        ...current,
        comboTeeNumbers: normalizeComboPair(pair, base.teeCount),
      }
      commit({ ...base, teeSets })
    },
    [commit, holeCount, readOnly, value, withSyncedSets],
  )

  const setComboAvailableFor = useCallback(
    (teeIndex: number, availableFor: ComboAvailableFor) => {
      if (!holeCount || readOnly) return
      const base = normalizeScorecard(value, holeCount)
      const teeSets = withSyncedSets(base)
      const current = teeSets[teeIndex]
      if (!current?.isCombo) return
      teeSets[teeIndex] = { ...current, availableFor }
      commit({ ...base, teeSets })
    },
    [commit, holeCount, readOnly, value, withSyncedSets],
  )

  const setTeeRatingField = useCallback(
    (
      teeIndex: number,
      gender: ScorecardGender,
      field: keyof GenderRatings,
      fieldValue: string,
    ) => {
      if (!holeCount || readOnly) return
      const base = normalizeScorecard(value, holeCount)
      const teeSets = withSyncedSets(base)
      const ratings = normalizeGenderRatings(teeSets[teeIndex])
      ratings[gender] = { ...ratings[gender], [field]: fieldValue }
      teeSets[teeIndex] = { ...teeSets[teeIndex], ratings }
      commit({ ...base, teeSets })
    },
    [commit, holeCount, readOnly, value, withSyncedSets],
  )

  const setTeeField = useCallback(
    (
      holeNumber: number,
      teeIndex: number,
      field: 'yardage',
      fieldValue: string,
    ) => {
      if (!holeCount || readOnly) return
      const base = normalizeScorecard(value, holeCount)
      const cols = totalTeeSlots(base.teeCount, base.hasComboTees ? base.comboTeeCount : 0)
      const holes = base.holes.map((row) => {
        if (row.holeNumber !== holeNumber) return row
        const tees = syncTeeEntries(cols, row.tees ?? [])
        tees[teeIndex] = { ...tees[teeIndex], [field]: fieldValue }
        return { ...row, tees }
      })
      commit({ ...base, holes })
    },
    [commit, holeCount, readOnly, value],
  )

  const setTeeHandicapField = useCallback(
    (
      holeNumber: number,
      teeIndex: number,
      gender: ScorecardGender,
      fieldValue: string,
    ) => {
      if (!holeCount || readOnly) return
      const base = normalizeScorecard(value, holeCount)
      const cols = totalTeeSlots(base.teeCount, base.hasComboTees ? base.comboTeeCount : 0)
      const holes = base.holes.map((row) => {
        if (row.holeNumber !== holeNumber) return row
        const tees = syncTeeEntries(cols, row.tees ?? [])
        const handicap = normalizeHandicap(tees[teeIndex]?.handicap)
        handicap[gender] = fieldValue
        tees[teeIndex] = { ...tees[teeIndex], handicap }
        return { ...row, tees }
      })
      commit({ ...base, holes })
    },
    [commit, holeCount, readOnly, value],
  )

  const setTeeParField = useCallback(
    (
      holeNumber: number,
      teeIndex: number,
      gender: ScorecardGender,
      fieldValue: string,
    ) => {
      if (!holeCount || readOnly) return
      const base = normalizeScorecard(value, holeCount)
      const cols = totalTeeSlots(base.teeCount, base.hasComboTees ? base.comboTeeCount : 0)
      const holes = base.holes.map((row) => {
        if (row.holeNumber !== holeNumber) return row
        const tees = syncTeeEntries(cols, row.tees ?? [])
        const par = normalizePar(tees[teeIndex]?.par)
        par[gender] = fieldValue
        tees[teeIndex] = { ...tees[teeIndex], par }
        return { ...row, tees }
      })
      commit({
        ...base,
        holes,
        teeSets: applyComputedTotalPars(base.teeSets, holes, cols),
      })
    },
    [commit, holeCount, readOnly, value],
  )

  if (!holeCount) {
    return (
      <Box paddingY={3}>
        <Text muted size={1}>
          Select a course type (9, 18, or Other) under Course Details to enter
          scorecard data.
        </Text>
      </Box>
    )
  }

  if (!display) return null

  const visibleTeeIndices = display.teeSets
    .map((teeSet, teeIndex) => ({ teeSet, teeIndex }))
    .filter(({ teeSet }) =>
      columnVisibleForGender(
        teeSet,
        editorGender,
        display.teeCountWomen,
        display.hasWomenRatings,
      ),
    )
    .map(({ teeIndex }) => teeIndex)
  const visibleColumnCount = visibleTeeIndices.length || columnCount
  const gridStyle = buildGridStyle(visibleColumnCount)
  const holeFieldCount = holeFieldTabCount(holeCount, visibleColumnCount)
  const womenTeeOptions = Array.from({ length: display.teeCount }, (_, index) => index + 1)

  return (
    <Box paddingY={2}>
      <Flex align="center" gap={3} marginBottom={4} wrap="wrap">
        <Box style={{ minWidth: '12rem' }}>
          <Label size={1} muted>
            {display.hasWomenRatings ? "Men's tees" : 'Number of Tees'}
          </Label>
          <Select
            fontSize={2}
            padding={3}
            value={String(display.teeCount)}
            disabled={readOnly}
            onChange={(event) => setTeeCount(Number(event.currentTarget.value))}
          >
            {SCORECARD_TEE_COUNT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.title}
              </option>
            ))}
          </Select>
        </Box>

        {display.hasWomenRatings ? (
          <Box style={{ minWidth: '12rem' }}>
            <Label size={1} muted>
              Women&apos;s tees
            </Label>
            <Select
              fontSize={2}
              padding={3}
              value={String(display.teeCountWomen)}
              disabled={readOnly}
              onChange={(event) => setTeeCountWomen(Number(event.currentTarget.value))}
            >
              {womenTeeOptions.map((count) => (
                <option key={count} value={count}>
                  {count} {count === 1 ? 'tee' : 'tees'} (shortest #{count === 1 ? '1' : `1–${count}`})
                </option>
              ))}
            </Select>
          </Box>
        ) : null}

        <Flex align="center" gap={2} wrap="wrap">
          <Checkbox
            checked={display.hasComboTees}
            disabled={readOnly}
            onChange={(event) => setHasComboTees(event.currentTarget.checked)}
          />
          <Text size={1} muted>
            Combo Tees?
          </Text>
        </Flex>

        {display.hasComboTees ? (
          <Box style={{ minWidth: '11rem' }}>
            <Label size={1} muted>
              Combo tee count
            </Label>
            <Select
              fontSize={2}
              padding={3}
              value={String(display.comboTeeCount)}
              disabled={readOnly}
              onChange={(event) => setComboTeeCount(Number(event.currentTarget.value))}
            >
              {SCORECARD_COMBO_TEE_COUNT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.title}
                </option>
              ))}
            </Select>
          </Box>
        ) : null}

        <Flex align="center" gap={3} wrap="wrap">
          <Checkbox
            checked={display.hasWomenRatings}
            disabled={readOnly}
            onChange={(event) => setHasWomenRatings(event.currentTarget.checked)}
          />
          <Text size={1} muted>
            Publish women&apos;s ratings, stroke index &amp; par on the course page
          </Text>
        </Flex>
        <Flex gap={1} wrap="wrap">
          {(['men', 'women'] as const).map((gender) => (
            <Button
              key={gender}
              fontSize={1}
              mode={editorGender === gender ? 'default' : 'ghost'}
              text={gender === 'men' ? "Men's" : "Women's"}
              disabled={readOnly}
              onClick={() => setEditorGender(gender)}
            />
          ))}
        </Flex>
        <Text muted size={1}>
          {holeCount} holes · {visibleColumnCount} tees
          {visibleColumnCount !== columnCount
            ? ` shown for ${editorGender === 'men' ? "men's" : "women's"}`
            : display.hasComboTees
              ? ` (${display.teeCount} standard + ${display.comboTeeCount} combo)`
              : ''}{' '}
          · editing {editorGender === 'men' ? "men's" : "women's"} par (per tee), ratings &amp;
          stroke index — tab down each column to enter data quickly.
        </Text>
      </Flex>

      <Card padding={3} radius={2} border style={{ overflowX: 'auto' }}>
        <Box data-scorecard-grid style={gridStyle}>
          <Text size={1} weight="semibold">
            Hole
          </Text>

          {visibleTeeIndices.map((teeIndex) => {
            const teeSet = display.teeSets[teeIndex]
            const ratings = normalizeGenderRatings(teeSet)
            const activeRatings = ratings[editorGender]
            const comboPair = teeSet.isCombo
              ? normalizeComboPair(teeSet.comboTeeNumbers, display.teeCount)
              : null
            const comboLowColor = comboPair
              ? colorByTeeNumber(display.teeSets, comboPair.low)
              : undefined
            const comboHighColor = comboPair
              ? colorByTeeNumber(display.teeSets, comboPair.high)
              : undefined

            return (
            <Box
              key={`tee-header-${teeIndex}`}
              style={{
                gridColumn: 'span 3 / span 3',
              }}
            >
              <Stack space={3}>
                <Box>
                  <Flex gap={2} align="flex-end">
                    <Box flex={1}>
                      <Label size={0} muted>
                        Tee name
                      </Label>
                      <TextInput
                        value={teeSet.name ?? ''}
                        onChange={(event) =>
                          setTeeSetField(teeIndex, 'name', event.currentTarget.value)
                        }
                        onFocus={selectAllOnFocus}
                        readOnly={readOnly}
                        placeholder={
                          teeSet.isCombo
                            ? `Combo ${teeIndex - display.teeCount + 1}`
                            : `Tee ${teeIndex + 1}`
                        }
                      />
                    </Box>
                    {teeSet.isCombo ? (
                      <Box>
                        <Label size={0} muted>
                          Colors
                        </Label>
                        <Box
                          aria-hidden
                          style={{
                            width: '2.5rem',
                            height: '2.25rem',
                            borderRadius: '4px',
                            border: '1px solid var(--card-border-color, rgba(0,0,0,0.1))',
                            background:
                              comboLowColor && comboHighColor
                                ? teeSplitBackground(comboLowColor, comboHighColor)
                                : 'transparent',
                          }}
                        />
                      </Box>
                    ) : (
                      <Box>
                        <Label size={0} muted>
                          Color
                        </Label>
                        <Box
                          as="label"
                          style={{
                            display: 'block',
                            cursor: readOnly ? 'default' : 'pointer',
                          }}
                        >
                          <input
                            type="color"
                            value={resolveTeeColor(teeSet.color, teeIndex)}
                            onChange={(event) =>
                              setTeeSetField(teeIndex, 'color', event.currentTarget.value)
                            }
                            disabled={readOnly}
                            aria-label={`Color for ${teeSet.name?.trim() || `tee ${teeIndex + 1}`}`}
                            style={{
                              display: 'block',
                              width: '2.5rem',
                              height: '2.25rem',
                              padding: 0,
                              border: '1px solid var(--card-border-color, rgba(0,0,0,0.1))',
                              borderRadius: '4px',
                              background: 'transparent',
                              cursor: readOnly ? 'default' : 'pointer',
                            }}
                          />
                        </Box>
                      </Box>
                    )}
                  </Flex>
                </Box>

                {teeSet.isCombo && comboPair ? (
                  <Stack space={2}>
                    <Label size={0} muted>
                      Combo of tee #s
                    </Label>
                    <Flex gap={2}>
                      <Box flex={1}>
                        <Select
                          fontSize={1}
                          padding={2}
                          value={String(comboPair.low)}
                          disabled={readOnly}
                          onChange={(event) =>
                            setComboPairField(
                              teeIndex,
                              'low',
                              Number(event.currentTarget.value),
                            )
                          }
                        >
                          {womenTeeOptions.map((num) => (
                            <option key={`low-${num}`} value={num}>
                              #{num}
                            </option>
                          ))}
                        </Select>
                      </Box>
                      <Box flex={1}>
                        <Select
                          fontSize={1}
                          padding={2}
                          value={String(comboPair.high)}
                          disabled={readOnly}
                          onChange={(event) =>
                            setComboPairField(
                              teeIndex,
                              'high',
                              Number(event.currentTarget.value),
                            )
                          }
                        >
                          {womenTeeOptions.map((num) => (
                            <option key={`high-${num}`} value={num}>
                              #{num}
                            </option>
                          ))}
                        </Select>
                      </Box>
                    </Flex>
                    <Box>
                      <Label size={0} muted>
                        Available for
                      </Label>
                      <Select
                        fontSize={1}
                        padding={2}
                        value={teeSet.availableFor ?? 'both'}
                        disabled={readOnly}
                        onChange={(event) =>
                          setComboAvailableFor(
                            teeIndex,
                            event.currentTarget.value as ComboAvailableFor,
                          )
                        }
                      >
                        <option value="both">Both</option>
                        <option value="men">Men&apos;s only</option>
                        <option value="women">Women&apos;s only</option>
                      </Select>
                    </Box>
                  </Stack>
                ) : (
                  <Box>
                    <Label size={0} muted>
                      Tee # (1 = shortest)
                    </Label>
                    <Select
                      fontSize={1}
                      padding={2}
                      value={String(teeSet.teeNumber ?? teeIndex + 1)}
                      disabled={readOnly}
                      onChange={(event) =>
                        setTeeNumber(teeIndex, Number(event.currentTarget.value))
                      }
                    >
                      {womenTeeOptions.map((num) => (
                        <option key={`tee-num-${num}`} value={num}>
                          {num}
                        </option>
                      ))}
                    </Select>
                  </Box>
                )}

                <Box>
                  <Label size={0} muted>
                    Total yards
                  </Label>
                  <TextInput
                    value={teeSet.totalYards ?? ''}
                    onChange={(event) =>
                      setTeeSetField(teeIndex, 'totalYards', event.currentTarget.value)
                    }
                    onFocus={selectAllOnFocus}
                    readOnly={readOnly}
                    placeholder="6524"
                    inputMode="numeric"
                  />
                </Box>
                <Box>
                  <Label size={0} muted>
                    Course rating ({editorGender === 'men' ? "men's" : "women's"})
                  </Label>
                  <TextInput
                    value={activeRatings.courseRating ?? ''}
                    onChange={(event) =>
                      setTeeRatingField(
                        teeIndex,
                        editorGender,
                        'courseRating',
                        event.currentTarget.value,
                      )
                    }
                    onFocus={selectAllOnFocus}
                    readOnly={readOnly}
                    placeholder="72.4"
                    inputMode="decimal"
                  />
                </Box>
                <Box>
                  <Label size={0} muted>
                    Slope rating ({editorGender === 'men' ? "men's" : "women's"})
                  </Label>
                  <TextInput
                    value={activeRatings.slopeRating ?? ''}
                    onChange={(event) =>
                      setTeeRatingField(
                        teeIndex,
                        editorGender,
                        'slopeRating',
                        event.currentTarget.value,
                      )
                    }
                    onFocus={selectAllOnFocus}
                    readOnly={readOnly}
                    placeholder="135"
                    inputMode="numeric"
                  />
                </Box>
                <Flex gap={2}>
                  <Text size={0} muted weight="medium" style={{ flex: 1 }}>
                    Par ({editorGender === 'men' ? 'M' : 'W'})
                  </Text>
                  <Text size={0} muted weight="medium" style={{ flex: 1 }}>
                    Yds
                  </Text>
                  <Text size={0} muted weight="medium" style={{ flex: 1 }}>
                    Hdcp ({editorGender === 'men' ? 'M' : 'W'})
                  </Text>
                </Flex>
              </Stack>
            </Box>
          )})}

          {display.holes.map((row, holeIndex) => (
            <ScorecardGridRow
              key={row._key}
              row={row}
              holeIndex={holeIndex}
              holeCount={holeCount}
              teeCount={columnCount}
              visibleTeeIndices={visibleTeeIndices}
              editorGender={editorGender}
              holeFieldCount={holeFieldCount}
              readOnly={!!readOnly}
              onTeeFieldChange={(teeIndex, field, fieldValue) =>
                setTeeField(row.holeNumber, teeIndex, field, fieldValue)
              }
              onTeeParChange={(teeIndex, fieldValue) =>
                setTeeParField(row.holeNumber, teeIndex, editorGender, fieldValue)
              }
              onTeeHandicapChange={(teeIndex, fieldValue) =>
                setTeeHandicapField(row.holeNumber, teeIndex, editorGender, fieldValue)
              }
            />
          ))}

          <Text size={1} weight="semibold" style={{ alignSelf: 'center' }}>
            Total
          </Text>
          {visibleTeeIndices.map((teeIndex) => {
            const teeSet = display.teeSets[teeIndex]
            const computed = sumParForTeeColumn(
              display.holes,
              columnCount,
              teeIndex,
              editorGender,
            )
            return (
              <Fragment key={`total-par-${teeIndex}`}>
                <TextInput
                  value={computed}
                  readOnly
                  placeholder="—"
                  inputMode="numeric"
                  aria-label={`Total par for ${teeSet.name?.trim() || `tee ${teeIndex + 1}`} (auto-calculated)`}
                />
                <Box aria-hidden />
                <Box aria-hidden />
              </Fragment>
            )
          })}
        </Box>
      </Card>
    </Box>
  )
}

function ScorecardGridRow({
  row,
  holeIndex,
  holeCount,
  teeCount,
  visibleTeeIndices,
  editorGender,
  holeFieldCount,
  readOnly,
  onTeeFieldChange,
  onTeeParChange,
  onTeeHandicapChange,
}: {
  row: HoleItem
  holeIndex: number
  holeCount: number
  teeCount: number
  visibleTeeIndices: number[]
  editorGender: ScorecardGender
  holeFieldCount: number
  readOnly: boolean
  onTeeFieldChange: (teeIndex: number, field: 'yardage', value: string) => void
  onTeeParChange: (teeIndex: number, value: string) => void
  onTeeHandicapChange: (teeIndex: number, value: string) => void
}) {
  const tees = syncTeeEntries(teeCount, row.tees ?? [])
  const visibleColumnCount = visibleTeeIndices.length

  return (
    <>
      <Text size={1} muted style={{ fontVariantNumeric: 'tabular-nums' }}>
        {row.holeNumber}
      </Text>
      {visibleTeeIndices.map((teeIndex, visualIndex) => {
        const tee = tees[teeIndex]
        return (
        <Fragment key={`${row.holeNumber}-tee-${teeIndex}`}>
          <TextInput
            value={normalizePar(tee.par)[editorGender]}
            onChange={(event) => onTeeParChange(teeIndex, event.currentTarget.value)}
            onFocus={selectAllOnFocus}
            onKeyDown={(event) =>
              handleHoleFieldTabKey(
                event,
                holeFieldTabOrder(
                  holeIndex,
                  holeCount,
                  visibleColumnCount,
                  'par',
                  visualIndex,
                ),
                holeFieldCount,
              )
            }
            readOnly={readOnly}
            placeholder="4"
            inputMode="numeric"
            data-scorecard-tab-order={holeFieldTabOrder(
              holeIndex,
              holeCount,
              visibleColumnCount,
              'par',
              visualIndex,
            )}
          />
          <TextInput
            value={tee.yardage ?? ''}
            onChange={(event) =>
              onTeeFieldChange(teeIndex, 'yardage', event.currentTarget.value)
            }
            onFocus={selectAllOnFocus}
            onKeyDown={(event) =>
              handleHoleFieldTabKey(
                event,
                holeFieldTabOrder(
                  holeIndex,
                  holeCount,
                  visibleColumnCount,
                  'yardage',
                  visualIndex,
                ),
                holeFieldCount,
              )
            }
            readOnly={readOnly}
            placeholder="352"
            inputMode="numeric"
            data-scorecard-tab-order={holeFieldTabOrder(
              holeIndex,
              holeCount,
              visibleColumnCount,
              'yardage',
              visualIndex,
            )}
          />
          <TextInput
            value={normalizeHandicap(tee.handicap)[editorGender]}
            onChange={(event) =>
              onTeeHandicapChange(teeIndex, event.currentTarget.value)
            }
            onFocus={selectAllOnFocus}
            onKeyDown={(event) =>
              handleHoleFieldTabKey(
                event,
                holeFieldTabOrder(
                  holeIndex,
                  holeCount,
                  visibleColumnCount,
                  'handicap',
                  visualIndex,
                ),
                holeFieldCount,
              )
            }
            readOnly={readOnly}
            placeholder="13"
            inputMode="numeric"
            data-scorecard-tab-order={holeFieldTabOrder(
              holeIndex,
              holeCount,
              visibleColumnCount,
              'handicap',
              visualIndex,
            )}
          />
        </Fragment>
      )})}
    </>
  )
}
