import NetInfo from '@react-native-community/netinfo';
import { useEffect, useRef, useState } from 'react';

/**
 * `isOnline` requires `isInternetReachable !== false`, not merely a connected
 * interface: a captive-portal Wi-Fi reports "connected" while every request fails.
 */

export interface NetworkStatus {
  isOnline: boolean;
  connectionType: string;
  /** Flips true only on the transition offline → online, which is the sync trigger. */
  justCameOnline: boolean;
}

export const useNetworkStatus = (): NetworkStatus => {
  const [isOnline, setIsOnline] = useState(true);
  const [connectionType, setConnectionType] = useState('unknown');
  const [justCameOnline, setJustCameOnline] = useState(false);
  const wasOnline = useRef(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = Boolean(state.isConnected) && state.isInternetReachable !== false;

      setConnectionType(state.type);
      setIsOnline(online);
      setJustCameOnline(online && !wasOnline.current);
      wasOnline.current = online;
    });

    return unsubscribe;
  }, []);

  return { isOnline, connectionType, justCameOnline };
};
