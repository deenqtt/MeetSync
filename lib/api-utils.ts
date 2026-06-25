import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

/**
 * Standard API Response Structure
 */
export interface ApiResponse<T = any> {
    success: boolean;
    message?: string;
    data?: T;
    error?: string;
    details?: any;
    meta?: any;
}

/**
 * Utility for Success Response
 */
export function successResponse<T>(data: T, message?: string, status = 200, meta?: any, headers?: any) {
    return NextResponse.json(
        {
            success: true,
            message,
            data,
            meta
        },
        {
            status,
            ...(headers && { headers })
        }
    );
}

/**
 * Utility for Error Response.
 *
 * PT-20 (extends F-PT9-007): di production, raw error.message di-redact
 * supaya parser internals/Prisma schema/file path tidak leak ke client.
 * Pentester catch ini di restore endpoint (PT-17), tapi pattern sama ada
 * di 300+ catch block lain (`errorResponse(..., error.message, 500)`).
 * Wrap helper sekali → cover semua caller tanpa bulk refactor.
 *
 * Behavior:
 *   - dev/test:  details di-pass-through apa adanya (debugging-friendly)
 *   - prod:      details=string raw → di-replace dengan generic; Zod
 *                validation errors (array of {path, message}) tetap di-pass
 *                karena itu user-facing & sudah safe
 *
 * Caller yang sudah pakai safeMsg() / explicit safe details tidak terdampak.
 */
function isUserFacingDetails(details: unknown): boolean {
    // Zod formatZodError output: Array<{path, message}>
    if (Array.isArray(details) && details.every(
        (d: any) => d && typeof d === 'object' && 'path' in d && 'message' in d
    )) return true;
    // Structured object dengan field-level errors (kategori user-facing)
    if (details && typeof details === 'object' && !Array.isArray(details)) {
        const keys = Object.keys(details);
        if (keys.length === 0 || keys.length > 10) return false;

        const sensitiveKeys = new Set([
            'error',
            'message',
            'stack',
            'name',
            'cause',
            'code',
            'errno',
        ]);

        const isSafeValue = (value: unknown): boolean => {
            if (value === null || value === undefined) return true;
            if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return true;
            if (Array.isArray(value)) return value.length <= 20 && value.every(isSafeValue);
            return false;
        };

        if (
            keys.every((k) => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(k) && !sensitiveKeys.has(k)) &&
            Object.values(details).every(isSafeValue)
        ) {
            return true;
        }
    }
    return false;
}

export function errorResponse(error: string, details?: any, status = 400) {
    let safeDetails = details;
    let safeMessage = typeof details === 'string' ? details : error;

    if (process.env.NODE_ENV === 'production') {
        // String details (typically error.message) → redact unless explicit safe
        if (typeof details === 'string') {
            safeDetails = undefined;
            safeMessage = error;
        } else if (!isUserFacingDetails(details)) {
            // Object details yang bukan user-facing (e.g. raw error object) → drop
            safeDetails = undefined;
            safeMessage = error;
        }
    }

    return NextResponse.json(
        {
            success: false,
            error,
            details: safeDetails,
            message: safeMessage,
        },
        { status }
    );
}

/**
 * Standard Zod Error Formatter
 */
export function formatZodError(error: z.ZodError) {
    return error.issues.map(issue => ({
        path: issue.path.join('.'),
        message: issue.message
    }));
}

/**
 * Helper to validate request data with Zod
 * Supports:
 * 1. validateRequest(request, schema) - Reads body and parses
 * 2. validateRequest(schema, data) - Parses provided data
 */
export async function validateRequest<T>(
    request: Request | NextRequest,
    schema: z.Schema<T>
): Promise<{ success: true; data: T } | { success: false; errorResponse: NextResponse }>;
export async function validateRequest<T>(
    schema: z.Schema<T>,
    data: any
): Promise<{ success: true; data: T } | { success: false; errorResponse: NextResponse }>;
export async function validateRequest<T>(
    arg1: any,
    arg2: any
): Promise<{ success: true; data: T } | { success: false; errorResponse: NextResponse }> {
    let schema: z.Schema<T>;
    let data: any;

    try {
        if (arg1 instanceof Request || (arg1 && typeof arg1.json === 'function')) {
            // Pattern: (request, schema)
            schema = arg2;
            data = await arg1.json();
        } else {
            // Pattern: (schema, data)
            schema = arg1;
            data = arg2;
        }

        const result = schema.safeParse(data);
        if (!result.success) {
            return {
                success: false,
                errorResponse: errorResponse('Validation Error', formatZodError(result.error), 400)
            };
        }
        return { success: true, data: result.data };
    } catch (error: any) {
        return {
            success: false,
            errorResponse: errorResponse('Invalid JSON payload', error.message, 400)
        };
    }
}

/**
 * Mask sensitive strings (e.g., license keys, passwords)
 */
export function maskData(data: string | null | undefined, visibleChars = 4): string {
    if (!data) return 'N/A';
    if (data.length <= visibleChars * 2) return '****';
    return `${data.substring(0, visibleChars)}...${data.substring(data.length - visibleChars)}`;
}

/**
 * Structured Logger
 */
export const logger = {
    info: (context: string, message: string, data?: any) => {
        console.log(`[${new Date().toISOString()}] [INFO] [${context}] ${message}`, data ? JSON.stringify(data) : '');
    },
    debug: (context: string, message: string, data?: any) => {
        console.log(`[${new Date().toISOString()}] [DEBUG] [${context}] ${message}`, data ? JSON.stringify(data) : '');
    },
    error: (context: string, message: string, error?: any) => {
        console.error(`[${new Date().toISOString()}] [ERROR] [${context}] ${message}`, error || '');
    },
    warn: (context: string, message: string, data?: any) => {
        console.warn(`[${new Date().toISOString()}] [WARN] [${context}] ${message}`, data || '');
    }
};
