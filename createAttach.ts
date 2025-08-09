import { onCleanup } from "solid-js";

/* ---------------------------------------------------------------- *\
 * Types
\* ---------------------------------------------------------------- */

export type RefSetter<T extends HTMLElement = HTMLElement> = (el: T | undefined) => void | (() => void);
export type RawRef<T extends HTMLElement = HTMLElement> = T | RefSetter<T> | undefined;

export interface ReturnCreateAttach<T extends HTMLElement = HTMLElement> {
  /** Callback-ref to drop in JSX: `<div ref={attach} />` */
  attach: RefSetter<T>;
  /** Current element or `undefined` if unmounted */
  attachment: () => T | undefined;
  /** Add a listener that fires every time the ref mounts or changes */
  onAttach(handler: RefSetter<T>, key?: string, once?: boolean): void;
  /** 
   * Detach handler(s) and optionally cleanup
   * - No args: cleanup everything
   * - String key: remove specific handler
   * - Options object: fine-grained control
   */
  detach(keyOrOptions?: string | {
    key?: string;
    clearEvents?: boolean;
    clearDefaultEvent?: boolean;
    eventsOnly?: boolean;
  }): boolean | void;
}

/* ---------------------------------------------------------------- *\
 * createAttach
\* ---------------------------------------------------------------- */

/**
 * Imperative-reactive callback-ref with listeners, `attachment()` accessor and `detach()`.
 * Bridges the gap between imperative DOM operations and reactive primitives.
 *
 * ```tsx
 * const { attach, attachment, onAttach, detach } = createAttach<HTMLDivElement>();
 * ```
 *
 * @param initialHandler initial listener (optional)
 * @param once set to `true` to run the initial listener only on first mount
 */
export function createAttach<T extends HTMLElement = HTMLElement>(
  initialHandler?: RefSetter<T>,
  once: boolean = false
): ReturnCreateAttach<T> {

  /* ----------  Internal state  ------------------------------------- */
  type EventData = {
    func: RefSetter<T>;
    once: boolean;
    cleanupFn?: () => void;
  };

  let element_: T | undefined;
  let listeners: Map<string, EventData> | undefined = initialHandler
    ? new Map([["default", { func: initialHandler, once }]])
    : undefined;

  /* ----------  JSX ref callback  ----------------------------------- */
  const attach: RefSetter<T> = (el) => {
    if (el === element_ || !globalThis.document) return;

    if (element_ && listeners) {
      for (const data of listeners.values()) data.cleanupFn?.();
    }

    element_ = el;
    if (!listeners) return;

    for (const [key, data] of listeners.entries()) {
      const maybeCleanup = data.func(el);
      if (typeof maybeCleanup === "function") data.cleanupFn = maybeCleanup;

      if (data.once) {
        data.cleanupFn?.();
        listeners.delete(key);
      }
    }
  };

  /* ----------  Public helpers  ------------------------------------- */
  const attachment = () => element_;

  function onAttach(
    handler: RefSetter<T>,
    key: string = "default",
    once: boolean = false
  ): void {
    listeners?.get(key)?.cleanupFn?.();

    const data: EventData = { func: handler, once };
    if (listeners) listeners.set(key, data);
    else listeners = new Map([[key, data]]);
  }

  /* ----------  Unified detach function  ----------------------------- */
  function detach(keyOrOptions?: string | {
    key?: string;
    clearEvents?: boolean;
    clearDefaultEvent?: boolean;
    eventsOnly?: boolean;
  }): boolean | void {
    // No args = cleanup everything
    if (!keyOrOptions) {
      if (listeners) {
        for (const data of listeners.values()) data.cleanupFn?.();
        listeners = undefined;
      }
      element_ = undefined;
      return;
    }

    // Helper to remove a single handler
    const removeHandler = (handlerKey: string) => {
      listeners?.get(handlerKey)?.cleanupFn?.();
      return listeners ? listeners.delete(handlerKey) : false;
    };

    // String key = remove specific handler
    if (typeof keyOrOptions === "string") {
      return removeHandler(keyOrOptions);
    }

    // Options object = fine-grained control
    const { key, clearEvents = true, clearDefaultEvent = true, eventsOnly = false } = keyOrOptions;
    
    // If key is provided, just remove that specific handler
    if (key) {
      return removeHandler(key);
    }

    // Otherwise do cleanup based on options
    if (eventsOnly && !clearEvents && !clearDefaultEvent) {
      throw new Error(
        "Incompatible parameters: 'eventsOnly=true' requires either 'clearEvents=true' OR 'clearDefaultEvent=true'"
      );
    }

    if (listeners) {
      for (const [k, data] of listeners) {
        if (clearEvents || (clearDefaultEvent && k === "default")) {
          data.cleanupFn?.();
        }
      }

      if (clearEvents && clearDefaultEvent) {
        listeners = undefined;
      } else if (clearEvents && !clearDefaultEvent) {
        const def = listeners.get("default");
        listeners = def ? new Map([["default", { ...def }]]) : undefined;
      } else if (clearDefaultEvent) {
        listeners.delete("default");
      }
    }

    if (!eventsOnly) element_ = undefined;
  }

  /* ----------  Auto-cleanup when owner disposes  -------------------- */
  onCleanup(() => detach());

  return {
    attach,
    attachment,
    onAttach,
    detach,
  };
}

/* ---------------------------------------------------------------- *\
 * Extra helpers
\* ---------------------------------------------------------------- */

/** Execute `fn(...args)` only if `fn` is a function; otherwise return `false`. */
export function exeIsFunc<T extends (...args: unknown[]) => unknown>(
  fn: T,
  ...args: Parameters<T>
): ReturnType<T>;
export function exeIsFunc(fn: unknown, ...args: unknown[]): false;
export function exeIsFunc(fn: unknown, ...args: unknown[]): unknown {
  return fn && typeof fn === "function" ? fn(...args) : false;
}

/** Combine two refs into one (calls both). */
export function RefRef<
  A extends HTMLElement = HTMLElement,
  B extends HTMLElement = HTMLElement
>(aRef: RawRef<A>, bRef: RawRef<B>): RefSetter<A> {
  return (el) => {
    exeIsFunc(aRef, el as A);
    exeIsFunc(bRef, el as unknown as B);
  };
}