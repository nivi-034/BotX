import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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

interface ContactDetailsProps {
  conversation: Conversation | null;
}

export default function ContactDetails({ conversation }: ContactDetailsProps) {
  const { isDarkMode } = useTheme();
  const [expandedSections, setExpandedSections] = useState({
    generalInfo: true, // Start expanded by default
    additionalInfo: false,
    sharedFiles: false,
    sharedLinks: false
  });

  const { globalSettingsEnabled, setGlobalSettingsEnabled } = useTheme();
  const [tone, setTone] = useState('professional');
  const [userInfo, setUserInfo] = useState('');
  const [chatRules, setChatRules] = useState(['Be respectful and clear while interacting']);

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => {
      // If the clicked section is already open, close it
      if (prev[section]) {
        return {
          generalInfo: false,
          additionalInfo: false,
          sharedFiles: false,
          sharedLinks: false
        };
      }
      
      // Otherwise, close all sections and open the clicked one
      return {
        generalInfo: false,
    additionalInfo: false,
    sharedFiles: false,
    sharedLinks: false,
        [section]: true
      };
    });
  };

  const addChatRule = () => {
    setChatRules(prev => [...prev, `Chat rule ${prev.length + 1}...`]);
  };

  const updateChatRule = (index: number, value: string) => {
    setChatRules(prev => prev.map((rule, i) => i === index ? value : rule));
  };

  const removeChatRule = (index: number) => {
    setChatRules(prev => prev.filter((_, i) => i !== index));
  };

  const saveSettings = () => {
    alert('Settings saved successfully!');
  };

  const extractLinksFromMessages = () => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const linksFromAI: string[] = [];
    const linksFromUser: string[] = [];

    conversation?.messages.forEach(message => {
      const matches = message.content.match(urlRegex);
      if (matches) {
        matches.forEach(link => {
          if (message.role === 'assistant') {
            linksFromAI.push(link);
          } else if (message.role === 'user') {
            linksFromUser.push(link);
          }
        });
      }
    });

    return { linksFromAI, linksFromUser };
  };

  if (!conversation) {
    return (
      <div className={`w-80 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-l flex flex-col transition-colors duration-300`}>
        <div className="p-6 text-center text-gray-500">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <p className="text-sm">Select a conversation to view contact details</p>
        </div>
      </div>
    );
  }

  const getContactName = () => {
    return conversation.name || 'Contact';
  };

  const getContactEmail = () => {
    return 'contact@example.com';
  };

  const getDateCreated = () => {
    if (conversation.messages.length === 0) return 'Oct 12, 2022 • 11:43';
    const firstMessage = conversation.messages[0];
    const date = new Date(firstMessage.timestamp);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    }) + ' • ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getStatus = () => {
    return 'Active User';
  };

  const getTotalChatCount = () => {
    return conversation.messages.length;
  };

  const getAIChatCount = () => {
    return conversation.messages.filter(msg => msg.role === 'assistant').length;
  };

  const getUserChatCount = () => {
    return conversation.messages.filter(msg => msg.role === 'user').length;
  };


  return (
    <div className={`w-80 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-l flex flex-col transition-colors duration-300`}>
      {/* Header */}
      <div className={`p-6 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
        <h2 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>Chat Details</h2>
      </div>

      {/* Collapsible Sections */}
      <div className="flex-1 overflow-y-auto">
        {/* General Information */}
        <div className={`border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <button
            onClick={() => toggleSection('generalInfo')}
            className={`w-full flex items-center justify-between p-4 text-left ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'} transition-colors`}
          >
            <span className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>General Information</span>
            <motion.div
              animate={{ rotate: expandedSections.generalInfo ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </motion.div>
          </button>
          
          <AnimatePresence>
            {expandedSections.generalInfo && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <div className="p-6 pt-0">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-medium">
            {getContactName().charAt(0)}
          </div>
          <div>
                      <h4 className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>{getContactName()}</h4>
                      <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>{getContactEmail()}</p>
                    </div>
                  </div>

                  <div className="space-y-3 text-sm">
                    {/* Total Chat Count */}
                    <div className={`p-3 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'} rounded-lg`}>
                      <div className="flex items-center justify-between">
                        <span className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>Total Chats</span>
                        <span className={`text-lg font-bold ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`}>
                          {getTotalChatCount()}
                        </span>
                      </div>
                    </div>

                    {/* AI Chat Count */}
                    <div className={`p-3 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'} rounded-lg`}>
                      <div className="flex items-center justify-between">
                        <span className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>From AI</span>
                        <span className={`text-lg font-bold ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                          {getAIChatCount()}
                        </span>
                      </div>
                    </div>

                    {/* User Chat Count */}
                    <div className={`p-3 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'} rounded-lg`}>
                      <div className="flex items-center justify-between">
                        <span className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>From User</span>
                        <span className={`text-lg font-bold ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>
                          {getUserChatCount()}
                        </span>
          </div>
        </div>

                    {/* Date Created */}
          <div>
                      <span className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>Date Created: </span>
                      <span className={isDarkMode ? 'text-white' : 'text-gray-800'}>{getDateCreated()}</span>
          </div>
                    
                    {/* Status */}
          <div className="flex items-center">
                      <span className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>Status: </span>
                      <span className={`ml-2 ${isDarkMode ? 'bg-purple-600 text-white' : 'bg-purple-100 text-purple-700'} px-2 py-1 rounded-full text-xs font-medium`}>
              {getStatus()}
            </span>
          </div>
        </div>
      </div>
              </motion.div>
            )}
          </AnimatePresence>
      </div>

        {/* Additional Info */}
        <div className={`border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <button
            onClick={() => toggleSection('additionalInfo')}
            className={`w-full flex items-center justify-between p-4 text-left ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'} transition-colors`}
          >
            <span className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>Additional Info</span>
            <motion.svg
              className="w-5 h-5 text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              animate={{ rotate: expandedSections.additionalInfo ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </motion.svg>
          </button>
          <AnimatePresence>
            {expandedSections.additionalInfo && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className={`p-4 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                  <h4 className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-gray-800'} mb-2`}>Chat Summary</h4>
                  <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                    This conversation covers topics related to academic inquiries, course information, and campus services. 
                    The user has shown interest in admission requirements and program details.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Shared Files */}
        <div className={`border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <button
            onClick={() => toggleSection('sharedFiles')}
            className={`w-full flex items-center justify-between p-4 text-left ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'} transition-colors`}
          >
            <span className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>Chat Settings</span>
            <motion.svg
              className="w-5 h-5 text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              animate={{ rotate: expandedSections.sharedFiles ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </motion.svg>
          </button>
          <AnimatePresence>
            {expandedSections.sharedFiles && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className={`p-4 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                  <div className="space-y-6">
                    {/* Global Settings Toggle */}
                    <div className={`${isDarkMode ? 'bg-gray-600 border-gray-500' : 'bg-white border-gray-200'} rounded-lg p-4 border`}>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>Global Settings</h4>
                        <button
                          onClick={() => setGlobalSettingsEnabled(!globalSettingsEnabled)}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                            globalSettingsEnabled ? 'bg-purple-600' : isDarkMode ? 'bg-gray-500' : 'bg-gray-200'
                          }`}
                        >
                          <span
                            className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                              globalSettingsEnabled ? 'translate-x-5' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                      <p className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                        Enable or disable global settings for the chatbot
                      </p>
                    </div>

                    {/* Form - Only show when global settings is OFF */}
                    {!globalSettingsEnabled && (
                      <div className="space-y-4">
                        {/* Tone Selection */}
                        <div className={`${isDarkMode ? 'bg-gray-600 border-gray-500' : 'bg-white border-gray-200'} rounded-lg p-4 border`}>
                          <h4 className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-gray-800'} mb-3`}>Tone</h4>
                          <select
                            value={tone}
                            onChange={(e) => setTone(e.target.value)}
                            className={`w-full p-2 border ${isDarkMode ? 'border-gray-500 bg-gray-500 text-white' : 'border-gray-300 bg-white text-gray-800'} rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent`}
                            style={{ color: isDarkMode ? '#ffffff' : '#1f2937' }}
                          >
                            <option value="professional" style={{ color: isDarkMode ? '#ffffff' : '#1f2937', backgroundColor: isDarkMode ? '#374151' : 'white' }}>Professional</option>
                            <option value="joyful" style={{ color: isDarkMode ? '#ffffff' : '#1f2937', backgroundColor: isDarkMode ? '#374151' : 'white' }}>Joyful</option>
                            <option value="friendly" style={{ color: isDarkMode ? '#ffffff' : '#1f2937', backgroundColor: isDarkMode ? '#374151' : 'white' }}>Friendly</option>
                            <option value="formal" style={{ color: isDarkMode ? '#ffffff' : '#1f2937', backgroundColor: isDarkMode ? '#374151' : 'white' }}>Formal</option>
                            <option value="casual" style={{ color: isDarkMode ? '#ffffff' : '#1f2937', backgroundColor: isDarkMode ? '#374151' : 'white' }}>Casual</option>
                            <option value="helpful" style={{ color: isDarkMode ? '#ffffff' : '#1f2937', backgroundColor: isDarkMode ? '#374151' : 'white' }}>Helpful</option>
                          </select>
                        </div>

                        {/* User Information */}
                        <div className={`${isDarkMode ? 'bg-gray-600 border-gray-500' : 'bg-white border-gray-200'} rounded-lg p-4 border`}>
                          <h4 className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-gray-800'} mb-3`}>User Information</h4>
                          <textarea
                            value={userInfo}
                            onChange={(e) => setUserInfo(e.target.value)}
                            placeholder="Enter user information here..."
                            className={`w-full p-2 border ${isDarkMode ? 'border-gray-500 bg-gray-500 text-white' : 'border-gray-300 bg-white text-gray-800'} rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent h-20 resize-none`}
                            style={{ color: isDarkMode ? '#ffffff' : '#1f2937' }}
                          />
                        </div>

                        {/* Chat Rules */}
                        <div className={`${isDarkMode ? 'bg-gray-600 border-gray-500' : 'bg-white border-gray-200'} rounded-lg p-4 border`}>
                          <div className="flex items-center justify-between mb-3">
                            <h4 className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>Chat Rules</h4>
                            <button
                              onClick={addChatRule}
                              className="p-1 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors flex items-center gap-1 text-xs"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                              </svg>
                              Add Rule
                            </button>
                          </div>
                          <div className="space-y-2">
                            {chatRules.map((rule, index) => (
                              <div key={index} className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={rule}
                                  onChange={(e) => updateChatRule(index, e.target.value)}
                                  placeholder={`Chat rule ${index + 1}...`}
                                  className={`flex-1 p-2 border ${isDarkMode ? 'border-gray-500 bg-gray-500 text-white' : 'border-gray-300 bg-white text-gray-800'} rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent`}
                                  style={{ color: isDarkMode ? '#ffffff' : '#1f2937' }}
                                />
                                {chatRules.length > 1 && (
                                  <button
                                    onClick={() => removeChatRule(index)}
                                    className={`p-1 ${isDarkMode ? 'text-red-400 hover:bg-red-900' : 'text-red-600 hover:bg-red-50'} rounded transition-colors`}
                                  >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Save Button */}
                        <div className="flex justify-end">
                          <button
                            onClick={saveSettings}
                            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
                          >
                            Save Settings
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Shared Links */}
        <div className={`border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <button
            onClick={() => toggleSection('sharedLinks')}
            className={`w-full flex items-center justify-between p-4 text-left ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'} transition-colors`}
          >
            <span className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>Shared Links</span>
            <motion.svg
              className="w-5 h-5 text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              animate={{ rotate: expandedSections.sharedLinks ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </motion.svg>
          </button>
          <AnimatePresence>
            {expandedSections.sharedLinks && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className={`p-4 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                  {(() => {
                    const { linksFromAI, linksFromUser } = extractLinksFromMessages();
                    const totalLinks = linksFromAI.length + linksFromUser.length;
                    
                    if (totalLinks === 0) {
                      return (
                        <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>No shared links yet.</p>
                      );
                    }

                    return (
                      <div className="space-y-4">
                        {/* Links from AI */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <h4 className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>Links from AI</h4>
                            <span className={`text-xs px-2 py-1 rounded-full ${isDarkMode ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-800'}`}>
                              {linksFromAI.length}
                            </span>
                          </div>
                          {linksFromAI.length > 0 ? (
                            <div className="space-y-2">
                              {linksFromAI.map((link, index) => (
                                <div key={index} className={`p-2 ${isDarkMode ? 'bg-gray-600' : 'bg-gray-100'} rounded-lg`}>
                                  <a 
                                    href={link} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className={`text-sm ${isDarkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800'} break-all`}
                                  >
                                    {link}
                                  </a>
                                </div>
                              ))}
                </div>
                          ) : (
                            <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>No links shared by AI</p>
            )}
        </div>

                        {/* Links from User */}
        <div>
                          <div className="flex items-center justify-between mb-2">
                            <h4 className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>Links from User</h4>
                            <span className={`text-xs px-2 py-1 rounded-full ${isDarkMode ? 'bg-green-600 text-white' : 'bg-green-100 text-green-800'}`}>
                              {linksFromUser.length}
                            </span>
                          </div>
                          {linksFromUser.length > 0 ? (
                            <div className="space-y-2">
                              {linksFromUser.map((link, index) => (
                                <div key={index} className={`p-2 ${isDarkMode ? 'bg-gray-600' : 'bg-gray-100'} rounded-lg`}>
                                  <a 
                                    href={link} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className={`text-sm ${isDarkMode ? 'text-green-400 hover:text-green-300' : 'text-green-600 hover:text-green-800'} break-all`}
                                  >
                                    {link}
                                  </a>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>No links shared by user</p>
                          )}
                        </div>

                        {/* Summary */}
                        <div className={`pt-2 border-t ${isDarkMode ? 'border-gray-600' : 'border-gray-300'}`}>
                          <p className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                            Total links found: <span className="font-medium">{totalLinks}</span>
                          </p>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </div>
    </div>
  );
}
