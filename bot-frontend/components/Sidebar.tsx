import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '@/contexts/ThemeContext';

// Import these interfaces from a shared types file or define them here
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

interface SidebarProps {
  conversations: Conversation[];
  activeConversation: number | null;
  setActiveConversation: (id: number) => void;
  addNewConversation: () => void;
  deleteConversation: (id: number) => void;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (isOpen: boolean) => void;
  clearAllConversations: () => void;
  setActiveNavItem?: (item: string) => void;
}

export default function Sidebar({ 
  conversations, 
  activeConversation, 
  setActiveConversation, 
  addNewConversation,
  deleteConversation,
  isSidebarOpen,
  setIsSidebarOpen,
  clearAllConversations,
  setActiveNavItem
}: SidebarProps) {
  const { isDarkMode } = useTheme();
  const [isMobile, setIsMobile] = useState(false);
  const [hoveredConversation, setHoveredConversation] = useState<number | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);
  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false);
  const [localActiveNavItem, setLocalActiveNavItem] = useState('chat');
  const [showHelpInstructions, setShowHelpInstructions] = useState(false);
  const [showRoadmapModal, setShowRoadmapModal] = useState(false);

  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth < 768) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };

    checkIfMobile();
    window.addEventListener('resize', checkIfMobile);
    return () => window.removeEventListener('resize', checkIfMobile);
  }, [setIsSidebarOpen]);

  const getLastMessagePreview = (conversation: Conversation) => {
    if (conversation.messages.length === 0) return 'No messages yet';
    
    const lastMessage = conversation.messages[conversation.messages.length - 1];
    const preview = lastMessage.content.length > 30 
      ? lastMessage.content.substring(0, 30) + '...' 
      : lastMessage.content;
      
    return preview;
  };

  const getFormattedDate = (conversation: Conversation) => {
    if (conversation.messages.length === 0) return '';
    
    const lastMessage = conversation.messages[conversation.messages.length - 1];
    const date = new Date(lastMessage.timestamp);
    
    // If today, show time
    if (isToday(date)) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    // If this year, show month and day
    if (isThisYear(date)) {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
    
    // Otherwise show full date
    return date.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();
  };

  const isThisYear = (date: Date) => {
    const today = new Date();
    return date.getFullYear() === today.getFullYear();
  };

  const handleDeleteClick = (e: React.MouseEvent, conversationId: number) => {
    e.stopPropagation();
    setShowDeleteConfirm(conversationId);
  };

  const confirmDelete = (e: React.MouseEvent, conversationId: number) => {
    e.stopPropagation();
    deleteConversation(conversationId);
    setShowDeleteConfirm(null);
  };

  const cancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteConfirm(null);
  };


  const handleNavClick = (itemId: string) => {
    setLocalActiveNavItem(itemId);
    if (setActiveNavItem) {
      setActiveNavItem(itemId);
    }
    
    switch(itemId) {
      case 'chat':
        // Show current UI page (chat interface) - this is already the default
        console.log('Chat clicked - showing chat interface');
        break;
      case 'roadmap':
        // Show roadmap modal
        console.log('Roadmap clicked - showing roadmap modal');
        setShowRoadmapModal(true);
        break;
      case 'settings':
        // Show settings page
        console.log('Settings clicked - showing settings page');
        break;
      case 'help':
        // Show chatbot instructions popup
        console.log('Help clicked - showing instructions popup');
        setShowHelpInstructions(true);
        break;
    }
  };


  const navigationItems = [
    { id: 'chat', label: 'Chat', icon: '💬' },
    { id: 'roadmap', label: 'Roadmap', icon: '🗺️' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
    { id: 'help', label: 'Help', icon: '❓' }
  ];

  return (
    <>
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ x: -300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -300, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className={`
              ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} w-80 flex-shrink-0 flex flex-col border-r h-full transition-colors duration-300
              ${isMobile ? 'fixed inset-y-0 left-0 z-40 shadow-xl' : ''}
            `}
          >
            {/* Logo Section */}
            <div className={`p-6 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
              <div className="flex items-center">
                <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-purple-800 rounded-lg flex items-center justify-center text-white font-bold text-lg mr-3">
                  N
                </div>
                <span className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>EchoBot</span>
                            </div>
                          </div>

            {/* Navigation */}
            <div className="p-4 flex-1">
              <div className="space-y-1">
                {navigationItems.map((item) => (
                                <button
                    key={item.id}
                    onClick={() => handleNavClick(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      localActiveNavItem === item.id
                        ? isDarkMode 
                          ? 'bg-purple-600 text-white' 
                          : 'bg-purple-100 text-purple-700'
                        : isDarkMode
                          ? 'text-gray-200 hover:bg-gray-700 hover:text-white'
                          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'
                    }`}
                  >
                    <div className="flex items-center">
                      <span className="mr-3">{item.icon}</span>
                      {item.label}
                              </div>
                              </button>
                    ))}
                </div>
            </div>
            
            {/* Pro Plan Advertisement - Fixed at bottom */}
            <div className="p-4 mt-auto">
              <div className="bg-gradient-to-br from-purple-600 to-purple-800 rounded-xl p-4 text-white">
                <div className="flex items-center mb-3">
                  <div className="w-6 h-6 bg-white bg-opacity-20 rounded-lg flex items-center justify-center text-white font-bold text-sm mr-2">
                    N
                  </div>
                  <span className="font-semibold">Pro Plan</span>
                </div>
                <div className="text-2xl font-bold mb-1">$189/month</div>
                <p className="text-sm text-purple-100 mb-4">
                  Open a lot of cool features with our Premium Pro Plan
                </p>
                <button className="w-full bg-white text-purple-700 py-2 px-4 rounded-lg font-medium hover:bg-gray-100 transition-colors">
                  Get Pro Plan
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile sidebar toggle */}
      {isMobile && (
        <button 
          className="fixed bottom-6 left-6 z-50 bg-gradient-to-r from-purple-600 to-purple-800 text-white p-3 rounded-full shadow-lg"
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        >
          {isSidebarOpen ? (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      )}

      {/* Help Instructions Popup */}
      {showHelpInstructions && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            {/* Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-800">🤖 Chatbot Instructions</h2>
                <button
                  onClick={() => setShowHelpInstructions(false)}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              <div className="space-y-6">
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4 mb-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">Welcome to the Chatbot Help Center</h3>
                  <p className="text-gray-600">Here's everything you need to know about using and managing your chatbot experience.</p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                    <span className="mr-2">💬</span>
                    Chatbot Description
                  </h3>
                  <p className="text-gray-600 mb-3">The college chatbot is your virtual guide for all campus-related queries. It helps students, parents, and visitors quickly find information about admissions, courses, departments, facilities, and events — all through simple, conversational chat.</p>
                  <p className="text-gray-600">You can ask questions, get instant answers, and access the right links or resources without navigating multiple pages. The chatbot is available 24/7, ensuring a smooth and interactive experience for anyone visiting the college website.</p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                    <span className="mr-2">⚙️</span>
                    Global Settings
                  </h3>
                  <p className="text-gray-600 mb-3">Manage your chatbot preferences in one place.</p>
                  <p className="text-gray-600">You can customize tone, reset data, and access user info or chat summaries.</p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                    <span className="mr-2">💬</span>
                    Chat Details
                  </h3>
                  <p className="text-gray-600 mb-3">Track your interactions effortlessly:</p>
                  <ul className="space-y-2 text-gray-600">
                    <li className="flex items-start">
                      <span className="text-purple-600 mr-2">•</span>
                      <strong>Total Chats</strong> – View the total number of conversations
                    </li>
                    <li className="flex items-start">
                      <span className="text-purple-600 mr-2">•</span>
                      <strong>From AI</strong> – See the total responses generated by the chatbot
                    </li>
                    <li className="flex items-start">
                      <span className="text-purple-600 mr-2">•</span>
                      <strong>From User</strong> – Count of all user messages sent
                    </li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                    <span className="mr-2">🧾</span>
                    Chat Summary
                  </h3>
                  <p className="text-gray-600">Get a quick overview of your recent interactions — see key highlights, summaries, and patterns from past chats.</p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                    <span className="mr-2">🎨</span>
                    Tone Preference
                  </h3>
                  <p className="text-gray-600">Adjust how the chatbot communicates with you — choose between formal, friendly, informative, or concise tones depending on your needs.</p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                    <span className="mr-2">👤</span>
                    User Info
                  </h3>
                  <p className="text-gray-600">View or update your profile details that personalize your chat experience — such as your name, role, or department.</p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                    <span className="mr-2">📜</span>
                    Chat Rules
                  </h3>
                  <p className="text-gray-600 mb-3">Understand how the chatbot operates responsibly:</p>
                  <ul className="space-y-2 text-gray-600">
                    <li className="flex items-start">
                      <span className="text-purple-600 mr-2">•</span>
                      Be respectful and clear while interacting
                    </li>
                    <li className="flex items-start">
                      <span className="text-purple-600 mr-2">•</span>
                      Avoid sharing sensitive personal data
                    </li>
                    <li className="flex items-start">
                      <span className="text-purple-600 mr-2">•</span>
                      The chatbot is meant for general guidance, not official admission or academic decisions
                    </li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                    <span className="mr-2">🔗</span>
                    Shared Links
                  </h3>
                  <p className="text-gray-600 mb-3">Access shared information easily:</p>
                  <ul className="space-y-2 text-gray-600">
                    <li className="flex items-start">
                      <span className="text-purple-600 mr-2">•</span>
                      <strong>From AI</strong> – View all links, documents, and resources shared by the chatbot
                    </li>
                    <li className="flex items-start">
                      <span className="text-purple-600 mr-2">•</span>
                      <strong>From User</strong> – Manage any links or attachments you've shared during the conversation
                    </li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                    <span className="mr-2">🗑️</span>
                    Delete All Chats
                  </h3>
                  <p className="text-gray-600">Remove all your previous chat history in one click.</p>
                  <p className="text-red-600 text-sm mt-1"><strong>Note:</strong> This action is permanent and cannot be undone.</p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                    <span className="mr-2">♻️</span>
                    Reset Settings
                  </h3>
                  <p className="text-gray-600">Restore all chatbot preferences to their default state — useful when you want to start fresh or fix any configuration issues.</p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-200 bg-gray-50">
              <div className="flex justify-end">
                <button
                  onClick={() => setShowHelpInstructions(false)}
                  className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  Got it!
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Roadmap Modal */}
      {showRoadmapModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            {/* Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-800">🗺️ Product Roadmap</h2>
                <button
                  onClick={() => setShowRoadmapModal(false)}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">🚀 Coming Soon</h3>
                  <ul className="space-y-2 text-gray-600">
                    <li className="flex items-start">
                      <span className="text-green-600 mr-2">•</span>
                      <span><strong>Advanced AI Models:</strong> Integration with GPT-4 and Claude</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-green-600 mr-2">•</span>
                      <span><strong>Voice Chat:</strong> Audio input and output capabilities</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-green-600 mr-2">•</span>
                      <span><strong>File Upload:</strong> Support for documents, images, and PDFs</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-green-600 mr-2">•</span>
                      <span><strong>Team Collaboration:</strong> Shared conversations and workspaces</span>
                    </li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">🔧 In Development</h3>
                  <ul className="space-y-2 text-gray-600">
                    <li className="flex items-start">
                      <span className="text-blue-600 mr-2">•</span>
                      <span><strong>Custom Themes:</strong> Dark mode and personalized UI</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-blue-600 mr-2">•</span>
                      <span><strong>Export Features:</strong> Save conversations as PDF or text</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-blue-600 mr-2">•</span>
                      <span><strong>API Integration:</strong> Connect with external services</span>
                    </li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">💡 Future Ideas</h3>
                  <ul className="space-y-2 text-gray-600">
                    <li className="flex items-start">
                      <span className="text-purple-600 mr-2">•</span>
                      <span><strong>Mobile App:</strong> Native iOS and Android applications</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-purple-600 mr-2">•</span>
                      <span><strong>Plugin System:</strong> Third-party integrations and extensions</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-purple-600 mr-2">•</span>
                      <span><strong>Analytics Dashboard:</strong> Usage insights and conversation analytics</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-200 bg-gray-50">
              <div className="flex justify-end">
                <button
                  onClick={() => setShowRoadmapModal(false)}
                  className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  Got it!
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </>
  );
} 