import { defineField, defineType } from 'sanity'
import { AerialHotspotEditor } from '../components/AerialHotspotEditor'
import { CourseSelectionsInput } from '../components/CourseSelectionsInput'
import { CourseSeoInput } from '../components/CourseSeoInput'
import { CourseTypeInput } from '../components/CourseTypeInput'
import { HoleFlyoversInput } from '../components/HoleFlyoversInput'
import { ScorecardEditor } from '../components/ScorecardEditor'
import { COURSE_TYPE_PRESETS, type HoleCount } from '../lib/courseTypePresets'

export { COURSE_TYPE_PRESETS, type HoleCount }

export const HOLE_COUNT_OPTIONS = COURSE_TYPE_PRESETS

export const COURSE_COUNT_OPTIONS = [2, 3, 4, 5, 6, 7, 8] as const

type CourseFormDocument = {
  holeCount?: number
  pagePanels?: {
    aerial?: boolean
    courses?: boolean
    bookTeeTime?: boolean
    courseCount?: number
    courseSelections?: unknown[]
  }
}

export default defineType({
  name: 'course',
  title: 'Golf Course',
  type: 'document',
  groups: [
    { name: 'details', title: 'Course Details', default: true },
    { name: 'seo', title: 'SEO' },
    { name: 'scorecard', title: 'Scorecard' },
    { name: 'flyovers', title: 'Hole Flyovers' },
  ],
  fields: [
    defineField({
      name: 'title',
      title: 'Course Name',
      type: 'string',
      group: 'details',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      group: 'details',
      options: {
        source: 'title',
        maxLength: 96,
      },
      description:
        'Public URL path (birdseye.golf/{slug}). Avoid reserved paths like admin, api, courses, pricing.',
      validation: (Rule) =>
        Rule.required().custom((value) => {
          const current =
            typeof value === 'string'
              ? value
              : value && typeof value === 'object' && 'current' in value
                ? String((value as { current?: string }).current ?? '')
                : '';
          const slug = current.trim().toLowerCase();
          const reserved = new Set([
            'admin',
            'api',
            'courses',
            'onboarding',
            'pricing',
            'refer',
            'studio',
          ]);
          if (reserved.has(slug)) {
            return `“${slug}” is reserved. Choose a different course slug.`;
          }
          return true;
        }),
    }),
    defineField({
      name: 'holeCount',
      title: 'Course Type',
      type: 'number',
      group: 'details',
      description:
        'How many holes does this course have? This controls flyover slots and the scorecard grid.',
      components: {
        input: CourseTypeInput,
      },
      initialValue: 18,
      validation: (Rule) => Rule.required().integer().min(1).max(72),
    }),
    defineField({
      name: 'clientId',
      title: 'Birdseye client ID',
      type: 'string',
      group: 'details',
      description:
        'Links this course to a paying client record for billing access control.',
      readOnly: true,
    }),
    defineField({
      name: 'courseLogo',
      title: 'Course Logo',
      type: 'image',
      group: 'details',
      description:
        'Square logo shown on the video player (bottom-left) on every hole page. White artwork on a transparent background works best. When Website URL is set, tapping the logo opens that site.',
      options: {
        accept: 'image/svg+xml,image/png,image/webp',
      },
      fields: [
        defineField({
          name: 'alt',
          title: 'Alt text',
          type: 'string',
          description: 'Accessibility label — usually the course name.',
        }),
      ],
    }),
    defineField({
      name: 'websiteUrl',
      title: 'Website URL',
      type: 'url',
      group: 'details',
      description:
        'Optional. Official course website. When set, the course logo on the player links here (opens in a new tab).',
      validation: (Rule) =>
        Rule.uri({ scheme: ['http', 'https'] }).error(
          'Enter a full URL starting with https://',
        ),
    }),
    defineField({
      name: 'address',
      title: 'Course Address',
      type: 'object',
      group: 'details',
      description:
        'Shown in the video menu. Tapping the address opens Apple Maps or Google Maps.',
      fields: [
        defineField({
          name: 'line1',
          title: 'Street address',
          type: 'string',
        }),
        defineField({
          name: 'city',
          title: 'City',
          type: 'string',
        }),
        defineField({
          name: 'state',
          title: 'State',
          type: 'string',
        }),
        defineField({
          name: 'postalCode',
          title: 'ZIP / postal code',
          type: 'string',
        }),
      ],
    }),
    defineField({
      name: 'googleMapsUrl',
      title: 'Google Maps Link',
      type: 'url',
      group: 'details',
      description:
        "Optional. Paste the course's Google Maps share link (open the course in Google Maps → Share → Copy link). Used on non-Apple devices. When set, tapping the address in the video menu opens this exact listing instead of a plain address search.",
      validation: (Rule) =>
        Rule.uri({ scheme: ['http', 'https'] }).error(
          'Enter a full URL starting with https://',
        ),
    }),
    defineField({
      name: 'appleMapsUrl',
      title: 'Apple Maps Link',
      type: 'url',
      group: 'details',
      description:
        "Optional. Paste the course's Apple Maps share link (open the course in Apple Maps → Share → Copy Link). Used on iPhone/iPad. When set, iOS visitors who tap the address open this exact listing in Apple Maps.",
      validation: (Rule) =>
        Rule.uri({ scheme: ['http', 'https'] }).error(
          'Enter a full URL starting with https://',
        ),
    }),
    defineField({
      name: 'phone',
      title: 'Phone Number',
      type: 'string',
      group: 'details',
      description:
        'Shown in the video menu as a tap-to-call link (e.g. (555) 123-4567).',
    }),
    defineField({
      name: 'seo',
      title: 'Search Engine Optimization',
      type: 'object',
      group: 'seo',
      description:
        'Controls how this course appears in Google and social link previews. Fields autofill from the course name and location — edit to override.',
      components: {
        input: CourseSeoInput,
      },
      fields: [
        defineField({
          name: 'metaTitle',
          title: 'Meta title',
          type: 'string',
          description:
            'Browser tab / Google result title. Aim for ~50–60 characters.',
          validation: (Rule) =>
            Rule.max(70).warning('Keep meta titles under ~60 characters when possible.'),
        }),
        defineField({
          name: 'metaDescription',
          title: 'Meta description',
          type: 'text',
          rows: 3,
          description:
            'Short summary shown under the title in Google. Aim for ~140–160 characters.',
          validation: (Rule) =>
            Rule.max(180).warning(
              'Keep meta descriptions under ~160 characters when possible.',
            ),
        }),
        defineField({
          name: 'ogImage',
          title: 'Social / Open Graph image',
          type: 'image',
          description:
            'Optional. Overrides the default share image (hole poster or course logo). Recommended ~1200×630.',
          options: {
            hotspot: true,
          },
          fields: [
            defineField({
              name: 'alt',
              title: 'Alt text',
              type: 'string',
            }),
          ],
        }),
      ],
    }),
    defineField({
      name: 'pagePanels',
      title: 'Course Page Buttons',
      type: 'object',
      group: 'details',
      description:
        'Choose which optional panels and buttons appear on the course preview page. Scorecard is always included.',
      options: {
        columns: 1,
      },
      fields: [
        defineField({
          name: 'scorecard',
          title: 'Scorecard (legacy)',
          type: 'boolean',
          hidden: true,
          readOnly: true,
          deprecated: {
            reason: 'Scorecard is always included on course pages now — safe to ignore.',
          },
        }),
        defineField({
          name: 'aerial',
          title: 'Aerial',
          type: 'boolean',
          initialValue: false,
          description: 'Aerial routing map panel.',
        }),
        defineField({
          name: 'courses',
          title: 'Course',
          type: 'boolean',
          initialValue: false,
          description: 'Related courses list panel.',
        }),
        defineField({
          name: 'bookTeeTime',
          title: 'Book Tee Time',
          type: 'boolean',
          initialValue: false,
          description:
            'Show a Book Tee Time button that links to your tee time booking page.',
        }),
        defineField({
          name: 'bookTeeTimeUrl',
          title: 'Booking URL',
          type: 'url',
          hidden: ({ parent }) => !parent?.bookTeeTime,
          description: 'Where the Book Tee Time button should link (e.g. your tee sheet or booking site).',
          validation: (Rule) =>
            Rule.custom((value, context) => {
              const parent = context.parent as { bookTeeTime?: boolean } | undefined
              if (!parent?.bookTeeTime) return true
              if (!value) return 'Required when Book Tee Time is enabled'
              return true
            }),
        }),
        defineField({
          name: 'courseCount',
          title: 'Number of Courses',
          type: 'number',
          options: {
            list: COURSE_COUNT_OPTIONS.map((value) => ({
              title: String(value),
              value,
            })),
            layout: 'dropdown',
          },
          initialValue: 2,
          hidden: ({ parent }) => !parent?.courses,
          validation: (Rule) =>
            Rule.custom((value, context) => {
              const parent = context.parent as { courses?: boolean } | undefined
              if (!parent?.courses) return true
              if (value == null) {
                return 'Required when Course panel is enabled'
              }
              const count = typeof value === 'number' ? value : Number(value)
              if (!Number.isInteger(count)) {
                return 'Select a number of courses between 2 and 8'
              }
              if (!COURSE_COUNT_OPTIONS.includes(count as (typeof COURSE_COUNT_OPTIONS)[number])) {
                return 'Select a number of courses between 2 and 8'
              }
              return true
            }),
        }),
        defineField({
          name: 'courseSelections',
          title: 'Courses',
          type: 'array',
          of: [{ type: 'relatedCourseSelection' }],
          hidden: ({ parent }) => !parent?.courses || !parent?.courseCount,
          components: {
            input: CourseSelectionsInput,
          },
          validation: (Rule) =>
            Rule.custom((items, context) => {
              const parent = context.parent as
                | { courses?: boolean; courseCount?: number }
                | undefined
              if (!parent?.courses) return true
              const count = parent.courseCount
              if (!count) return true
              if (!Array.isArray(items) || items.length !== count) return true
              const missing = (items as Array<{ course?: { _ref?: string } }>).some(
                (item) => !item?.course?._ref,
              )
              if (missing) {
                return 'Each course slot must have a course selected.'
              }
              return true
            }),
        }),
      ],
    }),
    defineField({
      name: 'aerialMap',
      title: 'Aerial Map',
      type: 'file',
      group: 'details',
      description:
        'Routing map or aerial graphic for the Aerial panel. SVG, PNG, WebP, or WebM.',
      hidden: ({ document }) => {
        const doc = document as CourseFormDocument | undefined
        return !doc?.pagePanels?.aerial
      },
      options: {
        accept: 'image/svg+xml,image/png,image/webp,video/webm,.svg,.png,.webp,.webm',
      },
      fields: [
        defineField({
          name: 'alt',
          title: 'Alt text',
          type: 'string',
          description: 'Accessibility label for the aerial map.',
        }),
      ],
    }),
    defineField({
      name: 'aerialHotspots',
      title: 'Aerial Map Hotspots',
      type: 'array',
      group: 'details',
      of: [{ type: 'aerialMapHotspot' }],
      description:
        'Click-to-place markers on the aerial map. Each hotspot jumps visitors to that hole flyover.',
      hidden: ({ document }) => {
        const doc = document as CourseFormDocument | undefined
        return !doc?.pagePanels?.aerial
      },
      components: {
        input: AerialHotspotEditor,
      },
    }),
    defineField({
      name: 'scorecard',
      title: 'Scorecard',
      type: 'scorecardConfig',
      group: 'scorecard',
      description:
        'Per-hole yardages and handicaps for each tee, shown in the Scorecard panel on the course page.',
      hidden: ({ document }) => {
        const doc = document as CourseFormDocument | undefined
        return !doc?.holeCount
      },
      components: {
        input: ScorecardEditor,
      },
      validation: (Rule) =>
        Rule.custom((scorecard, context) => {
          const count = (context.document as CourseFormDocument | undefined)?.holeCount
          if (!count) return true
          const holes = (scorecard as { holes?: unknown[] } | undefined)?.holes
          if (!Array.isArray(holes) || holes.length !== count) {
            return `Expected ${count} scorecard rows matching course type.`
          }
          const numbers = (holes as Array<{ holeNumber?: number }>)
            .map((entry) => entry?.holeNumber)
            .filter(Boolean)
          if (numbers.length !== count) {
            return 'Each scorecard row must have a hole number.'
          }
          return true
        }),
    }),
    defineField({
      name: 'scorecardHoles',
      title: 'Legacy scorecard data',
      type: 'array',
      group: 'scorecard',
      of: [{ type: 'holeScorecard' }],
      hidden: true,
      readOnly: true,
      deprecated: {
        reason: 'Replaced by the scorecard object above — kept for legacy documents.',
      },
    }),
    defineField({
      name: 'droneVideo',
      title: 'Legacy course video',
      type: 'mux.video',
      group: 'details',
      hidden: true,
      readOnly: true,
      deprecated: {
        reason: 'Replaced by per-hole flyovers. This field is kept only to clear legacy data — safe to ignore.',
      },
    }),
    defineField({
      name: 'holes',
      title: 'Hole Flyover Videos',
      type: 'array',
      group: 'flyovers',
      of: [{ type: 'holeFlyover' }],
      description:
        'Upload one flyover clip per hole, or use the bulk uploader above. Slots are created automatically when you pick a course type.',
      hidden: ({ document }) => !document?.holeCount,
      components: {
        input: HoleFlyoversInput,
      },
      validation: (Rule) =>
        Rule.custom((holes, context) => {
          const count = context.document?.holeCount as number | undefined
          if (!count) return true
          if (!Array.isArray(holes) || holes.length !== count) {
            return `Expected ${count} hole upload slots. Change course type or wait for slots to sync.`
          }
          const numbers = (holes as Array<{ holeNumber?: number }>).map(
            (h) => h?.holeNumber,
          ).filter(Boolean)
          if (numbers.length !== count) {
            return 'Each hole slot must have a hole number.'
          }
          return true
        }),
    }),
  ],
  preview: {
    select: {
      title: 'title',
      holeCount: 'holeCount',
      slug: 'slug.current',
      media: 'courseLogo',
    },
    prepare({ title, holeCount, slug }) {
      const holesLabel = holeCount ? `${holeCount} holes` : 'holes not set'
      return {
        title: title || 'Untitled course',
        subtitle: [holesLabel, slug ? `/${slug}` : null].filter(Boolean).join(' · '),
      }
    },
  },
})
