import { Test, TestingModule } from '@nestjs/testing';
import { PointService } from './point.service';
import { UserPointTable } from '../database/userpoint.table';
import { PointHistoryTable } from '../database/pointhistory.table';
import { UserPoint, PointHistory, TransactionType } from './point.model';
import { BadRequestException } from '@nestjs/common';
import { pointConstants, pointError } from '../constants/point.constant';

const { MAX_POINT, CHARGE_POINT_UNIT, USE_POINT_UNIT } = pointConstants;

describe('PointService', () => {
  let userService: PointService;
  let userPointTable: UserPointTable;
  let pointHistoryTable: PointHistoryTable;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PointService, UserPointTable, PointHistoryTable],
    }).compile();

    userService = module.get<PointService>(PointService);
    userPointTable = module.get<UserPointTable>(UserPointTable);
    pointHistoryTable = module.get<PointHistoryTable>(PointHistoryTable);

    jest.useFakeTimers().setSystemTime(new Date('2025-01-01T09:00:00Z'));
  });
  afterEach(() => {
    jest.clearAllMocks();
  });

  // 헬퍼 함수: 사이드이펙트 방지를 위한 mock 설정
  const preventSideEffects = () => {
    jest
      .spyOn(userPointTable, 'insertOrUpdate')
      .mockImplementation(() => new Promise(() => {}));
    jest
      .spyOn(pointHistoryTable, 'insert')
      .mockImplementation(() => new Promise(() => {}));
  };

  // 헬퍼 함수: 사이드이펙트 방지 검증
  const expectNoSideEffects = () => {
    expect(userPointTable.insertOrUpdate).not.toHaveBeenCalled();
    expect(pointHistoryTable.insert).not.toHaveBeenCalled();
  };

  describe('getUserPoint', () => {
    it('유효하지 않은 사용자 ID일 경우 예외를 던진다', async () => {
      // ** Given
      const invalidUserId = -1;
      // ** When / Then
      expect(userService.getUserPoint(invalidUserId)).rejects.toThrow(
        new BadRequestException('유효하지 않은 사용자 ID입니다.'),
      );
    });

    it('특정 유저의 포인트를 조회할 수 있다', async () => {
      // ** Given
      const userId = 1;
      const mockUserPoint: UserPoint = {
        id: userId,
        point: 5000,
        updateMillis: Date.now(),
      };
      jest.spyOn(userPointTable, 'selectById').mockResolvedValue(mockUserPoint);

      // ** When
      const result = await userService.getUserPoint(userId);

      // ** Then
      expect(result).not.toStrictEqual(undefined);
      expect(result).toStrictEqual(mockUserPoint);
    });
  });

  describe('getPointHistoryList', () => {
    it('유효하지 않은 사용자 ID일 경우 예외를 던진다', async () => {
      // ** Given
      const invalidUserId = -1;
      // ** When / Then
      expect(userService.getUserPoint(invalidUserId)).rejects.toThrow(
        new BadRequestException('유효하지 않은 사용자 ID입니다.'),
      );
    });

    it('특정 유저의 포인트 충전/이용 내역을 조회할 수 있다', async () => {
      // ** Given
      const userId = 1;
      const transactionType = TransactionType.CHARGE;
      const expectedPointHistoryList: PointHistory[] = [
        {
          id: 1,
          userId: userId,
          type: transactionType,
          amount: 1000,
          timeMillis: Date.now(),
        },
      ];
      jest
        .spyOn(pointHistoryTable, 'selectAllByUserId')
        .mockResolvedValue(expectedPointHistoryList);

      // ** When
      const result = await userService.getPointHistoryList(userId);

      // ** Then
      expect(result).not.toStrictEqual(undefined);
      expect(result).toStrictEqual(expectedPointHistoryList);
    });
  });

  describe('chargeUserPoint', () => {
    it('유효하지 않은 사용자 ID일 경우 예외를 던진다', async () => {
      // ** Given
      const invalidUserId = -1;
      // ** When / Then
      expect(userService.getUserPoint(invalidUserId)).rejects.toThrow(
        new BadRequestException('유효하지 않은 사용자 ID입니다.'),
      );
    });

    it('포인트 금액은 0보다 커야 한다', async () => {
      // ** Given
      const userId = 1;
      const chargeAmount = 0;
      // ** When / Then
      await expect(
        userService.chargeUserPoint(userId, chargeAmount),
      ).rejects.toThrow(
        new BadRequestException('포인트 금액은 0보다 커야 합니다.'),
      );
    });

    it('특정 유저의 포인트를 충전할 수 있다.', async () => {
      // ** Given
      const userId = 1;
      const chargeAmount = 1000;
      const currentPoint = { id: userId, point: 50, updateMillis: Date.now() };
      const expectedPointAmount = currentPoint.point + chargeAmount;
      const expectedPoint = {
        id: userId,
        point: expectedPointAmount,
        updateMillis: Date.now(),
      };

      jest.spyOn(userPointTable, 'selectById').mockResolvedValue(currentPoint);
      jest
        .spyOn(userPointTable, 'insertOrUpdate')
        .mockResolvedValue(expectedPoint);
      jest.spyOn(pointHistoryTable, 'insert').mockResolvedValue({
        id: 1,
        userId,
        type: TransactionType.CHARGE,
        amount: expectedPointAmount,
        timeMillis: expectedPoint.updateMillis,
      });
      jest.spyOn(userService, 'chargeUserPoint');

      // ** When
      const result = await userService.chargeUserPoint(userId, chargeAmount);

      // ** Then
      expect(result).not.toStrictEqual(undefined);
      expect(result).toStrictEqual(expectedPoint);
      expect(pointHistoryTable.insert).toHaveBeenCalledWith(
        userId,
        chargeAmount,
        TransactionType.CHARGE,
        expectedPoint.updateMillis,
      );
      expect(userPointTable.insertOrUpdate).toHaveBeenCalledWith(
        userId,
        expectedPointAmount,
      );
      expect(userService.chargeUserPoint).toHaveBeenCalledTimes(1);
    });

    it(`유저는 최대 포인트 보유량 까지 포인트를 보유할 수 있다.`, async () => {
      // ** Given
      const userId = 1;
      const chargeAmount = 1000;
      const currentPoint = {
        id: userId,
        point: MAX_POINT,
        updateMillis: Date.now(),
      };

      jest.spyOn(userPointTable, 'selectById').mockResolvedValue(currentPoint);
      preventSideEffects();

      // ** When / Then
      await expect(
        userService.chargeUserPoint(userId, chargeAmount),
      ).rejects.toThrow(new BadRequestException(pointError.EXCEED_MAX_POINT));
      expectNoSideEffects();
    });

    it(`유저는 최소 충전 단위로 포인트를 충전할 수 있다.`, async () => {
      // ** Given
      const userId = 1;
      const invalidChargeAmount = CHARGE_POINT_UNIT - 1;
      preventSideEffects();

      // ** When / Then
      await expect(
        userService.chargeUserPoint(userId, invalidChargeAmount),
      ).rejects.toThrow(
        new BadRequestException(pointError.INVALID_CHARGE_UNIT),
      );
      expectNoSideEffects();
    });
  });

  describe('useUserPoint', () => {
    it('유효하지 않은 사용자 ID일 경우 예외를 던진다', async () => {
      // ** Given
      const invalidUserId = -1;
      // ** When / Then
      expect(userService.getUserPoint(invalidUserId)).rejects.toThrow(
        new BadRequestException('유효하지 않은 사용자 ID입니다.'),
      );
    });

    it('포인트 금액은 0보다 커야 한다', async () => {
      // ** Given
      const userId = 1;
      const useAmount = 0;
      preventSideEffects();

      // ** When / Then
      await expect(userService.useUserPoint(userId, useAmount)).rejects.toThrow(
        new BadRequestException('포인트 금액은 0보다 커야 합니다.'),
      );
      expectNoSideEffects();
    });

    it('특정 유저의 포인트를 사용할 수 있다', async () => {
      // ** Given
      const userId = 1;
      const useAmount = 100;
      const currentPoint = {
        id: userId,
        point: 100,
        updateMillis: Date.now(),
      };
      const expectedPointAmount = currentPoint.point - useAmount;
      const expectedPoint = {
        id: userId,
        point: expectedPointAmount,
        updateMillis: Date.now(),
      };

      jest.spyOn(userPointTable, 'selectById').mockResolvedValue(currentPoint);
      jest
        .spyOn(userPointTable, 'insertOrUpdate')
        .mockResolvedValue(expectedPoint);
      jest.spyOn(pointHistoryTable, 'insert').mockResolvedValue({
        id: 1,
        userId,
        type: TransactionType.USE,
        amount: useAmount,
        timeMillis: expectedPoint.updateMillis,
      });
      jest.spyOn(userService, 'useUserPoint');

      // ** When
      const result = await userService.useUserPoint(userId, useAmount);

      // ** Then
      expect(result).not.toStrictEqual(undefined);
      expect(result).toStrictEqual(expectedPoint);
      expect(userPointTable.insertOrUpdate).toHaveBeenCalledWith(
        userId,
        expectedPointAmount,
      );
      expect(pointHistoryTable.insert).toHaveBeenCalledWith(
        userId,
        useAmount,
        TransactionType.USE,
        expectedPoint.updateMillis,
      );
      expect(userPointTable.insertOrUpdate).toHaveBeenCalledTimes(1);
      expect(pointHistoryTable.insert).toHaveBeenCalledTimes(1);
      expect(userPointTable.selectById).toHaveBeenCalledTimes(1);
      expect(userService.useUserPoint).toHaveBeenCalledTimes(1);
    });

    it(`유저는 최소 사용 단위로 포인트를 사용할 수 있다.`, async () => {
      // ** Given
      const userId = 1;
      const invalidUseAmount = USE_POINT_UNIT - 1;
      preventSideEffects();

      // ** When / Then
      await expect(
        userService.useUserPoint(userId, invalidUseAmount),
      ).rejects.toThrow(new BadRequestException(pointError.INVALID_USE_UNIT));
      expectNoSideEffects();
    });

    it(`유저는 최소 보유 포인트 이상의 포인트를 보유해야 한다.`, async () => {
      // ** Given
      const userId = 1;
      const useAmount = 1000;
      const currentPoint = {
        id: userId,
        point: 500,
        updateMillis: Date.now(),
      };

      jest.spyOn(userPointTable, 'selectById').mockResolvedValue(currentPoint);
      preventSideEffects();

      // ** When / Then
      await expect(userService.useUserPoint(userId, useAmount)).rejects.toThrow(
        new BadRequestException(pointError.INSUFFICIENT_POINTS),
      );
      expect(userPointTable.selectById).toHaveBeenCalledWith(userId);
      expectNoSideEffects();
    });
  });
});
