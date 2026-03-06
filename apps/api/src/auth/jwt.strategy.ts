import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { PrismaService } from "../prisma/prisma.service";

export interface JwtPayload {
    id: string;
    email: string;
    name?: string;
    picture?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(private prisma: PrismaService) {
        const secret = process.env.AUTH_SECRET || "your-secret-key";
        console.log("[JwtStrategy] Constructor called");
        console.log(
            "[JwtStrategy] AUTH_SECRET:",
            secret ? secret.substring(0, 10) + "..." : "MISSING",
        );
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: secret,
        });
    }

    async validate(payload: JwtPayload) {
        // Verify user exists in database
        console.log("[JwtStrategy] validate() called with payload:", payload);
        const user = await this.prisma.client.user.findUnique({
            where: { id: payload.id },
            select: {
                id: true,
                email: true,
                name: true,
                image: true,
            },
        });

        if (!user) {
            throw new UnauthorizedException("User not found");
        }

        return user; // This will be available as req.user
    }
}
