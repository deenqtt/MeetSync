import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Sanitize WhatsApp phone number string
 * Removes spaces, hyphens, and ensures proper formatting
 * @param phone - Raw phone number string
 * @returns Sanitized phone number or throws error if invalid
 */
export function sanitizeWhatsappPhoneNumberStr(phone: string): string {
  if (!phone || typeof phone !== 'string') {
    throw new Error('Phone number must be a non-empty string');
  }

  // Remove all non-digit characters except + at the beginning
  let sanitized = phone.trim();

  // Handle international format with +
  if (sanitized.startsWith('+')) {
    sanitized = sanitized.replace(/[^\d]/g, '');
    sanitized = '+' + sanitized;
  } else {
    // Remove all non-digit characters
    sanitized = sanitized.replace(/\D/g, '');
  }

  // Basic validation - should have at least 10 digits (excluding +)
  const digitsOnly = sanitized.replace(/^\+/, '');
  if (digitsOnly.length < 10) {
    throw new Error('Phone number must have at least 10 digits');
  }

  // Ensure it starts with + for international format if not present
  if (!sanitized.startsWith('+')) {
    // Assume Indonesian numbers (62) if no country code
    if (sanitized.startsWith('0')) {
      sanitized = '62' + sanitized.substring(1);
    }
    sanitized = '+' + sanitized;
  }

  return sanitized;
}
