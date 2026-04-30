export function renderStartupFallback(reason: string): void {
  const root = document.getElementById('root');
  if (!root) return;

  if (root.querySelector('[data-startup-fallback="true"]')) return;

  root.innerHTML = `
    <div class="startup-fallback" data-startup-fallback="true">
      <div class="startup-fallback__card">
        <h1 class="startup-fallback__title">indiiOS</h1>
        <p class="startup-fallback__message">The app took too long to start.</p>
        <p class="startup-fallback__reason">${reason}</p>
        <button id="startup-reload" class="startup-fallback__reload" type="button">Reload App</button>
      </div>
    </div>`;

  root.querySelector<HTMLButtonElement>('#startup-reload')?.addEventListener('click', () => {
    window.location.reload();
  });
}
