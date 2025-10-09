'use client';

import { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, TrendingDown } from 'lucide-react';

const API_URL = 'https://business-closure-prediction-rag.onrender.com';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface OptionsData {
  options: { [key: string]: string[] };
  feature_cols: string[];
  error?: string;
}

interface FormData {
  [key: string]: string | number;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [optionsData, setOptionsData] = useState<OptionsData | null>(null);
  const [formData, setFormData] = useState<FormData>({});
  const [prediction, setPrediction] = useState<any>(null);
  const [isPredicting, setIsPredicting] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/options`)
      .then(res => res.json())
      .then((data: OptionsData) => {
        if (data.error || !data.options || !data.feature_cols) {
          console.error(data.error || '유효하지 않은 데이터');
        } else {
          setOptionsData(data);
          const initialForm: FormData = {};
          data.feature_cols.forEach(key => {
            initialForm[key] = data.options[key] ? '' : 0;
          });
          setFormData(initialForm);
        }
      })
      .catch(err => console.error('옵션 로드 실패:', err));
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input }),
      });

      const data = await response.json();
      const assistantMessage: Message = {
        role: 'assistant',
        content: data.response || data.error || '응답을 받을 수 없습니다.',
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: Message = {
        role: 'assistant',
        content: '죄송합니다. 오류가 발생했습니다.',
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev: FormData) => ({
      ...prev,
      [name]: (e.target as HTMLInputElement).type === 'number' ? parseFloat(value) || 0 : value
    }));
  };

  const handlePredict = async () => {
    if (!optionsData) return;

    for (const field of optionsData.feature_cols) {
      const value = formData[field];
      if (value === '' || value === null || value === undefined) {
        alert(`'${field}' 항목을 선택 또는 입력해주세요.`);
        return;
      }
    }

    setIsPredicting(true);
    setPrediction(null);

    try {
      const response = await fetch(`${API_URL}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await response.json();
      if (data.error) alert(data.error);
      else setPrediction(data);
    } catch (error) {
      alert('예측 중 오류가 발생했습니다.');
    } finally {
      setIsPredicting(false);
    }
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* 사이드바 */}
      <div className="w-80 bg-slate-800/50 backdrop-blur-xl border-r border-purple-500/20 p-6 overflow-y-auto">
        <div className="flex items-center gap-3 mb-8">
          <TrendingDown className="w-8 h-8 text-purple-400" />
          <h1 className="text-2xl font-bold text-white">폐업 확률 예측</h1>
        </div>

        {!optionsData ? (
          <div className="text-white">로딩 중...</div>
        ) : (
          <div className="space-y-4">
            {optionsData.feature_cols.map(key => (
              <div key={key}>
                <label className="block text-sm font-medium text-purple-200 mb-2">
                  {key}
                </label>
                {optionsData.options[key] ? (
                  <select
                    name={key}
                    value={formData[key] || ''}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 bg-slate-700/50 border border-purple-500/30 rounded-lg text-white focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">선택하세요</option>
                    {optionsData.options[key].map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="number"
                    name={key}
                    value={formData[key] || 0}
                    onChange={handleInputChange}
                    step="0.1"
                    className="w-full px-4 py-2 bg-slate-700/50 border border-purple-500/30 rounded-lg text-white focus:ring-2 focus:ring-purple-500"
                  />
                )}
              </div>
            ))}

            <button
              onClick={handlePredict}
              disabled={isPredicting}
              className="w-full mt-4 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg disabled:opacity-50"
            >
              {isPredicting ? '예측 중...' : '폐업 확률 예측'}
            </button>

            {prediction && (
              <div className="mt-6 p-4 bg-slate-700/50 rounded-lg border border-purple-500/30">
                {prediction.error ? (
                  <p className="text-red-400">{prediction.error}</p>
                ) : (
                  <div className="space-y-2">
                    <div className="text-purple-200 text-sm">예측 결과</div>
                    <div className="text-3xl font-bold text-white">
                      {prediction.closure_probability.toFixed(2)}%
                    </div>
                    <div
                      className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
                        prediction.risk_level === '높음'
                          ? 'bg-red-500/20 text-red-300'
                          : prediction.risk_level === '중간'
                          ? 'bg-yellow-500/20 text-yellow-300'
                          : 'bg-green-500/20 text-green-300'
                      }`}
                    >
                      위험도: {prediction.risk_level}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 채팅 영역 */}
      <div className="flex-1 flex flex-col">
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-purple-300 mt-20">
              <Bot className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-xl">가맹점 폐업에 대해 무엇이든 물어보세요</p>
            </div>
          )}

          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex gap-3 ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {message.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-5 h-5 text-white" />
                </div>
              )}
              <div
                className={`max-w-2xl p-4 rounded-2xl ${
                  message.role === 'user'
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                    : 'bg-slate-800/50 backdrop-blur-xl text-purple-100 border border-purple-500/20'
                }`}
              >
                {message.content}
              </div>
              {message.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-pink-600 flex items-center justify-center flex-shrink-0">
                  <User className="w-5 h-5 text-white" />
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div className="bg-slate-800/50 backdrop-blur-xl p-4 rounded-2xl border border-purple-500/20">
                <div className="flex gap-2">
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce delay-100" />
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce delay-200" />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSubmit} className="p-6 border-t border-purple-500/20">
          <div className="flex gap-4">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="메시지를 입력하세요..."
              className="flex-1 px-6 py-3 bg-slate-800/50 backdrop-blur-xl border border-purple-500/30 rounded-full text-white placeholder-purple-300/50 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            <button
              type="submit"
              disabled={isLoading}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full font-semibold hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg hover:shadow-purple-500/50 disabled:opacity-50 flex items-center gap-2"
            >
              <Send className="w-5 h-5" />
              전송
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
