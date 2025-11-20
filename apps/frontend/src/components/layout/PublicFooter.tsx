import Link from "next/link";

interface FooterLink {
  label: string;
  href: string;
}

interface FooterSection {
  heading: string;
  items: FooterLink[];
}

const footerLinks: FooterSection[] = [
  {
    heading: "Platform",
    items: [
      { label: "Experience", href: "/" },
      { label: "Dashboard", href: "/dashboard" },
      { label: "Admin console", href: "/admin" },
    ],
  },
  {
    heading: "Company",
    items: [
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
      { label: "Terms", href: "/terms" },
    ],
  },
  {
    heading: "Support",
    items: [
      { label: "Login", href: "/login" },
      { label: "Register", href: "/register" },
      { label: "Forgot password", href: "/forgot-password" },
    ],
  },
];

export function PublicFooter(): JSX.Element {
  return (
    <footer className="border-lumi-border/60 bg-lumi-bg border-t">
      <div className="container grid gap-10 py-12 md:grid-cols-4">
        <div className="space-y-4">
          <p className="gradient-text text-lg font-semibold">Lumi Commerce</p>
          <p className="text-lumi-text-secondary text-sm">
            Enterprise-ready commerce operating system designed for rapid experimentation and
            measurable growth.
          </p>
        </div>

        {footerLinks.map((section) => (
          <div key={section.heading} className="space-y-3">
            <p className="text-lumi-text-secondary text-sm font-semibold uppercase tracking-[0.2em]">
              {section.heading}
            </p>
            <ul className="space-y-2 text-sm">
              {section.items.map((item) => (
                <li key={item.label}>
                  <Link
                    href={{ pathname: item.href }}
                    className="text-lumi-text-secondary hover:text-lumi-primary transition"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-lumi-border/60 text-lumi-text-secondary border-t py-4 text-center text-xs">
        © {new Date().getFullYear()} Lumi Commerce. All rights reserved.
      </div>
    </footer>
  );
}
