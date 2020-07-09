/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Firestore } from './database';
import { DatabaseInfo } from '../../../src/core/database_info';
import {
  FirestoreClient,
  PersistenceSettings
} from '../../../src/core/firestore_client';
import { Code, FirestoreError } from '../../../src/util/error';
import {
  ComponentProvider,
  MemoryComponentProvider
} from '../../../src/core/component_provider';

const firestoreClientInstances = new Map<Firestore, Promise<FirestoreClient>>();

// settings() defaults:
export const DEFAULT_HOST = 'firestore.googleapis.com';
export const DEFAULT_SSL = true;

export function getFirestoreClient(
  firestore: Firestore
): Promise<FirestoreClient> {
  if (firestore._terminated) {
    throw new FirestoreError(
      Code.FAILED_PRECONDITION,
      'The client has already been terminated.'
    );
  }

  if (!firestoreClientInstances.has(firestore)) {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    initializeFirestoreClient(firestore, new MemoryComponentProvider(), {
      durable: false
    });
  }
  return firestoreClientInstances.get(firestore)!;
}

export function initializeFirestoreClient(
  firestore: Firestore,
  componentProvider: ComponentProvider,
  persistenceSettings: PersistenceSettings
): Promise<void> {
  if (firestore._terminated || hasFirestoreClient(firestore)) {
    throw new FirestoreError(
      Code.FAILED_PRECONDITION,
      'Firestore has already been started and persistence can no longer ' +
        'be enabled. You can only enable persistence before calling ' +
        'any other methods on a Firestore object.'
    );
  }

  const settings = firestore._getSettings();
  const databaseInfo = new DatabaseInfo(
    firestore._databaseId,
    /* persistenceKey= */ firestore._persistenceKey,
    settings.host ?? DEFAULT_HOST,
    settings.ssl ?? DEFAULT_SSL,
    /** forceLongPolling= */ false
  );
  const firestoreClient = new FirestoreClient(
    firestore._credentials,
    firestore._queue
  );
  const initializationPromise = firestoreClient.start(
    databaseInfo,
    componentProvider,
    persistenceSettings
  );
  firestoreClientInstances.set(
    firestore,
    initializationPromise.then(() => firestoreClient)
  );
  return initializationPromise;
}

export function hasFirestoreClient(firestore: Firestore): boolean {
  return firestoreClientInstances.has(firestore);
}

export async function removeFirestoreClient(
  firestore: Firestore
): Promise<void> {
  const firestoreClient = await firestoreClientInstances.get(firestore);
  if (firestoreClient) {
    firestoreClientInstances.delete(firestore);
    return firestoreClient.terminate();
  }
}
