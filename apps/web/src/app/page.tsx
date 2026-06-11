import { SHARED_PACKAGE_NAME, type Persona } from "@ai-character/shared";

// shared 타입 소비 확인용 placeholder — #4에서 실제 템플릿 데이터로 교체
const placeholder: Persona = { id: "placeholder", name: "AI Character" };

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 font-sans">
      <h1 className="text-3xl font-bold">{placeholder.name}</h1>
      <p className="text-sm text-zinc-500">
        monorepo scaffold ok — shared: {SHARED_PACKAGE_NAME}
      </p>
    </main>
  );
}
