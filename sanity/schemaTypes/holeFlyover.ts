import { defineField, defineType } from 'sanity'
import { CameraPathEditor } from '../components/CameraPathEditor'
import { YardageArcEditor } from '../components/YardageArcEditor'

export default defineType({
  name: 'holeFlyover',
  title: 'Hole Flyover',
  type: 'object',
  fields: [
    defineField({
      name: 'holeNumber',
      title: 'Hole',
      type: 'number',
      readOnly: true,
      validation: (Rule) => Rule.required().min(1).max(27),
    }),
    defineField({
      name: 'description',
      title: 'Hole Information',
      type: 'text',
      rows: 4,
      description:
        'Optional. When any hole has this filled in, players can toggle hole info across the bottom of the video player.',
    }),
    defineField({
      name: 'flyoverVideo',
      title: 'Flyover Video',
      type: 'mux.video',
      description:
        'Scroll-scrub flyover clip for this hole. After upload, run `npm run extract-pending` locally (or configure Mux webhooks) to generate scroll frames.',
    }),
    defineField({
      name: 'holeGraphic',
      title: 'Hole Graphic',
      type: 'file',
      description:
        'SVG or image of this hole for Hole View on the course page (shown beside the flyover on desktop).',
      options: {
        accept: 'image/svg+xml,image/png,image/webp,.svg,.png,.webp',
      },
      fields: [
        defineField({
          name: 'alt',
          title: 'Alt text',
          type: 'string',
          description: 'Accessibility label — e.g. "Hole 7 layout diagram".',
        }),
      ],
    }),
    defineField({
      name: 'cameraPath',
      title: 'Camera Path',
      type: 'array',
      of: [{ type: 'cameraPathPoint' }],
      description:
        'Draw the camera movement path on the hole graphic. Click-to-place in order: start → waypoints → end. Set Video progress (%) on midpoints (e.g. 30, 90) to match where each point lands in the flyover clip.',
      components: {
        input: CameraPathEditor,
      },
    }),
    defineField({
      name: 'yardageArcs',
      title: 'Yardage Arcs',
      type: 'object',
      description:
        'Click the green center (pin), then click known distances (100, 150, 200…) to draw arcs to the pin on Hole View.',
      fields: [
        defineField({
          name: 'pin',
          title: 'Pin / green center',
          type: 'object',
          fields: [
            defineField({
              name: 'x',
              title: 'Horizontal position (%)',
              type: 'number',
              validation: (Rule) => Rule.min(0).max(100),
            }),
            defineField({
              name: 'y',
              title: 'Vertical position (%)',
              type: 'number',
              validation: (Rule) => Rule.min(0).max(100),
            }),
          ],
        }),
        defineField({
          name: 'markers',
          title: 'Distance markers',
          type: 'array',
          of: [{ type: 'yardageArcMarker' }],
        }),
        defineField({
          name: 'arcClip',
          title: 'Custom arc clip region',
          description:
            'Optional. When 3+ points are set, dashed arcs only appear inside this polygon (replaces auto green detection). Use the editor above to draw it.',
          type: 'array',
          of: [
            {
              type: 'object',
              name: 'yardageArcClipPoint',
              fields: [
                defineField({
                  name: 'x',
                  title: 'Horizontal position (%)',
                  type: 'number',
                  validation: (Rule) => Rule.min(0).max(100),
                }),
                defineField({
                  name: 'y',
                  title: 'Vertical position (%)',
                  type: 'number',
                  validation: (Rule) => Rule.min(0).max(100),
                }),
              ],
            },
          ],
        }),
      ],
      components: {
        input: YardageArcEditor,
      },
    }),
    defineField({
      name: 'flyoverFrames',
      title: 'Scroll frames',
      type: 'object',
      description:
        'Auto-generated image sequence for buttery scroll-scrubbing. Populated by the frame extraction pipeline after video upload.',
      readOnly: true,
      fields: [
        defineField({
          name: 'status',
          title: 'Status',
          type: 'string',
          options: {
            list: [
              { title: 'Processing', value: 'processing' },
              { title: 'Ready', value: 'ready' },
              { title: 'Failed', value: 'failed' },
            ],
          },
        }),
        defineField({
          name: 'manifestUrl',
          title: 'Manifest URL',
          type: 'url',
          description:
            'Same-origin path or absolute URL to the frame sequence manifest (e.g. /frames/{playbackId}/manifest.json).',
          validation: (Rule) =>
            Rule.uri({
              allowRelative: true,
              scheme: ['http', 'https'],
            }),
        }),
        defineField({ name: 'frameCount', title: 'Frame count', type: 'number' }),
        defineField({ name: 'fps', title: 'FPS', type: 'number' }),
        defineField({ name: 'version', title: 'Version', type: 'number' }),
      ],
    }),
  ],
  preview: {
    select: {
      holeNumber: 'holeNumber',
      status: 'flyoverVideo.asset.status',
      frameStatus: 'flyoverFrames.status',
    },
    prepare({ holeNumber, status, frameStatus }) {
      const uploaded = status && status !== 'waiting'
      const frameLabel =
        frameStatus === 'ready'
          ? ' · frames ready'
          : frameStatus === 'processing'
            ? ' · frames processing'
            : frameStatus === 'failed'
              ? ' · frames failed'
              : ''
      return {
        title: `Hole ${holeNumber ?? '?'}`,
        subtitle: uploaded ? `Video uploaded${frameLabel}` : 'No video yet',
      }
    },
  },
})
