import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { spawn } from "child_process";
import { guardPermission } from "@/lib/auth";
import { decrypt } from "@/lib/crypto";
import { errorResponse, logger } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

/**
 * GET /api/cctv/:id/snapshot
 * Captures a single frame from the RTSP stream using FFmpeg
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const CONTEXT = 'CCTV-Snapshot';
  let id = "";
  try {
    const auth = await guardPermission(req, 'cctv', 'read');
    if (auth instanceof NextResponse) return auth;

    id = (await params).id;
    const cctv = await prisma.cctv.findUnique({ where: { id } });

    if (!cctv) {
      return errorResponse("CCTV camera not found", null, 404);
    }

    const { ipAddress, port, channel, username, password, resolution } = cctv;

    // Decrypt password if it exists
    const decryptedPassword = password ? decrypt(password) : "";
    
    const credentials =
      username && decryptedPassword
        ? `${encodeURIComponent(username)}:${encodeURIComponent(decryptedPassword)}@`
        : "";
    const rtspUrl = `rtsp://${credentials}${ipAddress}:${port}/${channel || ""}`;

    logger.info(CONTEXT, `Taking snapshot for camera ${id} (IP: ${ipAddress})`);

    // FFmpeg command to capture 1 frame and output to stdout
    const ffmpegCommand = [
      "-rtsp_transport",
      "tcp",
      "-i",
      rtspUrl,
      "-vframes",
      "1",
      "-q:v",
      "3",
      "-s",
      resolution || "640x480",
      "-f",
      "image2pipe",
      "pipe:1",
    ];

    const ffmpegProcess = spawn("ffmpeg", ffmpegCommand);

    const readableStream = new ReadableStream({
      start(controller) {
        ffmpegProcess.stdout.on("data", (chunk) => {
          controller.enqueue(chunk);
        });

        ffmpegProcess.stderr.on("data", (data) => {
          const msg = data.toString();
          if (msg.includes('Error') || msg.includes('failed')) {
            logger.warn(CONTEXT, `FFmpeg stderr: ${msg.trim()}`);
          }
        });

        ffmpegProcess.on("close", (code) => {
          if (code !== 0) {
            logger.error(CONTEXT, `FFmpeg process closed with code ${code}`);
          }
          controller.close();
        });

        ffmpegProcess.on("error", (err) => {
          logger.error(CONTEXT, `FFmpeg process error: ${err.message}`);
          controller.error(err);
        });
      },
      cancel() {
        ffmpegProcess.kill();
      }
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (error: any) {
    logger.error(CONTEXT, `Failed to get snapshot for camera ${id}`, error.message);
    return errorResponse("Failed to capture snapshot from camera", error.message, 500);
  }
}
