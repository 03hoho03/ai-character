import { PERSONA_TEMPLATES, SHARED_PACKAGE_NAME, type Persona } from "@ai-character/shared";

// #4: 시드 첫 템플릿 소비 — #6/#7에서 템플릿 목록 UI로 대체
const placeholder: Persona = PERSONA_TEMPLATES[0];

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
