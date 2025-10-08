import type { PropsWithChildren, ReactElement } from "react";

export type TextProps = PropsWithChildren<{
  as?: keyof JSX.IntrinsicElements;
}>;

export function Text({ as: Component = "span", children }: TextProps): ReactElement {
  const variant = Component === "span" ? "body" : "custom";

  return <Component data-variant={variant}>{children}</Component>;
}
