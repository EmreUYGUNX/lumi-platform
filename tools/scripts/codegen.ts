import { existsSync, readFileSync } from "node:fs";
import { appendFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  error,
  heading,
  info,
  parseFlags,
  repoRoot,
  success,
  toCamelCase,
  toKebabCase,
  toPascalCase,
} from "./utils";

const { dirname, resolve } = path;

interface NameVariants {
  raw: string;
  camelCaseName: string;
  pascalCaseName: string;
  kebabCaseName: string;
}

interface TemplateConfig {
  id: string;
  description: string;
  templatePath: string;
  defaultOutput: (names: NameVariants) => string;
  postProcess?: (names: NameVariants, outputPath: string) => Promise<void>;
}

const templates: TemplateConfig[] = [
  {
    id: "frontend-component",
    description: "React component scaffold under apps/frontend/src/components",
    templatePath: resolve(repoRoot, "tools/templates/frontend/component.tsx.tpl"),
    defaultOutput: (names) =>
      resolve(
        repoRoot,
        "apps/frontend/src/components",
        names.pascalCaseName,
        `${names.pascalCaseName}.tsx`,
      ),
    postProcess: async (names, outputPath) => {
      const indexPath = resolve(dirname(outputPath), "index.ts");
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      if (existsSync(indexPath)) {
        const exportLine = `export * from "./${names.pascalCaseName}";\n`;
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        const content = readFileSync(indexPath, "utf8");
        if (!content.includes(exportLine)) {
          // eslint-disable-next-line security/detect-non-literal-fs-filename
          await appendFile(indexPath, exportLine);
        }
      } else {
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        await writeFile(indexPath, `export * from "./${names.pascalCaseName}";\n`);
      }
    },
  },
  {
    id: "backend-route",
    description: "Express route module under apps/backend/src/routes",
    templatePath: resolve(repoRoot, "tools/templates/backend/route.ts.tpl"),
    defaultOutput: (names) =>
      resolve(repoRoot, "apps/backend/src/routes", `${names.kebabCaseName}.route.ts`),
  },
];

function resolveTemplate(id: string): TemplateConfig | undefined {
  return templates.find((template) => template.id === id);
}

function renderTemplate(template: TemplateConfig, variants: NameVariants): string {
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  const raw = readFileSync(template.templatePath, "utf8");
  return raw
    .replaceAll("{{rawName}}", variants.raw)
    .replaceAll("{{pascalCaseName}}", variants.pascalCaseName)
    .replaceAll("{{camelCaseName}}", variants.camelCaseName)
    .replaceAll("{{kebabCaseName}}", variants.kebabCaseName);
}

async function ensureDirectory(filePath: string): Promise<void> {
  const directory = dirname(filePath);
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  if (!existsSync(directory)) {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    await mkdir(directory, { recursive: true });
  }
}

async function main(): Promise<void> {
  const flags = parseFlags(process.argv.slice(2));
  const name = typeof flags.name === "string" ? flags.name : undefined;
  const type = typeof flags.type === "string" ? flags.type : "frontend-component";
  const destinationFlag = typeof flags.dest === "string" ? flags.dest : undefined;

  heading("Lumi Code Generator");

  if (!name) {
    info("Available templates:");
    templates.forEach((template) => info(` • ${template.id} – ${template.description}`));
    throw new Error(
      "Missing --name <ComponentName> argument. Example: pnpm run codegen -- --type frontend-component --name HeroBanner",
    );
  }

  const template = resolveTemplate(type);
  if (!template) {
    throw new Error(
      `Unknown template "${type}". Supported templates: ${templates.map((item) => item.id).join(", ")}`,
    );
  }

  const variants: NameVariants = {
    raw: name,
    pascalCaseName: toPascalCase(name),
    camelCaseName: toCamelCase(name),
    kebabCaseName: toKebabCase(name),
  };

  const outputPath = destinationFlag
    ? resolve(repoRoot, destinationFlag)
    : template.defaultOutput(variants);

  // eslint-disable-next-line security/detect-non-literal-fs-filename
  if (existsSync(outputPath) && !flags.force) {
    throw new Error(`Target file already exists at ${outputPath}. Use --force to overwrite.`);
  }

  info(`Using template: ${template.id}`);
  info(`Generating: ${outputPath}`);

  const content = renderTemplate(template, variants);
  await ensureDirectory(outputPath);
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  await writeFile(outputPath, content, "utf8");

  if (template.postProcess) {
    await template.postProcess(variants, outputPath);
  }

  success(`Scaffold generated successfully at ${outputPath}`);
}

try {
  await main();
} catch (error_) {
  error(`Code generation failed: ${(error_ as Error).stack ?? (error_ as Error).message}`);
  process.exitCode = 1;
}
