import { Test, TestingModule } from '@nestjs/testing';
import { PointService } from './point.service';
import { UserPointTable } from '../database/userpoint.table';
import { PointHistoryTable } from '../database/pointhistory.table';

describe('PointService', () => {
  let service: PointService;
  let userPointTable: UserPointTable;
  let pointHistoryTable: PointHistoryTable;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PointService, UserPointTable, PointHistoryTable],
    }).compile();

    service = module.get<PointService>(PointService);
    userPointTable = module.get<UserPointTable>(UserPointTable);
    pointHistoryTable = module.get<PointHistoryTable>(PointHistoryTable);
  });

  describe('getUserPoint', () => {
    it('todo', () => {
      // ** Given
      // ** When
      // ** Then
    });
  });
  describe('getPointHistoryList', () => {
    it('todo', () => {
      // ** Given
      // ** When
      // ** Then
    });
  });
  describe('chargeUserPoint', () => {
    it('todo', () => {
      // ** Given
      // ** When
      // ** Then
    });
  });
  describe('useUserPoint', () => {
    it('todo', () => {
      // ** Given
      // ** When
      // ** Then
    });
  });
});
