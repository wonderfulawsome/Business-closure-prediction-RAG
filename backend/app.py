from flask import Flask, request, jsonify
from flask_cors import CORS
from google import genai
import os
import pickle
import numpy as np
import traceback

app = Flask(__name__)

# CORS 설정 - 모든 origin 허용
CORS(app, resources={
    r"/*": {
        "origins": "*",
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type"],
        "expose_headers": ["Content-Type"]
    }
})

# Gemini 클라이언트 초기화
try:
    client = genai.Client(api_key=os.environ.get('GEMINI_API_KEY'))
    print("✓ Gemini 클라이언트 초기화 성공!")
except Exception as e:
    print(f"✗ Gemini 클라이언트 초기화 실패: {e}")
    client = None

model_package = None

# 모델 로드
try:
    with open('model.pkl', 'rb') as f:
        model_package = pickle.load(f)
    print("✓ 모델 로드 성공!")
    if isinstance(model_package, dict):
        print("  - 키:", list(model_package.keys()))
        if 'model_info' in model_package:
            info = model_package['model_info']
            print(f"  - 모델명: {info.get('name', 'Unknown')}")
except Exception as e:
    print(f"✗ 모델 로드 실패: {e}")

# 문서 로드
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
                    keywords = [k.strip() for k in keywords]
                elif line.startswith('CONTENT:'):
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
            if keyword.lower() in query_lower:
                score += 2
        
        content_lower = doc["content"].lower()
        query_words = query_lower.split()
        for word in query_words:
            if len(word) > 1 and word in content_lower:
                score += 1
        
        scores.append((doc, score))
    
    scores.sort(key=lambda x: x[1], reverse=True)
    return [doc for doc, score in scores[:3] if score > 0]

@app.route('/options', methods=['GET', 'OPTIONS'])
def get_options():
    # OPTIONS 요청 처리
    if request.method == 'OPTIONS':
        return '', 204
    
    if not model_package or 'label_encoders' not in model_package:
        return jsonify({
            'error': '모델 파일을 로드할 수 없습니다',
            'options': {},
            'feature_cols': []
        })
    
    try:
        encoders = model_package['label_encoders']
        feature_cols = model_package.get('feature_cols', [])
        
        options = {}
        for col, encoder in encoders.items():
            options[col] = [str(x) for x in encoder.classes_]
        
        return jsonify({
            'options': options,
            'feature_cols': feature_cols
        })
    except Exception as e:
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@app.route('/predict', methods=['POST', 'OPTIONS'])
def predict():
    # OPTIONS 요청 처리
    if request.method == 'OPTIONS':
        return '', 204
    
    if not model_package:
        return jsonify({'error': '모델을 사용할 수 없습니다'}), 500

    try:
        data = request.json
        encoders = model_package['label_encoders']
        model = model_package['model']
        feature_cols = model_package['feature_cols']
        
        X = np.zeros((1, len(feature_cols)))

        for i, col in enumerate(feature_cols):
            value = data.get(col)
            if value is None or value == '':
                return jsonify({'error': f"'{col}' 필드가 누락되었습니다"}), 400

            if col in encoders:
                try:
                    X[0, i] = encoders[col].transform([str(value)])[0]
                except ValueError:
                    return jsonify({'error': f"'{col}' 값이 유효하지 않습니다"}), 400
            else:
                try:
                    X[0, i] = float(value)
                except (ValueError, TypeError):
                    return jsonify({'error': f"'{col}' 값이 숫자가 아닙니다"}), 400
        
        probability = model.predict_proba(X)[0][1]
        risk_level = '높음' if probability > 0.3 else '중간' if probability > 0.1 else '낮음'
        
        return jsonify({
            'closure_probability': float(probability) * 100,
            'risk_level': risk_level
        })
        
    except Exception as e:
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@app.route('/chat', methods=['POST', 'OPTIONS'])
def chat():
    # OPTIONS 요청 처리
    if request.method == 'OPTIONS':
        return '', 204
    
    if not client:
        return jsonify({'error': '챗봇 기능을 사용할 수 없습니다'}), 503
    
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
        
        return jsonify({'response': response.text})
        
    except Exception as e:
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'ok',
        'model_loaded': model_package is not None,
        'documents_loaded': len(documents) > 0,
        'gemini_client_initialized': client is not None
    })

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
