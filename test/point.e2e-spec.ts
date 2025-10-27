import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

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
});
