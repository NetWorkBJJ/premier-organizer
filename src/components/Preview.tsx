/**
 * Preview Component
 * Shows the organized clips before applying with visual thumbnails
 */

import React, { useState } from 'react';
import type { OrganizePreview, OrganizedClip } from '../services/organizer';
import { formatDuration } from '../utils/time';

interface PreviewProps {
  preview: OrganizePreview | null;
  loading?: boolean;
}

/**
 * Extracts a short description from the full filename
 * "(TAKE 426) VIDEO Subject- Penny Brooks..." → "Penny Brooks..."
 */
function extractDescription(name: string): string {
  // Remove "(TAKE N)" prefix
  let desc = name.replace(/^\(TAKE\s*\d+\)\s*/i, '');
  // Remove "VIDEO " or "IMAGE " prefix
  desc = desc.replace(/^(VIDEO|IMAGE)\s*/i, '');
  // Remove "Subject-" or "Subject:" prefix
  desc = desc.replace(/^Subject[-:]\s*/i, '');
  // Truncate to reasonable length
  if (desc.length > 35) {
    desc = desc.substring(0, 32) + '...';
  }
  return desc || name.substring(0, 30);
}

/**
 * Single clip card component with thumbnail
 */
function ClipCard({ clip, index }: { clip: OrganizedClip; index: number }) {
  const [imgError, setImgError] = useState(false);
  const isVideo = clip.type === 'V';
  const description = extractDescription(clip.projectItem.name);

  return (
    <div className={`preview-card preview-card--${clip.type.toLowerCase()}`}>
      {/* Thumbnail area */}
      <div className="preview-card__thumb">
        {clip.mediaPath && !imgError ? (
          <img
            src={`file://${clip.mediaPath}`}
            alt={`Take ${clip.takeNumber}`}
            className="preview-card__img"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className={`preview-card__placeholder preview-card__placeholder--${clip.type.toLowerCase()}`}>
            <span className="preview-card__icon">{isVideo ? '🎬' : '🖼️'}</span>
          </div>
        )}
        {/* Index badge */}
        <span className="preview-card__index">{index + 1}</span>
        {/* Type badge */}
        <span className={`preview-card__type preview-card__type--${clip.type.toLowerCase()}`}>
          {isVideo ? 'V' : 'I'}
        </span>
        {/* Duration badge */}
        <span className="preview-card__duration">
          {clip.plannedDuration
            ? `${clip.plannedDuration.toFixed(1)}s`
            : `${clip.originalDuration}s`}
        </span>
      </div>
      {/* Info area */}
      <div className="preview-card__info">
        <span className="preview-card__take">Take {clip.takeNumber}</span>
        <span className="preview-card__desc" title={clip.projectItem.name}>
          {description}
        </span>
      </div>
    </div>
  );
}

export function Preview({ preview, loading = false }: PreviewProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

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
        {/* View mode toggle */}
        <div className="preview__view-toggle">
          <button
            className={`preview__view-btn ${viewMode === 'grid' ? 'preview__view-btn--active' : ''}`}
            onClick={() => setViewMode('grid')}
            title="Visualização em grade"
          >
            ▦
          </button>
          <button
            className={`preview__view-btn ${viewMode === 'list' ? 'preview__view-btn--active' : ''}`}
            onClick={() => setViewMode('list')}
            title="Visualização em lista"
          >
            ≡
          </button>
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

      {/* Clip Grid/List */}
      {clips.length > 0 ? (
        <div className="preview__clips">
          <h4>Ordem dos Clips ({clips.length})</h4>

          {viewMode === 'grid' ? (
            <div className="preview__grid">
              {clips.map((clip, index) => (
                <ClipCard
                  key={`${clip.takeNumber}-${index}`}
                  clip={clip}
                  index={index}
                />
              ))}
            </div>
          ) : (
            <div className="preview__clip-list">
              {clips.map((clip, index) => (
                <div
                  key={`${clip.takeNumber}-${index}`}
                  className={`preview__clip preview__clip--${clip.type.toLowerCase()}`}
                >
                  <span className="preview__clip-index">{index + 1}</span>
                  <span className="preview__clip-type-badge">
                    {clip.type === 'V' ? '🎬' : '🖼️'}
                  </span>
                  <span className="preview__clip-take">Take {clip.takeNumber}</span>
                  <span className="preview__clip-desc" title={clip.projectItem.name}>
                    {extractDescription(clip.projectItem.name)}
                  </span>
                  <span className="preview__clip-duration">
                    {clip.plannedDuration
                      ? `${clip.plannedDuration.toFixed(1)}s`
                      : `${clip.originalDuration}s`}
                    {clip.plannedDuration && (
                      <span className="preview__clip-cut"> ✂</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
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
