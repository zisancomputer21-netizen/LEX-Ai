import React, { useState, useRef, useEffect } from 'react';
import { 
  Zap, 
  Plus,
  Trash2, 
  Copy, 
  Volume2, 
  RefreshCcw, 
  MoreVertical,
  MoreHorizontal,
  LogOut,
  User as UserIcon,
  ClipboardCopy,
  Sun,
  Moon,
  Clock,
  Settings as SettingsIcon,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { geminiService, Message } from './services/gemini.ts';
import { auth, db, signInWithGoogle } from './lib/firebase';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { handleFirestoreError, OperationType } from './lib/utils';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [chats, setChats] = useState<{ id: string; title: string; createdAt: any }[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{ url: string; data: string; mimeType: string } | null>(null);
  const [isLeftMenuOpen, setIsLeftMenuOpen] = useState(false);
  const [isRightMenuOpen, setIsRightMenuOpen] = useState(false);
  const [isApiSettingsOpen, setIsApiSettingsOpen] = useState(false);
  const [tempApiKey, setTempApiKey] = useState('');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [hasApiKey, setHasApiKey] = useState(geminiService.hasKey());
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Pre-load voices for TTS
    const loadVoices = () => {
      window.speechSynthesis.getVoices();
    };
    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  // Auth & API Key Sync
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const userDocRef = doc(db, 'users', currentUser.uid);
        try {
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            const data = userDoc.data();
            if (data.geminiApiKey) {
              geminiService.updateApiKey(data.geminiApiKey);
              setHasApiKey(true);
            }
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
        }
      } else {
        setHasApiKey(false);
        setMessages([]);
        setChats([]);
        setCurrentChatId(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // Fetch Chat History
  useEffect(() => {
    if (!user) return;
    const chatsRef = collection(db, 'users', user.uid, 'chats');
    const q = query(chatsRef, orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chatList = snapshot.docs
        .map(doc => {
          const data = doc.data();
          return { ...data, id: doc.id };
        })
        .filter(chat => !chat.deleted);
      
      // Deduplicate chats by ID
      const uniqueChats = Array.from(new Map(chatList.map(c => [c.id, c])).values()) as any[];
      setChats(uniqueChats);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user?.uid}/chats`);
    });

    return () => unsubscribe();
  }, [user]);

  // Sync Messages for Active Chat
  useEffect(() => {
    if (!user || !currentChatId) {
      if (!currentChatId) setMessages([]);
      return;
    }
    
    const messagesRef = collection(db, 'users', user.uid, 'chats', currentChatId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id
        };
      }) as Message[];
      
      // Deduplicate messages by ID to prevent key conflicts
      const uniqueMsgs = Array.from(new Map(msgs.map(m => [m.id, m])).values());
      setMessages(uniqueMsgs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user?.uid}/chats/${currentChatId}/messages`);
    });

    return () => unsubscribe();
  }, [user, currentChatId]);

  const createNewChat = async () => {
    if (!user) {
      setMessages([]);
      setCurrentChatId(null);
      setIsLeftMenuOpen(false);
      return;
    }

    try {
      const chatsRef = collection(db, 'users', user.uid, 'chats');
      const newChatDoc = await addDoc(chatsRef, {
        title: 'New Session',
        createdAt: serverTimestamp()
      });
      setCurrentChatId(newChatDoc.id);
      setIsLeftMenuOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `users/${user.uid}/chats`);
    }
  };

  const loadChat = (chatId: string) => {
    setCurrentChatId(chatId);
    setIsLeftMenuOpen(false);
  };

  const handleUpdateApiKey = async () => {
    if (tempApiKey.trim()) {
      const newKey = tempApiKey.trim();
      geminiService.updateApiKey(newKey);
      setHasApiKey(true);
      setIsApiSettingsOpen(false);

      if (user) {
        const userDocRef = doc(db, 'users', user.uid);
        try {
          await setDoc(userDocRef, {
            geminiApiKey: newKey,
            updatedAt: serverTimestamp()
          }, { merge: true });
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
        }
      }

      setMessages(prev => [...prev, { 
        id: crypto.randomUUID(),
        role: 'model', 
        parts: [{ text: "ELX CORE ACTIVATED. Your personal AI companion is ready for any query." }] 
      }]);
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        setSelectedImage({
          url: reader.result as string,
          data: base64,
          mimeType: file.type
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const clearCache = () => {
    setMessages([]);
    setSelectedImage(null);
    setIsRightMenuOpen(false);
  };

  const handleSend = async () => {
    if (!inputText.trim() && !selectedImage) return;

    const currentInput = inputText;
    const currentImage = selectedImage;
    
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      parts: [
        { text: currentInput },
        ...(currentImage ? [{ inlineData: { mimeType: currentImage.mimeType, data: currentImage.data } }] : [])
      ]
    };

    let chatId = currentChatId;
    
    // Auto-create chat if guest/first message
    if (user && !chatId) {
      try {
        const chatsRef = collection(db, 'users', user.uid, 'chats');
        const newChatDoc = await addDoc(chatsRef, {
          title: currentInput.substring(0, 30) || 'New Session',
          createdAt: serverTimestamp()
        });
        chatId = newChatDoc.id;
        setCurrentChatId(newChatDoc.id);
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `users/${user.uid}/chats`);
      }
    }

    try {
      if (!hasApiKey) {
        const inactiveMessage: Message = {
          id: crypto.randomUUID(),
          role: 'model',
          parts: [{ text: "⚠️ ELX CORE INACTIVE. Please go to Settings [⚙️] and paste your API Key to establish connection." }]
        };
        setMessages(prev => [...prev, userMessage, inactiveMessage]);
        setInputText('');
        setSelectedImage(null);
        setIsTyping(false);
        return;
      }

      // Optimistic update for UI feel
      setMessages(prev => [...prev, userMessage]);
      setInputText('');
      setSelectedImage(null);
      setIsTyping(true);

      // Save user message to Firestore
      if (user && chatId) {
        const messagesRef = collection(db, 'users', user.uid, 'chats', chatId, 'messages');
        const msgDocRef = doc(messagesRef, userMessage.id);
        await setDoc(msgDocRef, {
          ...userMessage,
          createdAt: serverTimestamp()
        });
      }
      
      const response = await geminiService.chat(
        messages, 
        currentInput, 
        currentImage ? { mimeType: currentImage.mimeType, data: currentImage.data } : undefined
      );
      
      const modelMessage: Message = {
        id: crypto.randomUUID(),
        role: 'model',
        parts: [{ text: response }]
      };
      
      // Save model response to Firestore
      if (user && chatId) {
        const messagesRef = collection(db, 'users', user.uid, 'chats', chatId, 'messages');
        const msgDocRef = doc(messagesRef, modelMessage.id);
        await setDoc(msgDocRef, {
          ...modelMessage,
          createdAt: serverTimestamp()
        });
      } else {
        setMessages(prev => [...prev, modelMessage]);
      }
      
      // Auto-speak response AFTER everything is processed
      speakText(response);
    } catch (error) {
      console.error('ELX Error:', error);
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: 'model',
        parts: [{ text: 'System Error: Connectivity to ELX Core lost.' }]
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const speakText = (content: string) => {
    // 1. Force stop any ongoing speech
    window.speechSynthesis.cancel();

    if (!content) return;

    // 2. Clean Markdown and symbols for natural speech
    const cleanText = content
      .replace(/[#*`_]/g, '')             // Remove basic Markdown
      .replace(/!\[.*?\]\(.*?\)/g, '')    // Remove Images
      .replace(/\[.*?\]\(.*?\)/g, '$1')   // Remove links (keep text)
      .replace(/\n+/g, ' ')               // Smooth breathing spaces
      .trim();

    if (!cleanText || cleanText.length < 2) return;

    // 3. Setup Utterance
    const utterance = new SpeechSynthesisUtterance(cleanText);
    
    // Detect Bengali Unicode range
    const hasBengali = /[\u0980-\u09FF]/.test(cleanText);

    if (hasBengali) {
      utterance.lang = 'bn-BD';
      utterance.rate = 0.8; // User requested 0.8 for Bengali
      utterance.pitch = 1.0;
      
      // Try to find a Bengali voice
      const voices = window.speechSynthesis.getVoices();
      const bnVoice = voices.find(v => v.lang.includes('bn-BD')) || 
                      voices.find(v => v.lang.includes('bn-IN')) ||
                      voices.find(v => v.name.toLowerCase().includes('bengali'));
      if (bnVoice) utterance.voice = bnVoice;
    } else {
      utterance.lang = 'en-US';
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
    }

    // 4. Trigger Speech after a tiny delay
    setTimeout(() => {
      window.speechSynthesis.speak(utterance);
    }, 50);
  };

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const bulkCopy = () => {
    const allText = messages.map(m => `${m.role === 'user' ? 'YOU' : 'ELX'}: ${m.parts[0]?.text || ''}`).join('\n\n');
    copyToClipboard(allText);
    setIsRightMenuOpen(false);
  };

  const isLight = theme === 'light';

  return (
    <div className={`flex h-screen w-full flex-col overflow-hidden relative transition-colors duration-300 ${isLight ? 'bg-[#F8F9FA] text-[#212529]' : 'bg-[#151619] text-gray-300'}`}>
      {/* Navigation Overlays */}
      <AnimatePresence>
        {isLeftMenuOpen && (
          <motion.div 
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className={`absolute inset-y-0 left-0 w-72 z-50 p-6 flex flex-col border-r ${isLight ? 'bg-white border-[#E9ECEF]' : 'bg-[#1C1E22] border-[#2D3036]'}`}
          >
            <div className={`flex items-center gap-3 p-3 rounded-lg border mb-6 ${isLight ? 'bg-[#F1F3F5] border-[#E9ECEF]' : 'bg-[#151619] border-[#2D3036]'}`}>
              {user ? (
                <>
                  <div className="h-10 w-10 rounded-full bg-elx-green/20 flex items-center justify-center border border-elx-green/40 font-bold text-elx-green overflow-hidden">
                    {user.photoURL ? <img src={user.photoURL} alt="User" /> : user.displayName?.charAt(0) || 'U'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold truncate ${isLight ? 'text-black' : 'text-white'}`}>{user.displayName || user.email}</p>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest leading-none">ELX AUTHENTICATED</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="h-10 w-10 rounded-full bg-gray-500/20 flex items-center justify-center border border-gray-500/40">
                    <UserIcon className="h-5 w-5 text-gray-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold truncate ${isLight ? 'text-black' : 'text-white'}`}>Guest Mode</p>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest leading-none">Login Required</p>
                  </div>
                </>
              )}
            </div>

            <button 
              onClick={createNewChat}
              className="w-full flex items-center justify-center gap-2 p-3 rounded-lg bg-elx-green/10 border border-elx-green/30 text-elx-green text-xs font-bold uppercase tracking-widest hover:bg-elx-green/20 transition-all mb-8"
            >
              <Plus className="h-4 w-4" /> New Chat Session
            </button>
            
            <div className="flex-1 overflow-y-auto space-y-4 mb-4 scrollbar-none">
              <h2 className="text-[10px] uppercase tracking-widest text-gray-500 font-bold px-2">History View</h2>
              
              <div className="space-y-1">
                {chats.map((chat) => (
                  <div 
                    key={`chat-${chat.id}`}
                    className="group relative"
                  >
                    <button 
                      onClick={() => loadChat(chat.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all text-xs text-left ${
                        currentChatId === chat.id 
                          ? (isLight ? 'bg-elx-green/10 text-elx-green border border-elx-green/20' : 'bg-elx-green/10 text-white border border-elx-green/30') 
                          : (isLight ? 'hover:bg-[#F1F3F5] text-gray-600' : 'hover:bg-[#2D3036] text-gray-400')
                      }`}
                    >
                      <Clock className="h-3 w-3 flex-shrink-0" />
                      <span className="flex-1 truncate pr-6">{chat.title}</span>
                    </button>
                    <button 
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (user && confirm('Delete this session?')) {
                          try {
                            const chatDocRef = doc(db, 'users', user.uid, 'chats', chat.id);
                            await setDoc(chatDocRef, { deleted: true }, { merge: true });
                            if (currentChatId === chat.id) {
                              setCurrentChatId(null);
                              setMessages([]);
                            }
                          } catch (error) {
                            handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/chats/${chat.id}`);
                          }
                        }
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 hover:text-red-500"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {user && chats.length === 0 && (
                  <p className="text-[10px] text-center text-gray-500 mt-4 italic">No sessions found</p>
                )}
                {!user && (
                  <p className="text-[10px] text-center text-gray-500 mt-4 italic">Log in to sync history</p>
                )}
              </div>

              <div className="h-px bg-gray-200 opacity-20 my-4" />

              <h2 className="text-[10px] uppercase tracking-widest text-gray-500 font-bold px-2">Identity</h2>
              {user ? (
                <button 
                  onClick={() => signOut(auth)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all text-xs font-medium ${isLight ? 'hover:bg-[#F1F3F5] text-gray-700' : 'hover:bg-[#2D3036] text-gray-400 hover:text-white'}`}
                >
                  <LogOut className="h-4 w-4" /> Logout from Cloud
                </button>
              ) : (
                <button 
                  onClick={signInWithGoogle}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all text-xs font-medium ${isLight ? 'hover:bg-[#F1F3F5] text-gray-700' : 'hover:bg-[#2D3036] text-gray-400 hover:text-white'}`}
                >
                  <UserIcon className="h-4 w-4" /> Google Secure Login
                </button>
              )}
            </div>
            
            <button 
              onClick={() => setIsLeftMenuOpen(false)}
              className={`mt-auto w-full p-2 rounded border text-[10px] uppercase tracking-widest font-bold transition-all ${isLight ? 'border-[#E9ECEF] text-gray-500 hover:bg-[#F1F3F5]' : 'border-[#2D3036] text-gray-500 hover:text-white'}`}
            >
              Close
            </button>
          </motion.div>
        )}

        {isRightMenuOpen && (
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className={`absolute inset-y-0 right-0 w-72 z-50 p-6 flex flex-col border-l ${isLight ? 'bg-white border-[#E9ECEF]' : 'bg-[#1C1E22] border-[#2D3036]'}`}
          >
            <h2 className="text-[10px] font-mono uppercase tracking-[0.2em] text-gray-500 mb-6 px-1 font-bold">Session Controls</h2>
            <div className="space-y-3">
              <button 
                onClick={bulkCopy}
                className={`w-full flex items-center gap-3 p-2 rounded transition-all text-sm font-medium ${isLight ? 'hover:bg-[#E9ECEF] text-gray-700' : 'hover:bg-[#2D3036] text-gray-400 hover:text-white'}`}
              >
                <ClipboardCopy className="h-4 w-4" /> [📋] Bulk Copy Content
              </button>
              <button className={`w-full flex items-center gap-3 p-2 rounded transition-all text-sm font-medium ${isLight ? 'hover:bg-[#E9ECEF] text-gray-700' : 'hover:bg-[#2D3036] text-gray-400 hover:text-white'}`}>
                <Volume2 className="h-4 w-4" /> [🔊] Text-to-Speech (TTS)
              </button>
              <button 
                onClick={() => { setIsRightMenuOpen(false); setIsApiSettingsOpen(true); }}
                className={`w-full flex items-center gap-3 p-2 rounded transition-all text-sm font-medium ${isLight ? 'hover:bg-[#E9ECEF] text-gray-700' : 'hover:bg-[#2D3036] text-gray-400 hover:text-white'}`}
              >
                <SettingsIcon className="h-4 w-4" /> [⚙️] API Settings
              </button>
              <button 
                onClick={toggleTheme}
                className={`w-full flex items-center gap-3 p-2 rounded transition-all text-sm font-medium ${isLight ? 'hover:bg-[#E9ECEF] text-gray-700' : 'hover:bg-[#2D3036] text-gray-400 hover:text-white'}`}
              >
                {isLight ? (
                  <><Moon className="h-4 w-4" /> [🌗] Active: White Mode</>
                ) : (
                  <><Sun className="h-4 w-4" /> [🌗] Active: Dark Mode</>
                )}
              </button>
              <button 
                onClick={clearCache}
                className={`w-full flex items-center gap-3 p-2 rounded transition-all text-sm font-medium ${isLight ? 'hover:bg-[#E9ECEF] text-gray-700' : 'hover:bg-[#2D3036] text-gray-400 hover:text-white'}`}
              >
                <RefreshCcw className="h-4 w-4" /> [♻️] Clear Session Cache
              </button>
            </div>
            
            <button 
              onClick={() => setIsRightMenuOpen(false)}
              className={`mt-auto w-full p-2 rounded border text-[10px] uppercase tracking-widest font-bold transition-all ${isLight ? 'border-[#E9ECEF] text-gray-500 hover:bg-[#F1F3F5]' : 'border-[#2D3036] text-gray-500 hover:text-white'}`}
            >
              Close
            </button>
          </motion.div>
        )}

        {(isLeftMenuOpen || isRightMenuOpen || isApiSettingsOpen) && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => { setIsLeftMenuOpen(false); setIsRightMenuOpen(false); setIsApiSettingsOpen(false); }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm z-40"
          />
        )}
      </AnimatePresence>

      {/* API Key Modal */}
      <AnimatePresence>
        {isApiSettingsOpen && (
          <div className="absolute inset-0 flex items-center justify-center z-50 p-6 pointer-events-none">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={`w-full max-w-sm rounded-xl border p-6 shadow-2xl pointer-events-auto ${isLight ? 'bg-white border-[#E9ECEF]' : 'bg-[#1C1E22] border-[#2D3036]'}`}
            >
              <div className="flex items-center gap-3 mb-6">
                <SettingsIcon className="h-5 w-5 text-elx-green" />
                <h3 className="text-sm font-bold uppercase tracking-widest">API Configuration</h3>
              </div>
              
              <p className="text-[11px] mb-4 text-gray-500 uppercase tracking-wider">Storage variable: [USER_CORE_KEY]</p>
              
              <div className="space-y-4">
                <input
                  type="password"
                  value={tempApiKey}
                  onChange={(e) => setTempApiKey(e.target.value)}
                  placeholder="Paste your API Key here..."
                  className={`w-full p-4 rounded text-xs font-mono border focus:ring-0 transition-all ${isLight ? 'bg-[#F1F3F5] border-[#E9ECEF] focus:border-elx-green/50 text-black' : 'bg-[#151619] border-[#2D3036] focus:border-elx-green/40 text-white'}`}
                />
                
                <div className="flex gap-2">
                  <button 
                    onClick={() => setIsApiSettingsOpen(false)}
                    className={`flex-1 p-3 rounded text-[10px] font-bold uppercase tracking-widest border transition-all ${isLight ? 'border-[#E9ECEF] text-gray-500 hover:bg-[#F1F3F5]' : 'border-[#2D3036] text-gray-500 hover:text-white'}`}
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleUpdateApiKey}
                    className="flex-1 p-3 rounded text-[10px] font-bold uppercase tracking-widest bg-elx-green text-hardware-bg hover:opacity-90 transition-all shadow-[0_0_10px_rgba(57,255,20,0.3)]"
                  >
                    Set Key
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className={`flex h-16 items-center justify-between border-b px-4 z-10 transition-colors ${isLight ? 'bg-white border-[#E9ECEF]' : 'bg-[#1C1E22] border-[#2D3036]'}`}>
        <button 
          onClick={() => setIsLeftMenuOpen(true)}
          className={`p-2 rounded transition-all flex items-center gap-2 ${isLight ? 'text-gray-400 hover:bg-gray-100' : 'text-elx-green hover:bg-elx-green/10'}`}
          title="Chat History"
        >
          <Clock className="h-6 w-6" />
        </button>

        <div className="flex flex-col items-center flex-1">
          <h1 className="font-mono text-2xl font-bold tracking-tighter text-elx-green [text-shadow:0_0_10px_rgba(57,255,20,0.5)]">ELX</h1>
        </div>
        
        <div className="flex items-center gap-1">
          <button 
            onClick={() => setIsRightMenuOpen(true)}
            className={`p-2 rounded transition-all ${isLight ? 'text-gray-400 hover:bg-gray-100' : 'text-elx-green hover:bg-elx-green/10'}`}
          >
            <MoreVertical className="h-6 w-6" />
          </button>
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden relative">
        {/* Chat Area */}
        <div className="flex flex-1 flex-col relative">
          <div className={`flex-1 overflow-y-auto px-4 py-8 space-y-6 scrollbar-none transition-colors ${isLight ? 'bg-[#F8F9FA]' : 'bg-[#151619]'}`}>
            {messages.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center text-center opacity-30">
                <div className="h-16 w-16 mb-4 flex items-center justify-center">
                  <Zap className="h-8 w-8 text-elx-green [filter:drop-shadow(0_0_5px_#39FF14)]" />
                </div>
                <h3 className={`text-lg font-mono tracking-widest uppercase font-bold ${isLight ? 'text-gray-400' : 'text-elx-green'}`}>ELX CORE</h3>
              </div>
            )}

            {messages.map((msg, mIdx) => (
              <motion.div 
                key={msg.id ? `msg-${msg.id}` : `m-${mIdx}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[90%] rounded-xl flex flex-col ${
                  msg.role === 'user' 
                    ? 'p-2' 
                    : 'space-y-1'
                }`}>
                      <div className={`text-sm ${
                    msg.role === 'model' 
                      ? `${isLight ? 'bg-white border-[#E9ECEF]' : 'bg-[#1C1E22] border-[#2D3036]'} p-4 rounded-xl border` 
                      : `${isLight ? 'bg-white border-elx-green/40 shadow-sm' : 'bg-elx-green/10 border-elx-green/30'} p-3 rounded-xl border`
                  }`}>
                    {msg.parts.map((part, pIdx) => (
                      <React.Fragment key={pIdx}>
                        {part.text && (
                          <div className={`markdown-body font-sans leading-relaxed ${isLight && msg.role === 'model' ? 'text-[#343A40]' : ''}`}>
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {part.text}
                            </ReactMarkdown>
                          </div>
                        )}
                        {part.inlineData && (
                          <div className={`mt-3 overflow-hidden rounded border transition-colors ${isLight ? 'border-[#E9ECEF]' : 'border-[#2D3036]'}`}>
                            <img 
                              src={`data:${part.inlineData.mimeType};base64,${part.inlineData.data}`} 
                              alt="Visual data" 
                              className="max-h-64 w-auto object-contain"
                            />
                          </div>
                        )}
                      </React.Fragment>
                    ))}
                  </div>

                  {msg.role === 'model' && (
                    <div className="flex items-center gap-5 px-2 py-1">
                      <button 
                        onClick={() => copyToClipboard(msg.parts[0].text || '')}
                        className={`text-gray-500 hover:text-elx-green transition-colors`}
                        title="Copy"
                      >
                        <ClipboardCopy className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={() => speakText(msg.parts[0].text || '')}
                        className={`text-gray-500 hover:text-elx-green transition-colors`}
                        title="TTS"
                      >
                        <Volume2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}

            {isTyping && (
              <div className="flex justify-start">
                <div className="px-4 py-2 flex gap-1 items-center opacity-50">
                  <div className="w-1.5 h-1.5 rounded-full bg-elx-green animate-pulse" />
                  <div className="w-1.5 h-1.5 rounded-full bg-elx-green animate-pulse delay-75" />
                  <div className="w-1.5 h-1.5 rounded-full bg-elx-green animate-pulse delay-150" />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input Bar */}
          <div className={`p-4 transition-colors ${isLight ? 'bg-white border-t border-[#E9ECEF]' : 'bg-[#151619]'}`}>
            <div className="max-w-4xl mx-auto flex flex-col gap-2">
              {selectedImage && (
                <div className={`relative inline-block self-start p-1 rounded border overflow-hidden ${isLight ? 'bg-[#F1F3F5] border-elx-green/50' : 'bg-[#1C1E22] border-elx-green/30'}`}>
                  <img src={selectedImage.url} className="h-12 w-auto rounded shadow-sm" />
                  <button 
                    onClick={() => setSelectedImage(null)}
                    className="absolute -top-1 -right-1 p-0.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-sm"
                  >
                    <Trash2 className="h-2 w-2" />
                  </button>
                </div>
              )}

              <div className={`flex items-center rounded px-2 transition-all border ${isLight ? 'bg-[#F1F3F5] border-[#E9ECEF] focus-within:border-elx-green/50' : 'bg-[#1C1E22] border-[#2D3036] focus-within:border-elx-green/40'}`}>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="p-3 text-gray-500 hover:text-elx-green"
                >
                  <Plus className="h-6 w-6" />
                </button>
                <input 
                  type="file" 
                  hidden 
                  ref={fileInputRef} 
                  accept="image/*" 
                  onChange={handleImageUpload} 
                />
                
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Ask ELX anything..."
                  className={`flex-1 bg-transparent border-none focus:ring-0 py-4 px-2 text-sm resize-none scrollbar-none min-h-[56px] max-h-32 ${isLight ? 'text-[#343A40]' : 'text-white'}`}
                />

                <button 
                  onClick={handleSend}
                  disabled={!inputText.trim() && !selectedImage}
                  className={`p-3 transition-colors ${
                    (inputText.trim() || selectedImage) 
                      ? 'text-elx-green [filter:drop-shadow(0_0_3px_#39FF14)]' 
                      : 'text-gray-700 opacity-30'
                  }`}
                >
                  <Zap className="h-7 w-7" />
                </button>
              </div>
              <p className="text-[9px] font-mono text-gray-500 text-center uppercase tracking-widest opacity-60">Android Core Precision • [API_VAR] ACTIVE</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
