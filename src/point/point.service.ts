import { BadRequestException, Injectable } from '@nestjs/common';
import { UserPointTable } from '../database/userpoint.table';
import { PointHistoryTable } from '../database/pointhistory.table';
import { TransactionType, UserPoint } from './point.model';

@Injectable()
export class PointService {
  constructor(
    private readonly userPointTable: UserPointTable,
    private readonly pointHistoryTable: PointHistoryTable,
  ) {}

  // Constants
  private readonly MAX_POINT = 10000; // 최대 보유 포인트
  private readonly MIN_POINT = 0; // 최소 보유 포인트

  // Validation helpers
  private validateUserId(userId: number): void {
    if (!Number.isInteger(userId) || userId <= 0) {
      throw new BadRequestException('유효하지 않은 사용자 ID입니다.');
    }
  }
  private validateAmount(amount: number): void {
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new BadRequestException('포인트 금액은 0보다 커야 합니다.');
    }
  }

  /**
   * ANCHOR 특정 유저의 포인트를 조회하는 기능
   */
  async getUserPoint(userId: number): Promise<UserPoint> {
    this.validateUserId(userId);

    try {
      // Fetch user point
      const userPoint = await this.userPointTable.selectById(userId);
      return userPoint;
    } catch (error) {
      throw error;
    }
  }

  /**
   * ANCHOR 특정 유저의 포인트 충전/이용 내역을 조회하는 기능
   */
  async getPointHistoryList(userId: number) {
    this.validateUserId(userId);

    try {
      // Fetch point history list
      const pointHistoryList =
        await this.pointHistoryTable.selectAllByUserId(userId);
      return pointHistoryList;
    } catch (error) {
      throw error;
    }
  }

  /**
   * ANCHOR 특정 유저의 포인트를 충전하는 기능
   * TODO 동시성 제어
   */
  async chargeUserPoint(userId: number, amount: number): Promise<UserPoint> {
    this.validateUserId(userId);
    this.validateAmount(amount);

    try {
      const currentPoint = await this.userPointTable.selectById(userId);
      const newPoint = currentPoint.point + amount;

      if (newPoint > this.MAX_POINT) {
        throw new BadRequestException(
          `포인트는 최대 ${this.MAX_POINT}까지 보유할 수 있습니다.`,
        );
      }

      const updatedPoint = await this.userPointTable.insertOrUpdate(
        userId,
        newPoint,
      );

      await this.pointHistoryTable.insert(
        userId,
        amount,
        TransactionType.CHARGE,
        updatedPoint.updateMillis,
      );

      return updatedPoint;
    } catch (error) {
      throw error;
    }
  }

  /**
   * ANCHOR 특정 유저의 포인트를 사용하는 기능
   * TODO 동시성 제어
   */
  async useUserPoint(userId: number, amount: number): Promise<UserPoint> {
    this.validateUserId(userId);
    this.validateAmount(amount);

    try {
      const currentPoint = await this.userPointTable.selectById(userId);
      const newPoint = currentPoint.point - amount;

      if (newPoint < this.MIN_POINT) {
        throw new BadRequestException('포인트가 부족합니다.');
      }

      const updatedPoint = await this.userPointTable.insertOrUpdate(
        userId,
        newPoint,
      );

      await this.pointHistoryTable.insert(
        userId,
        amount,
        TransactionType.USE,
        updatedPoint.updateMillis,
      );

      return updatedPoint;
    } catch (error) {
      throw error;
    }
  }
}
