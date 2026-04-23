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
  User,
  ClipboardCopy,
  Sun,
  Moon,
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { geminiService, Message } from './services/gemini.ts';

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{ url: string; data: string; mimeType: string } | null>(null);
  const [isLeftMenuOpen, setIsLeftMenuOpen] = useState(false);
  const [isRightMenuOpen, setIsRightMenuOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      role: 'user',
      parts: [
        { text: currentInput },
        ...(currentImage ? [{ inlineData: { mimeType: currentImage.mimeType, data: currentImage.data } }] : [])
      ]
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setSelectedImage(null);
    setIsTyping(true);

    try {
      const response = await geminiService.chat(
        messages, 
        currentInput, 
        currentImage ? { mimeType: currentImage.mimeType, data: currentImage.data } : undefined
      );
      
      const modelMessage: Message = {
        role: 'model',
        parts: [{ text: response }]
      };
      setMessages(prev => [...prev, modelMessage]);
    } catch (error) {
      console.error('ELX Error:', error);
      const errorMessage: Message = {
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

  const speakText = (text: string) => {
    // Aggressive cleanup of markdown for TTS
    const cleanText = text.replace(/\[COPY\]|\[SPEECH\]|#|\*|_|`|\[|\]/g, '').trim();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
  };

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
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
            <div className={`flex items-center gap-3 p-3 rounded-lg border mb-8 ${isLight ? 'bg-[#F1F3F5] border-[#E9ECEF]' : 'bg-[#151619] border-[#2D3036]'}`}>
              <div className="h-10 w-10 rounded-full bg-elx-green/20 flex items-center justify-center border border-elx-green/40 font-bold text-elx-green">
                ZI
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-bold truncate ${isLight ? 'text-black' : 'text-white'}`}>zisancomputer2.1</p>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest leading-none">Google Secured</p>
              </div>
            </div>
            
            <div className="space-y-4">
              <h2 className="text-[10px] uppercase tracking-widest text-gray-500 font-bold px-2">Account & Identity</h2>
              <button className={`w-full flex items-center gap-3 p-2 rounded transition-all text-sm font-medium ${isLight ? 'hover:bg-[#E9ECEF] text-gray-700' : 'hover:bg-[#2D3036] text-gray-400 hover:text-white'}`}>
                <LogOut className="h-4 w-4" /> Google Logout
              </button>
              
              <div className="h-px bg-gray-200 mt-2 mb-2 opacity-20" />
              
              <button className={`w-full flex items-center gap-3 p-2 rounded transition-all text-sm font-medium ${isLight ? 'hover:bg-[#E9ECEF] text-gray-700' : 'hover:bg-[#2D3036] text-gray-400 hover:text-white'}`}>
                <Clock className="h-4 w-4 text-elx-green" /> History View
              </button>
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
              <button className={`w-full flex items-center gap-3 p-2 rounded transition-all text-sm font-medium ${isLight ? 'hover:bg-[#E9ECEF] text-gray-700' : 'hover:bg-[#2D3036] text-gray-400 hover:text-white'}`}>
                <Volume2 className="h-4 w-4" /> Text-to-Speech (TTS)
              </button>
              <button className={`w-full flex items-center gap-3 p-2 rounded transition-all text-sm font-medium ${isLight ? 'hover:bg-[#E9ECEF] text-gray-700' : 'hover:bg-[#2D3036] text-gray-400 hover:text-white'}`}>
                <ClipboardCopy className="h-4 w-4" /> Bulk Copy Content
              </button>
              <button 
                onClick={clearCache}
                className={`w-full flex items-center gap-3 p-2 rounded transition-all text-sm font-medium ${isLight ? 'hover:bg-[#E9ECEF] text-gray-700' : 'hover:bg-[#2D3036] text-gray-400 hover:text-white'}`}
              >
                <RefreshCcw className="h-4 w-4" /> Clear Session Cache
              </button>
              
              <div className="h-px bg-gray-200 my-4 opacity-20" />
              
              <button 
                onClick={toggleTheme}
                className={`w-full flex items-center gap-3 p-2 rounded transition-all text-sm font-medium ${isLight ? 'hover:bg-[#E9ECEF] text-gray-700' : 'hover:bg-[#2D3036] text-gray-400 hover:text-white'}`}>
                {isLight ? (
                  <><Moon className="h-4 w-4" /> Active: White Mode</>
                ) : (
                  <><Sun className="h-4 w-4" /> Active: Dark Mode</>
                )}
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

        {(isLeftMenuOpen || isRightMenuOpen) && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => { setIsLeftMenuOpen(false); setIsRightMenuOpen(false); }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm z-40"
          />
        )}
      </AnimatePresence>

      {/* Header */}
      <header className={`flex h-16 items-center justify-between border-b px-4 z-10 transition-colors ${isLight ? 'bg-white border-[#E9ECEF]' : 'bg-[#1C1E22] border-[#2D3036]'}`}>
        <button 
          onClick={() => setIsLeftMenuOpen(true)}
          className={`p-2 rounded transition-all ${isLight ? 'text-gray-400 hover:bg-gray-100' : 'text-elx-green hover:bg-elx-green/10'}`}
        >
          <MoreHorizontal className="h-6 w-6" />
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

            {messages.map((msg, idx) => (
              <motion.div 
                key={idx}
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
                          <div className={`font-sans whitespace-pre-wrap leading-relaxed ${isLight && msg.role === 'model' ? 'text-[#343A40]' : ''}`}>
                            {part.text}
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
                        <Copy className="h-4 w-4" />
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
                  placeholder="Enter technical query or command..."
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
              <p className="text-[9px] font-mono text-gray-500 text-center uppercase tracking-widest opacity-60">Android Core Precision • v3.0</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
