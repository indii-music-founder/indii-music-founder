import { useEffect, useState, useCallback, useRef } from 'react';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  Timestamp,
  orderBy,
  onSnapshot
} from 'firebase/firestore';
import { db, auth } from '@/services/firebase';
import { License, LicenseRequest } from '@/services/licensing/types';
import { useStore } from '@/core/store';

export const useLicensing = () => {
  const [licenses, setLicenses] = useState<License[]>([]);
  const [requests, setRequests] = useState<LicenseRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { userProfile } = useStore();

  const fetchLicenses = useCallback(() => {
    if (!userProfile?.id) return;

    setLoading(true);

    const licensesRef = collection(db, 'licenses');
    // Using simple query to avoid composite index requirement
    // We'll filter/sort client-side if needed
    const q = query(
      licensesRef,
      where('userId', '==', userProfile.id)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loadedLicenses = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        startDate: doc.data().startDate?.toDate() || new Date(),
        endDate: doc.data().endDate?.toDate(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date()
      })) as License[];

      // Client-side sort to be safe
      const sortedLicenses = loadedLicenses.sort((a, b) =>
        b.createdAt.getTime() - a.createdAt.getTime()
      );

      setLicenses(sortedLicenses);
      setLoading(false);
    }, (err) => {
      console.error('Error fetching licenses:', err);
      setError(err.message);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userProfile?.id]);

  useEffect(() => {
    const unsubscribe = fetchLicenses();
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [fetchLicenses]);

  const createLicense = async (licenseData: Omit<License, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      setLoading(true);
      const docRef = await addDoc(collection(db, 'licenses'), {
        ...licenseData,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        startDate: Timestamp.fromDate(licenseData.startDate),
        endDate: licenseData.endDate ? Timestamp.fromDate(licenseData.endDate) : null
      });
      return docRef.id;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    licenses,
    requests,
    loading,
    error,
    createLicense
  };
};
