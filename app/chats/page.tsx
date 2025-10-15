"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { chatAPI } from '@/lib/api';
import { useWebSocket } from '@/lib/useWebSocket';
import { IConversation, IMessage, IUser } from '@/lib/type';
import NewChatModal from '@/components/NewChatModal';
import NewGroupChatModal from '@/components/NewGroupChatModal';
import GroupManagementModal from '@/components/GroupManagementModal';

export default function ChatsPage() {
  const { user, isAuthenticated } = useAuth();
  const [conversations, setConversations] = useState<IConversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<IConversation | null>(null);
  const [messages, setMessages] = useState<IMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState<IUser[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<IUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true); // Show sidebar by default on mobile
  const [showChat, setShowChat] = useState(false);
  const [newChatModalOpen, setNewChatModalOpen] = useState(false);
  const [newGroupChatModalOpen, setNewGroupChatModalOpen] = useState(false);
  const [groupManagementModalOpen, setGroupManagementModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const typingDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // WebSocket handlers
  const handleNewMessage = (message: IMessage) => {
    setMessages(prev => [...prev, message]);
  };

  const handleTyping = (typingUser: IUser, isTyping: boolean) => {
    // Don't show typing indicator for current user (they know they're typing)
    if (typingUser.id === user?.id) {
      return;
    }
    
    if (isTyping) {
      setTypingUsers(prev => {
        const filtered = prev.filter(u => u.id !== typingUser.id);
        return [...filtered, typingUser];
      });
    } else {
      setTypingUsers(prev => prev.filter(u => u.id !== typingUser.id));
    }
  };

  const handleUserStatus = (users: IUser[], status: 'online' | 'offline') => {
    setOnlineUsers(users);
  };

  // WebSocket connection
  const { isConnected, connectionError, sendMessage: sendWSMessage, sendTyping } = useWebSocket({
    conversationId: selectedConversation?.id || null,
    onMessage: handleNewMessage,
    onTyping: handleTyping,
    onUserStatus: handleUserStatus
  });

  // Load conversations on mount
  useEffect(() => {
    if (isAuthenticated) {
      loadConversations();
    }
  }, [isAuthenticated]);

  // Load messages when conversation changes
  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation.id);
      // Show chat area on mobile/tablet when conversation is selected
      setShowChat(true);
      // Close sidebar on mobile when conversation is selected
      setSidebarOpen(false);
    }
  }, [selectedConversation]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (typingDebounceRef.current) {
        clearTimeout(typingDebounceRef.current);
      }
    };
  }, []);


  const loadConversations = async () => {
    try {
      setLoading(true);
      const data = await chatAPI.getConversations();
      setConversations(data);
      // Don't auto-select first conversation - let user choose
    } catch (err) {
      setError('Failed to load conversations');
      console.error('Error loading conversations:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (conversationId: number) => {
    try {
      const data = await chatAPI.getMessages(conversationId);
      setMessages(data);
    } catch (err) {
      setError('Failed to load messages');
      console.error('Error loading messages:', err);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return;

    try {
      // Send via WebSocket only - it will handle database saving and broadcasting
      sendWSMessage(newMessage.trim());
      
      setNewMessage('');
    } catch (err) {
      setError('Failed to send message');
      console.error('Error sending message:', err);
    }
  };

  const handleTypingStart = () => {
    if (!selectedConversation || !user) return;
    
    // Clear existing debounce timeout
    if (typingDebounceRef.current) {
      clearTimeout(typingDebounceRef.current);
    }
    
    // Debounce typing indicator to avoid too many WebSocket messages
    typingDebounceRef.current = setTimeout(() => {
      setIsTyping(true);
      // For group chats, send typing to all participants
      if (selectedConversation.conversation_type === 'group') {
        selectedConversation.participants?.forEach(participant => {
          if (participant.id !== user.id) {
            sendTyping(participant.id, true);
          }
        });
      } else {
        sendTyping(selectedConversation.participants?.find(p => p.id !== user.id)?.id || 0, true);
      }
    }, 500); // Wait 500ms before sending typing indicator
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Set timeout to stop typing indicator
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      // For group chats, send typing to all participants
      if (selectedConversation.conversation_type === 'group') {
        selectedConversation.participants?.forEach(participant => {
          if (participant.id !== user.id) {
            sendTyping(participant.id, false);
          }
        });
      } else {
        sendTyping(selectedConversation.participants?.find(p => p.id !== user.id)?.id || 0, false);
      }
    }, 2000); // Stop typing after 2 seconds of inactivity
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleConversationSelect = (conversation: IConversation) => {
    setSelectedConversation(conversation);
    // On mobile/tablet, show chat area when conversation is selected
    setShowChat(true);
    // Close sidebar on mobile/tablet when chat is selected
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleNewConversation = (conversation: IConversation) => {
    setConversations(prev => [conversation, ...prev]);
    setSelectedConversation(conversation);
    setNewChatModalOpen(false);
  };

  const handleNewGroupConversation = (conversation: IConversation) => {
    setConversations(prev => [conversation, ...prev]);
    setSelectedConversation(conversation);
    setNewGroupChatModalOpen(false);
  };

  const handleOpenNewChat = () => {
    if (!isAuthenticated) {
      setError('Please log in to start a new chat');
      return;
    }
    setNewChatModalOpen(true);
  };

  const handleOpenNewGroupChat = () => {
    if (!isAuthenticated) {
      setError('Please log in to start a new group chat');
      return;
    }
    setNewGroupChatModalOpen(true);
  };

  const handleOpenGroupManagement = () => {
    if (!selectedConversation || selectedConversation.conversation_type !== 'group') {
      return;
    }
    setGroupManagementModalOpen(true);
  };

  const handleConversationUpdated = (updatedConversation: IConversation) => {
    setConversations(prev => 
      prev.map(conv => 
        conv.id === updatedConversation.id ? updatedConversation : conv
      )
    );
    setSelectedConversation(updatedConversation);
  };

  // Filter conversations based on search query
  const filteredConversations = conversations.filter(conversation => {
    if (!searchQuery.trim()) return true;
    
    const searchTerm = searchQuery.toLowerCase();
    
    // For group chats, search by group name
    if (conversation.conversation_type === 'group') {
      const groupName = conversation.name?.toLowerCase() || '';
      const lastMessageContent = conversation.last_message?.content.toLowerCase() || '';
      return groupName.includes(searchTerm) || lastMessageContent.includes(searchTerm);
    }
    
    // For direct chats, search by participant names
    const participantNames = conversation.participants
      ?.filter(p => p.id !== user?.id)
      ?.map(p => p.username.toLowerCase())
      ?.join(' ') || '';
    
    const lastMessageContent = conversation.last_message?.content.toLowerCase() || '';
    
    return participantNames.includes(searchTerm) || 
           lastMessageContent.includes(searchTerm);
  });

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800">Please log in to access chats</h1>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading conversations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col lg:flex-row overflow-hidden -mt-14 lg:mt-0">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && showChat && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile Menu Button - Only show when sidebar is closed and no chat is selected */}
      {!sidebarOpen && !showChat && (
        <button 
          onClick={() => setSidebarOpen(true)}
          className="lg:hidden fixed top-16 left-4 z-50 p-3 bg-white/90 backdrop-blur-sm rounded-full shadow-lg hover:bg-white transition-colors min-h-[44px] min-w-[44px]"
          aria-label="Open conversations"
        >
          <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      )}
      
      {/* Sidebar - Conversations List */}
      <div className={`fixed lg:relative inset-y-0 left-0 z-50 lg:z-auto w-full lg:w-1/3 bg-white/80 backdrop-blur-sm border-r border-gray-200/50 flex flex-col shadow-xl h-screen lg:h-screen lg:max-w-sm transform transition-transform duration-300 ease-in-out ${
        sidebarOpen || !showChat ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
        <div className="p-4 sm:p-6 border-b border-gray-200/50 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
          {/* Back to Home Button */}
          <div className="mb-4">
            <button
              onClick={() => window.location.href = '/'}
              className="flex items-center space-x-2 text-blue-100 hover:text-white hover:bg-white/20 px-3 py-2 rounded-lg transition-all duration-200 group"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span className="text-sm font-medium">Back to Home</span>
            </button>
          </div>
          
          <div className="flex items-center justify-between mb-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold truncate">💬 Astro Chat</h1>
              <p className="text-blue-100 mt-1 text-sm sm:text-base truncate">Welcome back, {user?.username}</p>
              <div className="flex items-center mt-2 space-x-2">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`}></div>
                <span className="text-xs text-blue-100">
                  {isConnected ? 'Online' : 'Offline'}
                </span>
                <span className="text-xs text-blue-200 ml-2">
                  {conversations.length} conversation{conversations.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
            {/* Mobile Close Button - Only show when in chat mode */}
            {showChat && (
              <button 
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden p-2 hover:bg-blue-700 rounded-full transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Close conversations"
              >
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          
          {/* New Conversation Buttons */}
          <div className="space-y-2">
            <button
              onClick={handleOpenNewChat}
              className="w-full bg-white/20 hover:bg-white/30 backdrop-blur-sm border border-white/30 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span>Direct Chat</span>
            </button>
            <button
              onClick={handleOpenNewGroupChat}
              className="w-full bg-white/20 hover:bg-white/30 backdrop-blur-sm border border-white/30 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span>Group Chat</span>
            </button>
          </div>
        </div>
        
        {/* Search Bar */}
        <div className="p-4 border-b border-gray-200/50 bg-white/50">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations..."
              className="w-full pl-10 pr-4 py-2 text-gray-950 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white/80 backdrop-blur-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
              >
                <svg className="h-4 w-4 text-gray-400 hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
          {conversations.length === 0 ? (
            <div className="p-4 sm:p-6 text-center text-gray-500">
              <div className="text-4xl sm:text-6xl mb-3 sm:mb-4">💭</div>
              <p className="text-base sm:text-lg font-medium">No conversations yet</p>
              <p className="text-xs sm:text-sm text-gray-400 mt-1">Start a new chat to begin messaging!</p>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-4 sm:p-6 text-center text-gray-500">
              <div className="text-4xl sm:text-6xl mb-3 sm:mb-4">🔍</div>
              <p className="text-base sm:text-lg font-medium">No conversations found</p>
              <p className="text-xs sm:text-sm text-gray-400 mt-1">Try adjusting your search terms</p>
            </div>
          ) : (
            <>
              {/* Conversations Header */}
              <div className="px-4 py-3 bg-gray-50/50 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-700">
                    {searchQuery ? 'Search Results' : 'Recent Conversations'}
                  </h3>
                  <span className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded-full">
                    {filteredConversations.length}
                    {searchQuery && conversations.length !== filteredConversations.length && 
                      ` of ${conversations.length}`
                    }
                  </span>
                </div>
              </div>
              
              {/* Conversations List */}
              <div className="divide-y divide-gray-100/50">
                {filteredConversations.map((conversation) => (
                  <div
                    key={conversation.id}
                    onClick={() => handleConversationSelect(conversation)}
                    className={`p-3 sm:p-4 cursor-pointer transition-all duration-200 hover:bg-blue-50/50 hover:scale-[1.01] sm:hover:scale-[1.02] active:scale-[0.99] sm:active:scale-[0.98] group ${
                      selectedConversation?.id === conversation.id 
                        ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-l-blue-500 shadow-sm' 
                        : 'hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="relative flex-shrink-0">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-sm sm:text-lg shadow-lg">
                        {conversation.conversation_type === 'group' ? (
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                        ) : (
                          conversation.participants
                            ?.filter(p => p.id !== user?.id)
                            ?.map(p => p.username[0])
                            ?.join('')
                            ?.toUpperCase() || '?'
                        )}
                        </div>
                        {/* Online indicator */}
                        <div className="absolute -bottom-1 -right-1 w-3 h-3 sm:w-4 sm:h-4 bg-green-400 border-2 border-white rounded-full"></div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-gray-900 truncate">
                          {conversation.conversation_type === 'group' 
                            ? (conversation.name || 'Unnamed Group')
                            : (conversation.participants
                                ?.filter(p => p.id !== user?.id)
                                ?.map(p => p.username)
                                ?.join(', ') || 'Unknown User')
                          }
                        </p>
                          <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
                            {conversation.last_message && formatTime(conversation.last_message.created_at)}
                          </span>
                        </div>
                        {conversation.last_message && (
                          <p className="text-xs text-gray-600 truncate mt-1">
                            {conversation.last_message.content}
                          </p>
                        )}
                      </div>
                      {/* Arrow indicator */}
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        <svg className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className={`flex-1 flex flex-col bg-white/60 backdrop-blur-sm h-screen lg:h-screen overflow-hidden transition-all duration-300 pt-14 lg:pt-0 ${
        showChat ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
      }`}>
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="bg-white/90 backdrop-blur-sm border-b border-gray-200/50 p-4 sm:p-6 shadow-sm sticky top-0 z-40 lg:top-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3 sm:space-x-4 min-w-0 flex-1">
                  {/* Back Button for Mobile/Tablet */}
                  <button 
                    onClick={() => {
                      setShowChat(false);
                      setSidebarOpen(true); // Show conversation list when going back
                    }}
                    className="lg:hidden p-2 hover:bg-gray-100 rounded-full transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                    aria-label="Back to conversations"
                  >
                    <svg className="w-5 h-5 sm:w-6 sm:h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <div className="relative flex-shrink-0">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-sm sm:text-lg lg:text-xl shadow-lg">
                    {selectedConversation.conversation_type === 'group' ? (
                      <svg className="w-6 h-6 lg:w-8 lg:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    ) : (
                      selectedConversation.participants
                        ?.filter(p => p.id !== user?.id)
                        ?.map(p => p.username[0])
                        ?.join('')
                        ?.toUpperCase() || '?'
                    )}
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-3 h-3 sm:w-4 sm:h-4 lg:w-5 lg:h-5 bg-green-400 border-2 sm:border-3 border-white rounded-full"></div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg sm:text-xl font-bold text-gray-900 truncate">
                      {selectedConversation.conversation_type === 'group' 
                        ? (selectedConversation.name || 'Unnamed Group')
                        : (selectedConversation.participants
                            ?.filter(p => p.id !== user?.id)
                            ?.map(p => p.username)
                            ?.join(', ') || 'Unknown User')
                      }
                    </h2>
                    <div className="flex items-center space-x-2 mt-1">
                      <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}></div>
                      <span className="text-xs sm:text-sm text-gray-600">
                        {isConnected ? 'Active now' : 'Offline'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
                  {/* Group Management Button - Only show for group chats */}
                  {selectedConversation.conversation_type === 'group' && (
                    <button 
                      onClick={handleOpenGroupManagement}
                      className="p-2 hover:bg-gray-100 rounded-full transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                      title="Manage Group"
                    >
                      <svg className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                      </svg>
                    </button>
                  )}
                  <button className="p-2 hover:bg-gray-100 rounded-full transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center">
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  </button>
                  <button className="p-2 hover:bg-gray-100 rounded-full transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center">
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 sm:space-y-4 bg-gradient-to-b from-gray-50/50 to-white/50 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 border-l border-gray-100/50">
              {messages.map((message, index) => {
                const isOwnMessage = message.sender.id === user?.id;
                const prevMessage = messages[index - 1];
                const showAvatar = !prevMessage || prevMessage.sender.id !== message.sender.id;
                const showTimestamp = !prevMessage || 
                  new Date(message.created_at).getTime() - new Date(prevMessage.created_at).getTime() > 300000; // 5 minutes
                
                return (
                  <div key={message.id} className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} mb-4`}>
                    <div className={`flex items-end space-x-2 max-w-xs lg:max-w-md ${isOwnMessage ? 'flex-row-reverse space-x-reverse' : ''}`}>
                      {!isOwnMessage && showAvatar && (
                        <div className="w-8 h-8 bg-gradient-to-br from-gray-400 to-gray-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                          {message.sender.username[0].toUpperCase()}
                        </div>
                      )}
                      {!isOwnMessage && !showAvatar && <div className="w-8"></div>}
                      
                      <div className={`relative group ${isOwnMessage ? 'ml-12' : 'mr-12'}`}>
                        {/* Show username above message for group chats or when showing avatar */}
                        {(selectedConversation?.conversation_type === 'group' || showAvatar) && !isOwnMessage && (
                          <div className="mb-1">
                            <span className="text-xs font-medium text-gray-600">
                              {message.sender.username}
                            </span>
                          </div>
                        )}
                        
                        <div
                          className={`px-4 py-3 rounded-2xl shadow-sm ${
                            isOwnMessage
                              ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white'
                              : 'bg-white text-gray-800 border border-gray-200'
                          }`}
                        >
                          <p className="text-sm leading-relaxed">{message.content}</p>
                          <div className={`flex items-center justify-end mt-1 space-x-1 ${
                            isOwnMessage ? 'text-blue-100' : 'text-gray-500'
                          }`}>
                            <span className="text-xs">{formatTime(message.created_at)}</span>
                            {isOwnMessage && (
                              <div className="flex items-center space-x-1">
                                {/* Message status indicators */}
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* Message actions */}
                        <div className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button className="p-1 hover:bg-gray-100 rounded-full">
                            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              
              {/* Enhanced Typing Indicator */}
              {typingUsers.length > 0 && (
                <div className="flex justify-start mb-4">
                  <div className="flex items-center space-x-2 bg-white px-4 py-3 rounded-2xl shadow-sm border border-gray-200">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                    </div>
                    <p className="text-sm text-gray-600">
                      {typingUsers.map(u => u.username).join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
                    </p>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Enhanced Message Input */}
            <div className="bg-white/95 backdrop-blur-sm border-t border-gray-200/50 p-4 sm:p-6 shadow-lg">
              {error && (
                <div className="mb-3 sm:mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-center space-x-2">
                  <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span className="break-words">{error}</span>
                </div>
              )}
              
              <div className="flex items-center space-x-2 sm:space-x-3">
                <button className="p-2 hover:bg-gray-100 rounded-full transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                </button>
                
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => {
                      setNewMessage(e.target.value);
                      handleTypingStart();
                    }}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder="Type a message..."
                    className="w-full border border-gray-300 rounded-2xl px-3 sm:px-4 py-2 sm:py-3 pr-10 sm:pr-12 text-gray-900 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed resize-none text-base sm:text-sm min-h-[44px]"
                    disabled={!isConnected}
                  />
                  <button className="absolute right-2 sm:right-3 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-100 rounded-full transition-colors min-h-[32px] min-w-[32px] flex items-center justify-center">
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </button>
                </div>
                
                <button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() || !isConnected}
                  className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white p-2 sm:p-3 rounded-full hover:from-blue-600 hover:to-indigo-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 disabled:transform-none min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
              
              {!isConnected && (
                <div className="mt-3 text-center">
                  <p className="text-xs sm:text-sm text-gray-500">
                    <svg className="w-3 h-3 sm:w-4 sm:h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Reconnecting...
                  </p>
                </div>
              )}
              
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
            <div className="text-center p-4 sm:p-6 lg:p-8">
              <div className="text-6xl sm:text-8xl mb-4 sm:mb-6">💬</div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-700 mb-2">Welcome to Astro Chat</h2>
              <p className="text-sm sm:text-base text-gray-500 mb-4 sm:mb-6 px-4">
                <span className="hidden lg:inline">Choose a conversation from the sidebar to start messaging</span>
                <span className="lg:hidden">Select a conversation from the list to start messaging</span>
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center space-y-2 sm:space-y-0 sm:space-x-4 text-xs sm:text-sm text-gray-400">
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  <span>Real-time messaging</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                  <span>Typing indicators</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                  <span>Online status</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* New Chat Modal */}
      <NewChatModal
        isOpen={newChatModalOpen}
        onClose={() => setNewChatModalOpen(false)}
        onConversationCreated={handleNewConversation}
      />

      {/* New Group Chat Modal */}
      <NewGroupChatModal
        isOpen={newGroupChatModalOpen}
        onClose={() => setNewGroupChatModalOpen(false)}
        onConversationCreated={handleNewGroupConversation}
      />

      {/* Group Management Modal */}
      <GroupManagementModal
        isOpen={groupManagementModalOpen}
        onClose={() => setGroupManagementModalOpen(false)}
        conversation={selectedConversation}
        onConversationUpdated={handleConversationUpdated}
      />

      {/* Floating Action Button for New Chat - Only show when there are conversations */}
      {/* {conversations.length > 0 && (
        <button
          onClick={handleOpenNewChat}
          className="fixed bottom-6 right-6 lg:bottom-8 lg:right-8 bg-gradient-to-r from-blue-500 to-indigo-600 text-white p-4 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 z-40"
          aria-label="Start new chat"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </button>
      )} */}
    </div>
  );
}