"use client";

import { useState, useRef, useEffect } from "react";

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

export default function GuideChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      text: "안녕하세요! 역할 수행 가이드 도우미예요 😊\n궁금한 점을 물어보세요!\n예) \"반주 준비할 때 뭐 해야 해?\" \"1독서 시작 멘트가 뭐야?\"",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    const q = input.trim();
    if (!q || isLoading) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: q }]);
    setIsLoading(true);

    try {
      const res = await fetch("/api/rag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: data.answer ?? "답변을 가져오지 못했어요." },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: "오류가 발생했어요. 잠시 후 다시 시도해주세요." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* 플로팅 버튼 */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 text-white rounded-full shadow-lg
                   flex items-center justify-center transition-all active:scale-95 hover:opacity-90"
        style={{ backgroundColor: "#0077B6" }}
        aria-label="역할 가이드 챗봇"
      >
        {isOpen ? (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <span className="text-2xl">💬</span>
        )}
      </button>

      {/* 챗봇 패널 */}
      {isOpen && (
        <div
          className="fixed bottom-24 right-4 z-40 w-[calc(100vw-2rem)] max-w-sm
                     bg-white rounded-3xl shadow-2xl border border-gray-100
                     flex flex-col overflow-hidden"
          style={{ height: "70vh", maxHeight: "520px" }}
        >
          {/* 헤더 */}
          <div className="px-4 py-3 flex items-center gap-2 flex-shrink-0"
               style={{ background: "linear-gradient(135deg, #0077B6 0%, #00ADB5 100%)" }}>
            <span className="text-xl">📖</span>
            <div>
              <p className="text-white font-bold text-sm">역할 가이드 도우미</p>
              <p className="text-orange-100 text-xs">어망 공식 가이드 기반 AI</p>
            </div>
          </div>

          {/* 메시지 목록 */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className="max-w-[85%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed"
                  style={
                    m.role === "user"
                      ? { backgroundColor: "#0077B6", color: "white", borderBottomRightRadius: "4px" }
                      : { backgroundColor: "#F0F9FF", color: "#1f2937", borderBottomLeftRadius: "4px" }
                  }
                >
                  {m.text}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
              <div className="px-3 py-2 rounded-2xl rounded-bl-sm text-sm flex items-center gap-2"
                   style={{ backgroundColor: "#F0F9FF", color: "#6b7280" }}>
                <div className="w-3 h-3 rounded-full border-2 border-blue-100 border-t-[#0077B6] animate-spin" />
                답변 생성 중...
              </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* 입력창 */}
          <div className="flex-shrink-0 px-3 py-2 flex gap-2 border-t" style={{ borderColor: "#DBEAFE" }}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder="질문을 입력하세요..."
              disabled={isLoading}
              className="flex-1 px-3 py-2 rounded-xl text-sm text-gray-900
                         placeholder:text-gray-400 focus:outline-none disabled:opacity-50"
              style={{ backgroundColor: "#F0F9FF", border: "1.5px solid #DBEAFE" }}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              className="px-3 py-2 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-40"
              style={{ backgroundColor: "#0077B6" }}
            >
              전송
            </button>
          </div>
        </div>
      )}
    </>
  );
}
