import type { Transition, Variants } from "framer-motion";

const baseTransition: Transition = {
  duration: 0.4,
  ease: [0.4, 0, 0.2, 1],
};

export const fadeVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: baseTransition },
  exit: { opacity: 0, transition: { ...baseTransition, duration: 0.25 } },
};

type SlideDirection = "up" | "down" | "left" | "right";

const getSlideOffset = (direction: SlideDirection): { x?: number; y?: number } => {
  if (direction === "down") {
    return { y: -16 };
  }

  if (direction === "left") {
    return { x: 24 };
  }

  if (direction === "right") {
    return { x: -24 };
  }

  return { y: 16 };
};

export const slideVariants = (direction: SlideDirection = "up"): Variants => ({
  initial: { opacity: 0, ...getSlideOffset(direction) },
  animate: { opacity: 1, x: 0, y: 0, transition: { ...baseTransition } },
  exit: {
    opacity: 0,
    ...getSlideOffset(direction),
    transition: { ...baseTransition, duration: 0.25 },
  },
});

export const scaleVariants: Variants = {
  initial: { opacity: 0, scale: 0.96 },
  animate: {
    opacity: 1,
    scale: 1,
    transition: { ...baseTransition, type: "spring", stiffness: 320, damping: 32 },
  },
  exit: { opacity: 0, scale: 0.96, transition: { ...baseTransition, duration: 0.2 } },
};

export const staggerContainer: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.12,
    },
  },
};

export const pageTransitionVariants: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { ...baseTransition, duration: 0.45 },
  },
  exit: {
    opacity: 0,
    y: -10,
    transition: { ...baseTransition, duration: 0.25 },
  },
};
