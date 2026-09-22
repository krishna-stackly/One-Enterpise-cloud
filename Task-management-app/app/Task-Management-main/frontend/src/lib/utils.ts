import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function initials(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
}

export function fullName(firstName: string, lastName: string) {
  return `${firstName} ${lastName}`
}

export function formatHours(hours: number) {
  if (Number.isInteger(hours)) return `${hours}h`
  return `${hours.toFixed(1)}h`
}
