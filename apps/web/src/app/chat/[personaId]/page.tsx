import { ChatResolver } from './chat-resolver';

// #3 채팅 화면 — 동적 라우트. 템플릿/사용자 캐릭터 모두 client resolve (#6).
export default async function ChatPage({
  params,
}: {
  params: Promise<{ personaId: string }>;
}) {
  const { personaId } = await params;
  return <ChatResolver personaId={personaId} />;
}
