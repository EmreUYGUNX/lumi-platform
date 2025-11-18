const highlights = [
  {
    title: "Composable storefronts",
    description:
      "Route groups keep public, auth, dashboard, and admin flows isolated yet cohesive.",
  },
  {
    title: "Enterprise foundations",
    description:
      "Strict typing, RBAC-ready layouts, and Cloudinary-first media pipelines come baked in.",
  },
  {
    title: "Experiential UI",
    description: "Tailwind tokens, shadcn/ui, Framer Motion, and GSAP deliver deneme.html polish.",
  },
];

export default function HomePage(): JSX.Element {
  return (
    <main className="bg-lumi-background">
      <section className="relative overflow-hidden">
        <div className="bg-gradient-lumi-soft absolute inset-x-0 top-0 h-72" aria-hidden />
        <div className="container relative flex flex-col gap-12 py-24 sm:py-32">
          <div className="max-w-3xl space-y-6">
            <p className="text-lumi-text-secondary text-sm uppercase tracking-[0.3em]">Phase 6</p>
            <h1 className="gradient-text text-lumi-text text-4xl font-semibold leading-tight sm:text-5xl">
              Next.js foundation for Lumi's immersive commerce experience
            </h1>
            <p className="text-lumi-text-secondary text-lg">
              App Router architecture, design tokens, and enterprise-grade tooling converge to
              deliver a seamless customer, merchant, and admin journey across every surface area.
            </p>
            <div className="flex flex-wrap gap-4">
              <button
                type="button"
                className="bg-gradient-lumi text-lumi-background shadow-glow duration-fast inline-flex items-center rounded-full px-6 py-3 text-base font-semibold transition-all hover:translate-y-[-2px]"
              >
                Explore architecture
              </button>
              <button
                type="button"
                className="glass-panel text-lumi-text inline-flex items-center rounded-full px-6 py-3 text-base font-semibold"
              >
                Review design tokens
              </button>
            </div>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {highlights.map((highlight) => (
              <article key={highlight.title} className="glass-panel p-6">
                <div className="bg-lumi-primary/10 text-lumi-primary mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl">
                  <span className="text-lg font-semibold">{highlight.title.slice(0, 1)}</span>
                </div>
                <h2 className="text-lumi-text mb-2 text-xl font-semibold">{highlight.title}</h2>
                <p className="text-lumi-text-secondary text-sm">{highlight.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
