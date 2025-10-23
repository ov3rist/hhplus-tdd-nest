import { Test, TestingModule } from '@nestjs/testing';
import { PointService } from './point.service';
import { UserPointTable } from '../database/userpoint.table';
import { PointHistoryTable } from '../database/pointhistory.table';
import { UserPoint, PointHistory, TransactionType } from './point.model';
import { BadRequestException } from '@nestjs/common';

describe('PointService', () => {
  let userService: PointService;
  let userPointTable: UserPointTable;
  let pointHistoryTable: PointHistoryTable;
  let MAX_POINT: number;
  let MIN_POINT: number;
  let MIN_CHARGE_POINT_UNIT: number;
  let MIN_USE_POINT_UNIT: number;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PointService, UserPointTable, PointHistoryTable],
    }).compile();

    userService = module.get<PointService>(PointService);
    userPointTable = module.get<UserPointTable>(UserPointTable);
    pointHistoryTable = module.get<PointHistoryTable>(PointHistoryTable);

    MAX_POINT = userService.getMaxPoint();
    MIN_POINT = userService.getMinPoint();
    MIN_CHARGE_POINT_UNIT = userService.getMinChargePointUnit();
    MIN_USE_POINT_UNIT = userService.getMinUsePointUnit();

    jest.useFakeTimers().setSystemTime(new Date('2025-01-01T09:00:00Z'));
  });
  afterEach(() => {
    jest.clearAllMocks();
  });

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
      jest
        .spyOn(userPointTable, 'insertOrUpdate')
        .mockImplementation(() => new Promise(() => {})); // 사이드이펙 방지
      jest
        .spyOn(pointHistoryTable, 'insert')
        .mockImplementation(() => new Promise(() => {})); // 사이드이펙 방지

      // ** When / Then
      await expect(
        userService.chargeUserPoint(userId, chargeAmount),
      ).rejects.toThrow(
        new BadRequestException(
          `포인트는 최대 ${MAX_POINT}까지 보유할 수 있습니다.`,
        ),
      );
      expect(userPointTable.insertOrUpdate).not.toHaveBeenCalled();
      expect(pointHistoryTable.insert).not.toHaveBeenCalled();
    });

    it(`유저는 최소 충전 단위로 포인트를 충전할 수 있다.`, async () => {
      // ** Given
      const userId = 1;
      const invalidChargeAmount = MIN_CHARGE_POINT_UNIT - 1;

      jest
        .spyOn(userPointTable, 'insertOrUpdate')
        .mockImplementation(() => new Promise(() => {})); // 사이드이펙 방지
      jest
        .spyOn(pointHistoryTable, 'insert')
        .mockImplementation(() => new Promise(() => {})); // 사이드이펙 방지

      // ** When / Then
      await expect(
        userService.chargeUserPoint(userId, invalidChargeAmount),
      ).rejects.toThrow(
        new BadRequestException(
          `포인트는 최소 ${MIN_CHARGE_POINT_UNIT} 단위로 충전할 수 있습니다.`,
        ),
      );
      expect(userPointTable.insertOrUpdate).not.toHaveBeenCalled();
      expect(pointHistoryTable.insert).not.toHaveBeenCalled();
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
      jest
        .spyOn(userPointTable, 'insertOrUpdate')
        .mockImplementation(() => new Promise(() => {})); // 사이드이펙 방지
      jest
        .spyOn(pointHistoryTable, 'insert')
        .mockImplementation(() => new Promise(() => {})); // 사이드이펙 방지

      // ** When / Then
      await expect(userService.useUserPoint(userId, useAmount)).rejects.toThrow(
        new BadRequestException('포인트 금액은 0보다 커야 합니다.'),
      );
      expect(userPointTable.insertOrUpdate).not.toHaveBeenCalled();
      expect(pointHistoryTable.insert).not.toHaveBeenCalled();
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
      const invalidUseAmount = MIN_USE_POINT_UNIT - 1;
      jest
        .spyOn(userPointTable, 'insertOrUpdate')
        .mockImplementation(() => new Promise(() => {})); // 사이드이펙 방지
      jest
        .spyOn(pointHistoryTable, 'insert')
        .mockImplementation(() => new Promise(() => {})); // 사이드이펙 방지

      // ** When / Then
      await expect(
        userService.useUserPoint(userId, invalidUseAmount),
      ).rejects.toThrow(
        new BadRequestException(
          `포인트는 최소 ${MIN_USE_POINT_UNIT} 단위로 사용할 수 있습니다.`,
        ),
      );
      expect(userPointTable.insertOrUpdate).not.toHaveBeenCalled();
      expect(pointHistoryTable.insert).not.toHaveBeenCalled();
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
      jest
        .spyOn(userPointTable, 'insertOrUpdate')
        .mockImplementation(() => new Promise(() => {})); // 사이드이펙 방지
      jest
        .spyOn(pointHistoryTable, 'insert')
        .mockImplementation(() => new Promise(() => {})); // 사이드이펙 방지

      // ** When / Then
      await expect(userService.useUserPoint(userId, useAmount)).rejects.toThrow(
        new BadRequestException('포인트가 부족합니다.'),
      );
      expect(userPointTable.selectById).toHaveBeenCalledWith(userId);
      expect(userPointTable.insertOrUpdate).not.toHaveBeenCalled();
      expect(pointHistoryTable.insert).not.toHaveBeenCalled();
    });
  });
});
