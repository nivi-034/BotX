import '@/utils/polyfills';

interface Message {
  id: number;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
}

interface ChatRequest {
  message: string;
  session_id?: string;
  stream: boolean;
  messages: { role: string; content: string }[];
}

interface ChatResponse {
  response: string;
  session_id: string;
}

const API_URL = 'http://localhost:8000';

// Mock responses for when the backend is unavailable
const mockResponses = [
  "I'm sorry, but I'm currently running in offline mode. The backend server is not available.",
  "It seems the backend server is not running. I'm operating in fallback mode with limited capabilities.",
  "I can't connect to the backend server right now. Please check if it's running at http://localhost:8000.",
  "I'm in offline mode. To get full functionality, please make sure the backend server is running.",
  "Backend connection failed. I'm providing a simulated response since I can't reach the server."
];

export const sendMessage = async (
  message: string, 
  sessionId: string | null = null,
  messages: Message[] = []
): Promise<Response> => {
  // Convert our frontend message format to the backend format
  const messageHistory = messages.map(msg => ({
    role: msg.role,
    content: msg.content
  }));

  const payload: ChatRequest = {
    message,
    session_id: sessionId || undefined,
    stream: true,
    messages: messageHistory
  };

  try {
    console.log('Sending request to:', `${API_URL}/api/chat`);
    console.log('Payload:', payload);
    
    const response = await fetch(`${API_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    return response;
  } catch (error) {
    console.error('Failed to connect to backend:', error);
    
    // Create a mock response with a random message from our fallback responses
    const mockResponse = mockResponses[Math.floor(Math.random() * mockResponses.length)];
    
    // Create a ReadableStream to simulate the streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        // Split the mock response into words for streaming effect
        const words = mockResponse.split(' ');
        let accumulatedText = '';
        
        const streamWords = () => {
          if (words.length === 0) {
            // Send final message with done flag
            const finalData = {
              response: mockResponse,
              session_id: sessionId || 'mock-session',
              done: true
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(finalData)}\n\n`));
            controller.close();
            return;
          }
          
          const word = words.shift();
          accumulatedText += word + ' ';
          
          const data = {
            response: accumulatedText.trim(),
            session_id: sessionId || 'mock-session',
            done: false
          };
          
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          
          // Continue streaming with a delay
          setTimeout(streamWords, 100); // 100ms delay between words
        };
        
        // Start streaming after a small delay
        setTimeout(streamWords, 500);
      }
    });
    
    // Return a mock Response object
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      },
      status: 200
    });
  }
};

export const checkHealth = async (): Promise<boolean> => {
  try {
    console.log('Checking health at:', `${API_URL}/api/health`);
    
    const response = await fetch(`${API_URL}/api/health`, {
      // Add a timeout to prevent long waiting times
      signal: AbortSignal.timeout(5000)
    });
    
    console.log('Health check status:', response.status);
    console.log('Health check headers:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      console.error('Health check failed with status:', response.status);
      return false;
    }
    
    const data = await response.json();
    console.log('Health check response:', data);
    
    return data.status === 'healthy';
  } catch (error) {
    console.error('Health check failed:', error);
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      console.error('Network error - make sure Django server is running on localhost:8080');
    }
    return false;
  }
}; 