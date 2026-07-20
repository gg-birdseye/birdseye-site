'use client'

import { Box, Flex, Radio, Stack, Text, TextInput } from '@sanity/ui'
import { useCallback, useEffect, useState, type ChangeEvent } from 'react'
import { set, unset, type NumberInputProps } from 'sanity'

import { COURSE_TYPE_PRESETS } from '../lib/courseTypePresets'

type CourseTypePreset = '9' | '18' | 'other'

function presetFromValue(value: number | undefined): CourseTypePreset {
  if (value === 9) return '9'
  if (value === 18) return '18'
  return 'other'
}

function otherValueFromHoleCount(value: number | undefined, preset: CourseTypePreset): string {
  if (preset !== 'other' || value == null || value === 9 || value === 18) return ''
  return String(value)
}

export function CourseTypeInput(props: NumberInputProps) {
  const { onChange, readOnly, value } = props
  const holeCount = typeof value === 'number' ? value : undefined

  const [preset, setPreset] = useState<CourseTypePreset>(() => presetFromValue(holeCount))
  const [otherValue, setOtherValue] = useState(() =>
    otherValueFromHoleCount(holeCount, presetFromValue(holeCount)),
  )

  useEffect(() => {
    const nextPreset = presetFromValue(holeCount)
    setPreset(nextPreset)
    setOtherValue(otherValueFromHoleCount(holeCount, nextPreset))
  }, [holeCount])

  const handlePresetChange = useCallback(
    (nextPreset: CourseTypePreset) => {
      if (readOnly) return
      setPreset(nextPreset)
      if (nextPreset === '9') {
        onChange(set(9))
        return
      }
      if (nextPreset === '18') {
        onChange(set(18))
        return
      }
      setOtherValue('')
      onChange(unset())
    },
    [onChange, readOnly],
  )

  const handleOtherChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      if (readOnly) return
      const nextValue = event.currentTarget.value.replace(/\D/g, '')
      setOtherValue(nextValue)
      setPreset('other')
      if (!nextValue) {
        onChange(unset())
        return
      }
      const parsed = Number.parseInt(nextValue, 10)
      if (Number.isInteger(parsed) && parsed >= 1) {
        onChange(set(parsed))
      }
    },
    [onChange, readOnly],
  )

  return (
    <Stack space={4}>
      <Stack space={3}>
        {COURSE_TYPE_PRESETS.map((option) => {
          const optionPreset = String(option.value) as '9' | '18'
          return (
            <Flex key={option.value} align="center">
              <Radio
                checked={preset === optionPreset}
                disabled={readOnly}
                id={`course-type-${option.value}`}
                name="course-type"
                onChange={() => handlePresetChange(optionPreset)}
                value={String(option.value)}
              />
              <Box flex={1} paddingLeft={3}>
                <Text as="label" htmlFor={`course-type-${option.value}`} size={2}>
                  {option.title}
                </Text>
              </Box>
            </Flex>
          )
        })}
        <Flex align="center">
          <Radio
            checked={preset === 'other'}
            disabled={readOnly}
            id="course-type-other"
            name="course-type"
            onChange={() => handlePresetChange('other')}
            value="other"
          />
          <Box flex={1} paddingLeft={3}>
            <Text as="label" htmlFor="course-type-other" size={2}>
              Other
            </Text>
          </Box>
        </Flex>
      </Stack>

      {preset === 'other' ? (
        <Stack space={2}>
          <Text size={1} weight="medium">
            Number of Holes
          </Text>
          <TextInput
            disabled={readOnly}
            inputMode="numeric"
            onChange={handleOtherChange}
            placeholder="e.g. 27"
            value={otherValue}
          />
        </Stack>
      ) : null}
    </Stack>
  )
}
