from flask import Flask, request, jsonify
from flask_cors import CORS
from google import genai
import os
import pickle

app = Flask(__name__)
CORS(app)

client = genai.Client(api_key=os.environ.get('GEMINI_API_KEY'))

model_package = None

try:
    with open('franchise_model.pkl', 'rb') as f:
        model_package = pickle.load(f)
    print("✓ 모델 로드 성공!")
except Exception as e:
    print(f"✗ 모델 로드 실패: {e}")
    print("⚠ 예측 기능 없이 챗봇만 작동합니다")

documents = []
try:
    with open('documents.txt', 'r', encoding='utf-8') as f:
        content = f.read()
    
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
                elif line.startsWith('CONTENT:'):
                    is_content = True
                elif is_content and line.strip():
                    content_lines.append(line)
            
            if content_lines:
                documents.append({
                    'content': '\n'.join(content_lines),
                    'keywords': keywords
                })
    
    print(f"✓ 문서 {len(documents)}개 로드 완료!")
except Exception as e:
    print(f"✗ 문서 로드 실패: {e}")

def search_documents(query):
    query_lower = query.lower()
    scores = []
    
    for doc in documents:
        score = 0
        for keyword in doc["keywords"]:
            if keyword in query_lower:
                score += 2
        
        content_lower = doc["content"].lower()
        query_words = query_lower.split()
        for word in query_words:
            if len(word) > 1 and word in content_lower:
                score += 1
        
        scores.append((doc, score))
    
    scores.sort(key=lambda x: x[1], reverse=True)
    return [doc for doc, score in scores[:3] if score > 0]

@app.route('/chat', methods=['POST'])
def chat():
    try:
        data = request.json
        query = data.get('message', '')
        
        relevant_docs = search_documents(query)
        
        if not relevant_docs:
            relevant_docs = documents[:3] if documents else []
        
        context = "\n\n".join([doc["content"] for doc in relevant_docs])
        
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
    if model_package is None:
        return jsonify({'error': '예측 모델을 사용할 수 없습니다. 모델 파일(franchise_model.pkl)이 필요합니다.'}), 400
    
    try:
        data = request.json
        region = data.get('region')
        industry = data.get('industry')
        district = data.get('district')
        
        if not all([region, industry, district]):
            return jsonify({'error': '모든 필드를 입력해주세요'}), 400
        
        encoders = model_package['label_encoders']
        
        try:
            import numpy as np
            region_encoded = encoders['가맹점지역_encoded'].transform([region])[0]
            industry_encoded = encoders['업종_encoded'].transform([industry])[0]
            district_encoded = encoders['상권_encoded'].transform([district])[0]
        except:
            return jsonify({'error': '입력값이 학습 데이터에 없습니다'}), 400
        
        X = np.array([[region_encoded, industry_encoded, district_encoded]])
        model = model_package['model']
        probability = model.predict_proba(X)[0][1]
        
        return jsonify({
            'closure_probability': float(probability) * 100,
            'risk_level': '높음' if probability > 0.3 else '중간' if probability > 0.1 else '낮음'
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/options', methods=['GET'])
def get_options():
    if model_package is None:
        return jsonify({
            'error': '예측 기능을 사용할 수 없습니다',
            'regions': [],
            'industries': [],
            'districts': []
        })
    
    try:
        print("=== 모델 패키지 구조 ===")
        print("Type:", type(model_package))
        print("Keys:", list(model_package.keys()) if hasattr(model_package, 'keys') else "Not a dict")
        
        # label_encoders가 있는지 확인
        if 'label_encoders' in model_package:
            encoders = model_package['label_encoders']
            print("Encoders type:", type(encoders))
            print("Encoder keys:", list(encoders.keys()))
            
            return jsonify({
                'regions': list(encoders['가맹점지역_encoded'].classes_),
                'industries': list(encoders['업종_encoded'].classes_),
                'districts': list(encoders['상권_encoded'].classes_)
            })
        else:
            # label_encoders가 없으면 전체 키 구조 반환
            return jsonify({
                'error': 'label_encoders 키가 없음',
                'available_keys': list(model_package.keys())
            }), 500
            
    except Exception as e:
        import traceback
        print("=== 에러 발생 ===")
        print(traceback.format_exc())
        return jsonify({
            'error': str(e),
            'type': type(e).__name__
        }), 500

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'ok',
        'model_loaded': model_package is not None,
        'documents_loaded': len(documents) > 0
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5000)))
