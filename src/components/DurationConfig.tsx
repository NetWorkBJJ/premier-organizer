/**
 * DurationConfig Component
 * Configuration for random duration cuts
 */

import React from 'react';

interface DurationConfigProps {
  enabled: boolean;
  minSeconds: number;
  maxSeconds: number;
  onEnabledChange: (enabled: boolean) => void;
  onMinChange: (min: number) => void;
  onMaxChange: (max: number) => void;
  disabled?: boolean;
}

export function DurationConfig({
  enabled,
  minSeconds,
  maxSeconds,
  onEnabledChange,
  onMinChange,
  onMaxChange,
  disabled = false,
}: DurationConfigProps) {
  const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value) && value >= 0) {
      onMinChange(value);
    }
  };

  const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value) && value >= 0) {
      onMaxChange(value);
    }
  };

  const hasError = minSeconds > maxSeconds;

  return (
    <div className="duration-config">
      <div className="duration-config__header">
        <label className="duration-config__toggle">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onEnabledChange(e.target.checked)}
            disabled={disabled}
          />
          <span className="duration-config__toggle-label">
            Corte Aleatório de Duração
          </span>
        </label>
      </div>

      {enabled && (
        <div className="duration-config__inputs">
          <div className="duration-config__field">
            <label htmlFor="minDuration">Mínimo (s)</label>
            <input
              id="minDuration"
              type="number"
              min="0"
              max="60"
              step="0.5"
              value={minSeconds}
              onChange={handleMinChange}
              disabled={disabled}
              className={hasError ? 'duration-config__input--error' : ''}
            />
          </div>

          <div className="duration-config__separator">até</div>

          <div className="duration-config__field">
            <label htmlFor="maxDuration">Máximo (s)</label>
            <input
              id="maxDuration"
              type="number"
              min="0"
              max="60"
              step="0.5"
              value={maxSeconds}
              onChange={handleMaxChange}
              disabled={disabled}
              className={hasError ? 'duration-config__input--error' : ''}
            />
          </div>
        </div>
      )}

      {enabled && hasError && (
        <div className="duration-config__error">
          Mínimo deve ser menor ou igual ao máximo
        </div>
      )}

      {enabled && (
        <div className="duration-config__help">
          Aplica cortes aleatórios entre {minSeconds}s e {maxSeconds}s
          <br />
          <em>Nota: Aplicado a vídeos e imagens</em>
        </div>
      )}
    </div>
  );
}

export default DurationConfig;
