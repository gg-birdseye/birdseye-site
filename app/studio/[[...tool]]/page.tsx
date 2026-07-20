'use client'

/**
 * Studio must never render on the server: Sanity calls `window` during
 * WorkspaceProvider / auth setup (Next still SSRs client components once).
 * Dynamic import with `ssr: false` keeps NextStudio browser-only.
 */

import dynamic from 'next/dynamic'
import config from '../../../sanity.config'

const NextStudio = dynamic(
  () => import('next-sanity/studio').then((mod) => mod.NextStudio),
  {
    ssr: false,
    loading: () => (
      <div
        style={{
          display: 'grid',
          placeItems: 'center',
          height: '100vh',
          background: '#101112',
          color: '#c3c6c9',
          fontFamily: 'system-ui, sans-serif',
          fontSize: 14,
        }}
      >
        Loading Studio…
      </div>
    ),
  },
)

export default function StudioPage() {
  return <NextStudio config={config} />
}
