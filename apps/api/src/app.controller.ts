import { Controller, Get } from '@nestjs/common';
import { SHARED_PACKAGE_NAME, type Persona } from '@ai-character/shared';

// shared 타입 소비 확인용 placeholder — #2a에서 실제 chat 모듈로 대체
const placeholder: Persona = { id: 'placeholder', name: 'AI Character' };

@Controller()
export class AppController {
  @Get('health')
  health() {
    return { status: 'ok', shared: SHARED_PACKAGE_NAME, persona: placeholder.name };
  }
}
