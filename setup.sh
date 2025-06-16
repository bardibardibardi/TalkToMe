#!/bin/bash

echo "Setting up Video Feedback Recorder..."

# Install backend dependencies
echo "Installing backend dependencies..."
cd backend
npm install

# Check if .env file exists, if not create it
if [ ! -f .env ]; then
    echo "Creating .env file. Please update it with your OpenAI API key."
    echo "OPENAI_API_KEY=your_openai_api_key" > .env
    echo "PORT=3001" >> .env
fi

# Install frontend dependencies
echo "Installing frontend dependencies..."
cd ../frontend
npm install

echo "Setup complete!"
echo ""
echo "To start the application:"
echo "1. In one terminal window, run: cd backend && npm run dev"
echo "2. In another terminal window, run: cd frontend && npm run dev"
echo ""
echo "Then open your browser to: http://localhost:5173"