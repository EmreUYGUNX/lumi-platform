/* istanbul ignore file */
import type { ImageLoader } from "next/image";

import { cloudinaryLoader } from "./cloudinary";

export const createImageLoader = (loader: ImageLoader = cloudinaryLoader): ImageLoader => loader;

export const cloudinaryImageLoader = createImageLoader();
