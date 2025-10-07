'use client';

import { useState } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('https://business-closure-prediction-rag.onrender.com/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input })
      });

      const data = await response.json();
      const assistantMessage: Message = { 
        role: 'assistant', 
        content: data.response || data.error 
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: Message = { 
        role: 'assistant', 
        content: '오류가 발생했습니다. 다시 시도해주세요.' 
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#B2C7D9]">
      {/* 헤더 */}
      <header className="bg-[#A8C5DD] px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#FFE082] rounded-full flex items-center justify-center text-xl">
            🤖
          </div>
          <div>
            <h1 className="text-gray-800 font-semibold">폐업 위기 예측 봇</h1>
            <p className="text-xs text-gray-600">AI 상담사</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button className="text-gray-700 text-xl">☰</button>
        </div>
      </header>

      {/* 메시지 영역 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 bg-[#FFE082] rounded-full flex items-center justify-center text-sm mr-2 flex-shrink-0">
                🤖
              </div>
            )}
            <div
              className={`max-w-[70%] px-4 py-2 rounded-2xl shadow-sm ${
                msg.role === 'user'
                  ? 'bg-[#FEE500] text-gray-800'
                  : 'bg-white text-gray-800'
              }`}
            >
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="w-8 h-8 bg-[#FFE082] rounded-full flex items-center justify-center text-sm mr-2">
              🤖
            </div>
            <div className="bg-white px-4 py-2 rounded-2xl shadow-sm">
              <p className="text-gray-500 text-sm">답변 작성 중...</p>
            </div>
          </div>
        )}
      </div>

      {/* 입력 영역 */}
      <div className="bg-white px-4 py-3 shadow-lg border-t border-gray-200">
        <div className="flex items-center gap-2">
          <button className="text-gray-500 text-xl flex-shrink-0">+</button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && !loading && sendMessage()}
            placeholder="메시지를 입력하세요"
            className="flex-1 px-3 py-2 bg-gray-100 rounded-full focus:outline-none focus:ring-2 focus:ring-[#FEE500] text-sm"
            disabled={loading}
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="w-8 h-8 bg-[#FEE500] rounded-full flex items-center justify-center disabled:bg-gray-300 disabled:cursor-not-allowed flex-shrink-0"
          >
            <span className="text-gray-800 text-sm">↑</span>
          </button>
        </div>
      </div>
    </div>
  );
}
