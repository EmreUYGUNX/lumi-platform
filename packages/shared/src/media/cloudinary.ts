import breakpoints from "../../media/cloudinary-breakpoints.json";

export const CLOUDINARY_BREAKPOINTS = Object.freeze(
  [...breakpoints].map((value) => Math.max(1, Number(value))),
);

export const getCloudinaryBreakpoints = (): readonly number[] => [...CLOUDINARY_BREAKPOINTS];
