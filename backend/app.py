from flask import Flask, request, jsonify
from flask_cors import CORS
from google import genai
import os
import pickle
import numpy as np

app = Flask(__name__)
CORS(app)

client = genai.Client(api_key=os.environ.get('GEMINI_API_KEY'))

model_package = None

try:
    with open('franchise_model.pkl', 'rb') as f:
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
    import traceback
    print(traceback.format_exc())

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
    import traceback
    print(traceback.format_exc())

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
        import traceback
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@app.route('/predict', methods=['POST'])
def predict():
    if model_package is None:
        return jsonify({'error': '예측 모델을 사용할 수 없습니다.'}), 400
    
    try:
        data = request.json
        sales_range = data.get('sales_range')
        transaction_range = data.get('transaction_range')
        customer_range = data.get('customer_range')
        avg_price_range = data.get('avg_price_range')
        
        if not all([sales_range, transaction_range, customer_range, avg_price_range]):
            return jsonify({'error': '모든 필드를 입력해주세요'}), 400
        
        encoders = model_package.get('label_encoders', {})
        model = model_package.get('model')
        
        if not model:
            return jsonify({'error': '모델을 찾을 수 없습니다'}), 500
        
        # 인코딩
        try:
            sales_encoded = encoders['매출금액구간'].transform([sales_range])[0]
            transaction_encoded = encoders['매출건수구간'].transform([transaction_range])[0]
            customer_encoded = encoders['유니크고객수구간'].transform([customer_range])[0]
            price_encoded = encoders['객단가구간'].transform([avg_price_range])[0]
        except KeyError as e:
            return jsonify({'error': f'인코더를 찾을 수 없습니다: {e}'}), 500
        except ValueError:
            return jsonify({'error': '입력값이 학습 데이터에 없습니다'}), 400
        
        # 예측 (XGBoost는 20개 특징 필요 - 나머지는 0으로 채움)
        feature_cols = model_package.get('feature_cols', [])
        X = np.zeros((1, len(feature_cols)))
        
        # 4개 인코딩된 값 넣기
        for i, col in enumerate(feature_cols):
            if col == '매출금액구간':
                X[0, i] = sales_encoded
            elif col == '매출건수구간':
                X[0, i] = transaction_encoded
            elif col == '유니크고객수구간':
                X[0, i] = customer_encoded
            elif col == '객단가구간':
                X[0, i] = price_encoded
        
        probability = model.predict_proba(X)[0][1]
        
        return jsonify({
            'closure_probability': float(probability) * 100,
            'risk_level': '높음' if probability > 0.3 else '중간' if probability > 0.1 else '낮음'
        })
        
    except Exception as e:
        import traceback
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@app.route('/options', methods=['GET'])
def get_options():
    if model_package is None:
        return jsonify({
            'error': '예측 기능을 사용할 수 없습니다',
            'sales_ranges': [],
            'transaction_ranges': [],
            'customer_ranges': [],
            'avg_price_ranges': []
        })
    
    try:
        encoders = model_package.get('label_encoders', {})
        
        return jsonify({
            'sales_ranges': [str(x) for x in encoders['매출금액구간'].classes_],
            'transaction_ranges': [str(x) for x in encoders['매출건수구간'].classes_],
            'customer_ranges': [str(x) for x in encoders['유니크고객수구간'].classes_],
            'avg_price_ranges': [str(x) for x in encoders['객단가구간'].classes_]
        })
            
    except Exception as e:
        import traceback
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'ok',
        'model_loaded': model_package is not None,
        'documents_loaded': len(documents) > 0
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5000)))
