import { rateLimit } from "express-rate-limit";

export const limiteConnexion = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      code: "TROP_DE_REQUETES",
      message: "Trop de tentatives. Reessayez dans une minute.",
      details: null,
    });
  },
});