/* eslint-disable import/no-default-export, no-restricted-exports */

const noop = (): void => {};

const timeline = () => ({
  fromTo: noop,
  to: noop,
  set: noop,
});

const gsap = {
  timeline,
  fromTo: noop,
  to: noop,
  context: (_cb: () => void, _scope?: unknown) => ({
    revert: noop,
  }),
  registerPlugin: noop,
};

const ScrollTrigger = {
  create: noop,
  refresh: noop,
};

export { gsap as default, ScrollTrigger };
