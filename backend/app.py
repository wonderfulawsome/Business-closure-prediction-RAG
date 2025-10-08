from flask import Flask, request, jsonify
from flask_cors import CORS
from google import genai
import os
import pickle
import numpy as np
import traceback

app = Flask(__name__)
CORS(app)

# Initialize the Gemini client for the RAG chatbot
# It's recommended to set the API key as an environment variable
try:
    client = genai.Client(api_key=os.environ.get('GEMINI_API_KEY'))
except Exception as e:
    print(f"✗ Gemini 클라이언트 초기화 실패: API 키를 확인해주세요. 오류: {e}")
    client = None

model_package = None

# Load the pre-trained model and associated data from the .pkl file
try:
    with open('franchise_model.pkl', 'rb') as f:
        model_package = pickle.load(f)
    print("✓ 모델 로드 성공!")
    if isinstance(model_package, dict):
        print("  - 포함된 키:", list(model_package.keys()))
        if 'model_info' in model_package:
            info = model_package['model_info']
            print(f"  - 모델명: {info.get('name', '알 수 없음')}")
            print(f"  - 버전: {info.get('version', '알 수 없음')}")
except Exception as e:
    print(f"✗ 모델 로드 실패: {e}")
    print(traceback.format_exc())

documents = []
# Load documents for the RAG chatbot
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
                    keywords = [k.strip() for k in line.replace('KEYWORDS:', '').strip().split(',')]
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
    print(traceback.format_exc())

def search_documents(query):
    """Search for relevant documents based on the user's query."""
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

@app.route('/chat', methods=['POST'])
def chat():
    """Endpoint for the RAG chatbot."""
    if not client:
        return jsonify({'error': 'Gemini 클라이언트를 사용할 수 없습니다.'}), 500
        
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

@app.route('/predict', methods=['POST'])
def predict():
    """Endpoint for making closure predictions based on user input."""
    if model_package is None:
        return jsonify({'error': '예측 모델을 사용할 수 없습니다.'}), 500
    
    try:
        data = request.json
        encoders = model_package.get('label_encoders', {})
        model = model_package.get('model')
        feature_cols = model_package.get('feature_cols', [])

        if not model or not feature_cols:
            return jsonify({'error': '모델 또는 피처 정보를 찾을 수 없습니다.'}), 500
            
        # Create a numpy array with the correct number of features, initialized to zero
        X = np.zeros((1, len(feature_cols)))

        # Process each feature from the incoming request data
        for i, col in enumerate(feature_cols):
            value = data.get(col)
            if value is None:
                return jsonify({'error': f"'{col}' 필드가 누락되었습니다."}), 400

            if col in encoders:
                # If the feature is categorical, encode it
                try:
                    # The encoder expects a list or 1D array
                    encoded_value = encoders[col].transform([value])[0]
                    X[0, i] = encoded_value
                except ValueError:
                    return jsonify({'error': f"'{col}' 필드의 값 '{value}'가 유효하지 않습니다."}), 400
            else:
                # If the feature is numerical, convert it to float
                try:
                    X[0, i] = float(value)
                except (ValueError, TypeError):
                    return jsonify({'error': f"'{col}' 필드의 값 '{value}'는 유효한 숫자가 아닙니다."}), 400
        
        # Predict the probability of closure (class 1)
        probability = model.predict_proba(X)[0][1]
        
        risk_level = '높음' if probability > 0.3 else '중간' if probability > 0.1 else '낮음'

        return jsonify({
            'closure_probability': float(probability) * 100,
            'risk_level': risk_level
        })
        
    except Exception as e:
        print(traceback.format_exc())
        return jsonify({'error': f'예측 중 서버 오류가 발생했습니다: {str(e)}'}), 500

@app.route('/options', methods=['GET'])
def get_options():
    """Endpoint to provide options for all categorical features."""
    if model_package is None:
        return jsonify({'error': '예측 기능을 사용할 수 없습니다.', 'options': {}})
    
    try:
        encoders = model_package.get('label_encoders', {})
        options = {}
        for col, encoder in encoders.items():
            options[col] = [str(x) for x in encoder.classes_]
            
        return jsonify(options)
            
    except Exception as e:
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint."""
    return jsonify({
        'status': 'ok',
        'model_loaded': model_package is not None,
        'documents_loaded': len(documents) > 0,
        'gemini_client_initialized': client is not None
    })

if __name__ == '__main__':
    # Use the PORT environment variable if available, otherwise default to 5000
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
