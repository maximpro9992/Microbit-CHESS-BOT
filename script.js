interface ChessMove {
    fromRow: number;
    fromCol: number;
    toRow: number;
    toCol: number;
    score: number;
    promoType?: number;
}

let bot_white = false
let current_turn_white = true
let game_over = false

// Флаги рокировки
let w_king_moved = false
let w_rook_l_moved = false
let w_rook_r_moved = false
let b_king_moved = false
let b_rook_l_moved = false
let b_rook_r_moved = false

let board = [
    [-4, -2, -3, -5, -6, -3, -2, -4],
    [-1, -1, -1, -1, -1, -1, -1, -1],
    [0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0],
    [1, 1, 1, 1, 1, 1, 1, 1],
    [4, 2, 3, 5, 6, 3, 2, 4]
]

const PIECE_VALUES = [0, 100, 320, 330, 500, 900, 20000]

const PAWN_TABLE = [
    [0, 0, 0, 0, 0, 0, 0, 0],
    [50, 50, 50, 50, 50, 50, 50, 50],
    [10, 10, 20, 30, 30, 20, 10, 10],
    [5, 5, 10, 25, 25, 10, 5, 5],
    [0, 0, 0, 20, 20, 0, 0, 0],
    [5, -5, -10, 0, 0, -10, -5, 5],
    [5, 10, 10, -20, -20, 10, 10, 5],
    [0, 0, 0, 0, 0, 0, 0, 0]
]

const KNIGHT_TABLE = [
    [-50, -40, -30, -30, -30, -30, -40, -50],
    [-40, -20, 0, 5, 5, 0, -20, -40],
    [-30, 5, 10, 15, 15, 10, 5, -30],
    [-30, 0, 15, 20, 20, 15, 0, -30],
    [-30, 0, 15, 20, 20, 15, 0, -30],
    [-30, 5, 10, 15, 15, 10, 5, -30],
    [-40, -20, 0, 0, 0, 0, -20, -40],
    [-50, -40, -30, -30, -30, -30, -40, -50]
]

bluetooth.startUartService()

bluetooth.onBluetoothConnected(function () {
    basic.showIcon(IconNames.Happy)
    basic.pause(1000)
    bot_white = randint(0, 1) == 1 ? true : false
    current_turn_white = true
    game_over = false
    w_king_moved = false; w_rook_l_moved = false; w_rook_r_moved = false;
    b_king_moved = false; b_rook_l_moved = false; b_rook_r_moved = false;

    if (bot_white) {
        basic.showString("W")
        bluetooth.uartWriteString("Bot: I am W (White). I start!\n")
        basic.pause(1000)
        process_bot_turn()
    } else {
        basic.showString("B")
        bluetooth.uartWriteString("Bot: I am B (Black). Make your move (e.g. e2e4)!\n")
    }
})

bluetooth.onBluetoothDisconnected(function () {
    basic.showIcon(IconNames.Sad)
})

bluetooth.onUartDataReceived(serial.delimiters(Delimiters.NewLine), function () {
    if (game_over || current_turn_white == bot_white) return;

    let msg = bluetooth.uartReadUntil(serial.delimiters(Delimiters.NewLine)).trim()
    if (msg.length < 4 || msg.includes("Bot:")) return;

    let colFrom = msg.charCodeAt(0) - 97
    let rowFrom = 8 - (msg.charCodeAt(1) - 48)
    let colTo = msg.charCodeAt(2) - 97
    let rowTo = 8 - (msg.charCodeAt(3) - 48)

    if (colFrom < 0 || colFrom > 7 || rowFrom < 0 || rowFrom > 7 ||
        colTo < 0 || colTo > 7 || rowTo < 0 || rowTo > 7) {
        return;
    }

    let piece = board[rowFrom][colFrom]

    if (Math.abs(piece) == 6 && Math.abs(colFrom - colTo) == 2) {
        if (rowFrom == 7 && colTo == 6) { board[7][5] = 4; board[7][7] = 0; }
        else if (rowFrom == 7 && colTo == 2) { board[7][3] = 4; board[7][0] = 0; }
        else if (rowFrom == 0 && colTo == 6) { board[0][5] = -4; board[0][7] = 0; }
        else if (rowFrom == 0 && colTo == 2) { board[0][3] = -4; board[0][0] = 0; }
    }

    if (piece == 6) w_king_moved = true
    if (piece == -6) b_king_moved = true
    if (piece == 4 && rowFrom == 7 && colFrom == 7) w_rook_r_moved = true
    if (piece == 4 && rowFrom == 7 && colFrom == 0) w_rook_l_moved = true
    if (piece == -4 && rowFrom == 0 && colFrom == 7) b_rook_r_moved = true
    if (piece == -4 && rowFrom == 0 && colFrom == 0) b_rook_l_moved = true

    let promo = 0
    if (msg.length >= 6) {
        let pChar = msg.charAt(5).toUpperCase()
        if (pChar == "Q") promo = 5
        if (pChar == "N") promo = 2
    } else if ((rowTo == 0 || rowTo == 7) && Math.abs(piece) == 1) {
        promo = 5
    }

    board[rowTo][colTo] = promo != 0 ? (piece > 0 ? promo : -promo) : piece
    board[rowFrom][colFrom] = 0

    bluetooth.uartWriteString("Move accepted. Thinking...\n")
    current_turn_white = !current_turn_white

    basic.pause(300)
    process_bot_turn()
})

function process_bot_turn() {
    if (game_over) return
    basic.showIcon(IconNames.Asleep)

    // Прямой вызов без создания тяжелого дерева рекурсии в памяти
    let bestMove = get_best_flat_move(bot_white)

    if (bestMove.fromRow == -1) {
        if (is_in_check(bot_white)) {
            bluetooth.uartWriteString("Bot: CHECKMATE! You win!\n")
            basic.showIcon(IconNames.Sad)
        } else {
            bluetooth.uartWriteString("Bot: STALEMATE (Draw)!\n")
            basic.showIcon(IconNames.Confused)
        }
        game_over = true
        return
    }

    let piece = board[bestMove.fromRow][bestMove.fromCol]

    if (Math.abs(piece) == 6 && Math.abs(bestMove.fromCol - bestMove.toCol) == 2) {
        if (bestMove.fromRow == 7 && bestMove.toCol == 6) { board[7][5] = 4; board[7][7] = 0; }
        else if (bestMove.fromRow == 7 && bestMove.toCol == 2) { board[7][3] = 4; board[7][0] = 0; }
        else if (bestMove.fromRow == 0 && bestMove.toCol == 6) { board[0][5] = -4; board[0][7] = 0; }
        else if (bestMove.fromRow == 0 && bestMove.toCol == 2) { board[0][3] = -4; board[0][0] = 0; }
    }

    if (piece == 6) w_king_moved = true
    if (piece == -6) b_king_moved = true
    if (piece == 4 && bestMove.fromRow == 7 && bestMove.fromCol == 7) w_rook_r_moved = true
    if (piece == 4 && bestMove.fromRow == 7 && bestMove.fromCol == 0) w_rook_l_moved = true
    if (piece == -4 && bestMove.fromRow == 0 && bestMove.fromCol == 7) b_rook_r_moved = true
    if (piece == -4 && bestMove.fromRow == 0 && bestMove.fromCol == 0) b_rook_l_moved = true

    let promo_str = ""
    if (Math.abs(piece) == 1 && (bestMove.toRow == 0 || bestMove.toRow == 7)) {
        let bestPromo = bestMove.promoType ? bestMove.promoType : 5
        board[bestMove.toRow][bestMove.toCol] = bot_white ? bestPromo : -bestPromo
        if (bestPromo == 5) promo_str = " Q"
    } else {
        board[bestMove.toRow][bestMove.toCol] = piece
    }
    board[bestMove.fromRow][bestMove.fromCol] = 0

    let move_str = String.fromCharCode(97 + bestMove.fromCol) + (8 - bestMove.fromRow) +
        String.fromCharCode(97 + bestMove.toCol) + (8 - bestMove.toRow) + promo_str

    current_turn_white = !current_turn_white

    if (is_in_check(current_turn_white)) {
        bluetooth.uartWriteString("Bot: " + move_str + " (CHECK!)\n")
        basic.showString("+")
    } else {
        bluetooth.uartWriteString("Bot: " + move_str + "\n")
        basic.showString(move_str.substr(2, 2))
    }
}

// Одномерный поиск без рекурсий — спасает оперативную память платки
function get_best_flat_move(isWhite: boolean): ChessMove {
    let rawMoves = generate_all_moves(isWhite)
    let bestScore = isWhite ? -100000 : 100000
    let bestMove: ChessMove = { fromRow: -1, fromCol: -1, toRow: -1, toCol: -1, score: bestScore }

    let hasLegalMoves = false

    for (let move of rawMoves) {
        let savedPiece = board[move.toRow][move.toCol]
        let currentPiece = board[move.fromRow][move.fromCol]

        // Симулируем
        board[move.toRow][move.toCol] = currentPiece
        board[move.fromRow][move.fromCol] = 0

        let underCheck = is_in_check(isWhite)

        if (!underCheck) {
            hasLegalMoves = true
            let score = evaluate_board()

            if (isWhite) {
                if (score > bestScore) {
                    bestScore = score
                    bestMove = move
                    bestMove.score = score
                }
            } else {
                if (score < bestScore) {
                    bestScore = score
                    bestMove = move
                    bestMove.score = score
                }
            }
        }

        // Откат
        board[move.fromRow][move.fromCol] = currentPiece
        board[move.toRow][move.toCol] = savedPiece
    }

    if (!hasLegalMoves) {
        bestMove.fromRow = -1 // Флаг мата/пата
    }
    return bestMove
}

function evaluate_board(): number {
    let total = 0
    let whitePieces = 0
    let blackPieces = 0

    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if (board[r][c] > 0) whitePieces++
            else if (board[r][c] < 0) blackPieces++
        }
    }

    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            let p = board[r][c]
            if (p == 0) continue
            let type = Math.abs(p)
            let val = PIECE_VALUES[type]

            if (p > 0) {
                if (type == 1) val += PAWN_TABLE[r][c]
                if (type == 2) {
                    val += KNIGHT_TABLE[r][c]
                    if (whitePieces >= 14 && (c == 0 || c == 7 || r == 5)) val -= 60 // Штраф за ранний прыжок на край
                }
                total += val
            } else {
                if (type == 1) val += PAWN_TABLE[7 - r][c]
                if (type == 2) {
                    val += KNIGHT_TABLE[7 - r][c]
                    if (blackPieces >= 14 && (c == 0 || c == 7 || r == 2)) val -= 60
                }
                total -= val
            }
        }
    }
    return total
}

function generate_all_moves(isWhite: boolean): ChessMove[] {
    let list: ChessMove[] = []
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            let p = board[r][c]
            if ((isWhite && p > 0) || (!isWhite && p < 0)) {
                let type = Math.abs(p)

                if (type == 1) {
                    let dir = isWhite ? -1 : 1
                    let nextR = r + dir
                    if (nextR >= 0 && nextR < 8 && board[nextR][c] == 0) {
                        add_move_with_promo(r, c, nextR, c, list)
                        let startRow = isWhite ? 6 : 1
                        let doubleR = r + (dir * 2)
                        if (r == startRow && board[doubleR][c] == 0) {
                            list.push({ fromRow: r, fromCol: c, toRow: doubleR, toCol: c, score: 0 })
                        }
                    }
                    let capCols = [c - 1, c + 1]
                    for (let nc of capCols) {
                        if (nc >= 0 && nc < 8 && nextR >= 0 && nextR < 8) {
                            let target = board[nextR][nc]
                            if (target != 0 && ((isWhite && target < 0) || (!isWhite && target > 0))) {
                                add_move_with_promo(r, c, nextR, nc, list)
                            }
                        }
                    }
                }

                if (type == 2) {
                    let knightMoves = [[-2, 1], [-1, 2], [1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1]]
                    for (let m of knightMoves) {
                        let nr = r + m[0], nc = c + m[1]
                        if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
                            let t = board[nr][nc]
                            if (t == 0 || (isWhite && t < 0) || (!isWhite && t > 0)) {
                                list.push({ fromRow: r, fromCol: c, toRow: nr, toCol: nc, score: 0 })
                            }
                        }
                    }
                }

                if (type == 3 || type == 4 || type == 5) {
                    let dirs: number[][] = []
                    if (type == 3 || type == 5) {
                        dirs.push([-1, -1]); dirs.push([1, 1]); dirs.push([-1, 1]); dirs.push([1, -1])
                    }
                    if (type == 4 || type == 5) {
                        dirs.push([-1, 0]); dirs.push([1, 0]); dirs.push([0, -1]); dirs.push([0, 1])
                    }
                    for (let d of dirs) {
                        let nr = r + d[0], nc = c + d[1]
                        while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
                            let t = board[nr][nc]
                            if (t == 0) {
                                list.push({ fromRow: r, fromCol: c, toRow: nr, toCol: nc, score: 0 })
                            } else {
                                if ((isWhite && t < 0) || (!isWhite && t > 0)) {
                                    list.push({ fromRow: r, fromCol: c, toRow: nr, toCol: nc, score: 0 })
                                }
                                break
                            }
                            nr += d[0]; nc += d[1]
                        }
                    }
                }

                if (type == 6) {
                    let kingMoves = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]]
                    for (let m of kingMoves) {
                        let nr = r + m[0], nc = c + m[1]
                        if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
                            let t = board[nr][nc]
                            if (t == 0 || (isWhite && t < 0) || (!isWhite && t > 0)) {
                                list.push({ fromRow: r, fromCol: c, toRow: nr, toCol: nc, score: 0 })
                            }
                        }
                    }

                    if (!is_in_check(isWhite)) {
                        if (isWhite && !w_king_moved) {
                            if (!w_rook_r_moved && board[7][5] == 0 && board[7][6] == 0 && board[7][7] == 4) {
                                list.push({ fromRow: 7, fromCol: 4, toRow: 7, toCol: 6, score: 40 })
                            }
                            if (!w_rook_l_moved && board[7][1] == 0 && board[7][2] == 0 && board[7][3] == 0 && board[7][0] == 4) {
                                list.push({ fromRow: 7, fromCol: 4, toRow: 7, toCol: 2, score: 35 })
                            }
                        } else if (!isWhite && !b_king_moved) {
                            if (!b_rook_r_moved && board[0][5] == 0 && board[0][6] == 0 && board[0][7] == -4) {
                                list.push({ fromRow: 0, fromCol: 4, toRow: 0, toCol: 6, score: 40 })
                            }
                            if (!b_rook_l_moved && board[0][1] == 0 && board[0][2] == 0 && board[0][3] == 0 && board[0][0] == -4) {
                                list.push({ fromRow: 0, fromCol: 4, toRow: 0, toCol: 2, score: 35 })
                            }
                        }
                    }
                }
            }
        }
    }
    return list
}

function add_move_with_promo(r: number, c: number, nr: number, nc: number, list: ChessMove[]) {
    if (nr == 0 || nr == 7) {
        list.push({ fromRow: r, fromCol: c, toRow: nr, toCol: nc, score: 0, promoType: 5 })
    } else {
        list.push({ fromRow: r, fromCol: c, toRow: nr, toCol: nc, score: 0 })
    }
}

function is_in_check(isWhite: boolean): boolean {
    let kr = -1, kc = -1
    let kingId = isWhite ? 6 : -6
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if (board[r][c] == kingId) { kr = r; kc = c; break; }
        }
    }
    if (kr == -1) return false

    let enemyWhite = !isWhite
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            let p = board[r][c]
            if ((enemyWhite && p > 0) || (!enemyWhite && p < 0)) {
                let type = Math.abs(p)
                if (type == 1) {
                    let dir = enemyWhite ? -1 : 1
                    if (r + dir == kr && (c - 1 == kc || c + 1 == kc)) return true
                }
                if (type == 2) {
                    let km = [[-2, 1], [-1, 2], [1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1]]
                    for (let m of km) {
                        if (r + m[0] == kr && c + m[1] == kc) return true
                    }
                }
                if (type == 3 || type == 4 || type == 5) {
                    let dirs: number[][] = []
                    if (type == 3 || type == 5) {
                        dirs.push([-1, -1]); dirs.push([1, 1]); dirs.push([-1, 1]); dirs.push([1, -1])
                    }
                    if (type == 4 || type == 5) {
                        dirs.push([-1, 0]); dirs.push([1, 0]); dirs.push([0, -1]); dirs.push([0, 1])
                    }
                    for (let d of dirs) {
                        let nr = r + d[0], nc = c + d[1]
                        while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
                            if (nr == kr && nc == kc) return true
                            if (board[nr][nc] != 0) break
                            nr += d[0]; nc += d[1]
                        }
                    }
                }
                if (type == 6) {
                    if (Math.abs(r - kr) <= 1 && Math.abs(c - kc) <= 1) return true
                }
            }
        }
    }
    return false
}
