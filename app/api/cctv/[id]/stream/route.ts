import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { spawn } from "child_process";
import { guardPermission } from "@/lib/auth";
import { decrypt } from "@/lib/crypto";
import { errorResponse, logger } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

/**
 * GET /api/cctv/:id/stream
 * Proxies RTSP stream to MJPEG for direct browser consumption
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const CONTEXT = 'CCTV-Stream';
  let id = "";
  try {
    const auth = await guardPermission(req, 'cctv', 'read');
    if (auth instanceof NextResponse) return auth;

    id = (await params).id;

    const cctv = await prisma.cctv.findUnique({
      where: { id },
    });

    if (!cctv) {
      return errorResponse("CCTV camera not found", null, 404);
    }

    const { name, ipAddress, port, channel, username, password, resolution } = cctv;

    // Decrypt password if it exists
    const decryptedPassword = password ? decrypt(password) : "";
    
    const credentials =
      username && decryptedPassword
        ? `${encodeURIComponent(username)}:${encodeURIComponent(decryptedPassword)}@`
        : "";
    const rtspUrl = `rtsp://${credentials}${ipAddress}:${port}/${channel || ""}`;

    logger.info(CONTEXT, `Starting MJPEG stream for camera ${id} (${name})`);

    const stream = new ReadableStream({
      start(controller) {
        let isClosed = false;

        const ffmpegArgs = [
          "-rtsp_transport",
          "tcp",
          "-i",
          rtspUrl,
          "-f",
          "mjpeg",
          "-q:v",
          "5",
          "-vf",
          "fps=5",
          "-s",
          resolution || "640x480",
          "pipe:1",
        ];

        const ffmpegProcess = spawn("ffmpeg", ffmpegArgs);

        ffmpegProcess.stdout.on("data", (chunk) => {
          if (!isClosed) controller.enqueue(chunk);
        });

        ffmpegProcess.stderr.on("data", (data) => {
          const msg = data.toString();
          if (msg.includes('Error') || msg.includes('failed')) {
            logger.warn(CONTEXT, `FFmpeg [${name}] stderr: ${msg.trim()}`);
          }
        });

        const closeStream = (reason: string) => {
          if (!isClosed) {
            isClosed = true;
            logger.info(CONTEXT, `Closing stream for ${name}: ${reason}`);
            ffmpegProcess.kill("SIGKILL");
            try {
              controller.close();
            } catch (e) {}
          }
        };

        req.signal.addEventListener("abort", () => closeStream("Client disconnected"));
        
        ffmpegProcess.on("close", (code) => closeStream(`FFmpeg process exited with code ${code}`));
        
        ffmpegProcess.on("error", (err) => {
          logger.error(CONTEXT, `FFmpeg process error for "${name}"`, err.message);
          closeStream("FFmpeg process error");
        });
      },
      cancel() {
        // Handled by signal abort
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "multipart/x-mixed-replace; boundary=frame",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (error: any) {
    logger.error(CONTEXT, `Critical error in stream for camera ${id}`, error.message);
    return errorResponse("Internal Server Error in stream proxy", error.message, 500);
  }
}
