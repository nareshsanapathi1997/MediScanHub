/** Fields safe to return from a user row. Never include passwordHash. */
export const userPublicSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  status: true,
} as const;
