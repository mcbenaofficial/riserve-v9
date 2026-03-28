#!/bin/bash

# Function to kill background processes on exit
cleanup() {
    echo "Stopping services..."
    kill $(jobs -p)
    exit
}

trap cleanup SIGINT SIGTERM

echo "Starting Backend..."
cd backend
source venv/bin/activate
uvicorn server:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
cd ..

echo "Starting Frontend on port 3001..."
cd frontend
PORT=3001 npm start &
FRONTEND_PID=$!
cd ..

echo "Starting Customer Portal on port 3002..."
cd customer-portal
PORT=3002 npm run dev &
PORTAL_PID=$!
cd ..

echo "Services started. Press Ctrl+C to stop."
wait $BACKEND_PID $FRONTEND_PID $PORTAL_PID
