// Constants (정책사항)
export const pointConstants = {
  MAX_POINT: 10000, // 최대 보유 포인트
  MIN_POINT: 0, // 최소 보유 포인트
  CHARGE_POINT_UNIT: 100, // 최소 충전 포인트 단위
  USE_POINT_UNIT: 100, // 최소 사용 포인트 단위
};

export const pointError = {
  EXCEED_MAX_POINT: `포인트는 최대 ${pointConstants.MAX_POINT}까지 보유할 수 있습니다.`,
  BELOW_MIN_POINT: `포인트는 최소 ${pointConstants.MIN_POINT} 이상이어야 합니다.`,
  INVALID_CHARGE_UNIT: `포인트 충전은 ${pointConstants.CHARGE_POINT_UNIT} 단위로만 가능합니다.`,
  INVALID_USE_UNIT: `포인트 사용은 ${pointConstants.USE_POINT_UNIT} 단위로만 가능합니다.`,
  INSUFFICIENT_POINTS: '포인트가 부족합니다.',
};
