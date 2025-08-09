/**
 * createBoolLazyFalse with traditional Solid.js approach
 * ======================================================
 * 
 * ## When traditional approach works well:
 * 
 * ### 1. **Direct & Transparent**
 * - Uses only standard Solid primitives
 * - Clear cause-and-effect in the code flow
 * - No additional abstractions to learn
 * 
 * ### 2. **Minimal Overhead**
 * - No extra bundle cost for coordination infrastructure
 * - Direct ref assignment and manual cleanup
 * 
 * ### 3. **Full Control**
 * - Complete control over timing and cleanup strategy
 * - Easy to optimize for specific scenarios
 * 
 * ## Trade-offs:
 * 
 * ### 1. **Manual Element Tracking**
 * - Must track element state and pending operations manually
 * - Uses arrays/variables to queue operations when element doesn't exist
 * - More explicit about timing and element availability
 * 
 * ### 2. **Limited Composition**
 * - Harder to combine multiple ref-based behaviors
 * - Each implementation tends to be self-contained
 * 
 * **Good for**: Simple scenarios, when you prefer direct control,
 * or when avoiding additional abstractions is important.
 */

import { Accessor, createEffect, createSignal, on, onCleanup } from "solid-js";

export enum BoolLazyFalseState { 
    FALSE, 
    BECOMING_FALSE, 
    TRUE 
}

type OnChange<T extends HTMLElement> = (open: boolean, el?: T | undefined) => void;

/**
 * Traditional implementation using standard Solid primitives
 */
export function createBoolLazyFalse<T extends HTMLElement = HTMLElement>(
    initial: boolean,
    opts: { delay: number; classIn?: string; classOut?: string }
): {
    ref: (el: T | undefined) => void;
    lazyBool: Accessor<boolean>;
    bool: Accessor<boolean>;
    state: Accessor<BoolLazyFalseState>;
    set: (v: boolean, cb?: OnChange<T>) => void;
    toggle: (cb?: OnChange<T>) => void;
    cleanup: () => void;
} {
    // Manual element tracking
    let el: T | undefined;
    
    // Queue animations for elements that haven't mounted yet
    let pending: [string | undefined, string | undefined] | null = null;
    
    // Timeout and callback management
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let onChange: OnChange<T> | undefined;

    const [state, setState] = createSignal<BoolLazyFalseState>(
        initial ? BoolLazyFalseState.TRUE : BoolLazyFalseState.FALSE
    );

    /**
     * Ref callback - manually track element
     */
    const ref = (n: T | undefined) => {
        if (el === n) return; // Prevent unnecessary updates
        
        el = n;
        
        // Apply any pending animation now that element is available
        if (el && pending) {
            const [add, del] = pending; 
            pending = null;
            if (del) el.classList.remove(del);
            requestAnimationFrame(() => { 
                if (add && el) el.classList.add(add); 
            });
        }
    };

    /**
     * Internal helpers
     */
    const clear = () => { 
        if (timeout) { 
            clearTimeout(timeout); 
            timeout = undefined; 
        } 
        onChange = undefined; 
    };
    
    const cleanup = () => { clear(); };

    /**
     * State setter with transition logic
     */
    const set = (v: boolean, cb?: OnChange<T>) => {
        const willOpen = v && state() !== BoolLazyFalseState.TRUE;
        const willClose = !v && state() === BoolLazyFalseState.TRUE;
        if (!willOpen && !willClose) return;
        
        clear(); 
        onChange = cb;
        
        if (willOpen) {
            setState(BoolLazyFalseState.TRUE);
        } else {
            setState(BoolLazyFalseState.BECOMING_FALSE);
            timeout = setTimeout(() => setState(BoolLazyFalseState.FALSE), opts.delay);
        }
    };

    /**
     * Single effect handles all animation and callback logic
     */
    createEffect(on(state, (s) => {
        // Fire callback when state stabilizes (not BECOMING_FALSE)
        if (s !== BoolLazyFalseState.BECOMING_FALSE && onChange) {
            onChange(s === BoolLazyFalseState.TRUE, el);
            onChange = undefined;
        }
        
        // Skip animation for FALSE state
        if (s === BoolLazyFalseState.FALSE) return;

        // Determine classes based on state
        const add = s === BoolLazyFalseState.TRUE ? opts.classIn : opts.classOut;
        const del = s === BoolLazyFalseState.TRUE ? opts.classOut : opts.classIn;

        if (el) {
            // Element exists - animate immediately
            if (del) el.classList.remove(del);
            requestAnimationFrame(() => { 
                if (add && el) el.classList.add(add); 
            });
        } else {
            // Element doesn't exist yet - queue animation
            pending = [add, del];
        }
    }));

    // Auto-cleanup on disposal
    onCleanup(cleanup);

    return {
        ref,
        lazyBool: () => state() !== BoolLazyFalseState.FALSE,
        bool: () => state() === BoolLazyFalseState.TRUE,
        state,
        set,
        toggle: (cb) => set(state() !== BoolLazyFalseState.TRUE, cb),
        cleanup,
    };
}
