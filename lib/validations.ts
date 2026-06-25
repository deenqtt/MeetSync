import { z } from "zod";

// Slim validations for the standalone app — only the CCTV schema is needed.
export const cctvSchema = z.object({
  name: z.string().min(1, "Name is required"),
  ipAddress: z.string().min(1, "IP Address is required"),
  port: z.preprocess((val) => Number(val), z.number().int().min(1).max(65535)),
  channel: z.string().optional().nullable(),
  username: z.string().optional().nullable(),
  password: z.string().optional().nullable(),
  apiKey: z.string().optional().nullable(),
  group: z.string().optional().nullable(),
  resolution: z.string().optional().nullable(),
  framerate: z.preprocess(
    (val) => (val ? Number(val) : null),
    z.number().int().min(1).nullable().optional(),
  ),
  bitrate: z.preprocess(
    (val) => (val ? Number(val) : null),
    z.number().int().min(1).nullable().optional(),
  ),
});
