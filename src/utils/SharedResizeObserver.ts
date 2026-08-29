/** Resize callbacks keyed by the element they were registered for. */
const callbacks = new WeakMap<Element, () => void>();

let observer: ResizeObserver | null = null;
let observerCtor: typeof ResizeObserver | null = null;

/**
 * Returns the shared observer, rebuilding it if the global constructor changed
 * (which happens when a test stubs `ResizeObserver`).
 */
function getObserver(): ResizeObserver | null {
  const Ctor = globalThis.ResizeObserver;
  if (!Ctor) return null;

  if (!observer || observerCtor !== Ctor) {
    observer = new Ctor((entries) => {
      for (const entry of entries) {
        callbacks.get(entry.target)?.();
      }
    });
    observerCtor = Ctor;
  }

  return observer;
}

/**
 * Observes an element for size changes using a single process-wide ResizeObserver.
 *
 * One observer for the whole app keeps the browser from running a separate
 * observation loop per element, which matters when hundreds of bookshelf cards
 * are mounted at once. Only one callback is kept per element; registering a
 * second one for the same element replaces the first.
 *
 * @param element - The element to observe.
 * @param onResize - Called whenever the element's size changes.
 * @returns A function that stops observing the element.
 */
export function observeResize(element: Element, onResize: () => void): () => void {
  const shared = getObserver();
  if (!shared) return () => {};

  callbacks.set(element, onResize);
  shared.observe(element);

  return () => {
    callbacks.delete(element);
    shared.unobserve(element);
  };
}
