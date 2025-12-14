"use client";

const GOOGLE_FONTS_STYLESHEET_ID = "lumi-editor-google-fonts";

export const DEFAULT_FONT = "Inter";

export const FONT_WEIGHTS = ["300", "400", "500", "600", "700", "800"] as const;

export const FONT_FAMILIES = [
  "Inter",
  "Roboto",
  "Open Sans",
  "Lato",
  "Montserrat",
  "Poppins",
  "Raleway",
  "Nunito",
  "Work Sans",
  "Source Sans 3",
  "Fira Sans",
  "Merriweather",
  "Playfair Display",
  "Oswald",
  "Bebas Neue",
  "Abril Fatface",
  "Anton",
  "Pacifico",
  "Caveat",
  "DM Sans",
  "Quicksand",
  "Rubik",
] as const;

const buildGoogleFontsUrl = (families: readonly string[]) => {
  const weights = FONT_WEIGHTS.join(";");
  const params = families
    .map((family) => {
      const encoded = encodeURIComponent(family).replaceAll("%20", "+");
      return `family=${encoded}:wght@${weights}`;
    })
    .join("&");

  return `https://fonts.googleapis.com/css2?${params}&display=swap`;
};

export const ensureGoogleFontsStylesheet = (): void => {
  if (typeof document === "undefined") return;

  const existing = document.querySelector(`#${GOOGLE_FONTS_STYLESHEET_ID}`);
  if (existing) return;

  const link = document.createElement("link");
  link.id = GOOGLE_FONTS_STYLESHEET_ID;
  link.rel = "stylesheet";
  link.href = buildGoogleFontsUrl(FONT_FAMILIES);
  document.head.append(link);
};
