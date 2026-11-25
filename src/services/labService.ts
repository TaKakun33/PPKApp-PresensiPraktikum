import { doc, getDoc, serverTimestamp, updateDoc } from '@react-native-firebase/firestore';

import { auth, db } from '../lib/firebase';
import { createAppError, withTimeout } from './serviceUtils';

export const LAB_CODES = ['A', 'AP', 'B', 'C', 'D'] as const;
export type LabCode = (typeof LAB_CODES)[number];

export type LabLocation = {
  kode: LabCode;
  exists: boolean;
  nama: string | null;
  lat: number | null;
  lng: number | null;
  radiusMeter: number | null;
};

export type LabLocationInput = {
  lat: number;
  lng: number;
  radiusMeter: number;
};

const WRITE_TIMEOUT_MS = 15000;

function isLabCode(code: string): code is LabCode {
  return LAB_CODES.some((labCode) => labCode === code);
}

function readOptionalNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function validateLocation({ lat, lng, radiusMeter }: LabLocationInput): void {
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    throw createAppError('app/invalid-input', 'Latitude harus berupa angka antara -90 dan 90.');
  }
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    throw createAppError('app/invalid-input', 'Longitude harus berupa angka antara -180 dan 180.');
  }
  if (!Number.isFinite(radiusMeter) || radiusMeter < 10 || radiusMeter > 200) {
    throw createAppError('app/invalid-input', 'Radius harus berupa angka antara 10 dan 200 meter.');
  }
}

/** Read the five fixed lab documents without creating missing documents or inventing values. */
export async function getLabs(): Promise<LabLocation[]> {
  const snapshots = await Promise.all(
    LAB_CODES.map(async (kode) => ({
      kode,
      snapshot: await getDoc(doc(db, 'labs', kode)),
    })),
  );

  return snapshots.map(({ kode, snapshot }) => {
    const data = snapshot.data();
    return {
      kode,
      exists: snapshot.exists(),
      nama: typeof data?.nama === 'string' ? data.nama : null,
      lat: readOptionalNumber(data?.lat),
      lng: readOptionalNumber(data?.lng),
      radiusMeter: readOptionalNumber(data?.radiusMeter),
    };
  });
}

/** Update only location/audit fields on an existing lab document. */
export async function updateLabLocation(
  kode: LabCode,
  location: LabLocationInput,
): Promise<void> {
  if (!isLabCode(kode)) {
    throw createAppError('app/invalid-input', 'Kode lab tidak valid.');
  }
  validateLocation(location);

  const uid = auth.currentUser?.uid;
  if (!uid) {
    throw createAppError('app/unauthenticated', 'Silakan login kembali sebelum menyimpan lokasi.');
  }

  await withTimeout(
    updateDoc(doc(db, 'labs', kode), {
      lat: location.lat,
      lng: location.lng,
      radiusMeter: location.radiusMeter,
      diperbaruiOleh: uid,
      diperbaruiPada: serverTimestamp(),
    }),
    WRITE_TIMEOUT_MS,
  );
}
