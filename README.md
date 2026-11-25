# Chatbot Project

A full-stack AI Chatbot application with an embeddable website widget, interactive guided categories, callback requests, and chat desk management.

## Project Structure

```
chatbot/
├── backend/       # Node.js / Express API & WebSocket backend
└── frontend/      # Next.js React frontend & widget interface
```

## Getting Started

### 1. Backend Setup

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your MySQL and API key credentials
npm start
```

Default backend server runs on `http://localhost:10000`.

### 2. Frontend Setup

```bash
cd frontend
npm install
cp .env.example .env.local
# Set NEXT_PUBLIC_API_URL in .env.local to your backend URL
npm run dev
```

Default frontend server runs on `http://localhost:3000`.

## Features
- Embeddable JavaScript widget (`widget.js`) for third-party websites
- Multi-category interactive knowledge exploration
- Live callback request management
- Chat history, markdown rendering, and audio transcription
- Real-time communication via Socket.io
