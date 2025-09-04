import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString } from 'class-validator';

export class CreateUserDto {
  @ApiPropertyOptional({ type: String })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ type: String, nullable: true, format: 'email', example: 'hans@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string | null;
}
