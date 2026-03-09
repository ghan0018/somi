/**
 * setup.ts — MongoDB Memory Server lifecycle helpers.
 *
 * Import `startDb` / `stopDb` / `clearDb` in test files that need a real
 * Mongoose connection. The memory server URI is patched into process.env so
 * that config/env.ts (which has already been loaded via setupFiles) still has
 * a valid MONGODB_URI, and we reconnect Mongoose to the new URI.
 *
 * Uses MongoMemoryReplSet (single-node replica set) so that services that use
 * MongoDB multi-document transactions (session.withTransaction) work correctly
 * in tests.
 */
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let mongod: MongoMemoryReplSet | undefined;

export async function startDb(): Promise<void> {
  mongod = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const uri = mongod.getUri();

  // Override the placeholder URI that jest.setup.ts set
  process.env['MONGODB_URI'] = uri;

  await mongoose.connect(uri);
}

export async function stopDb(): Promise<void> {
  await mongoose.disconnect();
  if (mongod) {
    await mongod.stop({ doCleanup: true });
  }
}

export async function clearDb(): Promise<void> {
  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    await collections[key]!.deleteMany({});
  }
}
