<script lang="ts">
  import { appState } from '$lib/stores/app.svelte';
  import { processImage } from '$lib/processing/processor';
  import ImageDropZone from '$lib/components/ImageDropZone.svelte';
  import RegionSelector from '$lib/components/RegionSelector.svelte';
  import PreviewPanel from '$lib/components/PreviewPanel.svelte';
  import OptionsPanel from '$lib/components/OptionsPanel.svelte';
  import ModeToggle from '$lib/components/ModeToggle.svelte';
  import BatchQueuePanel from '$lib/components/BatchQueuePanel.svelte';
  import ErrorMessage from '$lib/components/ErrorMessage.svelte';
  import Spinner from '$lib/components/Spinner.svelte';
  import type { WatermarkRegion } from '$lib/types/watermark';

  let imageWidth = $state(0);
  let imageHeight = $state(0);

  // Load image dimensions when file changes
  $effect(() => {
    if (appState.imagePreviewUrl) {
      const img = new Image();
      img.onload = () => {
        imageWidth = img.naturalWidth;
        imageHeight = img.naturalHeight;
      };
      img.src = appState.imagePreviewUrl;
    }
  });

  const params = () => ({
    lossless: appState.lossless,
    bgOptions: appState.bgOptions,
  });

  // Mode-aware instruction for the region selector.
  const selectorInstruction = $derived(
    appState.mode === 'watermark'
      ? 'Click and drag a box over the watermark to erase it'
      : appState.bgOptions.method === 'grabcut'
        ? 'Click and drag a box around the subject you want to keep'
        : 'Colour-key removes the edge background automatically — no box needed'
  );

  const regionOptional = $derived(
    appState.mode === 'background' && appState.bgOptions.method === 'colorkey'
  );

  const actionLabel = $derived(
    appState.mode === 'watermark' ? 'Remove Watermark' : 'Remove Background'
  );

  function handleRegionChange(region: WatermarkRegion | null) {
    appState.setRegion(region);
  }

  async function handleProcess() {
    if (!appState.currentFile) return;

    appState.setProcessing(true);
    appState.stage = 'processing';

    try {
      const result = await processImage(
        appState.currentFile,
        appState.mode,
        appState.region,
        params()
      );
      appState.setResult(result);
    } catch (error) {
      appState.setError(error instanceof Error ? error.message : 'Processing failed');
      appState.stage = 'select';
    }
  }

  async function handleBatchProcess() {
    if (appState.batchFiles.length === 0) return;

    if (appState.parallelProcessing) {
      await handleBatchProcessParallel();
    } else {
      await handleBatchProcessSequential();
    }
  }

  async function handleBatchProcessSequential() {
    appState.startBatchProcessing();

    for (let i = 0; i < appState.batchFiles.length; i++) {
      const batchFile = appState.batchFiles[i];

      appState.setBatchProgress({
        currentIndex: i,
        totalFiles: appState.batchFiles.length,
        currentFilename: batchFile.filename,
      });

      appState.updateBatchFile(batchFile.id, { status: 'processing' });

      try {
        const result = await processImage(
          batchFile.file,
          appState.mode,
          appState.region,
          params()
        );
        appState.updateBatchFile(batchFile.id, { status: 'completed', result });
      } catch (error) {
        appState.updateBatchFile(batchFile.id, {
          status: 'failed',
          error: error instanceof Error ? error.message : 'Processing failed',
        });
      }
    }

    appState.finishBatchProcessing();
  }

  async function handleBatchProcessParallel() {
    appState.startBatchProcessing();

    const pendingFiles = [...appState.batchFiles];
    const maxJobs = appState.maxParallelJobs;
    let completedCount = 0;

    const processFile = async (batchFile: (typeof pendingFiles)[0]) => {
      appState.updateBatchFile(batchFile.id, { status: 'processing' });
      appState.setActiveJobs(appState.activeJobs + 1);

      try {
        const result = await processImage(
          batchFile.file,
          appState.mode,
          appState.region,
          params()
        );
        appState.updateBatchFile(batchFile.id, { status: 'completed', result });
      } catch (error) {
        appState.updateBatchFile(batchFile.id, {
          status: 'failed',
          error: error instanceof Error ? error.message : 'Processing failed',
        });
      } finally {
        appState.setActiveJobs(Math.max(0, appState.activeJobs - 1));
        completedCount++;
        appState.setBatchProgress({
          currentIndex: completedCount,
          totalFiles: pendingFiles.length,
          currentFilename: `${completedCount}/${pendingFiles.length} completed`,
        });
      }
    };

    for (let i = 0; i < pendingFiles.length; i += maxJobs) {
      const chunk = pendingFiles.slice(i, i + maxJobs);
      appState.setBatchProgress({
        currentIndex: i,
        totalFiles: pendingFiles.length,
        currentFilename: `Processing ${chunk.length} files in parallel...`,
      });
      await Promise.all(chunk.map(processFile));
    }

    appState.setActiveJobs(0);
    appState.finishBatchProcessing();
  }

  function handleReset() {
    appState.reset();
  }

  function handleBack() {
    appState.goBack();
  }
</script>

<div class="page-content">
  {#if appState.error}
    <ErrorMessage message={appState.error} onDismiss={() => appState.setError(null)} />
  {/if}

  {#if appState.stage === 'upload'}
    <div class="upload-section">
      <h2>Remove watermarks &amp; backgrounds — without AI</h2>
      <p class="subtitle">
        Everything runs locally in your browser using classical computer vision. No upload, no
        account, no API key.
      </p>
      <ModeToggle />
      <ImageDropZone />
    </div>

  {:else if appState.stage === 'select' || appState.stage === 'batch-select'}
    <div class="selection-section">
      <div class="section-header">
        <button class="btn btn-secondary" onclick={handleBack}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15,18 9,12 15,6" />
          </svg>
          Back
        </button>
        <h2>{appState.mode === 'watermark' ? 'Select Watermark Region' : 'Select Subject / Background'}</h2>
        <div class="spacer"></div>
      </div>

      <ModeToggle />

      {#if appState.imagePreviewUrl && imageWidth > 0}
        <div class="selector-wrapper">
          <!-- Remount on mode change: the box means "erase" in one mode and
               "keep" in the other, so a mode switch starts a fresh selection. -->
          {#key appState.mode}
            <RegionSelector
              imageUrl={appState.imagePreviewUrl}
              {imageWidth}
              {imageHeight}
              onRegionChange={handleRegionChange}
              initialRegion={appState.region}
              instruction={selectorInstruction}
            />
          {/key}
        </div>
      {/if}

      <div class="controls-panel">
        <OptionsPanel />

        {#if appState.region}
          <div class="region-info">
            Selected region: {Math.round(appState.region.width)} x {Math.round(appState.region.height)} pixels
            at ({Math.round(appState.region.x)}, {Math.round(appState.region.y)})
          </div>
        {:else if regionOptional}
          <div class="region-info">No box needed — the background colour is sampled from the edges.</div>
        {/if}

        <div class="action-buttons">
          {#if appState.isBatchMode}
            <button
              class="btn btn-primary"
              disabled={!appState.canProcess}
              onclick={handleBatchProcess}
            >
              Process {appState.batchFiles.length} Files
            </button>
          {:else}
            <button
              class="btn btn-primary"
              disabled={!appState.canProcess}
              onclick={handleProcess}
            >
              {actionLabel}
            </button>
          {/if}
        </div>
      </div>
    </div>

  {:else if appState.stage === 'processing'}
    <div class="processing-section">
      <Spinner size="lg" message="Processing your image…" />
    </div>

  {:else if appState.stage === 'preview' && appState.result && appState.imagePreviewUrl}
    <div class="preview-section">
      <div class="section-header">
        <button class="btn btn-secondary" onclick={handleReset}>
          Process Another Image
        </button>
        <h2>Result</h2>
        <div class="spacer"></div>
      </div>

      <PreviewPanel
        originalUrl={appState.imagePreviewUrl}
        result={appState.result}
      />
    </div>

  {:else if appState.stage === 'batch-processing' || appState.stage === 'batch-results'}
    <div class="batch-section">
      <div class="section-header">
        {#if appState.stage === 'batch-results'}
          <button class="btn btn-secondary" onclick={handleReset}>
            Process More Images
          </button>
        {:else}
          <div class="spacer"></div>
        {/if}
        <h2>Batch Processing</h2>
        <div class="spacer"></div>
      </div>

      {#if appState.isProcessing}
        <Spinner size="md" message="Processing batch…" />
      {/if}

      <BatchQueuePanel />
    </div>
  {/if}
</div>

<style>
  .page-content {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .upload-section {
    text-align: center;
    max-width: 600px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .upload-section h2 {
    margin: 0;
    font-size: 1.75rem;
    color: var(--color-text);
  }

  .subtitle {
    margin: 0 0 0.5rem;
    color: var(--color-text-muted);
  }

  .selection-section,
  .preview-section,
  .batch-section {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .section-header h2 {
    margin: 0;
    font-size: 1.25rem;
    color: var(--color-text);
  }

  .spacer {
    width: 100px;
  }

  .selector-wrapper {
    background: var(--color-surface);
    border-radius: 12px;
    padding: 1.5rem;
    min-height: 400px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .controls-panel {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .region-info {
    font-size: 0.875rem;
    color: var(--color-text-muted);
    text-align: center;
  }

  .action-buttons {
    display: flex;
    justify-content: center;
    gap: 1rem;
  }

  .action-buttons .btn {
    min-width: 200px;
  }

  .processing-section {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 400px;
  }

  .btn svg {
    flex-shrink: 0;
  }
</style>
