import { defineConfig } from 'sanity'
import { structureTool } from 'sanity/structure'
import { structure } from './sanity/structure'
import { visionTool } from '@sanity/vision'
import { muxInput } from 'sanity-plugin-mux-input' // The video power-up
import { schemaTypes } from './sanity/schemaTypes' // This pulls in your course.ts

export default defineConfig({
  name: 'default',
  title: 'BirdsEye Studio',

  // These pull from the .env.local file Sanity created for you
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET!,

  // This is the URL where your dashboard will live
  basePath: '/studio',

  plugins: [
    structureTool({ structure }),
    visionTool(), 
    muxInput({
      // Static MP4 for scroll-scrub players; HLS is poor when seeking every frame.
      static_renditions: ['highest'],
      max_resolution_tier: '2160p',
    }),
  ],

  schema: {
    types: schemaTypes,
  },
})
