<script lang="ts">
  import { appState } from '$lib/stores/app.svelte';
  import type { ProcessMode } from '$lib/types/watermark';

  const modes: { value: ProcessMode; label: string }[] = [
    { value: 'watermark', label: 'Remove Watermark' },
    { value: 'background', label: 'Remove Background' },
  ];

  let buttons: HTMLButtonElement[] = [];

  function select(mode: ProcessMode) {
    appState.setMode(mode);
  }

  // Radio-group keyboard pattern: arrow keys move the selection and focus.
  function handleKeydown(e: KeyboardEvent, index: number) {
    let next: number;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      next = (index + 1) % modes.length;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      next = (index - 1 + modes.length) % modes.length;
    } else {
      return;
    }
    e.preventDefault();
    select(modes[next].value);
    buttons[next]?.focus();
  }
</script>

<div class="mode-toggle" role="radiogroup" aria-label="Processing mode">
  {#each modes as m, i (m.value)}
    <button
      bind:this={buttons[i]}
      type="button"
      role="radio"
      aria-checked={appState.mode === m.value}
      tabindex={appState.mode === m.value ? 0 : -1}
      class="mode-btn"
      class:active={appState.mode === m.value}
      onclick={() => select(m.value)}
      onkeydown={(e) => handleKeydown(e, i)}
    >
      {m.label}
    </button>
  {/each}
</div>

<style>
  .mode-toggle {
    display: inline-flex;
    align-self: center;
    gap: 0.25rem;
    padding: 0.25rem;
    background: var(--color-surface, #1a2332);
    border: 1px solid var(--color-border, #3a4a5c);
    border-radius: 10px;
  }

  .mode-btn {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 7px;
    background: transparent;
    color: var(--color-text-muted, #8892a0);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .mode-btn:hover {
    color: var(--color-text, #e2e8f0);
  }

  .mode-btn.active {
    background: var(--color-primary, #6366f1);
    color: white;
  }

  .mode-btn:focus-visible {
    outline: 2px solid var(--color-primary, #6366f1);
    outline-offset: 2px;
  }
</style>
