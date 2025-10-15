import axios from "axios";
import { IConversation, IMessage, ICreateMessage, ICreateConversation, ICreateGroupConversation, IUser } from "./type";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api',
  headers: {
    "Content-Type": "application/json",
  }
});

// Attach access token from localStorage
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");
  console.log('API Request:', config.url, 'Token:', token ? 'Present' : 'Missing');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor to refresh token on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    console.log('API Error:', error.response?.status, error.response?.data, 'URL:', error.config?.url);
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Call your refresh endpoint
        const refresh = localStorage.getItem("refreshToken");
        if (!refresh) throw new Error("No refresh token");

        const res = await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'}/token/refresh/`,
          { refresh },
          { withCredentials: true }
        );

        const newAccess = res.data.access;
        localStorage.setItem("accessToken", newAccess);

        // Update the failed request with new access token
        originalRequest.headers["Authorization"] = `Bearer ${newAccess}`;
        return api(originalRequest);
      } catch (err) {
        // Refresh failed, logout user
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        window.location.href = "/login";
        return Promise.reject(err);
      }
    }
    return Promise.reject(error);
  }
);

// Chat API Functions
export const chatAPI = {
  // Get all conversations for the current user
  getConversations: async (): Promise<IConversation[]> => {
    const response = await api.get('/conversations/');
    return response.data;
  },

  // Get messages for a specific conversation
  getMessages: async (conversationId: number): Promise<IMessage[]> => {
    const response = await api.get(`/conversations/${conversationId}/messages/`);
    return response.data;
  },

  // Create a new conversation
  createConversation: async (data: ICreateConversation): Promise<IConversation> => {
    const response = await api.post('/conversations/', data);
    return response.data;
  },

  // Create a new group conversation
  createGroupConversation: async (data: ICreateGroupConversation): Promise<IConversation> => {
    const response = await api.post('/conversations/', {
      ...data,
      conversation_type: 'group'
    });
    return response.data;
  },

  // Send a message
  sendMessage: async (conversationId: number, data: ICreateMessage): Promise<IMessage> => {
    const response = await api.post(`/conversations/${conversationId}/messages/`, data);
    return response.data;
  },

  // Get conversation by ID
  getConversation: async (conversationId: number): Promise<IConversation> => {
    const response = await api.get(`/conversations/${conversationId}/`);
    return response.data;
  },

  // Get list of users for starting new conversations
  getUsers: async (search?: string): Promise<IUser[]> => {
    const params = search ? { search } : {};
    console.log('Making request to /users/ with params:', params);
    const response = await api.get('/users/', { params });
    console.log('Users API response:', response.data);
    return response.data;
  },

  // Group management functions
  addGroupMembers: async (conversationId: number, memberIds: number[]): Promise<IConversation> => {
    const response = await api.post(`/conversations/${conversationId}/members/`, {
      member_ids: memberIds
    });
    return response.data.conversation;
  },

  removeGroupMembers: async (conversationId: number, memberIds: number[]): Promise<IConversation> => {
    const response = await api.delete(`/conversations/${conversationId}/members/`, {
      data: { member_ids: memberIds }
    });
    return response.data.conversation;
  }
};

export default api;
