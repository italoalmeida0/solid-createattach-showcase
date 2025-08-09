/**
 * createBoolLazyFalse with createAttach approach
 * ==============================================
 * 
 * ## When createAttach helps with ref coordination:
 * 
 * ### 1. **Safe Element Access**
 * - `attachment()` provides non-reactive element access within effects
 * - Queues DOM operations when element doesn't exist yet
 * - Complements createEffect for element-dependent operations
 * 
 * ### 2. **Handles Element Lifecycle**
 * - Automatic cleanup when elements change or unmount
 * - Queues operations before element mounts (useful for conditional rendering)
 * - No manual observer/listener management
 * 
 * ### 3. **Composable Refs**
 * - Multiple handlers can attach to same element with keys
 * - Consumer refs work alongside internal logic via RefRef utility
 * 
 * ## Trade-offs:
 * 
 * ### 1. **Additional Abstraction**
 * - ~1KB bundle cost for coordination infrastructure
 * - Learning curve for the pattern vs direct DOM access
 * 
 * ### 2. **Overhead for Simple Cases**
 * - Traditional approach may be simpler for basic scenarios
 * 
 * **Useful for**: Components needing safe element access within effects,
 * queuing operations for conditional elements, or ref composition.
 */

import { Accessor, createEffect, createRoot, createSignal, on } from 'solid-js';
import { ReturnCreateAttach } from '../createAttach';

/**
 * Internal animation helper that safely applies CSS classes
 * Uses requestAnimationFrame for optimal animation timing
 */
const Animate = <T extends HTMLElement = HTMLElement>(
    el: T,
    classAdd: string | undefined,
    classDel: string | undefined
) => {
    if (classDel) {
        el.classList.remove(classDel);
    }

    requestAnimationFrame(() => {
        if (classAdd) {
            el.classList.add(classAdd);
        }
    });
};

/**
 * Three-state enum for animation-aware boolean management
 */
export enum BoolLazyFalseState {
    /** Fully false/closed state */
    FALSE,
    /** Transitioning from true to false (animation period) */
    BECOMING_FALSE,
    /** Fully true/open state */
    TRUE,
}

/**
 * Callback fired when state changes complete
 */
export type OnChangeCallback<T extends HTMLElement = HTMLElement> = (
    state: boolean,
    ref?: ReturnCreateAttach<T>
) => void;

/**
 * Configuration options for createBoolLazyFalse
 */
export type CreateBoolLazyFalseOptions<T extends HTMLElement = HTMLElement> = {
    /** Reference from createAttach for DOM element binding */
    ref?: ReturnCreateAttach<T>;
    /** Delay in ms before transitioning from BECOMING_FALSE to FALSE */
    delay: number;
    /** CSS class applied when transitioning to TRUE */
    classIn?: string;
    /** CSS class applied when transitioning to FALSE */
    classOut?: string;
};

/**
 * Return type with all state accessors and controls
 */
export type CreateBoolLazyFalseReturn<T extends HTMLElement = HTMLElement> = {
    /** Returns true while visible (TRUE or BECOMING_FALSE states) */
    lazyBool: Accessor<boolean>;
    /** Returns true only in TRUE state */
    bool: Accessor<boolean>;
    /** Raw state accessor for advanced use cases */
    state: Accessor<BoolLazyFalseState>;
    /** Alias for lazyBool */
    get: Accessor<boolean>;
    /** Set state with optional callback */
    set: (value: boolean, OnChangeCallback?: OnChangeCallback<T>) => void;
    /** Toggle state with optional callback */
    toggle: (OnChangeCallback?: OnChangeCallback<T>) => void;
    /** Manual cleanup (auto-cleanup on dispose) */
    cleanup: () => void;
};

export type CreateBoolLazyFalse = <T extends HTMLElement = HTMLElement>(
    initialValue: boolean,
    options: CreateBoolLazyFalseOptions<T>
) => CreateBoolLazyFalseReturn<T>;

/**
 * Creates an animation-aware boolean state manager with three-state logic.
 * Perfect for modals, dropdowns, tooltips, and any UI that needs exit animations.
 * 
 * @param initialValue - Initial boolean state
 * @param options - Configuration with ref, delay, and animation classes
 * @returns Object with state accessors and control methods
 * 
 * @example
 * const { attach, attachment } = createAttach<HTMLDivElement>();
 * const modal = createBoolLazyFalse(false, {
 *   ref: { attach, attachment },
 *   delay: 300,
 *   classIn: 'animate-fade-in',
 *   classOut: 'animate-fade-out'
 * });
 * 
 * // In JSX:
 * <Show when={modal.lazyBool()}>
 *   <div ref={attach} class="modal">
 *     Content stays visible during exit animation!
 *   </div>
 * </Show>
 */
export const createBoolLazyFalse: CreateBoolLazyFalse = <T extends HTMLElement = HTMLElement>(
    initialValue: boolean,
    options: CreateBoolLazyFalseOptions<T>
): CreateBoolLazyFalseReturn<T> => {
    return createRoot((dispose) => {
        const [state, setState] = createSignal<BoolLazyFalseState>(
            initialValue ? BoolLazyFalseState.TRUE : BoolLazyFalseState.FALSE
        );
        let timeout: NodeJS.Timeout | undefined;
        let onChange: OnChangeCallback<T> | undefined;
        
        /**
         * Set state with intelligent transition handling
         * Prevents redundant state changes and manages animation timing
         */
        const set = (value: boolean, OnChangeCallback?: OnChangeCallback<T>): void => {
            const boolTrue = value && state() != BoolLazyFalseState.TRUE;
            const boolFalse = !value && state() == BoolLazyFalseState.TRUE;
            if (!boolTrue && !boolFalse) return;
            
            clearTimeouts();
            onChange = OnChangeCallback;
            
            if (boolTrue) {
                // Immediate transition to TRUE
                setState(BoolLazyFalseState.TRUE);
            } else {
                // Delayed transition through BECOMING_FALSE
                setState(BoolLazyFalseState.BECOMING_FALSE);
                timeout = setTimeout(() => setState(BoolLazyFalseState.FALSE), options.delay);
            }
        };

        /**
         * Single effect managing all animation state changes
         * Uses createAttach for safe DOM element access
         */
        createEffect(
            on(state, () => {
                const optionsRef = options.ref;
                const stateValue = state();
                
                // Fire callback when state settles
                if (stateValue != BoolLazyFalseState.BECOMING_FALSE && onChange) {
                    onChange(false, optionsRef);
                }
                
                // Skip animation for FALSE state
                if (stateValue == BoolLazyFalseState.FALSE) return;
                
                // Determine animation classes based on state
                const classAdd = stateValue == BoolLazyFalseState.TRUE ? options.classIn : options.classOut;
                const classDel = stateValue == BoolLazyFalseState.TRUE ? options.classOut : options.classIn;
                
                // Apply animation using createAttach for safety
                const element = optionsRef?.attachment();
                if (element) {
                    Animate(element, classAdd, classDel);
                } else {
                    // Queue animation for when element mounts
                    optionsRef?.onAttach(
                        (el) => el && Animate(el, classAdd, classDel),
                        'lazybool-animation',
                        true // Run once when element appears
                    );
                }
            })
        );

        /**
         * Toggle between TRUE and FALSE states
         */
        const toggle = (OnChangeCallback?: OnChangeCallback<T>): void => {
            set(state() != BoolLazyFalseState.TRUE, OnChangeCallback);
        };

        /**
         * Clean up all resources (timeouts, effects, listeners)
         */
        const cleanup = (): void => {
            clearTimeouts();
            dispose();
        };

        /**
         * Internal helper to clear active timeouts
         */
        const clearTimeouts = () => {
            if (timeout) clearTimeout(timeout);
            if (onChange) onChange = undefined;
        };

        /**
         * Accessors with different semantics:
         * - lazyBool: true during TRUE and BECOMING_FALSE (element still visible)
         * - bool: true only during TRUE state (fully open)
         */
        const lazyBool = () => state() !== BoolLazyFalseState.FALSE;
        const bool = () => state() === BoolLazyFalseState.TRUE;
        
        return {
            lazyBool,
            bool,
            state,
            get: lazyBool, // Alias for convenience
            set,
            toggle,
            cleanup,
        };
    });
};
