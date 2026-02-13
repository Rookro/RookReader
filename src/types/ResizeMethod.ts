/** Image Resize Methods */
export const resizeMethods = ["nearest", "triangle", "catmullRom", "gaussian", "lanczos3"] as const;

/** Image Resize Method */
export type ResizeMethod = (typeof resizeMethods)[number];
