export function getEmployeeInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) return '';

  const firstInitial = parts[0].charAt(0).toUpperCase();
  const lastInitial = parts.at(-1)?.charAt(0).toUpperCase() ?? '';

  return parts.length === 1 ? firstInitial : `${firstInitial}${lastInitial}`;
}
