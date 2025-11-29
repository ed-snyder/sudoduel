export interface SignupRequest {
    email: string;
    password: string;
    display_name: string;
}
export interface LoginRequest {
    email: string;
    password: string;
}
export interface AuthResponse {
    token: string;
    user: {
        id: number;
        email: string;
        display_name: string;
    };
}
export interface PlayerProfileResponse {
    id: number;
    display_name: string;
    avatar_url: string | null;
    country_code: string | null;
    rating: number;
    rd: number;
    games_played: number;
}
export interface JoinMatchmakingRequest {
    ladder_id: number;
}
export interface MatchmakingResponse {
    status: 'queued' | 'matched';
    match_id?: number;
    position?: number;
}
export interface MatchStartData {
    match_id: number;
    ladder: {
        code: string;
        name: string;
        time_limit_seconds: number;
        lives: number;
    };
    puzzle: {
        id: number;
        initial_grid: string;
        difficulty: string;
    };
    player_slot: 1 | 2;
    opponent: {
        display_name: string;
        rating: number;
    };
}
export interface PlayerState {
    slot: 1 | 2;
    display_name: string;
    cells_completed: number;
    lives_remaining: number;
    time_spent_seconds: number;
    is_locked_out: boolean;
}
export interface MatchState {
    match_id: number;
    status: string;
    player1: PlayerState;
    player2: PlayerState;
}
export interface MatchResult {
    outcome: 'WIN' | 'LOSS' | 'DRAW';
    rating_before: number;
    rating_after: number;
    rating_change: number;
    cells_completed: number;
    opponent_cells_completed: number;
    mistakes: number;
    time_spent_seconds: number;
}
//# sourceMappingURL=api.d.ts.map