// Seed: single-login user (from env) + a sample CCTV camera.
// Run with: npm run seed   (after `prisma migrate dev`)

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const username = process.env.APP_LOGIN_USER || "admin";
  const password = process.env.APP_LOGIN_PASSWORD || "admin123";

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.upsert({
    where: { username },
    update: { passwordHash },
    create: { username, passwordHash },
  });
  console.log(`[seed] user "${username}" ready`);

  // Sample CCTV so the surveillance page isn't empty on first run.
  const existing = await prisma.cctv.findFirst({ where: { name: "Sample Camera" } });
  if (!existing) {
    await prisma.cctv.create({
      data: {
        name: "Sample Camera",
        ipAddress: "192.168.1.100",
        port: 554,
        channel: "1",
        resolution: "640x480",
        framerate: 15,
        bitrate: 1024,
        group: "default",
      },
    });
    console.log("[seed] sample CCTV created");
  } else {
    console.log("[seed] sample CCTV already exists");
  }

  // Seed empty dashboard layouts so the API doesn't return 404 on first load.
  for (const type of ["meetings", "home-assistant"]) {
    await prisma.dashboard.upsert({
      where: { type },
      update: {},
      create: { type, layout: [] },
    });
  }
  console.log("[seed] dashboard layouts ready");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
