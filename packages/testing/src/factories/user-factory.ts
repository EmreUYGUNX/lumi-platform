import { faker } from "@faker-js/faker";

export interface UserFactoryInput {
  id?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  createdAt?: Date;
}

export interface UserFactoryOutput {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  createdAt: Date;
}

export function createUserFactory(overrides: UserFactoryInput = {}): UserFactoryOutput {
  return {
    id: overrides.id ?? faker.string.uuid(),
    email: overrides.email ?? faker.internet.email().toLowerCase(),
    firstName: overrides.firstName ?? faker.person.firstName(),
    lastName: overrides.lastName ?? faker.person.lastName(),
    createdAt: overrides.createdAt ?? new Date(),
  } satisfies UserFactoryOutput;
}
