export interface IUser {
  id: number;
  username: string;
  email: string;
}

export interface IRegisterData {
  username: string;
  email: string;
  password: string;
}

export interface ILoginData {
  email: string;
  password: string;
}

export interface ITokens {
  access: string;
  refresh: string;
}

export interface ILoginResponse {
  user: IUser;
  tokens: ITokens;
  message: string;
}

export interface IRefreshResponse {
  access: string;
}

// Chat Types
export interface IMessage {
  id: number;
  content: string;
  sender: IUser;
  conversation: number;
  created_at: string;
}

export interface IConversation {
  id: number;
  participants: IUser[];
  conversation_type: 'direct' | 'group';
  name?: string;
  created_by?: IUser;
  created_at: string;
  updated_at: string;
  last_message?: IMessage;
  message_count?: number;
  display_name?: string;
}

export interface ICreateMessage {
  content: string;
  conversation: number;
}

export interface ICreateConversation {
  participants: number[];
  conversation_type?: 'direct' | 'group';
  name?: string;
}

export interface ICreateGroupConversation {
  name: string;
  participants: number[];
}

// WebSocket Message Types
export interface IWebSocketMessage {
  type: 'chat_message' | 'typing' | 'online_status';
  message?: string;
  user?: IUser;
  timestamp?: string;
  receiver?: number;
  is_typing?: boolean;
  online_users?: IUser[];
  status?: 'online' | 'offline';
}