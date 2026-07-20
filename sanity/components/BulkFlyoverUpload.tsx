'use client'

import { UploadIcon } from '@sanity/icons'
import {
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  Flex,
  Select,
  Stack,
  Text,
  useToast,
} from '@sanity/ui'
import { useCallback, useMemo, useRef, useState } from 'react'
import { useClient } from 'sanity'
import {
  matchFlyoverFiles,
  type MatchedFlyoverFile,
} from '../lib/match-flyover-filename'
import {
  muxVideoFieldValue,
  uploadMuxVideoFile,
} from '../lib/upload-mux-video'

type HoleSlot = {
  holeNumber: number
  hasVideo: boolean
}

type RowStatus =
  | 'idle'
  | 'queued'
  | 'uploading'
  | 'done'
  | 'error'
  | 'skipped'

type UploadRow = MatchedFlyoverFile & {
  id: string
  status: RowStatus
  progress: number
  error?: string
}

type BulkFlyoverUploadProps = {
  holeCount: number
  holes: HoleSlot[]
  disabled?: boolean
  onAttach: (holeNumber: number, assetDocumentId: string) => void
}

const CONCURRENCY = 2
const VIDEO_ACCEPT = 'video/mp4,video/quicktime,video/webm,video/x-m4v,video/*'

function hasVideoFile(file: File) {
  if (file.type.startsWith('video/')) return true
  return /\.(mp4|mov|m4v|webm|mkv)$/i.test(file.name)
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function BulkFlyoverUpload({
  holeCount,
  holes,
  disabled,
  onAttach,
}: BulkFlyoverUploadProps) {
  const client = useClient({ apiVersion: '2024-01-01' })
  const toast = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<UploadRow[]>([])
  const [replaceExisting, setReplaceExisting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const holeHasVideo = useMemo(() => {
    const map = new Map<number, boolean>()
    for (const hole of holes) {
      map.set(hole.holeNumber, hole.hasVideo)
    }
    return map
  }, [holes])

  const stageFiles = useCallback(
    (fileList: FileList | File[]) => {
      const videos = Array.from(fileList).filter(hasVideoFile)
      if (videos.length === 0) {
        toast.push({
          status: 'warning',
          title: 'No video files found',
          description: 'Drop MP4/MOV/WebM files named by hole (e.g. 07.mp4, hole-12.mp4).',
        })
        return
      }

      const matched = matchFlyoverFiles(videos, holeCount)
      setRows(
        matched.map((item, index) => ({
          ...item,
          id: `${item.file.name}-${item.file.size}-${item.file.lastModified}-${index}`,
          status: 'idle',
          progress: 0,
        })),
      )
    },
    [holeCount, toast],
  )

  const updateRow = useCallback((id: string, patch: Partial<UploadRow>) => {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  }, [])

  const setHoleForRow = useCallback((id: string, holeNumber: number | null) => {
    setRows((prev) => {
      const next = prev.map((row) =>
        row.id === id
          ? { ...row, holeNumber, conflict: false, error: undefined }
          : row,
      )
      const claimed = new Map<number, string>()
      return next.map((row) => {
        if (row.holeNumber == null) return { ...row, conflict: false }
        const existing = claimed.get(row.holeNumber)
        if (existing && existing !== row.id) {
          return { ...row, conflict: true }
        }
        claimed.set(row.holeNumber, row.id)
        return { ...row, conflict: false }
      })
    })
  }, [])

  const clearRows = useCallback(() => {
    if (uploading) return
    setRows([])
    if (inputRef.current) inputRef.current.value = ''
  }, [uploading])

  const readyCount = useMemo(() => {
    const claimed = new Set<number>()
    let count = 0
    for (const row of rows) {
      if (row.holeNumber == null || row.conflict) continue
      if (claimed.has(row.holeNumber)) continue
      if (holeHasVideo.get(row.holeNumber) && !replaceExisting) continue
      claimed.add(row.holeNumber)
      count += 1
    }
    return count
  }, [holeHasVideo, replaceExisting, rows])

  const runUploads = useCallback(async () => {
    if (uploading || readyCount === 0) return

    const claimed = new Set<number>()
    const queue = rows.filter((row) => {
      if (row.holeNumber == null || row.conflict) return false
      if (claimed.has(row.holeNumber)) return false
      if (holeHasVideo.get(row.holeNumber) && !replaceExisting) {
        updateRow(row.id, {
          status: 'skipped',
          error: 'Hole already has a video (enable Replace to overwrite)',
        })
        return false
      }
      claimed.add(row.holeNumber)
      return true
    })

    if (queue.length === 0) {
      toast.push({
        status: 'warning',
        title: 'Nothing to upload',
        description: 'Assign hole numbers, or enable Replace existing videos.',
      })
      return
    }

    setUploading(true)
    for (const row of queue) {
      updateRow(row.id, { status: 'queued', progress: 0, error: undefined })
    }

    let cursor = 0
    let successCount = 0
    let errorCount = 0

    const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
      while (cursor < queue.length) {
        const index = cursor
        cursor += 1
        const row = queue[index]
        const holeNumber = row.holeNumber
        if (holeNumber == null) continue

        updateRow(row.id, { status: 'uploading', progress: 0, error: undefined })
        try {
          const { assetId } = await uploadMuxVideoFile(client, row.file, (percent) => {
            updateRow(row.id, { progress: percent })
          })
          onAttach(holeNumber, assetId)
          updateRow(row.id, { status: 'done', progress: 100 })
          successCount += 1
        } catch (err) {
          errorCount += 1
          updateRow(row.id, {
            status: 'error',
            error: err instanceof Error ? err.message : 'Upload failed',
          })
        }
      }
    })

    await Promise.all(workers)
    setUploading(false)

    toast.push({
      status: errorCount > 0 ? 'warning' : 'success',
      title:
        errorCount > 0
          ? `Uploaded ${successCount}, ${errorCount} failed`
          : `Uploaded ${successCount} flyover${successCount === 1 ? '' : 's'}`,
      description:
        errorCount > 0
          ? 'Fix failed rows and try again, or upload those holes individually.'
          : 'Mux will finish processing in the background. Then run frame extraction when ready.',
    })
  }, [
    client,
    holeHasVideo,
    onAttach,
    readyCount,
    replaceExisting,
    rows,
    toast,
    updateRow,
    uploading,
  ])

  return (
    <Card
      padding={3}
      radius={2}
      shadow={1}
      tone="transparent"
      style={{ marginBottom: '1rem' }}
    >
      <Stack space={3}>
        <Flex align="center" justify="space-between" gap={3} wrap="wrap">
          <Stack space={2} style={{ flex: 1, minWidth: '16rem' }}>
            <Text size={1} weight="semibold">
              Bulk upload flyovers
            </Text>
            <Text size={1} muted>
              Drop videos named by hole — e.g. <code>07.mp4</code>,{' '}
              <code>hole-12.mp4</code>, <code>Hole 3.mov</code>. Assign any
              unmatched files, then upload. You don’t need to wait for Mux to
              finish before leaving this page.
            </Text>
          </Stack>
          <Flex gap={2}>
            <Button
              text="Choose files"
              icon={UploadIcon}
              mode="ghost"
              disabled={disabled || uploading}
              onClick={() => inputRef.current?.click()}
            />
            {rows.length > 0 ? (
              <Button
                text="Clear"
                mode="bleed"
                disabled={uploading}
                onClick={clearRows}
              />
            ) : null}
          </Flex>
        </Flex>

        <input
          ref={inputRef}
          type="file"
          accept={VIDEO_ACCEPT}
          multiple
          hidden
          onChange={(event) => {
            if (event.currentTarget.files) stageFiles(event.currentTarget.files)
          }}
        />

        <Card
          padding={4}
          radius={2}
          tone={dragOver ? 'primary' : 'transparent'}
          border
          style={{
            borderStyle: 'dashed',
            cursor: disabled || uploading ? 'not-allowed' : 'pointer',
            opacity: disabled || uploading ? 0.6 : 1,
          }}
          onDragEnter={(event) => {
            event.preventDefault()
            if (!disabled && !uploading) setDragOver(true)
          }}
          onDragOver={(event) => {
            event.preventDefault()
          }}
          onDragLeave={(event) => {
            event.preventDefault()
            setDragOver(false)
          }}
          onDrop={(event) => {
            event.preventDefault()
            setDragOver(false)
            if (disabled || uploading) return
            if (event.dataTransfer.files?.length) {
              stageFiles(event.dataTransfer.files)
            }
          }}
          onClick={() => {
            if (!disabled && !uploading) inputRef.current?.click()
          }}
        >
          <Text align="center" size={1} muted>
            {dragOver
              ? 'Drop videos to match holes'
              : `Drop up to ${holeCount} hole videos here`}
          </Text>
        </Card>

        {rows.length > 0 ? (
          <Stack space={3}>
            <Flex align="center" gap={3} wrap="wrap">
              <Flex align="center" gap={2}>
                <Checkbox
                  id="bulk-replace-existing"
                  checked={replaceExisting}
                  disabled={uploading}
                  onChange={(event) =>
                    setReplaceExisting(event.currentTarget.checked)
                  }
                />
                <Text size={1}>
                  <label htmlFor="bulk-replace-existing">
                    Replace existing hole videos
                  </label>
                </Text>
              </Flex>
              <Box flex={1} />
              <Button
                text={`Upload ${readyCount} matched`}
                tone="primary"
                disabled={disabled || uploading || readyCount === 0}
                onClick={() => void runUploads()}
              />
            </Flex>

            <Stack space={2}>
              {rows.map((row) => {
                const existing = row.holeNumber
                  ? holeHasVideo.get(row.holeNumber)
                  : false
                return (
                  <Card key={row.id} padding={3} radius={2} border tone="transparent">
                    <Flex align="center" gap={3} wrap="wrap">
                      <Stack space={2} style={{ flex: '1 1 14rem', minWidth: 0 }}>
                        <Text size={1} weight="medium" textOverflow="ellipsis">
                          {row.file.name}
                        </Text>
                        <Text size={0} muted>
                          {formatBytes(row.file.size)}
                          {row.conflict ? ' · hole conflict — pick another' : ''}
                          {existing && !replaceExisting
                            ? ' · hole already has a video'
                            : ''}
                        </Text>
                      </Stack>

                      <Select
                        fontSize={1}
                        value={row.holeNumber == null ? '' : String(row.holeNumber)}
                        disabled={uploading || row.status === 'done'}
                        style={{ width: '7.5rem' }}
                        onChange={(event) => {
                          const raw = event.currentTarget.value
                          setHoleForRow(
                            row.id,
                            raw ? Number.parseInt(raw, 10) : null,
                          )
                        }}
                      >
                        <option value="">Unassigned</option>
                        {Array.from({ length: holeCount }, (_, index) => {
                          const holeNumber = index + 1
                          return (
                            <option key={holeNumber} value={holeNumber}>
                              Hole {holeNumber}
                            </option>
                          )
                        })}
                      </Select>

                      <Badge
                        tone={
                          row.status === 'done'
                            ? 'positive'
                            : row.status === 'error'
                              ? 'critical'
                              : row.status === 'uploading' || row.status === 'queued'
                                ? 'primary'
                                : row.holeNumber == null || row.conflict
                                  ? 'caution'
                                  : 'default'
                        }
                      >
                        {row.status === 'uploading'
                          ? `${row.progress}%`
                          : row.status === 'queued'
                            ? 'Queued'
                            : row.status === 'done'
                              ? 'Done'
                              : row.status === 'error'
                                ? 'Failed'
                                : row.status === 'skipped'
                                  ? 'Skipped'
                                  : row.holeNumber == null
                                    ? 'Needs hole'
                                    : row.conflict
                                      ? 'Conflict'
                                      : 'Ready'}
                      </Badge>
                    </Flex>
                    {row.error ? (
                      <Box marginTop={2}>
                        <Text size={1} style={{ color: 'var(--card-badge-critical-fg-color)' }}>
                          {row.error}
                        </Text>
                      </Box>
                    ) : null}
                  </Card>
                )
              })}
            </Stack>
          </Stack>
        ) : null}
      </Stack>
    </Card>
  )
}
