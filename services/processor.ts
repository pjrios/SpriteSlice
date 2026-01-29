import { Rect, AppSettings, FrameData } from '../types';

// Convert Hex to RGB
export const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
};

// Calculate grid rects based on image size and settings
export const calculateGridRects = (
  imgWidth: number,
  imgHeight: number,
  grid: AppSettings['grid']
): Rect[] => {
  const rects: Rect[] = [];
  const { width, height, marginX, marginY, spacingX, spacingY } = grid;
  
  if (width <= 0 || height <= 0) return [];

  let x = marginX;
  let y = marginY;
  let idCounter = 0;

  while (y + height <= imgHeight) {
    while (x + width <= imgWidth) {
      rects.push({
        id: `grid-${idCounter++}`,
        x,
        y,
        w: width,
        h: height
      });
      x += width + spacingX;
    }
    x = marginX;
    y += height + spacingY;
  }
  return rects;
};

// Helper: Detect distinct islands of non-transparent pixels
export const detectIslands = (
  imageData: ImageData, 
  minWidth: number = 2, 
  minHeight: number = 2
): Rect[] => {
  const { width, height, data } = imageData;
  const visited = new Uint8Array(width * height); // 0 = unvisited, 1 = visited
  const rects: Rect[] = [];
  let idCounter = 0;

  // Helper to check if pixel is transparent (Alpha == 0)
  const isTransparent = (idx: number) => data[idx * 4 + 3] === 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      
      if (visited[idx] || isTransparent(idx)) continue;

      // Start new island flood fill
      let minX = x, maxX = x, minY = y, maxY = y;
      const stack = [idx];
      visited[idx] = 1;

      while (stack.length > 0) {
        const curr = stack.pop()!;
        const cy = Math.floor(curr / width);
        const cx = curr % width;

        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;

        // Check 4 neighbors
        const neighbors = [
          curr - width, // up
          curr + width, // down
          (cx > 0) ? curr - 1 : -1, // left
          (cx < width - 1) ? curr + 1 : -1 // right
        ];

        for (const n of neighbors) {
          if (n >= 0 && n < visited.length && !visited[n] && !isTransparent(n)) {
            visited[n] = 1;
            stack.push(n);
          }
        }
      }

      const w = maxX - minX + 1;
      const h = maxY - minY + 1;

      // Filter by min size
      if (w >= minWidth && h >= minHeight) {
        rects.push({
          id: `island-${idCounter++}`,
          x: minX,
          y: minY,
          w,
          h
        });
      }
    }
  }
  return rects;
};

// Helper: Scan alpha to find bounding box
const getTrimmedBounds = (imageData: ImageData) => {
  const { data, width, height } = imageData;
  let minX = width, minY = height, maxX = -1, maxY = -1;
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha > 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX === -1) return null; // Empty frame
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
};

// Helper: Apply color key removal
export const applyColorKeyToImageData = (
  imageData: ImageData,
  targetColor: { r: number; g: number; b: number },
  tolerance: number,
  feather: number
) => {
  const { data } = imageData;
  const tol = Math.max(0, tolerance);
  const featherPx = Math.max(0, feather);
  const tolSq = tol * tol;
  const featherSq = (tol + featherPx) * (tol + featherPx);

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i+1];
    const b = data[i+2];
    
    // Simple Euclidean distance squared
    const distSq = Math.pow(r - targetColor.r, 2) + 
                   Math.pow(g - targetColor.g, 2) + 
                   Math.pow(b - targetColor.b, 2);

    if (distSq <= tolSq) {
      data[i+3] = 0; // Set alpha to 0
    } else if (featherPx > 0 && distSq <= featherSq) {
      const dist = Math.sqrt(distSq);
      const t = (dist - tol) / featherPx; // 0..1
      data[i+3] = Math.round(data[i+3] * t);
    }
  }
};

export const applyColorKeysToImageData = (
  imageData: ImageData,
  targetColors: { r: number; g: number; b: number }[],
  tolerance: number,
  feather: number
) => {
  if (targetColors.length === 0) return;
  for (const color of targetColors) {
    applyColorKeyToImageData(imageData, color, tolerance, feather);
  }
};

export const extractFrame = async (
  sourceImage: HTMLImageElement,
  rect: Rect,
  settings: AppSettings
): Promise<FrameData | null> => {
  const canvas = document.createElement('canvas');
  canvas.width = rect.w;
  canvas.height = rect.h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // 1. Draw initial slice
  ctx.drawImage(sourceImage, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);
  
  let imageData = ctx.getImageData(0, 0, rect.w, rect.h);

  // 2. Color Key
  if (settings.processing.colorKeyEnabled) {
    const rgbs = settings.processing.colorKeyColors
      .map(hexToRgb)
      .filter((c): c is { r: number; g: number; b: number } => !!c);
    if (rgbs.length > 0) {
      applyColorKeysToImageData(
        imageData,
        rgbs,
        settings.processing.colorKeyTolerance,
        settings.processing.colorKeyFeather
      );
      ctx.putImageData(imageData, 0, 0);
    }
  }

  // 3. Scan for content
  // We check bounds even if autoTrim is off to filter out completely empty frames
  const bounds = getTrimmedBounds(imageData);
  
  // If bounds is null, the frame is completely empty/transparent.
  // We return null to exclude it from the final list.
  if (!bounds) {
    return null; 
  }

  // 4. Auto Trim
  let finalRect = { x: 0, y: 0, w: rect.w, h: rect.h };
  let trimOffset = { x: 0, y: 0 };
  let trimmedSize = { w: rect.w, h: rect.h };

  if (settings.processing.autoTrim) {
    // We already have bounds from step 3
    
    // Create new smaller canvas for trimmed result
    const trimmedCanvas = document.createElement('canvas');
    trimmedCanvas.width = bounds.w;
    trimmedCanvas.height = bounds.h;
    const tCtx = trimmedCanvas.getContext('2d');
    if (!tCtx) return null;

    // Draw the cropped region onto the new canvas
    tCtx.putImageData(imageData, -bounds.x, -bounds.y);
    
    trimOffset = { x: bounds.x, y: bounds.y };
    trimmedSize = { w: bounds.w, h: bounds.h };
    finalRect = bounds;

    const blob = await new Promise<Blob | null>(r => trimmedCanvas.toBlob(r, 'image/png'));
    if (!blob) return null;
    
    return {
      id: rect.id,
      blob,
      url: URL.createObjectURL(blob),
      rect: rect,
      trimOffset,
      trimmedSize,
      originalSize: { w: rect.w, h: rect.h }
    };
  }

  // No trim, return original full-size frame
  const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/png'));
  if (!blob) return null;

  return {
    id: rect.id,
    blob,
    url: URL.createObjectURL(blob),
    rect: rect,
    trimOffset: { x: 0, y: 0 },
    trimmedSize: { w: rect.w, h: rect.h },
    originalSize: { w: rect.w, h: rect.h }
  };
};
