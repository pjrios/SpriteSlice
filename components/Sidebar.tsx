import React from 'react';
import { AppSettings } from '../types';
import { Upload, Sliders, Scissors, Droplet, Grid3X3, MousePointer2, Sparkles } from 'lucide-react';

interface SidebarProps {
  settings: AppSettings;
  updateSettings: (s: Partial<AppSettings>) => void;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isProcessing: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ settings, updateSettings, onUpload, isProcessing }) => {
  
  const updateGrid = (key: keyof AppSettings['grid'], val: number) => {
    updateSettings({
      ...settings,
      grid: { ...settings.grid, [key]: val }
    });
  };

  const updateIslands = (key: keyof AppSettings['islands'], val: number) => {
    updateSettings({
      ...settings,
      islands: { ...settings.islands, [key]: val }
    });
  };

  const updateProc = (key: keyof AppSettings['processing'], val: any) => {
    updateSettings({
      ...settings,
      processing: { ...settings.processing, [key]: val }
    });
  };

  return (
    <div className="w-80 bg-gray-850 border-r border-gray-750 flex flex-col h-full text-sm">
      <div className="p-4 border-b border-gray-750">
        <h1 className="font-bold text-lg text-white mb-4 flex items-center gap-2">
          <Scissors className="w-5 h-5 text-blue-400" /> SpriteSlice
        </h1>
        
        <label className="flex items-center justify-center w-full px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded cursor-pointer transition-colors font-medium">
          <Upload className="w-4 h-4 mr-2" />
          Load Sprite Sheet
          <input type="file" className="hidden" accept="image/*" onChange={onUpload} />
        </label>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        
        {/* Mode Selection */}
        <div className="space-y-2">
          <div className="flex bg-gray-750 rounded p-1">
            <button
              onClick={() => updateSettings({ mode: 'grid' })}
              className={`flex-1 flex items-center justify-center py-1.5 rounded text-xs font-medium transition-colors ${settings.mode === 'grid' ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}
              title="Fixed Grid"
            >
              <Grid3X3 className="w-3 h-3 mr-1.5" /> Grid
            </button>
            <button
              onClick={() => updateSettings({ mode: 'islands' })}
              className={`flex-1 flex items-center justify-center py-1.5 rounded text-xs font-medium transition-colors ${settings.mode === 'islands' ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}
              title="Detect Pixel Islands"
            >
              <Sparkles className="w-3 h-3 mr-1.5" /> Islands
            </button>
            <button
              onClick={() => updateSettings({ mode: 'manual' })}
              className={`flex-1 flex items-center justify-center py-1.5 rounded text-xs font-medium transition-colors ${settings.mode === 'manual' ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}
              title="Manual Selection"
            >
              <MousePointer2 className="w-3 h-3 mr-1.5" /> Manual
            </button>
          </div>
        </div>

        {/* Grid Settings */}
        {settings.mode === 'grid' && (
          <div className="space-y-3">
            <h3 className="font-semibold text-gray-300 flex items-center gap-2">
              <Sliders className="w-4 h-4" /> Grid Dimensions
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-gray-500 text-xs mb-1">Width (px)</label>
                <input 
                  type="number" 
                  value={settings.grid.width} 
                  onChange={(e) => updateGrid('width', Number(e.target.value))}
                  className="w-full bg-gray-950 border border-gray-700 rounded px-2 py-1 text-white focus:border-blue-500 outline-none" 
                />
              </div>
              <div>
                <label className="block text-gray-500 text-xs mb-1">Height (px)</label>
                <input 
                  type="number" 
                  value={settings.grid.height} 
                  onChange={(e) => updateGrid('height', Number(e.target.value))}
                  className="w-full bg-gray-950 border border-gray-700 rounded px-2 py-1 text-white focus:border-blue-500 outline-none" 
                />
              </div>
              <div>
                <label className="block text-gray-500 text-xs mb-1">Margin X</label>
                <input 
                  type="number" 
                  value={settings.grid.marginX} 
                  onChange={(e) => updateGrid('marginX', Number(e.target.value))}
                  className="w-full bg-gray-950 border border-gray-700 rounded px-2 py-1 text-white focus:border-blue-500 outline-none" 
                />
              </div>
              <div>
                <label className="block text-gray-500 text-xs mb-1">Margin Y</label>
                <input 
                  type="number" 
                  value={settings.grid.marginY} 
                  onChange={(e) => updateGrid('marginY', Number(e.target.value))}
                  className="w-full bg-gray-950 border border-gray-700 rounded px-2 py-1 text-white focus:border-blue-500 outline-none" 
                />
              </div>
              <div>
                <label className="block text-gray-500 text-xs mb-1">Space X</label>
                <input 
                  type="number" 
                  value={settings.grid.spacingX} 
                  onChange={(e) => updateGrid('spacingX', Number(e.target.value))}
                  className="w-full bg-gray-950 border border-gray-700 rounded px-2 py-1 text-white focus:border-blue-500 outline-none" 
                />
              </div>
              <div>
                <label className="block text-gray-500 text-xs mb-1">Space Y</label>
                <input 
                  type="number" 
                  value={settings.grid.spacingY} 
                  onChange={(e) => updateGrid('spacingY', Number(e.target.value))}
                  className="w-full bg-gray-950 border border-gray-700 rounded px-2 py-1 text-white focus:border-blue-500 outline-none" 
                />
              </div>
            </div>
          </div>
        )}

        {settings.mode === 'islands' && (
          <div className="space-y-3">
             <div className="p-3 bg-gray-800 rounded text-gray-400 text-xs mb-2">
              <p>Automatically detects connected groups of pixels (islands) separated by transparency.</p>
            </div>
            
            <h3 className="font-semibold text-gray-300 flex items-center gap-2">
              <Sliders className="w-4 h-4" /> Filter Islands
            </h3>
            <div className="grid grid-cols-2 gap-3">
               <div>
                <label className="block text-gray-500 text-xs mb-1">Min Width (px)</label>
                <input 
                  type="number" 
                  value={settings.islands.minWidth} 
                  onChange={(e) => updateIslands('minWidth', Number(e.target.value))}
                  className="w-full bg-gray-950 border border-gray-700 rounded px-2 py-1 text-white focus:border-blue-500 outline-none" 
                  min="1"
                />
              </div>
              <div>
                <label className="block text-gray-500 text-xs mb-1">Min Height (px)</label>
                <input 
                  type="number" 
                  value={settings.islands.minHeight} 
                  onChange={(e) => updateIslands('minHeight', Number(e.target.value))}
                  className="w-full bg-gray-950 border border-gray-700 rounded px-2 py-1 text-white focus:border-blue-500 outline-none" 
                  min="1"
                />
              </div>
            </div>
          </div>
        )}

        <hr className="border-gray-750" />

        {/* Processing Settings */}
        <div className="space-y-3">
          <h3 className="font-semibold text-gray-300 flex items-center gap-2">
            <Droplet className="w-4 h-4" /> Processing
          </h3>
          
          <label className="flex items-center gap-2 cursor-pointer">
            <input 
              type="checkbox" 
              checked={settings.processing.autoTrim}
              onChange={(e) => updateProc('autoTrim', e.target.checked)}
              className="rounded bg-gray-950 border-gray-700 text-blue-500 focus:ring-0" 
            />
            <span className="text-gray-300">Auto-Trim Transparent</span>
          </label>

          <div className="space-y-2 pt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input 
                type="checkbox" 
                checked={settings.processing.colorKeyEnabled}
                onChange={(e) => updateProc('colorKeyEnabled', e.target.checked)}
                className="rounded bg-gray-950 border-gray-700 text-blue-500 focus:ring-0" 
              />
              <span className="text-gray-300">Color Key Removal</span>
            </label>
            
            {settings.processing.colorKeyEnabled && (
              <div className="pl-6 space-y-2">
                <div className="flex items-center gap-2">
                  <input 
                    type="color" 
                    value={settings.processing.colorKeyColor}
                    onChange={(e) => updateProc('colorKeyColor', e.target.value)}
                    className="w-6 h-6 rounded bg-transparent border-0 cursor-pointer" 
                  />
                  <span className="text-xs text-gray-500">Target Color</span>
                </div>
                <div>
                  <label className="block text-gray-500 text-xs mb-1">Tolerance: {settings.processing.colorKeyTolerance}</label>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={settings.processing.colorKeyTolerance}
                    onChange={(e) => updateProc('colorKeyTolerance', Number(e.target.value))}
                    className="w-full"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {isProcessing && (
           <div className="bg-blue-900/30 text-blue-200 text-xs p-2 rounded animate-pulse">
             Processing frames...
           </div>
        )}
      </div>
      
      <div className="p-4 border-t border-gray-750 text-xs text-gray-600">
        SpriteSlice v1.0.0
      </div>
    </div>
  );
};

export default Sidebar;