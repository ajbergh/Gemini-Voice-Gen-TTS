/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Building2, Pen, Trash2, Plus, ChevronRight } from 'lucide-react';
import type { Client } from '../types';

interface ClientWorkspaceListProps {
  clients: Client[];
  selectedClientId?: number;
  onSelect: (client: Client) => void;
  onEdit: (client: Client) => void;
  onDelete: (client: Client) => void;
  onCreateNew: () => void;
  isDarkMode?: boolean;
}

export default function ClientWorkspaceList({
  clients,
  selectedClientId,
  onSelect,
  onEdit,
  onDelete,
  onCreateNew,
  isDarkMode,
}: ClientWorkspaceListProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between mb-1 px-1">
        <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
          Clients
        </h2>
        <button
          onClick={onCreateNew}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium
            bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400
            transition-colors"
          aria-label="New client"
        >
          <Plus size={13} />
          New
        </button>
      </div>

      {clients.length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 gap-3 text-zinc-400 dark:text-zinc-500">
          <Building2 size={32} className="opacity-30" />
          <p className="text-sm">No clients yet.</p>
          <button
            onClick={onCreateNew}
            className="px-4 py-2 rounded-xl text-sm font-medium
              bg-blue-500 hover:bg-blue-600 text-white transition-colors"
          >
            Create your first client
          </button>
        </div>
      )}

      {clients.map((client) => {
        const isSelected = client.id === selectedClientId;
        return (
          <div
            key={client.id}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(client)}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect(client)}
            aria-pressed={isSelected}
            aria-label={`Select client ${client.name}`}
            className={`group relative flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer
              border transition-all
              ${isSelected
                ? 'border-blue-500/40 bg-blue-500/10 dark:bg-blue-500/15'
                : 'border-transparent hover:border-zinc-200 dark:hover:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800/60'
              }`}
          >
            {/* Icon */}
            <div className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center
              ${isSelected
                ? 'bg-blue-500/20 text-blue-500 dark:text-blue-400'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
              }`}
            >
              <Building2 size={18} />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium truncate ${isSelected ? 'text-blue-700 dark:text-blue-300' : 'text-zinc-800 dark:text-zinc-200'}`}>
                {client.name}
              </p>
              {client.description && (
                <p className="text-xs text-zinc-400 dark:text-zinc-500 truncate mt-0.5">
                  {client.description}
                </p>
              )}
              {client.default_voice_name && (
                <span className="inline-flex items-center mt-1 px-1.5 py-0.5 rounded-md text-xs
                  bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300">
                  {client.default_voice_name}
                </span>
              )}
            </div>

            {/* Chevron / actions */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(client); }}
                className="p-1 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 dark:text-zinc-400 transition-colors"
                aria-label={`Edit ${client.name}`}
              >
                <Pen size={13} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(client); }}
                className="p-1 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-zinc-500 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                aria-label={`Delete ${client.name}`}
              >
                <Trash2 size={13} />
              </button>
            </div>
            {!isSelected && (
              <ChevronRight size={14} className="flex-shrink-0 text-zinc-300 dark:text-zinc-600 group-hover:opacity-0 transition-opacity" />
            )}
          </div>
        );
      })}
    </div>
  );
}
