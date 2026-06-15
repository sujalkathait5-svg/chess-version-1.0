// frontend/src/services/socketService.ts
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

class SocketService {
  private socket: Socket | null = null;
  private token: string | null = null;

  connect(token?: string) {
    if (this.socket) {
      if (this.token === token) return this.socket;
      this.disconnect();
    }

    this.token = token || null;

    this.socket = io(SOCKET_URL, {
      auth: { token },
      withCredentials: true,
      transports: ['websocket', 'polling']
    });

    this.socket.on('connect', () => {
      console.log('Socket connected:', this.socket?.id);
    });

    this.socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  getSocket() {
    return this.socket;
  }

  // Helper methods for typed events could go here
  findMatch(timeControl: any) {
    if (this.socket) {
      this.socket.emit('find_match', { timeControl });
    }
  }

  cancelMatch() {
    if (this.socket) {
      this.socket.emit('cancel_match');
    }
  }

  makeMove(roomId: string, source: string, target: string, promotion?: string) {
    if (this.socket) {
      this.socket.emit('make_move', { roomId, source, target, promotion });
    }
  }

  offerDraw(roomId: string) {
    if (this.socket) {
      this.socket.emit('offer_draw', { roomId });
    }
  }

  resign(roomId: string) {
    if (this.socket) {
      this.socket.emit('resign', { roomId });
    }
  }
}

export const socketService = new SocketService();
