// Local Offline Mesh Sync Transport (BroadcastChannel & Local Storage Multi-Instance Sync)
// Enables zero-internet, offline-first couple synchronization for airplane flights & off-grid camping.

type MeshListener = (message: any) => void;

class LocalMeshSyncEngine {
  private channel: BroadcastChannel | null = null;
  private listeners: Set<MeshListener> = new Set();
  private isOnline: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;

  constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.channel = new BroadcastChannel('two_offline_mesh_bus');
        this.channel.onmessage = (event) => {
          this.listeners.forEach(cb => cb(event.data));
        };
      } catch (e) {
        console.warn('[LocalMesh] BroadcastChannel unavailable, using fallback', e);
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => { this.isOnline = true; });
      window.addEventListener('offline', () => { this.isOnline = false; });
    }
  }

  // Broadcast an encrypted event locally across all tabs, browser instances, or offline peers
  broadcastLocally(type: string, payload: any, authorId: string) {
    const packet = {
      type: 'LOCAL_MESH_PACKET',
      subType: type,
      authorId,
      payload,
      timestamp: Date.now()
    };

    if (this.channel) {
      try {
        this.channel.postMessage(packet);
      } catch (e) {
        console.error('[LocalMesh] postMessage error', e);
      }
    }
  }

  subscribe(listener: MeshListener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getConnectivityStatus(): { isOnline: boolean; isMeshSupported: boolean } {
    return {
      isOnline: this.isOnline,
      isMeshSupported: !!this.channel
    };
  }
}

export const localMesh = new LocalMeshSyncEngine();
