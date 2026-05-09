/**
 * A simple in-memory rate limiter for organization-level API requests.
 * Note: In a production environment with multiple serverless instances, 
 * this should be replaced with a persistent store like Redis.
 */

interface RateLimitState {
    count: number;
    resetAt: number;
}

const LIMITS = new Map<string, RateLimitState>();

export async function checkRateLimit(orgId: string, limit: number): Promise<{ success: boolean; remaining: number }> {
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute window

    let state = LIMITS.get(orgId);

    if (!state || now > state.resetAt) {
        state = {
            count: 0,
            resetAt: now + windowMs,
        };
    }

    if (state.count >= limit) {
        return {
            success: false,
            remaining: 0,
        };
    }

    state.count++;
    LIMITS.set(orgId, state);

    return {
        success: true,
        remaining: limit - state.count,
    };
}
