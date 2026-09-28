import './ui/style.css';
import { Poki } from './poki/poki.ts';
import { registerLanguages } from './i18n/index.ts';
import { Game } from './game/game.ts';

async function boot(): Promise<void> {
  registerLanguages();
  const host = document.getElementById('game')!;
  // Block page scrolling and zoom gestures inside the iframe.
  const stop = (e: Event): void => e.preventDefault();
  document.addEventListener('touchmove', stop, { passive: false });
  document.addEventListener('gesturestart', stop);
  document.addEventListener('contextmenu', stop);
  window.addEventListener('wheel', stop, { passive: false });

  await Poki.init(import.meta.env.DEV);
  const game = new Game(host);
  await game.init();
  Poki.loadingFinished();
  if (import.meta.env.DEV) (await import('./dev.ts')).installDevTools(game);
}

void boot();
