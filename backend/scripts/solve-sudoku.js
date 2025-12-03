"use strict";
// Simple Sudoku solver to find correct solutions
function stringToGrid(s) {
    const grid = [];
    for (let i = 0; i < 9; i++) {
        grid[i] = [];
        for (let j = 0; j < 9; j++) {
            grid[i][j] = parseInt(s[i * 9 + j], 10);
        }
    }
    return grid;
}
function gridToString(grid) {
    return grid.flat().join('');
}
function isValid(grid, row, col, num) {
    // Check row
    for (let j = 0; j < 9; j++) {
        if (grid[row][j] === num)
            return false;
    }
    // Check column
    for (let i = 0; i < 9; i++) {
        if (grid[i][col] === num)
            return false;
    }
    // Check box
    const boxRow = Math.floor(row / 3) * 3;
    const boxCol = Math.floor(col / 3) * 3;
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            if (grid[boxRow + i][boxCol + j] === num)
                return false;
        }
    }
    return true;
}
function solve(grid) {
    for (let i = 0; i < 9; i++) {
        for (let j = 0; j < 9; j++) {
            if (grid[i][j] === 0) {
                for (let num = 1; num <= 9; num++) {
                    if (isValid(grid, i, j, num)) {
                        grid[i][j] = num;
                        if (solve(grid)) {
                            return true;
                        }
                        grid[i][j] = 0;
                    }
                }
                return false;
            }
        }
    }
    return true;
}
// Test puzzles
const puzzles = [
    '003020600900305001001806400008102900700000008006708200002609500800203009005010300',
    '200080300060070084030500209000105408000000000402706000301007040720040060004010003',
    '000000907000420180000705026100904000050000040000507009920108000034059000507000000',
    '030050040008010500460000012070502080000603000040109030250000098001020600080060020',
];
puzzles.forEach((puzzle, idx) => {
    console.log(`\nPuzzle ${idx + 1}:`);
    const grid = stringToGrid(puzzle);
    if (solve(grid)) {
        console.log('Solution:', gridToString(grid));
    }
    else {
        console.log('No solution found');
    }
});
