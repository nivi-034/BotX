import { useState } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '@/contexts/ThemeContext';

interface Message {
  id: number;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
}

interface Conversation {
  id: number;
  name: string;
  messages: Message[];
  sessionId?: string;
}

interface ChatListProps {
  conversations: Conversation[];
  activeConversation: number | null;
  setActiveConversation: (id: number) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onDeleteConversation: (id: number) => void;
  onAddNewConversation: () => void;
}

export default function ChatList({ 
  conversations, 
  activeConversation, 
  setActiveConversation,
  searchQuery,
  setSearchQuery,
  onDeleteConversation,
  onAddNewConversation
}: ChatListProps) {
  const { isDarkMode } = useTheme();
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);

  const getLastMessagePreview = (conversation: Conversation) => {
    if (conversation.messages.length === 0) return 'No messages yet';
    
    const lastMessage = conversation.messages[conversation.messages.length - 1];
    const preview = lastMessage.content.length > 40 
      ? lastMessage.content.substring(0, 40) + '...' 
      : lastMessage.content;
      
    return preview;
  };

  const getFormattedTime = (conversation: Conversation) => {
    if (conversation.messages.length === 0) return '';
    
    const lastMessage = conversation.messages[conversation.messages.length - 1];
    const date = new Date(lastMessage.timestamp);
    
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getContactName = (conversation: Conversation) => {
    // Extract name from conversation or use a default
    return conversation.name || 'Contact';
  };

  const getContactPhone = () => {
    // Mock phone number - in real app this would come from contact data
    return '+(1) 234-543-4321';
  };

  const getContactStatus = (conversation: Conversation) => {
    if (conversation.messages.length === 0) return 'No messages';
    
    const lastMessage = conversation.messages[conversation.messages.length - 1];
    if (lastMessage.role === 'user') {
      return 'Typing...';
    }
    return lastMessage.content.length > 20 
      ? lastMessage.content.substring(0, 20) + '...' 
      : lastMessage.content;
  };

  const handleDeleteClick = (e: React.MouseEvent, conversationId: number) => {
    e.stopPropagation();
    console.log('Delete clicked for conversation:', conversationId);
    setShowDeleteConfirm(conversationId);
  };

  const confirmDelete = (e: React.MouseEvent, conversationId: number) => {
    e.stopPropagation();
    console.log('Confirming delete for conversation:', conversationId);
    onDeleteConversation(conversationId);
    setShowDeleteConfirm(null);
  };

  const cancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    console.log('Cancel delete');
    setShowDeleteConfirm(null);
  };

  const filteredConversations = conversations.filter(conv => 
    conv.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.messages.some(msg => 
      msg.content.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  return (
    <div className={`w-80 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-r flex flex-col transition-colors duration-300`}>
      {/* Header with New Chat Button */}
      <div className={`p-4 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
        <div className="flex items-center justify-between mb-3">
          <h2 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>Conversations</h2>
          <button
            onClick={onAddNewConversation}
            className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2 text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            New Chat
          </button>
        </div>
        
        {/* Search Bar */}
        <div className={`relative flex items-center ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'} rounded-lg px-3 py-2 transition-all duration-200 ${
          isSearchFocused ? `ring-2 ring-purple-500 ${isDarkMode ? 'bg-gray-600' : 'bg-white'}` : ''
        }`}>
          <svg className={`w-5 h-5 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mr-2`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            placeholder="Search"
            className={`flex-1 bg-transparent border-none focus:outline-none ${isDarkMode ? 'text-white placeholder-gray-400' : 'text-gray-800 placeholder-gray-500'}`}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className={`${isDarkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Contact List */}
      <div className="flex-1 overflow-y-auto">
        {filteredConversations.length === 0 ? (
          <div className={`p-4 text-center ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            {searchQuery ? 'No contacts found' : 'No conversations yet'}
          </div>
        ) : (
          <div className="p-2">
            {filteredConversations
              .sort((a, b) => {
                const aTime = a.messages.length > 0 
                  ? new Date(a.messages[a.messages.length - 1].timestamp).getTime() 
                  : 0;
                const bTime = b.messages.length > 0 
                  ? new Date(b.messages[b.messages.length - 1].timestamp).getTime() 
                  : 0;
                return bTime - aTime;
              })
              .map((conversation) => (
                <motion.div
                  key={conversation.id}
                  className="relative"
                >
                  <motion.button
                    onClick={() => setActiveConversation(conversation.id)}
                    className={`w-full text-left p-3 rounded-lg mb-2 transition-all duration-200 ${
                      activeConversation === conversation.id
                        ? isDarkMode 
                          ? 'bg-purple-600 border border-purple-500' 
                          : 'bg-purple-50 border border-purple-200'
                        : isDarkMode 
                          ? 'hover:bg-gray-700' 
                          : 'hover:bg-gray-50'
                    }`}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="flex items-center space-x-3">
                      {/* Avatar */}
                      <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-medium text-sm">
                        {getContactName(conversation).charAt(0)}
                      </div>
                      
                      {/* Contact Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3 className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-800'} truncate`}>
                            {getContactName(conversation)}
                          </h3>
                          <span className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                            {getFormattedTime(conversation)}
                          </span>
                        </div>
                        <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'} truncate`}>
                          {getContactPhone()}
                        </p>
                        <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} truncate`}>
                          {getContactStatus(conversation)}
                        </p>
                      </div>
                    </div>
                  </motion.button>
                  
                  {/* Delete Button - always visible */}
                  <div 
                    className="absolute right-2 top-1/2 transform -translate-y-1/2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {showDeleteConfirm === conversation.id ? (
                      <div className={`flex items-center gap-1 ${isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-200'} p-1 rounded-lg shadow-md border`}>
                        <button
                          onClick={(e) => confirmDelete(e, conversation.id)}
                          className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50"
                          title="Confirm delete"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </button>
                        <button
                          onClick={cancelDelete}
                          className="text-gray-600 hover:text-gray-800 p-1 rounded hover:bg-gray-100"
                          title="Cancel"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={(e) => handleDeleteClick(e, conversation.id)}
                        className="text-gray-400 hover:text-red-600 p-1 rounded hover:bg-gray-100"
                        title="Delete conversation"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
