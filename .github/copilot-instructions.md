답변은 항상 한국어로 해줘.
모든 코드는 TypeScript로 작성해줘.

# 기술 스택

- Node.js : ^20.0.0
- package manager : pnpm ^10.0.0

**dependencies**

- "@nestjs/common": "^10.3.2"
- "@nestjs/core": "^10.3.2"
- "class-transformer": "^0.5.1"
- "class-validator": "^0.14.1"
- "rxjs": "^7.8.1"

**devDependencies**

- "eslint": "^8.42.0"
- "jest": "^29.5.0"
- "supertest": "^6.3.3"
- "ts-jest": "^29.1.0"
- "ts-node": "^10.9.1"
- "typescript": "^5.1.3"

# 커스텀 커맨드

- `사이드이펙트 리팩토링` : 테스트 코드에서 사이드 이펙트가 발생하는 코드를 반드시 빠짐없이 목업하고, 검증 로직을 추가하도록 리팩토링
- `유닛테스트 실행`: `pnpm run test:dev`
- `통합테스트 실행`: `pnpm run test:e2e`
- `유닛테스트 커버리지 생성`: `pnpm run test:coverage`
- `ESLint 실행`: `pnpm run lint`
- `전역포맷팅`: `npx prettier --write .`

# 프로젝트 설명

이 프로젝트는 NestJS 프레임워크를 사용하여 클린아키텍처 원칙에 따라 설계된 RESTful API 서버입니다.
주요 기능으로는 사용자 포인트를 조회, 충전, 차감하는 기능이 포함되어 있습니다.

# 파일 구조 규칙

- `filename.controller.ts`: 컨트롤러 레이어
- `filename.service.ts`: 서비스 레이어
- `filename.repository.ts`: 레포지토리 레이어
- `filename.module.ts`: 모듈 정의
- `dto/`: 데이터 전송 객체(DTO) 정의
- `entities/`: 엔티티 정의
- `interfaces/`: 인터페이스 정의
- `filename.spec.ts`: 유닛 테스트 파일
- `filename.e2e-spec.ts`: 통합 테스트 파일
- `__mocks__/`: 테스트용 목 데이터

# 코드 컨벤션

- 리스트를 반환하는 함수는 `getSomethingList` 형태로, getSomethings가 아니라 List 접미사를 붙입니다.
- 객체를 반환하는 함수는 `getSomethings` 형태로 네이밍합니다.
- 스트링, 넘버, 불린 등의 원시 타입을 반환하는 함수는 `getSomething` 형태로 네이밍합니다. 넘버는 amount, count 등의 접미사를 붙일 수 있습니다.
- 테스트 컨벤션은 Given-When-Then 패턴을 따릅니다.
- Promise를 반환하는 함수는 async/await 구문을 사용합니다.
- boolean 타입의 판별 함수는 `isSomething` 형태로 네이밍합니다.
- switch문은 사용하지 않고, if-else 구문을 사용합니다.
- 조건문은 의도가 잘 표현된 형태의 변수를 선언 후 해당 변수를 사용합니다.
- ES6 이상의 문법을 적극 활용합니다.

# 스크립트 명령어

- `pnpm run start:dev`: 개발 모드로 시작 (파일 변경 감지)
- `pnpm run lint`: ESLint를 사용한 코드 검사 및 자동 수정
- `pnpm run test`: 단위 테스트 실행
- `pnpm run test:watch`: 테스트 감시 모드
- `pnpm run test:coverage`: 테스트 커버리지 생성
- `pnpm run test:debug`: 테스트 디버그 모드
- `pnpm run test:e2e`: 통합 테스트 실행
- `pnpm run sonar`: SonarQube 보고서 생성

# 개발 규칙

- ESM 모듈 방식을 사용
- 단일 책임 원칙 준수
- 테스트 커버리지 100%를 목표
- 타입스크립트 엄격 모드를 준수

# 개발 워크플로우

## 켄트 벡의 증강 코딩 원칙

- 증강코딩 + 바이브코딩 : 코드 품질, 테스트, 단순성을 중시하되 AI를 활용하여 생산성을 높임.
- 중간 결과 관찰 : 작은 단위로 코드를 작성하고, 각 단계에서 결과를 확인.
- 피드백 루프 단축 : 자주 테스트하고, 빠르게 피드백을 받아 수정.
- 점진적 개선 : 초기 버전에서 시작하여 점진적으로 기능을 추가하고 개선.
- 명확한 목표 설정 : 각 개발 세션마다 명확한 목표를 설정하고, 이를 달성하기 위한 계획을 수립.

# 커밋 메시지 규칙

- feat: 새로운 기능 추가
- fix: 버그 수정
- docs: 문서 수정
- style: 코드 포맷팅, 세미콜론 누락 등 코드 변경이 없는 경우
- refactor: 코드 리팩토링
- test: 테스트 코드 추가, 수정
- chore: 빌드 업무 수정, 패키지 매니저 설정 등 기타 변경

# 테스트 예시 구조

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { PointService } from './point.service';
import { PointLockService } from './point-lock.service';
import { UserPointTable } from '../database/userpoint.table';
import { PointHistoryTable } from '../database/pointhistory.table';

describe('PointService', () => {
  let service: PointService;
  let userPointTable: UserPointTable;
  let pointHistoryTable: PointHistoryTable;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PointService,
        PointLockService,
        UserPointTable,
        PointHistoryTable,
      ],
    }).compile();

    service = module.get<PointService>(PointService);
    userPointTable = module.get<UserPointTable>(UserPointTable);
    pointHistoryTable = module.get<PointHistoryTable>(PointHistoryTable);
  });

  describe('getUserPoint', () => {
    it('특정 유저의 포인트를 조회할 수 있다', async () => {
      // Given
      const userId = 1;
      const expectedPoint = {
        id: userId,
        point: 100,
        updateMillis: Date.now(),
      };
      jest.spyOn(userPointTable, 'selectById').mockResolvedValue(expectedPoint);

      // When
      const result = await service.getUserPoint(userId);

      // Then
      expect(result).toEqual(expectedPoint);
      expect(userPointTable.selectById).toHaveBeenCalledWith(userId);
    });
  });
});
```
