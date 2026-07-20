import { HomeIcon } from "@sanity/icons";
import type { StructureResolver } from "sanity/structure";

/** Singleton id — must match documentId in the list item below */
export const SITE_SETTINGS_ID = "siteSettings";

export const structure: StructureResolver = (S) =>
  S.list()
    .title("Content")
    .items([
      S.listItem()
        .title("Homepage hero")
        .icon(HomeIcon)
        .id(SITE_SETTINGS_ID)
        .child(
          S.document()
            .schemaType("siteSettings")
            .documentId(SITE_SETTINGS_ID)
            .title("Homepage hero"),
        ),
      S.divider(),
      ...S.documentTypeListItems().filter(
        (item) => item.getId() !== "siteSettings",
      ),
    ]);
