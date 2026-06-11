import { Controller, Get } from '@nestjs/common';
import { PERSONA_TEMPLATES, SHARED_PACKAGE_NAME, type Persona } from '@ai-character/shared';

// shared 타입 소비 확인용 placeholder — #2a에서 실제 chat 모듈로 대체 (#4: 시드 첫 템플릿 소비)
const placeholder: Persona = PERSONA_TEMPLATES[0];

@Controller()
export class AppController {
  @Get('health')
  health() {
    return { status: 'ok', shared: SHARED_PACKAGE_NAME, persona: placeholder.name };
  }
}
