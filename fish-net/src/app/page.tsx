import Link from "next/link";
import { Card, CardContent } from "@/components/Card";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-blue-50">
      <main className="container mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <span className="text-7xl mb-6 block">🐟</span>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            어망 <span className="text-blue-600">Fish-Net</span>
          </h1>
          <p className="text-xl text-gray-600 mb-2">
            비영리 커뮤니티를 위한 AI 역할 배정 솔루션
          </p>
          <p className="text-gray-500">
            교사는 링크만 공유하고 버튼만 누른다.
            <br />
            배정, 교육, 성가 안내까지 AI가 전담한다.
          </p>
        </div>

        <div className="max-w-2xl mx-auto">
          <h2 className="text-center text-lg font-medium text-gray-700 mb-6">
            어떤 역할로 접속하시나요?
          </h2>

          <div className="grid gap-6 md:grid-cols-2">
            <Link href="/teacher" className="block">
              <Card className="h-full hover:shadow-lg transition-all hover:scale-105 border-2 hover:border-blue-500 cursor-pointer">
                <CardContent className="p-8 text-center">
                  <div className="text-5xl mb-4">👨‍🏫</div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">교사</h3>
                  <p className="text-gray-600">
                    미사 일정 관리, AI 배정,
                    <br />
                    성가 설정, 메시지 생성
                  </p>
                  <div className="mt-4 inline-block rounded-full bg-blue-100 px-4 py-2 text-sm font-medium text-blue-700">
                    대시보드 입장 →
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/student" className="block">
              <Card className="h-full hover:shadow-lg transition-all hover:scale-105 border-2 hover:border-green-500 cursor-pointer">
                <CardContent className="p-8 text-center">
                  <div className="text-5xl mb-4">🙋</div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">학생</h3>
                  <p className="text-gray-600">
                    참석 가능 여부 입력,
                    <br />
                    배정 확인, 역할 질문
                  </p>
                  <div className="mt-4 inline-block rounded-full bg-green-100 px-4 py-2 text-sm font-medium text-green-700">
                    응답 페이지 입장 →
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>

        <div className="mt-16 max-w-4xl mx-auto">
          <h2 className="text-center text-2xl font-bold text-gray-900 mb-8">
            주요 기능
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                icon: "📝",
                title: "스마트 가용성 분석",
                desc: "학생 코멘트를 AI가 분석",
              },
              {
                icon: "🤖",
                title: "지능형 배정 엔진",
                desc: "공정하고 효율적인 자동 배정",
              },
              {
                icon: "💬",
                title: "메시지 자동 생성",
                desc: "카카오톡 메시지 초안 생성",
              },
              {
                icon: "🎵",
                title: "성가 안내",
                desc: "야훼이레 성가 목록 관리",
              },
              {
                icon: "📚",
                title: "RAG 교육 비서",
                desc: "역할별 가이드 질문 답변",
              },
              {
                icon: "🔄",
                title: "실시간 동기화",
                desc: "즉시 반영되는 데이터",
              },
            ].map((feature, i) => (
              <div
                key={i}
                className="rounded-lg border bg-white p-4 text-center hover:shadow-md transition-shadow"
              >
                <div className="text-3xl mb-2">{feature.icon}</div>
                <h3 className="font-semibold text-gray-900">{feature.title}</h3>
                <p className="text-sm text-gray-500">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <footer className="mt-16 text-center text-sm text-gray-500">
          <p>© 2026 어망 (Fish-Net). 비영리 커뮤니티를 위한 AI 솔루션.</p>
        </footer>
      </main>
    </div>
  );
}
