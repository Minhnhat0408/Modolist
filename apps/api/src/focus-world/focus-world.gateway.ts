import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    OnGatewayConnection,
    OnGatewayDisconnect,
    MessageBody,
    ConnectedSocket,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { Logger } from "@nestjs/common";
import { FocusWorldService } from "./focus-world.service";
import {
    JoinFloorDto,
    UpdateProgressDto,
    LeaveFloorDto,
    PauseFocusDto,
    FocusUser,
    ActiveUser,
} from "./dto/focus-world.dto";

@WebSocketGateway({
    cors: {
        origin: process.env.NEXT_PUBLIC_WEB_URL || "http://localhost:3000",
        credentials: true,
    },
    namespace: "/focus-world",
})
export class FocusWorldGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    private readonly logger = new Logger(FocusWorldGateway.name);
    private activeUsers: Map<string, ActiveUser> = new Map();

    constructor(private readonly focusWorldService: FocusWorldService) {}

    handleConnection(client: Socket) {
        this.logger.log(`Client connected: ${client.id}`);
    }

    async handleDisconnect(client: Socket) {
        this.logger.log(`Client disconnected: ${client.id}`);

        const user = this.activeUsers.get(client.id);
        if (!user) return;

        // Remove from active users immediately
        this.activeUsers.delete(client.id);

        // Notify others → user left
        this.server.to("focus-world").emit("user_left", {
            userId: user.userId,
        });

        // Calculate elapsed time: plannedDuration - timeLeft
        // timeLeft = duration - elapsed from startTime
        const elapsedFromStart = Math.floor((Date.now() - user.startTime.getTime()) / 1000);
        const totalElapsed = Math.min(elapsedFromStart, user.duration);

        // Set DB session to PAUSED with grace period
        await this.focusWorldService.handleDisconnect(user.sessionId, totalElapsed);

        this.logger.log(`User ${user.userId} disconnected → PAUSED (elapsed: ${totalElapsed}s)`);
    }

    @SubscribeMessage("join_floor")
    async handleJoinFloor(@MessageBody() data: JoinFloorDto, @ConnectedSocket() client: Socket) {
        try {
            this.logger.log(`User ${data.userId} attempting to join focus floor`);

            // Validate session
            const sessionData = await this.focusWorldService.validateSession(
                data.sessionId,
                data.userId,
            );

            if (!sessionData) {
                this.logger.warn(`Invalid session for user ${data.userId}`);
                client.emit("error", { message: "No active focus session found" });
                client.disconnect();
                return;
            }

            // Get user info
            const userInfo = await this.focusWorldService.getUserInfo(data.userId);
            if (!userInfo) {
                client.emit("error", { message: "User not found" });
                client.disconnect();
                return;
            }

            // Get task title
            let taskTitle = "General Focus";
            if (sessionData.taskId) {
                const taskInfo = await this.focusWorldService.getTaskInfo(sessionData.taskId);
                taskTitle = taskInfo?.title || "General Focus";
            }

            // Calculate effective startTime based on timeLeft (handles resume correctly)
            let effectiveStartTime: Date;
            if (data.timeLeft !== undefined && data.timeLeft > 0) {
                const elapsedSeconds = sessionData.plannedDuration - data.timeLeft;
                effectiveStartTime = new Date(Date.now() - elapsedSeconds * 1000);
            } else {
                effectiveStartTime = sessionData.startedAt;
            }

            // Remove any existing sockets for this userId (reconnection)
            for (const [socketId, existingUser] of this.activeUsers.entries()) {
                if (existingUser.userId === data.userId) {
                    this.logger.log(`Removing old socket ${socketId} for user ${data.userId}`);
                    this.activeUsers.delete(socketId);
                }
            }

            // Calculate elapsed for tracking
            const elapsedTime =
                data.timeLeft !== undefined
                    ? sessionData.plannedDuration - data.timeLeft
                    : Math.floor((Date.now() - sessionData.startedAt.getTime()) / 1000);

            // Create active user
            const activeUser: ActiveUser = {
                userId: data.userId,
                userName: userInfo.name,
                userImage: userInfo.image,
                taskTitle,
                startTime: effectiveStartTime,
                duration: sessionData.plannedDuration,
                sessionId: data.sessionId,
                socketId: client.id,
                isPaused: false,
                elapsedTime,
            };

            this.activeUsers.set(client.id, activeUser);
            void client.join("focus-world");

            // Send current world state to the joining user (excluding themselves)
            const worldState = this.getWorldState(data.userId);
            client.emit("world_state", worldState);

            // Notify others
            const focusUser = this.toFocusUser(activeUser);
            client.to("focus-world").emit("user_joined", focusUser);

            this.logger.log(
                `User ${data.userId} joined focus floor. Total users: ${this.activeUsers.size}`,
            );
        } catch (error: unknown) {
            this.logger.error(
                `Error in join_floor: ${(error as Error).message}`,
                (error as Error).stack,
            );
            client.emit("error", { message: "Failed to join focus floor" });
            client.disconnect();
        }
    }

    @SubscribeMessage("pause_focus")
    handlePauseFocus(@MessageBody() data: PauseFocusDto, @ConnectedSocket() client: Socket) {
        try {
            const activeUser = this.activeUsers.get(client.id);
            if (!activeUser) return;

            activeUser.isPaused = data.isPaused;

            // If pausing, snapshot elapsedTime
            if (data.isPaused) {
                activeUser.elapsedTime = Math.floor(
                    (Date.now() - activeUser.startTime.getTime()) / 1000,
                );
            } else {
                // Resuming: recalc startTime so ProgressRing works
                activeUser.startTime = new Date(Date.now() - activeUser.elapsedTime * 1000);
            }

            // Broadcast to others
            this.server.to("focus-world").emit("user_paused", {
                userId: data.userId,
                isPaused: data.isPaused,
            });

            this.logger.log(`User ${data.userId} ${data.isPaused ? "paused" : "resumed"}`);
        } catch (error: unknown) {
            this.logger.error(`Error in pause_focus: ${(error as Error).message}`);
        }
    }

    @SubscribeMessage("update_progress")
    handleUpdateProgress(
        @MessageBody() data: UpdateProgressDto,
        @ConnectedSocket() client: Socket,
    ) {
        try {
            const activeUser = this.activeUsers.get(client.id);
            if (!activeUser) return;

            client.to("focus-world").emit("user_progress_updated", {
                userId: activeUser.userId,
                progress: data.progress,
            });
        } catch (error: unknown) {
            this.logger.error(`Error in update_progress: ${(error as Error).message}`);
        }
    }

    @SubscribeMessage("leave_floor")
    handleLeaveFloor(@MessageBody() data: LeaveFloorDto, @ConnectedSocket() client: Socket) {
        try {
            const activeUser = this.activeUsers.get(client.id);
            if (!activeUser) return;

            this.activeUsers.delete(client.id);
            void client.leave("focus-world");

            this.server.to("focus-world").emit("user_left", {
                userId: data.userId,
            });

            this.logger.log(
                `User ${data.userId} left focus floor. Remaining: ${this.activeUsers.size}`,
            );
        } catch (error: unknown) {
            this.logger.error(`Error in leave_floor: ${(error as Error).message}`);
        }
    }

    private toFocusUser(activeUser: ActiveUser): FocusUser {
        return {
            userId: activeUser.userId,
            name: activeUser.userName,
            image: activeUser.userImage,
            currentTask: activeUser.taskTitle,
            isPaused: activeUser.isPaused,
            focusProps: {
                startTime: activeUser.startTime.toISOString(),
                duration: activeUser.duration,
            },
        };
    }

    private getWorldState(excludeUserId?: string): FocusUser[] {
        const users: FocusUser[] = [];

        for (const activeUser of this.activeUsers.values()) {
            if (excludeUserId && activeUser.userId === excludeUserId) continue;
            users.push(this.toFocusUser(activeUser));
        }

        return users;
    }
}
