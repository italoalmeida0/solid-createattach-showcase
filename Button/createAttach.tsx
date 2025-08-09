/**
 * Button with createAttach approach
 * =================================
 * 
 * ## When createAttach shines in complex component libraries:
 * 
 * ### 1. **Advanced Event Coordination**
 * - Ripple effect requires element access for positioning and DOM manipulation
 * - `onAttach` handles ripple listener setup with automatic cleanup
 * - No manual addEventListener/removeEventListener coordination needed
 * 
 * ### 2. **Polymorphic Component Support**
 * - Same ref logic works for both <button> and <a> elements
 * - RefRef utility composes consumer refs with internal ripple ref
 * - Complex element swapping (button ↔ anchor) handled seamlessly
 * 
 * ### 3. **Library-Grade Lifecycle Management**
 * - Ripple cleanup automatic when button unmounts or changes
 * - No memory leaks from orphaned DOM listeners
 * - Works reliably with SSR, HMR, and dynamic component changes
 * 
 * ### 4. **Consumer Ref Composition**
 * - Users can still access button element via their own refs
 * - Internal ripple logic coexists with external button manipulation
 * - No conflicts between library and consumer ref usage
 * 
 * ## Trade-offs:
 * 
 * ### 1. **Bundle Cost for Advanced Features**
 * - ~1KB overhead for createAttach coordination infrastructure
 * - Worth it for reusable component libraries and complex ref scenarios
 * 
 * ### 2. **Learning Curve**
 * - Custom patterns vs direct DOM access
 * - Additional abstraction to understand for contributors
 * 
 * **Ideal for**: Component libraries, polymorphic components, advanced DOM
 * manipulation, scenarios requiring ref coordination with consumer code.
 */

import { Component, createMemo, JSX, onMount, Show } from 'solid-js';
import { createAttach, RefRef, RawRef } from '../createAttach';
import { omitProps, dataProps } from '../utils';
import type { ButtonProps, ButtonPropsAnchor, ButtonPropsSchema } from './types';

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
 * Advanced Button component demonstrating createAttach in complex scenarios
 * Supports polymorphic rendering (button/anchor), ripple effects, and full composition
 */
export const Button: Component<ButtonPropsAnchor | ButtonProps> = (props): JSX.Element => {
  const buttonHref = createMemo(() => (props as ButtonPropsAnchor).href ?? '');

  // Simple icon placeholders - in real component would be icon system
  const StartIcon = createMemo(() => props.startIcon ? <span>🔸</span> : <></>);
  const EndIcon = createMemo(() => props.endIcon ? <span>🔹</span> : <></>);

  // Create ref with createAttach for advanced ripple effect coordination
  const { attach, onAttach } = createAttach<HTMLAnchorElement | HTMLButtonElement>();
  
  // Setup ripple effect when button element mounts
  // Cleanup is automatic when element unmounts or changes  
  onAttach((btn) => {
    // No need to check if element exists - onAttach guarantees it
    btn.addEventListener('click', createRipple);
    
    // Return cleanup function - called automatically by createAttach
    return () => {
      btn.removeEventListener('click', createRipple);
      // Also cleanup any existing ripples
      const ripples = btn.querySelectorAll('.ripple');
      ripples.forEach(ripple => ripple.remove());
    };
  }, 'ripple-effect');

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

  const PolymorphicButton: Component<
    | Omit<JSX.ButtonHTMLAttributes<HTMLButtonElement>, 'color' | 'type'>
    | Omit<JSX.AnchorHTMLAttributes<HTMLAnchorElement>, 'color' | 'type'>
  > = (rest) =>
    (props.type === 'button' && (
      <button
        {...(rest as JSX.ButtonHTMLAttributes<HTMLButtonElement>)}
        ref={RefRef(rest.ref as RawRef<HTMLButtonElement>, attach)}
        type="button"
      />
    )) ||
    ((props.type === 'link' || props.type === 'lang-link') && (
      <a
        {...(rest as JSX.AnchorHTMLAttributes<HTMLAnchorElement>)}
        ref={RefRef(rest.ref as RawRef<HTMLAnchorElement>, attach)}
        href={buttonHref()}
        role="button"
      />
    ));

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
