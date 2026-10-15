export const PASSWORD_POLICY_MESSAGE = "Use at least 10 characters with upper, lower, and a number";

export function passwordMeetsPolicy(password: string) {
  return password.length >= 10 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password);
}

export function assertPasswordPolicy(password: string) {
  if (!passwordMeetsPolicy(password)) throw new Error(PASSWORD_POLICY_MESSAGE);
}
