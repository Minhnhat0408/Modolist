import { Injectable, NestMiddleware } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Request, Response, NextFunction } from "express";
import * as crypto from "crypto"; // Thêm thư viện crypto gốc của Node.js

@Injectable()
export class BullBoardAuthMiddleware implements NestMiddleware {
    constructor(private readonly config: ConfigService) {}

    use(req: Request, res: Response, next: NextFunction) {
        const expectedUser = this.config.get<string>("BULL_BOARD_USER", "test");
        const expectedPass = this.config.get<string>("BULL_BOARD_PASSWORD", "test");

        const authHeader = req.headers["authorization"];

        if (!authHeader || !authHeader.startsWith("Basic ")) {
            res.setHeader("WWW-Authenticate", 'Basic realm="Bull Board"');
            res.status(401).send("Authentication required");
            return;
        }

        const base64 = authHeader.slice("Basic ".length);
        const decoded = Buffer.from(base64, "base64").toString("utf-8");
        // Giới hạn split ở 2 phần tử đầu để tránh lỗi nếu mật khẩu chứa dấu ":"
        const [user, ...passParts] = decoded.split(":");
        const pass = passParts.join(":");

        // Sử dụng native crypto thay vì vòng lặp for
        const userMatch = secureCompare(user ?? "", expectedUser);
        const passMatch = secureCompare(pass ?? "", expectedPass);

        if (!userMatch || !passMatch) {
            res.setHeader("WWW-Authenticate", 'Basic realm="Bull Board"');
            res.status(401).send("Invalid credentials");
            return;
        }

        next();
    }
}

function secureCompare(a: string, b: string): boolean {
    const aHash = crypto.createHash("sha256").update(a).digest();
    const bHash = crypto.createHash("sha256").update(b).digest();
    return crypto.timingSafeEqual(aHash, bHash);
}
