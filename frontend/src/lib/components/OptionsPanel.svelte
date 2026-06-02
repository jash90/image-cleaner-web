<script lang="ts">
  import { appState } from '$lib/stores/app.svelte';
  import type { BackgroundMethod } from '$lib/types/watermark';

  function handleLosslessChange(e: Event) {
    const target = e.target as HTMLInputElement;
    appState.setLossless(target.checked);
  }

  function handleMethodChange(method: BackgroundMethod) {
    appState.setBgMethod(method);
  }

  function handleToleranceChange(e: Event) {
    appState.setBgTolerance(parseInt((e.target as HTMLInputElement).value, 10));
  }

  function handleFeatherChange(e: Event) {
    appState.setBgFeather(parseInt((e.target as HTMLInputElement).value, 10));
  }

  function handleParallelChange(e: Event) {
    const target = e.target as HTMLInputElement;
    appState.setParallelProcessing(target.checked);
  }

  function handleMaxJobsChange(e: Event) {
    const target = e.target as HTMLSelectElement;
    appState.setMaxParallelJobs(parseInt(target.value, 10));
  }
</script>

<div class="options-panel">
  {#if appState.mode === 'watermark'}
    <label class="option">
      <input type="checkbox" checked={appState.lossless} onchange={handleLosslessChange} />
      <span class="checkmark"></span>
      <div class="option-content">
        <span class="option-label">Lossless output</span>
        <span class="option-description">
          Save as PNG instead of JPEG (larger file, no compression artifacts)
        </span>
      </div>
    </label>
  {:else}
    <div class="method-group">
      <span class="option-label">Method</span>
      <div class="method-options">
        <label class="radio">
          <input
            type="radio"
            name="bg-method"
            checked={appState.bgOptions.method === 'grabcut'}
            onchange={() => handleMethodChange('grabcut')}
          />
          <span class="radio-content">
            <span class="radio-label">GrabCut (subject box)</span>
            <span class="option-description">Best for complex scenes — box the subject to keep.</span>
          </span>
        </label>
        <label class="radio">
          <input
            type="radio"
            name="bg-method"
            checked={appState.bgOptions.method === 'colorkey'}
            onchange={() => handleMethodChange('colorkey')}
          />
          <span class="radio-content">
            <span class="radio-label">Colour key (solid background)</span>
            <span class="option-description">Removes a uniform background from the edges inward.</span>
          </span>
        </label>
      </div>
    </div>

    {#if appState.bgOptions.method === 'colorkey'}
      <div class="slider-row">
        <label for="tolerance">Tolerance <strong>{appState.bgOptions.tolerance}</strong></label>
        <input
          id="tolerance"
          type="range"
          min="4"
          max="120"
          step="1"
          value={appState.bgOptions.tolerance}
          oninput={handleToleranceChange}
        />
      </div>
    {/if}

    <div class="slider-row">
      <label for="feather">Edge feather <strong>{appState.bgOptions.feather}px</strong></label>
      <input
        id="feather"
        type="range"
        min="0"
        max="6"
        step="1"
        value={appState.bgOptions.feather}
        oninput={handleFeatherChange}
      />
    </div>

    <p class="png-note">Background removal always exports a transparent PNG.</p>
  {/if}

  {#if appState.isBatchMode}
    <div class="option-divider"></div>

    <label class="option">
      <input
        type="checkbox"
        checked={appState.parallelProcessing}
        onchange={handleParallelChange}
      />
      <span class="checkmark"></span>
      <div class="option-content">
        <span class="option-label">Parallel processing</span>
        <span class="option-description">
          Process multiple images at once (faster, uses more CPU)
        </span>
      </div>
    </label>

    {#if appState.parallelProcessing}
      <div class="sub-option">
        <label class="select-option">
          <span class="option-label">Concurrent jobs:</span>
          <select value={appState.maxParallelJobs} onchange={handleMaxJobsChange}>
            <option value={2}>2 images</option>
            <option value={3}>3 images</option>
            <option value={4}>4 images</option>
          </select>
        </label>
      </div>
    {/if}
  {/if}
</div>

<style>
  .options-panel {
    padding: 1rem;
    background: var(--color-surface, #1a2332);
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .option {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    cursor: pointer;
  }

  .option input[type='checkbox'] {
    display: none;
  }

  .checkmark {
    flex-shrink: 0;
    width: 20px;
    height: 20px;
    border: 2px solid var(--color-border, #3a4a5c);
    border-radius: 4px;
    background: transparent;
    transition: all 0.2s ease;
    position: relative;
  }

  .option input:checked + .checkmark {
    background: var(--color-primary, #6366f1);
    border-color: var(--color-primary, #6366f1);
  }

  .option input:checked + .checkmark::after {
    content: '';
    position: absolute;
    left: 6px;
    top: 2px;
    width: 5px;
    height: 10px;
    border: solid white;
    border-width: 0 2px 2px 0;
    transform: rotate(45deg);
  }

  .option-content {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .option-label {
    font-weight: 500;
    color: var(--color-text, #e2e8f0);
  }

  .option-description {
    font-size: 0.75rem;
    color: var(--color-text-muted, #8892a0);
  }

  .method-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .method-options {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .radio {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    cursor: pointer;
  }

  .radio input {
    margin-top: 0.2rem;
    accent-color: var(--color-primary, #6366f1);
  }

  .radio-content {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .radio-label {
    font-weight: 500;
    color: var(--color-text, #e2e8f0);
    font-size: 0.9rem;
  }

  .slider-row {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .slider-row label {
    font-size: 0.8125rem;
    color: var(--color-text-muted, #8892a0);
  }

  .slider-row strong {
    color: var(--color-text, #e2e8f0);
  }

  .slider-row input[type='range'] {
    width: 100%;
    accent-color: var(--color-primary, #6366f1);
  }

  .png-note {
    margin: 0;
    font-size: 0.75rem;
    color: var(--color-text-muted, #8892a0);
  }

  .option-divider {
    height: 1px;
    background: var(--color-border, #3a4a5c);
  }

  .sub-option {
    padding-left: 2rem;
  }

  .select-option {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .select-option .option-label {
    font-size: 0.875rem;
    color: var(--color-text-muted, #8892a0);
  }

  .select-option select {
    padding: 0.375rem 0.75rem;
    border: 1px solid var(--color-border, #3a4a5c);
    border-radius: 4px;
    background: var(--color-background, #0f1729);
    color: var(--color-text, #e2e8f0);
    font-size: 0.875rem;
    cursor: pointer;
  }

  .select-option select:focus {
    outline: none;
    border-color: var(--color-primary, #6366f1);
  }
</style>
