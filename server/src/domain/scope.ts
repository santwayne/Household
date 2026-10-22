// Every domain function takes a household id and scopes ALL queries by it (Developer Brief section 8).
export type Scope = { householdId: string };
export class NotFoundError extends Error {}
export class ValidationError extends Error {}
export class ConsentError extends Error {}
