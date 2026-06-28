
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

// Настройка USB-соединения (скорость по стандарту 115200 бод)
serial.redirectToUSB()

// Вместо события подключения Bluetooth — просто стартуем при включении платы
basic.showIcon(IconNames.Happy)
basic.pause(1000)
bot_white = randint(0, 1) == 1 ? true : false
current_turn_white = true
game_over = false

if (bot_white) {
basic.showString("W")
serial.writeString("Bot: I am W (White). USB Mode Active!\n")
basic.pause(1000)
process_bot_turn()
} else {
basic.showString("B")
serial.writeString("Bot: I am B (Black). USB Mode Active! Make move:\n")
}

// Прием данных через USB по новой строке
serial.onDataReceived(serial.delimiters(Delimiters.NewLine), function () {
if (game_over || current_turn_white == bot_white) return;

let msg = serial.readUntil(serial.delimiters(Delimiters.NewLine)).trim()
if (msg.length < 4 || msg.includes("Bot:")) return;

let colFrom = msg.charCodeAt(0) - 97
let rowFrom = 8 - (msg.charCodeAt(1) - 48)
let colTo = msg.charCodeAt(2) - 97
let rowTo = 8 - (msg.charCodeAt(3) - 48)

if (colFrom < 0 || colFrom > 7 || rowFrom < 0 || rowFrom > 7 ||
colTo < 0 || colTo > 7 || rowTo < 0 || rowTo > 7) {
serial.writeString("Bot: Invalid coordinates format!\n")
return;
}

let piece = board[rowFrom][colFrom]
if (piece == 0 || ((piece > 0) != current_turn_white)) {
serial.writeString("Bot: Invalid move (not your piece)!\n")
return;
}

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
} else if ((rowTo == 0 || rowTo == 7) && Math.abs(piece) == 1) {
promo = 5
}

board[rowTo][colTo] = promo != 0 ? (piece > 0 ? promo : -promo) : piece
board[rowFrom][colFrom] = 0

serial.writeString("Move accepted. Thinking...\n")
current_turn_white = !current_turn_white

basic.pause(300)
process_bot_turn()
})

let b_fromR = -1, b_fromC = -1, b_toR = -1, b_toC = -1, b_score = 0

function process_bot_turn() {
if (game_over) return
basic.showIcon(IconNames.Asleep)

find_best_move_zero_memory(bot_white)

if (b_fromR == -1) {
if (is_in_check(bot_white)) {
serial.writeString("Bot: CHECKMATE! You win!\n")
basic.showIcon(IconNames.Sad)
} else {
serial.writeString("Bot: STALEMATE!\n")
basic.showIcon(IconNames.Confused)
}
game_over = true
return
}

let piece = board[b_fromR][b_fromC]

if (Math.abs(piece) == 6 && Math.abs(b_fromC - b_toC) == 2) {
if (b_fromR == 7 && b_toC == 6) { board[7][5] = 4; board[7][7] = 0; }
else if (b_fromR == 7 && b_toC == 2) { board[7][3] = 4; board[7][0] = 0; }
else if (b_fromR == 0 && b_toC == 6) { board[0][5] = -4; board[0][7] = 0; }
else if (b_fromR == 0 && b_toC == 2) { board[0][3] = -4; board[0][0] = 0; }
}

if (piece == 6) w_king_moved = true
if (piece == -6) b_king_moved = true
if (piece == 4 && b_fromR == 7 && b_fromC == 7) w_rook_r_moved = true
if (piece == 4 && b_fromR == 7 && b_fromC == 0) w_rook_l_moved = true
if (piece == -4 && b_fromR == 0 && b_fromC == 7) b_rook_r_moved = true
if (piece == -4 && b_fromR == 0 && b_fromC == 0) b_rook_l_moved = true

let promo_str = ""
if (Math.abs(piece) == 1 && (b_toR == 0 || b_toR == 7)) {
board[b_toR][b_toC] = bot_white ? 5 : -5
promo_str = " Q"
} else {
board[b_toR][b_toC] = piece
}
board[b_fromR][b_fromC] = 0

let move_str = String.fromCharCode(97 + b_fromC) + (8 - b_fromR) +
String.fromCharCode(97 + b_toC) + (8 - b_toR) + promo_str

current_turn_white = !current_turn_white

if (is_in_check(current_turn_white)) {
serial.writeString("Bot: " + move_str + " (CHECK!)\n")
basic.showString("+")
} else {
serial.writeString("Bot: " + move_str + "\n")
basic.showString(move_str.substr(2, 2))
}
}

function find_best_move_zero_memory(isWhite: boolean) {
let targetScore = isWhite ? -100000 : 100000
b_fromR = -1; b_fromC = -1; b_toR = -1; b_toC = -1; b_score = targetScore

let r = 0
while (r < 8) {
let c = 0
while (c < 8) {
let p = board[r][c]
if ((isWhite && p > 0) || (!isWhite && p < 0)) {
process_piece_moves_on_the_fly(r, c, isWhite)
}
c++
}
r++
}
}

function process_piece_moves_on_the_fly(r: number, c: number, isWhite: boolean) {
let p = board[r][c]
let type = Math.abs(p)
let dir = isWhite ? -1 : 1

if (type == 1) { // Пешка
let nextR = r + dir
if (nextR >= 0 && nextR < 8 && board[nextR][c] == 0) {
check_and_save_move(r, c, nextR, c, isWhite)
let startRow = isWhite ? 6 : 1
if (r == startRow && board[r + dir * 2][c] == 0) {
check_and_save_move(r, c, r + dir * 2, c, isWhite)
}
}
let cIdx = 0
let sideCols = [c - 1, c + 1]
while (cIdx < 2) {
let nc = sideCols[cIdx]
if (nc >= 0 && nc < 8 && nextR >= 0 && nextR < 8) {
let target = board[nextR][nc]
if (target != 0 && ((isWhite && target < 0) || (!isWhite && target > 0))) {
check_and_save_move(r, c, nextR, nc, isWhite)
}
}
cIdx++
}
}
else if (type == 2) { // Конь
let km = [[-2, 1], [-1, 2], [1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1]]
let i = 0
while (i < 8) {
let nr = r + km[i][0], nc = c + km[i][1]
if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
let t = board[nr][nc]
if (t == 0 || (isWhite && t < 0) || (!isWhite && t > 0)) {
check_and_save_move(r, c, nr, nc, isWhite)
}
}
i++
}
}
else if (type == 3 || type == 4 || type == 5) { // Линейные
let dirs: number[][] = []
if (type == 3 || type == 5) { dirs.push([-1, -1]); dirs.push([1, 1]); dirs.push([-1, 1]); dirs.push([1, -1]); }
if (type == 4 || type == 5) { dirs.push([-1, 0]); dirs.push([1, 0]); dirs.push([0, -1]); dirs.push([0, 1]); }
let d = 0
while (d < dirs.length) {
let nr = r + dirs[d][0], nc = c + dirs[d][1]
while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
let t = board[nr][nc]
if (t == 0) {
check_and_save_move(r, c, nr, nc, isWhite)
} else {
if ((isWhite && t < 0) || (!isWhite && t > 0)) {
check_and_save_move(r, c, nr, nc, isWhite)
}
break
}
nr += dirs[d][0]; nc += dirs[d][1]
}
d++
}
}
else if (type == 6) { // Король
let km = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]]
let i = 0
while (i < 8) {
let nr = r + km[i][0], nc = c + km[i][1]
if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
let t = board[nr][nc]
if (t == 0 || (isWhite && t < 0) || (!isWhite && t > 0)) {
check_and_save_move(r, c, nr, nc, isWhite)
}
}
i++
}
if (!is_in_check(isWhite)) {
if (isWhite && !w_king_moved) {
if (!w_rook_r_moved && board[7][5] == 0 && board[7][6] == 0 && board[7][7] == 4) check_and_save_move(7, 4, 7, 6, true)
if (!w_rook_l_moved && board[7][1] == 0 && board[7][2] == 0 && board[7][3] == 0 && board[7][0] == 4) check_and_save_move(7, 4, 7, 2, true)
} else if (!isWhite && !b_king_moved) {
if (!b_rook_r_moved && board[0][5] == 0 && board[0][6] == 0 && board[0][7] == -4) check_and_save_move(0, 4, 0, 6, false)
if (!b_rook_l_moved && board[0][1] == 0 && board[0][2] == 0 && board[0][3] == 0 && board[0][0] == -4) check_and_save_move(0, 4, 0, 2, false)
}
}
}
}

function check_and_save_move(fr: number, fc: number, tr: number, tc: number, isWhite: boolean) {
let savedPiece = board[tr][tc]
let currentPiece = board[fr][fc]

if (Math.abs(currentPiece) == 1 && fc != tc && savedPiece == 0) {
return;
}

board[tr][tc] = currentPiece
board[fr][fc] = 0

if (!is_in_check(isWhite)) {
let score = evaluate_board()

let enemyCapture = get_best_enemy_capture(!isWhite)
if (isWhite) score -= enemyCapture
else score += enemyCapture

let noise = randint(0, 2) - 1
let finalScore = score + noise

if (isWhite) {
if (finalScore > b_score || b_fromR == -1) {
b_score = finalScore; b_fromR = fr; b_fromC = fc; b_toR = tr; b_toC = tc
}
} else {
if (finalScore < b_score || b_fromR == -1) {
b_score = finalScore; b_fromR = fr; b_fromC = fc; b_toR = tr; b_toC = tc
}
}
}

board[fr][fc] = currentPiece
board[tr][tc] = savedPiece
}

function get_best_enemy_capture(isEnemyWhite: boolean): number {
let maxCapture = 0
let r = 0
while (r < 8) {
let c = 0
while (c < 8) {
let p = board[r][c]
if ((isEnemyWhite && p > 0) || (!isEnemyWhite && p < 0)) {
let type = Math.abs(p)
if (type == 1) {
let dir = isEnemyWhite ? -1 : 1
if (r + dir >= 0 && r + dir < 8) {
let cIdx = 0
let sideCols = [c - 1, c + 1]
while (cIdx < 2) {
let nc = sideCols[cIdx]
if (nc >= 0 && nc < 8) {
let t = board[r + dir][nc]
if (t != 0 && ((isEnemyWhite && t < 0) || (!isEnemyWhite && t > 0))) {
if (PIECE_VALUES[Math.abs(t)] > maxCapture) maxCapture = PIECE_VALUES[Math.abs(t)]
}
}
cIdx++
}
}
}
if (type == 2) {
let km = [[-2, 1], [-1, 2], [1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1]]
let i = 0
while (i < 8) {
let nr = r + km[i][0], nc = c + km[i][1]
if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
let t = board[nr][nc]
if (t != 0 && ((isEnemyWhite && t < 0) || (!isEnemyWhite && t > 0))) {
if (PIECE_VALUES[Math.abs(t)] > maxCapture) maxCapture = PIECE_VALUES[Math.abs(t)]
}
}
i++
}
}
if (type == 3 || type == 4 || type == 5) {
let dirs: number[][] = []
if (type == 3 || type == 5) { dirs.push([-1, -1]); dirs.push([1, 1]); dirs.push([-1, 1]); dirs.push([1, -1]); }
if (type == 4 || type == 5) { dirs.push([-1, 0]); dirs.push([1, 0]); dirs.push([0, -1]); dirs.push([0, 1]); }
let d = 0
while (d < dirs.length) {
let nr = r + dirs[d][0], nc = c + dirs[d][1]
while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
let t = board[nr][nc]
if (t != 0) {
if ((isEnemyWhite && t < 0) || (!isEnemyWhite && t > 0)) {
if (PIECE_VALUES[Math.abs(t)] > maxCapture) maxCapture = PIECE_VALUES[Math.abs(t)]
}
break
}
nr += dirs[d][0]; nc += dirs[d][1]
}
d++
}
}
}
c++
}
r++
}
return maxCapture
}

function evaluate_board(): number {
let total = 0
let pieces = 0
let r = 0
while (r < 8) {
let c = 0
while (c < 8) {
let p = board[r][c]
if (p != 0) {
pieces++
let type = Math.abs(p)
let val = PIECE_VALUES[type]
if (p > 0) {
if (type == 1) val += PAWN_TABLE[r][c]
if (type == 2) {
val += KNIGHT_TABLE[r][c]
if (pieces >= 24 && (c == 0 || c == 7 || r == 5)) val -= 55
}
total += val
} else {
if (type == 1) val += PAWN_TABLE[7 - r][c]
if (type == 2) {
val += KNIGHT_TABLE[7 - r][c]
if (pieces >= 24 && (c == 0 || c == 7 || r == 2)) val -= 55
}
total -= val
}
}
c++
}
r++
}
return total
}

function is_in_check(isWhite: boolean): boolean {
let kr = -1, kc = -1
let kingId = isWhite ? 6 : -6
let r = 0
while (r < 8) {
let c = 0
while (c < 8) {
if (board[r][c] == kingId) { kr = r; kc = c; break; }
c++
}
if (kr != -1) break
r++
}
if (kr == -1) return false

let enemyWhite = !isWhite
r = 0
while (r < 8) {
let c = 0
while (c < 8) {
let p = board[r][c]
if ((enemyWhite && p > 0) || (!enemyWhite && p < 0)) {
let type = Math.abs(p)
if (type == 1 && r + (enemyWhite ? -1 : 1) == kr && (c - 1 == kc || c + 1 == kc)) return true
if (type == 2) {
let km = [[-2, 1], [-1, 2], [1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1]]
let i = 0
while (i < 8) {
if (r + km[i][0] == kr && c + km[i][1] == kc) return true
i++
}
}
if (type == 3 || type == 4 || type == 5) {
let dirs: number[][] = []
if (type == 3 || type == 5) { dirs.push([-1, -1]); dirs.push([1, 1]); dirs.push([-1, 1]); dirs.push([1, -1]); }
if (type == 4 || type == 5) { dirs.push([-1, 0]); dirs.push([1, 0]); dirs.push([0, -1]); dirs.push([0, 1]); }
let d = 0
while (d < dirs.length) {
let nr = r + dirs[d][0], nc = c + dirs[d][1]
while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
if (nr == kr && nc == kc) return true
if (board[nr][nc] != 0) break
nr += dirs[d][0]; nc += dirs[d][1]
}
d++
}
}
if (type == 6 && Math.abs(r - kr) <= 1 && Math.abs(c - kc) <= 1) return true
}
c++
}
r++
}
return false
                                }    [50, 50, 50, 50, 50, 50, 50, 50],
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
