
/**
 * Internal helper to filter object properties based on a schema.
 * Used as the base for both omitProps and pickProps utilities.
 * 
 * @param props - Source object to filter
 * @param extendSchema - Schema object whose keys determine filtering
 * @param reverse - If false, omit schema keys; if true, pick schema keys
 * @returns Filtered object
 */
function filterProps<T extends object, S extends object>(
    props: T,
    extendSchema: S,
    reverse: boolean = false
): Partial<T> {
    const schemaKeys = new Set(Object.keys(extendSchema));
    const result: Partial<T> = {};

    for (const key in props) {
        if (Object.prototype.hasOwnProperty.call(props, key)) {
            const isInSchema = schemaKeys.has(key);
            if (reverse ? isInSchema : !isInSchema) {
                result[key as keyof T] = props[key as keyof T];
            }
        }
    }

    return result;
}

/**
 * Omit properties from an object based on a schema.
 * Useful for separating component props from HTML attributes.
 * 
 * @example
 * const htmlProps = omitProps(props, { onClick: true, customProp: true });
 * // Returns props without onClick and customProp
 */
export const omitProps = <T extends object, S extends object>(props: T, schema: S) =>
    filterProps(props, schema, false) as Omit<T, keyof S>;

/**
 * Pick only specific properties from an object based on a schema.
 * Useful for extracting known props while ignoring the rest.
 * 
 * @example
 * const knownProps = pickProps(props, { value: true, onChange: true });
 * // Returns only value and onChange from props
 */
export const pickProps = <T extends object, S extends object>(props: T, schema: S) =>
    filterProps(props, schema, true) as Pick<T, keyof S & keyof T>;

/**
 * Convert camelCase to kebab-case.
 * Used internally for data attribute conversion.
 * 
 * @example
 * camelToKebab('backgroundColor') // 'background-color'
 * camelToKebab('zIndex') // 'z-index'
 */
function camelToKebab(str: string): string {
    return str.replaceAll(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

/**
 * Convert camelCase to snake_case.
 * Handles consecutive uppercase letters intelligently.
 * 
 * @example
 * camelToSnake('backgroundColor') // 'background_color'
 * camelToSnake('HTMLParser') // 'html_parser'
 * camelToSnake('parseHTMLString') // 'parse_html_string'
 */
export function camelToSnake(str: string): string {
    let result = '';

    for (let i = 0; i < str.length; i++) {
        const char = str[i];
        const nextChar = i < str.length - 1 ? str[i + 1] : '';

        if (char >= 'A' && char <= 'Z') {
            if (i > 0) {
                const prevChar = str[i - 1];
                // Don't add underscore between consecutive uppercase letters
                // unless it's the last uppercase before a lowercase
                const isInUpperSequence =
                    prevChar >= 'A' && prevChar <= 'Z' && nextChar >= 'A' && nextChar <= 'Z';

                if (!isInUpperSequence) {
                    result += '_';
                }
            }
            result += char.toLowerCase();
        } else {
            result += char;
        }
    }

    return result;
}

/**
 * Internal helper to convert object properties to HTML data attributes.
 * Transforms camelCase keys to kebab-case with a prefix.
 * 
 * @param props - Source object with properties to convert
 * @param extendSchema - Schema defining which properties to include
 * @param prefix - Attribute prefix (default: 'data')
 * @returns Object with data-* attributes ready for spreading
 */
function toDataAttributes<T extends object, S extends object>(
    props: T,
    extendSchema: S,
    prefix: string = 'data'
): Record<string, string | undefined> {
    const schemaKeys = new Set(Object.keys(extendSchema));
    const result: Record<string, string | undefined> = {};

    for (const key in props) {
        if (Object.prototype.hasOwnProperty.call(props, key)) {
            const isInSchema = schemaKeys.has(key);
            if (isInSchema && props[key as keyof T] != undefined) {
                const dataKey = `${prefix}-${camelToKebab(key)}`;
                const value = props[key as keyof T];

                result[dataKey] = String(value);
            }
        }
    }

    return result;
}

/**
 * Convert selected properties to HTML data attributes.
 * Perfect for passing state to CSS or JavaScript without props drilling.
 * 
 * @example
 * const attrs = dataProps(
 *   { isOpen: true, maxHeight: 300 },
 *   { isOpen: true, maxHeight: true }
 * );
 * // Returns: { 'data-is-open': 'true', 'data-max-height': '300' }
 * 
 * // Usage in JSX:
 * <div {...attrs} />
 */
export const dataProps = <T extends object, S extends object>(
    props: T,
    schema: S,
    prefix: string = 'data'
) => toDataAttributes(props, schema, prefix);

/**
 * Create a debounced version of a function.
 * Delays execution until after wait milliseconds have elapsed since last call.
 * 
 * @param fn - Function to debounce
 * @param delay - Delay in milliseconds
 * @returns Debounced function
 * 
 * @example
 * const debouncedSearch = createDebounce((query: string) => {
 *   console.log('Searching:', query);
 * }, 300);
 * 
 * // Rapid calls...
 * debouncedSearch('h');
 * debouncedSearch('he');
 * debouncedSearch('hello'); // Only this executes after 300ms
 */
export function createDebounce<T extends (...args: never[]) => void>(fn: T, delay: number): T {
    let timeoutId: NodeJS.Timeout;

    return ((...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn(...args), delay);
    }) as T;
}
