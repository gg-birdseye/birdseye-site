'use client'

import { Box, Label, Stack, Text } from '@sanity/ui'
import { useEffect, useRef } from 'react'
import { set, useFormValue } from 'sanity'
import type { ArrayOfObjectsInputProps, ItemProps, ObjectItemProps } from 'sanity'

type CourseSelectionItem = {
  _type: 'relatedCourseSelection'
  _key: string
  course?: {
    _type: 'reference'
    _ref: string
  }
}

function makeKey(index: number) {
  return `related-course-${index}`
}

function buildSelections(
  count: number,
  existing: CourseSelectionItem[] = [],
): CourseSelectionItem[] {
  return Array.from({ length: count }, (_, index) => {
    const prev = existing[index]
    if (prev?._type === 'relatedCourseSelection') {
      return {
        ...prev,
        _key: prev._key ?? makeKey(index),
      }
    }
    return {
      _type: 'relatedCourseSelection',
      _key: makeKey(index),
    }
  })
}

function selectionsMatch(count: number, current: CourseSelectionItem[]): boolean {
  if (current.length !== count) return false
  return current.every((item) => item?._type === 'relatedCourseSelection' && item._key)
}

function resolveCourseCount(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isInteger(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isInteger(parsed)) return parsed
  }
  return undefined
}

export function CourseSelectionsInput(props: ArrayOfObjectsInputProps) {
  const pagePanels = useFormValue(['pagePanels']) as
    | { courses?: boolean; courseCount?: number | string }
    | undefined
  const courseCount = resolveCourseCount(pagePanels?.courseCount)
  const coursesEnabled = pagePanels?.courses
  const syncingRef = useRef(false)

  useEffect(() => {
    if (!coursesEnabled || !courseCount || courseCount < 2) return
    const current = (props.value ?? []) as CourseSelectionItem[]
    if (selectionsMatch(courseCount, current) || syncingRef.current) return

    syncingRef.current = true
    props.onChange(set(buildSelections(courseCount, current)))
    queueMicrotask(() => {
      syncingRef.current = false
    })
  }, [courseCount, coursesEnabled, props.onChange, props.value])

  if (!coursesEnabled) {
    return (
      <Box paddingY={2}>
        <Text muted size={1}>
          Enable the Course panel above to choose related courses.
        </Text>
      </Box>
    )
  }

  if (!courseCount || courseCount < 2) {
    return (
      <Box paddingY={2}>
        <Text muted size={1}>
          Select the number of courses above to configure course links.
        </Text>
      </Box>
    )
  }

  return (
    <Stack space={4}>
      <Text muted size={1}>
        Choose {courseCount} courses to show in the Course panel.
      </Text>
      {props.renderDefault({
        ...props,
        renderItem(itemProps: Omit<ObjectItemProps, 'renderDefault'>) {
          const item = itemProps as ObjectItemProps<CourseSelectionItem>
          const rowKey = item.value._key ?? `course-selection-${item.index}`

          return (
            <Box key={rowKey} paddingBottom={3}>
              <Label size={1} muted style={{ marginBottom: '0.5rem' }}>
                Course {item.index + 1}
              </Label>
              {item.renderDefault({
                ...item,
                open: true,
              } as ItemProps)}
            </Box>
          )
        },
      })}
    </Stack>
  )
}
