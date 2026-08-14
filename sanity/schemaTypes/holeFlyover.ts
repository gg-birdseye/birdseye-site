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
        'Green center, tee points (one per scorecard tee), and known distances from the green (50, 100, 150…). Players tap/drag a target on Hole View to see tee→target and target→green yards.',
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
          title: 'Distances from green',
          description:
            'Click a point that is a known distance from the green center (e.g. 100 yd) and enter that yardage. Place several along the fairway — especially where the aerial is skewed.',
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
              ],
              preview: {
                select: { yards: 'yards', x: 'x', y: 'y' },
                prepare: ({ yards, x, y }) => ({
                  title: Number.isFinite(yards) ? `${yards} yd from green` : 'Marker',
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
