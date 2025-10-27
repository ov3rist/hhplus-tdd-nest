import { Test, TestingModule } from '@nestjs/testing';
import { PointService } from './point.service';
import { UserPointTable } from '../database/userpoint.table';
import { PointHistoryTable } from '../database/pointhistory.table';
import { TransactionType } from './point.model';
import { BadRequestException } from '@nestjs/common';
import { pointConstants } from '../constants/point.constant';

const { MAX_POINT, MIN_POINT, CHARGE_POINT_UNIT } = pointConstants;

/**
 * Point Integration Tests
 *
 * 통합 테스트 목적:
 * 1. 데이터 일관성: 포인트와 이력이 함께 저장/롤백되는지 검증
 * 2. 동시성 제어: Mutex를 통한 동시 요청 처리 검증
 * 3. 복합 시나리오: 여러 작업이 연속적으로 실행되는 흐름 검증
 * 4. 사용자 격리: 여러 사용자의 독립적인 데이터 관리 검증
 *
 * 유닛 테스트와의 차이:
 * - 유닛 테스트: Mock을 사용한 비즈니스 로직 검증 (validation, 단위 체크 등)
 * - 통합 테스트: 실제 Table 인스턴스를 사용한 컴포넌트 간 상호작용 검증
 */
describe('Point Integration Tests', () => {
  let pointService: PointService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PointService, UserPointTable, PointHistoryTable],
    }).compile();

    pointService = module.get<PointService>(PointService);
  });

  describe('데이터 일관성 검증', () => {
    it('포인트 충전 시 포인트와 이력이 모두 정상 기록된다', async () => {
      // Given
      const userId = 2000;
      const chargeAmount = 1000;

      // When
      const result = await pointService.chargeUserPoint(userId, chargeAmount);

      // Then - 포인트 확인
      expect(result.point).toBe(chargeAmount);

      // Then - 이력 확인
      const historyList = await pointService.getPointHistoryList(userId);
      expect(historyList).toHaveLength(1);
      expect(historyList[0].type).toBe(TransactionType.CHARGE);
      expect(historyList[0].amount).toBe(chargeAmount);
      expect(historyList[0].userId).toBe(userId);
    });

    it('최대 포인트 제한을 초과하면 충전이 실패하고 이력이 남지 않는다', async () => {
      // Given
      const userId = 2002;
      await pointService.chargeUserPoint(userId, MAX_POINT);

      // When & Then
      await expect(
        pointService.chargeUserPoint(userId, CHARGE_POINT_UNIT),
      ).rejects.toThrow(BadRequestException);

      // 이력 확인 - 실패한 충전은 기록되지 않음
      const historyList = await pointService.getPointHistoryList(userId);
      expect(historyList).toHaveLength(1); // 첫 번째 충전만 기록됨
    });

    it('잔액 부족 시 사용이 실패하고 포인트와 이력이 변경되지 않는다', async () => {
      // Given
      const userId = 3001;
      await pointService.chargeUserPoint(userId, 1000);

      // When & Then
      await expect(pointService.useUserPoint(userId, 2000)).rejects.toThrow(
        BadRequestException,
      );

      // 포인트와 이력 확인 - 실패 시 변경되지 않음
      const userPoint = await pointService.getUserPoint(userId);
      expect(userPoint.point).toBe(1000);

      const historyList = await pointService.getPointHistoryList(userId);
      expect(historyList).toHaveLength(1); // 충전 이력만 존재
    });
  });

  describe('복합 시나리오 검증', () => {
    it('충전 → 사용 → 충전 → 사용의 복잡한 흐름이 정상 처리된다', async () => {
      // Given
      const userId = 4000;

      // When & Then
      await pointService.chargeUserPoint(userId, 5000);
      let point = await pointService.getUserPoint(userId);
      expect(point.point).toBe(5000);

      await pointService.useUserPoint(userId, 2000);
      point = await pointService.getUserPoint(userId);
      expect(point.point).toBe(3000);

      await pointService.chargeUserPoint(userId, 4000);
      point = await pointService.getUserPoint(userId);
      expect(point.point).toBe(7000);

      await pointService.useUserPoint(userId, 1000);
      point = await pointService.getUserPoint(userId);
      expect(point.point).toBe(6000);

      // 이력 검증 - 모든 작업이 순서대로 기록됨
      const historyList = await pointService.getPointHistoryList(userId);
      expect(historyList).toHaveLength(4);
      expect(historyList[0].type).toBe(TransactionType.CHARGE);
      expect(historyList[1].type).toBe(TransactionType.USE);
      expect(historyList[2].type).toBe(TransactionType.CHARGE);
      expect(historyList[3].type).toBe(TransactionType.USE);
    });

    it('여러 사용자의 독립적인 포인트 관리가 정상 작동한다', async () => {
      // Given
      const user1 = 4100;
      const user2 = 4200;
      const user3 = 4300;

      // When
      await pointService.chargeUserPoint(user1, 1000);
      await pointService.chargeUserPoint(user2, 2000);
      await pointService.chargeUserPoint(user3, 3000);

      // Then - 각 사용자의 데이터가 독립적으로 관리됨
      const point1 = await pointService.getUserPoint(user1);
      const point2 = await pointService.getUserPoint(user2);
      const point3 = await pointService.getUserPoint(user3);

      expect(point1.point).toBe(1000);
      expect(point2.point).toBe(2000);
      expect(point3.point).toBe(3000);

      const historyList1 = await pointService.getPointHistoryList(user1);
      const historyList2 = await pointService.getPointHistoryList(user2);
      const historyList3 = await pointService.getPointHistoryList(user3);

      expect(historyList1).toHaveLength(1);
      expect(historyList2).toHaveLength(1);
      expect(historyList3).toHaveLength(1);
    });
  });

  describe('동시성 제어 검증', () => {
    // 테스트 간 독립성을 위한 userId 자동 증가
    let testUserId = 5000;
    const getNextUserId = () => ++testUserId;

    it('동일 사용자의 동시 충전 요청이 일괄 처리된다', async () => {
      // Given
      const userId = getNextUserId();
      const chargeAmount = 1000;

      // When - 동시에 3번 충전
      await Promise.all([
        pointService.chargeUserPoint(userId, chargeAmount),
        pointService.chargeUserPoint(userId, chargeAmount),
        pointService.chargeUserPoint(userId, chargeAmount),
      ]);

      // Then - 모든 충전이 일괄 처리되어 정확한 금액
      const userPoint = await pointService.getUserPoint(userId);
      expect(userPoint.point).toBe(3000);

      const historyList = await pointService.getPointHistoryList(userId);
      expect(historyList).toHaveLength(3);
    });

    it('동일 사용자의 동시 사용 요청이 일괄 처리된다', async () => {
      // Given
      const userId = getNextUserId();
      await pointService.chargeUserPoint(userId, 5000);

      // When - 동시에 3번 사용
      await Promise.all([
        pointService.useUserPoint(userId, 1000),
        pointService.useUserPoint(userId, 1000),
        pointService.useUserPoint(userId, 1000),
      ]);

      // Then - 모든 사용이 일괄 처리되어 정확한 잔액
      const userPoint = await pointService.getUserPoint(userId);
      expect(userPoint.point).toBe(2000);

      const historyList = await pointService.getPointHistoryList(userId);
      const usehistoryList = historyList.filter(
        (h) => h.type === TransactionType.USE,
      );
      expect(usehistoryList).toHaveLength(3);
    });

    it('충전과 사용이 동시에 발생해도 일괄 처리되어 최종 잔액이 정확하다', async () => {
      // Given
      const userId = getNextUserId();
      await pointService.chargeUserPoint(userId, 2000);

      // When - 충전과 사용 동시 발생
      await Promise.all([
        pointService.chargeUserPoint(userId, 3000),
        pointService.useUserPoint(userId, 1000),
      ]);

      // Then - 데이터 무결성 보장
      const userPoint = await pointService.getUserPoint(userId);
      expect(userPoint.point).toBe(4000);

      const historyList = await pointService.getPointHistoryList(userId);
      expect(historyList).toHaveLength(3);
    });

    it('잔액 부족 시 동시 요청 중 일부만 성공한다', async () => {
      // Given
      const userId = getNextUserId();
      await pointService.chargeUserPoint(userId, 2000);

      // When - 동시 사용 요청 중 일부만 잔액 범위 내
      const results = await Promise.allSettled([
        pointService.useUserPoint(userId, 1000),
        pointService.useUserPoint(userId, 1000),
        pointService.useUserPoint(userId, 1000),
      ]);

      // Then - 성공/실패가 정확히 분리됨
      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      expect(fulfilled.length).toBe(2);
      expect(rejected.length).toBe(1);

      const userPoint = await pointService.getUserPoint(userId);
      expect(userPoint.point).toBe(MIN_POINT);
    });

    it('대량의 동시 충전 요청도 정확하게 처리된다', async () => {
      // Given
      const userId = getNextUserId();
      const requestCount = 5;
      const chargeAmount = 100;

      // When - 5개의 동시 충전 요청
      const promises = Array.from({ length: requestCount }, () =>
        pointService.chargeUserPoint(userId, chargeAmount),
      );
      await Promise.all(promises);

      // Then - 모든 요청이 일괄 처리되어 정확한 합계
      const userPoint = await pointService.getUserPoint(userId);
      expect(userPoint.point).toBe(500);

      const historyList = await pointService.getPointHistoryList(userId);
      expect(historyList).toHaveLength(requestCount);
    }, 10000);
  });
});
