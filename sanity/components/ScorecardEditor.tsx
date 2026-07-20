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
import { resolveTeeColor } from '../../lib/constants/teeColors'

import { SCORECARD_TEE_COUNT_OPTIONS } from '../schemaTypes/scorecardConfig'

type ScorecardGender = 'men' | 'women'

type GenderRatings = {
  courseRating?: string
  slopeRating?: string
}

type TeeEntry = {
  par?: { men?: string; women?: string } | string
  yardage?: string
  handicap?: { men?: string; women?: string } | string
}

type TeeSet = {
  name?: string
  color?: string
  totalYards?: string
  totalPar?: { men?: string; women?: string }
  ratings?: { men?: GenderRatings; women?: GenderRatings }
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
  teeSets?: TeeSet[]
  teeNames?: string[]
  holes?: HoleItem[]
}

const TEE_COUNTS = SCORECARD_TEE_COUNT_OPTIONS.map((option) => option.value)

function makeKey(holeNumber: number) {
  return `scorecard-hole-${holeNumber}`
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

function syncTeeSets(
  count: number,
  existing: TeeSet[] = [],
  legacyNames: string[] = [],
): TeeSet[] {
  return Array.from({ length: count }, (_, index) => {
    const prev = existing[index]
    return {
      name: prev?.name ?? legacyNames[index] ?? '',
      color: resolveTeeColor(prev?.color, index),
      totalYards: prev?.totalYards ?? '',
      totalPar: normalizeGenderValues(prev?.totalPar),
      ratings: normalizeGenderRatings(prev),
    }
  })
}

function sumParForTeeColumn(
  holes: HoleItem[],
  teeCount: number,
  teeIndex: number,
  gender: ScorecardGender,
): string {
  let sum = 0
  let hasValue = false
  for (const row of holes) {
    const tees = syncTeeEntries(teeCount, row.tees ?? [])
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
  teeCount: number,
): TeeSet[] {
  return teeSets.map((teeSet, teeIndex) => ({
    ...teeSet,
    totalPar: {
      men: sumParForTeeColumn(holes, teeCount, teeIndex, 'men'),
      women: sumParForTeeColumn(holes, teeCount, teeIndex, 'women'),
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
  teeCount: number,
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
      teeCount,
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

function normalizeScorecard(
  value: ScorecardValue | undefined,
  holeCount: number,
): Required<Pick<ScorecardValue, 'hasWomenRatings' | 'teeCount' | 'teeSets' | 'holes'>> {
  const teeCount = TEE_COUNTS.includes((value?.teeCount ?? 3) as (typeof TEE_COUNTS)[number])
    ? (value?.teeCount ?? 3)
    : 3
  const holes = buildHoleSlots(holeCount, teeCount, value?.holes ?? [])
  const teeSets = applyComputedTotalPars(
    syncTeeSets(teeCount, value?.teeSets ?? [], value?.teeNames ?? []),
    holes,
    teeCount,
  )
  return {
    hasWomenRatings: Boolean(value?.hasWomenRatings),
    teeCount,
    teeSets,
    holes,
  }
}

function scorecardMatches(
  value: ScorecardValue | undefined,
  holeCount: number,
): boolean {
  const normalized = normalizeScorecard(value, holeCount)
  if ((value?.teeCount ?? 3) !== normalized.teeCount) return false
  if ((value?.teeSets ?? []).length !== normalized.teeCount) return false
  if ((value?.holes ?? []).length !== holeCount) return false

  for (let holeIndex = 0; holeIndex < holeCount; holeIndex += 1) {
    const hole = value?.holes?.[holeIndex]
    if (hole?.holeNumber !== holeIndex + 1) return false
    if ((hole?.tees ?? []).length !== normalized.teeCount) return false
  }

  for (let teeIndex = 0; teeIndex < normalized.teeCount; teeIndex += 1) {
    const stored = normalizeGenderValues(value?.teeSets?.[teeIndex]?.totalPar)
    const computed = normalizeGenderValues(normalized.teeSets[teeIndex]?.totalPar)
    if (stored.men !== computed.men || stored.women !== computed.women) return false
  }

  return true
}

function buildGridStyle(teeCount: number): CSSProperties {
  const teeColumns = Array.from(
    { length: teeCount },
    () =>
      'minmax(3.25rem, 1fr) minmax(6rem, 1fr) minmax(4.5rem, 1fr)',
  ).join(' ')
  return {
    display: 'grid',
    gridTemplateColumns: `3.5rem ${teeColumns}`,
    gap: '0.5rem',
    alignItems: 'start',
    minWidth: `${10 + teeCount * 14}rem`,
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

  const commit = useCallback(
    (
      next: Required<
        Pick<ScorecardValue, 'hasWomenRatings' | 'teeCount' | 'teeSets' | 'holes'>
      >,
    ) => {
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

  const setHasWomenRatings = useCallback(
    (checked: boolean) => {
      if (!holeCount || readOnly) return
      const base = normalizeScorecard(value, holeCount)
      commit({ ...base, hasWomenRatings: checked })
    },
    [commit, holeCount, readOnly, value],
  )

  const setTeeCount = useCallback(
    (teeCount: number) => {
      if (!holeCount || readOnly) return
      const base = normalizeScorecard(value, holeCount)
      const holes = buildHoleSlots(holeCount, teeCount, base.holes)
      const teeSets = applyComputedTotalPars(
        syncTeeSets(teeCount, base.teeSets),
        holes,
        teeCount,
      )
      commit({
        ...base,
        teeCount,
        teeSets,
        holes,
      })
    },
    [commit, holeCount, readOnly, value],
  )

  const setTeeSetField = useCallback(
    (teeIndex: number, field: 'name' | 'color' | 'totalYards', fieldValue: string) => {
      if (!holeCount || readOnly) return
      const base = normalizeScorecard(value, holeCount)
      const teeSets = syncTeeSets(base.teeCount, base.teeSets)
      teeSets[teeIndex] = { ...teeSets[teeIndex], [field]: fieldValue }
      commit({ ...base, teeSets })
    },
    [commit, holeCount, readOnly, value],
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
      const teeSets = syncTeeSets(base.teeCount, base.teeSets)
      const ratings = normalizeGenderRatings(teeSets[teeIndex])
      ratings[gender] = { ...ratings[gender], [field]: fieldValue }
      teeSets[teeIndex] = { ...teeSets[teeIndex], ratings }
      commit({ ...base, teeSets })
    },
    [commit, holeCount, readOnly, value],
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
      const holes = base.holes.map((row) => {
        if (row.holeNumber !== holeNumber) return row
        const tees = syncTeeEntries(base.teeCount, row.tees ?? [])
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
      const holes = base.holes.map((row) => {
        if (row.holeNumber !== holeNumber) return row
        const tees = syncTeeEntries(base.teeCount, row.tees ?? [])
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
      const holes = base.holes.map((row) => {
        if (row.holeNumber !== holeNumber) return row
        const tees = syncTeeEntries(base.teeCount, row.tees ?? [])
        const par = normalizePar(tees[teeIndex]?.par)
        par[gender] = fieldValue
        tees[teeIndex] = { ...tees[teeIndex], par }
        return { ...row, tees }
      })
      commit({
        ...base,
        holes,
        teeSets: applyComputedTotalPars(base.teeSets, holes, base.teeCount),
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

  const gridStyle = buildGridStyle(display.teeCount)
  const holeFieldCount = holeFieldTabCount(holeCount, display.teeCount)

  return (
    <Box paddingY={2}>
      <Flex align="center" gap={3} marginBottom={4} wrap="wrap">
        <Box style={{ minWidth: '12rem' }}>
          <Label size={1} muted>
            Number of Tees
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
          {holeCount} holes · {display.teeCount} tees · editing{' '}
          {editorGender === 'men' ? "men's" : "women's"} par (per tee), ratings &amp;
          stroke index — tab down each column to enter data quickly.
        </Text>
      </Flex>

      <Card padding={3} radius={2} border style={{ overflowX: 'auto' }}>
        <Box data-scorecard-grid style={gridStyle}>
          <Text size={1} weight="semibold">
            Hole
          </Text>

          {display.teeSets.map((teeSet, teeIndex) => {
            const ratings = normalizeGenderRatings(teeSet)
            const activeRatings = ratings[editorGender]
            return (
            <Box
              key={`tee-header-${teeIndex}`}
              style={{ gridColumn: 'span 3 / span 3' }}
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
                        placeholder={`Tee ${teeIndex + 1}`}
                      />
                    </Box>
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
                  </Flex>
                </Box>
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
              teeCount={display.teeCount}
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
          {display.teeSets.map((teeSet, teeIndex) => {
            const computed = sumParForTeeColumn(
              display.holes,
              display.teeCount,
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
  editorGender: ScorecardGender
  holeFieldCount: number
  readOnly: boolean
  onTeeFieldChange: (teeIndex: number, field: 'yardage', value: string) => void
  onTeeParChange: (teeIndex: number, value: string) => void
  onTeeHandicapChange: (teeIndex: number, value: string) => void
}) {
  const tees = syncTeeEntries(teeCount, row.tees ?? [])

  return (
    <>
      <Text size={1} muted style={{ fontVariantNumeric: 'tabular-nums' }}>
        {row.holeNumber}
      </Text>
      {tees.map((tee, teeIndex) => (
        <Fragment key={`${row.holeNumber}-tee-${teeIndex}`}>
          <TextInput
            value={normalizePar(tee.par)[editorGender]}
            onChange={(event) => onTeeParChange(teeIndex, event.currentTarget.value)}
            onFocus={selectAllOnFocus}
            onKeyDown={(event) =>
              handleHoleFieldTabKey(
                event,
                holeFieldTabOrder(holeIndex, holeCount, teeCount, 'par', teeIndex),
                holeFieldCount,
              )
            }
            readOnly={readOnly}
            placeholder="4"
            inputMode="numeric"
            data-scorecard-tab-order={holeFieldTabOrder(
              holeIndex,
              holeCount,
              teeCount,
              'par',
              teeIndex,
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
                holeFieldTabOrder(holeIndex, holeCount, teeCount, 'yardage', teeIndex),
                holeFieldCount,
              )
            }
            readOnly={readOnly}
            placeholder="352"
            inputMode="numeric"
            data-scorecard-tab-order={holeFieldTabOrder(
              holeIndex,
              holeCount,
              teeCount,
              'yardage',
              teeIndex,
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
                holeFieldTabOrder(holeIndex, holeCount, teeCount, 'handicap', teeIndex),
                holeFieldCount,
              )
            }
            readOnly={readOnly}
            placeholder="13"
            inputMode="numeric"
            data-scorecard-tab-order={holeFieldTabOrder(
              holeIndex,
              holeCount,
              teeCount,
              'handicap',
              teeIndex,
            )}
          />
        </Fragment>
      ))}
    </>
  )
}
