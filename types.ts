export interface Rect {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FrameData {
  id: string;
  blob: Blob;
  url: string; // Object URL for display
  rect: Rect;
  trimOffset?: { x: number; y: number };
  trimmedSize?: { w: number; h: number };
  originalSize?: { w: number; h: number };
}

export interface AppSettings {
  mode: 'grid' | 'manual' | 'islands';
  grid: {
    width: number;
    height: number;
    marginX: number;
    marginY: number;
    spacingX: number;
    spacingY: number;
  };
  islands: {
    minWidth: number;
    minHeight: number;
  };
  processing: {
    autoTrim: boolean;
    colorKeyEnabled: boolean;
    colorKeyColors: string[]; // Hex list
    colorKeyTolerance: number; // 0-255
    colorKeyFeather: number; // 0-50
  };
  export: {
    fps: number;
    prefix: string;
  }
}

export interface ProjectState {
  imageBlob: Blob | null;
  settings: AppSettings;
  manualRects: Rect[];
}
