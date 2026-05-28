import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthService } from '../../auth/auth.service';

@Injectable()
export class AuthMiddleware implements NestMiddleware {
    constructor(private readonly authService: AuthService) { }

    async use(req: Request, res: Response, next: NextFunction) {
        const token = req.cookies?.['accessToken'];
        const refreshToken = req.cookies?.['refreshToken'];

        if (token) {
            try {
                const secret = process.env.JWT_SECRET;
                if (!secret) {
                    console.error('JWT_SECRET is not defined in environment variables');
                    throw new Error('Internal server error');
                }

                const decoded = jwt.verify(token, secret) as { userId: string };

                if (decoded && decoded.userId) {
                    req['userId'] = decoded.userId;
                    return next();
                }
            } catch (err) {
                // If verification failed (e.g. expired or invalid), we fallback to refresh token if available
                console.log('Access token invalid or expired. Attempting silent token refresh:', err?.message || err);
            }
        }

        // If we reach here, we either don't have an accessToken or it is invalid/expired.
        if (!refreshToken) {
            throw new UnauthorizedException('Access token missing or expired, and no refresh token was found');
        }

        try {
            const userId = await this.authService.refreshAccessToken(refreshToken, res);
            req['userId'] = userId;
            return next();
        } catch (refreshErr) {
            console.error('Silent refresh failed:', refreshErr?.message || refreshErr);
            throw new UnauthorizedException('Session expired. Please log in again.');
        }
    }
}
