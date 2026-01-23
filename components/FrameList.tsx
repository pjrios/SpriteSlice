import React, { useState, useRef } from 'react';
import { FrameData } from '../types';
import { Play, Download, Trash2, X, Move } from 'lucide-react';

interface FrameListProps {
  frames: FrameData[];
  onExport: () => void;
  onClear: () => void;
  onTogglePreview: () => void;
  onDelete: (ids: string[]) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
}

const FrameList: React.FC<FrameListProps> = ({ 
  frames, 
  onExport, 
  onClear, 
  onTogglePreview, 
  onDelete,
  onReorder
}) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleFrameClick = (e: React.MouseEvent, frameId: string, index: number) => {
    e.stopPropagation();
    
    const newSelected = new Set(selectedIds);
    
    if (e.ctrlKey || e.metaKey) {
      // Toggle selection
      if (newSelected.has(frameId)) {
        newSelected.delete(frameId);
      } else {
        newSelected.add(frameId);
      }
      setLastSelectedId(frameId);
    } else if (e.shiftKey && lastSelectedId) {
      // Range selection
      const lastIdx = frames.findIndex(f => f.id === lastSelectedId);
      const start = Math.min(lastIdx, index);
      const end = Math.max(lastIdx, index);
      
      // If ctrl is not held, shift usually adds to selection or defines a new range. 
      // Standard behavior: Clear others if only shift is held? 
      // Let's keep it simple: Select range, keep existing if ctrl held (complex), 
      // otherwise just select the range.
      // We will follow common file explorer pattern: Shift click selects range from anchor.
      
      newSelected.clear(); // Clear purely for the range
      for (let i = start; i <= end; i++) {
        if (frames[i]) newSelected.add(frames[i].id);
      }
    } else {
      // Single select
      newSelected.clear();
      newSelected.add(frameId);
      setLastSelectedId(frameId);
    }
    
    setSelectedIds(newSelected);
  };

  const handleBackgroundClick = () => {
    setSelectedIds(new Set());
    setLastSelectedId(null);
  };

  const handleDeleteSelected = () => {
    if (selectedIds.size > 0) {
      onDelete(Array.from(selectedIds));
      setSelectedIds(new Set());
    }
  };

  // Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    // Create a ghost image if needed, or default is fine
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault(); // Necessary to allow dropping
    if (draggedIndex === null || draggedIndex === index) return;
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== dropIndex) {
      onReorder(draggedIndex, dropIndex);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  return (
    <div 
      className="w-64 bg-gray-850 border-l border-gray-750 flex flex-col h-full"
      onClick={handleBackgroundClick}
    >
      <div className="p-4 border-b border-gray-750 flex items-center justify-between bg-gray-850">
        <h2 className="font-semibold text-white">Frames ({frames.length})</h2>
        <div className="flex gap-2">
          {selectedIds.size > 0 && (
            <button 
              onClick={(e) => { e.stopPropagation(); handleDeleteSelected(); }}
              title="Delete Selected"
              className="text-red-400 hover:text-red-300 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button 
            onClick={(e) => { e.stopPropagation(); onClear(); }}
            title="Clear All"
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {frames.length === 0 ? (
          <div className="text-center text-gray-600 text-sm mt-10 italic pointer-events-none">
            No frames generated.<br/> Adjust slices to begin.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 pb-4">
            {frames.map((frame, idx) => {
              const isSelected = selectedIds.has(frame.id);
              const isDragging = draggedIndex === idx;
              const isDragOver = dragOverIndex === idx;
              
              return (
                <div 
                  key={frame.id} 
                  onClick={(e) => handleFrameClick(e, frame.id, idx)}
                  draggable
                  onDragStart={(e) => handleDragStart(e, idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, idx)}
                  className={`
                    relative rounded p-1 group transition-all border
                    ${isSelected ? 'bg-blue-900/40 border-blue-500' : 'bg-gray-750 border-transparent hover:border-gray-500'}
                    ${isDragging ? 'opacity-50 scale-95' : 'opacity-100'}
                    ${isDragOver ? 'border-t-2 border-t-blue-400 transform translate-y-1' : ''}
                    cursor-pointer
                  `}
                >
                  <div className="aspect-square bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAABtJREFUeNpiZGBg+M+AAxwnQ4M6DBp40AgQYAA76wE29k36+QAAAABJRU5ErkJggg==')] rounded overflow-hidden flex items-center justify-center pointer-events-none">
                    <img src={frame.url} alt={`Frame ${idx}`} className="max-w-full max-h-full object-contain pixelated" />
                  </div>
                  
                  {/* Index badge */}
                  <div className="absolute top-1 left-1 bg-black/70 text-white text-[10px] px-1 rounded opacity-70 group-hover:opacity-100 pointer-events-none">
                    #{idx}
                  </div>

                  {/* Individual Delete button */}
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete([frame.id]);
                    }}
                    className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 hover:bg-red-500 shadow-md transition-opacity z-10"
                    title="Delete frame"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="p-4 border-t border-gray-750 space-y-2 bg-gray-900" onClick={e => e.stopPropagation()}>
         <button 
          onClick={onTogglePreview}
          disabled={frames.length === 0}
          className="w-full flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded text-sm font-medium transition-colors disabled:opacity-50"
        >
          <Play className="w-4 h-4" /> Preview Animation
        </button>
        <button 
          onClick={onExport}
          disabled={frames.length === 0}
          className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white py-2 rounded text-sm font-medium transition-colors disabled:opacity-50"
        >
          <Download className="w-4 h-4" /> Export ZIP
        </button>
      </div>
    </div>
  );
};

export default FrameList;