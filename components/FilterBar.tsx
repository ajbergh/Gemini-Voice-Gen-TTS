/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import { FilterState } from '../types';
import { Search, Sparkles, ChevronDown, Mic, LayoutGrid, GalleryHorizontalEnd, Sun, Moon, FileText } from 'lucide-react';

interface FilterBarProps {
  filters: FilterState;
  onFilterChange: (newFilters: FilterState) => void;
  uniqueGenders: string[];
  uniquePitches: string[];
  onOpenAiCasting: () => void;
  onOpenScriptReader: () => void;
  viewMode: 'carousel' | 'grid';
  onViewModeChange: (mode: 'carousel' | 'grid') => void;
  isDarkMode: boolean;
  toggleTheme: () => void;
}

const FilterBar: React.FC<FilterBarProps> = ({ 
  filters, 
  onFilterChange, 
  uniqueGenders, 
  uniquePitches,
  onOpenAiCasting,
  onOpenScriptReader,
  viewMode,
  onViewModeChange,
  isDarkMode,
  toggleTheme
}) => {
  
  const handleGenderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFilterChange({ ...filters, gender: e.target.value });
  };

  const handlePitchChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFilterChange({ ...filters, pitch: e.target.value });
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFilterChange({ ...filters, search: e.target.value });
  };

  return (
    <div className="relative z-50 w-full bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border-b border-zinc-200 dark:border-zinc-800 transition-colors duration-300">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 h-16">
            <div className="flex items-center justify-between h-full gap-2 sm:gap-4">
                
                {/* Left: Brand + AI Casting Button */}
                <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                    <div className="flex items-center gap-2 group select-none">
                        <div className="w-9 h-9 bg-zinc-900 dark:bg-zinc-100 rounded-xl flex items-center justify-center shadow-lg shadow-zinc-900/10 shrink-0">
                            <Mic size={18} className="text-white dark:text-zinc-900" />
                        </div>
                        <h1 className="hidden lg:block text-lg font-bold tracking-tight text-zinc-900 dark:text-white font-display whitespace-nowrap">
                            Gemini Voice Library
                        </h1>
                    </div>

                    <button 
                        onClick={onOpenAiCasting}
                        className="flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-zinc-900 dark:bg-indigo-600 hover:bg-zinc-800 dark:hover:bg-indigo-500 text-white rounded-full text-xs sm:text-sm font-medium shadow-md transition-all hover:scale-105 active:scale-95 group shrink-0"
                    >
                        <Sparkles size={14} className="text-indigo-300 dark:text-indigo-100 group-hover:text-indigo-200 transition-colors" />
                        <span className="tracking-wide hidden sm:inline">AI Casting Director</span>
                        <span className="tracking-wide sm:hidden">Casting</span>
                    </button>

                    <button 
                        onClick={onOpenScriptReader}
                        className="flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-700 rounded-full text-xs sm:text-sm font-medium shadow-sm transition-all hover:scale-105 active:scale-95 group shrink-0"
                    >
                        <FileText size={14} className="text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-700 dark:group-hover:text-zinc-300 transition-colors" />
                        <span className="tracking-wide hidden sm:inline">Test Script</span>
                        <span className="tracking-wide sm:hidden">Script</span>
                    </button>
                </div>

                {/* Right: Search, Filters & Actions */}
                <div className="flex items-center gap-2 justify-end min-w-0 flex-1">
                    
                    {/* Search Input (Flexible width) */}
                    <div className="relative group w-full max-w-[120px] sm:max-w-[200px] transition-all">
                        <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-zinc-400 dark:text-zinc-500 group-focus-within:text-zinc-600 dark:group-focus-within:text-zinc-300 transition-colors">
                            <Search size={14} />
                        </div>
                        <input
                            type="text"
                            placeholder="Search..."
                            value={filters.search}
                            onChange={handleSearchChange}
                            className="block w-full pl-8 pr-2.5 py-1.5 bg-zinc-100 dark:bg-zinc-800 border-transparent focus:bg-white dark:focus:bg-zinc-900 border focus:border-indigo-200 dark:focus:border-indigo-700 rounded-lg text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900/30 transition-all"
                        />
                    </div>

                    {/* Desktop Filter Dropdowns */}
                    <div className="hidden xl:flex gap-2 shrink-0">
                         <div className="relative group">
                            <select
                                value={filters.gender}
                                onChange={handleGenderChange}
                                className="appearance-none bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 py-1.5 pl-3 pr-8 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 hover:bg-zinc-50 dark:hover:bg-zinc-700 cursor-pointer transition-all"
                            >
                                <option value="All">All Genders</option>
                                {uniqueGenders.map(g => <option key={g} value={g}>{g}</option>)}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-zinc-400">
                                <ChevronDown size={12} />
                            </div>
                        </div>

                        <div className="relative group">
                            <select
                                value={filters.pitch}
                                onChange={handlePitchChange}
                                className="appearance-none bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 py-1.5 pl-3 pr-8 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 hover:bg-zinc-50 dark:hover:bg-zinc-700 cursor-pointer transition-all"
                            >
                                <option value="All">All Pitches</option>
                                {uniquePitches.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-zinc-400">
                                <ChevronDown size={12} />
                            </div>
                        </div>
                    </div>

                    <div className="w-px h-5 bg-zinc-200 dark:bg-zinc-700 mx-1 hidden sm:block shrink-0"></div>

                    {/* Actions Group */}
                    <div className="flex gap-1.5 sm:gap-2 shrink-0">
                        {/* View Toggle */}
                        <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg border border-zinc-200 dark:border-zinc-700">
                            <button
                                onClick={() => onViewModeChange('carousel')}
                                className={`p-1.5 rounded-md transition-all ${viewMode === 'carousel' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200'}`}
                                title="Carousel View"
                            >
                                <GalleryHorizontalEnd size={14} />
                            </button>
                            <button
                                onClick={() => onViewModeChange('grid')}
                                className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200'}`}
                                title="Grid View"
                            >
                                <LayoutGrid size={14} />
                            </button>
                        </div>

                        {/* Theme Toggle */}
                        <button
                            onClick={toggleTheme}
                            className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
                            title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
                        >
                            {isDarkMode ? <Sun size={14} /> : <Moon size={14} />}
                        </button>
                    </div>

                </div>
            </div>
        </div>
        
        {/* Mobile Filters Sub-bar */}
        <div className="xl:hidden border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
            <div className="px-4 py-2 flex gap-2 overflow-x-auto scrollbar-hide">
                 <select
                    value={filters.gender}
                    onChange={handleGenderChange}
                    className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 py-1 px-3 rounded-md text-[10px] font-bold uppercase tracking-wide"
                >
                    <option value="All">All Genders</option>
                    {uniqueGenders.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
                <select
                    value={filters.pitch}
                    onChange={handlePitchChange}
                    className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 py-1 px-3 rounded-md text-[10px] font-bold uppercase tracking-wide"
                >
                    <option value="All">All Pitches</option>
                    {uniquePitches.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
            </div>
        </div>
    </div>
  );
};

export default FilterBar;