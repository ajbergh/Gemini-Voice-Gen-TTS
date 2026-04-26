/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AlertTriangle, CheckCircle, Edit2, Trash2, XCircle } from 'lucide-react';
import { deleteQcIssue, resolveQcIssue } from '../api';
import type { QcIssue, QcIssueSeverity, QcIssueStatus } from '../types';
import QcIssueDialog from './QcIssueDialog';

interface QcIssueListProps {
  issues: QcIssue[];
  projectId: number;
  segmentId: number;
  onIssuesChange: (updated: QcIssue[]) => void;
  isDarkMode?: boolean;
}

const SEVERITY_COLORS: Record<QcIssueSeverity, string> = {
  low: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  high: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

const STATUS_ICON: Record<QcIssueStatus, React.ReactNode> = {
  open: <AlertTriangle size={13} className="text-yellow-500" />,
  resolved: <CheckCircle size={13} className="text-green-500" />,
  wont_fix: <XCircle size={13} className="text-zinc-400" />,
};

export default function QcIssueList({
  issues,
  projectId,
  segmentId,
  onIssuesChange,
  isDarkMode = false,
}: QcIssueListProps) {
  const [editingIssue, setEditingIssue] = useState<QcIssue | null>(null);

  const handleResolve = async (issue: QcIssue) => {
    try {
      const updated = await resolveQcIssue(issue.id);
      onIssuesChange(issues.map(i => (i.id === updated.id ? updated : i)));
    } catch { /* ignore */ }
  };

  const handleDelete = async (issue: QcIssue) => {
    try {
      await deleteQcIssue(issue.id);
      onIssuesChange(issues.filter(i => i.id !== issue.id));
    } catch { /* ignore */ }
  };

  const handleSaveEdit = (updated: QcIssue) => {
    onIssuesChange(issues.map(i => (i.id === updated.id ? updated : i)));
    setEditingIssue(null);
  };

  if (issues.length === 0) return null;

  const rowBase = isDarkMode ? 'border-zinc-700/50 hover:bg-zinc-800/50' : 'border-zinc-100 hover:bg-zinc-50';

  return (
    <>
      <div className="space-y-1">
        {issues.map(issue => (
          <div
            key={issue.id}
            className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs group transition-colors ${rowBase}`}
          >
            {/* Status icon */}
            <span className="mt-0.5 shrink-0">{STATUS_ICON[issue.status]}</span>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold capitalize ${SEVERITY_COLORS[issue.severity]}`}>
                  {issue.severity}
                </span>
                <span className="opacity-70 capitalize">{issue.issue_type.replace(/_/g, ' ')}</span>
                {issue.time_offset_seconds != null && (
                  <span className="opacity-50">{issue.time_offset_seconds.toFixed(2)}s</span>
                )}
              </div>
              {issue.note && <p className="mt-0.5 opacity-80 break-words">{issue.note}</p>}
            </div>

            {/* Actions — visible on hover */}
            <div className="shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {issue.status === 'open' && (
                <button
                  onClick={() => handleResolve(issue)}
                  title="Resolve"
                  className="p-1 rounded hover:bg-green-100 dark:hover:bg-green-900/40 text-green-600"
                >
                  <CheckCircle size={13} />
                </button>
              )}
              <button
                onClick={() => setEditingIssue(issue)}
                title="Edit"
                className={`p-1 rounded ${isDarkMode ? 'hover:bg-zinc-700' : 'hover:bg-zinc-200'}`}
              >
                <Edit2 size={13} />
              </button>
              <button
                onClick={() => handleDelete(issue)}
                title="Delete"
                className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/40 text-red-500"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {editingIssue && (
        <QcIssueDialog
          projectId={projectId}
          segmentId={segmentId}
          issue={editingIssue}
          onSave={handleSaveEdit}
          onClose={() => setEditingIssue(null)}
          isDarkMode={isDarkMode}
        />
      )}
    </>
  );
}
