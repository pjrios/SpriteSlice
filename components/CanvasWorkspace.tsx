import React, { useRef, useEffect, useState } from 'react';
import { AppSettings, Rect } from '../types';
import { calculateGridRects } from '../services/processor';
import { Minus, Plus, Maximize } from 'lucide-react';

interface CanvasWorkspaceProps {
  image: HTMLImageElement | null;
  settings: AppSettings;
  manualRects: Rect[];
  islandRects: Rect[];
  hiddenRectIds: Set<string>;
  setManualRects: (rects: Rect[]) => void;
  setIslandRects: (rects: Rect[]) => void;
  selectedRectId: string | null;
  onSelectRect: (id: string | null) => void;
}

type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

const CanvasWorkspace: React.FC<CanvasWorkspaceProps> = ({
  image,
  settings,
  manualRects,
  islandRects,
  hiddenRectIds,
  setManualRects,
  setIslandRects,
  selectedRectId,
  onSelectRect
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Viewport State
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [cursor, setCursor] = useState('default');
  
  // Interaction State
  const [isDraggingPan, setIsDraggingPan] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isResizing, setIsResizing] = useState<ResizeHandle | null>(null);
  
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 }); // Screen coords
  const [drawStart, setDrawStart] = useState({ x: 0, y: 0 }); // Image coords
  
  const [currentDrawRect, setCurrentDrawRect] = useState<Rect | null>(null);
  const [initialResizeRect, setInitialResizeRect] = useState<Rect | null>(null);

  // Helper: Screen to Image coordinates
  const toImageCoords = (screenX: number, screenY: number) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: (screenX - rect.left - pan.x) / zoom,
      y: (screenY - rect.top - pan.y) / zoom
    };
  };

  const getActiveRects = () => {
    let activeRects: Rect[] = [];
    // 1. Get automated rects
    if (settings.mode === 'grid') {
      activeRects = image ? calculateGridRects(image.width, image.height, settings.grid) : [];
    } else if (settings.mode === 'islands') {
      activeRects = islandRects;
    }
    
    // 2. Always merge manual rects
    activeRects = [...activeRects, ...manualRects];

    // 3. Filter hidden
    return activeRects.filter(r => !hiddenRectIds.has(r.id));
  };

  const updateRect = (newRect: Rect) => {
    // Route update based on ID type
    if (newRect.id.startsWith('manual-')) {
       setManualRects(manualRects.map(r => r.id === newRect.id ? newRect : r));
    } else if (newRect.id.startsWith('island-')) {
       setIslandRects(islandRects.map(r => r.id === newRect.id ? newRect : r));
    }
    // Note: Grid rects are typically fixed, we skip updating them for now or it would require specific grid overrides
  };

  // Zoom handlers
  const handleZoomIn = () => setZoom(z => Math.min(10, z + 0.25));
  const handleZoomOut = () => setZoom(z => Math.max(0.1, z - 0.25));
  const handleFit = () => {
    if (!image || !containerRef.current) return;
    const container = containerRef.current;
    const scaleX = (container.clientWidth - 40) / image.width;
    const scaleY = (container.clientHeight - 40) / image.height;
    const newZoom = Math.min(scaleX, scaleY, 1);
    
    setZoom(newZoom);
    setPan({
      x: (container.clientWidth - image.width * newZoom) / 2,
      y: (container.clientHeight - image.height * newZoom) / 2
    });
  };

  // Keyboard listeners for Zoom
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      if (e.key === '=' || e.key === '+') handleZoomIn();
      else if (e.key === '-' || e.key === '_') handleZoomOut();
      else if (e.key === '0') {
        if (image) handleFit();
        else setZoom(1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [image]);

  // Handle Detection Logic
  const getHandleAtPosition = (mx: number, my: number, rect: Rect) => {
    // We check handles in screen space
    const handleSize = 8; // pixel size on screen
    const threshold = handleSize / 2 + 2;
    
    // Transform rect points to screen space
    const rx = rect.x * zoom + pan.x;
    const ry = rect.y * zoom + pan.y;
    const rw = rect.w * zoom;
    const rh = rect.h * zoom;

    const handles: { key: ResizeHandle, x: number, y: number }[] = [
      { key: 'nw', x: rx, y: ry },
      { key: 'n', x: rx + rw/2, y: ry },
      { key: 'ne', x: rx + rw, y: ry },
      { key: 'e', x: rx + rw, y: ry + rh/2 },
      { key: 'se', x: rx + rw, y: ry + rh },
      { key: 's', x: rx + rw/2, y: ry + rh },
      { key: 'sw', x: rx, y: ry + rh },
      { key: 'w', x: rx, y: ry + rh/2 },
    ];

    if (!containerRef.current) return null;
    const cBounds = containerRef.current.getBoundingClientRect();
    const cx = mx - cBounds.left;
    const cy = my - cBounds.top;

    for (const h of handles) {
      if (Math.abs(cx - h.x) <= threshold && Math.abs(cy - h.y) <= threshold) {
        return h.key;
      }
    }
    return null;
  };

  // 1. Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !containerRef.current) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = containerRef.current.clientWidth;
    canvas.height = containerRef.current.clientHeight;

    // Clear & Background
    ctx.fillStyle = '#1a202c'; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const patternSize = 20 * zoom;
    ctx.fillStyle = '#2d3342';
    for(let i=0; i<canvas.width + patternSize; i+=patternSize) {
      for(let j=0; j<canvas.height + patternSize; j+=patternSize) {
         if (((i + pan.x % patternSize)/patternSize + (j + pan.y % patternSize)/patternSize) % 2 === 0) {
             ctx.fillRect(
               Math.floor((i + pan.x % patternSize) - patternSize), 
               Math.floor((j + pan.y % patternSize) - patternSize), 
               patternSize, patternSize
             );
         }
      }
    }

    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);
    ctx.imageSmoothingEnabled = false;

    if (image) {
      ctx.drawImage(image, 0, 0);

      const activeRects = getActiveRects();

      // Draw all rects
      activeRects.forEach(r => {
        const isSelected = r.id === selectedRectId;
        ctx.strokeStyle = isSelected ? '#3b82f6' : 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 1 / zoom;
        ctx.strokeRect(r.x, r.y, r.w, r.h);
        
        ctx.fillStyle = isSelected ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.1)';
        ctx.fillRect(r.x, r.y, r.w, r.h);
      });

      // Draw dragging rect
      if (currentDrawRect) {
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1 / zoom;
        ctx.strokeRect(currentDrawRect.x, currentDrawRect.y, currentDrawRect.w, currentDrawRect.h);
      }
    }
    ctx.restore();

    // Draw Resize Handles (Screen Space overlay)
    // Only allow resizing for manual and island rects (check ID)
    if (selectedRectId) {
       const activeRects = getActiveRects();
       const r = activeRects.find(rect => rect.id === selectedRectId);
       
       if (r && (r.id.startsWith('manual-') || r.id.startsWith('island-'))) {
         const rx = r.x * zoom + pan.x;
         const ry = r.y * zoom + pan.y;
         const rw = r.w * zoom;
         const rh = r.h * zoom;
         const handleSize = 6;
         
         ctx.fillStyle = 'white';
         ctx.strokeStyle = '#3b82f6';
         ctx.lineWidth = 1;

         const drawHandle = (x: number, y: number) => {
           ctx.beginPath();
           ctx.rect(x - handleSize/2, y - handleSize/2, handleSize, handleSize);
           ctx.fill();
           ctx.stroke();
         };

         // Corners
         drawHandle(rx, ry); // nw
         drawHandle(rx + rw, ry); // ne
         drawHandle(rx + rw, ry + rh); // se
         drawHandle(rx, ry + rh); // sw

         // Sides
         drawHandle(rx + rw/2, ry); // n
         drawHandle(rx + rw, ry + rh/2); // e
         drawHandle(rx + rw/2, ry + rh); // s
         drawHandle(rx, ry + rh/2); // w
       }
    }

  }, [image, zoom, pan, settings, manualRects, islandRects, selectedRectId, currentDrawRect, hiddenRectIds]);

  // 2. Event Handlers
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const zoomFactor = -e.deltaY * 0.001;
      setZoom(z => Math.max(0.1, Math.min(10, z + zoomFactor)));
    } else {
      setPan(p => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || e.shiftKey) {
      setIsDraggingPan(true);
      setDragStart({ x: e.clientX, y: e.clientY });
      return;
    }

    if (e.button === 0) {
      // Check for Resize Handle Hit first
      if (selectedRectId) {
        const activeRects = getActiveRects();
        const r = activeRects.find(rect => rect.id === selectedRectId);
        if (r && (r.id.startsWith('manual-') || r.id.startsWith('island-'))) {
          const handle = getHandleAtPosition(e.clientX, e.clientY, r);
          if (handle) {
            setIsResizing(handle);
            setDragStart({ x: e.clientX, y: e.clientY });
            setInitialResizeRect({ ...r });
            return;
          }
        }
      }

      const coords = toImageCoords(e.clientX, e.clientY);
      
      const activeRects = getActiveRects();
      // Reverse find to select top-most
      const clickedRect = [...activeRects].reverse().find(r => 
        coords.x >= r.x && coords.x <= r.x + r.w &&
        coords.y >= r.y && coords.y <= r.y + r.h
      );

      if (clickedRect) {
        onSelectRect(clickedRect.id);
        // Note: We don't start drawing if clicking on a rect
      } else {
         // Clicked empty space - ALWAYS allow drawing manual rects now
         setIsDrawing(true);
         setDrawStart(coords);
         onSelectRect(null);
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    // 1. Pan
    if (isDraggingPan) {
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      setPan(p => ({ x: p.x + dx, y: p.y + dy }));
      setDragStart({ x: e.clientX, y: e.clientY });
      return;
    }

    // 2. Resize
    if (isResizing && initialResizeRect) {
      const dx = (e.clientX - dragStart.x) / zoom;
      const dy = (e.clientY - dragStart.y) / zoom;
      
      const r = { ...initialResizeRect };
      
      if (isResizing.includes('e')) r.w += dx;
      if (isResizing.includes('w')) { r.x += dx; r.w -= dx; }
      if (isResizing.includes('s')) r.h += dy;
      if (isResizing.includes('n')) { r.y += dy; r.h -= dy; }

      // Normalize width/height to be positive
      if (r.w < 0) { r.x += r.w; r.w = Math.abs(r.w); }
      if (r.h < 0) { r.y += r.h; r.h = Math.abs(r.h); }

      updateRect(r);
      return;
    }

    // 3. Draw - Always active if isDrawing is true
    if (isDrawing) {
      const current = toImageCoords(e.clientX, e.clientY);
      const w = current.x - drawStart.x;
      const h = current.y - drawStart.y;
      
      setCurrentDrawRect({
        id: 'drawing',
        x: w < 0 ? current.x : drawStart.x,
        y: h < 0 ? current.y : drawStart.y,
        w: Math.abs(w),
        h: Math.abs(h)
      });
      return;
    }

    // 4. Cursor Update (Hover)
    if (selectedRectId) {
      const activeRects = getActiveRects();
      const r = activeRects.find(rect => rect.id === selectedRectId);
      if (r && (r.id.startsWith('manual-') || r.id.startsWith('island-'))) {
        const handle = getHandleAtPosition(e.clientX, e.clientY, r);
        if (handle) {
          if (handle === 'n' || handle === 's') setCursor('ns-resize');
          else if (handle === 'e' || handle === 'w') setCursor('ew-resize');
          else if (handle === 'nw' || handle === 'se') setCursor('nwse-resize');
          else if (handle === 'ne' || handle === 'sw') setCursor('nesw-resize');
          return;
        }
      }
    }
    setCursor('crosshair');
  };

  const handleMouseUp = () => {
    setIsDraggingPan(false);
    setIsResizing(null);
    setInitialResizeRect(null);
    
    if (isDrawing && currentDrawRect) {
      if (currentDrawRect.w > 1 && currentDrawRect.h > 1) {
        setManualRects([...manualRects, { ...currentDrawRect, id: `manual-${Date.now()}` }]);
      }
      setCurrentDrawRect(null);
    }
    setIsDrawing(false);
  };

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full bg-gray-950 overflow-hidden relative group/canvas"
      style={{ cursor }}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      tabIndex={0} 
    >
      <canvas ref={canvasRef} className="block" />
      
      {!image && (
        <div className="absolute inset-0 flex items-center justify-center text-gray-500 pointer-events-none">
          <div className="text-center">
            <p className="text-xl">No Image Loaded</p>
            <p className="text-sm">Upload a sprite sheet to begin</p>
          </div>
        </div>
      )}

      {/* Zoom Controls Overlay */}
      <div className="absolute bottom-4 left-4 flex flex-col gap-2 z-10">
        <div className="flex items-center gap-2">
            <div className="bg-gray-800 text-xs rounded shadow-lg text-white flex items-center overflow-hidden border border-gray-700">
                <button 
                  onClick={handleZoomOut} 
                  className="p-2 hover:bg-gray-700 border-r border-gray-700 active:bg-gray-600" 
                  title="Zoom Out (-)"
                >
                <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="w-12 text-center font-mono">{(zoom * 100).toFixed(0)}%</span>
                <button 
                  onClick={handleZoomIn} 
                  className="p-2 hover:bg-gray-700 border-l border-gray-700 active:bg-gray-600" 
                  title="Zoom In (+)"
                >
                <Plus className="w-3.5 h-3.5" />
                </button>
                <button 
                  onClick={handleFit} 
                  className="p-2 hover:bg-gray-700 border-l border-gray-700 active:bg-gray-600 text-blue-400" 
                  title="Fit to Screen (0)"
                >
                <Maximize className="w-3.5 h-3.5" />
                </button>
            </div>
            
            <div className="bg-gray-800/90 backdrop-blur-sm text-[10px] px-2 py-1.5 rounded shadow text-gray-400 border border-gray-700/50 pointer-events-none select-none">
                Pan: Shift+Drag | Drag to Add Rect | Delete to Remove
            </div>
        </div>
      </div>
    </div>
  );
};

export default CanvasWorkspace;