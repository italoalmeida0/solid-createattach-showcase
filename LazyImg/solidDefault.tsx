/**
 * LazyImg with traditional Solid.js approach
 * ==========================================
 * 
 * ## When traditional approach works well:
 * 
 * ### 1. **Zero Dependencies & Transparency**
 * - Uses only native Solid primitives - no custom infrastructure
 * - Complete visibility into observer setup and cleanup timing
 * - Perfect for simple lazy loading without complex lifecycle needs
 * 
 * ### 2. **Direct Control**
 * - Manual ref setter gives exact control over observer lifecycle
 * - Can optimize for specific intersection observer configurations
 * - No abstraction between you and IntersectionObserver API
 * 
 * ### 3. **Minimal Bundle**
 * - No overhead from custom primitive infrastructure
 * - Straightforward one-to-one mapping of observer to element
 * 
 * ## Trade-offs in complex scenarios:
 * 
 * ### 1. **Manual Lifecycle Management**
 * - Must track observer state and handle cleanup manually
 * - Element swapping requires careful observer disconnect/reconnect
 * - Easy to forget cleanup in edge cases (memory leaks)
 * 
 * ### 2. **Limited Ref Composition**
 * - Cannot easily merge consumer refs with internal observer ref
 * - Either internal logic OR consumer access, not both seamlessly
 * 
 * ### 3. **Development Friction**
 * - Hot reload and element recreation require manual observer management
 * - More boilerplate when observer setup becomes complex
 * 
 * **Best for**: Simple lazy loading scenarios, one-off implementations,
 * when you want zero overhead and can handle lifecycle manually.
 */

import { Component, createMemo, createSignal, JSX, onCleanup, Show } from 'solid-js';
import { exeIsFunc } from '../createAttach';
import { omitProps } from '../utils';
import type { MakeSchema, Optional } from '../type';

const LazyImgPropsSchema = {
    onLoad: undefined as Optional<
        JSX.EventHandlerUnion<HTMLImageElement, Event, JSX.EventHandler<HTMLImageElement, Event>>
    >,
    onError: undefined as Optional<
        JSX.EventHandlerUnion<
            HTMLImageElement,
            ErrorEvent,
            JSX.EventHandler<HTMLImageElement, ErrorEvent>
        >
    >,
    ref: undefined as Optional<(el: HTMLImageElement | undefined) => void>,
    placeholder: undefined as Optional<boolean>,
};

type LazyImgPropsFromSchema = MakeSchema<typeof LazyImgPropsSchema>;

interface LazyImgProps
    extends LazyImgPropsFromSchema,
        Omit<JSX.ImgHTMLAttributes<HTMLImageElement>, 'onLoad' | 'onError' | 'ref'> {}

/**
 * Traditional implementation using standard Solid primitives only
 * Demonstrates manual observer management without createAttach
 */
export const LazyImg: Component<LazyImgProps> = (props): JSX.Element => {
    const [loading, setLoading] = createSignal<boolean>(true);
    const [shouldLoad, setShouldLoad] = createSignal<boolean>(false);
    const [error, setError] = createSignal<boolean>(false);
    
    // Manual observer tracking - must handle cleanup explicitly
    let observer: IntersectionObserver | undefined;
    let currentElement: HTMLDivElement | undefined;

    const placeholderStyle = createMemo(() => ({
        width: props.width ? `${props.width}px` : '100%',
        height: props.height ? `${props.height}px` : 'auto',
    }));

    const observerOptions = createMemo(() => ({
        rootMargin: '50px',
        threshold: 0.01,
    }));

    /**
     * Manual ref setter with explicit observer management
     * Must handle cleanup of previous element and setup of new one
     */
    const setPlaceholderRef = (element: HTMLDivElement | undefined) => {
        // Cleanup previous observer if element changes
        if (observer && currentElement) {
            observer.unobserve(currentElement);
            observer.disconnect();
            observer = undefined;
        }
        
        currentElement = element;
        
        if (element) {
            // Setup new observer for new element
            observer = new IntersectionObserver((entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) {
                        setShouldLoad(true);
                        observer?.disconnect();
                        observer = undefined;
                        break;
                    }
                }
            }, observerOptions());

            observer.observe(element);
        }
    };

    // Manual cleanup - must remember to clean all resources
    onCleanup(() => {
        if (observer) {
            observer.disconnect();
            observer = undefined;
        }
        currentElement = undefined;
    });

    // Simple placeholder component - no ref composition support
    const Placeholder = createMemo(() =>
        props.placeholder === false ? (
            <div ref={setPlaceholderRef} />
        ) : (
            <div
                ref={setPlaceholderRef}
                data-type="img-placeholder"
                data-error={error()}
                style={placeholderStyle()}
            >
                {/* Simple loading indicator */}
                <div style={{ display: 'flex', 'align-items': 'center', 'justify-content': 'center', height: '100%' }}>
                    {error() ? '❌' : '⏳'}
                </div>
            </div>
        )
    );

    const imgProps = createMemo(() => omitProps(props, LazyImgPropsSchema));

    return (
        <Show when={shouldLoad()} fallback={<Placeholder />}>
            <img
                {...imgProps()}
                ref={props.ref} // Direct ref - no composition with internal logic
                classList={{ hidden: loading() }}
                onLoad={(e) => {
                    setLoading(false);
                    exeIsFunc(props.onLoad, e);
                }}
                onError={(e) => {
                    setError(true);
                    setLoading(true);
                    exeIsFunc(props.onError, e);
                }}
                alt={props.alt}
            />
            <Show when={loading()}>
                <Placeholder />
            </Show>
        </Show>
    );
};