import { Injectable, ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Observable } from "rxjs";

@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
    canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
        return super.canActivate(context);
    }

    handleRequest<TUser = any>(err: any, user: any): TUser {
        console.log("[JwtAuthGuard] handleRequest called");
        console.log("[JwtAuthGuard] Error:", err);
        console.log("[JwtAuthGuard] User:", user);
        if (err || !user) {
            throw err || new UnauthorizedException("Authentication required");
        }
        return user as TUser;
    }
}
