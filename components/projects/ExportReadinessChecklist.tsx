/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Volume2 } from 'lucide-react';
import { ExportReadiness } from './exportReadiness';

interface ExportReadinessChecklistProps {
  readiness: ExportReadiness;
  renderingMissingAudio?: boolean;
  onRenderMissingAudio?: () => void;
  onGoToReview?: () => void;
  onOpenQcIssues?: () => void;
}

const ExportReadinessChecklist: React.FC<ExportReadinessChecklistProps> = ({
  readiness,
  renderingMissingAudio = false,
  onRenderMissingAudio,
  onGoToReview,
  onOpenQcIssues,
}) => {
  const hasItems = readiness.blockers.length > 0 || readiness.warnings.length > 0;

  return (
    <div className={`rounded-xl border px-4 py-3 ${
      readiness.canExport
        ? 'border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/20'
        : 'border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20'
    }`}>
      <div className="flex items-start gap-3">
        {readiness.canExport
          ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        }
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-semibold ${
            readiness.canExport
              ? 'text-emerald-800 dark:text-emerald-200'
              : 'text-amber-800 dark:text-amber-200'
          }`}>
            {readiness.canExport ? 'Export ready' : 'Export readiness'}
          </p>
          <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-300">
            {readiness.renderedCount} rendered, {readiness.approvedCount} approved, {readiness.openQcCount} open QC.
          </p>

          {hasItems && (
            <div className="mt-2 space-y-1">
              {[...readiness.blockers, ...readiness.warnings].map(item => (
                <div key={item.id} className="flex items-start justify-between gap-2 text-xs text-zinc-700 dark:text-zinc-200">
                  <span className="min-w-0">{item.label}</span>
                  {item.action === 'render_missing' && onRenderMissingAudio && (
                    <button
                      type="button"
                      onClick={onRenderMissingAudio}
                      disabled={renderingMissingAudio}
                      className="inline-flex h-6 shrink-0 items-center gap-1 rounded-md bg-zinc-900 dark:bg-[var(--accent-600)] px-2 text-[10px] font-semibold text-white disabled:opacity-50"
                    >
                      {renderingMissingAudio ? <Loader2 size={11} className="animate-spin" /> : <Volume2 size={11} />}
                      Render
                    </button>
                  )}
                  {item.action === 'go_review' && onGoToReview && (
                    <button
                      type="button"
                      onClick={onGoToReview}
                      className="h-6 shrink-0 rounded-md border border-zinc-200 dark:border-zinc-700 px-2 text-[10px] font-semibold text-zinc-600 dark:text-zinc-300"
                    >
                      Review
                    </button>
                  )}
                  {item.action === 'open_qc' && onOpenQcIssues && (
                    <button
                      type="button"
                      onClick={onOpenQcIssues}
                      className="h-6 shrink-0 rounded-md border border-zinc-200 dark:border-zinc-700 px-2 text-[10px] font-semibold text-zinc-600 dark:text-zinc-300"
                    >
                      QC
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExportReadinessChecklist;
