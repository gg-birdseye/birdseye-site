import { defineField, defineType } from "sanity";

/**
 * Singleton document (_id: siteSettings) — one row in Studio: "Homepage hero".
 * Stores the marketing landing hero video (Mux); courses stay separate.
 */
export default defineType({
  name: "siteSettings",
  title: "Site settings",
  type: "document",
  fields: [
    defineField({
      name: "homeHeroVideo",
      title: "Homepage hero video",
      description:
        "Mux video behind the headline on the marketing homepage (/). If empty, the site uses the most recently updated course video, then a built-in demo clip.",
      type: "mux.video",
    }),
    defineField({
      name: "note",
      title: "Internal note",
      type: "string",
      description: "Optional — not shown on the website.",
    }),
  ],
  preview: {
    prepare() {
      return { title: "Homepage hero" };
    },
  },
});
