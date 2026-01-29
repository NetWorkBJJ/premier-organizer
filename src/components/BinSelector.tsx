/**
 * BinSelector Component
 * Dropdown for selecting video and image bins
 */

import React from 'react';
import type { BinInfo } from '../services/premiere';

interface BinSelectorProps {
  label: string;
  bins: BinInfo[];
  selectedBin: BinInfo | null;
  onSelect: (bin: BinInfo | null) => void;
  loading?: boolean;
  disabled?: boolean;
}

export function BinSelector({
  label,
  bins,
  selectedBin,
  onSelect,
  loading = false,
  disabled = false,
}: BinSelectorProps) {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === '') {
      onSelect(null);
    } else {
      const bin = bins.find((b) => b.path === value);
      onSelect(bin || null);
    }
  };

  return (
    <div className="bin-selector">
      <label className="bin-selector__label">{label}</label>
      <select
        className="bin-selector__select"
        value={selectedBin?.path || ''}
        onChange={handleChange}
        disabled={disabled || loading}
      >
        <option value="">
          {loading ? 'Carregando...' : 'Selecione um bin'}
        </option>
        {bins.map((bin) => (
          <option key={bin.path} value={bin.path}>
            {bin.path} ({bin.itemCount} itens)
          </option>
        ))}
      </select>
      {selectedBin && (
        <div className="bin-selector__info">
          {selectedBin.itemCount} arquivos encontrados
        </div>
      )}
    </div>
  );
}

export default BinSelector;
