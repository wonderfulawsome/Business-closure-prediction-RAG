from flask import Flask, request, jsonify
from flask_cors import CORS
from google import genai
import os
import pickle
import numpy as np
import traceback

app = Flask(__name__)
CORS(app)

# --- 초기 설정: Gemini 클라이언트, 모델, 문서 로드 ---

# Gemini 클라이언트 초기화 (오류 발생 시에도 앱은 실행되도록 처리)
try:
    # 참고: RAG 챗봇 기능을 사용하려면 'GEMINI_API_KEY' 환경 변수 설정이 필요합니다.
    client = genai.Client(api_key=os.environ.get('GEMINI_API_KEY'))
    print("✓ Gemini 클라이언트 초기화 성공!")
except Exception as e:
    print(f"✗ Gemini 클라이언트 초기화 실패: API 키를 확인해주세요. 챗봇 기능이 비활성화됩니다. 오류: {e}")
    client = None

model_package = None

# franchise_model.pkl 파일 로드
try:
    with open('franchise_model.pkl', 'rb') as f:
        model_package = pickle.load(f)
    print("✓ 모델 로드 성공!")
    if isinstance(model_package, dict):
        print("  - pkl 파일에 포함된 키:", list(model_package.keys()))
except FileNotFoundError:
    print("✗ 모델 로드 실패: backend 폴더에 franchise_model.pkl 파일을 찾을 수 없습니다.")
except Exception as e:
    print(f"✗ 모델 로드 중 오류 발생: {e}")
    print(traceback.format_exc())

# RAG 챗봇용 문서 로드
documents = []
try:
    with open('documents.txt', 'r', encoding='utf-8') as f:
        content = f.read()
    doc_blocks = content.split('===DOCUMENT_START===')
    for block in doc_blocks:
        if '===DOCUMENT_END===' in block:
            block_content = block.split('===DOCUMENT_END===')[0].strip()
            if not block_content: continue
            
            lines = block_content.split('\n')
            keywords, content_lines = [], []
            
            for i, line in enumerate(lines):
                if line.startswith('KEYWORDS:'):
                    keywords = [k.strip() for k in line.replace('KEYWORDS:', '').strip().split(',')]
                elif line.startswith('CONTENT:'):
                    content_lines = lines[i+1:]
                    break
            
            if content_lines:
                documents.append({'content': '\n'.join(content_lines), 'keywords': keywords})
    print(f"✓ 문서 {len(documents)}개 로드 완료!")
except FileNotFoundError:
     print("✗ 문서 로드 실패: backend 폴더에 documents.txt 파일을 찾을 수 없습니다.")
except Exception as e:
    print(f"✗ 문서 파일 처리 중 오류 발생: {e}")

# --- API 엔드포인트 ---

@app.route('/options', methods=['GET'])
def get_options():
    """프론트엔드에 필요한 모든 범주형 변수의 선택지와 피처 순서를 제공합니다."""
    if not all(k in (model_package or {}) for k in ['label_encoders', 'feature_cols']):
        return jsonify({'error': '모델 파일에서 옵션 정보를 로드할 수 없습니다.', 'options': {}, 'feature_cols': []})
    
    try:
        encoders = model_package['label_encoders']
        feature_cols = model_package['feature_cols']
        
        # *** 문제의 원인이었던 키 이름을 '옵션' -> 'options'로 수정했습니다. ***
        options = {col: [str(cls) for cls in encoder.classes_] for col, encoder in encoders.items()}
        
        return jsonify({'options': options, 'feature_cols': feature_cols})
    except Exception as e:
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@app.route('/predict', methods=['POST'])
def predict():
    """사용자가 입력한 모든 변수 값을 받아 폐업 확률을 예측하고 결과를 반환합니다."""
    if not all(k in (model_package or {}) for k in ['model', 'label_encoders', 'feature_cols']):
        return jsonify({'error': '예측 모델 또는 관련 데이터가 올바르게 로드되지 않았습니다.'}), 500

    try:
        data = request.json
        encoders = model_package['label_encoders']
        model = model_package['model']
        feature_cols = model_package['feature_cols']
        
        X = np.zeros((1, len(feature_cols)))

        for i, col in enumerate(feature_cols):
            value = data.get(col)
            if value is None or value == '':
                return jsonify({'error': f"'{col}' 필드 값이 누락되었습니다."}), 400

            if col in encoders:
                try:
                    X[0, i] = encoders[col].transform([str(value)])[0]
                except ValueError:
                    return jsonify({'error': f"'{col}' 필드의 값 '{value}'가 유효하지 않습니다. 선택 가능한 옵션인지 확인해주세요."}), 400
            else:
                try:
                    X[0, i] = float(value)
                except (ValueError, TypeError):
                    return jsonify({'error': f"'{col}' 필드의 값 '{value}'는 유효한 숫자가 아닙니다."}), 400
        
        probability = model.predict_proba(X)[0][1]
        risk_level = '높음' if probability > 0.3 else '중간' if probability > 0.1 else '낮음'
        return jsonify({'closure_probability': float(probability) * 100, 'risk_level': risk_level})
        
    except Exception as e:
        print(traceback.format_exc())
        return jsonify({'error': f'예측 중 서버 오류가 발생했습니다: {str(e)}'}), 500

@app.route('/chat', methods=['POST'])
def chat():
    # ... (챗봇 기능은 변경 없음) ...
    if not client: return jsonify({'error': '챗봇 기능을 사용할 수 없습니다. API 키를 확인하세요.'}), 503
    try:
        # ... (챗봇 로직 동일) ...
        return jsonify({'response': '...'}) # 실제 응답으로 교체
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
