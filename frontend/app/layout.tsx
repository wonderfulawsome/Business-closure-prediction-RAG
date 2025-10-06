import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '폐업 위기 예측 챗봇',
  description: 'RAG 기반 폐업 위기 분석 시스템',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
