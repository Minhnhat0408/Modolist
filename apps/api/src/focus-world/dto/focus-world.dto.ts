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

// ── Spotify Co-listening DTOs ──────────────────────────────────────

export class SpotifyHostStartDto {
    @IsString()
    @IsNotEmpty()
    userId: string;

    @IsString()
    @IsNotEmpty()
    trackUri: string;

    @IsString()
    @IsNotEmpty()
    trackName: string;

    @IsString()
    @IsNotEmpty()
    artistName: string;

    @IsString()
    @IsOptional()
    albumArt?: string;

    @IsNumber()
    positionMs: number;

    @IsBoolean()
    isPlaying: boolean;
}

export class SpotifyHostUpdateDto {
    @IsString()
    @IsNotEmpty()
    userId: string;

    @IsString()
    @IsOptional()
    trackUri?: string;

    @IsString()
    @IsOptional()
    trackName?: string;

    @IsString()
    @IsOptional()
    artistName?: string;

    @IsString()
    @IsOptional()
    albumArt?: string;

    @IsNumber()
    @IsOptional()
    positionMs?: number;

    @IsBoolean()
    @IsOptional()
    isPlaying?: boolean;
}

export class SpotifyHostStopDto {
    @IsString()
    @IsNotEmpty()
    userId: string;
}

export class SpotifySyncRequestDto {
    @IsString()
    @IsNotEmpty()
    userId: string;
}

export interface SpotifyPlaybackState {
    hostUserId: string;
    hostName: string | null;
    trackUri: string;
    trackName: string;
    artistName: string;
    albumArt?: string;
    positionMs: number;
    isPlaying: boolean;
    updatedAt: number; // Date.now() timestamp for latency compensation
}
