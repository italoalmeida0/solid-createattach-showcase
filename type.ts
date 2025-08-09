/**
 * Available accent colors for UI components
 */
export type AccentColors = 'blue' | 'pink' | 'yellow';

/**
 * Standard size scale from extra-large to extra-small
 */
export type Sizes = 'xl' | 'lg' | 'md' | 'sm' | 'xs';

/**
 * Visual effects for interactive elements
 * - Base effects: Applied constantly
 * - hocus: effects: Applied on hover or focus
 * - expanded: effects: Applied when element is in expanded state
 */
export type Effects =
    | 'shine'
    | 'pulse'
    | 'slide'
    | 'float'
    | 'scale'
    | 'hocus:shine'
    | 'hocus:pulse'
    | 'hocus:slide'
    | 'hocus:float'
    | 'hocus:scale'
    | 'expanded:flip';

/**
 * Cancelable event object
 */
export type Event = { cancel: boolean };

/**
 * Helper type for optional values
 */
export type Optional<T> = T | undefined;

/**
 * Advanced utility type that extracts proper types from a schema object with default values.
 * Properties with `undefined` values become optional, others become required.
 * Perfect for creating prop types from schema objects used with omitProps/pickProps.
 * 
 * @example
 * const ButtonSchema = {
 *   label: '',                                    // required string
 *   onClick: undefined as unknown as () => void,  // required function
 *   variant: undefined as Optional<'primary'>,    // optional 'primary'
 *   disabled: undefined as Optional<boolean>,     // optional boolean
 * };
 * 
 * type ButtonProps = MakeSchema<typeof ButtonSchema>;
 * // Result: {
 * //   label: string;
 * //   onClick: () => void;
 * //   variant?: 'primary';
 * //   disabled?: boolean;
 * // }
 * 
 * // Use with omitProps to separate component props from HTML attributes:
 * const htmlProps = omitProps(props, ButtonSchema);
 */
export type MakeSchema<T> = {
    [K in keyof T as undefined extends T[K] ? K : never]?: T[K];
} & {
    [K in keyof T as undefined extends T[K] ? never : K]: T[K];
};
