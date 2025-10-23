import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  ValidationPipe,
} from '@nestjs/common';
import { PointHistory, UserPoint } from './point.model';
import { PointBody as PointDto } from './point.dto';
import { PointService } from './point.service';

@Controller('/point')
export class PointController {
  constructor(private readonly pointService: PointService) {}

  /**
   * 특정 유저의 포인트를 조회하는 기능
   */
  @Get(':id')
  async point(@Param('id') id: string): Promise<UserPoint> {
    const userId = Number.parseInt(id);
    const userPoint: UserPoint = await this.pointService.getUserPoint(userId);
    return userPoint;
  }

  /**
   * 특정 유저의 포인트 충전/이용 내역을 조회하는 기능
   */
  @Get(':id/histories')
  async history(@Param('id') id: string): Promise<PointHistory[]> {
    const userId = Number.parseInt(id);
    const pointHistoryList =
      await this.pointService.getPointHistoryList(userId);
    return pointHistoryList;
  }

  /**
   * TODO - 특정 유저의 포인트를 충전하는 기능을 작성해주세요.
   */
  @Patch(':id/charge')
  async charge(
    @Param('id') id: string,
    @Body(ValidationPipe) pointDto: PointDto,
  ): Promise<UserPoint> {
    const userId = Number.parseInt(id);
    const amount = pointDto.amount;

    const updatedUserPoint = await this.pointService.chargeUserPoint(
      userId,
      amount,
    );

    return updatedUserPoint;
  }

  /**
   * TODO - 특정 유저의 포인트를 사용하는 기능을 작성해주세요.
   */
  @Patch(':id/use')
  async use(
    @Param('id') id: string,
    @Body(ValidationPipe) pointDto: PointDto,
  ): Promise<UserPoint> {
    const userId = Number.parseInt(id);
    const amount = pointDto.amount;

    const updatedUserPoint = await this.pointService.useUserPoint(
      userId,
      amount,
    );

    return updatedUserPoint;
  }
}
