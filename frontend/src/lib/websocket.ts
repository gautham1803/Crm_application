/* WebSocket client for real-time updates */

class WebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  connect(teamId: string, userId: string) {
    if (this.ws) {
      this.ws.close();
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // For local development, port 8000 is our backend behind the Vite proxy or direct
    // Since NGINX proxy passes /ws, we can connect to the proxy port
    const host = window.location.host;
    
    // Check if we're in Vite dev server, route to backend directly to bypass HMR proxy issues
    const wsUrl = import.meta.env.DEV 
      ? `ws://localhost:8000/ws/${teamId}?user_id=${userId}`
      : `${protocol}//${host}/ws/${teamId}?user_id=${userId}`;

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log('WebSocket Message Received:', message);
        this.handleMessage(message);
      } catch (error) {
        // If it's a "pong" string, ignore
        if (event.data !== 'pong') {
          console.error('Failed to parse WebSocket message', error);
        }
      }
    };

    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
      this.attemptReconnect(teamId, userId);
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket Error:', error);
    };
  }

  private handleMessage(message: { type: string; data: any }) {
    switch (message.type) {
      case 'approval_created':
        // If an approval is created, we can dispatch to the Zustand store
        // Or if we use TanStack Query, we might globally invalidate fetching
        // For now, we'll increment a notification counter if we had one.
        console.log('Approval created by agent:', message.data);
        break;
      
      case 'deal_stage_changed':
        console.log('Deal stage updated:', message.data);
        break;

      default:
        console.log('Unknown message type:', message.type);
    }
  }

  private attemptReconnect(teamId: string, userId: string) {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Reconnecting WebSocket... Attempt ${this.reconnectAttempts}`);
      setTimeout(() => this.connect(teamId, userId), 2000 * this.reconnectAttempts);
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export const wsClient = new WebSocketClient();
