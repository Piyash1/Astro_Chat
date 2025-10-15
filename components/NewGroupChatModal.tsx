"use client";

import React, { useState, useEffect } from 'react';
import { chatAPI } from '@/lib/api';
import { IUser, IConversation } from '@/lib/type';
import { useAuth } from '@/lib/AuthContext';

interface NewGroupChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConversationCreated: (conversation: IConversation) => void;
}

export default function NewGroupChatModal({ isOpen, onClose, onConversationCreated }: NewGroupChatModalProps) {
  const { isAuthenticated, user } = useAuth();
  const [users, setUsers] = useState<IUser[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<IUser[]>([]);
  const [groupName, setGroupName] = useState('');

  // Load users when modal opens
  useEffect(() => {
    if (isOpen) {
      loadUsers();
      setSelectedUsers([]);
      setGroupName('');
      setError(null);
    }
  }, [isOpen]);

  // Search users when search term changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchTerm.length > 0 || searchTerm.length === 0) {
        loadUsers(searchTerm);
      }
    }, 300); // Debounce search

    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  const loadUsers = async (search?: string) => {
    if (!isAuthenticated) {
      setError('Please log in to load users');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      const data = await chatAPI.getUsers(search);
      // Filter out current user and already selected users
      const filteredUsers = data.filter(u => 
        u.id !== user?.id && 
        !selectedUsers.some(selected => selected.id === u.id)
      );
      setUsers(filteredUsers);
    } catch (err) {
      console.error('Error loading users:', err);
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleUserSelect = (selectedUser: IUser) => {
    setSelectedUsers(prev => [...prev, selectedUser]);
    setUsers(prev => prev.filter(u => u.id !== selectedUser.id));
  };

  const handleUserRemove = (userToRemove: IUser) => {
    setSelectedUsers(prev => prev.filter(u => u.id !== userToRemove.id));
    setUsers(prev => [...prev, userToRemove]);
  };

  const handleCreateGroup = async () => {
    if (!user?.id) {
      setError('User not authenticated');
      return;
    }
    
    if (selectedUsers.length < 1) {
      setError('Please select at least one member for the group');
      return;
    }
    
    if (!groupName.trim()) {
      setError('Please enter a group name');
      return;
    }
    
    try {
      setCreating(true);
      setError(null);
      
      const conversation = await chatAPI.createGroupConversation({
        name: groupName.trim(),
        participants: selectedUsers.map(u => u.id)
      });
      
      onConversationCreated(conversation);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create group chat');
      console.error('Error creating group chat:', err);
    } finally {
      setCreating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-blue-50 to-indigo-100 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">Create Group Chat</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Group Name Input */}
          <div className="p-6 border-b border-gray-200">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Group Name
            </label>
            <input
              type="text"
              placeholder="Enter group name..."
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="w-full px-4 py-3 text-gray-950 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Selected Members */}
          {selectedUsers.length > 0 && (
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-sm font-medium text-gray-700 mb-3">
                Selected Members ({selectedUsers.length})
              </h3>
              <div className="flex flex-wrap gap-2">
                {selectedUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center bg-blue-100 text-blue-800 px-3 py-2 rounded-full text-sm"
                  >
                    <span className="mr-2">{user.username}</span>
                    <button
                      onClick={() => handleUserRemove(user)}
                      className="ml-1 hover:bg-blue-200 rounded-full p-1"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Search */}
          <div className="p-6 border-b border-gray-200">
            <div className="relative">
              <input
                type="text"
                placeholder="Search users to add..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-3 pl-10 text-gray-950 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-center space-x-2">
              <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Users List */}
          <div className="p-2">
            {loading ? (
              <div className="p-6 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                <p className="mt-2 text-gray-600">Loading users...</p>
              </div>
            ) : users.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                <div className="text-4xl mb-3">👥</div>
                <p className="text-lg font-medium">No users found</p>
                <p className="text-sm text-gray-400 mt-1">
                  {searchTerm ? 'Try a different search term' : 'No other users available'}
                </p>
              </div>
            ) : (
              <div>
                {users.map((user) => (
                  <div
                    key={user.id}
                    onClick={() => handleUserSelect(user)}
                    className="p-4 hover:bg-gray-50 cursor-pointer transition-colors rounded-xl group"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg">
                        {user.username[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-lg font-semibold text-gray-900 truncate">
                          {user.username}
                        </p>
                        <p className="text-sm text-gray-500 truncate">
                          {user.email}
                        </p>
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 flex space-x-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleCreateGroup}
            disabled={creating || selectedUsers.length < 1 || !groupName.trim()}
            className="flex-1 px-4 py-3 text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-xl transition-colors font-medium"
          >
            {creating ? 'Creating...' : 'Create Group'}
          </button>
        </div>
      </div>
    </div>
  );
}
