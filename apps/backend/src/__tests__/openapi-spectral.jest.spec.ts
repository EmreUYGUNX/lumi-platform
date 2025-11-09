import { describe, expect, it } from "@jest/globals";
import { type RulesetDefinition, Spectral } from "@stoplight/spectral-core";
import { oas } from "@stoplight/spectral-rulesets";

import { getCoreApiOpenApiDocument } from "@lumi/shared";

describe("OpenAPI spectral validation", () => {
  it("produces no Spectral errors or warnings", async () => {
    const spectral = new Spectral();
    spectral.setRuleset(oas as RulesetDefinition);

    const document = getCoreApiOpenApiDocument();
    const results = await spectral.run(document, { ignoreUnknownFormat: true });
    const actionable = results.filter((result) => result.severity === 0);

    expect(actionable).toEqual([]);
  });
});
