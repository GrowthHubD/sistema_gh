/**
 * Seed script: cria usuarios de teste, pipeline stages e kanban columns.
 * Roda com: npx tsx src/lib/db/seed.ts
 */

import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import { user } from "./schema/users";
import { kanbanColumn } from "./schema/kanban";
import { pipelineStage } from "./schema/pipeline";
import { auth } from "../auth";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle({ client: sql });

async function seed() {
  console.log("Seeding database...\n");

  // 1. Create test users via better-auth
  const users = [
    {
      name: "Davi Barreto",
      email: "davi@growthhub.com.br",
      password: "GrowthHub@2026",
      role: "partner" as const,
    },
    {
      name: "Gerente GH",
      email: "gerente@growthhub.com.br",
      password: "GrowthHub@2026",
      role: "manager" as const,
    },
    {
      name: "Operacional GH",
      email: "operacional@growthhub.com.br",
      password: "GrowthHub@2026",
      role: "operational" as const,
    },
  ];

  for (const u of users) {
    try {
      const ctx = await auth.api.signUpEmail({
        body: {
          name: u.name,
          email: u.email,
          password: u.password,
        },
      });

      if (ctx?.user?.id) {
        await db
          .update(user)
          .set({ role: u.role })
          .where(eq(user.id, ctx.user.id));
        console.log(`  [OK] User: ${u.email} (${u.role})`);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("already") || msg.includes("UNIQUE") || msg.includes("duplicate")) {
        console.log(`  [SKIP] User already exists: ${u.email}`);
      } else {
        console.error(`  [FAIL] ${u.email}:`, msg);
      }
    }
  }

  // 2. Create default pipeline stages
  console.log("");
  const stages = [
    { name: "Sem Atendimento", order: 1, color: "#8B8B9E" },
    { name: "Em Atendimento", order: 2, color: "#3B82F6" },
    { name: "Reunioes", order: 3, color: "#A29BFE" },
    { name: "Propostas", order: 4, color: "#FFB800" },
    { name: "Follow Up", order: 5, color: "#6C5CE7" },
    { name: "Ganho", order: 6, color: "#00D68F" },
    { name: "Perdido", order: 7, color: "#FF4757" },
  ];

  for (const stage of stages) {
    try {
      await db.insert(pipelineStage).values(stage);
      console.log(`  [OK] Stage: ${stage.name}`);
    } catch {
      console.log(`  [SKIP] Stage: ${stage.name}`);
    }
  }

  // 3. Create default kanban columns
  console.log("");
  const columns = [
    { name: "To Do", order: 1, color: "#8B8B9E" },
    { name: "In Progress", order: 2, color: "#FFB800" },
    { name: "Done", order: 3, color: "#00D68F" },
  ];

  for (const col of columns) {
    try {
      await db.insert(kanbanColumn).values(col);
      console.log(`  [OK] Column: ${col.name}`);
    } catch {
      console.log(`  [SKIP] Column: ${col.name}`);
    }
  }

  console.log("\nSeed completed!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
