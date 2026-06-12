import { notFound } from 'next/navigation';
import { PERSONA_TEMPLATES } from '@ai-character/shared';
import { ChatScreen } from './chat-screen';

// #3 채팅 화면 — 템플릿 id 기준 동적 라우트. 저장 캐릭터(#6/#14)도 같은 라우트로 합류 예정.
export default async function ChatPage({
  params,
}: {
  params: Promise<{ personaId: string }>;
}) {
  const { personaId } = await params;
  const persona = PERSONA_TEMPLATES.find((p) => p.id === personaId);
  if (!persona) notFound();

  return <ChatScreen persona={persona} />;
}
