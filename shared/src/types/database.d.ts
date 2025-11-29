export interface User {
    id: number;
    email: string;
    password_hash: string | null;
    username: string | null;
    created_at: Date;
    updated_at: Date;
    last_login_at: Date | null;
}
export interface PlayerProfile {
    id: number;
    user_id: number;
    display_name: string;
    avatar_url: string | null;
    country_code: string | null;
    created_at: Date;
    updated_at: Date;
}
export interface Ladder {
    id: number;
    code: string;
    name: string;
    time_limit_seconds: number;
    lives: number;
    is_ranked: boolean;
    created_at: Date;
}
export interface PlayerRating {
    id: number;
    player_id: number;
    ladder_id: number;
    rating: number;
    rd: number;
    volatility: number;
    games_played: number;
    last_update_at: Date;
}
export type PuzzleDifficulty = 'EASY' | 'MEDIUM' | 'HARD' | 'EXPERT';
export interface Puzzle {
    id: number;
    ladder_id: number;
    initial_grid: string;
    solution_grid: string;
    difficulty: PuzzleDifficulty;
    created_at: Date;
    metadata: Record<string, any> | null;
}
export type MatchStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'ABORTED';
export interface Match {
    id: number;
    ladder_id: number;
    puzzle_id: number;
    status: MatchStatus;
    result_code: number | null;
    created_at: Date;
    started_at: Date | null;
    ended_at: Date | null;
    server_region: string | null;
}
export type PlayerFinalState = 'SOLVED' | 'LOCKED_OUT' | 'TIMEOUT' | 'DISCONNECTED';
export interface MatchPlayer {
    id: number;
    match_id: number;
    player_id: number;
    slot: 1 | 2;
    rating_before: number;
    rd_before: number;
    volatility_before: number;
    rating_after: number | null;
    rd_after: number | null;
    volatility_after: number | null;
    cells_completed: number;
    lives_used: number;
    lives_remaining: number;
    mistakes: number;
    time_spent_seconds: number;
    final_state: PlayerFinalState | null;
    is_winner: boolean | null;
}
export interface MatchmakingQueueEntry {
    id: number;
    player_id: number;
    ladder_id: number;
    enqueued_at: Date;
    rating_snapshot: number;
    rd_snapshot: number;
    region: string | null;
}
//# sourceMappingURL=database.d.ts.map