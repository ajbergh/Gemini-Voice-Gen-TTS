/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * FilterBar.tsx — Top Navigation & Filter Bar
 *
 * Renders the primary navigation bar with search input, gender/pitch dropdown
 * filters, view mode toggle (carousel/grid), theme switch (dark/light), and
 * action buttons for AI Casting, Script Reader, Settings, and History.
 * On screens below xl breakpoint, filter dropdowns move to a secondary row.
 */

import React, { useState } from 'react';
import { FilterState, GridDensity } from '../types';
import { Search, Sparkles, ChevronDown, LayoutGrid, GalleryHorizontalEnd, Rows3, Rows4, SlidersHorizontal, X } from 'lucide-react';
import { AppSection } from './NavigationSidebar';

interface FilterBarProps {
  filters: FilterState;
  onFilterChange: (newFilters: FilterState) => void;
  uniqueGenders: string[];
  uniquePitches: string[];
  onOpenAiCasting: () => void;
  viewMode: 'carousel' | 'grid';
  onViewModeChange: (mode: 'carousel' | 'grid') => void;
  activeSection: AppSection;
  gridDensity?: GridDensity;
  onGridDensityChange?: (density: GridDensity) => void;
}

const FilterBar: React.FC<FilterBarProps> = ({ 
  filters, 
  onFilterChange, 
  uniqueGenders, 
  uniquePitches,
  onOpenAiCasting,
  viewMode,
  onViewModeChange,
  activeSection,
  gridDensity = 'comfortable',
  onGridDensityChange,
}) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const hasActiveFilters = filters.gender !== 'All' || filters.pitch !== 'All';
  
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
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 h-14">
            <div className="flex items-center justify-between h-full gap-2 sm:gap-4">
                
                {/* Left: Section title + AI Casting Button */}
                <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                    <h2 className="text-sm font-bold tracking-tight text-zinc-900 dark:text-white capitalize whitespace-nowrap">
                        {activeSection === 'voices' ? 'Voice Library' : 'My Presets'}
                    </h2>

                    <button 
                        onClick={onOpenAiCasting}
                        className="flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-zinc-900 dark:bg-[var(--accent-600)] hover:bg-zinc-800 dark:hover:bg-[var(--accent-500)] text-white rounded-full text-xs sm:text-sm font-medium shadow-md transition-all hover:scale-105 active:scale-95 group shrink-0"
                    >
                        <Sparkles size={14} className="text-indigo-300 dark:text-indigo-100 group-hover:text-indigo-200 transition-colors" />
                        <span className="tracking-wide hidden sm:inline">AI Casting Director</span>
                        <span className="tracking-wide sm:hidden">Casting</span>
                    </button>
                </div>

                {/* Right: Search, Filters & View Toggle */}
                <div className="flex items-center gap-2 justify-end min-w-0 flex-1">
                    
                    {/* Search Input */}
                    <div className="relative group w-full max-w-[120px] sm:max-w-[200px] transition-all">
                        <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-zinc-400 dark:text-zinc-500 group-focus-within:text-zinc-600 dark:group-focus-within:text-zinc-300 transition-colors">
                            <Search size={14} />
                        </div>
                        <input
                            type="text"
                            placeholder={activeSection === 'voices' ? 'Search voices...' : 'Search presets...'}
                            value={filters.search}
                            onChange={handleSearchChange}
                            className="block w-full pl-8 pr-2.5 py-1.5 bg-zinc-100 dark:bg-zinc-800 border-transparent focus:bg-white dark:focus:bg-zinc-900 border focus:border-indigo-200 dark:focus:border-indigo-700 rounded-lg text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900/30 transition-all"
                        />
                    </div>

                    {/* Filter Dropdowns (voices section only) */}
                    {activeSection === 'voices' && (
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
                    )}

                    {/* View Toggle */}
                    <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg border border-zinc-200 dark:border-zinc-700 shrink-0">
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

                    {/* Grid Density Toggle */}
                    {viewMode === 'grid' && onGridDensityChange && (
                      <div className="hidden sm:flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg border border-zinc-200 dark:border-zinc-700 shrink-0">
                        <button
                          onClick={() => onGridDensityChange('compact')}
                          className={`p-1.5 rounded-md transition-all ${gridDensity === 'compact' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200'}`}
                          title="Compact"
                        >
                          <Rows4 size={14} />
                        </button>
                        <button
                          onClick={() => onGridDensityChange('comfortable')}
                          className={`p-1.5 rounded-md transition-all ${gridDensity === 'comfortable' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200'}`}
                          title="Comfortable"
                        >
                          <LayoutGrid size={14} />
                        </button>
                        <button
                          onClick={() => onGridDensityChange('spacious')}
                          className={`p-1.5 rounded-md transition-all ${gridDensity === 'spacious' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200'}`}
                          title="Spacious"
                        >
                          <Rows3 size={14} />
                        </button>
                      </div>
                    )}

                    {/* Mobile Filter Drawer Toggle */}
                    {activeSection === 'voices' && (
                      <button
                        onClick={() => setDrawerOpen(true)}
                        className={`xl:hidden relative p-1.5 rounded-lg border transition-all shrink-0 ${
                          hasActiveFilters
                            ? 'bg-[var(--accent-50)] border-[var(--accent-400)] text-[var(--accent-600)]'
                            : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200'
                        }`}
                        title="Filters"
                        aria-label="Open filter drawer"
                      >
                        <SlidersHorizontal size={14} />
                        {hasActiveFilters && (
                          <span className="absolute -top-1 -right-1 w-2 h-2 accent-bg rounded-full" />
                        )}
                      </button>
                    )}

                </div>
            </div>
        </div>
        
        {/* Mobile Filter Drawer */}
        {drawerOpen && (
          <div className="fixed inset-0 z-[90] xl:hidden" role="dialog" aria-modal="true" aria-label="Filters">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-zinc-900/50" onClick={() => setDrawerOpen(false)} />
            {/* Drawer */}
            <div className="absolute top-0 right-0 bottom-0 w-72 bg-white dark:bg-zinc-900 shadow-2xl animate-slide-in-right flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Filters</h3>
                <button onClick={() => setDrawerOpen(false)} className="p-1 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 transition-colors">
                  <X size={16} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-5">
                {/* Gender */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-2">Gender</label>
                  <select
                    value={filters.gender}
                    onChange={(e) => { handleGenderChange(e); }}
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 py-2 px-3 rounded-xl text-sm focus:outline-none focus:ring-2 accent-ring"
                  >
                    <option value="All">All Genders</option>
                    {uniqueGenders.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                {/* Pitch */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-2">Pitch</label>
                  <select
                    value={filters.pitch}
                    onChange={(e) => { handlePitchChange(e); }}
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 py-2 px-3 rounded-xl text-sm focus:outline-none focus:ring-2 accent-ring"
                  >
                    <option value="All">All Pitches</option>
                    {uniquePitches.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                {/* View Mode */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-2">View</label>
                  <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl border border-zinc-200 dark:border-zinc-700">
                    <button
                      onClick={() => onViewModeChange('carousel')}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all ${viewMode === 'carousel' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-400'}`}
                    >
                      <GalleryHorizontalEnd size={14} /> Carousel
                    </button>
                    <button
                      onClick={() => onViewModeChange('grid')}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-400'}`}
                    >
                      <LayoutGrid size={14} /> Grid
                    </button>
                  </div>
                </div>
                {/* Grid Density (only in grid mode) */}
                {viewMode === 'grid' && onGridDensityChange && (
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-2">Density</label>
                    <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl border border-zinc-200 dark:border-zinc-700">
                      {(['compact', 'comfortable', 'spacious'] as const).map(d => (
                        <button
                          key={d}
                          onClick={() => onGridDensityChange(d)}
                          className={`flex-1 py-2 rounded-lg text-xs font-medium capitalize transition-all ${gridDensity === d ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-400'}`}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {/* Reset Filters */}
                {hasActiveFilters && (
                  <button
                    onClick={() => {
                      onFilterChange({ ...filters, gender: 'All', pitch: 'All' });
                    }}
                    className="w-full py-2 text-xs font-medium text-red-500 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    Reset All Filters
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
    </div>
  );
};

export default FilterBar;