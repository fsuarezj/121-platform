import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { ProgramPhase } from '../../shared/enum/program-phase.model';

export enum CustomAttributeType {
  text = 'text',
  boolean = 'boolean',
  tel = 'tel',
}

export class CreateProgramCustomAttributeDto {
  @ApiProperty({ example: 'district' })
  @IsNotEmpty()
  @IsString()
  public readonly name: string;

  @ApiProperty({ example: 'text' })
  @IsNotEmpty()
  @IsString()
  @IsEnum(CustomAttributeType)
  public readonly type: CustomAttributeType;

  @ApiProperty({
    example: {
      en: 'District',
      fr: 'Département',
    },
  })
  @IsNotEmpty()
  public label: JSON;

  @ApiProperty({
    example: [
      ProgramPhase.registrationValidation,
      ProgramPhase.inclusion,
      ProgramPhase.payment,
    ],
  })
  @IsNotEmpty()
  public phases: JSON;

  @ApiProperty({ example: true })
  @IsOptional()
  @IsBoolean()
  public duplicateCheck: boolean;
}

export class CreateProgramCustomAttributesDto {
  @ApiProperty({
    example: [
      {
        name: 'mycustom',
        type: 'text',
        label: { en: 'MyCustom' },
        phases: [
          ProgramPhase.registrationValidation,
          ProgramPhase.inclusion,
          ProgramPhase.payment,
        ],
      },
    ],
  })
  @ValidateNested()
  @Type(() => CreateProgramCustomAttributeDto)
  public readonly attributes: CreateProgramCustomAttributeDto[];
}
