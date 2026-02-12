#!/bin/bash

# Function to kill background processes on exit
cleanup() {
    echo "Stopping services..."
    kill $(jobs -p)
    exit
}

trap cleanup SIGINT SIGTERM

echo "Starting MongoDB..."
brew services start mongodb-community || echo "MongoDB start failed or already running"

echo "Starting Backend..."
cd backend
source venv/bin/activate
uvicorn server:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
cd ..

echo "Starting Frontend..."
cd frontend
npm start &
FRONTEND_PID=$!
cd ..

echo "Services started. Press Ctrl+C to stop."
wait $BACKEND_PID $FRONTEND_PID
