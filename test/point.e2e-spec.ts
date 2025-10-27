import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { TransactionType } from '../src/point/point.model';

describe('Point System (e2e)', () => {
  let app: INestApplication;

  // 포인트 정책 상수
  const MAX_POINT = 10000;
  const CHARGE_POINT_UNIT = 100;
  const USE_POINT_UNIT = 100;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('포인트 조회 (GET)', () => {
    it('유효한 사용자 ID로 포인트를 조회할 수 있다', async () => {
      // Given
      const userId = 1;

      // When & Then
      const response = await request(app.getHttpServer())
        .get(`/point/${userId}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', userId);
      expect(response.body).toHaveProperty('point');
      expect(response.body).toHaveProperty('updateMillis');
      expect(typeof response.body.point).toBe('number');
    });

    it('유효하지 않은 사용자 ID로 조회 시 400 오류를 반환한다', async () => {
      // Given
      const invalidUserId = -1;

      // When & Then
      await request(app.getHttpServer())
        .get(`/point/${invalidUserId}`)
        .expect(400);
    });

    it('포인트 히스토리를 조회할 수 있다', async () => {
      // Given
      const userId = 1;

      // When & Then
      const response = await request(app.getHttpServer())
        .get(`/point/${userId}/histories`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('포인트 충전 (PATCH)', () => {
    it('유효한 금액으로 포인트를 충전할 수 있다', async () => {
      // Given
      const userId = 1;
      const chargeAmount = CHARGE_POINT_UNIT;

      // 초기 포인트 조회
      const initialResponse = await request(app.getHttpServer())
        .get(`/point/${userId}`)
        .expect(200);
      const initialPoint = initialResponse.body.point;

      // When
      const chargeResponse = await request(app.getHttpServer())
        .patch(`/point/${userId}/charge`)
        .send({ amount: chargeAmount })
        .expect(200);

      // Then
      expect(chargeResponse.body.point).toBe(initialPoint + chargeAmount);
      expect(chargeResponse.body.id).toBe(userId);
    });

    it('충전 단위와 다르게 충전 시 400 오류를 반환한다', async () => {
      // Given
      const userId = 1;
      const invalidAmount = CHARGE_POINT_UNIT - 1;

      // When & Then
      await request(app.getHttpServer())
        .patch(`/point/${userId}/charge`)
        .send({ amount: invalidAmount })
        .expect(400);
    });

    it('최대 포인트 한도를 초과하여 충전 시 400 오류를 반환한다', async () => {
      // Given
      const userId = 2;
      const excessiveAmount = MAX_POINT + CHARGE_POINT_UNIT;

      // When & Then
      await request(app.getHttpServer())
        .patch(`/point/${userId}/charge`)
        .send({ amount: excessiveAmount })
        .expect(400);
    });

    it('0 이하의 금액으로 충전 시 400 오류를 반환한다', async () => {
      // Given
      const userId = 1;
      const invalidAmount = -100;

      // When & Then
      await request(app.getHttpServer())
        .patch(`/point/${userId}/charge`)
        .send({ amount: invalidAmount })
        .expect(400);
    });
  });

  describe('포인트 사용 (PATCH)', () => {
    it('유효한 금액으로 포인트를 사용할 수 있다', async () => {
      // Given
      const userId = 3;
      const chargeAmount = 1000;
      const useAmount = USE_POINT_UNIT;

      // 포인트를 먼저 충전
      await request(app.getHttpServer())
        .patch(`/point/${userId}/charge`)
        .send({ amount: chargeAmount })
        .expect(200);

      // 현재 포인트 조회
      const currentResponse = await request(app.getHttpServer())
        .get(`/point/${userId}`)
        .expect(200);
      const currentPoint = currentResponse.body.point;

      // When
      const useResponse = await request(app.getHttpServer())
        .patch(`/point/${userId}/use`)
        .send({ amount: useAmount })
        .expect(200);

      // Then
      expect(useResponse.body.point).toBe(currentPoint - useAmount);
      expect(useResponse.body.id).toBe(userId);
    });

    it('최소 사용 단위 미만으로 사용 시 400 오류를 반환한다', async () => {
      // Given
      const userId = 1;
      const invalidAmount = USE_POINT_UNIT - 1;

      // When & Then
      await request(app.getHttpServer())
        .patch(`/point/${userId}/use`)
        .send({ amount: invalidAmount })
        .expect(400);
    });

    it('보유 포인트보다 많은 금액 사용 시 400 오류를 반환한다', async () => {
      // Given
      const userId = 4;
      const excessiveAmount = MAX_POINT * 2;

      // When & Then
      await request(app.getHttpServer())
        .patch(`/point/${userId}/use`)
        .send({ amount: excessiveAmount })
        .expect(400);
    });

    it('0 이하의 금액으로 사용 시 400 오류를 반환한다', async () => {
      // Given
      const userId = 1;
      const invalidAmount = -100;

      // When & Then
      await request(app.getHttpServer())
        .patch(`/point/${userId}/use`)
        .send({ amount: invalidAmount })
        .expect(400);
    });
  });

  describe('동시성 제어 테스트', () => {
    it('동일 사용자에 대한 순차적인 충전과 사용 요청이 올바르게 처리된다', async () => {
      // Given
      const userId = 7;
      const initialChargeAmount = 1000;
      const chargeAmount = CHARGE_POINT_UNIT;
      const useAmount = USE_POINT_UNIT;

      // 초기 포인트 충전
      await request(app.getHttpServer())
        .patch(`/point/${userId}/charge`)
        .send({ amount: initialChargeAmount })
        .expect(200);

      // 현재 포인트 조회
      const currentResponse = await request(app.getHttpServer())
        .get(`/point/${userId}`)
        .expect(200);
      const currentPoint = currentResponse.body.point;

      // When - 충전과 사용을 번갈아 실행 (순차 처리)
      for (let i = 0; i < 10; i++) {
        await request(app.getHttpServer())
          .patch(`/point/${userId}/charge`)
          .send({ amount: chargeAmount })
          .expect(200);

        await request(app.getHttpServer())
          .patch(`/point/${userId}/use`)
          .send({ amount: useAmount })
          .expect(200);
      }

      // Then - 최종 포인트 확인 (2번 충전, 2번 사용)
      const finalResponse = await request(app.getHttpServer())
        .get(`/point/${userId}`)
        .expect(200);

      const expectedPoint = currentPoint + chargeAmount * 2 - useAmount * 2;
      expect(finalResponse.body.point).toBe(expectedPoint);
    });

    it('충전 시 동시 요청에서 동시성 제어가 적용된다', async () => {
      // Given
      const userId = 12;
      const chargeAmount = CHARGE_POINT_UNIT;

      // 초기 포인트 조회
      const initialResponse = await request(app.getHttpServer())
        .get(`/point/${userId}`)
        .expect(200);
      const initialPoint = initialResponse.body.point;

      // When - 동시에 충전 요청 20회 실행
      const promises = [...Array(20)].map(() =>
        request(app.getHttpServer())
          .patch(`/point/${userId}/charge`)
          .send({ amount: chargeAmount }),
      );

      const responses = await Promise.allSettled(promises);

      // Then - 모든 요청이 성공해야 함
      const successfulResponses = responses.filter(
        (response) =>
          response.status === 'fulfilled' && response.value.status === 200,
      );

      expect(successfulResponses.length).toBe(20);

      // 최종 포인트는 정확히 20번 충전된 금액이어야 함
      const finalResponse = await request(app.getHttpServer())
        .get(`/point/${userId}`)
        .expect(200);

      expect(finalResponse.body.point).toBe(initialPoint + chargeAmount * 20);
    });

    it('사용 시 동시 요청에서 동시성 제어가 적용된다', async () => {
      // Given
      const userId = 13;
      const chargeAmount = 5000; // 충분한 포인트 충전
      const useAmount = USE_POINT_UNIT;

      // 초기 포인트 충전
      await request(app.getHttpServer())
        .patch(`/point/${userId}/charge`)
        .send({ amount: chargeAmount })
        .expect(200);

      // 충전 후 포인트 조회
      const chargedResponse = await request(app.getHttpServer())
        .get(`/point/${userId}`)
        .expect(200);
      const chargedPoint = chargedResponse.body.point;

      // When - 동시에 사용 요청 20회 실행
      const promises = [...Array(20)].map(() =>
        request(app.getHttpServer())
          .patch(`/point/${userId}/use`)
          .send({ amount: useAmount }),
      );

      const responses = await Promise.allSettled(promises);

      // Then - 모든 요청이 성공해야 함
      const successfulResponses = responses.filter(
        (response) =>
          response.status === 'fulfilled' && response.value.status === 200,
      );

      expect(successfulResponses.length).toBe(20);

      // 최종 포인트는 정확히 20번 사용된 금액만큼 차감되어야 함
      const finalResponse = await request(app.getHttpServer())
        .get(`/point/${userId}`)
        .expect(200);

      expect(finalResponse.body.point).toBe(chargedPoint - useAmount * 20);
    });

    it('서로 다른 사용자의 요청은 서로 영향을 주지 않는다', async () => {
      // Given
      const userId1 = 8;
      const userId2 = 9;
      const chargeAmount = CHARGE_POINT_UNIT;

      // 초기 포인트 조회
      const [initial1, initial2] = await Promise.all([
        request(app.getHttpServer()).get(`/point/${userId1}`).expect(200),
        request(app.getHttpServer()).get(`/point/${userId2}`).expect(200),
      ]);

      const initialPoint1 = initial1.body.point;
      const initialPoint2 = initial2.body.point;

      // When - 서로 다른 사용자에 대한 동시 요청 (각 10회씩)
      const promises = [
        ...[...Array(10)].map(() =>
          request(app.getHttpServer())
            .patch(`/point/${userId1}/charge`)
            .send({ amount: chargeAmount }),
        ),
        ...[...Array(10)].map(() =>
          request(app.getHttpServer())
            .patch(`/point/${userId2}/charge`)
            .send({ amount: chargeAmount }),
        ),
      ];

      const responses = await Promise.allSettled(promises);

      // Then
      const successfulResponses = responses.filter(
        (response) =>
          response.status === 'fulfilled' && response.value.status === 200,
      );

      expect(successfulResponses.length).toBe(promises.length);

      // 최종 포인트 확인
      const [final1, final2] = await Promise.all([
        request(app.getHttpServer()).get(`/point/${userId1}`).expect(200),
        request(app.getHttpServer()).get(`/point/${userId2}`).expect(200),
      ]);

      expect(final1.body.point).toBe(initialPoint1 + chargeAmount * 10);
      expect(final2.body.point).toBe(initialPoint2 + chargeAmount * 10);
    });
  });

  describe('포인트 히스토리 검증', () => {
    it('포인트 충전 후 히스토리에 기록된다', async () => {
      // Given
      const userId = 10;
      const chargeAmount = CHARGE_POINT_UNIT;

      // 초기 히스토리 조회
      const initialHistoryResponse = await request(app.getHttpServer())
        .get(`/point/${userId}/histories`)
        .expect(200);
      const initialHistoryCount = initialHistoryResponse.body.length;

      // When - 포인트 충전
      await request(app.getHttpServer())
        .patch(`/point/${userId}/charge`)
        .send({ amount: chargeAmount })
        .expect(200);

      // Then - 히스토리 확인
      const finalHistoryResponse = await request(app.getHttpServer())
        .get(`/point/${userId}/histories`)
        .expect(200);

      expect(finalHistoryResponse.body.length).toBe(initialHistoryCount + 1);

      const latestHistory =
        finalHistoryResponse.body[finalHistoryResponse.body.length - 1];
      expect(latestHistory.userId).toBe(userId);
      expect(latestHistory.amount).toBe(chargeAmount);
      expect(latestHistory.type).toBe(TransactionType.CHARGE);
    });

    it('포인트 사용 후 히스토리에 기록된다', async () => {
      // Given
      const userId = 11;
      const chargeAmount = 1000;
      const useAmount = USE_POINT_UNIT;

      // 포인트 충전
      await request(app.getHttpServer())
        .patch(`/point/${userId}/charge`)
        .send({ amount: chargeAmount })
        .expect(200);

      // 충전 후 히스토리 조회
      const afterChargeHistoryResponse = await request(app.getHttpServer())
        .get(`/point/${userId}/histories`)
        .expect(200);
      const afterChargeHistoryCount = afterChargeHistoryResponse.body.length;

      // When - 포인트 사용
      await request(app.getHttpServer())
        .patch(`/point/${userId}/use`)
        .send({ amount: useAmount })
        .expect(200);

      // Then - 히스토리 확인
      const finalHistoryResponse = await request(app.getHttpServer())
        .get(`/point/${userId}/histories`)
        .expect(200);

      expect(finalHistoryResponse.body.length).toBe(
        afterChargeHistoryCount + 1,
      );

      const latestHistory =
        finalHistoryResponse.body[finalHistoryResponse.body.length - 1];
      expect(latestHistory.userId).toBe(userId);
      expect(latestHistory.amount).toBe(useAmount);
      expect(latestHistory.type).toBe(TransactionType.USE);
    });
  });
});
