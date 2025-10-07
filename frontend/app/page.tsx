'use client';

import { useState, useEffect } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Options {
  regions: string[];
  industries: string[];
  districts: string[];
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  
  // 예측 모델 상태
  const [options, setOptions] = useState<Options | null>(null);
  const [region, setRegion] = useState('');
  const [industry, setIndustry] = useState('');
  const [district, setDistrict] = useState('');
  const [prediction, setPrediction] = useState<any>(null);
  const [predicting, setPredicting] = useState(false);

  // 옵션 로드
  useEffect(() => {
    fetch('https://business-closure-prediction-rag.onrender.com/options')
      .then(res => res.json())
      .then(data => setOptions(data))
      .catch(err => console.error('옵션 로드 실패:', err));
  }, []);

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

  const handlePredict = async () => {
    if (!region || !industry || !district) {
      alert('모든 항목을 선택해주세요');
      return;
    }

    setPredicting(true);
    setPrediction(null);

    try {
      const response = await fetch('https://business-closure-prediction-rag.onrender.com/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ region, industry, district })
      });

      const data = await response.json();
      if (data.error) {
        alert(data.error);
      } else {
        setPrediction(data);
      }
    } catch (error) {
      alert('예측 중 오류가 발생했습니다');
    } finally {
      setPredicting(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#B2C7D9]">
      {/* 사이드바 */}
      <div className={`${showSidebar ? 'w-80' : 'w-0'} transition-all duration-300 bg-white overflow-hidden`}>
        <div className="p-4 h-full overflow-y-auto">
          <h2 className="text-xl font-bold mb-4 text-gray-800">폐업 확률 예측</h2>
          
          {options ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">가맹점 지역</label>
                <select 
                  value={region} 
                  onChange={(e) => setRegion(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FEE500]"
                >
                  <option value="">선택하세요</option>
                  {options.regions.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">업종</label>
                <select 
                  value={industry} 
                  onChange={(e) => setIndustry(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FEE500]"
                >
                  <option value="">선택하세요</option>
                  {options.industries.map(i => (
                    <option key={i} value={i}>{i}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">상권</label>
                <select 
                  value={district} 
                  onChange={(e) => setDistrict(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FEE500]"
                >
                  <option value="">선택하세요</option>
                  {options.districts.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <button
                onClick={handlePredict}
                disabled={predicting}
                className="w-full bg-[#FEE500] text-gray-800 py-3 rounded-lg font-semibold hover:bg-[#FDD835] disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {predicting ? '예측 중...' : '폐업 확률 예측'}
              </button>

              {prediction && (
                <div className="mt-4 p-4 bg-gray-100 rounded-lg">
                  <h3 className="font-bold text-gray-800 mb-2">예측 결과</h3>
                  <p className="text-2xl font-bold text-red-600 mb-1">
                    {prediction.closure_probability.toFixed(2)}%
                  </p>
                  <p className="text-sm text-gray-600">
                    위험도: <span className="font-semibold">{prediction.risk_level}</span>
                  </p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-500">옵션 로딩 중...</p>
          )}
        </div>
      </div>

      {/* 메인 채팅 영역 */}
      <div className="flex-1 flex flex-col">
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
          <button 
            onClick={() => setShowSidebar(!showSidebar)}
            className="px-4 py-2 bg-[#FEE500] rounded-lg text-sm font-semibold hover:bg-[#FDD835]"
          >
            {showSidebar ? '닫기' : '예측 모델'}
          </button>
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
    </div>
  );
}
