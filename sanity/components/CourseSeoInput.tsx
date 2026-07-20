'use client'

import { Button, Card, Flex, Stack, Text } from '@sanity/ui'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { set, useFormValue, type ObjectInputProps } from 'sanity'

import { buildCourseSeoDefaults } from '../../lib/seo/course-meta'

type CourseSeoValue = {
  metaTitle?: string
  metaDescription?: string
  ogImage?: unknown
}

/**
 * Autofills SEO title/description from course name + location while empty
 * (or still matching the previous suggestion). Manual edits are left alone.
 */
export function CourseSeoInput(props: ObjectInputProps) {
  const { onChange, readOnly, renderDefault, value } = props
  const seo = (value ?? {}) as CourseSeoValue

  const courseTitle = useFormValue(['title']) as string | undefined
  const city = useFormValue(['address', 'city']) as string | undefined
  const state = useFormValue(['address', 'state']) as string | undefined

  const suggested = useMemo(
    () =>
      buildCourseSeoDefaults({
        title: courseTitle,
        city,
        state,
      }),
    [courseTitle, city, state],
  )

  const lastSuggestedRef = useRef(suggested)

  useEffect(() => {
    if (readOnly) return

    const previous = lastSuggestedRef.current
    lastSuggestedRef.current = suggested

    const patches = []

    const titleEmpty = !seo.metaTitle?.trim()
    const titleWasAuto =
      Boolean(seo.metaTitle?.trim()) &&
      seo.metaTitle?.trim() === previous.metaTitle
    if ((titleEmpty || titleWasAuto) && seo.metaTitle !== suggested.metaTitle) {
      patches.push(set(suggested.metaTitle, ['metaTitle']))
    }

    const descEmpty = !seo.metaDescription?.trim()
    const descWasAuto =
      Boolean(seo.metaDescription?.trim()) &&
      seo.metaDescription?.trim() === previous.metaDescription
    if (
      (descEmpty || descWasAuto) &&
      seo.metaDescription !== suggested.metaDescription
    ) {
      patches.push(set(suggested.metaDescription, ['metaDescription']))
    }

    if (patches.length > 0) {
      onChange(patches)
    }
  }, [
    onChange,
    readOnly,
    seo.metaDescription,
    seo.metaTitle,
    suggested,
    suggested.metaDescription,
    suggested.metaTitle,
  ])

  const handleReset = useCallback(() => {
    if (readOnly) return
    onChange([
      set(suggested.metaTitle, ['metaTitle']),
      set(suggested.metaDescription, ['metaDescription']),
    ])
  }, [onChange, readOnly, suggested.metaDescription, suggested.metaTitle])

  const isCustomized =
    (seo.metaTitle?.trim() && seo.metaTitle.trim() !== suggested.metaTitle) ||
    (seo.metaDescription?.trim() &&
      seo.metaDescription.trim() !== suggested.metaDescription)

  return (
    <Stack space={3}>
      <Card padding={3} radius={2} tone="transparent" border>
        <Stack space={3}>
          <Text size={1} muted>
            Meta title and description fill in automatically from the course
            name and location. Edit them anytime to override, or reset to the
            suggested defaults.
          </Text>
          {isCustomized ? (
            <Flex>
              <Button
                text="Reset to suggested"
                mode="ghost"
                tone="primary"
                fontSize={1}
                disabled={readOnly}
                onClick={handleReset}
              />
            </Flex>
          ) : null}
        </Stack>
      </Card>
      {renderDefault(props)}
    </Stack>
  )
}
