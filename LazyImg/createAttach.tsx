/**
 * LazyImg with createAttach approach
 * ==================================
 * 
 * ## When createAttach shines in intersection observer scenarios:
 * 
 * ### 1. **Simplified Observer Management**
 * - `onAttach(handler)` sets up IntersectionObserver when element mounts
 * - Return cleanup function automatically disconnects observer on unmount/swap
 * - No manual observer tracking or explicit cleanup needed
 * 
 * ### 2. **Element Swapping & Hot Reload**
 * - Observer automatically transfers to new elements during development
 * - Previous observers clean up before setting up new ones
 * - Handles edge cases like element recreation gracefully
 * 
 * ### 3. **Ref Composition**
 * - `RefRef` utility merges consumer refs with internal observer ref
 * - Consumer can still access the element while lazy loading works
 * - No conflicts between internal logic and consumer needs
 * 
 * ### 4. **Declarative Lifecycle**
 * - Observer setup is tied directly to element availability
 * - No need to check if element exists before observing
 * - Clean separation between observer logic and component state
 * 
 * ## Trade-offs:
 * 
 * ### 1. **Small Bundle Overhead**
 * - ~1KB for createAttach infrastructure
 * - Worth it for complex observer scenarios and reusable components
 * 
 * **Best for**: Reusable lazy loading components, scenarios with element swapping,
 * when you need observer setup coordination with other ref-based logic.
 */

import { Component, createMemo, createSignal, JSX, Show } from 'solid-js';
import { createAttach, exeIsFunc, RefRef, RawRef } from '../createAttach';
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
    ref: undefined as Optional<RawRef<HTMLImageElement>>,
    placeholder: undefined as Optional<boolean>,
};

type LazyImgPropsFromSchema = MakeSchema<typeof LazyImgPropsSchema>;

interface LazyImgProps
    extends LazyImgPropsFromSchema,
        Omit<JSX.ImgHTMLAttributes<HTMLImageElement>, 'onLoad' | 'onError' | 'ref'> {}

export const LazyImg: Component<LazyImgProps> = (props): JSX.Element => {
    const [loading, setLoading] = createSignal<boolean>(true);
    const [shouldLoad, setShouldLoad] = createSignal<boolean>(false);
    const [error, setError] = createSignal<boolean>(false);
    let observer: IntersectionObserver | undefined;

    const placeholderStyle = createMemo(() => ({
        width: props.width ? `${props.width}px` : '100%',
        height: props.height ? `${props.height}px` : 'auto',
    }));

    const observerOptions = createMemo(() => ({
        rootMargin: '50px',
        threshold: 0.01,
    }));

    // Create ref with createAttach for automatic observer lifecycle management
    const { attach, onAttach } = createAttach<HTMLDivElement>();
    
    // Setup intersection observer when element mounts
    // Cleanup is automatic when element unmounts or changes
    onAttach((element) => {
        // No need to check if element exists - onAttach guarantees it
        const intersectionObserver = new IntersectionObserver((entries) => {
            for (const entry of entries) {
                if (entry.isIntersecting) {
                    setShouldLoad(true);
                    intersectionObserver.disconnect();
                    break;
                }
            }
        }, observerOptions());

        intersectionObserver.observe(element);
        
        // Return cleanup function - called automatically by createAttach
        return () => {
            intersectionObserver.disconnect();
        };
    }, 'lazy-img-observer');

    // Simple placeholder component with optional loading indicator
    const Placeholder = createMemo(() =>
        props.placeholder === false ? (
            <div ref={attach} />
        ) : (
            <div
                ref={attach}
                data-type="img-placeholder"
                data-error={error()}
                style={placeholderStyle()}
            >
                {/* Simple loading indicator instead of external SVG */}
                <div style={{ display: 'flex', align-items: 'center', justify-content: 'center', height: '100%' }}>
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
                ref={RefRef(props.ref, attach)}
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
