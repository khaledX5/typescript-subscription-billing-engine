import { IsString } from 'class-validator';

export class CreateSubscriptionDto {
  @IsString()
  customerId!: string;

  @IsString()
  planId!: string;
}
