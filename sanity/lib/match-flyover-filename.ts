/**
 * Infer hole number from a flyover filename.
 * Supports: 7.mp4, 07.mp4, hole-7.mp4, hole_07.mp4, Hole 7.mp4, h7.mp4, course-07.mp4, etc.
 */
export function matchFlyoverHoleNumber(
  filename: string,
  holeCount: number,
): number | null {
  if (!holeCount || holeCount < 1) return null

  const base = filename
    .replace(/^.*[/\\]/, '')
    .replace(/\.[^.]+$/, '')
    .trim()

  if (!base) return null

  const patterns: RegExp[] = [
    /^hole[\s_-]*0*(\d+)$/i,
    /^h(?:ole)?[\s_-]*0*(\d+)$/i,
    /^0*(\d+)$/,
    /(?:^|[\s_-])hole[\s_-]*0*(\d+)$/i,
    /(?:^|[\s_-])h[\s_-]*0*(\d+)$/i,
    /^0*(\d+)(?:[\s_-]|$)/,
    /(?:^|[\s_-])0*(\d+)$/,
  ]

  for (const pattern of patterns) {
    const match = base.match(pattern)
    if (!match?.[1]) continue
    const holeNumber = Number.parseInt(match[1], 10)
    if (
      Number.isFinite(holeNumber) &&
      holeNumber >= 1 &&
      holeNumber <= holeCount
    ) {
      return holeNumber
    }
  }

  return null
}

export type MatchedFlyoverFile = {
  file: File
  holeNumber: number | null
  conflict: boolean
}

/**
 * Match files to holes. First file wins a hole; later duplicates are marked conflict
 * and cleared to null so the user can reassign.
 */
export function matchFlyoverFiles(
  files: File[],
  holeCount: number,
): MatchedFlyoverFile[] {
  const claimed = new Set<number>()
  const results: MatchedFlyoverFile[] = []

  for (const file of files) {
    let holeNumber = matchFlyoverHoleNumber(file.name, holeCount)
    let conflict = false

    if (holeNumber != null) {
      if (claimed.has(holeNumber)) {
        conflict = true
        holeNumber = null
      } else {
        claimed.add(holeNumber)
      }
    }

    results.push({ file, holeNumber, conflict })
  }

  return results
}
