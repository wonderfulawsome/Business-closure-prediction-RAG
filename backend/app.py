from flask import Flask, request, jsonify
from flask_cors import CORS
from google import genai
import os
import pickle
import numpy as np

app = Flask(__name__)
CORS(app)

# Gemini API 클라이언트 설정
client = genai.Client(api_key=os.environ.get('GEMINI_API_KEY'))

# 모델 및 인코더 로드
model = None
encoders = None

try:
    with open('franchise_model.pkl', 'rb') as f:
        model = pickle.load(f)
    with open('encoders.pkl', 'rb') as f:
        encoders = pickle.load(f)
    print("모델 및 인코더 로드 성공!")
except Exception as e:
    print(f"모델 로드 실패: {e}")

# 문서 로드 함수
def load_documents():
    documents = []
    try:
        with open('documents.txt', 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 문서 파싱
        doc_blocks = content.split('===DOCUMENT_START===')
        for block in doc_blocks:
            if '===DOCUMENT_END===' in block:
                block = block.split('===DOCUMENT_END===')[0]
                lines = block.strip().split('\n')
                
                keywords = []
                content_lines = []
                is_content = False
                
                for line in lines:
                    if line.startswith('KEYWORDS:'):
                        keywords = line.replace('KEYWORDS:', '').strip().split(',')
                    elif line.startswith('CONTENT:'):
                        is_content = True
                    elif is_content and line.strip():
                        content_lines.append(line)
                
                if content_lines:
                    documents.append({
                        'content': '\n'.join(content_lines),
                        'keywords': keywords
                    })
        
        print(f"문서 {len(documents)}개 로드 완료!")
        return documents
    except Exception as e:
        print(f"문서 로드 실패: {e}")
        return []

# 문서 로드
documents = load_documents()

def search_documents(query):
    """키워드 기반 문서 검색"""
    query_lower = query.lower()
    scores = []
    
    for doc in documents:
        score = 0
        # 키워드 매칭
        for keyword in doc["keywords"]:
            if keyword in query_lower:
                score += 2
        
        # 내용에서 직접 검색
        content_lower = doc["content"].lower()
        query_words = query_lower.split()
        for word in query_words:
            if len(word) > 1 and word in content_lower:
                score += 1
        
        scores.append((doc, score))
    
    # 점수 기준 정렬 후 상위 3개 선택
    scores.sort(key=lambda x: x[1], reverse=True)
    return [doc for doc, score in scores[:3] if score > 0]

@app.route('/chat', methods=['POST'])
def chat():
    try:
        data = request.json
        query = data.get('message', '')
        
        # 관련 문서 검색
        relevant_docs = search_documents(query)
        
        if not relevant_docs:
            relevant_docs = documents[:3] if documents else []
        
        context = "\n\n".join([doc["content"] for doc in relevant_docs])
        
        # Gemini로 답변 생성
        prompt = f"""다음 문서를 참고하여 질문에 답변해주세요.

문서:
{context}

질문: {query}

답변 형식:
- 명확하고 구체적으로 답변
- 수치가 있으면 정확히 제시
- 문서에 없는 내용은 추측하지 않음"""
        
        response = client.models.generate_content(
            model='gemini-2.0-flash-exp',
            contents=prompt
        )
        
        return jsonify({
            'response': response.text
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/predict', methods=['POST'])
def predict():
    try:
        if model is None or encoders is None:
            return jsonify({'error': '모델이 로드되지 않았습니다'}), 500
        
        data = request.json
        region = data.get('region')  # 가맹점지역
        industry = data.get('industry')  # 업종
        district = data.get('district')  # 상권
        
        if not all([region, industry, district]):
            return jsonify({'error': '모든 필드를 입력해주세요'}), 400
        
        # 인코딩
        try:
            region_encoded = encoders['region'].transform([region])[0]
            industry_encoded = encoders['industry'].transform([industry])[0]
            district_encoded = encoders['district'].transform([district])[0]
        except:
            return jsonify({'error': '입력값이 학습 데이터에 없습니다'}), 400
        
        # 예측
        X = np.array([[region_encoded, industry_encoded, district_encoded]])
        probability = model.predict_proba(X)[0][1]  # 폐업 확률
        
        return jsonify({
            'closure_probability': float(probability) * 100,  # 퍼센트로 변환
            'risk_level': '높음' if probability > 0.3 else '중간' if probability > 0.1 else '낮음'
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/options', methods=['GET'])
def get_options():
    """입력 옵션 반환"""
    try:
        if encoders is None:
            return jsonify({'error': '인코더가 로드되지 않았습니다'}), 500
        
        return jsonify({
            'regions': encoders['region'].classes_.tolist(),
            'industries': encoders['industry'].classes_.tolist(),
            'districts': encoders['district'].classes_.tolist()
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'ok',
        'model_loaded': model is not None,
        'documents_loaded': len(documents) > 0
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5000)))
