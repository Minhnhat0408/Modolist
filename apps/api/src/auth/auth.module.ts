import { Module } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";
import { JwtModule } from "@nestjs/jwt";
import { JwtStrategy } from "./jwt.strategy";

@Module({
    imports: [
        PassportModule.register({ defaultStrategy: "jwt" }),
        JwtModule.register({
            secret: process.env.AUTH_SECRET,
            signOptions: {
                expiresIn: "30d",
            },
        }),
    ],
    providers: [JwtStrategy],
    exports: [JwtStrategy, PassportModule, JwtModule],
})
export class AuthModule {}
