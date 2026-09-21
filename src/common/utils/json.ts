import { Prisma } from '@prisma/client';

/**
 * Safely converts an arbitrary value into Prisma's InputJsonValue (used for
 * Json columns). Round-trips through JSON so class instances / Maps serialize
 * cleanly and the result satisfies Prisma's strict types.
 */
export function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
