import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { EducationStage } from '../common/enums/education-stage.enum';
import { Role } from '../common/enums/role.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateFamilyDto } from './dto/create-family.dto';
import { FamiliesService } from './families.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('families')
export class FamiliesController {
  constructor(private readonly familiesService: FamiliesService) {}

  @Roles(Role.ADMIN, Role.TEACHER)
  @Get()
  list(@Query('stage') stage?: EducationStage) {
    return this.familiesService.list(stage);
  }

  @Roles(Role.ADMIN)
  @Post()
  create(@Body() dto: CreateFamilyDto) {
    return this.familiesService.create(dto);
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.familiesService.remove(id);
  }
}
