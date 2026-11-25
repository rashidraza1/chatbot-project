'use client';
import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useParams } from 'next/navigation';
import { io } from 'socket.io-client';
import { Bot, User, Send, X, AlertCircle, Smile, Mic, MicOff, Maximize2, Minimize2, Minus, History, MessageSquare, Plus, Menu, Search, Trash2, Phone, Download, ArrowLeft, FileText, ChevronRight, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

const API_BASE = typeof window !== 'undefined' ? '' : (process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL.trim().replace(/\/$/, '') : '');

export default function WidgetPage() {
  const params = useParams();
  const bot_id = params?.bot_id;
  const searchParams = useSearchParams();
  const currentUrl = searchParams.get('url') || '';

  const [botConfig, setBotConfig] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [socket, setSocket] = useState(null);
  const [conversation, setConversation] = useState(null);
  const [history, setHistory] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [guestId, setGuestId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Lead capture state
  const [visitorInfo, setVisitorInfo] = useState({ name: '', email: '' });
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [pendingMessage, setPendingMessage] = useState('');
  const [pendingCategory, setPendingCategory] = useState(null);
  const [leadName, setLeadName] = useState('');
  const [leadEmail, setLeadEmail] = useState('');
  const [leadErrors, setLeadErrors] = useState({});
  const [isSubmittingLead, setIsSubmittingLead] = useState(false);

  // Guided Menu State
  const [categories, setCategories] = useState([]);
  const [guidedStep, setGuidedStep] = useState('CATEGORY'); // 'CATEGORY' | 'ITEM' | 'DETAILS'
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [items, setItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [itemDocument, setItemDocument] = useState(null);
  const [loadingItemDetails, setLoadingItemDetails] = useState(false);

  // Callback Modal State
  const [showCallbackModal, setShowCallbackModal] = useState(false);
  const [callbackMobile, setCallbackMobile] = useState('');
  const [callbackError, setCallbackError] = useState('');
  const [isSubmittingCallback, setIsSubmittingCallback] = useState(false);

  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const nameInputRef = useRef(null);
  const emailInputRef = useRef(null);

  const emojis = ['😊', '😂', '😍', '👍', '🙏', '🔥', '👋', '🤔', '🙌', '🎉', '💡', '✨'];

  // Initialize Guest ID and visitor session from localStorage
  useEffect(() => {
    let gid = localStorage.getItem('chatdesk_guest_id');
    if (!gid) {
      gid = crypto.randomUUID();
      localStorage.setItem('chatdesk_guest_id', gid);
    }
    setGuestId(gid);

    const storedName = localStorage.getItem('chatdesk_visitor_name') || '';
    const storedEmail = localStorage.getItem('chatdesk_visitor_email') || '';
    if (storedName && storedEmail) {
      setVisitorInfo({ name: storedName, email: storedEmail });
      setLeadName(storedName);
      setLeadEmail(storedEmail);
    }
  }, []);

  // Auto-focus input when lead form is shown
  useEffect(() => {
    if (showLeadForm) {
      setTimeout(() => {
        if (!leadName?.trim() && nameInputRef.current) {
          nameInputRef.current.focus();
        } else if (emailInputRef.current) {
          emailInputRef.current.focus();
        }
      }, 100);
    }
  }, [showLeadForm, leadName]);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/bots/${bot_id}/widget`);
        if (res.ok) {
          const data = await res.json();
          setBotConfig(data);
        }
      } catch (err) {
        console.error('Failed to load bot config:', err);
      }
    };
    if (bot_id) fetchConfig();
  }, [bot_id]);

  // Fetch Guided Categories
  useEffect(() => {
    const fetchCategories = async () => {
      if (!bot_id) return;
      try {
        const res = await fetch(`${API_BASE}/api/chatbot/${bot_id}/categories`);
        if (res.ok) {
          const data = await res.json();
          setCategories(data);
        }
      } catch (err) {
        console.error('Failed to load guided categories:', err);
      }
    };
    if (bot_id) fetchCategories();
  }, [bot_id]);

  // Fetch History
  const fetchHistory = async () => {
    if (!bot_id || !guestId) return;
    try {
      const res = await fetch(`${API_BASE}/api/chat/conversations?bot_id=${bot_id}&user_id=${guestId}`);
      if (res.ok) {
        const data = await res.json();
        setHistory(data);

        // If visitorInfo is not yet known, check if any conversation has visitor data
        const currentStoredName = localStorage.getItem('chatdesk_visitor_name');
        const currentStoredEmail = localStorage.getItem('chatdesk_visitor_email');
        if (!currentStoredName || !currentStoredEmail) {
          const convWithVisitor = data.find(c => c.Visitor?.name && c.Visitor.name !== 'Guest' && c.Visitor?.email);
          if (convWithVisitor) {
            localStorage.setItem('chatdesk_visitor_name', convWithVisitor.Visitor.name);
            localStorage.setItem('chatdesk_visitor_email', convWithVisitor.Visitor.email);
            setVisitorInfo({
              name: convWithVisitor.Visitor.name,
              email: convWithVisitor.Visitor.email
            });
            setLeadName(convWithVisitor.Visitor.name);
            setLeadEmail(convWithVisitor.Visitor.email);
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch history:', err);
    }
  };

  useEffect(() => {
    if (isOpen) fetchHistory();
  }, [isOpen, bot_id, guestId]);

  useEffect(() => {
    // Notify parent window to resize iframe
    if (isOpen) {
      window.parent.postMessage(isMaximized ? 'chatdesk-maximize' : 'chatdesk-expand', '*');
    } else {
      window.parent.postMessage('chatdesk-minimize', '*');
    }
  }, [isOpen, isMaximized]);

  // Handle Socket for Real-time
  useEffect(() => {
    if (!isOpen) return;

    const newSocket = io(API_BASE);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Socket connected:', newSocket.id);
    });

    newSocket.on('new_message', (msg) => {
      if (conversation && msg.conversation_id === conversation.id) {
        setMessages(prev => [...prev, msg]);
      }
    });

    newSocket.on('bot_typing', (typing) => {
      setIsTyping(typing);
    });

    return () => {
      newSocket.close();
      setSocket(null);
    };
  }, [isOpen, conversation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping, showLeadForm]);

  const loadConversation = async (convId) => {
    try {
      const res = await fetch(`${API_BASE}/api/chat/conversations/${convId}`);
      if (res.ok) {
        const data = await res.json();
        setConversation(data.conversation);
        setMessages(data.messages);
        setShowLeadForm(false);
        setPendingMessage('');
        setPendingCategory(null);

        if (data.conversation?.Visitor?.name && data.conversation.Visitor.name !== 'Guest' && data.conversation?.Visitor?.email) {
          localStorage.setItem('chatdesk_visitor_name', data.conversation.Visitor.name);
          localStorage.setItem('chatdesk_visitor_email', data.conversation.Visitor.email);
          setVisitorInfo({
            name: data.conversation.Visitor.name,
            email: data.conversation.Visitor.email
          });
          setLeadName(data.conversation.Visitor.name);
          setLeadEmail(data.conversation.Visitor.email);
        }

        if (socket) {
          socket.emit('join_conversation', { conversationId: convId });
        }
      }
    } catch (err) {
      console.error('Failed to load conversation:', err);
    }
  };

  const startNewChat = () => {
    setConversation(null);
    setMessages([]);
    setShowLeadForm(false);
    setPendingMessage('');
    setPendingCategory(null);
    setLeadErrors({});
    setGuidedStep('CATEGORY');
    setSelectedCategory(null);
    setItems([]);
    setSelectedItem(null);
    setItemDocument(null);
    setShowCallbackModal(false);
    setCallbackMobile('');
    setCallbackError('');
  };

  const openCategory = async (category) => {
    setSelectedCategory(category);
    setLoadingItems(true);
    setGuidedStep('ITEM');
    setSelectedItem(null);
    setItemDocument(null);
    try {
      const res = await fetch(`${API_BASE}/api/chatbot/${bot_id}/categories/${category.id}/items`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    } catch (err) {
      console.error('Failed to fetch category items:', err);
    } finally {
      setLoadingItems(false);
    }
  };

  const handleSelectCategory = async (category) => {
    const storedName = (visitorInfo.name || localStorage.getItem('chatdesk_visitor_name') || '').trim();
    const storedEmail = (visitorInfo.email || localStorage.getItem('chatdesk_visitor_email') || '').trim();
    const hasVisitor = Boolean(storedName && storedEmail);

    if (!hasVisitor) {
      setPendingCategory(category);
      setLeadName(storedName);
      setLeadEmail(storedEmail);
      setLeadErrors({});
      setShowLeadForm(true);
      return;
    }

    await openCategory(category);
  };

  const handleSelectItem = async (item) => {
    setSelectedItem(item);
    setLoadingItemDetails(true);
    setGuidedStep('DETAILS');
    try {
      const res = await fetch(`${API_BASE}/api/chatbot/${bot_id}/items/${item.id}`);
      if (res.ok) {
        const data = await res.json();
        setItemDocument(data.document);
      }
    } catch (err) {
      console.error('Failed to fetch item details:', err);
    } finally {
      setLoadingItemDetails(false);
    }
  };

  const handleBackToCategories = () => {
    setGuidedStep('CATEGORY');
    setSelectedCategory(null);
    setPendingCategory(null);
    setItems([]);
    setSelectedItem(null);
    setItemDocument(null);
  };

  const handleBackToItems = () => {
    setGuidedStep('ITEM');
    setSelectedItem(null);
    setItemDocument(null);
  };

  const handleDownloadPdf = () => {
    if (!itemDocument?.id) return;
    const downloadUrl = `${API_BASE}/api/chatbot/documents/${itemDocument.id}/download`;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.setAttribute('download', itemDocument.file_name || 'document.pdf');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCallbackSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (isSubmittingCallback) return;

    const trimmed = (callbackMobile || '').trim();
    const indianMobileRegex = /^(?:\+91|91)?[6-9]\d{9}$/;

    if (!trimmed) {
      setCallbackError('Please enter your 10-digit mobile number.');
      return;
    }

    if (!indianMobileRegex.test(trimmed)) {
      setCallbackError('Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.');
      return;
    }

    const cleaned = trimmed.replace(/\D/g, '').slice(-10);
    setCallbackError('');
    setIsSubmittingCallback(true);

    try {
      const res = await fetch(`${API_BASE}/api/chatbot/callback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bot_id,
          category_id: selectedCategory?.id,
          item_id: selectedItem?.id,
          mobile: cleaned
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setCallbackError(data.error || 'Failed to submit callback request.');
        return;
      }

      setShowCallbackModal(false);
      setCallbackMobile('');

      const itemTypeLabel = selectedItem?.type === 'service' ? 'Service' : 'Brand';
      const thankYouMsg = {
        id: `callback-${Date.now()}`,
        sender_type: 'bot',
        content: `🎉 **Thank you! Our team will contact you shortly.**\n\n- **Selected Category:** ${selectedCategory?.name}\n- **Selected ${itemTypeLabel}:** ${selectedItem?.name}\n- **Mobile Number:** +91 ${cleaned}\n- **Status:** Callback Request Received (Pending)`,
        createdAt: new Date()
      };
      setMessages(prev => [...prev, thankYouMsg]);
    } catch (err) {
      console.error('Error submitting callback request:', err);
      setCallbackError('Network error. Please try again.');
    } finally {
      setIsSubmittingCallback(false);
    }
  };

  const handleDeleteConversation = async (e, convId) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this chat?')) return;
    try {
      const res = await fetch(`${API_BASE}/api/chat/conversations/${convId}`, { method: 'DELETE' });
      if (res.ok) {
        setHistory(prev => prev.filter(c => c.id !== convId));
        if (conversation?.id === convId) startNewChat();
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    }
  };

  const executeSendMessage = async (contentToSend, currentVisitor = null) => {
    if (!contentToSend || !bot_id) return;

    setNewMessage('');
    setShowEmojiPicker(false);

    const tempId = Date.now();
    const tempUserMsg = { id: tempId, content: contentToSend, sender_type: 'visitor', createdAt: new Date() };

    setMessages(prev => {
      const hasPending = prev.some(m => m.id === 'temp-pending');
      if (hasPending) {
        return prev;
      }
      return [...prev, tempUserMsg];
    });
    setIsTyping(true);

    const activeVisitor = currentVisitor || visitorInfo;
    const vName = activeVisitor.name || localStorage.getItem('chatdesk_visitor_name') || '';
    const vEmail = activeVisitor.email || localStorage.getItem('chatdesk_visitor_email') || '';

    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bot_id,
          conversation_id: conversation?.id,
          user_id: guestId,
          content: contentToSend,
          visitor_name: vName,
          visitor_email: vEmail
        })
      });

      if (res.ok) {
        const data = await res.json();
        // Update conversation if it's new
        if (!conversation) {
          setConversation({ id: data.conversation_id, title: data.title });
          fetchHistory(); // Refresh sidebar
        }

        // Replace temp message with real one and add bot response
        setMessages(prev => {
          const filtered = prev.filter(m => m.id !== tempId && m.id !== 'temp-pending');
          return [...filtered, data.userMessage, data.botMessage];
        });
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSendMessage = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!newMessage.trim() || !bot_id) return;

    const content = newMessage.trim();

    // Check if visitor details are already collected
    const storedName = visitorInfo.name || localStorage.getItem('chatdesk_visitor_name') || '';
    const storedEmail = visitorInfo.email || localStorage.getItem('chatdesk_visitor_email') || '';
    const hasVisitor = Boolean(storedName && storedEmail);

    if (!hasVisitor) {
      // Store visitor's original message temporarily - do not call AI/backend yet
      setPendingMessage(content);
      setNewMessage('');
      setShowEmojiPicker(false);
      setLeadErrors({});
      setShowLeadForm(true);

      // Display visitor message bubble in the chatbot
      const pendingMsg = { id: 'temp-pending', content, sender_type: 'visitor', createdAt: new Date() };
      setMessages(prev => [...prev, pendingMsg]);
      return;
    }

    // Already collected - send message normally
    await executeSendMessage(content, { name: storedName, email: storedEmail });
  };

  const handleCancelLead = () => {
    setShowLeadForm(false);
    setPendingCategory(null);
    setPendingMessage('');
    setLeadErrors({});
    setMessages(prev => prev.filter(m => m.id !== 'temp-pending'));
  };

  const handleLeadSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (isSubmittingLead) return; // Prevent double clicks and duplicate AI calls

    const trimmedName = leadName.trim();
    const trimmedEmail = leadEmail.trim();
    const errors = {};

    if (!trimmedName) {
      errors.name = 'Name is required.';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!trimmedEmail) {
      errors.email = 'Email is required.';
    } else if (!emailRegex.test(trimmedEmail)) {
      errors.email = 'Please enter a valid email address.';
    }

    if (Object.keys(errors).length > 0) {
      setLeadErrors(errors);
      return;
    }

    setLeadErrors({});
    setIsSubmittingLead(true);

    try {
      // Persist to existing backend visitor session API
      try {
        const apiRes = await fetch(`${API_BASE}/api/chat/visitor`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversation_id: conversation?.id || null,
            name: trimmedName,
            email: trimmedEmail
          })
        });

        if (!apiRes.ok) {
          const errData = await apiRes.json().catch(() => ({}));
          setLeadErrors({ email: errData.error || 'Failed to save details. Please try again.' });
          setIsSubmittingLead(false);
          return;
        }
      } catch (apiErr) {
        console.error('Failed to sync visitor session with server:', apiErr);
        setLeadErrors({ email: 'Network error saving details. Please try again.' });
        setIsSubmittingLead(false);
        return;
      }

      // Save name and email in chatbot visitor/session state and localStorage
      localStorage.setItem('chatdesk_visitor_name', trimmedName);
      localStorage.setItem('chatdesk_visitor_email', trimmedEmail);
      const updatedVisitor = { name: trimmedName, email: trimmedEmail };
      setVisitorInfo(updatedVisitor);

      // Close the form
      setShowLeadForm(false);

      // If a category was clicked, automatically open that category
      const catToOpen = pendingCategory;
      setPendingCategory(null);

      if (catToOpen) {
        await openCategory(catToOpen);
      }

      // Automatically send the ORIGINAL message that the visitor typed
      const messageToSend = pendingMessage;
      setPendingMessage('');

      if (messageToSend) {
        await executeSendMessage(messageToSend, updatedVisitor);
      }
    } catch (err) {
      console.error('Failed to submit visitor details:', err);
      setLeadErrors({ email: 'An unexpected error occurred. Please try again.' });
    } finally {
      setIsSubmittingLead(false);
    }
  };

  const toggleVoice = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
    };

    recognition.onresult = (event) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }
      setNewMessage(prev => prev + finalTranscript);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  if (!botConfig) return null;

  const filteredHistory = history.filter(h =>
    h.title?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 pointer-events-none flex flex-col justify-end items-end-1 pb-5 pr-5 font-sans">
      {isOpen ? (
        <div className={`pointer-events-auto bg-white dark:bg-gray-900 rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-200 dark:border-gray-800 transition-all duration-500 transform scale-100 origin-bottom-right ${isMaximized ? 'w-[95vw] h-[90vh] max-w-[1200px]' : 'h-[600px] w-[380px]'}`}>

          {/* Main Layout Container */}
          <div className="flex flex-1 overflow-hidden relative">

            {/* Sidebar (History) - Only visible in maximized mode or if explicitly toggled */}
            <div className={`bg-gray-50 dark:bg-gray-950 border-r border-gray-200 dark:border-gray-800 flex flex-col transition-all duration-300 rounded-l-2xl ${isMaximized && isSidebarOpen ? 'w-72' : 'w-0 overflow-hidden'}`}>
              <div className="p-4 flex flex-col h-full uppercase">
                <button
                  onClick={startNewChat}
                  className="flex items-center justify-center space-x-2 w-full py-2.5 px-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-all mb-4"
                >
                  <Plus size={16} />
                  <span>New Chat</span>
                </button>

                <div className="relative mb-4">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search chats..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-white dark:bg-gray-800 border-none rounded-lg py-2 pl-9 pr-3 text-xs focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex-1 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                  {filteredHistory.map((chat) => (
                    <button
                      key={chat.id}
                      onClick={() => loadConversation(chat.id)}
                      className={`group w-full flex items-center space-x-3 px-3 py-3 rounded-xl text-left transition-all ${conversation?.id === chat.id ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400' : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400'}`}
                    >
                      <MessageSquare size={16} className="shrink-0" />
                      <span className="truncate text-sm flex-1">{chat.title || 'Untitled Chat'}</span>
                      <button
                        onClick={(e) => handleDeleteConversation(e, chat.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500 rounded transition-all"
                      >
                        <Trash2 size={14} />
                      </button>
                    </button>
                  ))}
                  {filteredHistory.length === 0 && (
                    <div className="text-center py-10 text-gray-400 text-xs uppercase">No history found</div>
                  )}
                </div>
              </div>
            </div>

            {/* Chat Pane */}
            <div className="flex-1 flex flex-col relative bg-white dark:bg-gray-900 rounded-r-2xl">

              {/* Header */}
              <div
                className="p-4 flex items-center justify-between shadow-sm text-white relative h-16 shrink-0 rounded-t-2xl md:rounded-tl-none"
                style={{ backgroundColor: botConfig.color_theme || '#4f46e5' }}
              >
                <div className="flex items-center space-x-3">
                  {isMaximized && (
                    <button
                      onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                      className="p-1.5 hover:bg-white/20 rounded-lg transition-colors mr-1"
                    >
                      <Menu size={20} />
                    </button>
                  )}
                  <div className="h-10 w-10 bg-white rounded-full flex items-center justify-center shadow-inner overflow-hidden shrink-0">
                    {botConfig.avatar_url ? (
                      <img src={botConfig.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <Bot size={24} style={{ color: botConfig.color_theme || '#4f46e5' }} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-lg leading-tight truncate">{botConfig.name}</h3>
                    <p className="text-xs text-white text-opacity-80 flex items-center">
                      <span className="w-2 h-2 rounded-full bg-green-400 mr-1 animate-pulse"></span> Online
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-1 shrink-0">
                  <button
                    onClick={() => setIsMaximized(!isMaximized)}
                    className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                    title={isMaximized ? "Restore" : "Chat History"}
                  >
                    {isMaximized ? <Minimize2 size={18} /> : <History size={18} />}
                  </button>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                  >
                    <Minus size={18} />
                  </button>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-6 bg-[#f8f9fc] dark:bg-gray-900 space-y-6">
                {/* Guided Navigation Card */}
                {categories.length > 0 && (
                  <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 space-y-3 animate-in fade-in duration-300">
                    {/* STEP 1: CATEGORY SELECTION */}
                    {guidedStep === 'CATEGORY' && (
                      <div>
                        <div className="flex items-center space-x-2.5 mb-3">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                            style={{ backgroundColor: `${botConfig.color_theme || '#4f46e5'}20` }}
                          >
                            <Bot size={18} style={{ color: botConfig.color_theme || '#4f46e5' }} />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-gray-900 dark:text-white leading-tight">
                              Welcome To DCS Techno Services Pvt. Ltd.
                            </h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                              Please select a category:
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-1.5 pt-1">
                          {categories.map((cat) => (
                            <button
                              key={cat.id}
                              type="button"
                              onClick={() => handleSelectCategory(cat)}
                              className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all text-xs font-semibold flex items-center justify-between group active:scale-[0.99] ${pendingCategory?.id === cat.id
                                ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-900/30 ring-2 ring-indigo-500/30 text-indigo-700 dark:text-indigo-300 shadow-sm'
                                : 'border-gray-200 dark:border-gray-700 bg-gray-50 hover:bg-indigo-50 dark:bg-gray-900/60 dark:hover:bg-indigo-900/20 hover:border-indigo-300 dark:hover:border-indigo-600 text-gray-800 dark:text-gray-200'
                                }`}
                            >
                              <span className="truncate pr-1">{cat.name}</span>
                              <ChevronRight size={14} className="text-gray-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 shrink-0 transition-transform group-hover:translate-x-0.5" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* STEP 2: BRAND / SERVICE SELECTION */}
                    {guidedStep === 'ITEM' && selectedCategory && (
                      <div>
                        <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-gray-100 dark:border-gray-700">
                          <button
                            type="button"
                            onClick={handleBackToCategories}
                            className="inline-flex items-center text-xs font-medium text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                          >
                            <ArrowLeft size={14} className="mr-1" /> Back to Categories
                          </button>
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 truncate max-w-[150px]">
                            {selectedCategory.name}
                          </span>
                        </div>

                        <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 mb-2">
                          {items.some(i => i.type === 'service') ? 'Please select Service:' : 'Please select Brand:'}
                        </p>

                        {loadingItems ? (
                          <div className="py-6 flex justify-center items-center">
                            <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                          </div>
                        ) : items.length === 0 ? (
                          <p className="text-xs text-gray-400 py-3 text-center">No brands or services found under this category.</p>
                        ) : (
                          <div className="grid grid-cols-2 gap-1.5 max-h-56 overflow-y-auto pr-1">
                            {items.map((item) => (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => handleSelectItem(item)}
                                className="text-left px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 hover:bg-indigo-50 dark:bg-gray-900/60 dark:hover:bg-indigo-900/20 hover:border-indigo-300 dark:hover:border-indigo-600 transition-all text-xs font-medium text-gray-800 dark:text-gray-200 flex items-center justify-between group active:scale-[0.99]"
                              >
                                <span className="truncate pr-1">{item.name}</span>
                                <ChevronRight size={13} className="text-gray-400 group-hover:text-indigo-600 shrink-0" />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* STEP 3: ITEM DETAILS / PDF / CALLBACK */}
                    {guidedStep === 'DETAILS' && selectedItem && (
                      <div>
                        <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-gray-100 dark:border-gray-700">
                          <button
                            type="button"
                            onClick={handleBackToItems}
                            className="inline-flex items-center text-xs font-medium text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                          >
                            <ArrowLeft size={14} className="mr-1" /> Back to {selectedCategory?.name || 'List'}
                          </button>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                            {selectedItem.type}
                          </span>
                        </div>

                        {loadingItemDetails ? (
                          <div className="py-6 flex justify-center items-center">
                            <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-700">
                              <div className="flex items-center justify-between">
                                <div>
                                  <h5 className="text-sm font-bold text-gray-900 dark:text-white">{selectedItem.name}</h5>
                                  <p className="text-[11px] text-gray-500 dark:text-gray-400">{selectedCategory?.name}</p>
                                </div>
                                <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                                  <FileText size={18} />
                                </div>
                              </div>

                              {itemDocument ? (
                                <div className="mt-2.5 pt-2 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between text-xs">
                                  <span className="truncate text-gray-700 dark:text-gray-300 max-w-[200px]" title={itemDocument.file_name}>
                                    📄 {itemDocument.file_name}
                                  </span>
                                  <span className="text-[10px] text-green-600 dark:text-green-400 font-semibold">Available</span>
                                </div>
                              ) : (
                                <div className="mt-2 text-[11px] text-gray-400 italic">
                                  Brochure / Technical Spec sheet will be available soon.
                                </div>
                              )}
                            </div>

                            <div className="grid grid-cols-2 gap-2 pt-1">
                              <button
                                type="button"
                                onClick={handleDownloadPdf}
                                disabled={!itemDocument}
                                className={`py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all shadow-xs ${itemDocument
                                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white active:scale-98 cursor-pointer'
                                  : 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
                                  }`}
                              >
                                <Download size={14} />
                                <span>Download PDF</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setCallbackError('');
                                  setShowCallbackModal(true);
                                }}
                                className="py-2.5 px-3 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center space-x-1.5 transition-all shadow-xs active:scale-98 cursor-pointer"
                              >
                                <Phone size={14} />
                                <span>Request Call Back</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {messages.length === 0 && !isTyping && !showLeadForm && categories.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-60">
                    <div className="w-16 h-16 bg-white dark:bg-gray-800 rounded-2xl flex items-center justify-center shadow-sm">
                      <Bot size={32} style={{ color: botConfig.color_theme || '#4f46e5' }} />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-800 dark:text-gray-200">How can I help you today?</h4>
                      <p className="text-sm text-gray-500">Ask me anything about our services.</p>
                    </div>
                  </div>
                )}

                {messages.map((msg, idx) => {
                  const isVisitor = msg.sender_type === 'visitor';
                  return (
                    <div key={msg.id || idx} className={`flex ${isVisitor ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300`}>
                      <div className={`max-w-[85%] rounded-[20px] px-5 py-3.5 shadow-sm text-sm ${isVisitor
                        ? 'bg-gradient-to-br from-indigo-600 to-indigo-700 text-white rounded-tr-none shadow-indigo-200 dark:shadow-none'
                        : 'bg-white text-gray-800 dark:bg-gray-800 dark:text-gray-100 rounded-tl-none border border-gray-100 dark:border-gray-700 shadow-sm'
                        }`}>
                        <div className="markdown-content leading-relaxed">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                        <span className={`text-[10px] mt-1 block opacity-50 ${isVisitor ? 'text-right' : 'text-left'}`}>
                          {new Date(msg.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  );
                })}

                {/* Inline Name + Email Lead Capture Form */}
                {showLeadForm && (
                  <div className="flex justify-start animate-in fade-in slide-in-from-bottom-3 duration-300">
                    <div className="w-full max-w-sm bg-white dark:bg-gray-800 rounded-2xl rounded-tl-none p-5 shadow-md border border-gray-100 dark:border-gray-700">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-2.5">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                            style={{ backgroundColor: `${botConfig.color_theme || '#4f46e5'}20` }}
                          >
                            <User size={16} style={{ color: botConfig.color_theme || '#4f46e5' }} />
                          </div>
                          <div>
                            <h4 className="text-sm font-semibold text-gray-900 dark:text-white leading-tight">
                              {pendingCategory ? 'Please provide your details' : 'Before we continue, please share your details.'}
                            </h4>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                              {pendingCategory
                                ? `To view ${pendingCategory.name}, please enter your name & email.`
                                : 'We need your name and email to proceed.'}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleCancelLead}
                          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-lg transition-colors shrink-0"
                          title="Cancel"
                        >
                          <X size={16} />
                        </button>
                      </div>

                      <form onSubmit={handleLeadSubmit} noValidate className="space-y-3 pt-1">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Name
                          </label>
                          <input
                            ref={nameInputRef}
                            type="text"
                            placeholder="Enter your name"
                            value={leadName}
                            disabled={isSubmittingLead}
                            onChange={(e) => {
                              setLeadName(e.target.value);
                              if (leadErrors.name) setLeadErrors(prev => ({ ...prev, name: '' }));
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                emailInputRef.current?.focus();
                              }
                            }}
                            className={`w-full text-sm px-3.5 py-2.5 rounded-xl border bg-gray-50 dark:bg-gray-900/60 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none transition-all ${leadErrors.name
                              ? 'border-red-400 focus:ring-2 focus:ring-red-400/30'
                              : 'border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500'
                              }`}
                          />
                          {leadErrors.name && (
                            <p className="text-[11px] text-red-500 mt-1 flex items-center">
                              <AlertCircle size={12} className="mr-1 shrink-0" /> {leadErrors.name}
                            </p>
                          )}
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Email
                          </label>
                          <input
                            ref={emailInputRef}
                            type="email"
                            placeholder="Enter your email"
                            value={leadEmail}
                            disabled={isSubmittingLead}
                            onChange={(e) => {
                              setLeadEmail(e.target.value);
                              if (leadErrors.email) setLeadErrors(prev => ({ ...prev, email: '' }));
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleLeadSubmit(e);
                              }
                            }}
                            className={`w-full text-sm px-3.5 py-2.5 rounded-xl border bg-gray-50 dark:bg-gray-900/60 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none transition-all ${leadErrors.email
                              ? 'border-red-400 focus:ring-2 focus:ring-red-400/30'
                              : 'border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500'
                              }`}
                          />
                          {leadErrors.email && (
                            <p className="text-[11px] text-red-500 mt-1 flex items-center">
                              <AlertCircle size={12} className="mr-1 shrink-0" /> {leadErrors.email}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center space-x-2 mt-2">
                          <button
                            type="button"
                            onClick={handleCancelLead}
                            disabled={isSubmittingLead}
                            className="w-1/3 py-2.5 px-3 text-gray-600 dark:text-gray-300 font-medium text-xs rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all disabled:opacity-50"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={isSubmittingLead}
                            className="flex-1 py-2.5 px-4 text-white font-medium text-sm rounded-xl transition-all shadow-md active:scale-[0.99] disabled:opacity-60 flex items-center justify-center space-x-2"
                            style={{ backgroundColor: botConfig.color_theme || '#4f46e5' }}
                          >
                            {isSubmittingLead ? (
                              <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                <span>Saving...</span>
                              </>
                            ) : (
                              <span>Continue</span>
                            )}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}

                {isTyping && (
                  <div className="flex justify-start">
                    <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="p-4 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 relative rounded-b-2xl">
                <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto flex items-center space-x-3 w-full">
                  <div className="flex-1 flex items-center bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-2xl px-2 focus-within:ring-2 focus-within:ring-indigo-500/50 transition-all min-w-0">
                    <button
                      type="button"
                      disabled={showLeadForm}
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      className={`p-2 rounded-full transition-colors shrink-0 ${showEmojiPicker ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20' : 'text-gray-400 hover:text-gray-600'} disabled:opacity-40`}
                    >
                      <Smile size={20} />
                    </button>

                    <input
                      type="text"
                      disabled={showLeadForm}
                      placeholder={showLeadForm ? 'Please share your details above to continue...' : isListening ? 'Listening...' : 'Type a message...'}
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      className="flex-1 bg-transparent text-gray-900 dark:text-gray-100 py-3 px-2 focus:outline-none text-sm min-w-0 disabled:opacity-50 disabled:cursor-not-allowed"
                    />

                    <button
                      type="button"
                      disabled={showLeadForm}
                      onClick={toggleVoice}
                      className={`p-2 rounded-full transition-all shrink-0 ${isListening ? 'text-white bg-red-500 shadow-lg animate-pulse' : 'text-gray-400 hover:text-gray-600'} disabled:opacity-40`}
                    >
                      {isListening ? <MicOff size={20} /> : <Mic size={20} />}
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={!newMessage.trim() || isTyping || showLeadForm}
                    className="p-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl transition-all shadow-lg shadow-indigo-500/30 active:scale-95 disabled:opacity-50 disabled:shadow-none flex items-center justify-center shrink-0"
                    style={{ backgroundColor: botConfig.color_theme || '#4f46e5' }}
                  >
                    <Send size={20} />
                  </button>
                </form>
                <div className="flex items-center justify-center mt-3">
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium tracking-wide">
                    POWERED BY <a href="#" target="_blank" className="hover:text-indigo-500 transition-colors">AI Chat Bot</a>
                  </span>
                </div>
              </div>

              {/* Inline Callback Request Modal */}
              {showCallbackModal && (
                <div className="absolute inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 rounded-2xl md:rounded-l-none animate-in fade-in duration-200">
                  <div className="w-full max-w-sm bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-2xl border border-gray-100 dark:border-gray-700 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                          <Phone size={16} />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-gray-900 dark:text-white">Request Call Back</h4>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400">DCS Techno Services Pvt. Ltd.</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setShowCallbackModal(false);
                          setCallbackError('');
                        }}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1"
                      >
                        <X size={16} />
                      </button>
                    </div>

                    <div className="bg-gray-50 dark:bg-gray-900/60 p-3 rounded-xl text-xs space-y-1.5 border border-gray-100 dark:border-gray-700">
                      <div className="flex justify-between text-gray-500 dark:text-gray-400">
                        <span>Category:</span>
                        <span className="font-semibold text-gray-800 dark:text-gray-200">{selectedCategory?.name}</span>
                      </div>
                      <div className="flex justify-between text-gray-500 dark:text-gray-400">
                        <span>{selectedItem?.type === 'service' ? 'Service:' : 'Brand:'}</span>
                        <span className="font-semibold text-indigo-600 dark:text-indigo-400">{selectedItem?.name}</span>
                      </div>
                    </div>

                    <form onSubmit={handleCallbackSubmit} className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Mobile Number (India)
                        </label>
                        <div className="flex items-center">
                          <span className="inline-flex items-center px-3 py-2.5 rounded-l-xl border border-r-0 border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-xs font-semibold">
                            +91
                          </span>
                          <input
                            type="tel"
                            placeholder="10-digit mobile number"
                            maxLength={10}
                            value={callbackMobile}
                            disabled={isSubmittingCallback}
                            onChange={(e) => {
                              const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                              setCallbackMobile(val);
                              if (callbackError) setCallbackError('');
                            }}
                            className="flex-1 text-sm px-3 py-2.5 rounded-r-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/60 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                            autoFocus
                          />
                        </div>
                        {callbackError && (
                          <p className="text-[11px] text-red-500 mt-1 flex items-center">
                            <AlertCircle size={12} className="mr-1 shrink-0" /> {callbackError}
                          </p>
                        )}
                        <p className="text-[10px] text-gray-400 mt-1">
                          Enter 10 digits starting with 6, 7, 8, or 9
                        </p>
                      </div>

                      <div className="flex items-center space-x-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setShowCallbackModal(false);
                            setCallbackError('');
                          }}
                          disabled={isSubmittingCallback}
                          className="flex-1 py-2.5 px-3 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={isSubmittingCallback || !callbackMobile}
                          className="flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-md active:scale-98 disabled:opacity-50 flex items-center justify-center space-x-1"
                        >
                          {isSubmittingCallback ? (
                            <>
                              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin mr-1"></div>
                              <span>Submitting...</span>
                            </>
                          ) : (
                            <span>Submit Request</span>
                          )}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className="pointer-events-auto rounded-full w-14 h-14 shadow-2xl flex items-center justify-center hover:scale-110 transition-all duration-200 text-white overflow-hidden"
          style={{ backgroundColor: botConfig.color_theme || '#4f46e5' }}
        >
          {botConfig.avatar_url ? (
            <img src={botConfig.avatar_url} alt="Open Chat" className="w-full h-full object-cover" />
          ) : (
            <Bot size={28} />
          )}
        </button>
      )}
    </div>
  );
}
