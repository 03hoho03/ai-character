import { NotFoundException } from '@nestjs/common';
import { CharactersService } from '../src/characters/characters.service';

/**
 * #16 CharactersService 단위 테스트 — Prisma를 모킹해 권한/CRUD 로직만 검증.
 * prd.md 성공 기준에 매핑. 소유권 모델은 conversations(#14) 패턴과 동일:
 * 불일치/부재는 존재를 노출하지 않고 404.
 */
describe('CharactersService', () => {
  const character = {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  const prisma = { character } as never;
  let service: CharactersService;

  /** 생성 본문 fixture — shared Persona + isPublic */
  const draft = {
    id: 'usr-1',
    browserId: 'owner',
    name: '테스트',
    tagline: '한줄',
    personality: '성격',
    speechStyle: '말투',
    worldview: '세계관',
    greeting: '안녕',
    exampleDialogue: [{ user: 'u', model: 'm' }],
    prohibitions: ['금지'],
    isPublic: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CharactersService(prisma);
  });

  describe('create', () => {
    it('신규 id면 캐릭터를 생성한다', async () => {
      character.findUnique.mockResolvedValue(null);
      character.create.mockImplementation(({ data }: { data: unknown }) => data);

      const result = await service.create(draft);

      expect(character.create).toHaveBeenCalledTimes(1);
      const arg = character.create.mock.calls[0][0];
      expect(arg.data.id).toBe('usr-1');
      expect(arg.data.browserId).toBe('owner');
      expect(result).toMatchObject({ id: 'usr-1', name: '테스트' });
    });

    it('같은 id를 소유자가 재요청하면 upsert(갱신)한다', async () => {
      character.findUnique.mockResolvedValue({ id: 'usr-1', browserId: 'owner' });
      character.update.mockImplementation(
        ({ data }: { data: Record<string, unknown> }) => ({ id: 'usr-1', ...data }),
      );

      await service.create({ ...draft, name: '바뀜' });

      expect(character.create).not.toHaveBeenCalled();
      expect(character.update).toHaveBeenCalledTimes(1);
      expect(character.update.mock.calls[0][0].where).toEqual({ id: 'usr-1' });
    });

    it('같은 id를 타인이 점유 중이면 NotFound (덮어쓰기 거부, 존재 비노출)', async () => {
      character.findUnique.mockResolvedValue({ id: 'usr-1', browserId: 'someone-else' });

      await expect(service.create(draft)).rejects.toBeInstanceOf(NotFoundException);
      expect(character.create).not.toHaveBeenCalled();
      expect(character.update).not.toHaveBeenCalled();
    });
  });

  describe('getOwned', () => {
    it('browserId 소유 캐릭터를 updatedAt desc로 조회한다', async () => {
      const list = [{ id: 'usr-1' }];
      character.findMany.mockResolvedValue(list);

      const result = await service.getOwned('owner');

      expect(result).toBe(list);
      expect(character.findMany).toHaveBeenCalledWith({
        where: { browserId: 'owner' },
        orderBy: { updatedAt: 'desc' },
      });
    });
  });

  describe('listPublic', () => {
    it('isPublic=true 캐릭터만 updatedAt desc로 조회한다 (q 없음)', async () => {
      const list = [{ id: 'usr-pub' }];
      character.findMany.mockResolvedValue(list);

      const result = await service.listPublic();

      expect(result).toBe(list);
      // #26 기본 공개목록은 일반(all)만 — 성인은 opt-in 없이 노출 안 됨
      expect(character.findMany).toHaveBeenCalledWith({
        where: { isPublic: true, contentRating: 'all' },
        orderBy: { updatedAt: 'desc' },
      });
    });

    it('#24 q가 있으면 isPublic + name/tagline contains(대소문자 무시) OR로 조회한다', async () => {
      character.findMany.mockResolvedValue([]);

      await service.listPublic({ q: '마법' });

      expect(character.findMany).toHaveBeenCalledWith({
        where: {
          isPublic: true,
          contentRating: 'all',
          OR: [
            { name: { contains: '마법', mode: 'insensitive' } },
            { tagline: { contains: '마법', mode: 'insensitive' } },
          ],
        },
        orderBy: { updatedAt: 'desc' },
      });
    });

    it('#24 q가 공백/빈 문자열이면 검색 없이 공개 일반 목록으로 처리한다', async () => {
      character.findMany.mockResolvedValue([]);

      await service.listPublic({ q: '   ' });

      expect(character.findMany).toHaveBeenCalledWith({
        where: { isPublic: true, contentRating: 'all' },
        orderBy: { updatedAt: 'desc' },
      });
    });

    it('#24 비공개는 q 검색에서도 항상 제외(where에 isPublic:true 고정)', async () => {
      character.findMany.mockResolvedValue([]);

      await service.listPublic({ q: '아무거나' });

      const arg = character.findMany.mock.calls[0][0];
      expect(arg.where.isPublic).toBe(true);
    });

    it('#25 category/tag 필터를 등호/has로 AND 결합한다', async () => {
      character.findMany.mockResolvedValue([]);

      await service.listPublic({ category: '판타지', tag: '마법' });

      const where = character.findMany.mock.calls[0][0].where;
      expect(where.isPublic).toBe(true);
      expect(where.category).toBe('판타지');
      expect(where.tags).toEqual({ has: '마법' });
    });

    it('#26 includeAdult=true면 contentRating 제약을 풀어 성인 포함', async () => {
      character.findMany.mockResolvedValue([]);

      await service.listPublic({ includeAdult: 'true' });

      const where = character.findMany.mock.calls[0][0].where;
      expect(where.isPublic).toBe(true);
      expect(where.contentRating).toBeUndefined();
    });
  });

  describe('getOne', () => {
    it('소유자는 비공개 캐릭터도 조회한다', async () => {
      const own = { id: 'usr-1', browserId: 'owner', isPublic: false };
      character.findUnique.mockResolvedValue(own);

      expect(await service.getOne('usr-1', 'owner')).toBe(own);
    });

    it('비소유자는 공개 캐릭터를 조회한다', async () => {
      const pub = { id: 'usr-1', browserId: 'owner', isPublic: true };
      character.findUnique.mockResolvedValue(pub);

      expect(await service.getOne('usr-1', 'stranger')).toBe(pub);
    });

    it('비소유자가 비공개 캐릭터를 조회하면 NotFound (존재 비노출)', async () => {
      character.findUnique.mockResolvedValue({ id: 'usr-1', browserId: 'owner', isPublic: false });

      await expect(service.getOne('usr-1', 'stranger')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('없으면 NotFound', async () => {
      character.findUnique.mockResolvedValue(null);
      await expect(service.getOne('nope', 'anyone')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('update', () => {
    it('소유자는 부분 갱신한다', async () => {
      character.findUnique.mockResolvedValue({ id: 'usr-1', browserId: 'owner' });
      character.update.mockResolvedValue({ id: 'usr-1', name: '새이름' });

      const result = await service.update('usr-1', 'owner', { name: '새이름' });

      expect(result).toMatchObject({ name: '새이름' });
      expect(character.update).toHaveBeenCalledWith({
        where: { id: 'usr-1' },
        data: { name: '새이름' },
      });
    });

    it('소유자가 아니면 NotFound', async () => {
      character.findUnique.mockResolvedValue({ id: 'usr-1', browserId: 'owner' });
      await expect(service.update('usr-1', 'attacker', { name: 'x' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(character.update).not.toHaveBeenCalled();
    });

    it('없으면 NotFound', async () => {
      character.findUnique.mockResolvedValue(null);
      await expect(service.update('nope', 'owner', { name: 'x' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('소유자는 삭제한다', async () => {
      character.findUnique.mockResolvedValue({ id: 'usr-1', browserId: 'owner' });
      character.delete.mockResolvedValue({ id: 'usr-1' });

      await service.remove('usr-1', 'owner');

      expect(character.delete).toHaveBeenCalledWith({ where: { id: 'usr-1' } });
    });

    it('소유자가 아니면 NotFound (삭제 안 함)', async () => {
      character.findUnique.mockResolvedValue({ id: 'usr-1', browserId: 'owner' });
      await expect(service.remove('usr-1', 'attacker')).rejects.toBeInstanceOf(NotFoundException);
      expect(character.delete).not.toHaveBeenCalled();
    });
  });
});
