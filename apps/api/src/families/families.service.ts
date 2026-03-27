import { ConflictException, Injectable } from '@nestjs/common';
import { EducationStage } from '../common/enums/education-stage.enum';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFamilyDto } from './dto/create-family.dto';

@Injectable()
export class FamiliesService {
  constructor(private readonly prisma: PrismaService) {}

  list(stage?: EducationStage) {
    return this.prisma.trainingFamily.findMany({
      where: stage ? { stage: stage as any } : undefined,
      orderBy: [{ stage: 'asc' }, { name: 'asc' }],
    });
  }

  async create(dto: CreateFamilyDto) {
    try {
      return await this.prisma.trainingFamily.create({
        data: {
          name: dto.name.trim(),
          stage: dto.stage as any,
        },
      });
    } catch {
      throw new ConflictException('Family already exists for this stage');
    }
  }

  async remove(id: number) {
    await this.prisma.trainingFamily.delete({ where: { id } });
    return { success: true };
  }
}
