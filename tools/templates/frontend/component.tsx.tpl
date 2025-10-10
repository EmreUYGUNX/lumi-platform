import type { FC } from "react";

interface {{pascalCaseName}}Props {
  title?: string;
}

/**
 * {{pascalCaseName}} renders a standardised UI wrapper with optional title section.
 * Generated via Lumi codegen to keep components consistent.
 */
export const {{pascalCaseName}}: FC<{{pascalCaseName}}Props> = ({ title, children }) => {
  return (
    <section data-component="{{kebabCaseName}}">
      {title ? <header><h2>{title}</h2></header> : null}
      <div>{children}</div>
    </section>
  );
};

export default {{pascalCaseName}};
