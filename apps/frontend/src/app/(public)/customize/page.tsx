import { CustomizationEditor } from "@/features/customization/components/editor/CustomizationEditor";
import { generateMetadata } from "@/lib/seo/metadata";

const title = "Customization Editor Preview | Lumi";
const description =
  "Preview the Lumi product customization editor (canvas toolbar, text tool, upload tool, design library, layers, undo/redo).";

export const metadata = generateMetadata({
  title,
  description,
  path: "/customize",
  twitterCard: "summary",
  robots: {
    index: false,
    follow: false,
  },
});

const demoProductSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="960" height="960" viewBox="0 0 960 960">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0b1220" />
      <stop offset="100%" stop-color="#0f172a" />
    </linearGradient>
    <linearGradient id="shirt" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#f8fafc" />
      <stop offset="100%" stop-color="#e2e8f0" />
    </linearGradient>
    <filter id="shadow" x="-25%" y="-25%" width="150%" height="150%">
      <feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="#000000" flood-opacity="0.35" />
    </filter>
  </defs>

  <rect width="960" height="960" fill="url(#bg)" />

  <g opacity="0.2">
    <circle cx="180" cy="220" r="140" fill="#60a5fa" />
    <circle cx="860" cy="140" r="180" fill="#22c55e" />
    <circle cx="840" cy="860" r="220" fill="#f97316" />
  </g>

  <g filter="url(#shadow)">
    <path
      d="M240 210c40-52 86-78 138-78h204c52 0 98 26 138 78l94 74-82 154-78-40v350c0 68-56 124-124 124H372c-68 0-124-56-124-124V398l-78 40-82-154 94-74z"
      fill="url(#shirt)"
      stroke="#94a3b8"
      stroke-opacity="0.35"
      stroke-width="4"
      stroke-linejoin="round"
    />
    <path
      d="M382 132c18 58 55 86 98 86s80-28 98-86"
      fill="none"
      stroke="#64748b"
      stroke-opacity="0.5"
      stroke-width="10"
      stroke-linecap="round"
    />
  </g>

  <rect
    x="320"
    y="360"
    width="320"
    height="420"
    rx="28"
    fill="#3b82f6"
    fill-opacity="0.09"
    stroke="#60a5fa"
    stroke-opacity="0.65"
    stroke-width="4"
    stroke-dasharray="16 12"
  />

  <text
    x="480"
    y="566"
    text-anchor="middle"
    fill="#0b1220"
    fill-opacity="0.62"
    font-family="Inter, system-ui, -apple-system, Segoe UI, sans-serif"
    font-size="24"
    font-weight="700"
    letter-spacing="0.18em"
  >
    DESIGN AREA
  </text>
</svg>
`.trim();

const productImageUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(demoProductSvg)}`;

const designArea = {
  name: "Demo",
  x: 0,
  y: 0,
  width: 960,
  height: 960,
  rotation: 0,
  minDesignSize: 48,
  maxDesignSize: 960,
  allowResize: true,
  allowRotation: true,
};

export default function CustomizationPreviewPage(): JSX.Element {
  return (
    <section className="container space-y-6 pb-24 pt-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold md:text-3xl">Customization Editor (Preview)</h1>
        <p className="text-lumi-text-secondary text-sm">
          Upload + “My Designs” require an authenticated session (use <a href="/login">/login</a>).
        </p>
      </header>

      <div className="h-[calc(100vh-18rem)] min-h-[720px]">
        <CustomizationEditor
          productImageUrl={productImageUrl}
          designArea={designArea}
          className="h-full"
        />
      </div>
    </section>
  );
}
