import { Test, TestingModule } from '@nestjs/testing';
import { PointService } from './point.service';
import { UserPointTable } from '../database/userpoint.table';
import { PointHistoryTable } from '../database/pointhistory.table';
import { UserPoint, PointHistory, TransactionType } from './point.model';

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
  });

  describe('getUserPoint', () => {
    it('특정 유저의 포인트를 조회할 수 있다', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2025-01-01T09:00:00Z'));
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

      jest.clearAllMocks();
    });
  });

  describe('getPointHistoryList', () => {
    it('특정 유저의 포인트 충전/이용 내역을 조회할 수 있다', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2025-01-01T09:00:00Z'));
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

      jest.clearAllMocks();
    });
  });

  describe('chargeUserPoint', () => {
    it('특정 유저의 포인트를 충전할 수 있다.', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2025-01-01T09:00:00Z'));
      // ** Given
      const userId = 1;
      const chargeAmount = 100;
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

      jest.clearAllMocks();
    });
  });

  describe('useUserPoint', () => {
    jest.useFakeTimers().setSystemTime(new Date('2025-01-01T09:00:00Z'));
    it('특정 유저의 포인트를 사용할 수 있다', async () => {
      // ** Given
      const userId = 1;
      const useAmount = 50;
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
        useAmount,
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
  });
});
