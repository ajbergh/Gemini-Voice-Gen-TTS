/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * NavigationSidebar.tsx — Responsive Navigation Component
 *
 * Renders a collapsible sidebar on desktop (xl+) and a bottom tab bar on
 * mobile/tablet. Provides persistent navigation across four main sections:
 * Voices, Presets, Script Reader, and History. Settings opens as a modal.
 */

import React, { useState, useEffect } from 'react';
import { Mic, User, FolderOpen, FileText, Clock, Settings, Sparkles, Sun, Moon, PanelLeftClose, PanelLeft, Palette, Contrast, Activity, Loader2, Command } from 'lucide-react';

export type AppSection = 'voices' | 'presets' | 'script' | 'scriptreader' | 'history';

interface NavigationSidebarProps {
  activeSection: AppSection;
  onSectionChange: (section: AppSection) => void;
  onOpenSettings: () => void;
  onAiCasting: () => void;
  isDarkMode: boolean;
  toggleTheme: () => void;
  customPresetCount: number;
  accentColor?: string;
  onAccentChange?: (color: string) => void;
  highContrast?: boolean;
  onHighContrastChange?: (on: boolean) => void;
  onOpenJobCenter?: () => void;
  onOpenCommandPalette?: () => void;
  ariaHidden?: boolean;
  jobBadgeCount?: number;
  hasActiveJob?: boolean;
  activeJobPercent?: number;
}

interface NavItem {
  id: AppSection;
  label: string;
  shortLabel: string;
  icon: React.ReactNode;
  badge?: number;
}

const ACCENT_COLORS = [
  { name: 'indigo', bg: 'bg-indigo-500' },
  { name: 'blue', bg: 'bg-blue-500' },
  { name: 'violet', bg: 'bg-violet-500' },
  { name: 'rose', bg: 'bg-rose-500' },
  { name: 'emerald', bg: 'bg-emerald-500' },
  { name: 'amber', bg: 'bg-amber-500' },
];

/** Render the primary app navigation sidebar and quick status controls. */
const NavigationSidebar: React.FC<NavigationSidebarProps> = ({
  activeSection,
  onSectionChange,
  onOpenSettings,
  onAiCasting,
  isDarkMode,
  toggleTheme,
  customPresetCount,
  accentColor = 'indigo',
  onAccentChange,
  highContrast = false,
  onHighContrastChange,
  onOpenJobCenter,
  onOpenCommandPalette,
  ariaHidden = false,
  jobBadgeCount = 0,
  hasActiveJob = false,
  activeJobPercent = 0,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [commandModifier, setCommandModifier] = useState('Ctrl+K');

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1280);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    const platform = navigator.platform || navigator.userAgent;
    setCommandModifier(/Mac|iPhone|iPad|iPod/i.test(platform) ? '⌘K' : 'Ctrl+K');
  }, []);

  const navItems: NavItem[] = [
    { id: 'voices', label: 'Voices', shortLabel: 'Voices', icon: <Mic size={20} /> },
    { id: 'presets', label: 'My Presets', shortLabel: 'Presets', icon: <User size={20} />, badge: customPresetCount > 0 ? customPresetCount : undefined },
    { id: 'script', label: 'Projects', shortLabel: 'Projects', icon: <FolderOpen size={20} /> },
    { id: 'scriptreader', label: 'Script Reader', shortLabel: 'Script', icon: <FileText size={20} /> },
    { id: 'history', label: 'History', shortLabel: 'History', icon: <Clock size={20} /> },
  ];

  // --- Mobile: Bottom Tab Bar ---
  if (isMobile) {
    return (
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl border-t border-zinc-200 dark:border-zinc-800 safe-area-bottom" role="navigation" aria-label="Main navigation" aria-hidden={ariaHidden || undefined}>
        <div className="flex items-center justify-around h-14 max-w-lg mx-auto px-2">
          {navItems.map(item => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSectionChange(item.id)}
                className={`relative flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors ${
                  isActive
                    ? 'accent-text'
                    : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300'
                }`}
                aria-current={isActive ? 'page' : undefined}
                aria-label={item.label}
              >
                <span className="relative">
                  {item.icon}
                  {item.badge && (
                    <span className="absolute -top-1 -right-2 min-w-[16px] h-4 px-1 flex items-center justify-center text-[9px] font-bold accent-bg text-white rounded-full">
                      {item.badge}
                    </span>
                  )}
                </span>
                <span className="text-[10px] font-medium leading-tight">{item.shortLabel}</span>
                {isActive && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 accent-bg rounded-full" />
                )}
              </button>
            );
          })}
          {/* Settings tab on mobile */}
          <button
            onClick={onOpenSettings}
            className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
            aria-label="Settings"
          >
            <Settings size={20} />
            <span className="text-[10px] font-medium leading-tight">Settings</span>
          </button>
        </div>
      </nav>
    );
  }

  // --- Desktop: Collapsible Sidebar ---
  return (
    <aside
      className={`flex flex-col h-full bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border-r border-zinc-200 dark:border-zinc-800 transition-all duration-300 shrink-0 z-[70] ${
        collapsed ? 'w-[68px]' : 'w-[220px]'
      }`}
      role="navigation"
      aria-label="Main navigation"
      aria-hidden={ariaHidden || undefined}
    >
      {/* Header */}
      <div className={`flex items-center h-16 px-3 border-b border-zinc-100 dark:border-zinc-800 ${collapsed ? 'justify-center' : 'gap-3'}`}>
        <div className="w-9 h-9 bg-zinc-900 dark:bg-zinc-100 rounded-xl flex items-center justify-center shadow-lg shadow-zinc-900/10 shrink-0">
          <Mic size={18} className="text-white dark:text-zinc-900" />
        </div>
        {!collapsed && (
          <h1 className="text-sm font-bold tracking-tight text-zinc-900 dark:text-white font-display whitespace-nowrap overflow-hidden">
            Gemini Voice Studio
          </h1>
        )}
      </div>

      {/* AI Casting Button */}
      <div className="px-3 pt-4 pb-2">
        <button
          onClick={onAiCasting}
          className={`w-full flex items-center gap-2 py-2 bg-zinc-900 dark:bg-[var(--accent-600)] hover:bg-zinc-800 dark:hover:bg-[var(--accent-500)] text-white rounded-xl text-sm font-medium shadow-md transition-all hover:scale-[1.02] active:scale-[0.98] ${
            collapsed ? 'justify-center px-2' : 'px-3'
          }`}
          title="AI Casting Director"
        >
          <Sparkles size={16} className="text-[var(--accent-100)] shrink-0" />
          {!collapsed && <span className="truncate">AI Casting</span>}
        </button>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto">
        {navItems.map(item => {
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSectionChange(item.id)}
              className={`w-full flex items-center gap-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                collapsed ? 'justify-center px-2' : 'px-3'
              } ${
                isActive
                  ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm'
                  : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-700 dark:hover:text-zinc-200'
              }`}
              aria-current={isActive ? 'page' : undefined}
              title={collapsed ? item.label : undefined}
            >
              <span className="relative shrink-0">
                {item.icon}
                {item.badge && (
                  <span className="absolute -top-1 -right-2 min-w-[16px] h-4 px-1 flex items-center justify-center text-[9px] font-bold accent-bg text-white rounded-full">
                    {item.badge}
                  </span>
                )}
              </span>
              {!collapsed && <span className="truncate">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Bottom Actions */}
      <div className="px-2 py-3 border-t border-zinc-100 dark:border-zinc-800 space-y-1">
        <button
          onClick={toggleTheme}
          className={`w-full flex items-center gap-3 py-2 rounded-xl text-sm text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors ${
            collapsed ? 'justify-center px-2' : 'px-3'
          }`}
          title={isDarkMode ? 'Light Mode' : 'Dark Mode'}
        >
          {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
          {!collapsed && <span>{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>}
        </button>
        {/* Accent Color Picker */}
        {onAccentChange && (
          collapsed ? (
            <div className="relative group/accent">
              <button
                className="w-full flex justify-center py-2 rounded-xl text-sm text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors px-2"
                title="Accent Color"
              >
                <Palette size={18} />
              </button>
              <div className="hidden group-hover/accent:flex absolute left-full ml-2 top-0 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-2 gap-1 shadow-lg z-50">
                {ACCENT_COLORS.map(c => (
                  <button
                    key={c.name}
                    onClick={() => onAccentChange(c.name)}
                    className={`w-5 h-5 rounded-full ${c.bg} transition-transform ${accentColor === c.name ? 'ring-2 ring-offset-1 ring-offset-white dark:ring-offset-zinc-800 ring-zinc-400 scale-110' : 'hover:scale-110'}`}
                    title={c.name}
                    aria-label={`Set accent color to ${c.name}`}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 py-2 px-3">
              <Palette size={18} className="text-zinc-500 dark:text-zinc-400 shrink-0" />
              <div className="flex gap-1.5">
                {ACCENT_COLORS.map(c => (
                  <button
                    key={c.name}
                    onClick={() => onAccentChange(c.name)}
                    className={`w-4 h-4 rounded-full ${c.bg} transition-transform ${accentColor === c.name ? 'ring-2 ring-offset-1 ring-offset-white dark:ring-offset-zinc-900 ring-zinc-400 scale-110' : 'hover:scale-110'}`}
                    title={c.name}
                    aria-label={`Set accent color to ${c.name}`}
                  />
                ))}
              </div>
            </div>
          )
        )}
        {/* High Contrast Toggle */}
        {onHighContrastChange && (
          <button
            onClick={() => onHighContrastChange(!highContrast)}
            className={`w-full flex items-center gap-3 py-2 rounded-xl text-sm transition-colors ${
              collapsed ? 'justify-center px-2' : 'px-3'
            } ${
              highContrast
                ? 'text-zinc-900 dark:text-white bg-zinc-100 dark:bg-zinc-800'
                : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-700 dark:hover:text-zinc-200'
            }`}
            title={highContrast ? 'Disable high contrast' : 'Enable high contrast'}
            aria-pressed={highContrast}
          >
            <Contrast size={18} />
            {!collapsed && <span>{highContrast ? 'High Contrast' : 'High Contrast'}</span>}
          </button>
        )}
        {onOpenJobCenter && (
          <button
            onClick={onOpenJobCenter}
            className={`w-full flex items-center gap-3 py-2 rounded-xl text-sm text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors ${
              collapsed ? 'justify-center px-2' : 'px-3'
            }`}
            title="Job Center"
          >
            <span className="relative shrink-0 flex h-5 w-5 items-center justify-center">
              {hasActiveJob
                ? <Loader2 size={18} className="animate-spin text-[var(--accent-500)]" />
                : <Activity size={18} />}
              {jobBadgeCount > 0 && (
                <span className="absolute -top-1 -right-2 min-w-[14px] h-3.5 px-0.5 flex items-center justify-center text-[9px] font-bold bg-red-500 text-white rounded-full">
                  {jobBadgeCount}
                </span>
              )}
            </span>
            {!collapsed && (
              <div className="flex flex-1 items-center gap-2 overflow-hidden">
                <span className="truncate">Jobs</span>
                {hasActiveJob && (
                  <span className="ml-auto w-12 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700 shrink-0">
                    <span className="block h-1 accent-bg" style={{ width: `${activeJobPercent}%` }} />
                  </span>
                )}
              </div>
            )}
          </button>
        )}
        {onOpenCommandPalette && (
          <button
            onClick={onOpenCommandPalette}
            className={`w-full flex items-center gap-3 py-2 rounded-xl text-sm text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors ${
              collapsed ? 'justify-center px-2' : 'px-3'
            }`}
            title={`Open command palette (${commandModifier})`}
            aria-label={`Open command palette (${commandModifier})`}
          >
            <Command size={18} />
            {!collapsed && (
              <span className="flex flex-1 items-center justify-between gap-2">
                <span>Command</span>
                <kbd data-testid="cmd-palette-hint" className="rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-500 dark:text-zinc-400">
                  {commandModifier}
                </kbd>
              </span>
            )}
          </button>
        )}
        <button
          onClick={onOpenSettings}
          className={`w-full flex items-center gap-3 py-2 rounded-xl text-sm text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors ${
            collapsed ? 'justify-center px-2' : 'px-3'
          }`}
          title="Settings"
        >
          <Settings size={18} />
          {!collapsed && <span>Settings</span>}
        </button>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={`w-full flex items-center gap-3 py-2 rounded-xl text-sm text-zinc-400 dark:text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors ${
            collapsed ? 'justify-center px-2' : 'px-3'
          }`}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
        >
          {collapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
};

export default NavigationSidebar;
