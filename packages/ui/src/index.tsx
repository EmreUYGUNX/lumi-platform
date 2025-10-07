import type { PropsWithChildren, ReactElement } from "react";

export type TextProps = PropsWithChildren<{
  as?: keyof JSX.IntrinsicElements;
}>;

export function Text({ as: Component = "span", children }: TextProps): ReactElement {
  return <Component>{children}</Component>;
}
