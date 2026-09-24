import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { connectStorageEmulator, getStorage } from 'firebase/storage';
import { environment } from '../../environments/environment';

/** Instâncias únicas do SDK. Os services importam daqui. */
export const app = initializeApp(environment.firebase);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export const usandoEmuladores = environment.usarEmuladores && location.hostname === 'localhost';
if (usandoEmuladores) {
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, 'localhost', 8080);
  connectStorageEmulator(storage, 'localhost', 9199);
}

export const firebaseConfigurado = usandoEmuladores || !environment.firebase.apiKey.startsWith('COLE_');
