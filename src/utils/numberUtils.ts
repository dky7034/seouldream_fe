// src/utils/numberUtils.ts

/**
 * Normalizes a value that might come from a number input field (which can return empty strings)
 * to either a number or undefined.
 * - Converts empty strings to undefined.
 * - Converts valid numbers (as string or number type) to number.
 * - Returns undefined for null or non-numeric values.
 *
 * @param value The input value, potentially a number, string, or null.
 * @returns A number if the value is a valid non-empty number, otherwise undefined.
 */
export const normalizeNumberInput = (value: number | string | null | undefined): number | undefined => {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }
  const parsed = Number(value);
  if (isNaN(parsed)) {
    return undefined; // Not a valid number
  }
  return parsed;
};
