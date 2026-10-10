<script lang="ts">
  import '../app.css';

  let { children } = $props();
</script>

<svelte:head>
  <title>Image Cleaner — Watermark &amp; Background Remover</title>
  <meta
    name="description"
    content="Remove watermarks and backgrounds from images right in your browser with classical computer vision. No AI, no upload, no API key."
  />
</svelte:head>

<div class="app-layout">
  <header class="app-header">
    <div class="container header-content">
      <h1 class="logo">
        <svg class="logo-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21,15 16,10 5,21" />
        </svg>
        Image Cleaner
      </h1>

      <div class="header-right">
        <span class="badge">100% in your browser · no AI</span>
      </div>
    </div>
  </header>

  <main class="app-main">
    <div class="container">
      {@render children()}
    </div>
  </main>

  <footer class="app-footer">
    <div class="container">
      <p>Classical computer vision (OpenCV.js) · Built with Svelte 5</p>
    </div>
  </footer>
</div>

<style>
  .app-layout {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
  }

  .app-header {
    background: var(--color-surface);
    border-bottom: 1px solid var(--color-border);
    padding: 1rem 0;
  }

  .header-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .logo {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--color-text);
  }

  .logo-icon {
    width: 28px;
    height: 28px;
    color: var(--color-primary);
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .badge {
    font-size: 0.75rem;
    color: var(--color-text-muted);
    border: 1px solid var(--color-border);
    border-radius: 999px;
    padding: 0.25rem 0.75rem;
  }

  .app-main {
    flex: 1;
    padding: 2rem 0;
  }

  .app-footer {
    background: var(--color-surface);
    border-top: 1px solid var(--color-border);
    padding: 1rem 0;
    text-align: center;
  }

  .app-footer p {
    margin: 0;
    font-size: 0.75rem;
    color: var(--color-text-muted);
  }
</style>
