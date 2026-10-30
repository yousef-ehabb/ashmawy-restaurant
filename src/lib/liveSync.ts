// Global Cross-Tab Sync via BroadcastChannel & window storage events
export const LIVE_SYNC_CHANNEL = 'ashmawy_live_sync';

export type LiveSyncEventType =
  | 'menu_availability_updated'
  | 'operational_settings_updated'
  | 'orders_updated';

export interface LiveSyncMessage {
  type: LiveSyncEventType;
  timestamp: number;
  payload?: any;
}

let broadcastChannel: BroadcastChannel | null = null;

function getBroadcastChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined') return null;
  if (!('BroadcastChannel' in window)) return null;
  if (!broadcastChannel) {
    try {
      broadcastChannel = new BroadcastChannel(LIVE_SYNC_CHANNEL);
    } catch {
      broadcastChannel = null;
    }
  }
  return broadcastChannel;
}

/**
 * Broadcast an event to all open browser tabs (e.g. from Admin to Storefront)
 */
export function broadcastLiveSync(type: LiveSyncEventType, payload?: any) {
  if (typeof window === 'undefined') return;

  const msg: LiveSyncMessage = {
    type,
    timestamp: Date.now(),
    payload,
  };

  // 1. BroadcastChannel (primary instant cross-tab channel)
  try {
    const ch = getBroadcastChannel();
    if (ch) {
      ch.postMessage(msg);
    }
  } catch {}

  // 2. localStorage fallback for cross-tab notifications (triggers 'storage' event on other tabs)
  try {
    localStorage.setItem(
      'ashmawy_last_sync_event',
      JSON.stringify(msg)
    );
  } catch {}
}

/**
 * Listen for live sync events across tabs
 */
export function subscribeLiveSync(callback: (msg: LiveSyncMessage) => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const handleStorage = (e: StorageEvent) => {
    if (e.key === 'ashmawy_last_sync_event' && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue) as LiveSyncMessage;
        callback(parsed);
      } catch {}
    }
  };

  const ch = getBroadcastChannel();
  const handleMessage = (event: MessageEvent) => {
    if (event.data && typeof event.data === 'object' && event.data.type) {
      callback(event.data as LiveSyncMessage);
    }
  };

  if (ch) {
    ch.addEventListener('message', handleMessage);
  }
  window.addEventListener('storage', handleStorage);

  return () => {
    if (ch) {
      ch.removeEventListener('message', handleMessage);
    }
    window.removeEventListener('storage', handleStorage);
  };
}
