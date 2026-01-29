/**
 * PatternEditor Component
 * Input for defining the interleaving pattern
 */

import React, { useState, useEffect } from 'react';
import { parsePattern, formatPattern, PATTERN_PRESETS } from '../utils/pattern';

interface PatternEditorProps {
  value: string;
  onChange: (pattern: string) => void;
  disabled?: boolean;
}

export function PatternEditor({
  value,
  onChange,
  disabled = false,
}: PatternEditorProps) {
  const [inputValue, setInputValue] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string>('');

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    const result = parsePattern(inputValue);
    if (result.isValid) {
      setError(null);
      // Show first 10 items of expanded pattern
      const previewPattern = result.pattern.slice(0, 10);
      const hasMore = result.pattern.length > 10;
      setPreview(previewPattern.join(' → ') + (hasMore ? ' ...' : ''));
    } else {
      setError(result.error || 'Padrão inválido');
      setPreview('');
    }
  }, [inputValue]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onChange(newValue);
  };

  const handlePresetClick = (preset: string) => {
    setInputValue(preset);
    onChange(preset);
  };

  return (
    <div className="pattern-editor">
      <label className="pattern-editor__label">Padrão de Intercalação</label>

      <div className="pattern-editor__presets">
        {Object.entries(PATTERN_PRESETS).map(([name, preset]) => (
          <button
            key={name}
            className={`pattern-editor__preset ${
              inputValue === preset ? 'pattern-editor__preset--active' : ''
            }`}
            onClick={() => handlePresetClick(preset)}
            disabled={disabled}
            type="button"
          >
            {preset}
          </button>
        ))}
      </div>

      <input
        type="text"
        className={`pattern-editor__input ${
          error ? 'pattern-editor__input--error' : ''
        }`}
        value={inputValue}
        onChange={handleChange}
        placeholder="Ex: 2V,1I ou V,I,V,I"
        disabled={disabled}
      />

      {error && <div className="pattern-editor__error">{error}</div>}

      {preview && (
        <div className="pattern-editor__preview">
          <span className="pattern-editor__preview-label">Preview:</span>
          <span className="pattern-editor__preview-value">{preview}</span>
        </div>
      )}

      <div className="pattern-editor__help">
        <strong>V</strong> = Vídeo, <strong>I</strong> = Imagem
        <br />
        Formatos aceitos: "V,I" ou "2V,1I" ou "VVI"
      </div>
    </div>
  );
}

export default PatternEditor;
