'use client';

import { useState, useRef, useEffect } from 'react';
import { useCompany } from '@/components/CompanyContext';

// ============ Types ============

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  context?: {
    jobId?: string;
    documentName?: string;
    originalAccount?: string;
    correctedAccount?: string;
    feedbackType?: 'correction' | 'question' | 'suggestion' | 'praise';
  };
}

interface FeedbackChatProps {
  // Context om aktuellt dokument (om öppet)
  currentJobId?: string;
  currentDocumentName?: string;
  currentClassification?: {
    supplier: string;
    account: string;
    amount: number;
  };
  onAccountCorrection?: (jobId: string, newAccount: string) => void;
  // Variant: 'floating' (default) or 'inline' (for header placement)
  variant?: 'floating' | 'inline';
}

// ============ Quick Actions ============

const QUICK_ACTIONS = [
  { 
    label: 'Fel konto', 
    icon: '🔄',
    prompt: 'Det föreslagna kontot är fel. Rätt konto borde vara...',
    type: 'correction' as const,
  },
  { 
    label: 'Fel leverantör', 
    icon: '👤',
    prompt: 'Leverantörsnamnet är fel. Det ska vara...',
    type: 'correction' as const,
  },
  { 
    label: 'Fel belopp', 
    icon: '💰',
    prompt: 'Beloppet stämmer inte. Rätt belopp är...',
    type: 'correction' as const,
  },
  { 
    label: 'Bra jobbat!', 
    icon: '👍',
    prompt: 'Bra jobbat! Den här klassificeringen var helt rätt.',
    type: 'praise' as const,
  },
];

// ============ Main Component ============

export function FeedbackChat({ 
  currentJobId, 
  currentDocumentName, 
  currentClassification,
  onAccountCorrection,
  variant = 'floating'
}: FeedbackChatProps) {
  const { selectedCompany } = useCompany();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Hej! 👋 Jag är din bokföringsassistent. Berätta om något är fel så lär jag mig av det. Du kan också ställa frågor om bokföring.',
      timestamp: new Date().toISOString(),
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  // Focus input when opened
  useEffect(() => {
    if (isOpen && !isMinimized) {
      inputRef.current?.focus();
    }
  }, [isOpen, isMinimized]);
  
  const handleSend = async (content: string, feedbackType?: 'correction' | 'question' | 'suggestion' | 'praise') => {
    if (!content.trim() || isLoading) return;
    
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: content.trim(),
      timestamp: new Date().toISOString(),
      context: currentJobId ? {
        jobId: currentJobId,
        documentName: currentDocumentName,
        feedbackType,
      } : undefined,
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setShowQuickActions(false);
    setIsLoading(true);
    
    try {
      // Anropa API för AI-svar
      const response = await fetch('/api/accounting/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content,
          companyId: selectedCompany?.id,
          context: {
            jobId: currentJobId,
            documentName: currentDocumentName,
            currentClassification,
            feedbackType,
          },
          conversationHistory: messages.slice(-5), // Skicka senaste 5 meddelanden för kontext
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to get response');
      }
      
      const data = await response.json();
      
      const assistantMessage: ChatMessage = {
        id: `msg-${Date.now()}-assistant`,
        role: 'assistant',
        content: data.message,
        timestamp: new Date().toISOString(),
        context: data.context,
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      
      // Om AI:n föreslår en kontoändring, trigga callback
      if (data.suggestedAccount && onAccountCorrection && currentJobId) {
        onAccountCorrection(currentJobId, data.suggestedAccount);
      }
      
    } catch (error) {
      console.error('Feedback chat error:', error);
      
      // Fallback-svar om API misslyckas
      const errorMessage: ChatMessage = {
        id: `msg-${Date.now()}-error`,
        role: 'assistant',
        content: 'Tack för din feedback! Jag har sparat den och kommer att lära mig av det. Om du korrigerade ett konto, glöm inte att uppdatera det i formuläret ovan.',
        timestamp: new Date().toISOString(),
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleQuickAction = (action: typeof QUICK_ACTIONS[0]) => {
    setInputValue(action.prompt);
    setShowQuickActions(false);
    inputRef.current?.focus();
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(inputValue);
    }
  };
  
  // Inline variant - compact button for header placement
  if (variant === 'inline' && !isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-[#c0a280] to-[#8b7355] text-white rounded-full text-xs font-medium hover:shadow-md transition-all hover:scale-105"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
        AI-assistent
      </button>
    );
  }
  
  // Floating button when closed (default variant)
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-br from-[#c0a280] to-[#8b7355] rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 flex items-center justify-center z-50 group"
      >
        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
        
        {/* Notification badge */}
        <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-xs text-white font-bold animate-pulse">
          AI
        </span>
        
        {/* Tooltip */}
        <span className="absolute right-full mr-3 px-3 py-1.5 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
          Feedback till AI
        </span>
      </button>
    );
  }
  
  // Minimized state
  if (isMinimized) {
    return (
      <div className={variant === 'inline' ? 'relative' : 'fixed bottom-6 right-6 z-50'}>
        <button
          onClick={() => setIsMinimized(false)}
          className="flex items-center gap-3 px-4 py-3 bg-white rounded-full shadow-lg hover:shadow-xl transition-all border border-gray-200"
        >
          <div className="w-8 h-8 bg-gradient-to-br from-[#c0a280] to-[#8b7355] rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </div>
          <span className="text-sm font-medium text-gray-700">AI-assistent</span>
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        </button>
      </div>
    );
  }
  
  // Full chat window - position depends on variant
  const chatWindowClass = variant === 'inline' 
    ? 'fixed top-20 right-6 w-96 h-[500px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col z-50 overflow-hidden'
    : 'fixed bottom-6 right-6 w-96 h-[500px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col z-50 overflow-hidden';
  
  return (
    <div className={chatWindowClass}>
      
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-[#c0a280] to-[#8b7355] text-white">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
            <span className="text-lg">🤖</span>
          </div>
          <div>
            <h3 className="font-medium text-sm">Bokföringsassistent</h3>
            <p className="text-xs text-white/70">Hjälper dig & lär sig av feedback</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(true)}
            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
      
      {/* Context Banner (if viewing a document) */}
      {currentDocumentName && (
        <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 flex items-center gap-2">
          <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span className="text-xs text-blue-700 truncate">Diskuterar: {currentDocumentName}</span>
        </div>
      )}
      
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                message.role === 'user'
                  ? 'bg-gradient-to-br from-[#c0a280] to-[#8b7355] text-white rounded-br-md'
                  : 'bg-gray-100 text-gray-800 rounded-bl-md'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              <p className={`text-xs mt-1 ${message.role === 'user' ? 'text-white/60' : 'text-gray-400'}`}>
                {new Date(message.timestamp).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
      
      {/* Quick Actions */}
      {showQuickActions && messages.length <= 2 && (
        <div className="px-4 pb-2">
          <p className="text-xs text-gray-500 mb-2">Snabbval:</p>
          <div className="flex flex-wrap gap-2">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.label}
                onClick={() => handleQuickAction(action)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-full text-xs text-gray-700 transition-colors"
              >
                <span>{action.icon}</span>
                <span>{action.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      
      {/* Input */}
      <div className="p-4 border-t border-gray-100">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Skriv feedback eller ställ en fråga..."
            className="flex-1 px-4 py-2.5 bg-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#c0a280]/50"
            disabled={isLoading}
          />
          <button
            onClick={() => handleSend(inputValue)}
            disabled={!inputValue.trim() || isLoading}
            className="p-2.5 bg-gradient-to-br from-[#c0a280] to-[#8b7355] text-white rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2 text-center">
          Din feedback hjälper AI:n att bli bättre 🧠
        </p>
      </div>
    </div>
  );
}

export default FeedbackChat;

