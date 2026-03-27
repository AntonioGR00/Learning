import { EducationStage, PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const DEFAULT_FAMILIES: Array<{ name: string; stage: EducationStage }> = [
  { name: 'General', stage: EducationStage.ESO },
  { name: 'General', stage: EducationStage.BACHILLERATO },
  { name: 'Administracion y Gestion', stage: EducationStage.GRADO_MEDIO },
  { name: 'Agraria', stage: EducationStage.GRADO_MEDIO },
  { name: 'Artes Graficas', stage: EducationStage.GRADO_MEDIO },
  { name: 'Comercio y Marketing', stage: EducationStage.GRADO_MEDIO },
  { name: 'Electricidad y Electronica', stage: EducationStage.GRADO_MEDIO },
  { name: 'Fabricacion Mecanica', stage: EducationStage.GRADO_MEDIO },
  { name: 'Hosteleria y Turismo', stage: EducationStage.GRADO_MEDIO },
  { name: 'Imagen Personal', stage: EducationStage.GRADO_MEDIO },
  { name: 'Informatica y Comunicaciones', stage: EducationStage.GRADO_MEDIO },
  { name: 'Instalacion y Mantenimiento', stage: EducationStage.GRADO_MEDIO },
  { name: 'Sanidad', stage: EducationStage.GRADO_MEDIO },
  {
    name: 'Servicios Socioculturales y a la Comunidad',
    stage: EducationStage.GRADO_MEDIO,
  },
  {
    name: 'Transporte y Mantenimiento de Vehiculos',
    stage: EducationStage.GRADO_MEDIO,
  },
  { name: 'Administracion y Gestion', stage: EducationStage.GRADO_SUPERIOR },
  {
    name: 'Actividades Fisicas y Deportivas',
    stage: EducationStage.GRADO_SUPERIOR,
  },
  { name: 'Comercio y Marketing', stage: EducationStage.GRADO_SUPERIOR },
  { name: 'Edificacion y Obra Civil', stage: EducationStage.GRADO_SUPERIOR },
  { name: 'Electricidad y Electronica', stage: EducationStage.GRADO_SUPERIOR },
  { name: 'Imagen y Sonido', stage: EducationStage.GRADO_SUPERIOR },
  { name: 'Informatica y Comunicaciones', stage: EducationStage.GRADO_SUPERIOR },
  { name: 'Sanidad', stage: EducationStage.GRADO_SUPERIOR },
  {
    name: 'Servicios Socioculturales y a la Comunidad',
    stage: EducationStage.GRADO_SUPERIOR,
  },
];

async function main() {
  const adminEmail = 'admin@school.local';
  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash('Admin123!', 10);
    await prisma.user.create({
      data: {
        email: adminEmail,
        fullName: 'Administrador',
        passwordHash,
        role: Role.ADMIN,
      },
    });
  }

  await Promise.all(
    DEFAULT_FAMILIES.map((family) =>
      prisma.trainingFamily.upsert({
        where: {
          name_stage: {
            name: family.name,
            stage: family.stage,
          },
        },
        create: family,
        update: {},
      }),
    ),
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
