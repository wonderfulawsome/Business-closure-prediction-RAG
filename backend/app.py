from flask import Flask, request, jsonify
from flask_cors import CORS
from google import genai
import os
import pickle
import numpy as np
import traceback

app = Flask(__name__)

# ✅ CORS 설정
CORS(app, resources={
    r"/*": {
        "origins": [
            "https://business-closure-prediction-rag.vercel.app",
            "https://*.vercel.app",
            "http://localhost:3000"
        ],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"],
        "expose_headers": ["Content-Type"],
        "supports_credentials": True,
        "max_age": 3600
    }
})

@app.after_request
def after_request(response):
    origin = request.headers.get('Origin')
    if origin:
        response.headers.add('Access-Control-Allow-Origin', origin)
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
    response.headers.add('Access-Control-Max-Age', '3600')
    return response

# Gemini 클라이언트 초기화
try:
    client = genai.Client(api_key=os.environ.get('GEMINI_API_KEY'))
    print("✓ Gemini 클라이언트 초기화 성공!")
except Exception as e:
    print(f"✗ Gemini 클라이언트 초기화 실패: {e}")
    client = None

model_package = None
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# 모델 로드
try:
    model_path = os.path.join(BASE_DIR, 'model.pkl')
    with open(model_path, 'rb') as f:
        model_package = pickle.load(f)
    print("✓ 모델 로드 성공!")
    if isinstance(model_package, dict):
        print("  - 키:", list(model_package.keys()))
        if 'model_info' in model_package:
            info = model_package['model_info']
            print(f"  - 모델명: {info.get('name', 'Unknown')}")
            print(f"  - 버전: {info.get('version', 'Unknown')}")
except Exception as e:
    print(f"✗ 모델 로드 실패: {e}")
    print(traceback.format_exc())

# 문서 로드 (전체 문서를 하나로)
full_document = ""
try:
    docs_path = os.path.join(BASE_DIR, 'documents.txt')
    with open(docs_path, 'r', encoding='utf-8') as f:
        full_document = f.read()
    
    print(f"✓ 문서 로드 완료! (길이: {len(full_document)} 글자)")
    
except Exception as e:
    print(f"✗ 문서 로드 실패: {e}")

@app.route('/options', methods=['GET', 'OPTIONS'])
def get_options():
    if request.method == 'OPTIONS':
        response = jsonify({'status': 'ok'})
        return response, 204
    
    if not model_package or 'label_encoders' not in model_package:
        return jsonify({
            'error': '모델 파일을 로드할 수 없습니다',
            'options': {},
            'feature_cols': []
        }), 500
    
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
    if request.method == 'OPTIONS':
        response = jsonify({'status': 'ok'})
        return response, 204
    
    if not model_package:
        return jsonify({'error': '모델을 사용할 수 없습니다'}), 500

    try:
        data = request.json
        encoders = model_package.get('label_encoders', {})
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
                    return jsonify({'error': f"'{col}' 값 '{value}'가 유효하지 않습니다"}), 400
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
    if request.method == 'OPTIONS':
        response = jsonify({'status': 'ok'})
        return response, 204
    
    if not client:
        return jsonify({'error': '챗봇 기능을 사용할 수 없습니다'}), 503
    
    try:
        data = request.json
        query = data.get('message', '')
        
        # 전체 문서를 컨텍스트로 사용
        prompt = f"""다음은 소상공인 폐업 위기 예측에 관한 전문 지식 자료입니다. 이 문서의 내용을 바탕으로 질문에 답변해주세요.

=== 참고 문서 ===
{full_document}

=== 사용자 질문 ===
{query}

=== 답변 지침 ===
- 위 문서의 내용을 근거로 명확하고 구체적으로 답변하세요
- 수치나 데이터가 있으면 정확히 인용하세요
- 문서에 없는 내용은 추측하지 마세요
- 실용적이고 구체적인 조언을 제공하세요
- 친절하고 이해하기 쉽게 설명하세요
- **나 ### 같은 기호들을 사용해서 글의 제목, 목록, 강조(굵게), 인용 등의 서식을 지정하는 언어인 **마크업 언어(Markup Language)는 사용하지마세요."""
        
        response = client.models.generate_content(
            model='gemini-1.5-flash',
            contents=prompt
        )
        
        return jsonify({'response': response.text})
        
    except Exception as e:
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@app.route('/health', methods=['GET', 'OPTIONS'])
def health():
    if request.method == 'OPTIONS':
        response = jsonify({'status': 'ok'})
        return response, 204
        
    return jsonify({
        'status': 'ok',
        'model_loaded': model_package is not None,
        'document_loaded': len(full_document) > 0,
        'gemini_client_initialized': client is not None
    })

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
