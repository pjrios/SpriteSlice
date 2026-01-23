import React, { useState, useEffect } from 'react';
import { FrameData } from '../types';
import { X, ZoomIn } from 'lucide-react';

interface PreviewModalProps {
  frames: FrameData[];
  onClose: () => void;
}

const PreviewModal: React.FC<PreviewModalProps> = ({ frames, onClose }) => {
  const [currentFrame, setCurrentFrame] = useState(0);
  const [fps, setFps] = useState(12);
  const [zoom, setZoom] = useState(1);
  const [isPlaying, setIsPlaying] = useState(true);

  useEffect(() => {
    if (!isPlaying || frames.length === 0) return;
    
    const interval = setInterval(() => {
      setCurrentFrame(c => (c + 1) % frames.length);
    }, 1000 / fps);

    return () => clearInterval(interval);
  }, [fps, isPlaying, frames]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Zoom In
      if (e.key === '+' || e.key === '=') {
        setZoom(prev => Math.min(8, prev + 0.5));
      }
      // Zoom Out
      if (e.key === '-' || e.key === '_') {
        setZoom(prev => Math.max(0.5, prev - 0.5));
      }
      // Close on Escape
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (frames.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-gray-800 rounded-lg shadow-xl w-96 border border-gray-700 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-3 border-b border-gray-700 shrink-0">
          <h3 className="text-white font-medium">Preview</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="aspect-square bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAABtJREFUeNpiZGBg+M+AAxwnQ4M6DBp40AgQYAA76wE29k36+QAAAABJRU5ErkJggg==')] flex items-center justify-center bg-gray-900 overflow-hidden relative">
          <img 
            src={frames[currentFrame].url} 
            className="max-w-full max-h-full object-contain" 
            alt="Preview" 
            style={{ 
              imageRendering: 'pixelated',
              transform: `scale(${zoom})`,
              transition: 'transform 0.05s ease-out'
            }}
          />
        </div>

        <div className="p-4 space-y-4 shrink-0">
           {/* Info Row */}
           <div className="flex items-center justify-between text-xs text-gray-400">
             <span>Frame: {currentFrame + 1} / {frames.length}</span>
             <span>{frames[currentFrame].trimmedSize?.w ?? frames[currentFrame].rect.w} x {frames[currentFrame].trimmedSize?.h ?? frames[currentFrame].rect.h} px</span>
           </div>

           {/* FPS Control */}
           <div className="space-y-1">
             <div className="flex justify-between text-sm text-gray-300">
               <label>Speed</label>
               <span>{fps} FPS</span>
             </div>
             <input 
               type="range" 
               min="1" 
               max="60" 
               value={fps} 
               onChange={(e) => setFps(Number(e.target.value))}
               className="w-full accent-blue-500"
             />
           </div>

           {/* Zoom Control */}
           <div className="space-y-1">
             <div className="flex justify-between text-sm text-gray-300">
                <label className="flex items-center gap-1"><ZoomIn className="w-3 h-3"/> Zoom</label>
                <span>{zoom.toFixed(1)}x</span>
             </div>
             <input 
               type="range" 
               min="0.5" 
               max="8" 
               step="0.5"
               value={zoom} 
               onChange={(e) => setZoom(Number(e.target.value))}
               className="w-full accent-blue-500"
             />
             <div className="text-[10px] text-gray-500 text-right">Use + and - keys</div>
           </div>

           <button 
             onClick={() => setIsPlaying(!isPlaying)}
             className={`w-full py-2 rounded font-medium transition-colors ${isPlaying ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}
           >
             {isPlaying ? "Pause" : "Play"}
           </button>
        </div>
      </div>
    </div>
  );
};

export default PreviewModal;