/**
 * Shortens a string to a specified length, adding an ellipsis if it exceeds that length.
 */
export function shortenString(str: string, maxLength: number): string {
    if (str.length <= maxLength) return str;
    return str.slice(0, maxLength - 3) + '...';
}
