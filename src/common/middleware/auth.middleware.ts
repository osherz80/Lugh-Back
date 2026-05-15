import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

@Injectable()
export class AuthMiddleware implements NestMiddleware {
    use(req: Request, res: Response, next: NextFunction) {
        const token = req.cookies['accessToken'];

        if (!token) {
            throw new UnauthorizedException('Access token missing');
        }

        try {
            const secret = process.env.JWT_SECRET;
            if (!secret) {
                console.error('JWT_SECRET is not defined in environment variables');
                throw new Error('Internal server error');
            }

            const decoded = jwt.verify(token, secret) as { userId: string };
            
            if (!decoded || !decoded.userId) {
                throw new UnauthorizedException('Invalid token payload');
            }

            // Make userId available on the request object
            req['userId'] = decoded.userId;
            
            next();
        } catch (err) {
            console.error('Auth Middleware Error:', err.message);
            throw new UnauthorizedException('Invalid or expired access token');
        }
    }
}
