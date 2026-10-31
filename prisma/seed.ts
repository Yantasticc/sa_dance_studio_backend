import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  // 1. Create Default Admin from environment variables
  const adminName = process.env.ADMIN_NAME || "S&A Studio Owner";
  const adminEmail = process.env.ADMIN_EMAIL || "admin@example.com";
  const adminPassword = process.env.ADMIN_PASSWORD || "CHANGE_THIS_PASSWORD";

  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  const admin = await prisma.admin.upsert({
    where: { email: adminEmail },
    update: {
      name: adminName,
      passwordHash: hashedPassword,
      isActive: true,
    },
    create: {
      name: adminName,
      email: adminEmail,
      passwordHash: hashedPassword,
      role: "ADMIN",
      isActive: true,
    },
  });
  console.log("Admin seeded:", admin.email);

  // 2. Create Default Courses
  const defaultCourses = [
    {
      id: "dance-classes",
      name: "Dance Classes",
      description: "Professional dance training designed for every age group and skill level. From your very first step to mastering choreography for the stage — our expert instructors guide you every step of the way.",
      image: "/images/classes/dance-classes-poster.jpg",
    },
    {
      id: "zumba-fitness",
      name: "Zumba Fitness",
      description: "High-energy Zumba fitness sessions that blend dance and aerobic movement for a full-body workout. Burn calories, boost your mood, and feel amazing in every class.",
      image: "/images/classes/zumba-poster.png",
    },
    {
      id: "garba",
      name: "Garba",
      description: "Learn the joy and energy of Garba — from traditional folk steps to modern festival choreography. Perfect for all age groups and skill levels, celebrating the vibrant culture of Gujarat.",
      image: "/images/classes/garba-poster.jpg",
    },
    {
      id: "workshops",
      name: "Special Workshops",
      description: "Special short-duration workshops and events throughout the year. Perfect for students who want to intensify their learning, prepare for performances, or explore a new dance style.",
      image: "/images/events/garba-workshop-poster.jpg",
    },
  ];

  for (const c of defaultCourses) {
    const course = await prisma.course.upsert({
      where: { id: c.id },
      update: {
        name: c.name,
        description: c.description,
        image: c.image,
      },
      create: c,
    });
    console.log("Course seeded:", course.name);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
