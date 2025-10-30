/**
 * Generates a new verification code and expiry if the current one is missing or expired.
 * @param {Object} user - The user object from the database.
 * @param {number} durationMs - Expiry duration in milliseconds (default: 10 minutes).
 * @returns {{ code: string, expiry: Date, formatted: string, shouldUpdate: boolean }}
 */
export function generateVerificationCode(user, durationMs = 10 * 60 * 1000) {
  const now = new Date();
  const stillValid =
    user.verification_code &&
    user.verification_expiry &&
    now < user.verification_expiry;

  if (stillValid) {
    const formatted = new Date(user.verification_expiry).toLocaleTimeString(
      "en-US",
      {
        hour: "2-digit",
        minute: "2-digit",
      }
    );

    return {
      code: user.verification_code,
      expiry: new Date(user.verification_expiry),
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
 * @param {Object} user - The user object from the database.
 * @param {string} submittedCode - The code submitted by the user.
 * @returns {boolean} - True if valid, false if expired or mismatched.
 */
export function isVerificationCodeValid(user, submittedCode) {
  const now = new Date();
  return (
    user.verification_code === submittedCode &&
    user.verification_expiry &&
    now < new Date(user.verification_expiry)
  );
}
