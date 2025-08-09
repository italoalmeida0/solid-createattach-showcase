/**
 * createPagedScroll with createAttach approach
 * ============================================
 * 
 * ## When createAttach excels in complex ref coordination:
 * 
 * ### 1. **Simplified Lifecycle Management**
 * - `onAttach(key, handler, once)` centralizes mount/swap/unmount in single place
 * - Cleanup comes from handler return - no need to remember disconnecting elsewhere
 * - Queue actions before mount: if container not mounted, queue checkVisibility via onAttach
 * 
 * ### 2. **Named Handlers & Deduplication**
 * - Keys ('paged-scroll-observers', 'paged-scroll-previous', 'paged-scroll-next') prevent duplicates
 * - Granular cleanup with `detach("key")` for specific functionality
 * - No duplicate listeners when refs change or components remount
 * 
 * ### 3. **Imperative Access & Composition**
 * - `attachment()` gives non-reactive element access without untrack()
 * - `RefRef` utility merges consumer refs with internal refs seamlessly
 * - Cleaner imperative DOM operations in event handlers
 * 
 * ### 4. **Fewer Failure Points**
 * - Traditional: 3 refs + manual add/remove listeners = easy to forget cleanup
 * - createAttach: cleanup is "attached" to the attachment itself
 * - Reduces risk of memory leaks and intermittent bugs
 * 
 * ## Trade-offs:
 * 
 * ### 1. **Small Overhead**
 * - ~1KB for Map + closures infrastructure
 * - Worth it for complex scenarios with ref swapping and multiple observers
 * 
 * **Best for**: Reusable library primitives, complex ref coordination, scenarios with 
 * element swapping, multiple listeners, and late mounting requirements.
 */

import { Component, JSX, onCleanup } from 'solid-js';
import { createBoolLazyFalse } from '../createBoolLazyFalse/createAttach';
import { createAttach, RawRef, RefRef } from '../createAttach';
import { Button } from '../Button';
import { ButtonProps, ButtonPropsAnchor } from '../Button/types';

/* ---------------------------------------------------------------- *\
 * Scroll calculation utilities
\* ---------------------------------------------------------------- */

/**
 * Main scroll navigation function
 * Calculates next/previous target and scrolls smoothly
 */
export const scrollToDirection = (container?: Element, isNext: boolean = true) => {
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const children = container.children;

    const targetElement = isNext
        ? findNextTarget(children, containerRect)
        : findPreviousTarget(children, containerRect);

    if (!targetElement) return;

    scrollToElement(container, targetElement, containerRect);
};

/**
 * Check if an element is completely visible within the container
 */
const isFullyVisible = (elementRect: DOMRect, containerRect: DOMRect): boolean => {
    return elementRect.left >= containerRect.left && elementRect.right <= containerRect.right;
};

/**
 * Check if an element is partially or fully outside the right edge
 * Used to find the next scroll target
 */
const isPartiallyOrFullyOutsideRight = (elementRect: DOMRect, containerRect: DOMRect): boolean => {
    return (
        (elementRect.left < containerRect.right && elementRect.right > containerRect.right) ||
        elementRect.left >= containerRect.right
    );
};

/**
 * Find the next element to scroll to when going forward
 * Algorithm: Skip visible elements, then find first element outside right edge
 */
const findNextTarget = (children: HTMLCollection, containerRect: DOMRect): HTMLElement | null => {
    let passedVisibleElement = false;

    for (const child of children) {
        const element = child as HTMLElement;
        if (!element) continue;

        const elementRect = element.getBoundingClientRect();

        if (isFullyVisible(elementRect, containerRect)) {
            passedVisibleElement = true;
            continue;
        }

        if (passedVisibleElement && isPartiallyOrFullyOutsideRight(elementRect, containerRect)) {
            return element;
        }
    }

    return null;
};

/**
 * Find the previous element to scroll to when going backward
 * Algorithm: Count visible elements, then calculate target index to show previous page
 */
const findPreviousTarget = (
    children: HTMLCollection,
    containerRect: DOMRect
): HTMLElement | null => {
    let firstFullyVisible = null;
    let fullyVisibleCount = 0;

    let i = 0;
    for (const child of children) {
        const element = child as HTMLElement;
        if (!element) {
            i++;
            continue;
        }

        const elementRect = element.getBoundingClientRect();

        if (isFullyVisible(elementRect, containerRect)) {
            fullyVisibleCount++;
            if (firstFullyVisible === null) {
                firstFullyVisible = i;
            }
        } else if (firstFullyVisible !== null) {
            break;
        }
        i++;
    }

    if (firstFullyVisible === null) return null;

    const targetIndex = firstFullyVisible - fullyVisibleCount;
    return children[Math.max(targetIndex, 0)] as HTMLElement;
};

/**
 * Smoothly scroll container to show the target element
 */
const scrollToElement = (
    container: Element,
    targetElement: HTMLElement,
    containerRect: DOMRect
): void => {
    const elementRect = targetElement.getBoundingClientRect();
    const xDifference = elementRect.left - containerRect.left;
    const requiredScroll = container.scrollLeft + xDifference;

    container.scrollTo({
        left: requiredScroll,
        behavior: 'smooth',
    });
};

/* ---------------------------------------------------------------- *\
 * Main createPagedScroll primitive
\* ---------------------------------------------------------------- */

/**
 * Creates a complete paged scroll system with navigation buttons
 * 
 * Returns coordinated components that work together:
 * - BtnPrevious: Auto-hides when at start, handles backward navigation
 * - PagedScroll: Container with scroll monitoring and ref composition
 * - BtnNext: Auto-hides when at end, handles forward navigation
 * 
 * Features:
 * - Automatic visibility detection using multiple observers
 * - Smooth scroll navigation with smart target calculation
 * - Button animations (fade in/out) based on scroll position
 * - Full cleanup of all observers and listeners
 * - Ref composition support for consumer customization
 */
export const createPagedScroll = () => {
    // Create three coordinated refs using createAttach
    const refPrevious = createAttach<HTMLButtonElement | HTMLAnchorElement>();
    const refPagedScroll = createAttach<HTMLDivElement>();
    const refNext = createAttach<HTMLButtonElement | HTMLAnchorElement>();

    // Create animation states for both navigation buttons
    const showPrevious = createBoolLazyFalse(false, {
        ref: refPrevious,
        delay: 200,
        classIn: 'animate-front-in-left',
        classOut: 'animate-back-out-left',
    });
    const showNext = createBoolLazyFalse(false, {
        ref: refNext,
        delay: 200,
        classIn: 'animate-front-in-right',
        classOut: 'animate-back-out-right',
    });

    // Internal state for debouncing and observers
    let timeoutId: NodeJS.Timeout;
    let resizeObserver: ResizeObserver | null = null;
    let mutationObserver: MutationObserver | null = null;

    /**
     * Debounced visibility check function
     * Determines if navigation buttons should be shown based on scroll position
     */
    const checkVisibility = (arg: HTMLElement | Event) => {
        clearTimeout(timeoutId);

        timeoutId = setTimeout(() => {
            // Get the scroll container element
            const pagedScroll = arg instanceof Event ? (arg.target as HTMLElement) : arg;

            if (!pagedScroll || pagedScroll.children.length === 0) return;

            const pagedScrollRect = pagedScroll.getBoundingClientRect();

            // Check if first element is visible (determines if Previous button needed)
            const firstElement = pagedScroll.firstElementChild as HTMLElement;
            const firstRect = firstElement.getBoundingClientRect();
            const isFirstVisible = firstRect.left >= pagedScrollRect.left;

            // Check if last element is visible (determines if Next button needed)
            const lastElement = pagedScroll.lastElementChild as HTMLElement;
            const lastRect = lastElement.getBoundingClientRect();
            const isLastVisible = lastRect.right <= pagedScrollRect.right;

            // Update button visibility states
            showPrevious.set(!isFirstVisible);
            showNext.set(!isLastVisible);
        }, 50);
    };

    /**
     * Setup all observers and listeners when scroll container mounts
     * This demonstrates the power of createAttach's named listeners with cleanup
     */
    refPagedScroll.onAttach((pagedScroll) => {
        // No need to check if element exists - onAttach guarantees it
        // Initial visibility check
        checkVisibility(pagedScroll);

        // Setup scroll listener for real-time updates
        pagedScroll.addEventListener('scroll', checkVisibility);

        // Setup ResizeObserver to handle container size changes
        resizeObserver = new ResizeObserver(() => checkVisibility(pagedScroll));
        resizeObserver.observe(pagedScroll);

        // Setup MutationObserver to handle content changes
        mutationObserver = new MutationObserver(() => checkVisibility(pagedScroll));
        mutationObserver.observe(pagedScroll, {
            childList: true,
            subtree: true,
        });

        // Return cleanup function - runs automatically when element changes/unmounts
        return () => {
            clearTimeout(timeoutId);

            pagedScroll.removeEventListener('scroll', checkVisibility);

            resizeObserver?.disconnect();
            mutationObserver?.disconnect();

            resizeObserver = null;
            mutationObserver = null;
        };
    }, 'paged-scroll-observers'); // Named listener for easy identification

    /**
     * Navigation function handlers
     * Use attachment() for non-reactive element access
     */
    const next = () => {
        const pagedScroll = refPagedScroll.attachment();
        if (pagedScroll) scrollToDirection(pagedScroll, true);
    };

    const previous = () => {
        const pagedScroll = refPagedScroll.attachment();
        if (pagedScroll) scrollToDirection(pagedScroll, false);
    };

    /**
     * Setup click handlers for navigation buttons
     * Each gets a named listener for clean management
     */
    refPrevious.onAttach((btn) => {
        // No need to check if element exists - onAttach guarantees it
        btn.addEventListener('click', previous);
        return () => btn.removeEventListener('click', previous);
    }, 'paged-scroll-previous');

    refNext.onAttach((btn) => {
        // No need to check if element exists - onAttach guarantees it
        btn.addEventListener('click', next);
        return () => btn.removeEventListener('click', next);
    }, 'paged-scroll-next');

    /**
     * Manual cleanup function (auto-cleanup also happens on disposal)
     */
    const cleanup = () => {
        refPrevious.detach();
        refPagedScroll.detach();
        refNext.detach();
    };

    /**
     * Previous button component with automatic visibility and ref composition
     */
    const BtnPrevious: Component<ButtonPropsAnchor | ButtonProps> = (props) => (
        <Button
            {...props}
            disabled={!showPrevious.lazyBool()}
            ref={RefRef(
                props.ref as RawRef<HTMLAnchorElement | HTMLButtonElement>, 
                refPrevious.attach
            )}
        />
    );

    /**
     * Scroll container component with observer setup and ref composition
     */
    const PagedScroll: Component<JSX.HTMLAttributes<HTMLDivElement>> = (props) => (
        <div 
            {...props} 
            ref={RefRef(props.ref, refPagedScroll.attach)} 
        />
    );

    /**
     * Next button component with automatic visibility and ref composition
     */
    const BtnNext: Component<ButtonPropsAnchor | ButtonProps> = (props) => (
        <Button
            {...props}
            disabled={!showNext.lazyBool()}
            ref={RefRef(
                props.ref as RawRef<HTMLAnchorElement | HTMLButtonElement>, 
                refNext.attach
            )}
        />
    );

    // Auto-cleanup on component disposal
    onCleanup(() => {
        cleanup();
    });

    return {
        BtnPrevious,
        PagedScroll,
        BtnNext,
        cleanup,
        // Expose refs for advanced composition and direct access
        refs: {
            previous: refPrevious,
            container: refPagedScroll,
            next: refNext,
        },
        // Expose internal state for advanced use cases
        showPrevious: showPrevious.lazyBool,
        showNext: showNext.lazyBool,
        // Expose navigation functions for programmatic control
        next,
        previous,
    };
};
