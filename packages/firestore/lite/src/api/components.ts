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

import {
  Datastore,
  newDatastore,
  terminateDatastore
} from '../../../src/remote/datastore';
import { newConnection } from '../../../src/platform/connection';
import { newSerializer } from '../../../src/platform/serializer';
import { Firestore } from './database';
import { DatabaseInfo } from '../../../src/core/database_info';

const datastoreInstances = new Map<Firestore, Promise<Datastore>>();

// settings() defaults:
export const DEFAULT_HOST = 'firestore.googleapis.com';
export const DEFAULT_SSL = true;

export function getDatastore(firestore: Firestore): Promise<Datastore> {
  if (!datastoreInstances.has(firestore)) {
    const settings = firestore._getSettings();
    const databaseInfo = new DatabaseInfo(
      firestore._databaseId,
      firestore._persistenceKey,
      settings.host ?? DEFAULT_HOST,
      settings.ssl ?? DEFAULT_SSL,
      /* forceLongPolling= */ false
    );
    const datastorePromise = newConnection(databaseInfo).then(connection => {
      const serializer = newSerializer(databaseInfo.databaseId);
      return newDatastore(connection, firestore._credentials, serializer);
    });
    datastoreInstances.set(firestore, datastorePromise);
  }
  return datastoreInstances.get(firestore)!;
}

export async function removeDatastore(firestore: Firestore): Promise<void> {
  const datastore = await datastoreInstances.get(firestore);
  if (datastore) {
    datastoreInstances.delete(firestore);
    return terminateDatastore(datastore);
  }
}
