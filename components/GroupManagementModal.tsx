"use client";

import React, { useState, useEffect } from 'react';
import { chatAPI } from '@/lib/api';
import { IUser, IConversation } from '@/lib/type';
import { useAuth } from '@/lib/AuthContext';

interface GroupManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversation: IConversation | null;
  onConversationUpdated: (conversation: IConversation) => void;
}

export default function GroupManagementModal({ 
  isOpen, 
  onClose, 
  conversation, 
  onConversationUpdated 
}: GroupManagementModalProps) {
  const { user } = useAuth();
  const [users, setUsers] = useState<IUser[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<IUser[]>([]);
  const [action, setAction] = useState<'add' | 'remove'>('add');

  // Load users when modal opens
  useEffect(() => {
    if (isOpen && conversation) {
      loadUsers();
      setSelectedUsers([]);
      setError(null);
      setSuccess(null);
    }
  }, [isOpen, conversation]);

  // Search users when search term changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchTerm.length > 0 || searchTerm.length === 0) {
        loadUsers(searchTerm);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  const loadUsers = async (search?: string) => {
    if (!conversation) return;
    
    try {
      setLoading(true);
      setError(null);
      const data = await chatAPI.getUsers(search);
      
      if (action === 'add') {
        // Filter out current user and existing members
        const filteredUsers = data.filter(u => 
          u.id !== user?.id && 
          !conversation.participants.some(participant => participant.id === u.id) &&
          !selectedUsers.some(selected => selected.id === u.id)
        );
        setUsers(filteredUsers);
      } else {
        // For remove action, show only current members (excluding creator)
        const currentMembers = conversation.participants.filter(p => p.id !== conversation.created_by?.id);
        setUsers(currentMembers);
      }
    } catch (err) {
      console.error('Error loading users:', err);
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleUserSelect = (selectedUser: IUser) => {
    if (action === 'add') {
      setSelectedUsers(prev => [...prev, selectedUser]);
      setUsers(prev => prev.filter(u => u.id !== selectedUser.id));
    } else {
      setSelectedUsers(prev => [...prev, selectedUser]);
    }
  };

  const handleUserRemove = (userToRemove: IUser) => {
    setSelectedUsers(prev => prev.filter(u => u.id !== userToRemove.id));
    if (action === 'add') {
      setUsers(prev => [...prev, userToRemove]);
    }
  };

  const handleSubmit = async () => {
    if (!conversation || selectedUsers.length === 0) {
      setError(`Please select users to ${action}`);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      const memberIds = selectedUsers.map(u => u.id);
      let updatedConversation: IConversation;

      if (action === 'add') {
        updatedConversation = await chatAPI.addGroupMembers(conversation.id, memberIds);
      } else {
        updatedConversation = await chatAPI.removeGroupMembers(conversation.id, memberIds);
      }

      onConversationUpdated(updatedConversation);
      setSuccess(`Successfully ${action === 'add' ? 'added' : 'removed'} ${selectedUsers.length} member(s)`);
      setSelectedUsers([]);
      
      // Reload users for the current action
      setTimeout(() => {
        loadUsers();
      }, 1000);
    } catch (err: any) {
      setError(err.response?.data?.error || `Failed to ${action} members`);
      console.error(`Error ${action}ing members:`, err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !conversation || conversation.conversation_type !== 'group') return null;

  const isCreator = conversation.created_by?.id === user?.id;

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-blue-50 to-indigo-100 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">
              Manage Group: {conversation.name || 'Unnamed Group'}
            </h2>
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

        {!isCreator && (
          <div className="p-4 bg-yellow-50 border-b border-yellow-200">
            <p className="text-sm text-yellow-800">
              Only the group creator can manage members.
            </p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {/* Action Toggle */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex space-x-2">
              <button
                onClick={() => {
                  setAction('add');
                  setSelectedUsers([]);
                  loadUsers();
                }}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                  action === 'add' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Add Members
              </button>
              <button
                onClick={() => {
                  setAction('remove');
                  setSelectedUsers([]);
                  loadUsers();
                }}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                  action === 'remove' 
                    ? 'bg-red-600 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Remove Members
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="p-6 border-b border-gray-200">
            <div className="relative">
              <input
                type="text"
                placeholder={`Search users to ${action}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-3 pl-10 text-gray-950 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={!isCreator}
              />
              <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          {/* Selected Users */}
          {selectedUsers.length > 0 && (
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-sm font-medium text-gray-700 mb-3">
                Selected Users ({selectedUsers.length})
              </h3>
              <div className="flex flex-wrap gap-2">
                {selectedUsers.map((user) => (
                  <div
                    key={user.id}
                    className={`flex items-center px-3 py-2 rounded-full text-sm ${
                      action === 'add' 
                        ? 'bg-blue-100 text-blue-800' 
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    <span className="mr-2">{user.username}</span>
                    <button
                      onClick={() => handleUserRemove(user)}
                      className={`ml-1 rounded-full p-1 ${
                        action === 'add' 
                          ? 'hover:bg-blue-200' 
                          : 'hover:bg-red-200'
                      }`}
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

          {/* Error/Success Messages */}
          {error && (
            <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-center space-x-2">
              <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mx-6 mt-4 p-3 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg flex items-center space-x-2">
              <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>{success}</span>
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
                  {searchTerm ? 'Try a different search term' : `No users available to ${action}`}
                </p>
              </div>
            ) : (
              <div>
                {users.map((user) => (
                  <div
                    key={user.id}
                    onClick={() => isCreator && handleUserSelect(user)}
                    className={`p-4 transition-colors rounded-xl group ${
                      isCreator 
                        ? 'hover:bg-gray-50 cursor-pointer' 
                        : 'cursor-not-allowed opacity-50'
                    }`}
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
                      {isCreator && (
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                        </div>
                      )}
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
            Close
          </button>
          {isCreator && (
            <button
              onClick={handleSubmit}
              disabled={loading || selectedUsers.length === 0}
              className={`flex-1 px-4 py-3 text-white rounded-xl transition-colors font-medium disabled:bg-gray-300 disabled:cursor-not-allowed ${
                action === 'add' 
                  ? 'bg-blue-600 hover:bg-blue-700' 
                  : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              {loading ? 'Processing...' : `${action === 'add' ? 'Add' : 'Remove'} Members`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
