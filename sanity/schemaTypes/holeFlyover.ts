import { defineField, defineType } from 'sanity'
import { CameraPathEditor } from '../components/CameraPathEditor'
import { LandingZoneEditor } from '../components/LandingZoneEditor'

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
      name: 'landingZone',
      title: 'Landing zone ruler',
      type: 'object',
      description:
        'Green center, tee points, fairway distance markers (yards from green + furthest tee), and optional green edge markers (L/R/F/B) for width/depth.',
      fields: [
        defineField({
          name: 'green',
          title: 'Green center',
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
          name: 'tees',
          title: 'Tee points',
          type: 'array',
          of: [
            {
              type: 'object',
              name: 'landingZoneTee',
              fields: [
                defineField({
                  name: 'teeIndex',
                  title: 'Tee index',
                  type: 'number',
                  description: '0 = first scorecard tee, 1 = second, …',
                  validation: (Rule) => Rule.required().integer().min(0),
                }),
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
              preview: {
                select: { teeIndex: 'teeIndex', x: 'x', y: 'y' },
                prepare: ({ teeIndex, x, y }) => ({
                  title: `Tee ${typeof teeIndex === 'number' ? teeIndex + 1 : '?'}`,
                  subtitle:
                    Number.isFinite(x) && Number.isFinite(y)
                      ? `${x}%, ${y}%`
                      : 'Unset',
                }),
              },
            },
          ],
        }),
        defineField({
          name: 'markers',
          title: 'Distance markers',
          description:
            'Click a fairway point and enter yards from the green and from the furthest-back tee. Place several along the hole — especially where the aerial is skewed.',
          type: 'array',
          of: [
            {
              type: 'object',
              name: 'landingZoneMarker',
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
                defineField({
                  name: 'yards',
                  title: 'Yards from green',
                  type: 'number',
                  validation: (Rule) => Rule.required().positive(),
                }),
                defineField({
                  name: 'yardsFromTee',
                  title: 'Yards from furthest tee',
                  description:
                    'Distance from the furthest-back tee to this point (along the hole or as you measure it). Used for the tee→landing ruler leg.',
                  type: 'number',
                  validation: (Rule) => Rule.min(0),
                }),
              ],
              preview: {
                select: { yards: 'yards', yardsFromTee: 'yardsFromTee', x: 'x', y: 'y' },
                prepare: ({ yards, yardsFromTee, x, y }) => ({
                  title: Number.isFinite(yards)
                    ? Number.isFinite(yardsFromTee)
                      ? `${yards} yd green · ${yardsFromTee} yd tee`
                      : `${yards} yd from green`
                    : 'Marker',
                  subtitle:
                    Number.isFinite(x) && Number.isFinite(y)
                      ? `${x}%, ${y}%`
                      : 'Unset',
                }),
              },
            },
          ],
        }),
        defineField({
          name: 'greenEdges',
          title: 'Green edges',
          description:
            'Left, right, front, and back of the green with yards to center. Improves near-green distances and shows green width × depth to players.',
          type: 'array',
          of: [
            {
              type: 'object',
              name: 'landingZoneGreenEdge',
              fields: [
                defineField({
                  name: 'side',
                  title: 'Side',
                  type: 'string',
                  options: {
                    list: [
                      { title: 'Front', value: 'front' },
                      { title: 'Back', value: 'back' },
                      { title: 'Left', value: 'left' },
                      { title: 'Right', value: 'right' },
                    ],
                    layout: 'radio',
                  },
                  validation: (Rule) => Rule.required(),
                }),
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
                defineField({
                  name: 'yards',
                  title: 'Yards from green center',
                  type: 'number',
                  validation: (Rule) => Rule.required().positive(),
                }),
              ],
              preview: {
                select: { side: 'side', yards: 'yards', x: 'x', y: 'y' },
                prepare: ({ side, yards, x, y }) => ({
                  title: Number.isFinite(yards)
                    ? `${String(side ?? 'edge')} · ${yards} yd`
                    : String(side ?? 'Green edge'),
                  subtitle:
                    Number.isFinite(x) && Number.isFinite(y)
                      ? `${x}%, ${y}%`
                      : 'Unset',
                }),
              },
            },
          ],
        }),
      ],
      components: {
        input: LandingZoneEditor,
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
