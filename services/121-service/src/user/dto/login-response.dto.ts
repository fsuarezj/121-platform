import { IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRO } from '../user.interface';
import { CookieSettingsDto } from './cookie-settings.dto';

export class LoginResponseDto {
  @ApiProperty({ example: '' })
  @IsNotEmpty()
  public readonly userRo: UserRO;

  @ApiProperty({ example: '' })
  @IsNotEmpty()
  public readonly cookieSettings: CookieSettingsDto;
}
