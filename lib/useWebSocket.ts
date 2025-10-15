"use client";

import { useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { IWebSocketMessage, IMessage, IUser } from './type';

interface UseWebSocketProps {
  conversationId: number | null;
  onMessage: (message: IMessage) => void;
  onTyping: (user: IUser, isTyping: boolean) => void;
  onUserStatus: (users: IUser[], status: 'online' | 'offline') => void;
}

export const useWebSocket = ({
  conversationId,
  onMessage,
  onTyping,
  onUserStatus
}: UseWebSocketProps) => {
  const { accessToken, user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = () => {
    if (!conversationId || !accessToken) return;

    try {
      // Close existing connection
      if (wsRef.current) {
        wsRef.current.close();
      }

      // Create WebSocket connection with token
      const wsBaseUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000/ws';
      const wsUrl = `${wsBaseUrl}/chat/${conversationId}/?token=${accessToken}`;
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('✅ WebSocket connected');
        setIsConnected(true);
        setConnectionError(null);
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data: IWebSocketMessage = JSON.parse(event.data);
          
          switch (data.type) {
            case 'chat_message':
              if (data.message && data.user && data.timestamp) {
                const message: IMessage = {
                  id: Date.now(), // Temporary ID
                  content: data.message,
                  sender: data.user,
                  conversation: conversationId,
                  created_at: data.timestamp
                };
                onMessage(message);
              }
              break;
              
            case 'typing':
              if (data.user) {
                onTyping(data.user, data.is_typing || false);
              }
              break;
              
            case 'online_status':
              if (data.online_users && data.status) {
                onUserStatus(data.online_users, data.status);
              }
              break;
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      wsRef.current.onclose = (event) => {
        console.log('❌ WebSocket disconnected:', event.code);
        setIsConnected(false);
        
        // Auto-reconnect after 3 seconds
        if (event.code !== 1000) { // Don't reconnect if closed normally
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, 3000);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionError('Connection failed');
        setIsConnected(false);
      };

    } catch (error) {
      console.error('Error creating WebSocket:', error);
      setConnectionError('Failed to connect');
    }
  };

  const disconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close(1000, 'User disconnected');
      wsRef.current = null;
    }
    setIsConnected(false);
  };

  const sendMessage = (message: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && user) {
      wsRef.current.send(JSON.stringify({
        type: 'chat_message',
        message: message,
        user: user.id
      }));
    }
  };

  const sendTyping = (receiverId: number, isTyping: boolean = true) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'typing',
        receiver: receiverId,
        is_typing: isTyping
      }));
    }
  };

  // Connect when conversationId or accessToken changes
  useEffect(() => {
    if (conversationId && accessToken) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [conversationId, accessToken]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  return {
    isConnected,
    connectionError,
    sendMessage,
    sendTyping,
    reconnect: connect
  };
};
