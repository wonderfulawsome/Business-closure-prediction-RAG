'use client';

export default function Home() {
  const [currentView, setCurrentView] = React.useState('home');
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const [messages, setMessages] = React.useState([]);
  const [inputMessage, setInputMessage] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [optionsData, setOptionsData] = React.useState(null);
  const [formData, setFormData] = React.useState({});
  const [prediction, setPrediction] = React.useState(null);
  const [isPredicting, setIsPredicting] = React.useState(false);

  React.useEffect(() => {
    fetchOptions();
  }, []);

  const fetchOptions = async () => {
    try {
      const response = await fetch('https://business-closure-prediction-rag.onrender.com/options');
      const data = await response.json();
      setOptionsData(data);
    } catch (error) {
      console.error('옵션 로드 실패:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage = { role: 'user', content: inputMessage };
    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const response = await fetch('https://business-closure-prediction-rag.onrender.com/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: inputMessage })
      });
      const data = await response.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: '죄송합니다. 오류가 발생했습니다.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handlePredict = async () => {
    setIsPredicting(true);
    setPrediction(null);

    try {
      const response = await fetch('https://business-closure-prediction-rag.onrender.com/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await response.json();
      setPrediction(data);
    } catch (error) {
      setPrediction({ closure_probability: 0, risk_level: '', error: '예측 중 오류가 발생했습니다.' });
    } finally {
      setIsPredicting(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className={`${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 fixed md:static w-64 h-full bg-gradient-to-b from-[#5B6EAF] to-[#7C88E5] text-white transition-transform duration-300 ease-in-out z-30 shadow-2xl`}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-8">
            <button onClick={() => { setCurrentView('home'); setIsSidebarOpen(false); }} className="text-2xl font-bold hover:opacity-80 transition-opacity">
              예측 시스템
            </button>
            <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-white hover:bg-white/20 p-2 rounded-lg transition-colors">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <nav className="space-y-3">
            <button onClick={() => { setCurrentView('chat'); setIsSidebarOpen(false); }} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${currentView === 'chat' ? 'bg-white/20 shadow-lg' : 'hover:bg-white/10'}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
              <span className="font-medium">챗봇</span>
            </button>
            <button onClick={() => { setCurrentView('sales-prediction'); setIsSidebarOpen(false); }} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${currentView === 'sales-prediction' ? 'bg-white/20 shadow-lg' : 'hover:bg-white/10'}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
                <polyline points="17 6 23 6 23 12"></polyline>
              </svg>
              <span className="font-medium">폐업 예측</span>
            </button>
          </nav>
        </div>
      </aside>

      {isSidebarOpen && <div onClick={() => setIsSidebarOpen(false)} className="fixed inset-0 bg-black/50 z-20 md:hidden" />}

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center shadow-sm">
          <button onClick={() => setIsSidebarOpen(true)} className="md:hidden mr-4 text-gray-600 hover:text-gray-800 transition-colors">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
          <h2 className="text-xl font-semibold text-gray-800">
            {currentView === 'home' ? '홈' : currentView === 'chat' ? 'AI 챗봇' : '가맹점 폐업 예측'}
          </h2>
        </header>

        {currentView === 'home' && (
          <div className="flex-1 flex items-center justify-center p-8 bg-white">
            <div className="max-w-4xl w-full">
              <div className="text-center mb-12">
                <h1 className="text-4xl font-bold text-gray-800 mb-4">가맹점 폐업 예측 시스템</h1>
                <p className="text-lg text-gray-600">AI 기반 분석으로 가맹점 운영을 지원합니다</p>
              </div>
              
              <div className="grid md:grid-cols-2 gap-8">
                <button 
                  onClick={() => setCurrentView('chat')}
                  className="group bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 border-2 border-transparent hover:border-[#7C88E5]"
                >
                  <div className="flex flex-col items-center text-center">
                    <div className="w-20 h-20 bg-gradient-to-br from-[#5B6EAF] to-[#7C88E5] rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                      </svg>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-800 mb-3">AI 챗봇</h3>
                    <p className="text-gray-600 leading-relaxed">
                      폐업 위험 요인, 업종별 통계, 지역별 데이터 등<br />
                      궁금한 점을 자유롭게 질문하세요
                    </p>
                  </div>
                </button>

                <button 
                  onClick={() => setCurrentView('sales-prediction')}
                  className="group bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 border-2 border-transparent hover:border-[#7C88E5]"
                >
                  <div className="flex flex-col items-center text-center">
                    <div className="w-20 h-20 bg-gradient-to-br from-[#5B6EAF] to-[#7C88E5] rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
                        <polyline points="17 6 23 6 23 12"></polyline>
                      </svg>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-800 mb-3">폐업 예측</h3>
                    <p className="text-gray-600 leading-relaxed">
                      가맹점 정보를 입력하면<br />
                      AI가 폐업 확률을 분석해드립니다
                    </p>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}

        {currentView === 'chat' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[70%] p-4 rounded-2xl shadow-md ${msg.role === 'user' ? 'bg-[#7C88E5] text-white' : 'bg-white text-gray-800 border border-gray-200'}`}>
                    <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white text-gray-800 p-4 rounded-2xl shadow-md border border-gray-200">
                    <div className="flex space-x-2">
                      <div className="w-2 h-2 bg-[#7C88E5] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2 h-2 bg-[#7C88E5] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2 h-2 bg-[#7C88E5] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="border-t border-gray-200 p-6 bg-white">
              <div className="flex space-x-3">
                <input type="text" value={inputMessage} onChange={(e) => setInputMessage(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()} placeholder="메시지를 입력하세요..." className="flex-1 px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-800 placeholder-gray-500 focus:ring-2 focus:ring-[#5B6EAF] focus:border-transparent outline-none transition-all" />
                <button onClick={handleSendMessage} disabled={isLoading || !inputMessage.trim()} className="px-6 py-3 bg-[#7C88E5] text-white rounded-xl hover:bg-[#6B78D4] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md flex items-center space-x-2">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="22" y1="2" x2="11" y2="13"></line>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                  </svg>
                  <span className="font-medium">전송</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {currentView === 'sales-prediction' && (
          <div className="flex-1 overflow-y-auto p-8 bg-white">
            <div className="max-w-4xl mx-auto">
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-800 mb-2">가맹점 폐업 확률 예측</h1>
                <p className="text-gray-600">가맹점 정보를 입력하여 폐업 위험도를 분석하세요</p>
              </div>

              {!optionsData ? (
                <div className="text-gray-800 text-center py-12">
                  <div className="animate-spin w-12 h-12 border-4 border-[#5B6EAF] border-t-transparent rounded-full mx-auto mb-4"></div>
                  <p>예측 모델 로딩 중...</p>
                </div>
              ) : (
                <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
                  <div className="space-y-6 mb-8">
                    {optionsData.feature_cols.map((key) => (
                      <div key={key}>
                        <label className="block text-sm font-medium text-gray-700 mb-2">{key}</label>
                        {optionsData.options[key] ? (
                          <select name={key} value={formData[key] || ''} onChange={handleInputChange} className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-[#5B6EAF] focus:border-transparent outline-none">
                            <option value="">선택하세요</option>
                            {optionsData.options[key].map((opt) => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        ) : (
                          <input type="number" name={key} value={formData[key] || ''} onChange={handleInputChange} step="0.1" placeholder={key === '운영개월수' ? '운영 개월 수를 입력하세요' : ''} className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-[#5B6EAF] focus:border-transparent outline-none" />
                        )}
                      </div>
                    ))}
                  </div>

                  <button onClick={handlePredict} disabled={isPredicting} className="w-full px-6 py-4 bg-[#7C88E5] text-white text-lg rounded-xl font-semibold hover:bg-[#6B78D4] transition-all shadow-md disabled:opacity-50">
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
      </main>
    </div>
  );
}
