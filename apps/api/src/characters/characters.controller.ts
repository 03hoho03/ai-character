import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CharactersService } from './characters.service';
import {
  BrowserIdQueryDto,
  CreateCharacterDto,
  PublicSearchQueryDto,
  UpdateCharacterDto,
} from './dto/character.dto';

/**
 * #16 캐릭터 CRUD API. 소유자 = 익명 browserId(요청 동반).
 * 쓰기는 소유자만, 읽기는 소유자 전체 + 비소유자는 isPublic만(목록+상세).
 * 라우트 선언 순서 주의: 리터럴 'public'을 ':id'보다 먼저 둬야 가로채이지 않는다.
 */
@Controller('characters')
export class CharactersController {
  constructor(private readonly characters: CharactersService) {}

  /** 생성. 같은 id 재요청은 소유자면 upsert */
  @Post()
  create(@Body() body: CreateCharacterDto) {
    return this.characters.create(body);
  }

  /** 내 캐릭터 목록(최신순) */
  @Get()
  getOwned(@Query() query: BrowserIdQueryDto) {
    return this.characters.getOwned(query.browserId);
  }

  /** 공개 캐릭터 목록(최신순). #24 q=이름/한줄소개 검색, #25 category/tag 필터 */
  @Get('public')
  listPublic(@Query() query: PublicSearchQueryDto) {
    return this.characters.listPublic(query);
  }

  /** 단건. 소유자거나 isPublic이면 200, 아니면 404 */
  @Get(':id')
  getOne(@Param('id') id: string, @Query() query: BrowserIdQueryDto) {
    return this.characters.getOne(id, query.browserId);
  }

  /** 부분 갱신(소유자만). browserId는 인증용이라 갱신 데이터에서 제외 */
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateCharacterDto) {
    const { browserId, ...patch } = body;
    return this.characters.update(id, browserId, patch as unknown as Prisma.CharacterUpdateInput);
  }

  /** 삭제(소유자만) */
  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string, @Query() query: BrowserIdQueryDto) {
    return this.characters.remove(id, query.browserId);
  }
}
