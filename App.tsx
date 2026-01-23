import React, { useState, useEffect, useCallback } from 'react';
import { ProjectState, AppSettings, FrameData, Rect } from './types';
import Sidebar from './components/Sidebar';
import FrameList from './components/FrameList';
import CanvasWorkspace from './components/CanvasWorkspace';
import PreviewModal from './components/PreviewModal';
import { calculateGridRects, extractFrame, detectIslands } from './services/processor';
import { saveProject, loadProject } from './services/db';
import JSZip from 'jszip';

const DEFAULT_SETTINGS: AppSettings = {
  mode: 'grid',
  grid: {
    width: 32,
    height: 32,
    marginX: 0,
    marginY: 0,
    spacingX: 0,
    spacingY: 0
  },
  islands: {
    minWidth: 5,
    minHeight: 5
  },
  processing: {
    autoTrim: false,
    colorKeyEnabled: false,
    colorKeyColor: '#ff00ff',
    colorKeyTolerance: 10
  },
  export: {
    fps: 12,
    prefix: 'sprite'
  }
};

const App: React.FC = () => {
  // State
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [imageBlob, setImageBlob] = useState<Blob | null>(null); // For DB persistence
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [manualRects, setManualRects] = useState<Rect[]>([]);
  const [islandRects, setIslandRects] = useState<Rect[]>([]);
  const [hiddenRectIds, setHiddenRectIds] = useState<Set<string>>(new Set());
  const [generatedFrames, setGeneratedFrames] = useState<FrameData[]>([]);
  const [selectedRectId, setSelectedRectId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Load from DB on mount
  useEffect(() => {
    loadProject().then((project) => {
      if (project) {
        setSettings(prev => ({
           ...prev, 
           ...project.settings,
           islands: { ...prev.islands, ...project.settings.islands } // Merge ensures new props exist
        }));
        setManualRects(project.manualRects);
        if (project.imageBlob) {
          const url = URL.createObjectURL(project.imageBlob);
          const img = new Image();
          img.onload = () => {
            setImage(img);
            setImageBlob(project.imageBlob);
          };
          img.src = url;
        }
      }
    });
  }, []);

  // Save to DB on change (debounced slightly via effect deps)
  useEffect(() => {
    const timer = setTimeout(() => {
      saveProject({
        imageBlob,
        settings,
        manualRects
      });
    }, 1000);
    return () => clearTimeout(timer);
  }, [imageBlob, settings, manualRects]);

  // Clear hidden rects when grid/islands config changes to avoid ID mismatch ghosts
  useEffect(() => {
    setHiddenRectIds(new Set());
  }, [settings.grid, settings.islands, settings.mode]);

  // Handle Image Upload
  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        setImage(img);
        setImageBlob(file);
        setManualRects([]); // Reset manual rects on new image
        setIslandRects([]); // Reset islands
        setHiddenRectIds(new Set());
      };
      img.src = url;
    }
  };

  const handleDeleteFrames = useCallback((ids: string[]) => {
    // Optimistic update for UI responsiveness
    setGeneratedFrames(frames => frames.filter(f => !ids.includes(f.id)));
    
    // Separate manual rects from auto/island rects
    const manualIds = ids.filter(id => id.startsWith('manual-'));
    const autoIds = ids.filter(id => !id.startsWith('manual-'));

    if (manualIds.length > 0) {
      setManualRects(rects => rects.filter(r => !manualIds.includes(r.id)));
    }

    if (autoIds.length > 0) {
      setHiddenRectIds(prev => {
        const next = new Set(prev);
        autoIds.forEach(id => next.add(id));
        return next;
      });
    }

    if (selectedRectId && ids.includes(selectedRectId)) {
      setSelectedRectId(null);
    }
  }, [selectedRectId]);

  // Keyboard Shortcuts (Delete)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedRectId) {
        // Ignore if focus is in an input
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
        
        handleDeleteFrames([selectedRectId]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedRectId, handleDeleteFrames]);

  // Generate Frames & Handle Island Detection
  useEffect(() => {
    if (!image) return;

    let isActive = true;
    setIsProcessing(true);

    const generate = async () => {
      // 1. Determine source rects
      let rects: Rect[] = [];
      
      if (settings.mode === 'grid') {
        rects = calculateGridRects(image.width, image.height, settings.grid);
      } else if (settings.mode === 'islands') {
        // Run island detection if not already cached or if image changed
        if (islandRects.length === 0) {
            const canvas = document.createElement('canvas');
            canvas.width = image.width;
            canvas.height = image.height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
               ctx.drawImage(image, 0, 0);
               const imageData = ctx.getImageData(0, 0, image.width, image.height);
               const detected = detectIslands(imageData, settings.islands.minWidth, settings.islands.minHeight);
               if (isActive) setIslandRects(detected);
               rects = detected;
            }
        } else {
            rects = islandRects;
        }
      }
      
      // Always merge Manual rects on top (allows correcting islands/grid)
      // Note: in 'manual' mode, the rects array above is empty, so this works for that too.
      rects = [...rects, ...manualRects];

      // Filter out hidden/deleted rects
      rects = rects.filter(r => !hiddenRectIds.has(r.id));

      // 2. Process each rect (slice, trim, key)
      const newFrames: FrameData[] = [];
      
      // Process all rects
      for (const rect of rects) {
        const frame = await extractFrame(image, rect, settings);
        if (frame) {
          newFrames.push(frame);
        }
      }

      if (isActive) {
        // Clean up old object URLs
        generatedFrames.forEach(f => URL.revokeObjectURL(f.url));
        setGeneratedFrames(newFrames);
        setIsProcessing(false);
      }
    };

    // Debounce generation
    const timer = setTimeout(generate, 500);

    return () => {
      isActive = false;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [image, settings.mode, settings.grid, settings.islands, settings.processing, manualRects, islandRects, hiddenRectIds]);

  const handleReorderFrames = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    
    setGeneratedFrames(prev => {
      const copy = [...prev];
      const [moved] = copy.splice(fromIndex, 1);
      copy.splice(toIndex, 0, moved);
      return copy;
    });
  };

  const handleExport = async () => {
    if (generatedFrames.length === 0) return;

    const zip = new JSZip();
    const folder = zip.folder("frames");

    // 1. Add Frames
    generatedFrames.forEach((frame, idx) => {
      const filename = `${settings.export.prefix}_${idx.toString().padStart(3, '0')}.png`;
      if (folder) {
        folder.file(filename, frame.blob);
      }
    });

    // 2. Add Metadata JSON
    const metadata = {
      meta: {
        app: "SpriteSlice",
        version: "1.0",
        image: "spritesheet.png",
        format: "RGBA8888",
        size: { w: image?.width, h: image?.height },
        scale: "1"
      },
      frames: generatedFrames.map((f, i) => {
        // Dimensions of the actual exported file (trimmed if trimming enabled)
        const w = f.trimmedSize?.w ?? f.rect.w;
        const h = f.trimmedSize?.h ?? f.rect.h;
        // Offset from original source rect
        const offX = f.trimOffset?.x ?? 0;
        const offY = f.trimOffset?.y ?? 0;
        // Original size
        const ow = f.originalSize?.w ?? f.rect.w;
        const oh = f.originalSize?.h ?? f.rect.h;
        // Is it trimmed?
        const isTrimmed = !!f.trimOffset && (w !== ow || h !== oh);

        return {
          filename: `${settings.export.prefix}_${i.toString().padStart(3, '0')}.png`,
          frame: { x: 0, y: 0, w, h }, 
          rotated: false,
          trimmed: isTrimmed,
          spriteSourceSize: { x: offX, y: offY, w, h },
          sourceSize: { w: ow, h: oh },
          sheetRect: f.rect
        };
      })
    };
    
    zip.file("data.json", JSON.stringify(metadata, null, 2));

    // 3. Generate Download
    const content = await zip.generateAsync({ type: "blob" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(content);
    link.download = "sprites.zip";
    link.click();
  };

  return (
    <div className="flex h-screen bg-gray-900 text-gray-100 font-sans antialiased">
      <Sidebar 
        settings={settings} 
        updateSettings={(s) => {
           // If changing islands settings, clear current islands so they regenerate
           if (s.islands && (s.islands.minWidth !== settings.islands.minWidth || s.islands.minHeight !== settings.islands.minHeight)) {
             setIslandRects([]);
           }
           setSettings(prev => ({...prev, ...s}));
        }} 
        onUpload={handleUpload}
        isProcessing={isProcessing}
      />
      
      <main className="flex-1 relative border-r border-gray-750">
        <CanvasWorkspace 
          image={image}
          settings={settings}
          manualRects={manualRects}
          islandRects={islandRects}
          hiddenRectIds={hiddenRectIds}
          setManualRects={setManualRects}
          setIslandRects={setIslandRects}
          selectedRectId={selectedRectId}
          onSelectRect={setSelectedRectId}
        />
      </main>

      <FrameList 
        frames={generatedFrames} 
        onExport={handleExport}
        onDelete={handleDeleteFrames}
        onReorder={handleReorderFrames}
        onClear={() => {
           setManualRects([]);
           setGeneratedFrames([]);
           setHiddenRectIds(new Set());
           setIslandRects([]);
        }}
        onTogglePreview={() => setShowPreview(true)}
      />

      {showPreview && (
        <PreviewModal 
          frames={generatedFrames} 
          onClose={() => setShowPreview(false)} 
        />
      )}
    </div>
  );
};

export default App;