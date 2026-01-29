/**
 * Premier Organizer - Main App Component
 */

import React, { useState, useEffect, useCallback } from 'react';
import { BinSelector, PatternEditor, DurationConfig, Preview } from './components';
import {
  getAllBins,
  getClipsFromBin,
  isPremiereReady,
  type BinInfo,
  type ClipInfo,
} from './services/premiere';
import {
  createOrganizePreview,
  applyToTimeline,
  type OrganizePreview,
  type OrganizerConfig,
} from './services/organizer';

type AppStatus = 'idle' | 'loading' | 'ready' | 'applying' | 'error';

function App() {
  // Connection state
  const [status, setStatus] = useState<AppStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Bins state
  const [bins, setBins] = useState<BinInfo[]>([]);
  const [videoBin, setVideoBin] = useState<BinInfo | null>(null);
  const [imageBin, setImageBin] = useState<BinInfo | null>(null);

  // Clips state
  const [videoClips, setVideoClips] = useState<ClipInfo[]>([]);
  const [imageClips, setImageClips] = useState<ClipInfo[]>([]);

  // Configuration state
  const [pattern, setPattern] = useState('V,I');
  const [randomDurationEnabled, setRandomDurationEnabled] = useState(true);
  const [minDuration, setMinDuration] = useState(6);
  const [maxDuration, setMaxDuration] = useState(8);

  // Preview state
  const [preview, setPreview] = useState<OrganizePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Result state
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  // Check Premiere connection on mount
  useEffect(() => {
    const checkConnection = async () => {
      setStatus('loading');
      try {
        const ready = await isPremiereReady();
        if (ready) {
          const allBins = await getAllBins();
          setBins(allBins);
          setStatus('ready');
        } else {
          setStatus('error');
          setErrorMessage('Premiere Pro não está pronto. Abra um projeto primeiro.');
        }
      } catch (err) {
        setStatus('error');
        setErrorMessage(
          err instanceof Error ? err.message : 'Erro ao conectar com Premiere Pro'
        );
      }
    };

    checkConnection();
  }, []);

  // Load clips when bins change
  useEffect(() => {
    const loadClips = async () => {
      if (videoBin) {
        const clips = await getClipsFromBin(videoBin.item);
        setVideoClips(clips);
      } else {
        setVideoClips([]);
      }
    };
    loadClips();
  }, [videoBin]);

  useEffect(() => {
    const loadClips = async () => {
      if (imageBin) {
        const clips = await getClipsFromBin(imageBin.item);
        setImageClips(clips);
      } else {
        setImageClips([]);
      }
    };
    loadClips();
  }, [imageBin]);

  // Generate preview
  const handleGeneratePreview = useCallback(() => {
    if (!videoBin && !imageBin) {
      setErrorMessage('Selecione pelo menos um bin');
      return;
    }

    setPreviewLoading(true);
    setResultMessage(null);

    try {
      const config: OrganizerConfig = {
        videoItems: videoClips.map((c) => c.item),
        imageItems: imageClips.map((c) => c.item),
        pattern,
        randomDuration: {
          enabled: randomDurationEnabled,
          minSeconds: minDuration,
          maxSeconds: maxDuration,
        },
        videoTrackIndex: 0,
        audioTrackIndex: 0,
      };

      const previewResult = createOrganizePreview(config);
      setPreview(previewResult);
      setErrorMessage(null);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Erro ao gerar preview'
      );
    } finally {
      setPreviewLoading(false);
    }
  }, [
    videoBin,
    imageBin,
    videoClips,
    imageClips,
    pattern,
    randomDurationEnabled,
    minDuration,
    maxDuration,
  ]);

  // Apply to timeline
  const handleApply = useCallback(async () => {
    if (!preview || preview.clips.length === 0) {
      setErrorMessage('Gere um preview primeiro');
      return;
    }

    setStatus('applying');
    setResultMessage(null);

    try {
      const result = await applyToTimeline(preview, {
        videoTrackIndex: 0,
        audioTrackIndex: 0,
      });

      if (result.success) {
        setResultMessage(
          `Sucesso! ${result.clipsInserted} clips inseridos (${result.totalDuration.toFixed(1)}s)`
        );
      } else {
        setResultMessage(
          `Inseridos ${result.clipsInserted} clips com ${result.errors.length} erros`
        );
        if (result.errors.length > 0) {
          setErrorMessage(result.errors.join('\n'));
        }
      }

      setPreview(null);
      setStatus('ready');
    } catch (err) {
      setStatus('ready');
      setErrorMessage(
        err instanceof Error ? err.message : 'Erro ao aplicar na timeline'
      );
    }
  }, [preview]);

  // Refresh bins
  const handleRefresh = useCallback(async () => {
    setStatus('loading');
    try {
      const allBins = await getAllBins();
      setBins(allBins);
      setStatus('ready');
    } catch (err) {
      setStatus('error');
      setErrorMessage(
        err instanceof Error ? err.message : 'Erro ao atualizar bins'
      );
    }
  }, []);

  const isDisabled = status !== 'ready';
  const canPreview = (videoBin || imageBin) && !isDisabled;
  const canApply = preview && preview.clips.length > 0 && !isDisabled;

  return (
    <div className="app">
      <header className="app__header">
        <h1>Premier Organizer</h1>
        <button
          className="app__refresh-btn"
          onClick={handleRefresh}
          disabled={status === 'loading'}
          title="Atualizar bins"
        >
          ↻
        </button>
      </header>

      {/* Status Messages */}
      {status === 'loading' && (
        <div className="app__status app__status--loading">Carregando...</div>
      )}

      {status === 'error' && (
        <div className="app__status app__status--error">{errorMessage}</div>
      )}

      {status === 'applying' && (
        <div className="app__status app__status--applying">
          Aplicando na timeline...
        </div>
      )}

      {errorMessage && status === 'ready' && (
        <div className="app__error">{errorMessage}</div>
      )}

      {resultMessage && (
        <div className="app__result">{resultMessage}</div>
      )}

      {/* Main Content */}
      <main className="app__content">
        {/* Bin Selection */}
        <section className="app__section">
          <h2>1. Selecionar Bins</h2>
          <BinSelector
            label="Bin de Vídeos"
            bins={bins}
            selectedBin={videoBin}
            onSelect={setVideoBin}
            disabled={isDisabled}
          />
          <BinSelector
            label="Bin de Imagens"
            bins={bins}
            selectedBin={imageBin}
            onSelect={setImageBin}
            disabled={isDisabled}
          />
        </section>

        {/* Pattern Configuration */}
        <section className="app__section">
          <h2>2. Padrão de Intercalação</h2>
          <PatternEditor
            value={pattern}
            onChange={setPattern}
            disabled={isDisabled}
          />
        </section>

        {/* Duration Configuration */}
        <section className="app__section">
          <h2>3. Duração</h2>
          <DurationConfig
            enabled={randomDurationEnabled}
            minSeconds={minDuration}
            maxSeconds={maxDuration}
            onEnabledChange={setRandomDurationEnabled}
            onMinChange={setMinDuration}
            onMaxChange={setMaxDuration}
            disabled={isDisabled}
          />
        </section>

        {/* Preview */}
        <section className="app__section">
          <h2>4. Preview</h2>
          <Preview preview={preview} loading={previewLoading} />
        </section>

        {/* Actions */}
        <section className="app__actions">
          <button
            className="app__btn app__btn--secondary"
            onClick={handleGeneratePreview}
            disabled={!canPreview || previewLoading}
          >
            {previewLoading ? 'Gerando...' : 'Preview'}
          </button>
          <button
            className="app__btn app__btn--primary"
            onClick={handleApply}
            disabled={!canApply}
          >
            Aplicar na Timeline
          </button>
        </section>
      </main>

      <footer className="app__footer">
        <small>Premier Organizer v1.0.0</small>
      </footer>
    </div>
  );
}

export default App;
