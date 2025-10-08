'use client';

import { useState, useEffect } from 'react';

// --- 타입 정의 ---
interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface OptionsData {
  options: { [key: string]: string[] };
  feature_cols: string[];
}

// --- 컴포넌트 ---
export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  
  const [optionsData, setOptionsData] = useState<OptionsData | null>(null);
  const [optionsError, setOptionsError] = useState<string>('');
  const [formData, setFormData] = useState<any>({});
  const [prediction, setPrediction] = useState<any>(null);
  const [predicting, setPredicting] = useState(false);

  // 백엔드에서 옵션과 피처 순서 로드
  useEffect(() => {
    fetch('https://business-closure-prediction-rag.onrender.com/options')
      .then(res => {
        if (!res.ok) throw new Error('서버 응답 오류');
        return res.json();
      })
      .then((data: OptionsData) => {
        if (data.error || !data.options || !data.feature_cols) {
          setOptionsError(data.error || '서버에서 유효한 데이터를 받지 못했습니다.');
        } else {
          setOptionsData(data);
          // 피처 목록을 기반으로 폼 초기 상태 설정
          const initialForm: any = {};
          data.feature_cols.forEach(key => {
            initialForm[key] = data.options[key] ? '' : 0; // 범주형은 빈 문자열, 수치형은 0으로 초기화
          });
          setFormData(initialForm);
        }
      })
      .catch(err => {
        console.error('옵션 로드 실패:', err);
        setOptionsError('옵션을 불러올 수 없습니다. 서버 상태를 확인해주세요.');
      });
  }, []);

  // 폼 입력 값 변경 핸들러
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: (e.target as HTMLInputElement).type === 'number' ? parseFloat(value) || 0 : value
    }));
  };

  // 예측 실행 핸들러
  const handlePredict = async () => {
    if (!optionsData) return;

    for (const field of optionsData.feature_cols) {
      if (formData[field] === '') {
        alert(`'${field}' 항목을 선택 또는 입력해주세요.`);
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
      if (data.error) alert(data.error);
      else setPrediction(data);
    } catch (error) {
      alert('예측 중 오류가 발생했습니다.');
    } finally {
      setPredicting(false);
    }
  };

  // 동적 폼 렌더링 함수
  const renderForm = () => {
    if (optionsError) return <div className="text-red-500 text-sm p-2 bg-red-100 rounded">{optionsError}</div>;
    if (!optionsData) return <p className="text-gray-500">예측 모델 로딩 중...</p>;

    const { options, feature_cols } = optionsData;

    return (
      <div className="space-y-4">
        {feature_cols.map(key => (
          <div key={key}>
            <label className="block text-sm font-medium text-gray-700 mb-1">{key}</label>
            {options[key] ? ( // options에 키가 존재하면 범주형 변수
              <select
                name={key}
                value={formData[key] || ''}
                onChange={handleInputChange}
                className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FEE500]"
              >
                <option value="">선택하세요</option>
                {options[key].map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            ) : ( // 아니면 수치형 변수
              <input
                type="number"
                name={key}
                value={formData[key] || 0}
                onChange={handleInputChange}
                step="0.1"
                className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FEE500]"
              />
            )}
          </div>
        ))}
      </div>
    );
  };
  
  // 챗봇 메시지 전송 함수
  const sendMessage = async () => {
    // ... (기존과 동일)
  };


  return (
    <div className="flex h-screen bg-[#B2C7D9] font-sans">
      {/* --- 사이드바 (예측 폼) --- */}
      <div className={`transition-all duration-300 bg-white overflow-hidden ${showSidebar ? 'w-96' : 'w-0'}`}>
        <div className="p-4 h-full overflow-y-auto">
          <h2 className="text-xl font-bold mb-4 text-gray-800">폐업 확률 예측</h2>
          
          {renderForm()}

          <button
            onClick={handlePredict}
            disabled={predicting || !optionsData}
            className="w-full mt-6 bg-[#FEE500] text-gray-800 py-3 rounded-lg font-semibold hover:bg-[#FDD835] disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {predicting ? '예측 중...' : '폐업 확률 예측'}
          </button>
          
          {prediction && (
            <div className="mt-4 p-4 bg-gray-100 rounded-lg">
              <h3 className="font-bold text-gray-800 mb-2">예측 결과</h3>
              <p className="text-2xl font-bold text-red-600 mb-1">{prediction.closure_probability.toFixed(2)}%</p>
              <p className="text-sm text-gray-600">위험도: <span className="font-semibold">{prediction.risk_level}</span></p>
            </div>
          )}
        </div>
      </div>

      {/* --- 메인 채팅창 --- */}
      <div className="flex-1 flex flex-col">
        <header className="bg-[#A8C5DD] px-4 py-3 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#FFE082] rounded-full flex items-center justify-center text-xl">🤖</div>
            <div>
              <h1 className="text-gray-800 font-semibold">폐업 위기 예측 봇</h1>
              <p className="text-xs text-gray-600">AI 상담사</p>
            </div>
          </div>
          <button 
            onClick={() => setShowSidebar(!showSidebar)}
            className="px-4 py-2 bg-[#FEE500] rounded-lg text-sm font-semibold hover:bg-[#FDD835] transition-colors"
          >
            {showSidebar ? '입력창 닫기' : '폐업 예측하기'}
          </button>
        </header>
        
        {/* ... (챗봇 메시지 표시 및 입력 UI는 기존과 동일) ... */}
        <main className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* Messages display */}
        </main>
        <footer className="bg-white px-4 py-3 shadow-lg border-t border-gray-200">
          {/* Message input */}
        </footer>
      </div>
    </div>
  );
}
