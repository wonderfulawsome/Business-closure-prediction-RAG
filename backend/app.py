from flask import Flask, request, jsonify
from flask_cors import CORS
from google import genai
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain_huggingface import HuggingFaceEmbeddings
from langchain.schema import Document
import os

app = Flask(__name__)
CORS(app)

# Gemini API 클라이언트
client = genai.Client(api_key=os.environ.get('GEMINI_API_KEY'))

# 문서 데이터
raw_documents = [
    """폐업 위기 경보 시스템 임계치 설정

위험 신호 (주의 단계):
- 배달매출금액비율: > 12%
- 동일업종매출금액비율: < 150%
- 동일업종매출건수비율: < 140%
- 동일업종내매출순위비율: > 21%
- 동일상권내매출순위비율: > 27%
- 남성40대고객비중: < 9%
- 남성50대고객비중: < 8%
- 남성60대이상고객비중: < 3.5%
- 여성20대이하고객비중: > 13%
- 여성30대고객비중: > 13%
- 객단가구간: 3-4구간 (25~75%)
- 유니크고객수구간: < 3구간 (25% 미만)

고위험 (경보 단계):
- 배달매출금액비율: > 14%
- 동일업종매출금액비율: < 120%
- 동일업종매출건수비율: < 120%
- 동일업종내매출순위비율: > 30%
- 동일상권내매출순위비율: > 35%
- 남성40대고객비중: < 8%
- 남성50대고객비중: < 7.5%
- 남성60대이상고객비중: < 3%
- 여성20대이하고객비중: > 15%
- 여성30대고객비중: > 15%""",
    
    """복합 위험 점수 기준:
- 1~2개 충족: 관심 단계
- 3~5개 충족: 주의 단계
- 6개 이상 충족: 경보 단계""",
    
    """업종별 평균 폐업확률:
1. 와인바: 66.42% (6개 가맹점)
2. 중식-훠궈/마라탕: 22.56% (37개)
3. 식료품: 12.03% (84개)
4. 기타세계요리: 10.79% (106개)
5. 샌드위치/토스트: 10.04% (90개)
6. 동남아/인도음식: 9.33% (104개)
7. 요리주점: 9.28% (254개)
8. 분식: 7.50% (708개)
9. 한식-국밥/설렁탕: 6.53% (257개)
10. 햄버거: 6.03% (22개)
11. 베이커리: 5.75% (281개)
12. 한식-단품요리일반: 4.02% (1035개)
13. 카페: 3.80% (569개)
14. 커피전문점: 3.35% (1695개)
15. 양식: 3.30% (2027개)
16. 한식-해물/생선: 2.67% (1373개)
17. 치킨: 1.79% (747개)
18. 백반/가정식: 1.65% (816개)
19. 한식-육류/고기: 1.47% (1534개)
20. 피자: 0.76% (1323개)""",
    
    """지역별 실제 폐업 가맹점 수 (서울 성동구):
1. 왕십리로길: 69개
2. 행당로: 61개
3. 용답길: 39개
4. 상원길: 35개
5. 금호로: 30개
6. 마조로길: 27개
7. 금호산길: 25개
8. 서울숲길: 24개
9. 아차산로길: 24개
10. 사근동길: 24개""",
    
    """지역별 평균 폐업확률 (서울 성동구):
1. 사근동길: 26.19% (24개)
2. 서울숲길: 24.49% (24개)
3. 고산자로길: 22.82% (22개)
4. 용답길: 21.71% (39개)
5. 뚝섬로: 21.54% (12개)
6. 아차산로길: 20.65% (24개)
7. 왕십리로길: 19.67% (69개)
8. 마조로길: 18.41% (27개)
9. 금호산길: 17.11% (25개)
10. 무학봉길: 16.98% (4개)"""
]

# 벡터 스토어 초기화 (앱 시작 시 한 번만)
vectorstore = None

def initialize_vectorstore():
    """FAISS 벡터 스토어 초기화"""
    global vectorstore
    
    # LangChain Document 객체로 변환
    documents = [Document(page_content=text) for text in raw_documents]
    
    # 로컬 임베딩 모델 (HuggingFace - 무료, API 호출 없음)
    embeddings = HuggingFaceEmbeddings(
        model_name="sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
    )
    
    # FAISS 벡터 스토어 생성
    vectorstore = FAISS.from_documents(documents, embeddings)
    print("✅ 벡터 스토어 초기화 완료")

@app.route('/chat', methods=['POST'])
def chat():
    try:
        data = request.json
        query = data.get('message', '')
        
        # 벡터 스토어에서 관련 문서 검색 (상위 3개)
        docs = vectorstore.similarity_search(query, k=3)
        context = "\n\n".join([doc.page_content for doc in docs])
        
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

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'})

# 앱 시작 시 벡터 스토어 초기화
initialize_vectorstore()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5000)))
