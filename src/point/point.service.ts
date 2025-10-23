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

  // Constants (정책사항)
  private readonly MAX_POINT = 10000; // 최대 보유 포인트
  private readonly MIN_POINT = 0; // 최소 보유 포인트
  private readonly MIN_CHARGE_POINT_UNIT = 100; // 최소 충전 포인트 단위
  private readonly MIN_USE_POINT_UNIT = 100; // 최소 사용 포인트 단위

  // getters
  getMaxPoint(): number {
    return this.MAX_POINT;
  }
  getMinPoint(): number {
    return this.MIN_POINT;
  }
  getMinChargePointUnit(): number {
    return this.MIN_CHARGE_POINT_UNIT;
  }
  getMinUsePointUnit(): number {
    return this.MIN_USE_POINT_UNIT;
  }

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

  private validateChargeUnit(amount: number): void {
    if (amount % this.MIN_CHARGE_POINT_UNIT !== 0) {
      throw new BadRequestException(
        `포인트는 최소 ${this.MIN_CHARGE_POINT_UNIT} 단위로 충전할 수 있습니다.`,
      );
    }
  }

  private validateUseUnit(amount: number): void {
    if (amount % this.MIN_USE_POINT_UNIT !== 0) {
      throw new BadRequestException(
        `포인트는 최소 ${this.MIN_USE_POINT_UNIT} 단위로 사용할 수 있습니다.`,
      );
    }
  }

  // 동시성 제어 헬퍼 메서드
  /**
   * 특정 사용자에 대한 작업을 Lock으로 보호하여 실행합니다. (Mutex)
   * 동일한 사용자 ID에 대한 요청은 순차적으로 처리됩니다.
   *
   * @param userId 사용자 ID
   * @param fn 실행할 함수
   * @returns 함수 실행 결과
   */

  private locks = new Map<number, Promise<void>>();

  async executeWithLock<T>(userId: number, fn: () => Promise<T>): Promise<T> {
    // 현재 실행 중인 작업이 있다면 대기
    while (this.locks.has(userId)) {
      await this.locks.get(userId);
    }

    // 새로운 Promise를 생성하여 lock 설정
    let releaseLock: () => void;
    const lockPromise = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });
    this.locks.set(userId, lockPromise);

    try {
      // 실제 작업 실행
      const result = await fn();
      return result;
    } catch (error) {
      throw error;
    } finally {
      // lock 해제
      this.locks.delete(userId);
      releaseLock();
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
   */
  async chargeUserPoint(userId: number, amount: number): Promise<UserPoint> {
    this.validateUserId(userId);
    this.validateAmount(amount);
    this.validateChargeUnit(amount);

    return this.executeWithLock(userId, async () => {
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
    });
  }

  /**
   * ANCHOR 특정 유저의 포인트를 사용하는 기능
   */
  async useUserPoint(userId: number, amount: number): Promise<UserPoint> {
    this.validateUserId(userId);
    this.validateAmount(amount);
    this.validateUseUnit(amount);

    return this.executeWithLock(userId, async () => {
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
    });
  }
}
