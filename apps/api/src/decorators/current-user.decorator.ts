import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export interface CurrentUserData {
    id: string;
    email: string;
    name?: string;
    image?: string;
}

export const CurrentUser = createParamDecorator(
    (data: unknown, ctx: ExecutionContext): CurrentUserData => {
        const request = ctx.switchToHttp().getRequest<{ user: CurrentUserData }>();
        return request.user;
    },
);
