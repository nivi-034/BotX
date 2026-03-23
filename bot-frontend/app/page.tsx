"use client";

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import ChatList from '@/components/ChatList';
import ChatInterface from '@/components/ChatInterface';
import ContactDetails from '@/components/ContactDetails';
import MobileWidget from '@/components/MobileWidget';
import { checkHealth } from '@/services/api';
import { useTheme } from '@/contexts/ThemeContext';

// Define the Message and Conversation types here to ensure consistency
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

export default function Home() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<number | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isBackendConnected, setIsBackendConnected] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState('chat');
  const [activeNavItem, setActiveNavItem] = useState('chat');
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileWidgetOpen, setIsMobileWidgetOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const { isDarkMode } = useTheme();

  // Check backend health on load
  useEffect(() => {
    const checkBackendHealth = async () => {
      try {
        const isHealthy = await checkHealth();
        setIsBackendConnected(isHealthy);
      } catch (error) {
        console.error('Error checking backend health:', error);
        setIsBackendConnected(false);
      }
    };
    
    checkBackendHealth();
  }, []);

  // Check if mobile
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkIfMobile();
    window.addEventListener('resize', checkIfMobile);
    return () => window.removeEventListener('resize', checkIfMobile);
  }, []);

  // Load conversations from localStorage or initialize with a single empty conversation
  useEffect(() => {
    const savedConversations = localStorage.getItem('conversations');
    
    if (savedConversations) {
      try {
        const parsed = JSON.parse(savedConversations);
        // Convert string timestamps back to Date objects
        const conversationsWithDates = parsed.map((conv: any) => ({
          ...conv,
          messages: conv.messages.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          }))
        }));
        
        setConversations(conversationsWithDates);
        
        // Set active conversation to the first one if available
        if (conversationsWithDates.length > 0) {
          setActiveConversation(conversationsWithDates[0].id);
        }
      } catch (error) {
        console.error('Error parsing saved conversations:', error);
        initializeWithEmptyConversation();
      }
    } else {
      initializeWithEmptyConversation();
    }
  }, []);

  const initializeWithEmptyConversation = () => {
    const newConversation = { 
      id: 1, 
      name: 'New Chat', 
      messages: [] 
    };
    setConversations([newConversation]);
    setActiveConversation(1);
  };

  const addNewConversation = () => {
    const newId = conversations.length > 0 ? Math.max(...conversations.map(c => c.id)) + 1 : 1;
    const newConversation = { id: newId, name: 'New Chat', messages: [] };
    
    // Add the new conversation at the beginning of the array
    setConversations([newConversation, ...conversations]);
    setActiveConversation(newId);
    
    // Redirect to chat page if currently on settings page
    if (activeNavItem === 'settings') {
      setActiveNavItem('chat');
    }
  };

  const deleteConversation = (id: number) => {
    // Filter out the conversation to delete
    const updatedConversations = conversations.filter(c => c.id !== id);
    
    // Update state
    setConversations(updatedConversations);
    
    // If we're deleting the active conversation, set a new active conversation
    if (activeConversation === id) {
      if (updatedConversations.length > 0) {
        // Set the first conversation as active
        setActiveConversation(updatedConversations[0].id);
      } else {
        // If no conversations left, create a new empty one
        addNewConversation();
      }
    }
  };

  const clearAllConversations = () => {
    // Create a new empty conversation
    const newConversation = { 
      id: Date.now(), 
      name: 'New Chat', 
      messages: [] 
    };
    
    // Reset to just this new conversation
    setConversations([newConversation]);
    setActiveConversation(newConversation.id);
    
    // Redirect to chat page if currently on settings page
    if (activeNavItem === 'settings') {
      setActiveNavItem('chat');
    }
  };

  // Save conversations to localStorage whenever they change
  useEffect(() => {
    if (conversations.length > 0) {
      localStorage.setItem('conversations', JSON.stringify(conversations));
    }
  }, [conversations]);

  return (
    <div className={`flex flex-col h-screen ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'} transition-colors duration-300`}>
      {isBackendConnected === false && (
        <div className="fixed top-0 left-0 right-0 bg-yellow-100 text-yellow-800 py-2 px-4 text-center z-50">
          <div className="flex items-center justify-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>
              Running in offline mode. Backend server not connected. 
              <button 
                onClick={() => window.location.reload()}
                className="ml-2 underline hover:text-yellow-900"
              >
                Retry Connection
              </button>
            </span>
          </div>
        </div>
      )}
      
      {/* Header */}
      <Header 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        addNewConversation={addNewConversation}
        clearAllConversations={clearAllConversations}
        setActiveNavItem={setActiveNavItem}
      />
      
      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Desktop Layout */}
        {!isMobile && (
          <>
            {/* Left Sidebar */}
            <Sidebar 
              conversations={conversations}
              activeConversation={activeConversation}
              setActiveConversation={setActiveConversation}
              addNewConversation={addNewConversation}
              deleteConversation={deleteConversation}
              clearAllConversations={clearAllConversations}
              isSidebarOpen={isSidebarOpen}
              setIsSidebarOpen={setIsSidebarOpen}
              setActiveNavItem={setActiveNavItem}
            />
            
            {/* Main Content Area */}
            {activeNavItem === 'settings' ? (
              /* Settings Page - Full Width */
              <div className={`flex-1 flex ${isDarkMode ? 'bg-gray-900' : 'bg-white'} transition-colors duration-300`}>
                <ChatInterface 
                  conversation={conversations.find(c => c.id === activeConversation) || conversations[0]}
                  setConversations={setConversations}
                  conversations={conversations}
                  isSidebarOpen={isSidebarOpen}
                  setIsSidebarOpen={setIsSidebarOpen}
                  activeNavItem={activeNavItem}
                />
              </div>
            ) : (
              /* Normal Chat Layout */
              <>
                {/* Chat List */}
                <ChatList
                  conversations={conversations}
                  activeConversation={activeConversation}
                  setActiveConversation={setActiveConversation}
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  onDeleteConversation={deleteConversation}
                  onAddNewConversation={addNewConversation}
                />
                
                {/* Chat Interface */}
                <div className={`flex-1 flex ${isDarkMode ? 'bg-gray-900' : 'bg-white'} transition-colors duration-300`}>
                  {activeConversation !== null && (
                    <ChatInterface 
                      conversation={conversations.find(c => c.id === activeConversation) || conversations[0]}
                      setConversations={setConversations}
                      conversations={conversations}
                      isSidebarOpen={isSidebarOpen}
                      setIsSidebarOpen={setIsSidebarOpen}
                      activeNavItem={activeNavItem}
                    />
                  )}
                  
                  {/* Contact Details */}
                  {activeConversation !== null && (
                    <ContactDetails 
                      conversation={conversations.find(c => c.id === activeConversation) || null}
                    />
                  )}
                </div>
              </>
            )}
          </>
        )}

        {/* Mobile Layout */}
        {isMobile && (
          <div className="flex-1 flex flex-col">
            {activeConversation !== null ? (
              <ChatInterface 
                conversation={conversations.find(c => c.id === activeConversation) || conversations[0]}
                setConversations={setConversations}
                conversations={conversations}
                isSidebarOpen={isSidebarOpen}
                setIsSidebarOpen={setIsSidebarOpen}
                activeNavItem={activeNavItem}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center bg-gray-50">
                <div className="text-center">
                  <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">Welcome to Attmosfire</h3>
                  <p className="text-gray-600 mb-4">Start a conversation to begin chatting</p>
                  <button
                    onClick={addNewConversation}
                    className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    New Chat
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mobile Widget */}
      {isMobile && (
        <MobileWidget
          conversation={activeConversation !== null ? conversations.find(c => c.id === activeConversation) || null : null}
          isOpen={isMobileWidgetOpen}
          onClose={() => setIsMobileWidgetOpen(false)}
          onSendMessage={(message) => {
            // Handle sending message in mobile widget
            if (activeConversation !== null) {
              const newMessage = {
                id: Date.now(),
                content: message,
                role: 'user' as const,
                timestamp: new Date()
              };
              
              setConversations(prevConversations => 
                prevConversations.map(c => 
                  c.id === activeConversation 
                    ? { ...c, messages: [...c.messages, newMessage] }
                    : c
                )
              );
            }
          }}
        />
      )}

      {/* Mobile Widget Toggle Button */}
      {isMobile && !isMobileWidgetOpen && (
        <button
          onClick={() => setIsMobileWidgetOpen(true)}
          className="fixed bottom-4 right-4 w-14 h-14 bg-purple-600 text-white rounded-full shadow-lg hover:bg-purple-700 transition-colors flex items-center justify-center z-40"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </button>
      )}
    </div>
  );
}
