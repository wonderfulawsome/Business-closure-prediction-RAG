'use client';

import { useState, useEffect } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Options {
  [key: string]: string[];
}

// 모델이 사용하는 모든 변수들의 초기 상태를 정의합니다.
const initialFormState = {
  '가맹점운영개월수구간': '',
  '매출금액구간': '',
  '매출건수구간': '',
  '유니크고객수구간': '',
  '객단가구간': '',
  '가맹점지역': '',
  '업종': '',
  '배달매출금액비율': 0,
  '동일업종매출금액비율': 0,
  '동일업종매출건수비율': 0,
  '동일업종내매출순위비율': 0,
  '동일상권내매출순위비율': 0,
  '동일업종내해지가맹점비중': 0,
  '동일상권내해지가맹점비중': 0,
  '남성20대이하고객비중': 0,
  '남성30대고객비중': 0,
  '남성40대고객비중': 0,
  '남성50대고객비중': 0,
  '남성60대이상고객비중': 0,
  '여성20대이하고객비중': 0,
  '여성30대고객비중': 0,
  '여성40대고객비중': 0,
  '여성50대고객비중': 0,
  '여성60대이상고객비중': 0,
  '재방문고객비중': 0,
  '신규고객비중': 0,
  '거주이용고객비율': 0,
  '직장이용고객비율': 0,
  '유동인구이용고객비율': 0,
};


export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  
  const [options, setOptions] = useState<Options | null>(null);
  const [optionsError, setOptionsError] = useState<string>('');
  const [formData, setFormData] = useState(initialFormState);
  const [prediction, setPrediction] = useState<any>(null);
  const [predicting, setPredicting] = useState(false);

  useEffect(() => {
    fetch('https://business-closure-prediction-rag.onrender.com/options')
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          setOptionsError(data.error);
        } else {
          setOptions(data);
        }
      })
      .catch(err => {
        console.error('옵션 로드 실패:', err);
        setOptionsError('옵션을 불러올 수 없습니다');
      });
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

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
    // 모든 범주형 변수가 선택되었는지 확인
    const categoricalFields = Object.keys(options || {});
    for (const field of categoricalFields) {
      if (!formData[field]) {
        alert(`'${field}' 항목을 선택해주세요.`);
        return;
      }
    }
  
    setPredicting(true);
    setPrediction(null);
  
    try {
      const response = await fetch('https://business-closure-prediction-rag.onrender.com/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
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

  // 모든 변수에 대한 입력 폼을 동적으로 생성하는 함수
  const renderForm = () => {
    if (optionsError) {
      return <div className="text-red-600 text-sm">{optionsError}</div>;
    }
    if (!options) {
      return <p className="text-gray-500">옵션 로딩 중...</p>;
    }

    const categoricalFeatures = Object.keys(options);
    const numericalFeatures = Object.keys(initialFormState).filter(key => !categoricalFeatures.includes(key));

    return (
      <div className="space-y-4">
        {/* 범주형 변수들은 드롭다운으로 표시 */}
        {categoricalFeatures.map(key => (
          <div key={key}>
            <label className="block text-sm font-medium text-gray-700 mb-2">{key}</label>
            <select
              name={key}
              value={formData[key]}
              onChange={handleInputChange}
              className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FEE500]"
            >
              <option value="">선택하세요</option>
              {options[key]?.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
        ))}
        {/* 수치형 변수들은 숫자 입력 필드로 표시 */}
        {numericalFeatures.map(key => (
          <div key={key}>
            <label className="block text-sm font-medium text-gray-700 mb-2">{key}</label>
            <input
              type="number"
              name={key}
              value={formData[key]}
              onChange={handleInputChange}
              className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FEE500]"
            />
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-[#B2C7D9]">
      <div className={`${showSidebar ? 'w-80' : 'w-0'} transition-all duration-300 bg-white overflow-hidden`}>
        <div className="p-4 h-full overflow-y-auto">
          <h2 className="text-xl font-bold mb-4 text-gray-800">폐업 확률 예측</h2>
          
          {renderForm()}

          <button
            onClick={handlePredict}
            disabled={predicting}
            className="w-full mt-4 bg-[#FEE500] text-gray-800 py-3 rounded-lg font-semibold hover:bg-[#FDD835] disabled:bg-gray-300 disabled:cursor-not-allowed"
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
      </div>

      <div className="flex-1 flex flex-col">
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
