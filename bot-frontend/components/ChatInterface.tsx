import { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Message from './Message';
import { sendMessage, checkHealth } from '@/services/api';
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

interface ChatInterfaceProps {
  conversation: Conversation;
  setConversations: React.Dispatch<React.SetStateAction<Conversation[]>>;
  conversations: Conversation[];
  isSidebarOpen: boolean;
  setIsSidebarOpen: (isOpen: boolean) => void;
  activeNavItem?: string;
}

export default function ChatInterface({ 
  conversation, 
  setConversations,
  conversations,
  isSidebarOpen,
  setIsSidebarOpen,
  activeNavItem = 'chat'
}: ChatInterfaceProps) {
  const { isDarkMode } = useTheme();
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamedResponse, setStreamedResponse] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<number[]>([]);
  const [currentResultIndex, setCurrentResultIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  // Settings state
  const { globalSettingsEnabled, setGlobalSettingsEnabled } = useTheme();
  const [tone, setTone] = useState('professional');
  const [userInfo, setUserInfo] = useState('');
  const [chatRules, setChatRules] = useState(['']);
  
  // Voice recognition states
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [showVoiceEdit, setShowVoiceEdit] = useState(false);
  const [voiceMessage, setVoiceMessage] = useState('');
  const recognitionRef = useRef<any>(null);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // File upload states
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [fileAnalysis, setFileAnalysis] = useState<string>('');
  const [fileError, setFileError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkIfMobile();
    window.addEventListener('resize', checkIfMobile);
    return () => window.removeEventListener('resize', checkIfMobile);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [conversation.messages, streamedResponse]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [message]);

  // Load conversations from localStorage on initial load
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
      } catch (error) {
        console.error('Error parsing saved conversations:', error);
      }
    }
  }, []);

  // Save conversations to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('conversations', JSON.stringify(conversations));
  }, [conversations]);

  // Check backend connection on component mount
  useEffect(() => {
    const checkBackendConnection = async () => {
      const isConnected = await checkHealth();
      setIsOfflineMode(!isConnected);
    };
    
    checkBackendConnection();
  }, []);

  // Add scroll detection to show/hide scroll button
  useEffect(() => {
    const messagesContainer = messagesContainerRef.current;
    if (!messagesContainer) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = messagesContainer;
      const isScrolledUp = scrollHeight - scrollTop - clientHeight > 100;
      setShowScrollButton(isScrolledUp);
    };

    messagesContainer.addEventListener('scroll', handleScroll);
    return () => messagesContainer.removeEventListener('scroll', handleScroll);
  }, []);

  // Add this effect to handle search functionality
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setSearchResults([]);
      return;
    }
    
    const query = searchQuery.toLowerCase();
    const results: number[] = [];
    
    conversation.messages.forEach((msg, index) => {
      if (msg.content.toLowerCase().includes(query)) {
        results.push(index);
      }
    });
    
    setSearchResults(results);
    setCurrentResultIndex(results.length > 0 ? 0 : -1);
  }, [searchQuery, conversation.messages]);

  // Add this function to navigate between search results
  const navigateSearchResults = (direction: 'next' | 'prev') => {
    if (searchResults.length === 0) return;
    
    if (direction === 'next') {
      setCurrentResultIndex((prevIndex) => 
        prevIndex + 1 >= searchResults.length ? 0 : prevIndex + 1
      );
    } else {
      setCurrentResultIndex((prevIndex) => 
        prevIndex - 1 < 0 ? searchResults.length - 1 : prevIndex - 1
      );
    }
  };

  // Add this effect to scroll to the current search result
  useEffect(() => {
    if (currentResultIndex >= 0 && searchResults.length > 0) {
      const messageIndex = searchResults[currentResultIndex];
      const messageElement = document.getElementById(`message-${messageIndex}`);
      if (messageElement) {
        messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [currentResultIndex, searchResults]);

  // Cleanup voice recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
      }
    };
  }, []);

  // Add this function to toggle search bar
  const toggleSearch = () => {
    setIsSearchOpen(!isSearchOpen);
    setSearchQuery('');
    setSearchResults([]);
    
    // Focus the search input when opened
    if (!isSearchOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  };

  // Settings functions
  const addChatRule = () => {
    setChatRules([...chatRules, '']);
  };

  const updateChatRule = (index: number, value: string) => {
    const newRules = [...chatRules];
    newRules[index] = value;
    setChatRules(newRules);
  };

  const removeChatRule = (index: number) => {
    if (chatRules.length > 1) {
      const newRules = chatRules.filter((_, i) => i !== index);
      setChatRules(newRules);
    }
  };

  const saveSettings = () => {
    console.log('Saving settings:', {
      globalSettingsEnabled,
      tone,
      userInfo,
      chatRules
    });
    // Here you would typically save to backend or localStorage
    alert('Settings saved successfully!');
  };

  // Voice recognition functions
  const initializeVoiceRecognition = () => {
    if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onstart = () => {
        setIsListening(true);
        setTranscript('');
      };


      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
        if (transcript.trim()) {
          setVoiceMessage(transcript);
          setShowVoiceEdit(true);
        }
      };

      recognitionRef.current.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        setTranscript(finalTranscript + interimTranscript);
        
        // Clear existing timeout
        if (silenceTimeoutRef.current) {
          clearTimeout(silenceTimeoutRef.current);
        }
        
        // Set new timeout to auto-stop after 3 seconds of silence
        if (finalTranscript.trim()) {
          silenceTimeoutRef.current = setTimeout(() => {
            if (recognitionRef.current && isListening) {
              recognitionRef.current.stop();
            }
          }, 3000);
        }
      };
    }
  };

  const startListening = () => {
    if (!recognitionRef.current) {
      initializeVoiceRecognition();
    }
    
    if (recognitionRef.current && !isListening) {
      setTranscript('');
      setVoiceMessage('');
      setShowVoiceEdit(false);
      recognitionRef.current.start();
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
    }
  };

  const handleVoiceEdit = () => {
    setMessage(voiceMessage);
    setShowVoiceEdit(false);
    setVoiceMessage('');
    setTranscript('');
    setIsVoiceMode(false);
    // Focus the textarea after setting the message
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }, 100);
  };

  const handleVoiceSend = async () => {
    if (!voiceMessage.trim()) return;
    
    // Close the modal first
    setShowVoiceEdit(false);
    setVoiceMessage('');
    setTranscript('');
    setIsVoiceMode(false);
    
    const messageToSend = voiceMessage.trim();
    
    // Add user message
    const userMessage = {
      id: Date.now(),
      content: messageToSend,
      role: 'user' as const,
      timestamp: new Date()
    };

    // Update conversation with user message
    const updatedConversations = conversations.map(c => {
      if (c.id === conversation.id) {
        // If this is the first message, update the conversation name
        let updatedName = c.name;
        if (c.messages.length === 0) {
          // For new chats, use the first part of the message as the name
          updatedName = messageToSend.length > 25 ? messageToSend.substring(0, 25) + '...' : messageToSend;
          
          // If the message starts with a question, use that
          const questionMatch = messageToSend.match(/^(What|How|Why|When|Where|Is|Are|Can|Could|Do|Does|Who).{5,30}\??/i);
          if (questionMatch) {
            updatedName = questionMatch[0];
            if (!updatedName.endsWith('?')) updatedName += '?';
          }
        }
        return {
          ...c,
          name: updatedName,
          messages: [...c.messages, userMessage]
        };
      }
      return c;
    });
    
    setConversations(updatedConversations);
    setIsLoading(true);
    setStreamedResponse('');

    try {
      // Get the updated conversation with the new user message
      const currentConversation = updatedConversations.find(c => c.id === conversation.id);
      if (!currentConversation) throw new Error('Conversation not found');

      // Prepare message with file context if files are uploaded
      let messageWithContext = messageToSend;
      if (uploadedFiles.length > 0 && fileAnalysis) {
        messageWithContext = `Files uploaded: ${uploadedFiles.map(f => f.name).join(', ')}\n\nFile Analysis:\n${fileAnalysis}\n\nUser Question: ${messageToSend}`;
      }

      // Send the message to the backend
      const response = await sendMessage(
        messageWithContext, 
        currentConversation.sessionId || null,
        currentConversation.messages
      );

      if (!response.ok && response.status !== 200) {
        throw new Error(`Server responded with ${response.status}`);
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      if (!reader) throw new Error('Response body is null');

      // Create a temporary message for the streaming response
      const tempAiMessage = {
        id: Date.now(),
        content: '',
        role: 'assistant' as const,
        timestamp: new Date()
      };

      // Add the temporary message to the conversation
      setConversations(prevConversations => 
        prevConversations.map(c => 
          c.id === conversation.id 
            ? { 
                ...c, 
                messages: [...c.messages, tempAiMessage],
                sessionId: c.sessionId || `session-${Date.now()}` // Create a session ID if none exists
              } 
            : c
        )
      );

      // Process the stream
      let accumulatedContent = '';
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.substring(6);
            if (data) {
              try {
                // Parse the JSON response and extract only the response text
                const parsedData = JSON.parse(data);
                const responseText = parsedData.response || data;
                const isDone = parsedData.done || false;
                
                // Update accumulated content with the streaming response
                accumulatedContent = responseText;
                setStreamedResponse(accumulatedContent);
                
                // Update the AI message content as we receive it
                setConversations(prevConversations => 
                  prevConversations.map(c => 
                    c.id === conversation.id 
                      ? { 
                          ...c, 
                          messages: c.messages.map(m => 
                            m.id === tempAiMessage.id 
                              ? { ...m, content: accumulatedContent } 
                              : m
                          ) 
                        } 
                      : c
                  )
                );
                
                // If streaming is done, break out of the loop
                if (isDone) {
                  break;
                }
              } catch (parseError) {
                // If JSON parsing fails, treat as plain text
                accumulatedContent = data;
                setStreamedResponse(accumulatedContent);
                
                // Update the AI message content as we receive it
                setConversations(prevConversations => 
                  prevConversations.map(c => 
                    c.id === conversation.id 
                      ? { 
                          ...c, 
                          messages: c.messages.map(m => 
                            m.id === tempAiMessage.id 
                              ? { ...m, content: accumulatedContent } 
                              : m
                          ) 
                        } 
                      : c
                  )
                );
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsLoading(false);
      setStreamedResponse('');
    }
  };

  const cancelVoiceEdit = () => {
    setShowVoiceEdit(false);
    setVoiceMessage('');
    setTranscript('');
    setIsVoiceMode(false);
  };

  // File upload functions
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const newFiles = Array.from(files);
      
      // Validate file types
      const validFiles: File[] = [];
      const invalidFiles: string[] = [];
      
      newFiles.forEach(file => {
        if (file.name.endsWith('.pdf') || file.name.endsWith('.txt') || file.type.startsWith('text/')) {
          validFiles.push(file);
        } else {
          invalidFiles.push(file.name);
        }
      });
      
      if (invalidFiles.length > 0) {
        setFileError(`Unsupported file types: ${invalidFiles.join(', ')}. Only PDF and TXT files are allowed.`);
        setTimeout(() => setFileError(''), 5000);
      }
      
      if (validFiles.length > 0) {
        setUploadedFiles(prev => [...prev, ...validFiles]);
        analyzeFiles(validFiles);
        setFileError('');
      }
    }
  };

  const analyzeFiles = async (files: File[]) => {
    setIsUploading(true);
    try {
      for (const file of files) {
        const analysis = await analyzeFile(file);
        setFileAnalysis(prev => prev + `\n\n**${file.name} Analysis:**\n${analysis}`);
      }
    } catch (error) {
      console.error('Error analyzing files:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const analyzeFile = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const content = e.target?.result as string;
          let analysis = '';
          
          if (file.type.startsWith('text/') || file.name.endsWith('.txt')) {
            analysis = `Text content: ${content.substring(0, 1000)}${content.length > 1000 ? '...' : ''}`;
          } else if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
            analysis = `PDF file: ${file.name} (${(file.size / 1024).toFixed(1)} KB) - Content extraction not available in browser. Please provide a text version for full analysis.`;
          } else {
            analysis = `Unsupported file type: ${file.name} (${(file.size / 1024).toFixed(1)} KB). Only PDF and TXT files are supported.`;
          }
          
          resolve(analysis);
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = () => reject(new Error('Failed to read file'));
      
      if (file.type.startsWith('text/') || file.name.endsWith('.txt')) {
        reader.readAsText(file);
      } else {
        // For PDF files, just provide basic info since we can't extract content in browser
        resolve(`PDF file: ${file.name} (${(file.size / 1024).toFixed(1)} KB) - Content extraction not available in browser. Please provide a text version for full analysis.`);
      }
    });
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  // Add this function to highlight search matches in text
  const highlightSearchMatches = (text: string) => {
    if (!searchQuery.trim()) return text;
    
    const parts = text.split(new RegExp(`(${searchQuery})`, 'gi'));
    
    return parts.map((part, i) => 
      part.toLowerCase() === searchQuery.toLowerCase() 
        ? <mark key={i} className="bg-yellow-200 text-gray-900 px-0.5 rounded">{part}</mark> 
        : part
    );
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || isLoading) return;

    // Add user message (show original message, not the enhanced context)
    const userMessage = {
      id: Date.now(),
      content: message,
      role: 'user' as const,
      timestamp: new Date()
    };

    // If files are uploaded, add a file attachment indicator to the message
    if (uploadedFiles.length > 0) {
      userMessage.content += `\n\n📎 Files attached: ${uploadedFiles.map(f => f.name).join(', ')}`;
    }

    // Update conversation with user message
    const updatedConversations = conversations.map(c => {
      if (c.id === conversation.id) {
        // If this is the first message, update the conversation name
        let updatedName = c.name;
        if (c.messages.length === 0) {
          // For new chats, use the first part of the message as the name
          updatedName = message.length > 25 ? message.substring(0, 25) + '...' : message;
          
          // If the message starts with a question, use that
          const questionMatch = message.match(/^(What|How|Why|When|Where|Is|Are|Can|Could|Do|Does|Who).{5,30}\??/i);
          if (questionMatch) {
            updatedName = questionMatch[0];
            if (!updatedName.endsWith('?')) updatedName += '?';
          }
        }
        return {
          ...c,
          name: updatedName,
          messages: [...c.messages, userMessage]
        };
      }
      return c;
    });
    
    setConversations(updatedConversations);
    setMessage('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    setIsLoading(true);
    setStreamedResponse('');

    try {
      // Get the updated conversation with the new user message
      const currentConversation = updatedConversations.find(c => c.id === conversation.id);
      if (!currentConversation) throw new Error('Conversation not found');

      // Prepare message with file context if files are uploaded
      let messageWithContext = message;
      if (uploadedFiles.length > 0 && fileAnalysis) {
        messageWithContext = `Files uploaded: ${uploadedFiles.map(f => f.name).join(', ')}\n\nFile Analysis:\n${fileAnalysis}\n\nUser Question: ${message}`;
        console.log('Sending message with file context:', messageWithContext);
      }
      
      // Clear the message input after preparing context
      setMessage('');

      // Send the message to the backend
      const response = await sendMessage(
        messageWithContext, 
        currentConversation.sessionId || null,
        currentConversation.messages
      );

      if (!response.ok && response.status !== 200) {
        throw new Error(`Server responded with ${response.status}`);
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      if (!reader) throw new Error('Response body is null');

      // Create a temporary message for the streaming response
      const tempAiMessage = {
        id: Date.now(),
        content: '',
        role: 'assistant' as const,
        timestamp: new Date()
      };

      // Add the temporary message to the conversation
      setConversations(prevConversations => 
        prevConversations.map(c => 
          c.id === conversation.id 
            ? { 
                ...c, 
                messages: [...c.messages, tempAiMessage],
                sessionId: c.sessionId || `session-${Date.now()}` // Create a session ID if none exists
              } 
            : c
        )
      );

      // Process the stream
      let accumulatedContent = '';
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.substring(6);
            if (data) {
              try {
                // Parse the JSON response and extract only the response text
                const parsedData = JSON.parse(data);
                const responseText = parsedData.response || data;
                const isDone = parsedData.done || false;
                
                // Update accumulated content with the streaming response
                accumulatedContent = responseText;
                setStreamedResponse(accumulatedContent);
                
                // Update the AI message content as we receive it
                setConversations(prevConversations => 
                  prevConversations.map(c => 
                    c.id === conversation.id 
                      ? { 
                          ...c, 
                          messages: c.messages.map(m => 
                            m.id === tempAiMessage.id 
                              ? { ...m, content: accumulatedContent } 
                              : m
                          ) 
                        } 
                      : c
                  )
                );
                
                // If streaming is done, break out of the loop
                if (isDone) {
                  break;
                }
              } catch (parseError) {
                // If JSON parsing fails, treat as plain text
                accumulatedContent = data;
                setStreamedResponse(accumulatedContent);
                
                // Update the AI message content as we receive it
                setConversations(prevConversations => 
                  prevConversations.map(c => 
                    c.id === conversation.id 
                      ? { 
                          ...c, 
                          messages: c.messages.map(m => 
                            m.id === tempAiMessage.id 
                              ? { ...m, content: accumulatedContent } 
                              : m
                          ) 
                        } 
                      : c
                  )
                );
              }
            }
          }
        }
      }

      // If we're in offline mode and successfully connected, update the status
      if (isOfflineMode) {
        setIsOfflineMode(false);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      
      // If we get a connection error, set offline mode
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        setIsOfflineMode(true);
      }
      
      // Add an error message
      setConversations(prevConversations => 
        prevConversations.map(c => 
          c.id === conversation.id 
            ? { 
                ...c, 
                messages: [...c.messages, {
                  id: Date.now(),
                  content: isOfflineMode 
                    ? "I'm currently in offline mode. The backend server is not available."
                    : 'Sorry, there was an error processing your request. Please try again.',
                  role: 'assistant' as const,
                  timestamp: new Date()
                }] 
              } 
            : c
        )
      );
    } finally {
      setIsLoading(false);
      setStreamedResponse('');
      
      // Clear uploaded files after sending message
      if (uploadedFiles.length > 0) {
        setUploadedFiles([]);
        setFileAnalysis('');
      }
    }
  };

  const handleRegenerateResponse = async (messageIndex: number) => {
    if (isLoading) return;
    
    // Find the user message that triggered this response
    const assistantMessage = conversation.messages[messageIndex];
    if (!assistantMessage || assistantMessage.role !== 'assistant') return;
    
    // Find the preceding user message
    let userMessageIndex = messageIndex - 1;
    while (userMessageIndex >= 0) {
      if (conversation.messages[userMessageIndex].role === 'user') {
        break;
      }
      userMessageIndex--;
    }
    
    if (userMessageIndex < 0) return;
    
    const userMessage = conversation.messages[userMessageIndex];
    
    // Remove all messages after and including the assistant message
    const updatedMessages = conversation.messages.slice(0, messageIndex);
    
    // Update the conversation
    setConversations(prevConversations => 
      prevConversations.map(c => 
        c.id === conversation.id 
          ? { ...c, messages: updatedMessages }
          : c
      )
    );
    
    // Set loading state
    setIsLoading(true);
    
    try {
      // Send the message to regenerate a response
      const response = await sendMessage(
        userMessage.content, 
        conversation.sessionId || null,
        updatedMessages
      );
      
      if (!response.ok && response.status !== 200) {
        throw new Error(`Server responded with ${response.status}`);
      }
      
      // Handle streaming response
      const reader = response.body?.getReader();
      if (!reader) throw new Error('Response body is null');
      
      // Create a temporary message for the streaming response
      const tempAiMessage = {
        id: Date.now(),
        content: '',
        role: 'assistant' as const,
        timestamp: new Date()
      };
      
      // Add the temporary message to the conversation
      setConversations(prevConversations => 
        prevConversations.map(c => 
          c.id === conversation.id 
            ? { 
                ...c, 
                messages: [...c.messages, tempAiMessage],
                sessionId: c.sessionId || `session-${Date.now()}`
              } 
            : c
        )
      );
      
      // Process the stream
      let accumulatedContent = '';
      const decoder = new TextDecoder();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.substring(6);
            if (data) {
              try {
                // Parse the JSON response and extract only the response text
                const parsedData = JSON.parse(data);
                const responseText = parsedData.response || data;
                accumulatedContent = responseText; // Replace instead of append for complete response
                setStreamedResponse(accumulatedContent);
                
                // Update the AI message content as we receive it
                setConversations(prevConversations => 
                  prevConversations.map(c => 
                    c.id === conversation.id 
                      ? { 
                          ...c, 
                          messages: c.messages.map(m => 
                            m.id === tempAiMessage.id 
                              ? { ...m, content: accumulatedContent } 
                              : m
                          ) 
                        } 
                      : c
                  )
                );
              } catch (parseError) {
                // If JSON parsing fails, treat as plain text
                accumulatedContent = data;
                setStreamedResponse(accumulatedContent);
                
                // Update the AI message content as we receive it
                setConversations(prevConversations => 
                  prevConversations.map(c => 
                    c.id === conversation.id 
                      ? { 
                          ...c, 
                          messages: c.messages.map(m => 
                            m.id === tempAiMessage.id 
                              ? { ...m, content: accumulatedContent } 
                              : m
                          ) 
                        } 
                      : c
                  )
                );
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error regenerating response:', error);
      
      // Add an error message
      setConversations(prevConversations => 
        prevConversations.map(c => 
          c.id === conversation.id 
            ? { 
                ...c, 
                messages: [...c.messages, {
                  id: Date.now(),
                  content: 'Sorry, there was an error regenerating the response. Please try again.',
                  role: 'assistant' as const,
                  timestamp: new Date()
                }] 
              } 
            : c
        )
      );
    } finally {
      setIsLoading(false);
      setStreamedResponse('');
    }
  };

  // Render settings page if activeNavItem is 'settings'
  if (activeNavItem === 'settings') {
  return (
      <div className={`flex-1 flex flex-col ${isDarkMode ? 'bg-gray-900' : 'bg-white'} transition-all duration-300 relative`}>
        {/* Settings Header */}
        <div className={`border-b ${isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'} py-4 px-6 flex items-center justify-between ${isDarkMode ? 'text-white' : 'text-gray-800'} shadow-sm sticky top-0 z-10`}>
          <div className="flex items-center">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-medium mr-3">
              ⚙️
            </div>
            <div>
              <h2 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>Settings</h2>
              <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>Manage your chatbot preferences</p>
            </div>
          </div>
        </div>

        {/* Settings Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto">
            <div className="space-y-8">
              {/* Global Settings Toggle */}
              <div className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-xl p-6 shadow-sm border`}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className={`text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>Global Settings</h3>
          <button 
                    onClick={() => setGlobalSettingsEnabled(!globalSettingsEnabled)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      globalSettingsEnabled ? 'bg-purple-600' : isDarkMode ? 'bg-gray-600' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        globalSettingsEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
          </button>
                </div>
                <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'} text-sm`}>
                  Enable or disable global settings for the chatbot
                </p>
              </div>

              {/* Form - Only show when global settings is OFF */}
              {!globalSettingsEnabled && (
                <div className="space-y-6">
                  {/* Tone Selection */}
                  <div className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-xl p-6 shadow-sm border`}>
                    <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-800'} mb-4`}>Tone</h3>
                    <select
                      value={tone}
                      onChange={(e) => setTone(e.target.value)}
                      className={`w-full p-3 border ${isDarkMode ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-white text-gray-800'} rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent`}
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
                  <div className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-xl p-6 shadow-sm border`}>
                    <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-800'} mb-4`}>User Information</h3>
                    <textarea
                      value={userInfo}
                      onChange={(e) => setUserInfo(e.target.value)}
                      placeholder="Enter user information here..."
                      className={`w-full p-3 border ${isDarkMode ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-white text-gray-800'} rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent h-32 resize-none`}
                      style={{ color: isDarkMode ? '#ffffff' : '#1f2937' }}
                    />
        </div>
        
                  {/* Chat Rules */}
                  <div className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-xl p-6 shadow-sm border`}>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>Chat Rules</h3>
          <button 
                        onClick={addChatRule}
                        className="p-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
          >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
                        Add Rule
          </button>
                    </div>
                    <div className="space-y-3">
                      {chatRules.map((rule, index) => (
                        <div key={index} className="flex items-center gap-3">
                          <input
                            type="text"
                            value={rule}
                            onChange={(e) => updateChatRule(index, e.target.value)}
                            placeholder={`Chat rule ${index + 1}...`}
                            className={`flex-1 p-3 border ${isDarkMode ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-white text-gray-800'} rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent`}
                            style={{ color: isDarkMode ? '#ffffff' : '#1f2937' }}
                          />
                          {chatRules.length > 1 && (
          <button 
                              onClick={() => removeChatRule(index)}
                              className={`p-2 ${isDarkMode ? 'text-red-400 hover:bg-red-900' : 'text-red-600 hover:bg-red-50'} rounded-lg transition-colors`}
          >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                      className="px-8 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
                    >
                      Save Settings
                    </button>
                  </div>
                </div>
              )}

              {/* Message when global settings is ON */}
              {globalSettingsEnabled && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
                  <div className="flex items-center">
                    <svg className="w-6 h-6 text-blue-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <h3 className="text-lg font-semibold text-blue-800">Global Settings Enabled</h3>
                      <p className="text-blue-600">Global settings are currently enabled. Turn off the toggle above to access individual settings.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Default chat interface
  return (
    <div 
      ref={chatContainerRef}
      className={`flex-1 flex flex-col ${isDarkMode ? 'bg-gray-900' : 'bg-white'} transition-all duration-300 relative`}
    >
      {/* Chat header */}
      <div className={`border-b ${isDarkMode ? 'border-gray-700 bg-gray-800 text-white' : 'border-gray-200 bg-white text-gray-800'} py-4 px-6 flex items-center justify-between shadow-sm sticky top-0 z-10`}>
        <div className="flex items-center">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-medium mr-3">
            {conversation.name ? conversation.name.charAt(0) : 'C'}
          </div>
          <div>
            <h2 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
              {conversation.name || "Contact"}
            </h2>
            <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>12:38</p>
          </div>
        </div>
        
        
        {isOfflineMode && (
          <div className="absolute top-full left-0 right-0 bg-yellow-100 text-yellow-800 text-xs text-center py-1.5 px-2 flex items-center justify-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>Offline Mode: Backend server not connected</span>
          </div>
        )}
      </div>

      {/* Search bar - add this right after the header */}
      <AnimatePresence>
        {isSearchOpen && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className={`border-b ${isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'} overflow-hidden`}
          >
            <div className="p-2 flex items-center">
              <div className="flex-1 flex items-center bg-gray-100 rounded-lg px-3 py-2">
                <svg className="w-5 h-5 text-gray-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search in conversation..."
                  className="flex-1 bg-transparent border-none focus:outline-none text-gray-800"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="text-gray-500 hover:text-gray-700"
                    aria-label="Clear search"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              
              <div className="flex items-center ml-2">
                {searchResults.length > 0 && (
                  <>
                    <span className="text-sm text-gray-600 mr-2">
                      {currentResultIndex + 1} of {searchResults.length}
                    </span>
                    <button
                      onClick={() => navigateSearchResults('prev')}
                      className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-200 transition-colors"
                      aria-label="Previous result"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => navigateSearchResults('next')}
                      className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-200 transition-colors"
                      aria-label="Next result"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat messages */}
      <div 
        ref={messagesContainerRef}
              className={`flex-1 overflow-y-auto p-4 md:p-6 space-y-6 ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'} relative transition-colors duration-300`}
            >
              {/* File Analysis Display */}
              {uploadedFiles.length > 0 && fileAnalysis && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-blue-50 border-blue-200'} border`}
                >
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h4 className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-800'} mb-2`}>
                        📄 Files Analyzed ({uploadedFiles.length})
                      </h4>
                      <div className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'} space-y-2`}>
                        {uploadedFiles.map((file, index) => (
                          <div key={index} className="flex items-center space-x-2">
                            <span className="font-medium">{file.name}</span>
                            <span className="text-xs opacity-75">({(file.size / 1024).toFixed(1)} KB)</span>
                          </div>
                        ))}
                      </div>
                      <div className={`mt-3 p-3 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-white'} text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                        <strong>Analysis:</strong> {fileAnalysis.substring(0, 200)}{fileAnalysis.length > 200 ? '...' : ''}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
        {conversation.messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8">
            <div className="w-24 h-24 bg-gradient-to-br from-purple-600 to-purple-800 rounded-full flex items-center justify-center text-white text-4xl mb-6 shadow-lg">
              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h2 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-800'} mb-3 bg-gradient-to-r from-purple-600 to-purple-800 bg-clip-text text-transparent`}>
              Start a Conversation
            </h2>
            <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'} max-w-md mb-8`}>
              Begin chatting with your contact. Send a message to start the conversation.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl w-full">
              {[
                { title: "Course Information", desc: "Ask about specific courses, prerequisites, or requirements", icon: "📚" },
                { title: "Campus Facilities", desc: "Learn about libraries, labs, dining options, and more.", icon: "🏫" },
                { title: "Academic Calendar", desc:"Get info on registration dates, exams, and holidays.", icon: "📅" },
                { title: "Faculty Directory", desc: "Find contact information for professors and staff.", icon: "👩‍🏫" }
              ].map((suggestion, i) => (
                <motion.button
                  key={i}
                  className={`text-left p-4 ${isDarkMode ? 'bg-gray-700 border-gray-600 hover:border-purple-500' : 'bg-white border-gray-200 hover:border-purple-500'} rounded-xl border transition-all duration-200 shadow-sm hover:shadow group`}
                  whileHover={{ scale: 1.03, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setMessage(suggestion.title + ": " + suggestion.desc);
                    if (textareaRef.current) {
                      textareaRef.current.focus();
                    }
                  }}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-xl">{suggestion.icon}</span>
                    <div>
                      <h3 className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-800'} mb-1 group-hover:text-purple-700 transition-colors`}>{suggestion.title}</h3>
                      <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>{suggestion.desc}</p>
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>
          </div>
        ) : (
          <AnimatePresence>
            {conversation.messages.map((msg, index) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className={searchResults.includes(index) && currentResultIndex === searchResults.indexOf(index) 
                  ? 'ring-2 ring-yellow-400 ring-offset-2 rounded-2xl' 
                  : ''}
              >
                <Message 
                  message={msg} 
                  onRegenerate={msg.role === 'assistant' ? () => handleRegenerateResponse(index) : undefined} 
                  highlightText={highlightSearchMatches}
                  index={index}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        )}
        {isLoading && !streamedResponse && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center"
          >
            <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-purple-800 rounded-full flex items-center justify-center text-white shadow-md mr-3">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <div className="typing-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} className="h-4" />
        
        {/* Scroll to bottom button */}
        {showScrollButton && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className={`absolute bottom-6 right-6 p-3 rounded-full ${isDarkMode ? 'bg-gray-700 border-gray-600 text-gray-300 hover:text-purple-400 hover:border-purple-500' : 'bg-white border-gray-200 text-gray-600 hover:text-purple-700 hover:border-purple-500'} shadow-lg transition-all duration-200`}
            onClick={scrollToBottom}
            aria-label="Scroll to bottom"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </motion.button>
        )}
      </div>

      {/* File Error Display */}
      {fileError && (
        <div className={`border-t ${isDarkMode ? 'border-red-700 bg-red-900' : 'border-red-200 bg-red-50'} p-4 transition-colors duration-300`}>
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className={`text-sm font-medium ${isDarkMode ? 'text-red-300' : 'text-red-800'}`}>
                {fileError}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Uploaded Files Display */}
      {uploadedFiles.length > 0 && (
        <div className={`border-t ${isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'} p-4 transition-colors duration-300`}>
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                Uploaded Files ({uploadedFiles.length}) - PDF & TXT only
              </h3>
              {isUploading && (
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                  <span className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Analyzing...</span>
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {uploadedFiles.map((file, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg ${isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-100 border-gray-200'} border`}
                >
                  <div className="flex items-center space-x-2">
                    {file.name.endsWith('.pdf') ? (
                      <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    )}
                    <span className={`text-sm ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                      {file.name}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded ${file.name.endsWith('.pdf') ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>
                      {file.name.endsWith('.pdf') ? 'PDF' : 'TXT'}
                    </span>
                    <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      ({(file.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                  <button
                    onClick={() => removeFile(index)}
                    className={`p-1 rounded-full ${isDarkMode ? 'hover:bg-gray-600' : 'hover:bg-gray-200'} transition-colors`}
                  >
                    <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Message input */}
      <div className={`border-t ${isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'} p-4 md:p-6 sticky bottom-0 z-10 transition-colors duration-300`}>
        <form onSubmit={handleSubmit} className="relative max-w-4xl mx-auto">
          <div className={`flex items-center ${isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-200'} rounded-2xl border-2 focus-within:border-purple-500 transition-colors duration-200 shadow-sm overflow-hidden`}>
            {/* Attachment button */}
            <motion.button
              type="button"
              onClick={triggerFileUpload}
              className={`p-3 ${isDarkMode ? 'text-gray-400 hover:text-white hover:bg-gray-600' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'} transition-colors`}
              aria-label="Attach file"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            </motion.button>
            
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.txt"
              onChange={handleFileUpload}
              className="hidden"
            />

            {/* Voice message button */}
            <motion.button
              type="button"
              onClick={isListening ? stopListening : startListening}
              className={`p-3 rounded-full transition-all duration-200 ${
                isListening 
                  ? 'text-white bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/30' 
                  : isDarkMode 
                    ? 'text-gray-400 hover:text-white hover:bg-gray-600 hover:shadow-lg' 
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100 hover:shadow-lg'
              }`}
              aria-label={isListening ? "Stop recording" : "Start voice message"}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              animate={isListening ? { scale: [1, 1.1, 1] } : {}}
              transition={isListening ? { repeat: Infinity, duration: 1.5 } : {}}
            >
              {isListening ? (
                <motion.div
                  animate={{ rotate: [0, 360] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <rect x="6" y="6" width="12" height="12" rx="2"/>
                  </svg>
                </motion.div>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              )}
            </motion.button>

            {/* Input field */}
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="You are welcome!"
              className={`flex-1 p-4 focus:outline-none resize-none ${isDarkMode ? 'text-white bg-transparent' : 'text-gray-800 bg-white'} min-h-[44px]`}
              rows={1}
              disabled={isLoading}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
            />
            
            {/* Send button */}
            <div className="flex-shrink-0 p-2">
              <motion.button
                type="submit"
                disabled={isLoading || !message.trim()}
                className={`p-3 rounded-full ${
                  isLoading || !message.trim()
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-purple-600 text-white shadow-md hover:shadow-lg'
                } transition-all duration-200 flex items-center justify-center`}
                whileHover={isLoading || !message.trim() ? {} : { scale: 1.05 }}
                whileTap={isLoading || !message.trim() ? {} : { scale: 0.95 }}
                aria-label="Send message"
              >
                {isLoading ? (
                  <svg className="w-5 h-5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                )}
              </motion.button>
            </div>
          </div>
          
          {/* Action buttons below the input */}
          <div className="flex justify-between items-center mt-2 px-2 text-xs text-gray-500">
            <div className="flex items-center">
              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Press Enter to send, Shift+Enter for new line</span>
            </div>
            <div className="flex gap-2">
              <button 
                type="button" 
                onClick={toggleSearch}
                className="p-1.5 rounded-full hover:bg-gray-100 hover:text-purple-700 transition-colors"
                aria-label="Search messages"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
              {/* <button 
                type="button" 
                className="p-1.5 rounded-full hover:bg-gray-100 hover:text-purple-700 transition-colors"
                aria-label="Upload file"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              </button> */}
              {/* <button 
                type="button" 
                className="p-1.5 rounded-full hover:bg-gray-100 hover:text-purple-700 transition-colors"
                aria-label="More options"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              </button> */}
            </div>
          </div>
        </form>
      </div>

      {/* Voice Edit Modal */}
      {showVoiceEdit && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[85vh] overflow-hidden border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}
          >
            {/* Modal Header */}
            <div className={`${isDarkMode ? 'bg-gray-700' : 'bg-gradient-to-r from-purple-600 to-purple-700'} text-white px-6 py-5 flex items-center justify-between`}>
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Voice Message Review</h2>
                  <p className="text-sm opacity-90">Edit your transcribed message before sending</p>
                </div>
              </div>
              <motion.button
                onClick={cancelVoiceEdit}
                className="p-2 rounded-full hover:bg-white hover:bg-opacity-20 transition-colors"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </motion.button>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <label className={`block text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-800'} mb-3`}>
                    <div className="flex items-center space-x-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      <span>Review and edit your message:</span>
                    </div>
                  </label>
                  <div className="relative">
                    <textarea
                      value={voiceMessage}
                      onChange={(e) => setVoiceMessage(e.target.value)}
                      className={`w-full p-4 border-2 ${isDarkMode ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-white text-gray-800'} rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent h-32 resize-none transition-all duration-200`}
                      placeholder="Your voice message will appear here..."
                      style={{ color: isDarkMode ? '#ffffff' : '#1f2937' }}
                    />
                    <div className="absolute bottom-3 right-3 text-xs text-gray-400">
                      {voiceMessage.length} characters
                    </div>
                  </div>
                </div>
                
                <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-blue-50'} border ${isDarkMode ? 'border-gray-600' : 'border-blue-200'}`}>
                  <div className="flex items-start space-x-2">
                    <svg className={`w-5 h-5 mt-0.5 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p className={`text-sm font-medium ${isDarkMode ? 'text-blue-300' : 'text-blue-800'}`}>
                        Pro Tip
                      </p>
                      <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                        You can edit the text before sending. Make sure everything looks correct!
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className={`${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'} px-6 py-4 flex justify-end space-x-3 border-t ${isDarkMode ? 'border-gray-600' : 'border-gray-200'}`}>
              <motion.button
                onClick={cancelVoiceEdit}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${isDarkMode ? 'text-gray-300 hover:text-white hover:bg-gray-600' : 'text-gray-600 hover:text-gray-800 hover:bg-gray-200'}`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Cancel
              </motion.button>
              <motion.button
                onClick={handleVoiceEdit}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium flex items-center space-x-2"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <span>Edit in Chat</span>
              </motion.button>
              <motion.button
                onClick={handleVoiceSend}
                disabled={!voiceMessage.trim()}
                className={`px-4 py-2 rounded-lg transition-colors font-medium flex items-center space-x-2 ${
                  voiceMessage.trim() 
                    ? 'bg-purple-600 text-white hover:bg-purple-700' 
                    : isDarkMode 
                      ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
                whileHover={voiceMessage.trim() ? { scale: 1.02 } : {}}
                whileTap={voiceMessage.trim() ? { scale: 0.98 } : {}}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                <span>Send Message</span>
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Live Transcript Display */}
      {isListening && transcript && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.9 }}
          className={`fixed bottom-20 left-1/2 transform -translate-x-1/2 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border rounded-xl shadow-2xl p-6 max-w-lg z-40 backdrop-blur-sm`}
        >
          {/* Header with animated listening indicator */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <motion.div
                className="relative"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
              >
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <motion.div
                  className="absolute inset-0 w-3 h-3 bg-red-500 rounded-full"
                  animate={{ scale: [1, 2], opacity: [0.7, 0] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                />
              </motion.div>
              <span className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                Listening...
              </span>
            </div>
            <motion.button
              onClick={stopListening}
              className={`px-3 py-1.5 text-xs font-medium rounded-full ${isDarkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'} transition-colors`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Stop
            </motion.button>
          </div>

          {/* Transcript with better styling */}
          <div className={`p-4 rounded-lg mb-4 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
            <p className={`text-sm leading-relaxed ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
              {transcript}
            </p>
          </div>

          {/* Action buttons with improved styling */}
          <div className="flex space-x-3">
            <motion.button
              onClick={() => {
                setVoiceMessage(transcript);
                setShowVoiceEdit(true);
                stopListening();
              }}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg ${isDarkMode ? 'bg-purple-600 text-white hover:bg-purple-700' : 'bg-purple-600 text-white hover:bg-purple-700'} transition-colors flex items-center justify-center space-x-2`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <span>Edit & Send</span>
            </motion.button>
            <motion.button
              onClick={() => {
                setMessage(transcript);
                stopListening();
                // Focus the textarea after setting the message
                setTimeout(() => {
                  if (textareaRef.current) {
                    textareaRef.current.focus();
                  }
                }, 100);
              }}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg ${isDarkMode ? 'bg-gray-600 text-white hover:bg-gray-500' : 'bg-gray-600 text-white hover:bg-gray-500'} transition-colors flex items-center justify-center space-x-2`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span>Use in Chat</span>
            </motion.button>
          </div>
        </motion.div>
      )}
    </div>
  );
} 