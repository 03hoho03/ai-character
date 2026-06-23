import Link from 'next/link';
import { ConversationInbox } from './conversation-inbox';
import { SessionStatus } from '../session-status';

// #42 대화 인박스 — 계정/익명 소유자의 대화 목록 + 삭제. 클릭 시 해당 채팅으로 진입.
export default function ConversationsPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 font-sans">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold">내 대화</h1>
        <div className="flex items-center gap-4">
          <Link href="/" className="text-sm font-medium underline hover:text-zinc-600">
            홈
          </Link>
          <SessionStatus />
        </div>
      </div>
      <ConversationInbox />
    </main>
  );
}
