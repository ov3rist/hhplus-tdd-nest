import { IsInt } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PointBody {
  @IsInt()
  @ApiProperty({
    description: '포인트 수량',
    example: 100,
    type: Number,
  })
  amount: number;
}
