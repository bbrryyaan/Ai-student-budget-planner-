import React, { useState, useEffect, useRef, useMemo } from "react";
import { useAuth } from "../context/useAuth";
import api from "../lib/api";
import { Send, Bot, User, Loader2, Sparkles, X, MessageSquare } from "lucide-react";
import ReactMarkdown from "react-markdown";

const FloatingChatbot = ({ mode }) => {
  const { user } = useAuth();
  const defaultWelcome = useMemo(() => ({ 
    role: 'buddy', 
    text: `Hey ${user?.name || 'there'}! I'm your **Money Buddy**. \n\nAsk me anything about your spending, goals, or budget and I'll help you out.` 
  }), [user?.name]);
  
  const [isOpen, setIsOpen] = useState(false);
  const [activeChatId, setActiveChatId] = useState(null);
  const [chatHistory, setChatHistory] = useState([defaultWelcome]);
  
  const [userMsg, setUserMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const chatContainerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    
    const fetchChats = async () => {
      try {
        const response = await api.get('/api/ai/chats');
        if (response.data.chats && response.data.chats.length > 0) {
          setActiveChatId(response.data.chats[0]._id);
        } else {
          setIsInitialLoading(false);
        }
      } catch {
        setIsInitialLoading(false);
      }
    };
    if (!activeChatId) fetchChats();
  }, [isOpen, activeChatId]);

  useEffect(() => {
    if (!activeChatId) return;

    const fetchChatHistory = async () => {
      setIsInitialLoading(true);
      try {
        const response = await api.get(`/api/ai/chats/${activeChatId}`);
        if (response.data.messages && response.data.messages.length > 0) {
          setChatHistory(response.data.messages);
        }
      } catch {
        setChatHistory([defaultWelcome]);
      } finally {
        setIsInitialLoading(false);
      }
    };

    fetchChatHistory();
  }, [activeChatId, defaultWelcome]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!userMsg.trim() || isLoading) return;

    const newUserMessage = { role: 'user', text: userMsg };
    setChatHistory(prev => [...prev, newUserMessage]);
    setUserMsg("");
    setIsLoading(true);

    try {
      const response = await api.post('/api/ai/chats', { message: userMsg, chatId: activeChatId, mode });
      const data = response.data;
      setChatHistory(prev => [...prev, { role: 'buddy', text: data.reply }]);
      if (!activeChatId && data.chatId) setActiveChatId(data.chatId);
    } catch {
      setChatHistory(prev => [...prev, { role: 'buddy', text: "Oops! I'm having trouble connecting." }]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory, isOpen]);

  return (
    <>
      {/* Floating Chat Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 w-12 h-12 sm:w-14 sm:h-14 bg-cyan-600 hover:bg-cyan-500 rounded-full flex items-center justify-center shadow-lg shadow-cyan-900/50 transition-all hover:scale-105 active:scale-95 z-50 animate-bounce group"
        >
          <Bot size={24} className="text-white group-hover:animate-pulse sm:hidden" />
          <Bot size={28} className="text-white group-hover:animate-pulse hidden sm:block" />
        </button>
      )}

      {/* Chat Popover */}
      {isOpen && (
        <div className="fixed inset-x-4 bottom-4 top-20 sm:inset-auto sm:bottom-6 sm:right-6 sm:w-[400px] sm:h-[550px] bg-slate-950 rounded-3xl border border-slate-800 shadow-2xl flex flex-col overflow-hidden z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">
          
          {/* Header */}
          <div className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 p-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0 border border-cyan-500/30">
                <Bot size={22} className="stroke-[1.5]" />
              </div>
              <div>
                <h2 className="text-white font-semibold text-base m-0 leading-tight flex items-center gap-1.5">
                  Money Buddy
                  <Sparkles size={14} className="text-cyan-400 animate-pulse" />
                </h2>
                <p className="text-xs text-slate-400 m-0">AI Coach</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button 
                onClick={() => {
                  setIsOpen(false);
                  window.location.href = "/dashboard/moneybuddy";
                }}
                className="p-2 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded-full transition-colors flex items-center gap-1"
                title="Open full view"
              >
                <MessageSquare size={18} />
              </button>
              <button 
                onClick={() => setIsOpen(false)} 
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
                title="Close"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-grow overflow-y-auto p-4 space-y-5 bg-slate-950/50" ref={chatContainerRef}>
            {isInitialLoading ? (
              <div className="flex justify-center items-center h-full">
                <Loader2 size={24} className="animate-spin text-cyan-400" />
              </div>
            ) : (
              chatHistory.map((message, index) => {
                const isBuddy = message.role === 'buddy';
                return (
                  <div key={index} className={`flex gap-3 ${isBuddy ? 'items-start' : 'items-start flex-row-reverse'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm ${
                      isBuddy 
                        ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' 
                        : 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                    }`}>
                      {isBuddy ? <Bot size={16} /> : <User size={16} />}
                    </div>
                    <div className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm ${
                      isBuddy 
                        ? 'bg-slate-900 border border-slate-800 text-slate-300 rounded-tl-sm' 
                        : 'bg-indigo-600 border border-indigo-500 text-white rounded-tr-sm'
                    }`}>
                      {isBuddy ? (
                        <div className="prose prose-invert prose-sm max-w-none">
                          <ReactMarkdown>{message.text}</ReactMarkdown>
                        </div>
                      ) : (
                        <div>{message.text}</div>
                      )}
                    </div>
                  </div>
                );
              })
            )}

            {isLoading && (
              <div className="flex gap-3 items-start animate-pulse">
                <div className="w-8 h-8 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center shrink-0">
                  <Bot size={16} />
                </div>
                <div className="bg-slate-900 border border-slate-800 text-slate-300 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin text-cyan-400" />
                  <span className="text-xs">Thinking...</span>
                </div>
              </div>
            )}
          </div>

          {/* Input Form */}
          <form onSubmit={sendMessage} className="shrink-0 p-3 bg-slate-900/90 backdrop-blur-md border-t border-slate-800">
            <div className="relative flex items-center">
              <input
                type="text"
                value={userMsg}
                onChange={(e) => setUserMsg(e.target.value)}
                placeholder="Ask me anything..."
                className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 rounded-full py-3 pl-5 pr-12 text-sm text-white placeholder-slate-500 outline-none"
                disabled={isLoading || isInitialLoading}
              />
              <button 
                type="submit" 
                className="absolute right-1.5 p-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-full transition-colors disabled:opacity-50" 
                disabled={isLoading || isInitialLoading || !userMsg.trim()}
              >
                <Send size={16} className="translate-x-[1px] translate-y-[-1px]" />
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
};

export default FloatingChatbot;
