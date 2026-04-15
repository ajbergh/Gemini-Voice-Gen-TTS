/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';
import { Search, Sparkles, SlidersHorizontal, Loader2, X, Check, LayoutGrid, GalleryHorizontalEnd } from 'lucide-react';
import { FilterState } from '../types';
import { motion, AnimatePresence } from 'framer-motion';

interface ControlBarProps {
  filters: FilterState;
  onFilterChange: (newFilters: FilterState) => void;
  onAiSearch: (query: string) => void;
  isAiLoading: boolean;
  uniqueGenders: string[];
  uniquePitches: string[];
  hasActiveAiResult: boolean;
  onClearAiResult: () => void;
  viewMode: 'carousel' | 'grid';
  onViewModeChange: (mode: 'carousel' | 'grid') => void;
}

const ControlBar: React.FC<ControlBarProps> = ({
  filters,
  onFilterChange,
  onAiSearch,
  isAiLoading,
  uniqueGenders,
  uniquePitches,
  hasActiveAiResult,
  onClearAiResult,
  viewMode,
  onViewModeChange
}) => {
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (filters.search.length > 5) {
         onAiSearch(filters.search);
      }
    }
  };

  return (
    <div className="fixed bottom-8 left-0 right-0 z-50 flex flex-col items-center justify-end px-4 pointer-events-none">
      
      {/* Filters Popover */}
      <AnimatePresence>
        {isFiltersOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="mb-4 bg-white/90 backdrop-blur-xl border border-white/50 shadow-2xl rounded-2xl p-4 w-full max-w-sm pointer-events-auto"
          >
             <div className="space-y-4">
                <div>
                   <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 block">Gender</label>
                   <div className="flex flex-wrap gap-2">
                      <button 
                        onClick={() => onFilterChange({...filters, gender: 'All'})}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${filters.gender === 'All' ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}
                      >
                        All
                      </button>
                      {uniqueGenders.map(g => (
                        <button 
                            key={g}
                            onClick={() => onFilterChange({...filters, gender: g})}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${filters.gender === g ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}
                        >
                            {g}
                        </button>
                      ))}
                   </div>
                </div>
                <div>
                   <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 block">Pitch</label>
                   <div className="flex flex-wrap gap-2">
                      <button 
                        onClick={() => onFilterChange({...filters, pitch: 'All'})}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${filters.pitch === 'All' ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}
                      >
                        All
                      </button>
                      {uniquePitches.map(p => (
                        <button 
                            key={p}
                            onClick={() => onFilterChange({...filters, pitch: p})}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${filters.pitch === p ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}
                        >
                            {p}
                        </button>
                      ))}
                   </div>
                </div>
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Bar */}
      <div className="pointer-events-auto flex items-center gap-2 p-2 bg-white/80 backdrop-blur-2xl border border-white/60 shadow-[0_8px_30px_rgba(0,0,0,0.12)] rounded-full w-full max-w-xl transition-all hover:shadow-[0_12px_40px_rgba(0,0,0,0.15)] hover:bg-white/90">
        
        {/* View Mode Toggle */}
        <button
          onClick={() => onViewModeChange(viewMode === 'carousel' ? 'grid' : 'carousel')}
          className="h-10 w-10 shrink-0 rounded-full flex items-center justify-center transition-all text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
          title={viewMode === 'carousel' ? "Switch to Grid View" : "Switch to Carousel View"}
        >
          {viewMode === 'carousel' ? <LayoutGrid size={18} /> : <GalleryHorizontalEnd size={18} />}
        </button>

        <div className="w-px h-6 bg-zinc-200 mx-1"></div>

        {/* Filter Toggle */}
        <button
          onClick={() => setIsFiltersOpen(!isFiltersOpen)}
          className={`h-10 w-10 shrink-0 rounded-full flex items-center justify-center transition-all ${isFiltersOpen ? 'bg-zinc-200 text-zinc-900' : 'text-zinc-500 hover:bg-zinc-100'}`}
        >
          <SlidersHorizontal size={18} />
        </button>

        {/* Input */}
        <div className="flex-1 relative h-full flex items-center">
            <input 
                type="text" 
                value={filters.search}
                onChange={(e) => onFilterChange({...filters, search: e.target.value})}
                onKeyDown={handleKeyDown}
                placeholder={hasActiveAiResult ? "Viewing recommendations..." : "Search characteristics, pitch..."}
                className="w-full bg-transparent border-none focus:ring-0 text-zinc-900 placeholder-zinc-400 font-medium text-base h-full py-2 px-2"
            />
            {hasActiveAiResult && (
                <button onClick={onClearAiResult} className="absolute right-0 p-1 bg-zinc-100 rounded-full hover:bg-zinc-200 text-zinc-500">
                    <X size={14} />
                </button>
            )}
        </div>

        {/* AI Action Button */}
        <button
            onClick={() => onAiSearch(filters.search)}
            disabled={isAiLoading || (!filters.search && !hasActiveAiResult)}
            className={`h-10 px-4 rounded-full flex items-center gap-2 font-medium text-sm transition-all duration-300 ${
                isAiLoading 
                ? 'bg-zinc-100 text-zinc-400 cursor-wait' 
                : hasActiveAiResult
                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                    : filters.search.length > 0 
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md hover:shadow-lg hover:scale-105 active:scale-95' 
                        : 'bg-zinc-100 text-zinc-400 hover:bg-zinc-200'
            }`}
        >
            {isAiLoading ? (
                <Loader2 size={18} className="animate-spin" />
            ) : hasActiveAiResult ? (
                <>
                    <Check size={18} />
                    <span>Matched</span>
                </>
            ) : (
                <>
                    <Sparkles size={18} className={filters.search.length > 0 ? "text-yellow-200" : ""} />
                    <span>AI Match</span>
                </>
            )}
        </button>

      </div>
    </div>
  );
};

export default ControlBar;