/**
 * Button with traditional Solid.js approach
 * =========================================
 * 
 * ## When traditional approach works well:
 * 
 * ### 1. **Direct & Transparent**
 * - Uses only standard Solid primitives - no custom infrastructure
 * - Clear visibility into every listener setup and cleanup step
 * - Explicit control over when and how DOM manipulation occurs
 * 
 * ### 2. **Zero Bundle Overhead**
 * - No additional abstractions or coordination infrastructure
 * - Direct DOM access and manual lifecycle management
 * - Straightforward one-to-one mapping of setup to cleanup
 * 
 * ### 3. **Complete Control**
 * - Fine-grained control over ripple lifecycle timing
 * - Can optimize cleanup order for specific performance needs
 * - No hidden behavior or automatic coordination
 * 
 * ## Trade-offs in complex scenarios:
 * 
 * ### 1. **Manual Coordination Required**
 * - Must track element state, ripple cleanup, and listeners manually
 * - Easy to forget multi-step cleanup (events + DOM elements)
 * - Each ref change requires careful cleanup of previous element state
 * 
 * ### 2. **Limited Ref Composition**
 * - Cannot easily merge consumer refs with internal ripple ref
 * - Either internal logic OR consumer access, not both seamlessly
 * - More complex to build reusable library components
 * 
 * ### 3. **Error-Prone in Complex Cases**
 * - Ripple DOM elements + listeners = multiple cleanup responsibilities
 * - Polymorphic button/anchor switching adds complexity
 * - Memory leaks if any cleanup step is missed during development
 * 
 * **Good for**: Simple buttons, one-off implementations, when you want
 * complete control and can handle multi-step cleanup manually.
 */

import { Component, createMemo, JSX, onCleanup, onMount, Show } from 'solid-js';
import { omitProps, dataProps } from '../utils';
import type { ButtonProps, ButtonPropsAnchor, ButtonPropsSchema } from './types';

// Same ripple function - complex DOM manipulation logic unchanged
const createRipple = (e: Event) => {
  const btn = e.currentTarget as HTMLElement;
  const activeRipples = btn.querySelectorAll('.ripple');
  if (activeRipples.length > 4) {
    activeRipples[0].remove();
  }
  const rect = btn.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  const x = (e as PointerEvent).clientX - rect.left - size / 2;
  const y = (e as PointerEvent).clientY - rect.top - size / 2;

  const ripple = document.createElement('span');
  ripple.classList.add('ripple');
  ripple.style.width = ripple.style.height = size + 'px';
  ripple.style.left = x + 'px';
  ripple.style.top = y + 'px';

  ripple.innerHTML = '&nbsp;';
  btn.append(ripple);
  setTimeout(() => {
    ripple.remove();
  }, 600);
};

/**
 * Traditional implementation using standard Solid primitives only
 * Demonstrates manual coordination required for complex components
 */
export const Button: Component<ButtonPropsAnchor | ButtonProps> = (props): JSX.Element => {
  const buttonHref = createMemo(() => (props as ButtonPropsAnchor).href ?? '');

  // Same icon system - complexity unchanged
  const StartIcon = createMemo(() => props.startIcon ? <span>🔸</span> : <></>);
  const EndIcon = createMemo(() => props.endIcon ? <span>🔹</span> : <></>);

  // Manual element tracking - no primitive assistance
  let currentButton: HTMLAnchorElement | HTMLButtonElement | undefined;

  /**
   * Manual ref setter with explicit cleanup coordination
   * Must handle: 1) cleanup previous listeners, 2) track element, 3) setup new listeners
   */
  const setButtonRef = (btn: HTMLAnchorElement | HTMLButtonElement | undefined) => {
    // Step 1: Cleanup previous element's event listeners
    if (currentButton) {
      currentButton.removeEventListener('click', createRipple);
    }

    // Step 2: Update element tracking
    currentButton = btn;

    // Step 3: Setup new element (btn is guaranteed to exist when called by ref={})
    if (btn) {
      btn.addEventListener('click', createRipple);
    }
  };

  // Manual cleanup - must remember all the steps from setButtonRef
  onCleanup(() => {
    if (currentButton) {
      // Must duplicate the cleanup logic from setButtonRef
      currentButton.removeEventListener('click', createRipple);
      const ripples = currentButton.querySelectorAll('.ripple');
      ripples.forEach(ripple => ripple.remove());
      currentButton = undefined;
    }
  });

  const isCard = createMemo(() => props.appearance === 'card');
  const textParts = createMemo(() => (isCard() && props.text ? props.text.split('/') : []));

  const Inside = createMemo(() => (
    <>
      <Show when={props.startIcon}>
        <span class="startIcon">
          <StartIcon />
        </span>
      </Show>
      <span>
        <Show when={isCard() && textParts().length > 0} fallback={props.text || props.children}>
          {textParts()[0]}
          <Show when={textParts()[1]}>
            <br />
            <span class="font-normal italic">{textParts()[1]}</span>
          </Show>
        </Show>
      </span>
      <Show when={props.endIcon}>
        <span class="endIcon">
          <EndIcon />
        </span>
      </Show>
    </>
  ));

  /**
   * Polymorphic component without ref composition support
   * Consumer refs cannot be merged with internal ripple logic
   */
  const PolymorphicButton: Component<
    | Omit<JSX.ButtonHTMLAttributes<HTMLButtonElement>, 'color' | 'type'>
    | Omit<JSX.AnchorHTMLAttributes<HTMLAnchorElement>, 'color' | 'type'>
  > = (rest) =>
    (props.type === 'button' && (
      <button
        {...(rest as JSX.ButtonHTMLAttributes<HTMLButtonElement>)}
        ref={setButtonRef} // Direct ref - no composition with consumer refs
        type="button"
      />
    )) ||
    ((props.type === 'link' || props.type === 'lang-link') && (
      <a
        {...(rest as JSX.AnchorHTMLAttributes<HTMLAnchorElement>)}
        ref={setButtonRef} // Same ref setter for both button and anchor
        href={buttonHref()}
        role="button"
      />
    ));

  // Same validation logic - component complexity unchanged
  onMount(() => {
    if ((props.type === 'link' || props.type === 'lang-link') && !(props as ButtonPropsAnchor).href)
      throw new Error("For 'link' or 'lang-link' buttons, the 'href' property must be defined.");
    if (props.type === 'button' && (props as ButtonPropsAnchor).href)
      throw new Error("For 'button' type buttons, the 'href' property must not be defined.");
    if (!props.text && !props.children)
      throw new Error("Button content must be defined, either via 'text' or 'children' property.");
    if (props.text && props.children)
      throw new Error(
        "Button content must be defined using either the 'text' or 'children' property, but not both."
      );
  });

  const rawProps = createMemo(() => {
    const schema = { children: '', ...ButtonPropsSchema } as const;
    return props.type === 'button'
      ? (omitProps(props, schema) as Omit<JSX.ButtonHTMLAttributes<HTMLButtonElement>, 'color' | 'type'>)
      : (omitProps(props, schema) as Omit<JSX.AnchorHTMLAttributes<HTMLAnchorElement>, 'color' | 'type'>);
  });

  return (
    <PolymorphicButton
      title={props.text ?? ''}
      {...rawProps()}
      {...dataProps(props, ButtonPropsSchema)}
      data-type={(() => `button-${props.type}`)()}
      data-ripple={props.ripple === false ? 'false' : 'true'}
      role="button"
    >
      <Inside />
    </PolymorphicButton>
  );
};