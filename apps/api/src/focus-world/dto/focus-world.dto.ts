import { IsString, IsNotEmpty, IsNumber, IsOptional, IsBoolean } from "class-validator";

export class JoinFloorDto {
    @IsString()
    @IsNotEmpty()
    userId: string;

    @IsString()
    @IsNotEmpty()
    sessionId: string;

    @IsString()
    @IsOptional()
    taskId?: string;

    @IsNumber()
    @IsOptional()
    timeLeft?: number; // Current remaining time in seconds
}

export class UpdateProgressDto {
    @IsString()
    @IsNotEmpty()
    sessionId: string;

    @IsNumber()
    progress: number;
}

export class LeaveFloorDto {
    @IsString()
    @IsNotEmpty()
    userId: string;
}

export class PauseFocusDto {
    @IsString()
    @IsNotEmpty()
    userId: string;

    @IsBoolean()
    isPaused: boolean;
}

export interface FocusUser {
    userId: string;
    name: string | null;
    image: string | null;
    currentTask: string;
    isPaused: boolean;
    focusProps: {
        startTime: string;
        duration: number;
    };
}

export interface ActiveUser {
    userId: string;
    userName: string | null;
    userImage: string | null;
    taskTitle: string;
    startTime: Date;
    duration: number;
    sessionId: string;
    socketId: string;
    isPaused: boolean;
    elapsedTime: number; // Track elapsed time for disconnect handling
}
