import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";

// Une seule connexion a la base, partagee par tout le serveur.
const adapter = new PrismaPg({ connectionString: process.env["DATABASE_URL"] });

export const prisma = new PrismaClient({ adapter });