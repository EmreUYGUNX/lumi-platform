import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const milestones = [
  {
    title: "Phase 0-3",
    description: "Built the secure foundation: infra, API, database, and RBAC.",
  },
  {
    title: "Phase 4-5",
    description: "Shipped core commerce APIs + Cloudinary-powered media system.",
  },
  {
    title: "Phase 6",
    description: "Next.js experience system with route groups and experiential UX.",
  },
];

export default function AboutPage(): JSX.Element {
  return (
    <div className="container space-y-10 py-12">
      <div className="space-y-3">
        <p className="text-lumi-text-secondary text-sm uppercase tracking-[0.3em]">About</p>
        <h1 className="text-4xl font-semibold">Operating system for modern commerce.</h1>
        <p className="text-lumi-text-secondary">
          Lumi started as an internal toolkit used to orchestrate global product launches. We are
          now productizing the playbook as a multi-phase platform that merges infrastructure rigor
          with deneme.html craft.
        </p>
      </div>
      <Separator className="bg-lumi-border/70" />

      <div className="grid gap-6 md:grid-cols-3">
        {milestones.map((milestone) => (
          <Card key={milestone.title} className="border-lumi-border/70">
            <CardHeader>
              <CardTitle>{milestone.title}</CardTitle>
              <CardDescription>{milestone.description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card className="border-lumi-border/70">
        <CardHeader>
          <CardTitle>Principles</CardTitle>
          <CardDescription>
            Secure by default. Observable by design. Experiential everywhere.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div>
            <p className="text-sm font-semibold">Defense in depth</p>
            <p className="text-lumi-text-secondary text-sm">
              Each route group inherits middleware, logging, and policy enforcement.
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold">Composability</p>
            <p className="text-lumi-text-secondary text-sm">
              UI primitives are themed via tokens, so every surface reflects deneme.html identity.
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold">Velocity</p>
            <p className="text-lumi-text-secondary text-sm">
              Route groups map directly to teams, reducing merge conflicts and deployment risk.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
