import { EducationStage } from '../../common/enums/education-stage.enum';
import { IsEnum, IsString, MinLength } from 'class-validator';

export class CreateFamilyDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsEnum(EducationStage)
  stage: EducationStage;
}
