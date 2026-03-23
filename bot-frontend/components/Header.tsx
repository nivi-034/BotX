import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '@/contexts/ThemeContext';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  addNewConversation: () => void;
  clearAllConversations: () => void;
  setActiveNavItem?: (item: string) => void;
}

export default function Header({ activeTab, setActiveTab, addNewConversation, clearAllConversations, setActiveNavItem }: HeaderProps) {
  const [isFaqOpen, setIsFaqOpen] = useState(false);
  const [isQuickActionsOpen, setIsQuickActionsOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [feedback, setFeedback] = useState('');
  const { isDarkMode, toggleTheme, globalSettingsEnabled, setGlobalSettingsEnabled } = useTheme();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsQuickActionsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleFeedbackSubmit = () => {
    if (feedback.trim()) {
      alert('Thank you for your feedback! We appreciate your input.');
      setFeedback('');
      setIsFeedbackOpen(false);
    }
  };

  const quickActions = [
    { 
      id: 'new-chat', 
      label: 'New Chat', 
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
      ),
      onClick: addNewConversation
    },
    { 
      id: 'delete-all', 
      label: 'Delete All', 
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      ),
      onClick: () => {
        if (confirm('Are you sure you want to delete all conversations? This action cannot be undone.')) {
          clearAllConversations();
        }
      }
    },
    { 
      id: 'reset-settings', 
      label: 'Reset Settings', 
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      ),
      onClick: () => {
        if (confirm('Are you sure you want to reset all settings to default?')) {
          alert('Settings reset to default');
        }
      }
    },
    { 
      id: 'faq', 
      label: 'FAQ', 
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      onClick: () => setIsFaqOpen(true)
    }
  ];

  return (
    <div className={`${isDarkMode ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'} border-b px-6 py-4 flex items-center justify-between sticky top-0 z-50`}>
      {/* Left side - Logo */}
      <div className="flex items-center">
        <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-purple-800 rounded-lg flex items-center justify-center text-white font-bold text-lg mr-3">
          N
        </div>
        <span className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>EchoBot</span>
      </div>

      {/* Center - Quick Actions */}
      <div className={`flex items-center space-x-2 ${isDarkMode ? 'bg-gray-800 border-gray-600' : 'bg-pink-50 border-gray-200'} border rounded-full p-3`}>
        {quickActions.map((action) => (
          <button
            key={action.id}
            onClick={action.onClick}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 flex items-center gap-2 border ${
              isDarkMode 
                ? 'bg-gray-700 text-gray-300 hover:text-white hover:bg-gray-600 border-gray-600 hover:border-gray-500' 
                : 'bg-white text-gray-600 hover:text-gray-800 hover:bg-gray-100 border-gray-200 hover:border-gray-300'
            }`}
            title={action.label}
          >
            {action.icon}
            {action.label}
          </button>
        ))}
      </div>

      {/* Right side - Theme and Settings */}
      <div className="flex items-center space-x-4">
        {/* Theme Toggle */}
        <button 
          onClick={toggleTheme}
          className={`p-2 rounded-full transition-colors ${
            isDarkMode 
              ? 'text-yellow-400 hover:text-yellow-300 hover:bg-gray-700' 
              : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
          }`}
          title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {isDarkMode ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          )}
        </button>

        {/* Quick Actions Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button 
            onClick={() => setIsQuickActionsOpen(!isQuickActionsOpen)}
            className={`p-2 rounded-full transition-colors ${
              isDarkMode 
                ? 'text-gray-300 hover:text-white hover:bg-gray-700' 
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
            }`}
            title="Quick Actions"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              {/* Stopwatch body */}
              <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="2"/>
              {/* Stopwatch stem */}
              <rect x="11" y="4" width="2" height="3" fill="currentColor"/>
              {/* Clock hands */}
              <line x1="12" y1="12" x2="12" y2="8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <line x1="12" y1="12" x2="15" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              {/* Flames */}
              <path d="M4 8c0-1 1-2 2-2s2 1 2 2c0 1-1 2-2 2s-2-1-2-2z" fill="#ff6b35"/>
              <path d="M3 9c0-0.5 0.5-1 1-1s1 0.5 1 1c0 0.5-0.5 1-1 1s-1-0.5-1-1z" fill="#ff8c42"/>
              <path d="M2 10c0-0.3 0.3-0.6 0.6-0.6s0.6 0.3 0.6 0.6c0 0.3-0.3 0.6-0.6 0.6s-0.6-0.3-0.6-0.6z" fill="#ffa726"/>
          </svg>
        </button>

          {/* Dropdown Menu */}
          {isQuickActionsOpen && (
            <div className={`absolute right-0 top-full mt-2 w-64 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border rounded-lg shadow-lg z-50`}>
              <div className="p-4">
                {/* Global Settings Toggle */}
                <div className="flex items-center justify-between mb-4">
                  <span className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>Global Settings</span>
                  <button
                    onClick={() => setGlobalSettingsEnabled(!globalSettingsEnabled)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                      globalSettingsEnabled ? 'bg-purple-600' : isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                        globalSettingsEnabled ? 'translate-x-5' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Divider */}
                <div className={`border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} my-3`}></div>

                {/* Quick Actions Title */}
                <div className="mb-3">
                  <h3 className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>Quick Actions</h3>
                </div>

                {/* Help Page */}
                <button
                  onClick={() => {
                    setIsQuickActionsOpen(false);
                    setIsHelpOpen(true);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    isDarkMode 
                      ? 'text-gray-300 hover:bg-gray-700 hover:text-white' 
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'
                  }`}
                >
                  <div className="flex items-center">
                    <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Help
                  </div>
                </button>

                {/* Feedback */}
                <button
                  onClick={() => {
                    setIsQuickActionsOpen(false);
                    setIsFeedbackOpen(true);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    isDarkMode 
                      ? 'text-gray-300 hover:bg-gray-700 hover:text-white' 
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'
                  }`}
                >
                  <div className="flex items-center">
                    <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                    </svg>
                    Feedback
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Settings */}
        <button 
          onClick={() => setActiveNavItem && setActiveNavItem('settings')}
          className={`p-2 rounded-full transition-colors ${
            isDarkMode 
              ? 'text-gray-300 hover:text-white hover:bg-gray-700' 
              : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
          }`}
          title="Settings"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>

      {/* FAQ Modal */}
      {isFaqOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden"
          >
            {/* Modal Header */}
            <div className="bg-gray-800 text-white px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Frequently Asked Questions</h2>
          <button
                onClick={() => setIsFaqOpen(false)}
                className="text-gray-300 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">1. What are the admission requirements?</h3>
                  <ul className="text-gray-600 space-y-1 ml-4">
                    <li>• High school diploma or equivalent</li>
                    <li>• Minimum GPA of 2.5</li>
                    <li>• SAT/ACT scores (optional)</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">2. How do I apply for financial aid?</h3>
                  <ul className="text-gray-600 space-y-1 ml-4">
                    <li>• Complete the FAFSA form</li>
                    <li>• Submit required documents</li>
                    <li>• Meet with financial aid office</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">3. What programs are available?</h3>
                  <ul className="text-gray-600 space-y-1 ml-4">
                    <li>• Business Administration</li>
                    <li>• Computer Science</li>
                    <li>• Engineering</li>
                    <li>• Liberal Arts</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">4. How do I register for classes?</h3>
                  <ul className="text-gray-600 space-y-1 ml-4">
                    <li>• Meet with academic advisor</li>
                    <li>• Check course availability</li>
                    <li>• Complete registration online</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-gray-50 px-6 py-4 flex justify-end">
              <button
                onClick={() => setIsFaqOpen(false)}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Feedback Modal */}
      {isFeedbackOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden`}
          >
            {/* Modal Header */}
            <div className={`${isDarkMode ? 'bg-gray-700' : 'bg-gray-800'} text-white px-6 py-4 flex items-center justify-between`}>
              <h2 className="text-lg font-semibold">Feedback & Bug Reports</h2>
              <button
                onClick={() => setIsFeedbackOpen(false)}
                className="text-gray-300 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <label className={`block text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-800'} mb-2`}>
                    Your Feedback
                  </label>
                  <textarea
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder="Please share your feedback about the application or report any bugs you've encountered..."
                    className={`w-full p-3 border ${isDarkMode ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-white text-gray-800'} rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent h-32 resize-none`}
                    style={{ color: isDarkMode ? '#ffffff' : '#1f2937' }}
                  />
                </div>
                
                <div className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  <p>We appreciate your feedback! Please let us know:</p>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>What features you'd like to see improved</li>
                    <li>Any bugs or issues you've encountered</li>
                    <li>Suggestions for new features</li>
                    <li>General feedback about your experience</li>
                  </ul>
                </div>
              </div>
              </div>

            {/* Modal Footer */}
            <div className={`${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'} px-6 py-4 flex justify-end space-x-3`}>
              <button
                onClick={() => setIsFeedbackOpen(false)}
                className={`px-4 py-2 ${isDarkMode ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-800'} transition-colors`}
              >
                Cancel
              </button>
              <button
                onClick={handleFeedbackSubmit}
                disabled={!feedback.trim()}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  feedback.trim() 
                    ? 'bg-purple-600 text-white hover:bg-purple-700' 
                    : isDarkMode 
                      ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                Submit Feedback
              </button>
            </div>
            </motion.div>
        </div>
      )}

      {/* Help Modal */}
      {isHelpOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden`}
          >
            {/* Modal Header */}
            <div className={`${isDarkMode ? 'bg-gray-700' : 'bg-gray-800'} text-white px-6 py-4 flex items-center justify-between`}>
              <h2 className="text-lg font-semibold">Help & Guide</h2>
              <button
                onClick={() => setIsHelpOpen(false)}
                className="text-gray-300 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto max-h-[70vh]">
              <div className="space-y-6">
                {/* Chatbot Description */}
                <div>
                  <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-800'} mb-3`}>
                    💬 Chatbot Description
                  </h3>
                  <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'} leading-relaxed`}>
                    The college chatbot is your virtual guide for all campus-related queries. It helps students, parents, and visitors quickly find information about admissions, courses, departments, facilities, and events — all through simple, conversational chat. You can ask questions, get instant answers, and access the right links or resources without navigating multiple pages. The chatbot is available 24/7, ensuring a smooth and interactive experience for anyone visiting the college website.
                  </p>
                </div>

                {/* Help & Guide */}
                <div>
                  <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-800'} mb-3`}>
                    📚 Help & Guide
                  </h3>
                  <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'} mb-4`}>
                    Welcome to the Chatbot Help Center — here's everything you need to know about using and managing your chatbot experience.
                  </p>
                </div>

                {/* Global Settings */}
                <div>
                  <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-800'} mb-2`}>
                    ⚙️ Global Settings
                  </h3>
                  <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                    Manage your chatbot preferences in one place. You can customize tone, reset data, and access user info or chat summaries.
                  </p>
                </div>

                {/* Chat Details */}
                <div>
                  <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-800'} mb-2`}>
                    💬 Chat Details
                  </h3>
                  <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'} mb-2`}>
                    Track your interactions effortlessly:
                  </p>
                  <ul className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'} list-disc list-inside ml-4 space-y-1`}>
                    <li><strong>Total Chats</strong> – View the total number of conversations</li>
                    <li><strong>From AI</strong> – See the total responses generated by the chatbot</li>
                    <li><strong>From User</strong> – Count of all user messages sent</li>
                  </ul>
                </div>

                {/* Chat Summary */}
                <div>
                  <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-800'} mb-2`}>
                    🧾 Chat Summary
                  </h3>
                  <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                    Get a quick overview of your recent interactions — see key highlights, summaries, and patterns from past chats.
                  </p>
                </div>

                {/* Tone Preference */}
                <div>
                  <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-800'} mb-2`}>
                    🎨 Tone Preference
                  </h3>
                  <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                    Adjust how the chatbot communicates with you — choose between formal, friendly, informative, or concise tones depending on your needs.
                  </p>
                </div>

                {/* User Info */}
                <div>
                  <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-800'} mb-2`}>
                    👤 User Info
                  </h3>
                  <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                    View or update your profile details that personalize your chat experience — such as your name, role, or department.
                  </p>
                </div>

                {/* Chat Rules */}
                <div>
                  <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-800'} mb-2`}>
                    📜 Chat Rules
                  </h3>
                  <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'} mb-2`}>
                    Understand how the chatbot operates responsibly:
                  </p>
                  <ul className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'} list-disc list-inside ml-4 space-y-1`}>
                    <li>Be respectful and clear while interacting</li>
                    <li>Avoid sharing sensitive personal data</li>
                    <li>The chatbot is meant for general guidance, not official admission or academic decisions</li>
                  </ul>
                </div>

                {/* Shared Links */}
                <div>
                  <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-800'} mb-2`}>
                    🔗 Shared Links
                  </h3>
                  <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'} mb-2`}>
                    Access shared information easily:
                  </p>
                  <ul className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'} list-disc list-inside ml-4 space-y-1`}>
                    <li><strong>From AI</strong> – View all links, documents, and resources shared by the chatbot</li>
                    <li><strong>From User</strong> – Manage any links or attachments you've shared during the conversation</li>
                  </ul>
                </div>

                {/* Delete All Chats */}
                <div>
                  <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-800'} mb-2`}>
                    🗑️ Delete All Chats
                  </h3>
                  <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                    Remove all your previous chat history in one click. Note: This action is permanent and cannot be undone.
                  </p>
                </div>

                {/* Reset Settings */}
                <div>
                  <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-800'} mb-2`}>
                    ♻️ Reset Settings
                  </h3>
                  <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                    Restore all chatbot preferences to their default state — useful when you want to start fresh or fix any configuration issues.
                  </p>
        </div>
      </div>
            </div>

            {/* Modal Footer */}
            <div className={`${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'} px-6 py-4 flex justify-end`}>
              <button
                onClick={() => setIsHelpOpen(false)}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
