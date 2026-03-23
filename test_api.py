#!/usr/bin/env python3
"""
Test script for the chat API endpoint
"""

import requests
import json

def test_chat_api_streaming():
    """Test the chat API endpoint with streaming"""
    
    # API endpoint URL
    url = "http://localhost:8000/api/chat"
    
    # Test data with streaming enabled
    test_data = {
        "message": "What is the warranty period?",
        "session_id": "test-session-123",
        "stream": True,
        "messages": [
            {"role": "user", "content": "Hello"},
            {"role": "assistant", "content": "Hi there!"}
        ]
    }
    
    try:
        # Make POST request
        response = requests.post(
            url,
            json=test_data,
            headers={'Content-Type': 'application/json'},
            stream=True
        )
        
        print(f"Streaming Test - Status Code: {response.status_code}")
        
        if response.status_code == 200:
            print("Streaming Response:")
            for line in response.iter_lines():
                if line:
                    line_str = line.decode('utf-8')
                    if line_str.startswith('data: '):
                        data_str = line_str[6:]  # Remove 'data: ' prefix
                        try:
                            data = json.loads(data_str)
                            print(f"  Response: {data.get('response', 'No response')}")
                            print(f"  Session ID: {data.get('session_id', 'No session ID')}")
                        except json.JSONDecodeError:
                            print(f"  Raw data: {data_str}")
        else:
            print(f"Error Response: {response.text}")
            
    except requests.exceptions.ConnectionError:
        print("Connection Error: Make sure Django server is running on localhost:8080")
    except Exception as e:
        print(f"Error: {e}")

def test_chat_api_json():
    """Test the chat API endpoint with JSON response"""
    
    # API endpoint URL
    url = "http://localhost:8000/api/chat"
    
    # Test data with streaming disabled
    test_data = {
        "message": "What is the warranty period?",
        "session_id": "test-session-456",
        "stream": False,
        "messages": [
            {"role": "user", "content": "Hello"},
            {"role": "assistant", "content": "Hi there!"}
        ]
    }
    
    try:
        # Make POST request
        response = requests.post(
            url,
            json=test_data,
            headers={'Content-Type': 'application/json'}
        )
        
        print(f"JSON Test - Status Code: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"Response: {result.get('response', 'No response')}")
            print(f"Session ID: {result.get('session_id', 'No session ID')}")
        else:
            print(f"Error Response: {response.text}")
            
    except requests.exceptions.ConnectionError:
        print("Connection Error: Make sure Django server is running on localhost:8080")
    except Exception as e:
        print(f"Error: {e}")

def test_health_check():
    """Test the health check endpoint"""
    
    url = "http://localhost:8000/api/health"
    
    try:
        response = requests.get(url)
        print(f"Health Check Status: {response.status_code}")
        if response.status_code == 200:
            print(f"Health Response: {response.json()}")
    except Exception as e:
        print(f"Health Check Error: {e}")

if __name__ == "__main__":
    print("Testing Health Check...")
    test_health_check()
    print("\nTesting Chat API (JSON Response)...")
    test_chat_api_json()
    print("\nTesting Chat API (Streaming Response)...")
    test_chat_api_streaming()
