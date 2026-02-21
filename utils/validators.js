/**
 * Validation utilities for authentication
 * Used by AuthContext and auth screens
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validates email format
 * @param {string} email
 * @returns {{ valid: boolean, error: string|null }}
 */
export function validateEmail(email) {
  if (!email || !email.trim()) {
    return { valid: false, error: 'Email is required' };
  }
  if (!EMAIL_REGEX.test(email.trim())) {
    return { valid: false, error: 'Please enter a valid email address' };
  }
  return { valid: true, error: null };
}

/**
 * Validates password is not empty (for login)
 * @param {string} password
 * @returns {{ valid: boolean, error: string|null }}
 */
export function validatePasswordNotEmpty(password) {
  if (!password) {
    return { valid: false, error: 'Password is required' };
  }
  return { valid: true, error: null };
}

/**
 * Password strength rules for signup
 */
export const PASSWORD_RULES = [
  { key: 'length', label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { key: 'uppercase', label: 'At least 1 uppercase letter', test: (p) => /[A-Z]/.test(p) },
  { key: 'number', label: 'At least 1 number', test: (p) => /[0-9]/.test(p) },
];

/**
 * Validates password strength for signup
 * @param {string} password
 * @returns {{ valid: boolean, error: string|null, passed: string[] }}
 */
export function validatePasswordStrength(password) {
  if (!password) {
    return { valid: false, error: 'Password is required', passed: [] };
  }

  const passed = PASSWORD_RULES.filter((rule) => rule.test(password)).map((r) => r.key);
  const failed = PASSWORD_RULES.filter((rule) => !rule.test(password));

  if (failed.length > 0) {
    return { valid: false, error: failed[0].label, passed };
  }

  return { valid: true, error: null, passed };
}

/**
 * Validates that passwords match
 * @param {string} password
 * @param {string} confirmPassword
 * @returns {{ valid: boolean, error: string|null }}
 */
export function validatePasswordsMatch(password, confirmPassword) {
  if (password !== confirmPassword) {
    return { valid: false, error: 'Passwords do not match' };
  }
  return { valid: true, error: null };
}

/**
 * Calculates password strength score (0-4)
 * @param {string} password
 * @returns {{ score: number, label: string, color: string }}
 */
export function getPasswordStrength(password) {
  if (!password) return { score: 0, label: '', color: '#64748b' };

  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  const levels = [
    { label: 'Very Weak', color: '#ef4444' },
    { label: 'Weak', color: '#f97316' },
    { label: 'Fair', color: '#eab308' },
    { label: 'Strong', color: '#22c55e' },
    { label: 'Very Strong', color: '#16a34a' },
  ];

  return { score, ...levels[score] };
}

/**
 * Maps Supabase auth errors to user-friendly messages
 * @param {object} error - Supabase error object
 * @returns {string}
 */
export function mapAuthError(error) {
  if (!error) return 'An unexpected error occurred';

  const message = error.message || '';
  const status = error.status;

  // Rate limiting
  if (status === 429 || message.includes('rate limit')) {
    return 'Too many attempts. Please wait a moment and try again.';
  }

  // Invalid credentials
  if (message.includes('Invalid login credentials')) {
    return 'Incorrect email or password. Please try again.';
  }

  // Email not confirmed
  if (message.includes('Email not confirmed')) {
    return 'Please verify your email address before logging in.';
  }

  // User already registered
  if (message.includes('User already registered') || message.includes('already been registered')) {
    return 'An account with this email already exists. Try logging in instead.';
  }

  // Signup disabled
  if (message.includes('Signups not allowed')) {
    return 'New account registration is currently disabled.';
  }

  // Invalid email
  if (message.includes('invalid') && message.includes('email')) {
    return 'Please enter a valid email address.';
  }

  // Password too short (Supabase default minimum is 6)
  if (message.includes('Password should be at least')) {
    return 'Password is too short. Please use at least 8 characters.';
  }

  // Network errors
  if (message.includes('Failed to fetch') || message.includes('NetworkError') || message.includes('network')) {
    return 'Connection failed. Please check your internet and try again.';
  }

  // Generic fallback
  return message || 'Something went wrong. Please try again.';
}
