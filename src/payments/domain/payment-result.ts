export const PaymentFailureCode = {
  CARD_DECLINED: 'CARD_DECLINED',
  INSUFFICIENT_FUNDS: 'INSUFFICIENT_FUNDS',
} as const;
export type PaymentFailureCode = (typeof PaymentFailureCode)[keyof typeof PaymentFailureCode];

export interface PaymentSucceeded {
  readonly status: 'SUCCEEDED';
  readonly transactionId: string;
}

export interface PaymentFailed {
  readonly status: 'FAILED';
  readonly failureCode: PaymentFailureCode;
  readonly failureMessage: string;
}

/**
 * Explicit outcome of a charge. A decline is an expected business result, not an exception,
 * so callers are forced by the type system to handle both branches.
 */
export type PaymentResult = PaymentSucceeded | PaymentFailed;
