# 유저 포인트 관리 시스템

## Node.js 동시성 제어 방식 및 구현 전략

### 1. Node.js의 동시성 모델

Node.js는 **Single Thread Event Loop** 기반으로 동작하지만, 비동기 I/O 작업으로 인해 **Race Condition** 문제가 발생할 수 있습니다.

```
[요청 A] ───┐             ┌─→ [DB 조회: 1000원]
            ├─→ Event Loop ├─→ [계산: 1000 + 100]
[요청 B] ───┘             └─→ [DB 조회: 1000원] ← 문제 발생!
```

**문제 상황**: 두 요청이 거의 동시에 들어오면 같은 초기값(1000원)을 읽고 각각 100원씩 충전하여, 최종적으로 1100원(❌)이 되어야 할 값이 1200원(⭕)으로 저장되지 않음

### 2. Node.js 락(In-Memory Lock) 구현 방식 비교

| 방식                         | 설명                            | 장점                                                    | 단점                                         |
| ---------------------------- | ------------------------------- | ------------------------------------------------------- | -------------------------------------------- |
| **Mutex (본 프로젝트 구현)** | Map 기반 Promise Lock           | • 구현이 매우 간단<br>• 빠른 응답 속도<br>• Zero 의존성 | • 단일 서버만 지원<br>• 재시작 시 Lock 소실  |
| **Semaphore**                | 동시 접근 가능한 리소스 수 제한 | • 동시 실행 수 제어<br>• 처리량 조절 가능               | • 순서 보장 없음<br>• 복잡한 동기화 로직     |
| **Queue 기반**               | 작업을 배열에 적재 후 순차 실행 | • FIFO 순서 보장<br>• 우선순위 큐 구현 가능             | • 메모리 사용량 증가<br>• 복잡한 에러 핸들링 |

**본 프로젝트 선택**: **Mutex (Map 기반 구현)** - 단일 인스턴스 환경에서 가장 간단하면서도 효과적인 동시성 제어 방식

### 3. Mutex 기반 구현 상세

#### 3.1 핵심 로직

```typescript
private locks = new Map<number, Promise<void>>();

async executeWithLock<T>(userId: number, fn: () => Promise<T>): Promise<T> {
  // 1. 대기: 현재 실행 중인 작업이 있다면 완료될 때까지 대기
  while (this.locks.has(userId)) {
    await this.locks.get(userId);
  }

  // 2. Lock 획득: 새로운 작업 시작을 다른 요청에게 알림
  let releaseLock: () => void;
  const lockPromise = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });
  this.locks.set(userId, lockPromise);

  try {
    // 3. 작업 실행: DB 조회/수정 등 비즈니스 로직 실행
    return await fn();
  } finally {
    // 4. Lock 해제: 작업 완료를 다른 요청에게 알림
    this.locks.delete(userId);
    releaseLock();
  }
}
```

#### 3.2 동작 흐름

```
시간 →

[요청 A] executeWithLock 진입
         ├─ locks.has(1)? NO
         ├─ locks.set(1, Promise) ──┐
         ├─ DB 조회 (1000원)         │
         ├─ 계산 (1000 + 100)        │ Lock 보유
         ├─ DB 저장 (1100원)         │
         └─ locks.delete(1) ─────────┘

[요청 B]                  executeWithLock 진입
                          ├─ locks.has(1)? YES → 대기...
                          └─ A의 작업 완료 후 진입
                             ├─ locks.set(1, Promise)
                             ├─ DB 조회 (1100원)
                             ├─ 계산 (1100 + 100)
                             ├─ DB 저장 (1200원)
                             └─ locks.delete(1)
```

#### 3.3 적용 예시

```typescript
async chargeUserPoint(userId: number, amount: number): Promise<UserPoint> {
  // 입력 검증
  this.validateUserId(userId);
  this.validateAmount(amount);
  this.validateChargeUnit(amount);

  // 동시성 제어 적용
  return this.executeWithLock(userId, async () => {
    const currentPoint = await this.userPointTable.selectById(userId);
    const newPoint = currentPoint.point + amount;

    if (newPoint > this.MAX_POINT) {
      throw new BadRequestException('최대 포인트 초과');
    }

    const updatedPoint = await this.userPointTable.insertOrUpdate(userId, newPoint);
    await this.pointHistoryTable.insert(userId, amount, TransactionType.CHARGE, updatedPoint.updateMillis);

    return updatedPoint;
  });
}
```

### 4. 장단점 분석

#### ✅ 장점

1. **구현 간결성**: 외부 의존성 없이 JavaScript Map 객체만으로 구현
2. **성능**: 메모리 기반으로 Lock 획득/해제가 매우 빠름 (< 1ms)
3. **리소스 격리**: userId별 독립적 Lock으로 다른 사용자 요청은 병렬 처리
4. **코드 가독성**: 비즈니스 로직과 동시성 제어 로직이 명확히 분리

#### ❌ 단점

1. **단일 서버 제약**: 멀티 인스턴스 환경에서는 동작하지 않음
2. **메모리 누수 위험**: Lock 해제 실패 시 메모리 누적 가능 (finally로 방어)
3. **재시작 시 초기화**: 서버 재시작 시 진행 중인 Lock 정보 소실
4. **확장성 한계**: 트래픽 증가 시 Scale-out 불가

### 5. 동시성 테스트 검증

```typescript
// 20개의 동시 충전 요청 (각 100원)
it('충전 시 동시 요청에서 동시성 제어가 적용된다', async () => {
  const promises = [...Array(20)].map(() =>
    request(app.getHttpServer())
      .patch(`/point/${userId}/charge`)
      .send({ amount: 100 }),
  );

  await Promise.allSettled(promises);

  const finalPoint = await getPoint(userId);
  expect(finalPoint).toBe(initialPoint + 2000); // ✅ 정확히 2000원 충전
});
```

**결과**: 단일 사용자의 20회 동시 요청(비동기 이벤트)에 대한 포인트 충전, 사용 동시성 테스트 통과 (100% Success Rate)
