import { useState, useEffect } from 'react';
import { readStoredProfileData } from '../lib/core/session';

export function useSession() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const data = readStoredProfileData();
    setProfile(data);
    setLoading(false);
  }, []);

  return { profile, loading };
}
