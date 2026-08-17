import { z } from "zod";

export const moveCardSchema = z.object({
  applicationId: z.string().min(1),
  stageId: z.string().min(1),
});

export const createStageSchema = z.object({
  name: z.string().trim().min(1, "Give the column a name.").max(40),
});

export const renameStageSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1, "Give the column a name.").max(40),
});

export const stageIdSchema = z.object({ id: z.string().min(1) });

export const moveStageSchema = z.object({
  id: z.string().min(1),
  direction: z.enum(["left", "right"]),
});
