const usedPathIds: string[] = [];
export function formatDevicePathId(devicePath: string): string {
    // Remove all symbols and spaces, convert to lowercase and replace with hyphens (no double hyphens)
    // Ensure the result is unique
    const formatted = devicePath.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
    let uniqueId = formatted;
    let counter = 1;
    while (usedPathIds.includes(uniqueId)) {
        uniqueId = `${formatted}-${counter}`;
        counter++;
    }

    usedPathIds.push(uniqueId);
    return uniqueId;
}
