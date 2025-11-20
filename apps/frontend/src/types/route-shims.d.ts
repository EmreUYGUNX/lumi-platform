/* eslint-disable @typescript-eslint/no-explicit-any */
// Shim for Next typed-routes generated files that import page/layout modules with .js extensions.
declare module "*page.js" {
  const Page: any;
  export default Page;
  export const metadata: any;
  export const generateMetadata: any;
  export const generateStaticParams: any;
}

declare module "*layout.js" {
  const Layout: any;
  export default Layout;
  export const metadata: any;
}
