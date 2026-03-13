import { useState, useEffect, useRef, useMemo } from "react";
import { useAuth } from "../../context/useAuth";
import api from "../../lib/api";
import { Send, Bot, User, Loader2, Sparkles, Plus, MessageSquare, Trash2, Menu, X } from "lucide-react";
import ReactMarkdown from "react-markdown";

const MoneyBuddyPage = () => {
  const { user } = useAuth();
  const defaultWelcome = useMemo(() => ({ role: 'buddy', text: `Hey ${user?.name || 'there'}! I'm your **Money Buddy**. \n\nAsk me anything about your spending, goals, or budget and I'll help you out. Let's make your money work for you! 💪` }), [user?.name]);
  
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [chatHistory, setChatHistory] = useState([defaultWelcome]);
  
  const [userMsg, setUserMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const chatContainerRef = useRef(null);

  // Fetch all chats on mount
  useEffect(() => {
    const fetchChats = async () => {
      try {
        const response = await api.get('/api/ai/chats');
        if (response.data.chats) {
          setChats(response.data.chats);
          if (response.data.chats.length > 0 && !activeChatId) {
            setActiveChatId(response.data.chats[0]._id);
          } else if (response.data.chats.length === 0) {
            setIsInitialLoading(false);
          }
        }
      } catch (error) {
        console.error("Failed to load chats", error);
        setIsInitialLoading(false);
      }
    };
    fetchChats();
  }, []);

  // Fetch history when activeChatId changes
  useEffect(() => {
    const fetchChatHistory = async () => {
      if (!activeChatId) {
        setChatHistory([defaultWelcome]);
        setIsInitialLoading(false);
        return;
      }
      setIsInitialLoading(true);
      try {
        const response = await api.get(`/api/ai/chats/${activeChatId}`);
        if (response.data.messages && response.data.messages.length > 0) {
          setChatHistory(response.data.messages);
        } else {
          setChatHistory([defaultWelcome]);
        }
      } catch (error) {
        console.error("Failed to load chat history", error);
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
      const response = await api.post('/api/ai/chats', { message: userMsg, chatId: activeChatId });
      const data = response.data;
      setChatHistory(prev => [...prev, { role: 'buddy', text: data.reply }]);
      
      if (!activeChatId && data.chatId) {
        setActiveChatId(data.chatId);
        setChats(prev => [{ _id: data.chatId, title: data.title || "New Chat" }, ...prev]);
      }
    } catch (error) {
      const errorText = error.response?.data?.error || "Oops! I'm having a little trouble connecting right now. Please try again in a moment.";
      setChatHistory(prev => [...prev, { role: 'buddy', text: errorText }]);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteChat = async (id, e) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this chat?")) return;
    try {
      await api.delete(`/api/ai/chats/${id}`);
      setChats(prev => prev.filter(c => c._id !== id));
      if (activeChatId === id) {
        setActiveChatId(null);
      }
    } catch (error) {
      console.error("Failed to delete chat", error);
    }
  };

  const startNewChat = () => {
    setActiveChatId(null);
    setIsSidebarOpen(false);
  };

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory]);

  return (
    <div className="flex h-[calc(100vh-180px)] lg:h-[calc(100vh-160px)] w-full gap-4 relative">
      {/* Sidebar - Desktop Only */}
      <div className={`
        fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-sm lg:relative lg:bg-transparent lg:backdrop-blur-none lg:inset-auto lg:z-0
        transition-all duration-300 ${isSidebarOpen ? 'opacity-100 visible' : 'opacity-0 invisible lg:opacity-100 lg:visible'}
        lg:w-72 lg:flex lg:shrink-0
      `}>
        <div className={`
          absolute left-0 top-0 bottom-0 w-72 bg-slate-950 flex flex-col border border-slate-800 lg:rounded-3xl shadow-2xl transition-transform duration-300
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}>
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-white font-bold flex items-center gap-2">
              <MessageSquare size={18} className="text-cyan-400" />
              Chat History
            </h3>
            <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-1 text-slate-400 hover:text-white">
              <X size={20} />
            </button>
          </div>

          <div className="p-4">
            <button 
              onClick={startNewChat}
              className="w-full flex items-center justify-center gap-2 py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-cyan-900/20 active:scale-95 text-sm"
            >
              <Plus size={18} /> New Chat
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-1 custom-scrollbar">
            {chats.map(chat => (
              <div
                key={chat._id}
                onClick={() => {
                  setActiveChatId(chat._id);
                  setIsSidebarOpen(false);
                }}
                className={`group relative w-full flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${
                  activeChatId === chat._id 
                    ? 'bg-slate-800 border border-slate-700 text-white' 
                    : 'hover:bg-slate-900/50 text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                <div className={`p-1.5 rounded-lg ${activeChatId === chat._id ? 'bg-cyan-500/20 text-cyan-400' : 'bg-slate-800 text-slate-500'}`}>
                  <MessageSquare size={14} />
                </div>
                <span className="truncate text-xs font-medium flex-1">{chat.title}</span>
                <button 
                  onClick={(e) => deleteChat(chat._id, e)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex flex-col flex-1 bg-slate-950 lg:rounded-3xl border-x lg:border border-slate-800 shadow-2xl overflow-hidden relative min-w-0">
        {/* Header */}
        <div className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 p-3 sm:p-4 flex items-center justify-between shrink-0 z-10 sticky top-0">
          <div className="flex items-center gap-3 sm:gap-4">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-400 transition-colors"
            >
              <Menu size={18} />
            </button>
            <div className="relative group">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-cyan-600 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-cyan-500/20 group-hover:scale-105 transition-transform">
                <Bot size={24} className="stroke-[1.5]" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-slate-950 rounded-full shadow-sm" />
            </div>
            <div>
              <h2 className="text-white font-bold text-lg m-0 leading-tight flex items-center gap-2">
                Money Buddy
                <div className="px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-[10px] text-cyan-400 font-black uppercase tracking-widest">PRO</div>
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                <Sparkles size={12} className="text-amber-400" />
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold m-0">Always active for your finances</p>
              </div>
            </div>
          </div>
          
          <div className="hidden sm:flex items-center gap-2">
             <div className="px-3 py-1.5 rounded-xl bg-slate-800/50 border border-slate-700 text-xs text-slate-400 font-medium">
               Model: 2.5-flash
             </div>
          </div>
        </div>

        {isInitialLoading ? (
          <div className="flex-grow flex items-center justify-center bg-slate-950">
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                <Loader2 size={40} className="animate-spin text-cyan-500" />
                <Bot size={20} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-cyan-400" />
              </div>
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Initializing Buddy...</span>
            </div>
          </div>
        ) : (
          <>
            {/* Messages Area */}
            <div className="flex-grow overflow-y-auto p-4 sm:p-6 space-y-6 bg-slate-950 custom-scrollbar" ref={chatContainerRef}>
              {chatHistory.map((message, index) => {
                const isBuddy = message.role === 'buddy';
                return (
                  <div key={index} className={`flex gap-3 sm:gap-4 ${isBuddy ? 'items-start' : 'items-start flex-row-reverse'}`}>
                    <div className={`w-9 h-9 sm:w-11 sm:h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-xl transition-all ${
                      isBuddy 
                        ? 'bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 text-cyan-400 group-hover:scale-110' 
                        : 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white group-hover:scale-110'
                    }`}>
                      {isBuddy ? <Bot size={22} className="stroke-[1.5]" /> : <User size={22} className="stroke-[1.5]" />}
                    </div>

                    <div className={`group relative max-w-[85%] sm:max-w-[70%] px-5 py-3.5 rounded-3xl text-sm leading-relaxed shadow-2xl transition-all ${
                      isBuddy 
                        ? 'bg-slate-900/80 backdrop-blur-sm border border-slate-800 text-slate-300 rounded-tl-sm hover:border-slate-700' 
                        : 'bg-indigo-600 border border-indigo-500/50 text-white rounded-tr-sm hover:bg-indigo-500'
                    }`}>
                      {isBuddy ? (
                        <div className="prose prose-invert prose-sm max-w-none">
                          <ReactMarkdown 
                            components={{
                              p: ({...props}) => <p className="mb-2 last:mb-0 leading-relaxed" {...props} />,
                              strong: ({...props}) => <strong className="font-bold text-cyan-300" {...props} />,
                              ul: ({...props}) => <ul className="list-disc pl-5 mb-2 space-y-1.5" {...props} />,
                              li: ({...props}) => <li className="marker:text-cyan-500/50" {...props} />,
                              code: ({inline, ...props}) => inline 
                                ? <code className="bg-slate-800 px-1.5 py-0.5 rounded text-cyan-200 text-xs font-mono" {...props} />
                                : <pre className="bg-slate-950 p-3 rounded-xl overflow-x-auto my-3 border border-slate-800" {...props} />
                            }}
                          >
                            {message.text}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <div className="whitespace-pre-wrap font-medium">{message.text}</div>
                      )}
                      
                      <div className={`absolute -bottom-6 ${isBuddy ? 'left-0' : 'right-0'} opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-slate-500 font-bold uppercase tracking-widest py-1 px-2`}>
                        {isBuddy ? 'Money Buddy • Sent' : 'You • Sent'}
                      </div>
                    </div>
                  </div>
                );
              })}
              {isLoading && (
                <div className="flex gap-4 items-start animate-pulse">
                  <div className="w-10 h-10 rounded-2xl bg-slate-900 border border-slate-800 text-cyan-500 flex items-center justify-center shrink-0">
                    <Bot size={20} />
                  </div>
                  <div className="bg-slate-900/30 border border-slate-800/50 rounded-2xl rounded-tl-sm px-5 py-3 shadow-sm flex items-center gap-3">
                    <div className="flex gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-bounce [animation-delay:-0.3s]" />
                      <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-bounce [animation-delay:-0.15s]" />
                      <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-bounce" />
                    </div>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-tighter">Buddy is typing...</span>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Input Form */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
          <form onSubmit={sendMessage} className="max-w-4xl mx-auto">
            <div className="relative group">
              <input
                type="text"
                value={userMsg}
                onChange={(e) => setUserMsg(e.target.value)}
                placeholder="Message Money Buddy..."
                className="w-full bg-slate-900/50 border border-slate-700 hover:border-slate-600 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 rounded-2xl py-4 pl-6 pr-14 text-sm text-white placeholder-slate-500 transition-all outline-none"
                disabled={isLoading}
              />
              <button 
                type="submit" 
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all shadow-lg active:scale-90 disabled:opacity-30 disabled:grayscale" 
                disabled={isLoading || !userMsg.trim()}
              >
                <Send size={18} />
              </button>
            </div>
            <p className="text-[10px] text-center text-slate-600 mt-2 font-medium">Money Buddy may make mistakes. Verify important financial decisions.</p>
          </form>
        </div>
      </div>
    </div>
  );
};

export default MoneyBuddyPage;
