/**
 * Preview Component
 * Shows the organized clips before applying
 */

import React from 'react';
import type { OrganizePreview } from '../services/organizer';
import { formatDuration } from '../utils/time';

interface PreviewProps {
  preview: OrganizePreview | null;
  loading?: boolean;
}

export function Preview({ preview, loading = false }: PreviewProps) {
  if (loading) {
    return (
      <div className="preview preview--loading">
        <div className="preview__spinner" />
        <span>Gerando preview...</span>
      </div>
    );
  }

  if (!preview) {
    return (
      <div className="preview preview--empty">
        <p>Configure as opções acima e clique em "Preview" para visualizar</p>
      </div>
    );
  }

  const { clips, totalDuration, takeStats, warnings } = preview;

  return (
    <div className="preview">
      {/* Statistics */}
      <div className="preview__stats">
        <div className="preview__stat">
          <span className="preview__stat-value">{takeStats.totalTakes}</span>
          <span className="preview__stat-label">Takes</span>
        </div>
        <div className="preview__stat">
          <span className="preview__stat-value">{takeStats.usedTakes}</span>
          <span className="preview__stat-label">Usados</span>
        </div>
        <div className="preview__stat">
          <span className="preview__stat-value">
            {formatDuration(totalDuration)}
          </span>
          <span className="preview__stat-label">Duração Total</span>
        </div>
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="preview__warnings">
          <h4>Avisos</h4>
          <ul>
            {warnings.map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Clip List */}
      {clips.length > 0 ? (
        <div className="preview__clips">
          <h4>Ordem dos Clips ({clips.length})</h4>
          <div className="preview__clip-list">
            {clips.map((clip, index) => (
              <div
                key={`${clip.takeNumber}-${index}`}
                className={`preview__clip preview__clip--${clip.type.toLowerCase()}`}
              >
                <span className="preview__clip-index">{index + 1}</span>
                <span className="preview__clip-take">Take {clip.takeNumber}</span>
                <span className="preview__clip-type">
                  {clip.type === 'V' ? '🎬' : '🖼️'}
                </span>
                <span className="preview__clip-duration">
                  {clip.plannedDuration
                    ? `${clip.plannedDuration.toFixed(1)}s`
                    : `${clip.originalDuration}s`}
                  {clip.plannedDuration && (
                    <span className="preview__clip-cut"> (cortado)</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="preview__empty-clips">
          <p>Nenhum clip para exibir</p>
          {warnings.length > 0 && (
            <p>Verifique os avisos acima para mais detalhes</p>
          )}
        </div>
      )}
    </div>
  );
}

export default Preview;
