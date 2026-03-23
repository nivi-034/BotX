from django.shortcuts import render
from django.http import JsonResponse, StreamingHttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
import json
import uuid
import os
import time
from .agents.langchain_bot_pinecone import ask_question
from echoBot.settings import BASE_DIR
# Create your views here.

@csrf_exempt
@require_http_methods(["POST", "OPTIONS"])
def chat_api(request):
    """
    Chat API endpoint that handles questions and returns answers using RAG system.
    
    Expected input:
    {
        "message": "user question",
        "session_id": "optional session id",
        "stream": false,
        "messages": [{"role": "user", "content": "..."}, ...]
    }
    
    Returns:
    {
        "response": "answer from RAG system",
        "session_id": "session id"
    }
    """
    # Handle OPTIONS request for CORS preflight
    if request.method == "OPTIONS":
        response = JsonResponse({})
        response["Access-Control-Allow-Origin"] = "*"
        response["Access-Control-Allow-Methods"] = "POST, OPTIONS"
        response["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Requested-With"
        response["Access-Control-Max-Age"] = "86400"
        return response
    
    try:
        # Parse JSON data
        data = json.loads(request.body)
        
        # Extract parameters
        user_input = data.get('message')
        session_id = data.get('session_id', str(uuid.uuid4()))
        stream = data.get('stream', False)
        messages = data.get('messages', [])
        
        # Validate required fields
        if not user_input:
            response = JsonResponse({
                'error': 'message field is required'
            }, status=400)
            response["Access-Control-Allow-Origin"] = "*"
            return response
        
        # Get data path from environment or use default
        data_path = os.getenv("TXT_PATH", f"{BASE_DIR}/base/agents/remo.txt")
        
        # Use the ask_question function to get the answer
        try:
            if stream:
                # Stream the response directly from the LLM
                def generate_stream():
                    accumulated_text = ""
                    try:
                        for chunk in ask_question(
                            question=user_input,
                            data_path=data_path,
                            top_k=8,
                            print_context=False,
                            stream=True
                        ):
                            accumulated_text += chunk
                            yield f"data: {json.dumps({'response': accumulated_text, 'session_id': session_id, 'done': False})}\n\n"
                        
                        # Send final message with done flag
                        yield f"data: {json.dumps({'response': accumulated_text, 'session_id': session_id, 'done': True})}\n\n"
                    except Exception as e:
                        error_msg = f"Error processing your question: {str(e)}"
                        yield f"data: {json.dumps({'response': error_msg, 'session_id': session_id, 'done': True})}\n\n"
                
                response = StreamingHttpResponse(
                    generate_stream(),
                    content_type='text/event-stream'
                )
                response["Access-Control-Allow-Origin"] = "*"
                response["Access-Control-Allow-Methods"] = "POST, OPTIONS"
                response["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Requested-With"
                response["Cache-Control"] = "no-cache"
                return response
            else:
                # Get complete response
                response_text = ask_question(
                    question=user_input,
                    data_path=data_path,
                    top_k=8,
                    print_context=False,
                    stream=False
                )
                
                # Ensure response_text is a string, not a generator
                if hasattr(response_text, '__iter__') and not isinstance(response_text, str):
                    # If it's a generator, convert it to string
                    response_text = ''.join(response_text)
                
                # Return JSON response
                response = JsonResponse({
                    'response': response_text,
                    'session_id': session_id
                })
                response["Access-Control-Allow-Origin"] = "*"
                return response
                
        except Exception as e:
            # Handle errors from the RAG system
            response_text = f"Error processing your question: {str(e)}"
            
            if stream:
                def generate_error_stream():
                    yield f"data: {json.dumps({'response': response_text, 'session_id': session_id, 'done': True})}\n\n"
                
                response = StreamingHttpResponse(
                    generate_error_stream(),
                    content_type='text/event-stream'
                )
                response["Access-Control-Allow-Origin"] = "*"
                response["Access-Control-Allow-Methods"] = "POST, OPTIONS"
                response["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Requested-With"
                response["Cache-Control"] = "no-cache"
                return response
            else:
                response = JsonResponse({
                    'response': response_text,
                    'session_id': session_id
                })
                response["Access-Control-Allow-Origin"] = "*"
                return response
        
    except json.JSONDecodeError:
        response = JsonResponse({
            'error': 'Invalid JSON data'
        }, status=400)
        response["Access-Control-Allow-Origin"] = "*"
        return response
    except Exception as e:
        response = JsonResponse({
            'error': f'Internal server error: {str(e)}'
        }, status=500)
        response["Access-Control-Allow-Origin"] = "*"
        return response

@require_http_methods(["GET", "OPTIONS"])
def health_check(request):
    """
    Health check endpoint for the API.
    """
    # Handle OPTIONS request for CORS preflight
    if request.method == "OPTIONS":
        response = JsonResponse({})
        response["Access-Control-Allow-Origin"] = "*"
        response["Access-Control-Allow-Methods"] = "GET, OPTIONS"
        response["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Requested-With"
        response["Access-Control-Max-Age"] = "86400"
        return response
    
    response = JsonResponse({
        'status': 'healthy',
        'message': 'API is running'
    })
    response["Access-Control-Allow-Origin"] = "*"
    return response
