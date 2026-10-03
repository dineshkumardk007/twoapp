// Renders ambient textures and notes off the main thread (see renderer.ts).
// Asked for a recipe by name, it answers with the samples, handed over
// rather than copied. One job at a time: the next is sent when this answers.

import { renderRecipe, RecipeName } from './textures';

interface Job {
  name: RecipeName;
  args: unknown;
}

// The app's types describe a window; this is a worker. Only these two are used.
const scope = self as unknown as {
  onmessage: ((e: MessageEvent<Job>) => void) | null;
  postMessage(message: unknown, transfer: Transferable[]): void;
};

scope.onmessage = e => {
  try {
    const out = renderRecipe(e.data);
    scope.postMessage({ channels: out.channels, rate: out.rate }, out.channels.map(c => c.buffer));
  } catch (err) {
    scope.postMessage({ error: String(err) }, []);
  }
};
