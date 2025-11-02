import { getEmailTemplate, listEmailTemplates, renderEmailTemplate } from "../index.js";

const baseContext = {
  brand: {
    productName: "Lumi Commerce",
    supportEmail: "support@example.com",
    supportUrl: "https://support.example.com",
  },
  baseUrl: "https://example.com",
  locale: "en-US",
};

describe("email template registry", () => {
  it("lists all registered template identifiers", () => {
    const templates = listEmailTemplates();
    expect(Array.isArray(templates)).toBe(true);
    expect(templates).toContain("auth.welcome");
    expect(templates).toContain("auth.password-reset");
  });

  it("returns template definitions by identifier", () => {
    const template = getEmailTemplate("auth.welcome");
    expect(template.id).toBe("auth.welcome");
    expect(typeof template.render).toBe("function");
  });

  it("renders templates and annotates the template id", () => {
    const content = renderEmailTemplate(
      "auth.welcome",
      {
        firstName: "Ayla",
        verificationUrl: "https://example.com/verify",
      },
      baseContext,
    );

    expect(content.templateId).toBe("auth.welcome");
    expect(content.subject).toContain("Lumi Commerce");
    expect(content.html).toContain("verify");
    expect(content.text).toContain("verify");
  });

  it("throws when rendering an unknown template", () => {
    expect(() =>
      // @ts-expect-error - deliberate invalid template
      getEmailTemplate("auth.unknown"),
    ).toThrowError("Email template 'auth.unknown' is not registered.");
  });
});
