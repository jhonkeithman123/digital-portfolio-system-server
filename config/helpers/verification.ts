import type { UserRow } from "../../types/db";

type VerificationUser = Pick<
  UserRow,
  "verification_code" | "verification_expiry"
> & {
  verification_expiry: Date | string | null;
};

export interface GeneratedVerificationCode {
  code: string;
  expiry: Date;
  formatted: string;
  shouldUpdate: boolean;
}

/**
 * Generates a new verification code and expiry if the current one is missing or expired.
 */
export function generateVerificationCode(
  user: VerificationUser,
  durationMs: number = 10 * 60 * 1000
): GeneratedVerificationCode {
  const now = new Date();
  const expiryDate = user.verification_expiry
    ? new Date(user.verification_expiry)
    : null;

  const stillValid =
    !!user.verification_code && !!expiryDate && now < expiryDate;

  if (stillValid && expiryDate) {
    const formatted = expiryDate.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
    return {
      code: user.verification_code as string,
      expiry: expiryDate,
      formatted,
      shouldUpdate: false,
    };
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiry = new Date(now.getTime() + durationMs);
  const formatted = expiry.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return { code, expiry, formatted, shouldUpdate: true };
}

/**
 * Validates a submitted verification code against the stored one and expiry.
 */
export function isVerificationCodeValid(
  user: VerificationUser,
  submittedCode: string
): boolean {
  const now = new Date();
  const expiryDate = user.verification_expiry
    ? new Date(user.verification_expiry)
    : null;

  return (
    user.verification_code === submittedCode && !!expiryDate && now < expiryDate
  );
}
