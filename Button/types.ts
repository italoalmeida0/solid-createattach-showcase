import { JSX } from 'solid-js';
import type { MakeSchema, Optional } from '../type';

// Local types for this showcase - in real app would come from design system
type IconName = 'home' | 'user' | 'settings' | 'arrow-right' | 'arrow-left' | 'close' | 'menu';
type Effects = 'shine' | 'pulse' | 'slide' | 'float' | 'scale' | 'hocus:shine' | 'hocus:pulse' | 'hocus:slide' | 'hocus:float' | 'hocus:scale' | 'expanded:flip';
type Sizes = 'xl' | 'lg' | 'md' | 'sm';

type ButtonColors =
  | 'glass'
  | 'glass:shadow'
  | 'accent:blue'
  | 'accent:pink'
  | 'accent:yellow'
  | 'hocus:accent:blue'
  | 'hocus:accent:pink'
  | 'hocus:accent:yellow';
type ButtonType = 'button' | 'link' | 'lang-link';

type ButtonSizes = Exclude<Sizes, 'xs'>; // All sizes except xs

export const ButtonPropsSchema = {
  type: undefined as unknown as ButtonType,
  color: undefined as Optional<ButtonColors>,
  size: undefined as Optional<ButtonSizes>,
  text: undefined as Optional<string>,
  bold: undefined as Optional<boolean>,
  ripple: undefined as Optional<boolean>,
  appearance: undefined as Optional<'default' | 'card'>,
  popupEffect: undefined as Optional<boolean>,
  startIcon: undefined as Optional<IconName>,
  startIconSize: undefined as Optional<ButtonSizes>,
  startIconPadding: undefined as Optional<ButtonSizes>,
  startIconEffect: undefined as Optional<Effects>,
  endIcon: undefined as Optional<IconName>,
  endIconSize: undefined as Optional<ButtonSizes>,
  endIconPadding: undefined as Optional<ButtonSizes>,
  endIconEffect: undefined as Optional<Effects>,
};

type ButtonPropsFromSchema = MakeSchema<typeof ButtonPropsSchema>;

export interface ButtonPropsAnchor
  extends ButtonPropsFromSchema,
    Omit<JSX.AnchorHTMLAttributes<HTMLAnchorElement>, 'color' | 'type'> {}

export interface ButtonProps
  extends ButtonPropsFromSchema,
    Omit<JSX.ButtonHTMLAttributes<HTMLButtonElement>, 'color' | 'type'> {}
