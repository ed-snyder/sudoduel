interface Puzzle {
    initial: string;
    solution: string;
    difficulty: string;
}
declare const puzzles: Puzzle[];
declare function validateInitialMatchesSolution(initial: string, solution: string): {
    valid: boolean;
    errors: string[];
};
declare let allValid: boolean;
