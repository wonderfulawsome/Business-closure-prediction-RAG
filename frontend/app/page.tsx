{/* 예측 모델 화면 */}
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
                    value={formData[key] || ''}
                    onChange={handleInputChange}
                    step="0.1"
                    placeholder={key === '운영개월수' ? '운영 개월 수를 입력하세요' : ''}
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
