/**
 * createPagedScroll with traditional Solid.js approach  
 * =====================================================
 * 
 * ## When traditional approach works well:
 * 
 * ### 1. **Zero Dependencies & Transparency**
 * - Uses only native Solid primitives - no custom infrastructure
 * - Complete visibility into where every listener/observer is managed
 * - Perfect for stable, one-time-mount scenarios
 * 
 * ### 2. **Direct Control**
 * - Manual ref setters give you exact control over timing and setup
 * - Can micro-optimize for very specific use cases
 * - No abstraction layer between you and DOM operations
 * 
 * ## Trade-offs in complex scenarios:
 * 
 * ### 1. **Manual Coordination Required**
 * - 3 refs (prev/container/next) + manual add/remove listeners everywhere
 * - Each ref setter must handle cleanup of previous element and setup of new one
 * - ResizeObserver + MutationObserver setup requires manual coordination
 * 
 * ### 2. **Higher Error Risk**
 * - Easy to forget cleanup in one of the many manual steps
 * - Memory leaks if any observer disconnect is missed
 * - No consumer ref composition (limitation of direct approach)
 * 
 * ### 3. **Verbose Observer Management**
 * - Container ref setter: cleanup previous, setup scroll + ResizeObserver + MutationObserver
 * - More boilerplate when observers need to coordinate
 * 
 * **Best for**: Simple controlled scenarios, one-off implementations, when you want
 * zero overhead and can handle lifecycle complexity manually.
 * 
 * **Note**: This approach scales poorly when UI becomes "alive" (HMR, swaps, observers).
 */

import { Component, JSX, createEffect, createSignal, on, onCleanup } from "solid-js";
import { createBoolLazyFalse } from "../createBoolLazyFalse/solidDefault";
import { Button } from "../Button";
import { ButtonProps, ButtonPropsAnchor } from "../Button/types";

/* ---------------------------------------------------------------- *\
 * Scroll calculation utilities (shared with createAttach version)
\* ---------------------------------------------------------------- */

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

const isFullyVisible = (elementRect: DOMRect, containerRect: DOMRect): boolean =>
    elementRect.left >= containerRect.left && elementRect.right <= containerRect.right;

const isPartiallyOrFullyOutsideRight = (elementRect: DOMRect, containerRect: DOMRect): boolean =>
    (elementRect.left < containerRect.right && elementRect.right > containerRect.right) ||
    elementRect.left >= containerRect.right;

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

const findPreviousTarget = (children: HTMLCollection, containerRect: DOMRect): HTMLElement | null => {
    let firstFullyVisible: number | null = null;
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
            if (firstFullyVisible === null) firstFullyVisible = i;
        } else if (firstFullyVisible !== null) {
            break;
        }
        i++;
    }

    if (firstFullyVisible === null) return null;
    const targetIndex = firstFullyVisible - fullyVisibleCount;
    return children[Math.max(targetIndex, 0)] as HTMLElement;
};

const scrollToElement = (container: Element, targetElement: HTMLElement, containerRect: DOMRect): void => {
    const elementRect = targetElement.getBoundingClientRect();
    const xDifference = elementRect.left - containerRect.left;
    const requiredScroll = (container as HTMLElement).scrollLeft + xDifference;

    (container as HTMLElement).scrollTo({ left: requiredScroll, behavior: "smooth" });
};


/* ---------------------------------------------------------------- *\
 * Traditional createPagedScroll implementation
\* ---------------------------------------------------------------- */

/**
 * Traditional implementation using standard Solid primitives only
 * Demonstrates the manual coordination required without createAttach
 */
export const createPagedScroll = () => {
    // Manual element tracking - no primitive assistance
    let elPrev: HTMLButtonElement | HTMLAnchorElement | undefined;
    let elContainer: HTMLDivElement | undefined;
    let elNext: HTMLButtonElement | HTMLAnchorElement | undefined;

    // Use the traditional createBoolLazyFalse for button animations
    const showPrevious = createBoolLazyFalse(false, {
        delay: 200,
        classIn: 'animate-front-in-left',
        classOut: 'animate-back-out-left',
    });
    
    const showNext = createBoolLazyFalse(false, {
        delay: 200,
        classIn: 'animate-front-in-right',
        classOut: 'animate-back-out-right',
    });

    // Observer management and debouncing state
    let debounceTimeout: ReturnType<typeof setTimeout> | undefined;
    let resizeObserver: ResizeObserver | null = null;
    let mutationObserver: MutationObserver | null = null;

    /**
     * Visibility calculation with debouncing
     * Updates button visibility based on first/last element position
     */
    const checkVisibility = (arg: HTMLElement | Event) => {
        if (debounceTimeout) clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(() => {
            const container = arg instanceof Event ? (arg.target as HTMLElement) : arg;
            if (!container || container.children.length === 0) return;

            const rect = container.getBoundingClientRect();
            const first = container.firstElementChild as HTMLElement;
            const last = container.lastElementChild as HTMLElement;
            if (!first || !last) return;

            const isFirstVisible = first.getBoundingClientRect().left >= rect.left;
            const isLastVisible = last.getBoundingClientRect().right <= rect.right;

            showPrevious.set(!isFirstVisible);
            showNext.set(!isLastVisible);
        }, 50);
    };

    /**
     * Navigation handlers
     * Direct imperative calls to scroll functions
     */
    const next = () => { 
        if (elContainer) scrollToDirection(elContainer, true); 
    };
    
    const previous = () => { 
        if (elContainer) scrollToDirection(elContainer, false); 
    };

    /**
     * Manual ref setters with explicit cleanup management
     * Each setter must handle cleanup of previous element and setup of new one
     */
    const setPrevRef = (el: HTMLButtonElement | HTMLAnchorElement | undefined) => {
        if (elPrev) elPrev.removeEventListener("click", previous);
        elPrev = el;
        if (elPrev) elPrev.addEventListener("click", previous);
    };

    const setNextRef = (el: HTMLButtonElement | HTMLAnchorElement | undefined) => {
        if (elNext) elNext.removeEventListener("click", next);
        elNext = el;
        if (elNext) elNext.addEventListener("click", next);
    };

    /**
     * Container ref setter with comprehensive observer setup
     * Must manually coordinate all observers and cleanup previous state
     */
    const setContainerRef = (el: HTMLDivElement | undefined) => {
        // Cleanup previous element's observers and listeners
        if (elContainer) {
            elContainer.removeEventListener("scroll", checkVisibility);
            resizeObserver?.disconnect(); 
            resizeObserver = null;
            mutationObserver?.disconnect(); 
            mutationObserver = null;
            if (debounceTimeout) { 
                clearTimeout(debounceTimeout); 
                debounceTimeout = undefined; 
            }
        }

        elContainer = el;

        if (elContainer) {
            // Initial visibility check
            checkVisibility(elContainer);
            
            // Setup scroll listener
            elContainer.addEventListener("scroll", checkVisibility);
            
            // Setup observers with manual coordination
            resizeObserver = new ResizeObserver(() => 
                elContainer && checkVisibility(elContainer)
            );
            resizeObserver.observe(elContainer);

            mutationObserver = new MutationObserver(() => 
                elContainer && checkVisibility(elContainer)
            );
            mutationObserver.observe(elContainer, { 
                childList: true, 
                subtree: true 
            });
        }
    };

    /**
     * Component definitions without ref composition
     * Consumer refs are not supported in this traditional approach
     */
    const BtnPrevious: Component<ButtonPropsAnchor | ButtonProps> = (props) => (
        <Button
            {...props}
            disabled={!showPrevious.lazyBool()}
            ref={setPrevRef}
        />
    );

    const PagedScroll: Component<JSX.HTMLAttributes<HTMLDivElement>> = (props) => (
        <div
            {...props}
            ref={setContainerRef}
        />
    );

    const BtnNext: Component<ButtonPropsAnchor | ButtonProps> = (props) => (
        <Button
            {...props}
            disabled={!showNext.lazyBool()}
            ref={setNextRef}
        />
    );

    /**
     * Manual cleanup function - must explicitly clean all resources
     * No automatic coordination like createAttach provides
     */
    const cleanup = () => {
        if (elPrev) elPrev.removeEventListener("click", previous);
        if (elNext) elNext.removeEventListener("click", next);
        if (elContainer) elContainer.removeEventListener("scroll", checkVisibility);
        resizeObserver?.disconnect(); 
        resizeObserver = null;
        mutationObserver?.disconnect(); 
        mutationObserver = null;
        if (debounceTimeout) { 
            clearTimeout(debounceTimeout); 
            debounceTimeout = undefined; 
        }
    };

    onCleanup(cleanup);

    return {
        BtnPrevious,
        PagedScroll,
        BtnNext,
        cleanup,
        // Simple refs access without createAttach utilities
        refs: {
            previous: { get: () => elPrev },
            container: { get: () => elContainer },
            next: { get: () => elNext },
        },
        // Expose state accessors
        showPrevious: showPrevious.lazyBool,
        showNext: showNext.lazyBool,
        // Expose navigation functions
        next,
        previous,
    };
};
