'use client';

import { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, TrendingDown, MessageSquare, Home, ChevronLeft, ChevronRight, BarChart3 } from 'lucide-react';

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

interface FormDataType {
  [key: string]: string | number;
}

type ViewType = 'home' | 'chat' | 'sales-prediction';

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [optionsData, setOptionsData] = useState<OptionsData | null>(null);
  const [formData, setFormData] = useState<FormDataType>({});
  const [prediction, setPrediction] = useState<any>(null);
  const [isPredicting, setIsPredicting] = useState(false);
  const [currentView, setCurrentView] = useState<ViewType>('home');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/options`)
      .then(res => res.json())
      .then((data: OptionsData) => {
        if (data.error || !data.options || !data.feature_cols) {
          console.error(data.error || '유효하지 않은 데이터');
        } else {
          setOptionsData(data);
          const initialForm: FormDataType = {};
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
      const errorMessage: Message = { role: 'assistant', content: '죄송합니다. 오류가 발생했습니다.' };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>): void => {
    const { name, value } = e.target;
    setFormData((prev: FormDataType): FormDataType => ({
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

  const menuItems = [
    { id: 'home' as ViewType, icon: Home, label: '홈', color: 'text-indigo-200' },
    { id: 'chat' as ViewType, icon: MessageSquare, label: '챗봇', color: 'text-indigo-200' },
    { id: 'sales-prediction' as ViewType, icon: BarChart3, label: '매출 데이터 예측', color: 'text-indigo-200' },
  ];

  return (
    <div className="flex h-screen bg-gray-50">
      {/* 사이드바 */}
      <div className={`${sidebarCollapsed ? 'w-20' : 'w-64'} bg-[#5B6EAF] transition-all duration-300 flex flex-col shadow-lg`}>
        {/* 로고 */}
        <div className="p-6 border-b border-indigo-400/30 flex items-center justify-between">
          {!sidebarCollapsed && (
            <div className="flex items-center gap-2">
              <TrendingDown className="w-8 h-8 text-white" />
              <span className="text-xl font-bold text-white">폐업 예측</span>
            </div>
          )}
          {sidebarCollapsed && <TrendingDown className="w-8 h-8 text-white mx-auto" />}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-2 hover:bg-indigo-500/30 rounded-lg transition-colors"
          >
            {sidebarCollapsed ? (
              <ChevronRight className="w-5 h-5 text-white" />
            ) : (
              <ChevronLeft className="w-5 h-5 text-white" />
            )}
          </button>
        </div>

        {/* 메뉴 */}
        <nav className="flex-1 p-4 space-y-2">
          {menuItems.map(item => (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                currentView === item.id
                  ? 'bg-white/20 text-white shadow-md'
                  : 'text-indigo-100 hover:bg-white/10'
              }`}
            >
              <item.icon className={`w-5 h-5 ${currentView === item.id ? 'text-white' : 'text-indigo-200'}`} />
              {!sidebarCollapsed && <span className="font-medium">{item.label}</span>}
            </button>
          ))}
        </nav>
      </div>

      {/* 메인 컨텐츠 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 홈 화면 */}
        {currentView === 'home' && (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center space-y-6 max-w-2xl">
              <TrendingDown className="w-24 h-24 text-[#5B6EAF] mx-auto" />
              <h1 className="text-4xl font-bold text-gray-800">가맹점 폐업 위기 예측 시스템</h1>
              <p className="text-xl text-gray-600">
                RAG 기반 AI 챗봇과 머신러닝 모델을 활용한 폐업 위험도 분석
              </p>
              <div className="grid grid-cols-2 gap-4 mt-8">
                <button
                  onClick={() => setCurrentView('chat')}
                  className="p-6 bg-white border border-gray-200 rounded-xl hover:shadow-lg transition-all"
                >
                  <MessageSquare className="w-12 h-12 text-[#5B6EAF] mx-auto mb-3" />
                  <h3 className="text-gray-800 font-semibold mb-2">AI 챗봇</h3>
                  <p className="text-sm text-gray-600">폐업 관련 질문하기</p>
                </button>
                <button
                  onClick={() => setCurrentView('sales-prediction')}
                  className="p-6 bg-white border border-gray-200 rounded-xl hover:shadow-lg transition-all"
                >
                  <BarChart3 className="w-12 h-12 text-[#7C88E5] mx-auto mb-3" />
                  <h3 className="text-gray-800 font-semibold mb-2">폐업 확률 예측</h3>
                  <p className="text-sm text-gray-600">매출 데이터 분석</p>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 챗봇 화면 */}
        {currentView === 'chat' && (
          <div className="flex-1 flex flex-col bg-white">
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.length === 0 && (
                <div className="text-center text-gray-500 mt-20">
                  <Bot className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p className="text-xl">가맹점 폐업에 대해 무엇이든 물어보세요</p>
                </div>
              )}
              {messages.map((message, index) => (
                <div key={index} className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {message.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-full bg-[#5B6EAF] flex items-center justify-center flex-shrink-0">
                      <Bot className="w-5 h-5 text-white" />
                    </div>
                  )}
                  <div className={`max-w-2xl p-4 rounded-2xl ${
                    message.role === 'user' 
                      ? 'bg-[#7C88E5] text-white' 
                      : 'bg-gray-100 text-gray-800 border border-gray-200'
                  }`}>
                    {message.content}
                  </div>
                  {message.role === 'user' && (
                    <div className="w-8 h-8 rounded-full bg-[#7C88E5] flex items-center justify-center flex-shrink-0">
                      <User className="w-5 h-5 text-white" />
                    </div>
                  )}
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#5B6EAF] flex items-center justify-center">
                    <Bot className="w-5 h-5 text-white" />
                  </div>
                  <div className="bg-gray-100 p-4 rounded-2xl border border-gray-200">
                    <div className="flex gap-2">
                      <div className="w-2 h-2 bg-[#5B6EAF] rounded-full animate-bounce" />
                      <div className="w-2 h-2 bg-[#5B6EAF] rounded-full animate-bounce" style={{animationDelay: '0.1s'}} />
                      <div className="w-2 h-2 bg-[#5B6EAF] rounded-full animate-bounce" style={{animationDelay: '0.2s'}} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
            <form onSubmit={handleSubmit} className="p-6 border-t border-gray-200 bg-white">
              <div className="flex gap-4">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="메시지를 입력하세요..."
                  className="flex-1 px-6 py-3 bg-gray-50 border border-gray-300 rounded-full text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-[#5B6EAF] focus:border-transparent outline-none"
                />
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-6 py-3 bg-[#7C88E5] text-white rounded-full font-semibold hover:bg-[#6B78D4] transition-all shadow-md disabled:opacity-50 flex items-center gap-2"
                >
                  <Send className="w-5 h-5" />
                  전송
                </button>
              </div>
            </form>
          </div>
        )}

        {/* 예측 모델 화면 */}
        {currentView === 'sales-prediction' && (
          <div className="flex-1 overflow-y-auto p-8 bg-white">
            <div className="max-w-4xl mx-auto">
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-800 mb-2">매출 데이터 기반 폐업 확률 예측</h1>
                <p className="text-gray-600">XGBoost 머신러닝 모델을 사용한 정확한 폐업 위험도 분석</p>
              </div>

              {!optionsData ? (
                <div className="text-gray-800 text-center py-12">
                  <div className="animate-spin w-12 h-12 border-4 border-[#5B6EAF] border-t-transparent rounded-full mx-auto mb-4"></div>
                  <p>예측 모델 로딩 중...</p>
                </div>
              ) : (
                <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
                  <div className="grid grid-cols-2 gap-6 mb-8">
                    {optionsData.feature_cols.map(key => (
                      <div key={key}>
                        <label className="block text-sm font-medium text-gray-700 mb-2">{key}</label>
                        {optionsData.options[key] ? (
                          <select
                            name={key}
                            value={formData[key] || ''}
                            onChange={handleInputChange}
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-[#5B6EAF] focus:border-transparent outline-none"
                          >
                            <option value="">선택하세요</option>
                            {optionsData.options[key].map((opt) => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="number"
                            name={key}
                            value={formData[key] || 0}
                            onChange={handleInputChange}
                            step="0.1"
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-[#5B6EAF] focus:border-transparent outline-none"
                          />
                        )}
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={handlePredict}
                    disabled={isPredicting}
                    className="w-full px-6 py-4 bg-[#7C88E5] text-white text-lg rounded-xl font-semibold hover:bg-[#6B78D4] transition-all shadow-md disabled:opacity-50"
                  >
                    {isPredicting ? '예측 중...' : '폐업 확률 예측하기'}
                  </button>

                  {prediction && (
                    <div className="mt-8 p-6 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl border border-indigo-200">
                      {prediction.error ? (
                        <p className="text-red-600 text-center">{prediction.error}</p>
                      ) : (
                        <div className="text-center space-y-4">
                          <div className="text-gray-600 text-sm font-medium">예측 결과</div>
                          <div className="text-6xl font-bold text-gray-800">
                            {prediction.closure_probability.toFixed(2)}%
                          </div>
                          <div className={`inline-block px-6 py-2 rounded-full text-lg font-semibold ${
                            prediction.risk_level === '높음' ? 'bg-red-100 text-red-700 border border-red-300' :
                            prediction.risk_level === '중간' ? 'bg-yellow-100 text-yellow-700 border border-yellow-300' :
                            'bg-green-100 text-green-700 border border-green-300'
                          }`}>
                            위험도: {prediction.risk_level}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
